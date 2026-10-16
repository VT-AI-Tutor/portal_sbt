// @vitest-environment jsdom
/**
 * I.6.13 — "Chuyển nhanh giữa các câu" trong runner sách bài tập.
 *
 * Trước đây runner chỉ có prev/next: bài 10 câu muốn sửa câu 2 phải bấm 8 lần.
 *
 * Rủi ro lớn nhất KHÔNG phải là dải nút hiện ra, mà là NHẢY CÂU LÀM MẤT BÀI:
 * `handleNav` tự lưu đáp án khi rời câu, nên đường nhảy nhanh phải đi qua đúng
 * hợp đồng đó. Test dưới khoá cả hai.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "@/modules/books/api/assessmentApi";

const exercise = {
  id: "ex1",
  title: "Bài",
  instructions: null,
  durationMinutes: null,
  questions: [
    { id: "q1", type: "essay", content: "Câu 1", options: [] },
    { id: "q2", type: "essay", content: "Câu 2", options: [] },
    { id: "q3", type: "essay", content: "Câu 3", options: [] },
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
  submitAttempt: vi.fn(),
  getSubmission: vi.fn(),
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => []),
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
      <button
        type="button"
        onClick={() => onAnswerChange?.(`trả lời ${index}`)}
      >
        emit-answer
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function startRunner() {
  const { userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  const { SubmissionRunner } = await import("./SubmissionRunner");
  render(
    <MemoryRouter>
      <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" />
    </MemoryRouter>,
  );
  await screen.findByRole("button", { name: /Câu tiếp|Nộp bài/ });
  return user;
}

describe("SubmissionRunner — nhảy nhanh tới câu (I.6.13)", () => {
  it("hiện đủ nút cho mọi câu, đánh dấu câu đang mở", async () => {
    await startRunner();

    expect(
      screen.getByRole("group", { name: /Nhảy nhanh tới câu/ }),
    ).toBeTruthy();
    for (const n of [1, 2, 3]) {
      expect(screen.getByRole("button", { name: `Tới câu ${n}` })).toBeTruthy();
    }
    expect(
      screen
        .getByRole("button", { name: "Tới câu 1" })
        .getAttribute("aria-current"),
    ).toBe("true");
  });

  it("bấm số → nhảy thẳng tới câu đó, không phải bấm next từng cái", async () => {
    const user = await startRunner();

    await user.click(screen.getByRole("button", { name: "Tới câu 3" }));

    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain("Q2"),
    );
    expect(
      screen
        .getByRole("button", { name: "Tới câu 3" })
        .getAttribute("aria-current"),
    ).toBe("true");
  });

  /** Chốt chặn chính: nhảy câu phải LƯU như prev/next, không được mất bài làm. */
  it("nhảy câu vẫn tự lưu đáp án câu đang mở", async () => {
    const user = await startRunner();

    await user.click(screen.getByRole("button", { name: /emit-answer/ }));
    await user.click(screen.getByRole("button", { name: "Tới câu 3" }));

    await waitFor(() => expect(api.saveAnswers).toHaveBeenCalled());
    const [attemptId, answers] = (api.saveAnswers as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(attemptId).toBe("a1");
    expect(answers).toEqual([{ questionId: "q1", answer: "trả lời 0" }]);
  });

  it("quay lại câu cũ thì đáp án còn nguyên", async () => {
    const user = await startRunner();

    await user.click(screen.getByRole("button", { name: /emit-answer/ }));
    await user.click(screen.getByRole("button", { name: "Tới câu 3" }));
    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain("Q2 answer=∅"),
    );

    await user.click(screen.getByRole("button", { name: "Tới câu 1" }));
    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain(
        "Q0 answer=trả lời 0",
      ),
    );
  });

  it("bấm vào chính câu đang mở thì không gọi lưu thừa", async () => {
    const user = await startRunner();

    await user.click(screen.getByRole("button", { name: /emit-answer/ }));
    await user.click(screen.getByRole("button", { name: "Tới câu 1" }));

    expect(api.saveAnswers).not.toHaveBeenCalled();
  });
});
