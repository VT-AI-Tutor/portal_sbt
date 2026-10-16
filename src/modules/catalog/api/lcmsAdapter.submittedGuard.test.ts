// @vitest-environment jsdom
/**
 * `/current-attempt` của LCMS trả lượt gần nhất KỂ CẢ khi đã nộp, và không mang
 * cờ "đã nộp" nào — `lcmsGetCurrentAttempt` chỉ loại nó ra được nhờ đối chiếu
 * `/submission/history`. Lịch sử chưa kịp thấy lần nộp vừa xong (chính
 * `lcmsSubmitAttempt` cũng phải phòng đúng chuyện này, xem submissionId rỗng),
 * hoặc lỗi, hoặc lần nộp rơi ngoài trang ⇒ lượt VỪA NỘP bị báo là còn dở, và
 * hub bài học mời "Tiếp tục làm bài" cho một lượt đã chốt.
 *
 * Ta vừa nộp thì ta biết chắc: nhớ attemptId đã nộp trong phiên trang này.
 */
process.env.TZ = "Asia/Ho_Chi_Minh";

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lcmsGetCurrentAttempt,
  lcmsSubmitAttempt,
} from "@/core/api/lcmsAdapter";

const envelope = (data: unknown, total = 1) => ({
  success: true,
  data,
  total: String(total),
});

/** History LUÔN rỗng: mô phỏng lịch sử chưa thấy lần nộp vừa xong. */
function stubFetch(currentAttempt: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const body = u.includes("/current-attempt")
        ? envelope(currentAttempt, 1)
        : u.includes("/submission/history")
          ? envelope({ items: [], pagination: { page: 1, limit: 20, total: 0 } }, 0)
          : u.includes("/submit")
            ? { success: true, data: null, total: null }
            : { success: false, message: "not-found", data: null, total: null };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const attempt = (attemptId: string) => ({
  attemptId,
  startedAt: "2026-07-20T12:19:24.152539",
  answers: [
    { questionId: "2072", userAnswer: '["3","4"]', isCorrect: false, score: 1 },
  ],
});

describe("lcmsGetCurrentAttempt — lượt vừa nộp không còn là 'đang làm dở'", () => {
  it("nộp xong ⇒ null, dù history chưa thấy lần nộp", async () => {
    stubFetch(attempt("41"));

    // Trước khi nộp: đúng là còn lượt dở.
    expect(await lcmsGetCurrentAttempt("32001")).not.toBeNull();

    await lcmsSubmitAttempt("41", { answers: [], results: [] });

    expect(await lcmsGetCurrentAttempt("32001")).toBeNull();
  });

  it("chỉ loại đúng lượt đã nộp — lượt MỚI sau 'Làm lại từ đầu' vẫn tiếp tục được", async () => {
    stubFetch(attempt("42"));
    await lcmsSubmitAttempt("42", { answers: [], results: [] });
    expect(await lcmsGetCurrentAttempt("32001")).toBeNull();

    // Học sinh bấm "Làm lại từ đầu" → LCMS mở lượt khác.
    stubFetch(attempt("43"));
    const resumed = await lcmsGetCurrentAttempt("32001");
    expect(resumed?.attemptId).toBe("43");
  });
});
