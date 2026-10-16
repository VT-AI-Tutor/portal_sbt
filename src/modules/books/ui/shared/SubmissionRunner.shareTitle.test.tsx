// @vitest-environment jsdom
/**
 * SBT_1008 (row 49/52) — màn kết quả + thẻ chia sẻ KHÔNG được hiện tên bài trắng.
 * exercise.title (LCMS data.name) hay rỗng → displayTitle phải lùi lessonTitle
 * rồi "Bài tập", không để chuỗi rỗng lọt xuống thẻ chia sẻ.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const exercise = {
  id: "ex1",
  title: "", // LCMS data.name rỗng
  instructions: null,
  durationMinutes: null,
  questions: [{ id: "q1", type: "essay", content: "Câu 1", options: [] }],
};

vi.mock("@/core/auth/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getExercise: vi.fn(async () => exercise),
  getCurrentAttempt: vi.fn(async () => null),
  startAttempt: vi.fn(),
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

describe("SubmissionRunner — tên bài không rỗng ở màn kết quả (row 49/52)", () => {
  it("exercise.title & lessonTitle rỗng → hiện 'Bài tập', không trắng", async () => {
    const { SubmissionRunner } = await import("./SubmissionRunner");
    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle=""
          startMode="review"
          reviewSubmissionId="s1"
        />
      </MemoryRouter>,
    );
    await screen.findByText(/Đã nộp bài!/);
    expect(screen.getByText("Bài tập")).toBeTruthy();
  });

  it("exercise.title rỗng nhưng có lessonTitle → hiện lessonTitle", async () => {
    const { SubmissionRunner } = await import("./SubmissionRunner");
    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Ôn tập gia đình"
          startMode="review"
          reviewSubmissionId="s1"
        />
      </MemoryRouter>,
    );
    await screen.findByText(/Đã nộp bài!/);
    expect(screen.getByText("Ôn tập gia đình")).toBeTruthy();
  });
});
