// @vitest-environment jsdom
/**
 * Tái hiện lát cắt BookLessonPage cho luồng ĐĂNG NHẬP: query student-exercises +
 * effect setSelectedExerciseId + key={selectedExerciseId} bọc SubmissionRunner.
 * Mục tiêu: bắt REMOUNT ẩn khi điều hướng câu (nếu remount, state answers mất →
 * đáp án đã làm biến mất). CHẤM NGAY (Owner 31/7): không còn nút "Kiểm tra"/
 * "Lưu bài" — test pin việc ĐÁP ÁN persist thay cho trạng thái đã-kiểm-tra cũ.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

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

const listLessonExercises = vi.fn(async () => [
  {
    id: "ex1",
    title: "Bài",
    type: "quiz",
    totalQuestions: 2,
    status: "not_started",
  },
]);

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
  // null = "không có dữ liệu xem lại" (LCMS/BE chưa lên) — màn kết quả vẫn ra phần điểm.
  getSubmissionReview: vi.fn().mockResolvedValue(null),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => []),
  listLessonExercises: (...a: unknown[]) => listLessonExercises(...(a as [])),
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

afterEach(cleanup);

// Lát cắt tối giản của BookLessonPage: đúng pattern chọn exercise + key.
function LessonExercisePane({
  SubmissionRunner,
}: {
  SubmissionRunner: React.ComponentType<{
    exerciseId: string;
    lessonTitle: string;
  }>;
}) {
  const { data: studentExercises = [] } = useQuery({
    queryKey: ["student-exercises", "L1"],
    queryFn: () => listLessonExercises(),
    staleTime: 60_000,
  });
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );
  useEffect(() => {
    setSelectedExerciseId(studentExercises[0]?.id ?? null);
  }, [studentExercises]);

  if (!selectedExerciseId) return <div>loading</div>;
  return (
    <SubmissionRunner
      key={selectedExerciseId}
      exerciseId={selectedExerciseId}
      lessonTitle="Bài học"
    />
  );
}

describe("BookLessonPage-slice — đáp án giữ nguyên khi điều hướng (đăng nhập)", () => {
  it("trả lời câu 1 → câu 2 → về câu 1 đáp án vẫn còn, KHÔNG remount", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { SubmissionRunner } = await import("./SubmissionRunner");
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <LessonExercisePane SubmissionRunner={SubmissionRunner} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // CHẤM NGAY: không còn nút Kiểm tra/Lưu bài — đáp án emit thẳng từ player.
    await user.click(
      await screen.findByRole("button", { name: /emit-answer/ }),
    );
    expect(
      screen.queryByRole("button", { name: /^(Kiểm tra|Lưu bài)$/ }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain("Q1 answer=∅"),
    );

    await user.click(screen.getByRole("button", { name: /Câu trước/ }));
    await waitFor(() =>
      expect(screen.getByTestId("qp").textContent).toContain(
        "Q0 answer=trả lời 0",
      ),
    );
    // startAttempt chỉ được gọi 1 lần ⇒ không remount giữa chừng.
    const { startAttempt } = await import("@/modules/books/api/assessmentApi");
    expect((startAttempt as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      1,
    );
  });
});
