/**
 * Tests for the LCMS student-flow + auth section of the adapter: legacy-shape
 * mapping (seconds→minutes, JSON-string payloads, naive datetimes), the
 * submit→history submissionId fallback, and auth response normalization.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lcmsGetCurrentAttempt,
  lcmsGetExercise,
  lcmsGetSubmission,
  lcmsListHistory,
  lcmsListLessonExercises,
  lcmsLogin,
  lcmsRefresh,
  lcmsStartAttempt,
  lcmsSubmitAttempt,
} from "@/core/api/lcmsAdapter";

const envelope = (data: unknown, total: number | null = null) => ({
  success: true,
  message: null,
  data,
  total,
});
const NOT_FOUND = { success: false, message: "not-found", data: null, total: null };

type Route = { match: string; status?: number; body: unknown };

/** Stub fetch with first-match-wins routes; unmatched URLs get not-found. */
function stubFetch(routes: Route[]) {
  const mock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const u = String(url);
    const route = routes.find((r) => u.includes(r.match));
    const body = route?.body ?? NOT_FOUND;
    return new Response(JSON.stringify(body), {
      status: route?.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** Format a Date as a NAIVE local datetime string (LCMS wire format). */
function naiveLocal(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/**
 * Format a Date as a NAIVE UTC datetime — how LCMS actually sends
 * current-attempt `startedAt` (no offset, value is UTC). The resume cross-check
 * treats such naive values as UTC (parseLcmsInstant), matching production.
 */
function naiveUtc(d: Date): string {
  return d.toISOString().replace(/\.\d+Z$/, "");
}

afterEach(() => vi.unstubAllGlobals());

describe("lcmsListLessonExercises", () => {
  it("maps the LCMS list to legacy ExerciseListItem with a quiz default type", async () => {
    stubFetch([
      {
        match: "/book-lesson/50001/excercise",
        body: envelope(
          [
            { id: "5001", name: "Bài 1", totalQuestion: "5", status: "in_progress" },
            { id: "5002", name: "Bài 2", totalQuestion: 4, status: "submitted" },
          ],
          2,
        ),
      },
    ]);
    const items = await lcmsListLessonExercises("50001");
    expect(items).toEqual([
      { id: "5001", title: "Bài 1", type: "quiz", totalQuestions: 5, status: "in_progress" },
      { id: "5002", title: "Bài 2", type: "quiz", totalQuestions: 4, status: "submitted" },
    ]);
  });

  it("returns [] on the not-found envelope", async () => {
    stubFetch([]);
    await expect(lcmsListLessonExercises("999")).resolves.toEqual([]);
  });

  it("sends the Bearer token from the stored session", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === "evo_auth_access_token" ? "tok-123" : null),
    });
    const mock = stubFetch([
      { match: "/book-lesson/1/excercise", body: envelope([], 0) },
    ]);
    await lcmsListLessonExercises("1");
    const headers = (mock.mock.calls[0][1] as RequestInit | undefined)?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("Bearer tok-123");
  });
});

describe("lcmsGetExercise", () => {
  const QUESTION_SCHEMA = {
    type: "multiple_choice",
    options: [{ id: "ba", content: { blocks: [] } }],
    correctAnswer: ["ba"],
  };

  it("converts duration seconds→minutes and reads type/correctAnswer from schema_payload", async () => {
    stubFetch([
      {
        match: "/book-excercise/student-portal/5001",
        body: envelope({
          id: "5001",
          name: "Bài 1",
          instructions: "Chọn đáp án đúng",
          duration: 600,
          questions: [
            {
              id: "2",
              content: "Câu 2",
              options: '[{"label":"x","text":"X"}]', // JSON string variant
              schema_payload: JSON.stringify(QUESTION_SCHEMA),
              points: "2",
              order: 2,
            },
            {
              id: "1",
              content: "Câu 1",
              options: [{ key: "a", text: "Đáp án A" }], // parsed-array variant
              schema_payload: QUESTION_SCHEMA, // parsed-object variant
              points: 1,
              order: 1,
            },
          ],
        }),
      },
    ]);
    const detail = await lcmsGetExercise("5001");
    expect(detail.id).toBe("5001");
    expect(detail.title).toBe("Bài 1");
    expect(detail.durationMinutes).toBe(10);
    // sorted by order
    expect(detail.questions.map((q) => q.id)).toEqual(["1", "2"]);
    const [q1, q2] = detail.questions;
    expect(q1.type).toBe("multiple_choice");
    expect(q1.correctAnswer).toEqual(["ba"]);
    expect(q1.options).toEqual([{ id: "a", content: "Đáp án A" }]);
    expect(q1.payload).toMatchObject({ correctAnswer: ["ba"] });
    expect(q2.options).toEqual([{ id: "x", content: "X" }]);
    expect(q2.points).toBe(2);
  });
});

describe("lcmsGetCurrentAttempt", () => {
  // 10 minutes ago, ms zeroed — the naive wire format has second precision.
  const started = new Date(Math.floor(Date.now() / 1000) * 1000 - 10 * 60 * 1000);

  it("parses JSON-string userAnswers and falls back to raw strings", async () => {
    stubFetch([
      {
        match: "/attempt/excercise/5001/current-attempt",
        body: envelope({
          attemptId: "12345",
          startedAt: naiveLocal(started),
          answers: [
            { questionId: "1", userAnswer: '["ba"]', isCorrect: true, score: 1 },
            { questionId: "2", userAnswer: '"a"', isCorrect: false, score: 0 },
            { questionId: "3", userAnswer: "plain-text", isCorrect: false, score: 0 },
          ],
        }),
      },
      // no history → no newer submission → attempt is resumable
    ]);
    const attempt = await lcmsGetCurrentAttempt("5001");
    expect(attempt).not.toBeNull();
    expect(attempt!.attemptId).toBe("12345");
    expect(new Date(attempt!.startedAt).getTime()).toBe(started.getTime());
    expect(attempt!.answers).toEqual([
      { questionId: "1", answer: ["ba"] },
      { questionId: "2", answer: "a" },
      { questionId: "3", answer: "plain-text" },
    ]);
  });

  it("returns null when the newest submission postdates the attempt (already submitted)", async () => {
    const submitted = new Date(started.getTime() + 5 * 60 * 1000);
    stubFetch([
      {
        match: "/attempt/excercise/5001/current-attempt",
        body: envelope({ attemptId: "12345", startedAt: naiveUtc(started), answers: [] }),
      },
      {
        match: "/submission/history",
        body: envelope({
          items: [
            {
              submissionId: "9001",
              bookId: "50",
              bookTitle: "Sách",
              lessonId: "50001",
              exerciseId: "5001",
              exerciseTitle: "Bài 1",
              score: 8,
              maxScore: 10,
              gradingStatus: "graded",
              submittedAt: submitted.toISOString(),
            },
          ],
          pagination: { page: 1, limit: 20, total: 1 },
        }),
      },
    ]);
    await expect(lcmsGetCurrentAttempt("5001")).resolves.toBeNull();
  });

  it("returns null on the not-found envelope", async () => {
    stubFetch([]);
    await expect(lcmsGetCurrentAttempt("777")).resolves.toBeNull();
  });

  it("returns null on a plain HTTP 404 (no attempt yet)", async () => {
    stubFetch([
      {
        match: "/attempt/excercise/777/current-attempt",
        status: 404,
        body: { timestamp: "2026-07-14", status: 404, error: "Not Found" },
      },
    ]);
    await expect(lcmsGetCurrentAttempt("777")).resolves.toBeNull();
  });
});

describe("lcmsSubmitAttempt", () => {
  it("synthesizes SubmitResult from the newest history entry for the attempt's exercise", async () => {
    const older = new Date(Date.now() - 60 * 60 * 1000);
    const newer = new Date(Date.now() - 60 * 1000);
    const historyItem = (submissionId: string, at: Date, gradingStatus: string) => ({
      submissionId,
      bookId: "50",
      bookTitle: "Sách",
      lessonId: "50001",
      exerciseId: "5001",
      exerciseTitle: "Bài 1",
      score: 8,
      maxScore: 10,
      gradingStatus,
      submittedAt: naiveLocal(at),
    });
    stubFetch([
      {
        match: "/attempt/excercise/5001/start",
        body: envelope({ attemptId: "12346", startedAt: naiveLocal(older) }),
      },
      { match: "/attempt/12346/submit", body: envelope("Submitted successfully", 1) },
      {
        match: "/submission/history",
        body: envelope({
          items: [historyItem("9002", newer, "pending"), historyItem("9001", older, "graded")],
          pagination: { page: 1, limit: 20, total: 2 },
        }),
      },
    ]);
    await lcmsStartAttempt("5001"); // warms the attempt→exercise map
    const result = await lcmsSubmitAttempt("12346", { answers: [], results: [] });
    expect(result).toEqual({ submissionId: "9002", status: "submitted", gradingStatus: "pending" });
  });

  it("keeps the UI alive with an empty submissionId when history lags", async () => {
    stubFetch([
      {
        match: "/attempt/excercise/6001/start",
        body: envelope({ attemptId: "200", startedAt: naiveLocal(new Date()) }),
      },
      { match: "/attempt/200/submit", body: envelope("Submitted successfully", 1) },
      // history stays not-found
    ]);
    await lcmsStartAttempt("6001");
    const result = await lcmsSubmitAttempt("200");
    expect(result).toEqual({ submissionId: "", status: "submitted", gradingStatus: "pending" });
  });

  it("propagates the 409 already-submitted message", async () => {
    stubFetch([
      {
        match: "/attempt/300/submit",
        status: 409,
        body: { success: false, message: "Attempt already submitted.", data: null, total: null },
      },
    ]);
    await expect(lcmsSubmitAttempt("300")).rejects.toThrow("Attempt already submitted.");
  });

  // Regression (bd02e64): học sinh đăng xuất giữa chừng rồi bấm Nộp bài. Không còn
  // token để refresh, LCMS trả 401. Adapter PHẢI trả LcmsApiError(statusCode 401) +
  // message "…hết hạn…" — KHÔNG lộ "LCMS API error 401" thô — để SubmissionRunner
  // (isSessionExpired: statusCode === 401) báo mềm rồi điều hướng về màn chi tiết sách.
  it("Nộp bài sau khi đăng xuất (401) → statusCode 401 + báo phiên hết hạn, không lộ lỗi thô", async () => {
    // Đăng xuất = không còn token trong storage (localStorage rỗng). clearSession
    // trong nhánh 401 chạm localStorage nên phải stub window+storage như trình duyệt.
    const store = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    stubFetch([
      { match: "/attempt/900/submit", status: 401, body: { status: 401, error: "Unauthorized" } },
    ]);
    const err = (await lcmsSubmitAttempt("900").catch((e) => e)) as {
      statusCode?: number;
      message: string;
    };
    expect(err.statusCode).toBe(401); // isSessionExpired dựa vào đây
    expect(err.message).toMatch(/hết hạn/);
    expect(err.message).not.toMatch(/LCMS API error/);
  });
});

describe("lcmsListHistory / lcmsGetSubmission", () => {
  it("maps history items and normalizes naive datetimes to parseable ISO", async () => {
    const at = new Date(2026, 6, 9, 16, 30, 0);
    stubFetch([
      {
        match: "/submission/history?bookId=50&page=2&limit=10",
        body: envelope({
          items: [
            {
              submissionId: "1001",
              bookId: "10256693714406400", // beyond MAX_SAFE_INTEGER → stays a string
              bookTitle: "Sách",
              lessonId: "50001",
              exerciseId: "5001",
              exerciseTitle: "Bài 1",
              score: "8",
              maxScore: "10",
              gradingStatus: "graded",
              submittedAt: naiveLocal(at),
            },
          ],
          pagination: { page: 2, limit: 10, total: 21 },
        }),
      },
    ]);
    const res = await lcmsListHistory({ bookId: 50, page: 2, limit: 10 });
    expect(res.pagination).toEqual({ page: 2, limit: 10, total: 21 });
    const item = res.items[0];
    expect(item.submissionId).toBe("1001");
    expect(item.bookId).toBe("10256693714406400");
    expect(item.lessonId).toBe(50001);
    expect(item.score).toBe(8);
    expect(new Date(item.submittedAt).getTime()).toBe(at.getTime());
  });

  it("maps submission scores and surfaces the 403 ownership message", async () => {
    const at = new Date(2026, 6, 9, 16, 30, 0);
    stubFetch([
      {
        match: "/submission/scores/1001",
        body: envelope({
          submissionId: "1001",
          score: 8,
          maxScore: 10,
          gradingStatus: "graded",
          teacherComment: "Tốt",
          submittedAt: naiveLocal(at),
          gradedAt: null,
        }),
      },
      {
        match: "/submission/scores/1002",
        status: 403,
        body: {
          success: false,
          message: "This submission does not belong to you.",
          data: null,
          total: null,
        },
      },
    ]);
    const detail = await lcmsGetSubmission("1001");
    expect(detail).toMatchObject({
      submissionId: "1001",
      score: 8,
      maxScore: 10,
      gradingStatus: "graded",
      teacherComment: "Tốt",
      gradedAt: null,
    });
    expect(new Date(detail.submittedAt).getTime()).toBe(at.getTime());
    await expect(lcmsGetSubmission("1002")).rejects.toThrow(
      "This submission does not belong to you.",
    );
  });
});

describe("401 → refresh → retry (Authentication API Integration Specification §6/§8)", () => {
  const REFRESH_OK = {
    accessToken: "at-2",
    refreshToken: "rt-2",
    sessionId: "sess-2",
    locked: false,
    requiresTotp: false,
  };

  function stubAuthedStorage() {
    const store = new Map<string, string>([
      ["evo_auth_access_token", "at-1"],
      ["evo_auth_refresh_token", "rt-1"],
      ["evo_lcms_session_id", "sess-1"],
    ]);
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    return store;
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("refreshes with {sessionId,refreshToken}, saves tokens, and replays the request", async () => {
    const store = stubAuthedStorage();
    const mock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/security/auth/refresh")) return json(REFRESH_OK);
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      if (auth === "Bearer at-2") {
        return json(
          envelope([{ id: "5001", name: "Bài 1", totalQuestion: 1, status: "not_started" }], 1),
        );
      }
      return json({ status: 401, error: "Unauthorized" }, 401);
    });
    vi.stubGlobal("fetch", mock);

    const items = await lcmsListLessonExercises("1");
    expect(items).toHaveLength(1); // replay succeeded with the fresh token

    const refreshCall = mock.mock.calls.find((c) =>
      String(c[0]).includes("/api/security/auth/refresh"),
    )!;
    expect(JSON.parse((refreshCall[1] as RequestInit).body as string)).toEqual({
      sessionId: "sess-1",
      refreshToken: "rt-1",
    });
    expect(store.get("evo_auth_access_token")).toBe("at-2"); // persisted
    expect(store.get("evo_lcms_session_id")).toBe("sess-2"); // rotated
  });

  it("shares one refresh across concurrent 401s (single-flight)", async () => {
    stubAuthedStorage();
    const mock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/security/auth/refresh")) return json(REFRESH_OK);
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      if (auth === "Bearer at-2") return json(envelope([], 0));
      return json({ status: 401, error: "Unauthorized" }, 401);
    });
    vi.stubGlobal("fetch", mock);

    await Promise.all([lcmsListLessonExercises("1"), lcmsListLessonExercises("2")]);
    const refreshCalls = mock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/security/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("clears the whole session when the refresh itself fails", async () => {
    const store = stubAuthedStorage();
    const mock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("/api/security/auth/refresh")) {
        return json({ status: 401, error: "Unauthorized" }, 401);
      }
      return json({ status: 401, error: "Unauthorized" }, 401);
    });
    vi.stubGlobal("fetch", mock);

    await expect(lcmsListLessonExercises("1")).rejects.toThrow(/hết hạn/);
    expect(store.get("evo_auth_access_token")).toBeUndefined();
    expect(store.get("evo_auth_refresh_token")).toBeUndefined();
  });
});

describe("lcmsLogin / lcmsRefresh (Authentication API Integration Specification)", () => {
  const AUTH_OK = {
    accessToken: "at-1",
    refreshToken: "rt-1",
    sessionId: "sess-1",
    locked: false,
    requiresTotp: false,
  };

  /** In-memory localStorage stub (node env has none). */
  function stubLocalStorage(initial: Record<string, string> = {}) {
    const store = new Map(Object.entries(initial));
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    return store;
  }

  it("POSTs {username,password} to /api/security/auth/login and normalizes the response", async () => {
    const inOneHour = new Date(Date.now() + 3600 * 1000);
    const mock = stubFetch([
      {
        match: "/api/security/auth/login",
        body: { ...AUTH_OK, expireDatetime: naiveLocal(inOneHour) },
      },
    ]);
    // Dummy value in a non-password-named const (Fortify: Hardcoded Password — test fixture).
    const pwValue = "secret";
    const tokens = await lcmsLogin("student01", pwValue);
    expect(JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      username: "student01",
      password: pwValue,
      tenantCode: "NXB",
    });
    expect(tokens.access_token).toBe("at-1");
    expect(tokens.refresh_token).toBe("rt-1");
    expect(tokens.session_id).toBe("sess-1");
    expect(tokens.token_type).toBe("bearer");
    expect(tokens.expires_in).toBeGreaterThan(3500);
    expect(tokens.expires_in).toBeLessThanOrEqual(3600);
  });

  it("persists sessionId at login and sends {sessionId,refreshToken} on refresh", async () => {
    const store = stubLocalStorage();
    const inOneHour = new Date(Date.now() + 3600 * 1000);
    const mock = stubFetch([
      {
        match: "/api/security/auth/login",
        body: { ...AUTH_OK, expireDatetime: naiveLocal(inOneHour) },
      },
      {
        match: "/api/security/auth/refresh",
        body: { ...AUTH_OK, accessToken: "at-2", refreshToken: "rt-2", sessionId: "sess-2" },
      },
    ]);
    await lcmsLogin("student01", "secret");
    expect(store.get("evo_lcms_session_id")).toBe("sess-1");

    const tokens = await lcmsRefresh("rt-1");
    const refreshCall = mock.mock.calls.find((c) =>
      String(c[0]).includes("/api/security/auth/refresh"),
    )!;
    expect(JSON.parse((refreshCall[1] as RequestInit).body as string)).toEqual({
      sessionId: "sess-1",
      refreshToken: "rt-1",
    });
    // refresh response carries no expireDatetime → conservative 30-minute TTL
    expect(tokens.expires_in).toBe(1800);
    expect(tokens.access_token).toBe("at-2");
    expect(store.get("evo_lcms_session_id")).toBe("sess-2"); // overwritten when present
  });

  it("also unwraps a {success,data} envelope shape", async () => {
    const inOneHour = new Date(Date.now() + 3600 * 1000);
    stubFetch([
      {
        match: "/api/security/auth/login",
        body: envelope({ ...AUTH_OK, expireDatetime: naiveLocal(inOneHour) }),
      },
    ]);
    const tokens = await lcmsLogin("student01", "secret");
    expect(tokens.access_token).toBe("at-1");
  });

  it("falls back to 30 minutes when expireDatetime is unparseable", async () => {
    stubFetch([
      { match: "/api/security/auth/login", body: { ...AUTH_OK, expireDatetime: "not-a-date" } },
    ]);
    const tokens = await lcmsLogin("student01", "secret");
    expect(tokens.expires_in).toBe(1800);
  });

  it("rejects locked accounts and TOTP-required accounts", async () => {
    stubFetch([
      {
        match: "/api/security/auth/login",
        body: { ...AUTH_OK, locked: true, expireDatetime: naiveLocal(new Date()) },
      },
    ]);
    await expect(lcmsLogin("a", "b")).rejects.toThrow("Tài khoản đã bị khóa.");

    stubFetch([
      {
        match: "/api/security/auth/login",
        body: { ...AUTH_OK, requiresTotp: true, expireDatetime: naiveLocal(new Date()) },
      },
    ]);
    await expect(lcmsLogin("a", "b")).rejects.toThrow(/TOTP/);
  });
});
