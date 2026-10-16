// @vitest-environment jsdom
/**
 * SBT_2 BUG-I: nhấn "Thoát" giữa chừng phải LƯU đáp án câu đang mở TRƯỚC khi báo
 * cha (hub) refetch "bài đang dở". "Thoát" không đi qua Câu trước/Câu tiếp, nên
 * nếu không lưu ở đây thì câu vừa làm chưa lên server → hub đếm thiếu và "Tiếp
 * tục" bỏ mất câu đó.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const exercise = {
  id: "ex1",
  title: "Bài",
  instructions: null,
  durationMinutes: null,
  questions: [
    { id: "q1", type: "essay", content: "Câu 1", options: [] },
    { id: "q2", type: "essay", content: "Câu 2", options: [] },
  ],
};

vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getExercise: vi.fn(async () => exercise),
  getCurrentAttempt: vi.fn(async () => null),
  startAttempt: vi.fn(async () => ({
    attemptId: "a1",
    startedAt: "2026-01-01T00:00:00Z",
  })),
  saveAnswers: vi.fn(async () => {}),
  submitAttempt: vi.fn(),
  getSubmission: vi.fn(),
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => ({
    items: [],
    pagination: { page: 1, limit: 10, total: 0 },
  })),
}));

vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    index,
    answer,
    onAnswerChange,
  }: {
    index: number;
    answer?: unknown;
    onAnswerChange?: (a: unknown) => void;
  }) => (
    <div data-testid="qp">
      Q{index} answer={String(answer ?? "∅")}
      <button type="button" onClick={() => onAnswerChange?.(`trả lời ${index}`)}>
        emit-answer
      </button>
    </div>
  ),
}));

afterEach(cleanup);

describe("SubmissionRunner — Thoát lưu đáp án câu đang mở (BUG-I)", () => {
  it("nhấn Thoát gọi saveAnswers cho câu đang làm dở, rồi mới onExit", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const api = await import("@/modules/books/api/assessmentApi");
    (api.saveAnswers as ReturnType<typeof vi.fn>).mockClear();
    const onExit = vi.fn();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài học"
          startMode="new"
          onExit={onExit}
        />
      </MemoryRouter>,
    );

    // startMode="new" → vào thẳng màn làm bài (không còn màn intro của runner).
    await screen.findByRole("button", { name: /emit-answer/ });
    // Trả lời câu 1 rồi Thoát ngay (không bấm Câu tiếp).
    await user.click(screen.getByRole("button", { name: /emit-answer/ }));
    await user.click(screen.getByRole("button", { name: /Thoát/ }));

    await waitFor(() =>
      expect(
        (api.saveAnswers as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBeGreaterThan(0),
    );
    const [attemptId, answers] = (
      api.saveAnswers as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(attemptId).toBe("a1");
    expect(answers).toEqual([{ questionId: "q1", answer: "trả lời 0" }]);

    // onExit chỉ chạy SAU khi lưu xong (để hub refetch đọc đúng số câu).
    await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
  });

  it("save treo: hết timeout vẫn Thoát được (không kẹt nút — code review)", async () => {
    const { fireEvent, act } = await import("@testing-library/react");
    const api = await import("@/modules/books/api/assessmentApi");
    // saveAnswers treo vô hạn (mạng chập chờn, fetch không timeout).
    (api.saveAnswers as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise<void>(() => {}),
    );
    const onExit = vi.fn();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài học"
          startMode="new"
          onExit={onExit}
        />
      </MemoryRouter>,
    );

    // Mount + vào playing bằng real timers, rồi mới bật fake timers.
    fireEvent.click(await screen.findByRole("button", { name: /emit-answer/ }));

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: /Thoát/ }));
      // Đang chờ lưu → chưa thoát.
      expect(onExit).not.toHaveBeenCalled();
      // Hết van an toàn (EXIT_SAVE_TIMEOUT_MS = 4000ms) → vẫn thoát.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(onExit).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("màn kết quả: Quay lại bài học KHÔNG PUT vào attempt đã nộp", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const api = await import("@/modules/books/api/assessmentApi");
    (api.getExercise as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...exercise,
      questions: [
        {
          id: "q1",
          type: "single_choice",
          content: "Câu 1",
          options: [],
          correctAnswer: "trả lời 0",
          points: 1,
        },
      ],
    });
    (api.submitAttempt as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      submissionId: "s1",
      gradingStatus: "graded",
    });
    (api.getSubmission as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      submissionId: "s1",
      score: 1,
      maxScore: 1,
      gradingStatus: "graded",
      submittedAt: "2026-01-01T00:00:00Z",
      gradedAt: null,
      teacherComment: null,
    });
    (api.saveAnswers as ReturnType<typeof vi.fn>).mockClear();
    const onExit = vi.fn();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài học"
          startMode="new"
          onExit={onExit}
        />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /emit-answer/ }));
    await user.click(screen.getByRole("button", { name: /Nộp bài/ }));
    // Nộp xong runner ở lại soát bài (chấm tại chỗ) — bấm "Hoàn thành" mới ra màn điểm.
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));
    await screen.findByText(/Đã nộp bài!/);
    // Nộp bài dùng submitAttempt, KHÔNG saveAnswers.
    expect(
      (api.saveAnswers as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(0);

    await user.click(screen.getByRole("button", { name: /Quay lại bài học/ }));
    await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
    // Guard theo phase: màn kết quả không được lưu lại lên attempt đã submit.
    expect(
      (api.saveAnswers as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(0);
  });
});
