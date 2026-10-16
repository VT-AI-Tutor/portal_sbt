// @vitest-environment jsdom
/**
 * SBT_1108 row 50 — "Tiếp tục" ở màn Bài tập của tôi chỉ được hiển thị 1 lượt
 * làm dở (lượt mới nhất), dù backend trả về nhiều lượt endedAt=null cùng một bài.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const item = {
  submissionId: "s1",
  exerciseId: "e1",
  exerciseTitle: "Họ hàng và những ngày kỉ niệm",
  bookId: "39",
  bookTitle: "Vở bài tập Tự nhiên và Xã hội 3",
  subjectCode: "tnxh",
  subjectName: "Tự nhiên và Xã hội",
  score: 1,
  maxScore: 3,
  gradingStatus: "graded" as const,
  submittedAt: "2026-08-07T10:34:00.000Z",
  // 2 lượt đang làm dở (mới nhất trước) — gắn sẵn từ exercise-list.
  inProgressAttempts: [
    { attemptId: "new", startedAt: "2026-08-10T00:00:00Z" },
    { attemptId: "old", startedAt: "2026-08-01T00:00:00Z" },
  ],
  latestInProgress: true,
};

vi.mock("@/modules/student-sbt/api/hooks", () => ({
  useSbtMyExercises: () => ({
    data: { subjects: [], completed: [item] },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

afterEach(cleanup);

describe("StudentSbtExercisesPage — 'Tiếp tục' chỉ 1 lượt (row 50)", () => {
  it("mở picker chỉ hiển thị lượt làm dở mới nhất", async () => {
    const { StudentSbtExercisesPage } = await import(
      "./StudentSbtExercisesPage"
    );
    render(
      <MemoryRouter>
        <StudentSbtExercisesPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Tiếp tục làm bài/ }),
    );

    const rows = screen.getAllByText(/^Bắt đầu/);
    expect(rows).toHaveLength(1);
  });
});
