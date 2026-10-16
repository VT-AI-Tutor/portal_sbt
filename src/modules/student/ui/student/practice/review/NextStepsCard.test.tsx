// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionReview } from "@/modules/student/api/practiceApi";
import { NextStepsCard } from "./NextStepsCard";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

const createSession = vi.fn(async (_input: unknown) => ({ id: "new-session" }));
vi.mock("@/modules/student/api/practiceApi", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/student/api/practiceApi")
  >()),
  createPracticeSession: (input: unknown) => createSession(input),
  getPracticeSuggestions: async () => [
    {
      key: "c9",
      subject_code: "TOAN",
      title: "Số thập phân",
      mastery_percent: 40,
      trend: "flat",
      priority: "high",
      question_count: 10,
      reason_text: "Còn lúng túng",
      ref: { content_code: "c9" },
    },
  ],
}));

const review = {
  session_id: "s1",
  mode: "practice",
  source: "topic",
  subject_code: "TOAN",
  subject_name: "Toán",
  level: "4",
  ref: { content_code: "c1" },
  topic_label: "Phân số",
  score: 7,
  max_score: 10,
  questions: [],
  weak_points: [],
  topic_mastery: null,
} as unknown as SessionReview;

function renderCard(r: SessionReview = review) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NextStepsCard review={r} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NextStepsCard", () => {
  it("luyện tiếp chủ đề này tạo phiên mới cùng tham số", async () => {
    renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: /Luyện tiếp chủ đề này/i }),
    );

    await waitFor(() =>
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "practice",
          source: "topic",
          subject_code: "TOAN",
          level: "4",
          ref: { content_code: "c1" },
        }),
      ),
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        "/student/practice/session/new-session",
      ),
    );
  });

  it("hiện gợi ý chủ đề khác", async () => {
    renderCard();
    expect(await screen.findByText("Số thập phân")).toBeTruthy();
  });

  it("phiên tổng hợp đổi nhãn nút chính", () => {
    renderCard({ ...review, ref: null, topic_label: null } as SessionReview);
    expect(
      screen.getByRole("button", { name: /Luyện thêm một phiên nữa/i }),
    ).toBeTruthy();
  });
});
