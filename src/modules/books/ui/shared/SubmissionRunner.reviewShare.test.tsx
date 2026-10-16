// @vitest-environment jsdom
/**
 * BUG #32 — "Xem kết quả lần trước" (chế độ review): vào lại bài đã nộp / đăng
 * nhập lại, hub mở runner với startMode="review" + reviewSubmissionId. Runner
 * phải mở THẲNG màn kết quả của lần nộp đó (kèm nút Chia sẻ) mà KHÔNG tạo lượt
 * mới (không gọi startAttempt).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const exercise = {
  id: "ex1",
  title: "Bài",
  instructions: null,
  durationMinutes: null,
  questions: [{ id: "q1", type: "essay", content: "Câu 1", options: [] }],
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
  getSubmission: vi.fn(async () => ({
    submissionId: "s1",
    gradingStatus: "graded",
    score: 8,
    maxScore: 10,
    submittedAt: "2026-01-01T00:00:00Z",
    gradedAt: null,
    teacherComment: null,
  })),
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  getSubmittedAttempt: vi.fn().mockResolvedValue(null),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => []),
}));

vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: () => <div data-testid="qp" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SubmissionRunner — chế độ review (#32 xem/chia sẻ kết quả lần trước)", () => {
  it("mở thẳng màn kết quả của lần nộp + nút Chia sẻ, KHÔNG tạo lượt mới", async () => {
    const api = await import("@/modules/books/api/assessmentApi");
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài học"
          startMode="review"
          reviewSubmissionId="s1"
        />
      </MemoryRouter>,
    );

    // Vào thẳng màn kết quả (không qua màn làm bài).
    await screen.findByText(/Đã nộp bài!/);
    // Điểm của lần nộp được hiển thị lại.
    expect(screen.getByText("8")).toBeTruthy();
    // Có nút Chia sẻ để chia sẻ lại kết quả.
    expect(screen.getByRole("button", { name: /Chia sẻ/ })).toBeTruthy();

    // Đọc đúng lần nộp được truyền vào, và TUYỆT ĐỐI không mở lượt mới.
    expect(api.getSubmission as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "s1",
    );
    expect(
      (api.startAttempt as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(0);
  });

  it("review nhưng THIẾU id (race refetch) → về hub qua onExit, KHÔNG mở lượt mới", async () => {
    const api = await import("@/modules/books/api/assessmentApi");
    const { SubmissionRunner } = await import("./SubmissionRunner");
    const onExit = vi.fn();

    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài học"
          startMode="review"
          onExit={onExit}
        />
      </MemoryRouter>,
    );

    // Thiếu reviewSubmissionId → thoát về hub, tuyệt đối không tạo lượt mới.
    await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
    expect(
      (api.startAttempt as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(0);
    expect(
      (api.getSubmission as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(0);
  });
});
