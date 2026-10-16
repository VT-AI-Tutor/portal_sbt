// @vitest-environment jsdom
/**
 * SBT_1008 row 45 — "Làm lại" ở màn Bài tập của tôi phải VÀO LẠI BÀI.
 * LCMS: route /sach-bai-tap/:bookCode/:lessonCode nhận bookId + exerciseId.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
  inProgressAttempts: [],
  latestInProgress: false,
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

describe("StudentSbtExercisesPage — nút 'Làm lại' (row 45)", () => {
  it("'Làm lại' trỏ /sach-bai-tap/{bookId}/{exerciseId}", async () => {
    const { StudentSbtExercisesPage } = await import(
      "./StudentSbtExercisesPage"
    );
    render(
      <MemoryRouter>
        <StudentSbtExercisesPage />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Làm lại/ });
    expect(link.getAttribute("href")).toBe("/sach-bai-tap/39/e1");
  });
});
