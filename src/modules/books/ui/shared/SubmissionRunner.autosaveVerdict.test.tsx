// @vitest-environment jsdom
/**
 * SBT_4 #43 (line 45) — autosave phải GHI verdict player, không phải gradeByType.
 * Trên LCMS bản ghi autosave "dính" (bỏ qua cập nhật lúc nộp), nên nếu autosave
 * ghi verdict lệch thì điểm nộp vẫn sai. Test: player báo success → autosave gửi
 * isCorrect:true dù gradeByType (essay) coi là không chấm được.
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

const saveAnswers = vi.fn(async (..._args: unknown[]) => {});

vi.mock("@/core/auth/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getExercise: vi.fn(async () => exercise),
  getCurrentAttempt: vi.fn(async () => null),
  startAttempt: vi.fn(async () => ({
    attemptId: "a1",
    startedAt: "2026-01-01T00:00:00Z",
  })),
  saveAnswers: (...a: unknown[]) => saveAnswers(...a),
  submitAttempt: vi.fn(),
  getSubmission: vi.fn(),
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => []),
}));

// Player giả: nút phát đáp án + nút phát verdict "success" cho câu đang mở.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    onAnswerChange,
    onStatusChange,
  }: {
    onAnswerChange?: (a: unknown) => void;
    onStatusChange?: (s: string) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onAnswerChange?.("X")}>
        ans
      </button>
      <button type="button" onClick={() => onStatusChange?.("success")}>
        ok
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SubmissionRunner — autosave ghi verdict player (SBT_4 #43)", () => {
  it("player báo success → autosave gửi isCorrect:true dù gradeByType không chấm được", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
      </MemoryRouter>,
    );

    // Trả lời câu 1 rồi player tự chấm "đúng".
    await user.click(await screen.findByRole("button", { name: "ans" }));
    await user.click(screen.getByRole("button", { name: "ok" }));
    // Rời câu 1 → autosave câu 1.
    await user.click(screen.getByRole("button", { name: /Câu tiếp/ }));

    await waitFor(() => expect(saveAnswers).toHaveBeenCalled());
    const q1Call = saveAnswers.mock.calls.find(
      (c) =>
        (c[2] as Array<{ questionId: string }> | undefined)?.[0]?.questionId ===
        "q1",
    );
    expect(q1Call).toBeTruthy();
    // essay → gradeByType coi là không chấm được; verdict player thắng.
    expect((q1Call![2] as Array<Record<string, unknown>>)[0]).toEqual(
      expect.objectContaining({ isCorrect: true, gradable: true }),
    );
  });
});
