// @vitest-environment jsdom
/**
 * Luồng ĐĂNG NHẬP phải khớp luồng khách (Owner 19/08): nộp xong KHÔNG nhảy
 * thẳng ra màn điểm, mà ở lại chính runner này — về câu 1, mỗi câu tự tô
 * đúng/sai + đáp án đúng như chấm ngay. Màn điểm chỉ tới khi học sinh chủ động
 * bấm "Hoàn thành", vì soát lại là tuỳ ý.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/** Đổi giữa các ca: server im lặng (null) vs server bảo GIẤU đáp án. */
let reviewResponse: { revealAnswers: boolean } | null = null;

const exercise = {
  id: "ex1",
  title: "Bài",
  instructions: null,
  durationMinutes: null,
  questions: [
    { id: "q1", type: "single_choice", content: "Câu 1", options: [] },
    { id: "q2", type: "single_choice", content: "Câu 2", options: [] },
  ],
};

vi.mock("@/core/auth/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

vi.mock("@/modules/books/api/assessmentApi", () => ({
  getExercise: vi.fn(async () => exercise),
  getCurrentAttempt: vi.fn(async () => null),
  startAttempt: vi.fn(async () => ({
    attemptId: "a1",
    startedAt: "2026-01-01T00:00:00Z",
  })),
  saveAnswers: vi.fn(async () => {}),
  submitAttempt: vi.fn(async () => ({
    submissionId: "s1",
    gradingStatus: "graded",
  })),
  getSubmission: vi.fn(async () => ({
    submissionId: "s1",
    gradingStatus: "graded",
    score: 10,
    maxScore: 10,
    submittedAt: "2026-01-01T00:00:00Z",
    gradedAt: "2026-01-01T00:00:00Z",
    teacherComment: null,
  })),
  getSubmissionReview: vi.fn(async () => reviewResponse),
  getSubmittedAttempt: vi.fn(async () => null),
  uploadAttemptFile: vi.fn(),
  listHistory: vi.fn(async () => []),
}));

// Stub player: phơi index + các prop quyết định cách hiện kết quả.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    index,
    ...rest
  }: { index: number } & Record<string, unknown>) => {
    const r = rest as {
      submitted?: boolean;
      revealCorrect?: boolean;
      hideResultBanner?: boolean;
    };
    return (
      <div data-testid="qp">
        câu={index} submitted={String(r.submitted)} revealCorrect=
        {String(r.revealCorrect)} hideResultBanner={String(r.hideResultBanner)}
      </div>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  reviewResponse = null;
});

async function submitFromLastQuestion() {
  const { userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  const { SubmissionRunner } = await import("./SubmissionRunner");

  render(
    <MemoryRouter>
      <SubmissionRunner exerciseId="ex1" lessonTitle="Bài học" marking="silent" />
    </MemoryRouter>,
  );

  await user.click(await screen.findByRole("button", { name: /Câu tiếp/ }));
  await user.click(await screen.findByRole("button", { name: /Nộp bài/ }));
  await user.click(await screen.findByRole("button", { name: /Vẫn nộp bài/ }));
  return user;
}

const player = () => screen.getByTestId("qp").textContent ?? "";

describe("SubmissionRunner — nộp xong chấm tại chỗ, không nhảy thẳng màn điểm", () => {
  it("về câu 1 và tô dấu ngay trong câu", async () => {
    await submitFromLastQuestion();

    await screen.findByTestId("qp");
    expect(player()).toContain("câu=0");
    expect(player()).toContain("submitted=true");
    expect(player()).toContain("revealCorrect=true");
    expect(player()).toContain("hideResultBanner=true");
    // Chưa ra màn điểm.
    expect(screen.queryByText(/Đã nộp bài!/)).toBeNull();
  });

  it('"Hoàn thành" mới sang màn điểm', async () => {
    const user = await submitFromLastQuestion();

    await user.click(await screen.findByRole("button", { name: /Hoàn thành/ }));

    await screen.findByText(/Đã nộp bài!/);
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("server bảo GIẤU đáp án → tôn trọng, không lộ", async () => {
    reviewResponse = { revealAnswers: false };
    await submitFromLastQuestion();

    await screen.findByTestId("qp");
    // Vẫn chấm tại chỗ (submitted) nhưng KHÔNG tô đáp án đúng.
    expect(player()).toContain("submitted=true");
    expect(player()).toContain("revealCorrect=false");
  });

  it("đang làm thì chưa tô gì", async () => {
    const { SubmissionRunner } = await import("./SubmissionRunner");
    render(
      <MemoryRouter>
        <SubmissionRunner
          exerciseId="ex1"
          lessonTitle="Bài học"
          marking="silent"
        />
      </MemoryRouter>,
    );

    await screen.findByTestId("qp");
    // Đang làm: runner KHÔNG truyền ba prop hiển thị — cùng hợp đồng mà
    // checkPersist ghim cho chế độ tự chấm.
    expect(player()).toContain("submitted=undefined");
    expect(player()).toContain("revealCorrect=undefined");
    expect(player()).toContain("hideResultBanner=undefined");
  });
});
