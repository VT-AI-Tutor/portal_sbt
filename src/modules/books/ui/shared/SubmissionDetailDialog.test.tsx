// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SubmissionDetail,
  SubmissionReview,
} from "@/modules/books/api/assessmentApi";
import * as api from "@/modules/books/api/assessmentApi";
import { SubmissionDetailDialog } from "./SubmissionDetailDialog";

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getSubmission: vi.fn(),
  getSubmissionReview: vi.fn(),
  listHistory: vi.fn().mockResolvedValue({
    items: [],
    pagination: { page: 1, limit: 10, total: 0 },
  }),
}));

vi.mock("@/core/auth/AuthContext", () => ({
  useAuth: () => ({ user: { full_name: "Học sinh A" } }),
}));

vi.mock("./SubmissionReviewQuestions", () => ({
  SubmissionReviewQuestions: ({
    revealAnswers,
  }: {
    revealAnswers: boolean;
  }) => <div data-testid="review-list" data-reveal={String(revealAnswers)} />,
}));

const detail: SubmissionDetail = {
  submissionId: "s1",
  score: 7,
  maxScore: 10,
  gradingStatus: "graded",
  teacherComment: null,
  submittedAt: "2026-08-01T00:00:00Z",
  gradedAt: "2026-08-01T01:00:00Z",
};

const review: SubmissionReview = {
  ...detail,
  exerciseId: "ex1",
  exerciseTitle: "Bài 1",
  revealAnswers: true,
  questions: [
    {
      id: "q1",
      order: 0,
      type: "single_choice",
      content: "?",
      options: [],
      payload: {},
      studentAnswer: "B",
      isCorrect: false,
      gradable: true,
      points: 0,
      maxPoints: 1,
      teacherComment: null,
      fileCount: 0,
    },
  ],
};

const mocked = api as unknown as {
  getSubmission: ReturnType<typeof vi.fn>;
  getSubmissionReview: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mocked.getSubmission.mockResolvedValue(detail);
  mocked.getSubmissionReview.mockResolvedValue(review);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function open() {
  render(
    <SubmissionDetailDialog submissionId="s1" open onOpenChange={() => {}} />,
  );
}

describe("SubmissionDetailDialog", () => {
  it("mở dialog → gọi cả điểm lẫn xem lại, render cả hai", async () => {
    open();

    await waitFor(() => expect(screen.getByText("Đã chấm điểm")).toBeTruthy());
    expect(mocked.getSubmission).toHaveBeenCalledWith("s1");
    expect(mocked.getSubmissionReview).toHaveBeenCalledWith("s1");
    expect(screen.getByTestId("review-list").dataset.reveal).toBe("true");
  });

  // BUG-F/G: màn kết quả có nút "Chia sẻ" để vào lại bài / đăng nhập lại vẫn
  // chia sẻ được kết quả lần làm gần nhất qua Lịch sử làm bài.
  it("màn kết quả có nút Chia sẻ", async () => {
    open();
    expect(
      await screen.findByRole("button", { name: /Chia sẻ/ }),
    ).toBeTruthy();
  });

  it("bài giấu đáp án: vẫn có danh sách xem lại nhưng không lộ đáp án", async () => {
    mocked.getSubmissionReview.mockResolvedValue({
      ...review,
      revealAnswers: false,
    });
    open();

    await waitFor(() => expect(screen.getByTestId("review-list")).toBeTruthy());
    expect(screen.getByTestId("review-list").dataset.reveal).toBe("false");
  });

  /**
   * Cầu chì: LCMS không có cửa review (getSubmissionReview trả null), và FE có
   * thể lên trước BE. Cả hai trường hợp phải rơi về đúng màn điểm-only cũ.
   */
  it("không có dữ liệu xem lại → vẫn ra điểm, không lỗi", async () => {
    mocked.getSubmissionReview.mockResolvedValue(null);
    open();

    await waitFor(() => expect(screen.getByText("Đã chấm điểm")).toBeTruthy());
    expect(screen.queryByTestId("review-list")).toBeNull();
  });

  it("gọi điểm thất bại → hiện lỗi thay vì màn trắng", async () => {
    mocked.getSubmission.mockRejectedValue(new Error("Hỏng mạng"));
    open();

    // Không render Error.message thô (Fortify: System Information Leak) — hiện
    // thông báo an toàn cố định, vẫn là "lỗi thay vì màn trắng".
    await waitFor(() =>
      expect(screen.getByText("Không thể tải kết quả.")).toBeTruthy(),
    );
    expect(screen.queryByTestId("review-list")).toBeNull();
  });
});
