// @vitest-environment jsdom
/**
 * SBT_3 #36 — Nộp bài xong nhấn "Xem lại bài làm" phải hiện lại CÂU HỎI kèm đáp
 * án đã chọn, không phải chỉ màn tóm tắt điểm.
 *
 * Trên LCMS `getSubmissionReview` luôn trả null → trước đây dialog chỉ ra phần
 * điểm. Runner giờ dựng review từ đề + đáp án trong state (reviewFallback).
 *
 * Verdict LẤY từ player đã chấm lúc làm (onStatusChange) — NHƯNG chỉ khi đáp án
 * hiện tại vẫn đúng bản đã chấm; hạ/đổi đáp án sau đó thì chấm lại bằng gradeByType.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getExercise: vi.fn(),
  getCurrentAttempt: vi.fn(async () => null),
  startAttempt: vi.fn(async () => ({
    attemptId: "a1",
    startedAt: "2026-01-01T00:00:00Z",
  })),
  saveAnswers: vi.fn(async () => {}),
  submitAttempt: vi.fn(async () => ({
    submissionId: "s1",
    status: "submitted",
    gradingStatus: "graded",
  })),
  getSubmission: vi.fn(async () => ({
    submissionId: "s1",
    gradingStatus: "graded",
    score: 1,
    maxScore: 1,
    submittedAt: "2026-01-01T00:00:00Z",
    gradedAt: null,
    teacherComment: null,
  })),
  // LCMS: không có cửa review → null. Điều kiện tái hiện #36.
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => []),
}));

// Player giả với các nút emit đáp án + verdict cả-câu; phơi `result` để soi review.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    result,
    onAnswerChange,
    onStatusChange,
  }: {
    result?: string;
    onAnswerChange?: (a: unknown) => void;
    onStatusChange?: (s: string) => void;
  }) => (
    <div data-testid="qp" data-result={result ?? ""}>
      <button
        type="button"
        onClick={() => {
          onAnswerChange?.("chosen-not-A");
          onStatusChange?.("success");
        }}
      >
        emit-success
      </button>
      <button
        type="button"
        onClick={() => {
          onAnswerChange?.(["A", "B"]);
          onStatusChange?.("success");
        }}
      >
        pick-ab
      </button>
      <button
        type="button"
        onClick={() => {
          onAnswerChange?.(["A"]);
          onStatusChange?.("idle");
        }}
      >
        downgrade-a
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderRunner() {
  const { userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  const { SubmissionRunner } = await import("./SubmissionRunner");
  render(
    <MemoryRouter>
      <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
    </MemoryRouter>,
  );
  return user;
}

describe("SubmissionRunner — #36 xem lại bài làm (LCMS, không có review server)", () => {
  it("verdict player đã chấm KHỚP đáp án hiện tại → hiện đúng dù gradeByType lệch", async () => {
    const api = await import("@/modules/books/api/assessmentApi");
    (api.getExercise as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "ex1",
      title: "Bài",
      instructions: null,
      durationMinutes: null,
      // gradeByType(raw) sẽ chấm SAI ("A" != "chosen-not-A"); player báo success.
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
    });
    const user = await renderRunner();

    await user.click(
      await screen.findByRole("button", { name: /emit-success/ }),
    );
    await user.click(screen.getByRole("button", { name: /Nộp bài/ }));
    // Nộp xong runner ở lại soát bài (chấm tại chỗ) — bấm "Hoàn thành" mới ra màn điểm.
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));
    await screen.findByText(/Đã nộp bài!/);

    await user.click(screen.getByRole("button", { name: /Xem lại bài làm/ }));
    const reviewQ = await screen.findByTestId("review-question-q1");
    expect(
      reviewQ.querySelector('[data-testid="qp"]')?.getAttribute("data-result"),
    ).toBe("correct");
    expect(screen.getByText("1/1")).toBeTruthy();
  });

  // Nộp bài mà chưa trả lời câu nào ("Vẫn nộp bài") vẫn phải xem lại được ĐỀ.
  // Điều kiện dựng review không được rút về "có đáp án trong state" — lượt vừa
  // làm+nộp luôn dựng, kể cả `answers` rỗng.
  it("nộp khi CHƯA trả lời câu nào → vẫn hiện lại câu hỏi ở 'Xem lại bài làm'", async () => {
    const api = await import("@/modules/books/api/assessmentApi");
    (api.getExercise as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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
    });
    const user = await renderRunner();

    await user.click(await screen.findByRole("button", { name: /Nộp bài/ }));
    // Cảnh báo "còn câu chưa làm" → vẫn nộp.
    await user.click(screen.getByRole("button", { name: /Vẫn nộp bài/ }));
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));
    await screen.findByText(/Đã nộp bài!/);

    await user.click(screen.getByRole("button", { name: /Xem lại bài làm/ }));
    expect(await screen.findByTestId("review-question-q1")).toBeTruthy();
  });

  it("hạ đáp án sau khi đã 'success' → verdict cũ hết giá trị, chấm lại (sai)", async () => {
    const api = await import("@/modules/books/api/assessmentApi");
    (api.getExercise as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "ex1",
      title: "Bài",
      instructions: null,
      durationMinutes: null,
      questions: [
        {
          id: "q1",
          type: "multiple_choice",
          content: "Câu 1",
          options: [],
          correctAnswer: ["A", "B"],
          points: 1,
        },
      ],
    });
    const user = await renderRunner();

    // Chọn đủ [A,B] → player báo success; rồi bỏ bớt còn [A] → idle (bị bỏ qua).
    await user.click(await screen.findByRole("button", { name: /pick-ab/ }));
    await user.click(screen.getByRole("button", { name: /downgrade-a/ }));
    await user.click(screen.getByRole("button", { name: /Nộp bài/ }));
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));
    await screen.findByText(/Đã nộp bài!/);

    await user.click(screen.getByRole("button", { name: /Xem lại bài làm/ }));
    const reviewQ = await screen.findByTestId("review-question-q1");
    // Verdict "success" cũ ứng với [A,B]; đáp án hiện tại [A] → chấm lại → SAI.
    expect(
      reviewQ.querySelector('[data-testid="qp"]')?.getAttribute("data-result"),
    ).toBe("incorrect");
    expect(screen.getByText("0/1")).toBeTruthy();
  });
});
