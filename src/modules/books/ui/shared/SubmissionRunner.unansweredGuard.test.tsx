// @vitest-environment jsdom
/**
 * F1 regression: câu essay/short_answer có thể trả lời bằng CÁCH ĐÍNH KÈM FILE
 * (không gõ chữ) — file nằm ở state `uploadedFiles` riêng. Cảnh báo mềm "Còn câu
 * chưa làm" KHÔNG được coi câu chỉ-có-file là chưa làm. Nộp bài phải chạy thẳng.
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

// SubmissionRunner đọc useAuth() để lấy tên học sinh cho hộp thoại chia sẻ
// (PR #189). Test render runner trần, không có AuthProvider — mock ở đây thay
// vì bọc provider, để test giữ nguyên phạm vi: điều hướng + lưu đáp án.
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
  submitAttempt: vi.fn(async () => ({
    submissionId: "",
    gradingStatus: "pending",
  })),
  getSubmission: vi.fn(),
  // null = "không có dữ liệu xem lại" (LCMS/BE chưa lên) — màn kết quả vẫn ra phần điểm.
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  uploadAttemptFile: vi.fn(async () => ({
    fileId: "f1",
    fileUrl: "http://x/f",
  })),
  listHistory: vi.fn(async () => []),
}));

vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({ index }: { index: number }) => (
    <div data-testid="qp">Q{index}</div>
  ),
}));

afterEach(cleanup);

describe("SubmissionRunner — cảnh báo câu chưa làm coi file-only là đã làm (F1)", () => {
  it("Đính kèm file cho cả 2 câu essay → Nộp bài chạy thẳng, KHÔNG hiện cảnh báo", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { SubmissionRunner } = await import("./SubmissionRunner");

    const { container } = render(
      <MemoryRouter>
        <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
      </MemoryRouter>,
    );

    // Câu 1: đính kèm file (không gõ chữ). Anchor màn playing bằng nút điều
    // runner không còn nút Kiểm tra/Lưu bài) để biết màn playing đã lên.
    await screen.findByRole("button", { name: /Câu tiếp|Nộp bài/ });
    const file1 = new File(["a"], "bai1.pdf", { type: "application/pdf" });
    await user.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      file1,
    );
    await screen.findByText("bai1.pdf");

    // Sang câu 2 và đính kèm file
    await user.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain("Q1"),
    );
    const file2 = new File(["b"], "bai2.pdf", { type: "application/pdf" });
    await user.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      file2,
    );
    await screen.findByText("bai2.pdf");

    // Nộp bài → KHÔNG có cảnh báo "Còn câu chưa làm", đi thẳng tới màn kết quả.
    await user.click(screen.getByRole("button", { name: /Nộp bài/ }));
    // Nộp xong runner ở lại soát bài (chấm tại chỗ) — bấm "Hoàn thành" mới ra màn điểm.
    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));

    await screen.findByText(/Đã nộp bài!/);
    expect(screen.queryByText("Còn câu chưa làm")).toBeNull();
    const { submitAttempt } = await import("@/modules/books/api/assessmentApi");
    expect((submitAttempt as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      1,
    );
  });
});
