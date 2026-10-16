// @vitest-environment jsdom
/**
 * lcmsGetCurrentAttempt: `startedAt` của LCMS là NAIVE (không timezone) nhưng
 * thực chất là UTC; `submittedAt` trong history lại có offset UTC rõ ràng. Nếu
 * parse naive thành giờ LOCAL (+07) thì phép so `submittedAt >= startedAt` đảo
 * ngược → attempt đang làm dở bị coi là đã nộp → mất nút "Tiếp tục làm bài".
 *
 * Đặt TZ=Asia/Ho_Chi_Minh để lỗi (nếu tái diễn) lộ ra ngay cả khi CI chạy UTC.
 */
process.env.TZ = "Asia/Ho_Chi_Minh";

import { afterEach, describe, expect, it, vi } from "vitest";
import { lcmsGetCurrentAttempt } from "@/core/api/lcmsAdapter";

const envelope = (data: unknown, total = 1) => ({
  success: true,
  data,
  total: String(total),
});

function stubFetch(currentAttempt: unknown, history: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const body = u.includes("/current-attempt")
        ? envelope(currentAttempt, 1)
        : u.includes("/submission/history")
          ? envelope(
              {
                items: history,
                pagination: { page: 1, limit: 20, total: history.length },
              },
              history.length,
            )
          : { success: false, message: "not-found", data: null, total: null };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

// startedAt naive — đúng phải hiểu là 12:19:24Z.
const ATTEMPT = {
  attemptId: "33",
  startedAt: "2026-07-20T12:19:24.152539",
  answers: [
    { questionId: "2072", userAnswer: '["3","4"]', isCorrect: false, score: 1 },
  ],
};
const submission = (submittedAt: string) => ({
  submissionId: "21",
  bookId: "32",
  bookTitle: "x",
  lessonId: "32001",
  exerciseId: "32001",
  exerciseTitle: "x",
  score: 0,
  maxScore: 3,
  gradingStatus: "pending",
  submittedAt,
});

describe("lcmsGetCurrentAttempt — naive startedAt là UTC", () => {
  it("bài nộp TRƯỚC lúc bắt đầu attempt (UTC) → GIỮ attempt (hiện Tiếp tục)", async () => {
    // 12:18:49Z < 12:19:24Z → attempt còn dở. Bug cũ (naive=+07) sẽ trả null.
    stubFetch(ATTEMPT, [submission("2026-07-20T12:18:49.434+00:00")]);
    const res = await lcmsGetCurrentAttempt("32001");
    expect(res).not.toBeNull();
    expect(res?.attemptId).toBe("33");
    expect(res?.answers.length).toBe(1);
  });

  it("bài nộp SAU lúc bắt đầu attempt → attempt đã xong → null", async () => {
    stubFetch(ATTEMPT, [submission("2026-07-20T12:20:00.000+00:00")]);
    expect(await lcmsGetCurrentAttempt("32001")).toBeNull();
  });

  it("không có bài nộp cho exercise → GIỮ attempt", async () => {
    stubFetch(ATTEMPT, []);
    expect(await lcmsGetCurrentAttempt("32001")).not.toBeNull();
  });

  it("startedAt naive parse ĐÚNG là UTC (12:19:24Z), không lệch 7h", async () => {
    // Cận: nộp 12:19:00Z — nếu naive bị hiểu là +07 (05:19:24Z) thì 12:19:00Z sẽ
    // >= và trả null (sai). Đúng phải giữ attempt (12:19:00Z < 12:19:24Z).
    stubFetch(ATTEMPT, [submission("2026-07-20T12:19:00.000+00:00")]);
    expect(await lcmsGetCurrentAttempt("32001")).not.toBeNull();
  });
});
