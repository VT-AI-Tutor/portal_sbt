// @vitest-environment jsdom
/**
 * lcmsGetSubmittedAttempt (SBT_1308 đỏ #39): LCMS không có endpoint review theo
 * câu, nhưng /current-attempt vẫn trả nguyên lượt gần nhất KỂ CẢ khi đã nộp —
 * đó là nguồn đáp án để dựng màn "Xem lại bài làm" của lần nộp trước.
 *
 * Chỉ được tin dữ liệu đó khi chắc chắn nó ĐÚNG là lần nộp đang xem, nếu không
 * học sinh sẽ thấy bài của lượt khác.
 */
process.env.TZ = "Asia/Ho_Chi_Minh";

import { afterEach, describe, expect, it, vi } from "vitest";
import { lcmsGetSubmittedAttempt } from "@/core/api/lcmsAdapter";

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

const attempt = (attemptId: string, startedAt: string) => ({
  attemptId,
  startedAt,
  answers: [{ questionId: "2072", userAnswer: '["3","4"]' }],
});

const submission = (submissionId: string, submittedAt: string) => ({
  submissionId,
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

describe("lcmsGetSubmittedAttempt", () => {
  // attemptId và submissionId là hai bảng khác nhau của LCMS, đều là số tăng dần
  // nhỏ nên trùng nhau là chuyện có thật — trùng KHÔNG có nghĩa là cùng một lượt.
  it("attemptId trùng submissionId nhưng không có trong lịch sử → null", async () => {
    stubFetch(attempt("21", "2026-07-20T12:00:00.000000"), []);
    expect(await lcmsGetSubmittedAttempt("32001", "21")).toBeNull();
  });

  it("attemptId trùng submissionId của lượt nộp KHÁC → null, không lấy nhầm", async () => {
    // Lượt đang làm dở (attemptId 21, bắt đầu 13:00) vô tình trùng số với
    // submissionId 21 của bài đã nộp lúc 12:30 → tuyệt đối không được trả về.
    stubFetch(attempt("21", "2026-07-20T13:00:00.000000"), [
      submission("21", "2026-07-20T12:30:00.000+00:00"),
    ]);
    expect(await lcmsGetSubmittedAttempt("32001", "21")).toBeNull();
  });

  it("id khác nhưng là lần nộp MỚI NHẤT của bài → trả đáp án", async () => {
    stubFetch(attempt("33", "2026-07-20T12:00:00.000000"), [
      submission("21", "2026-07-20T12:30:00.000+00:00"),
    ]);
    const res = await lcmsGetSubmittedAttempt("32001", "21");
    expect(res?.attemptId).toBe("33");
  });

  it("xem lần nộp CŨ (không phải mới nhất) → null, không lấy nhầm bài", async () => {
    stubFetch(attempt("33", "2026-07-20T12:00:00.000000"), [
      submission("21", "2026-07-20T12:30:00.000+00:00"),
    ]);
    expect(await lcmsGetSubmittedAttempt("32001", "20")).toBeNull();
  });

  // drag_drop/fill_blank/labeling… lưu đáp án dạng Record. Trả về nguyên chuỗi
  // JSON thì grading.recordEvery chấm SAI hết và player không hydrate được.
  it("đáp án dạng OBJECT được parse thành object, không trả chuỗi JSON", async () => {
    stubFetch(
      {
        attemptId: "33",
        startedAt: "2026-07-20T12:00:00.000000",
        answers: [
          { questionId: "2072", userAnswer: '{"slot1":"A","slot2":"B"}' },
        ],
      },
      [submission("21", "2026-07-20T12:30:00.000+00:00")],
    );
    const res = await lcmsGetSubmittedAttempt("32001", "21");
    expect(res?.answers[0].answer).toEqual({ slot1: "A", slot2: "B" });
  });

  // Gặp thật trên môi trường test: LCMS ghi answer theo từng REQUEST nên mỗi
  // câu có NHIỀU bản ghi. Bản ghi MỚI NHẤT thắng — kể cả khi rỗng (học sinh đã
  // bỏ chọn): câu đó hiển thị "chưa chọn đáp án" và chấm sai.
  it("nhiều bản ghi một câu → bản ghi CUỐI thắng, kể cả khi rỗng", async () => {
    stubFetch(
      {
        attemptId: "33",
        startedAt: "2026-07-20T12:00:00.000000",
        answers: [
          { questionId: "2072", userAnswer: '["3","4"]' },
          { questionId: "2072", userAnswer: "" },
          { questionId: "2073", userAnswer: "" },
          { questionId: "2073", userAnswer: '{"slot1":"A"}' },
        ],
      },
      [submission("21", "2026-07-20T12:30:00.000+00:00")],
    );
    const res = await lcmsGetSubmittedAttempt("32001", "21");
    expect(res?.answers).toEqual([
      { questionId: "2072", answer: null },
      { questionId: "2073", answer: { slot1: "A" } },
    ]);
  });

  // Môi trường thật (2026-08-14): /submission/history trả submittedAt NAIVE
  // (không offset) giống startedAt. Nếu so trên chuỗi đã qua toIso (naive bị
  // hiểu là giờ local +07) thì mốc nộp bị đẩy sớm 7 tiếng → guard thời gian
  // loại nhầm mọi lượt hợp lệ → "Xem lại bài làm" chỉ còn màn điểm.
  it("history trả submittedAt NAIVE → vẫn trả đáp án, không lệch múi giờ", async () => {
    stubFetch(attempt("369", "2026-08-14T09:27:11.086129"), [
      submission("21", "2026-08-14T09:30:00.000000"),
    ]);
    const res = await lcmsGetSubmittedAttempt("32001", "21");
    expect(res?.attemptId).toBe("369");
  });

  it("lượt gần nhất bắt đầu SAU khi nộp (đã mở lượt mới) → null", async () => {
    // Attempt 34 bắt đầu 13:00Z, muộn hơn lúc nộp 12:30Z ⇒ là lượt MỚI đang làm
    // dở, không phải bài đã nộp đang xem.
    stubFetch(attempt("34", "2026-07-20T13:00:00.000000"), [
      submission("21", "2026-07-20T12:30:00.000+00:00"),
    ]);
    expect(await lcmsGetSubmittedAttempt("32001", "21")).toBeNull();
  });
});
