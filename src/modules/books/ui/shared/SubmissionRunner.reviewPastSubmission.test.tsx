// @vitest-environment jsdom
/**
 * SBT_1308 (đỏ, dòng 39) — vào lại bài đã nộp → "Xem kết quả lần trước" →
 * "Xem lại bài làm" phải hiện TỪNG CÂU kèm đáp án đã chọn, không phải chỉ màn
 * tóm tắt điểm.
 *
 * Khác [[SubmissionRunner.reviewFallback]] (lượt VỪA làm+nộp, đáp án còn trong
 * state): ở đây runner mount ở `startMode="review"` nên state rỗng — đáp án phải
 * lấy lại từ lượt đã nộp qua `getSubmittedAttempt`. Không lấy được ⇒ giữ nguyên
 * hành vi cũ (chỉ tóm tắt điểm), không dựng review rỗng.
 */
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

const exercise = {
  id: "ex1",
  title: "Bài",
  instructions: null,
  durationMinutes: null,
  questions: [
    {
      id: "q1",
      type: "single_choice",
      content: "Câu 1",
      options: [],
      correctAnswer: "A",
      points: 1,
    },
  ],
};

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getExercise: vi.fn(async () => exercise),
  getCurrentAttempt: vi.fn(async () => null),
  startAttempt: vi.fn(),
  saveAnswers: vi.fn(async () => {}),
  submitAttempt: vi.fn(),
  getSubmission: vi.fn(async () => ({
    submissionId: "s1",
    gradingStatus: "graded",
    score: 1,
    maxScore: 1,
    submittedAt: "2026-01-01T00:00:00Z",
    gradedAt: null,
    teacherComment: null,
  })),
  // LCMS: không có cửa review theo câu.
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  getSubmittedAttempt: vi.fn(),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => []),
}));

vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({ result }: { result?: string }) => (
    <div data-testid="qp" data-result={result ?? ""} />
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderReview({ strictMode = false } = {}) {
  const { userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  const { SubmissionRunner } = await import("./SubmissionRunner");
  const tree = (
    <MemoryRouter>
      <SubmissionRunner
        exerciseId="ex1"
        lessonTitle="Bài học"
        startMode="review"
        reviewSubmissionId="s1"
      />
    </MemoryRouter>
  );
  render(strictMode ? <StrictMode>{tree}</StrictMode> : tree);
  return user;
}

describe("SubmissionRunner — xem lại lần nộp TRƯỚC (SBT_1308 đỏ #39)", () => {
  it("lấy được đáp án đã nộp → 'Xem lại bài làm' hiện câu hỏi kèm đáp án", async () => {
    const api = await import("@/modules/books/api/assessmentApi");
    (api.getSubmittedAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      attemptId: "s1",
      startedAt: "2026-01-01T00:00:00Z",
      answers: [{ questionId: "q1", answer: "A" }],
    });
    const user = await renderReview();

    await user.click(
      await screen.findByRole("button", { name: /Xem lại bài làm/ }),
    );
    const reviewQuestion = await screen.findByTestId("review-question-q1");
    expect(
      reviewQuestion.querySelector('[data-testid="qp"]')?.getAttribute("data-result"),
    ).toBe("correct");
    expect(api.getSubmittedAttempt).toHaveBeenCalledWith("ex1", "s1");
  });

  // Đáp án rỗng vẫn phải dựng review: câu đó hiện "Chưa trả lời", không tính
  // điểm — KHÔNG được nuốt luôn cả màn xem lại.
  it("attempt có bản ghi nhưng đáp án RỖNG → vẫn dựng review, câu hiện 'Chưa trả lời'", async () => {
    const api = await import("@/modules/books/api/assessmentApi");
    (api.getSubmittedAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      attemptId: "347",
      startedAt: "2026-08-13T09:11:31.117622",
      answers: [{ questionId: "q1", answer: null }],
    });
    const user = await renderReview();

    await user.click(
      await screen.findByRole("button", { name: /Xem lại bài làm/ }),
    );
    const reviewQuestion = await screen.findByTestId("review-question-q1");
    expect(
      reviewQuestion.querySelector('[data-testid="qp"]')?.getAttribute("data-result"),
    ).toBe("incomplete");
    expect(screen.getByText("Chưa trả lời")).toBeTruthy();
  });

  // Tái hiện từ môi trường thật (2026-08-14): StrictMode chạy mount → cleanup →
  // mount lại mà ref sống xuyên remount. Nếu mountedRef chỉ được đặt `false` ở
  // cleanup (không đặt lại `true` trong thân effect) thì nó kẹt `false` — đáp án
  // getSubmittedAttempt về đủ nhưng bị vứt bỏ, modal chỉ còn màn điểm.
  it("StrictMode remount → đáp án nạp về KHÔNG bị vứt vì mountedRef kẹt false", async () => {
    const api = await import("@/modules/books/api/assessmentApi");
    (api.getSubmittedAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      attemptId: "372",
      startedAt: "2026-08-14T09:57:21.574392",
      answers: [{ questionId: "q1", answer: "A" }],
    });
    const user = await renderReview({ strictMode: true });

    await user.click(
      await screen.findByRole("button", { name: /Xem lại bài làm/ }),
    );
    expect(await screen.findByTestId("review-question-q1")).toBeTruthy();
  });

  it("không lấy được đáp án → giữ màn tóm tắt điểm, không dựng review rỗng", async () => {
    const api = await import("@/modules/books/api/assessmentApi");
    (api.getSubmittedAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
    const user = await renderReview();

    await user.click(
      await screen.findByRole("button", { name: /Xem lại bài làm/ }),
    );
    await screen.findByText(/Kết quả bài nộp/);
    expect(screen.queryByTestId("review-question-q1")).toBeNull();
  });
});
