// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type { SubmissionReview } from "@/core/api/assessmentTypes";
import { AssignmentSubmissionsDialog } from "./AssignmentSubmissionsDialog";

vi.mock("@/modules/teacher/api/teacherClassesApi", () => ({
  teacherClassesApi: {
    assignmentProgress: vi.fn(),
    submissionReview: vi.fn(),
  },
}));

// Player thật kéo theo cả cây exercise; màn này chỉ cần biết nó nhận đúng cờ.
vi.mock("@/modules/books/ui/shared/SubmissionReviewQuestions", () => ({
  SubmissionReviewQuestions: ({ revealAnswers }: { revealAnswers: boolean }) => (
    <div data-testid="review-list" data-reveal={String(revealAnswers)} />
  ),
}));

const mocked = teacherClassesApi as unknown as {
  assignmentProgress: ReturnType<typeof vi.fn>;
  submissionReview: ReturnType<typeof vi.fn>;
};

const review = {
  submissionId: "sub-1",
  score: 3,
  maxScore: 3,
  gradingStatus: "graded",
  teacherComment: null,
  submittedAt: "2026-08-14T02:00:00Z",
  gradedAt: "2026-08-14T02:00:00Z",
  exerciseId: "ex-1",
  exerciseTitle: "Phiếu ôn Toán 4",
  revealAnswers: false,
  questions: [],
} as unknown as SubmissionReview;

function renderDialog() {
  return render(
    <AssignmentSubmissionsDialog
      open
      onOpenChange={() => {}}
      classId="c1"
      linkId="l1"
      title="Phiếu ôn Toán 4"
      token="tok"
    />,
  );
}

describe("AssignmentSubmissionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.assignmentProgress.mockResolvedValue([
      {
        user_id: "u1",
        name: "Học Sinh Một",
        submission_status: "da_cham",
        score: 3,
        max_score: 3,
        submission_id: "sub-1",
      },
      {
        user_id: "u2",
        name: "Học Sinh Hai",
        submission_status: "chua_lam",
        score: null,
        max_score: null,
        submission_id: null,
      },
    ]);
    mocked.submissionReview.mockResolvedValue(review);
  });

  afterEach(cleanup);

  it("liệt kê học sinh và đếm số đã nộp", async () => {
    renderDialog();

    await waitFor(() => screen.getByText("Học Sinh Một"));
    expect(mocked.assignmentProgress).toHaveBeenCalledWith("c1", "l1", "tok");
    expect(screen.getByText("1/2 học sinh đã nộp")).toBeTruthy();
    expect(screen.getByText("Chưa làm")).toBeTruthy();
  });

  /** Không có submission_id thì không có gì để xem — nút phải khoá, không phải mở rồi lỗi. */
  it("khoá nút Xem bài với học sinh chưa nộp", async () => {
    renderDialog();

    await waitFor(() => screen.getByText("Học Sinh Hai"));
    const buttons = screen.getAllByRole("button", { name: "Xem bài" });
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it("mở chi tiết bài làm và LUÔN hiện đáp án dù server trả revealAnswers=false", async () => {
    const user = userEvent.setup();
    renderDialog();

    await waitFor(() => screen.getByText("Học Sinh Một"));
    await user.click(screen.getAllByRole("button", { name: "Xem bài" })[0]);

    await waitFor(() => screen.getByTestId("review-list"));
    expect(mocked.submissionReview).toHaveBeenCalledWith("sub-1", "tok");
    // Bài `hide_answers` trả revealAnswers=false cho học sinh; giáo viên soát bài
    // vẫn phải thấy đáp án.
    expect(
      screen.getByTestId("review-list").getAttribute("data-reveal"),
    ).toBe("true");
    expect(screen.getByText("3 / 3")).toBeTruthy();
  });

  it("nút Danh sách quay lại được danh sách học sinh", async () => {
    const user = userEvent.setup();
    renderDialog();

    await waitFor(() => screen.getByText("Học Sinh Một"));
    await user.click(screen.getAllByRole("button", { name: "Xem bài" })[0]);
    await waitFor(() => screen.getByTestId("review-list"));

    await user.click(screen.getByRole("button", { name: "Danh sách" }));

    await waitFor(() => screen.getByText("1/2 học sinh đã nộp"));
    expect(screen.queryByTestId("review-list")).toBeNull();
  });
});
