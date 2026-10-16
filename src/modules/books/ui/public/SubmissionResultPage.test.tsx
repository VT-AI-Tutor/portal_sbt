// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SubmissionDetail,
  SubmissionReview,
} from "@/modules/books/api/assessmentApi";
import * as api from "@/modules/books/api/assessmentApi";
import { SubmissionResultPage } from "./SubmissionResultPage";

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getSubmission: vi.fn(),
  getSubmissionReview: vi.fn(),
}));

vi.mock("@/modules/books/ui/shared/SubmissionReviewQuestions", () => ({
  SubmissionReviewQuestions: ({ questions }: { questions: unknown[] }) => (
    <div data-testid="review-list">{questions.length} câu</div>
  ),
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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/ket-qua/s1"]}>
        <Routes>
          <Route
            path="/ket-qua/:submissionId"
            element={<SubmissionResultPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SubmissionResultPage", () => {
  it("hiện điểm kèm danh sách xem lại", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Đã chấm điểm")).toBeTruthy());
    expect(screen.getByTestId("review-list").textContent).toBe("1 câu");
  });

  it("không có dữ liệu xem lại → vẫn ra điểm như trước", async () => {
    mocked.getSubmissionReview.mockResolvedValue(null);
    renderPage();

    await waitFor(() => expect(screen.getByText("Đã chấm điểm")).toBeTruthy());
    expect(screen.queryByTestId("review-list")).toBeNull();
  });
});
