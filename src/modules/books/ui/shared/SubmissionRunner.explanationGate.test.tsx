// @vitest-environment jsdom
/**
 * "Xem lời giải" ở bài chấm-server mở khoá theo MẠCH y như runner khách. Khác
 * một chỗ: "đã làm" ở đây là `isQuestionAnswered` của chính runner, nên câu tự
 * luận nộp bằng FILE ĐÍNH KÈM (không gõ chữ) cũng mở khoá được — nếu chỗ này tự
 * định nghĩa lại "đã làm" thì học sinh đính kèm xong vẫn bị khoá.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { QuestionLabel } from "./lessonSections";

const question = (id: string, content: string) => ({
  id,
  type: "essay",
  content,
  options: [],
  payload: {
    content: { blocks: [{ type: "paragraph", text: content }] },
    explanation: {
      blocks: [{ type: "paragraph", text: `Lời giải của ${id}.` }],
    },
  },
});

const exercise = {
  id: "ex1",
  title: "Bài",
  instructions: null,
  durationMinutes: null,
  questions: [question("q1", "Câu 1"), question("q2", "Câu 2")],
};

const label = (line: string): QuestionLabel => ({
  line,
  sectionLabel: line,
  ordinal: 1,
  lineTotal: 1,
});

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
  getSubmission: vi.fn(async () => null),
  getSubmissionReview: vi.fn(async () => null),
  getSubmittedAttempt: vi.fn(async () => null),
  uploadAttemptFile: vi.fn(async () => ({
    fileId: "f1",
    fileUrl: "https://example.test/bai-lam.png",
  })),
  listHistory: vi.fn(async () => []),
}));

// Stub player: trả lời một câu = bấm một nút, không phụ thuộc loại câu hỏi.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    index,
    onAnswerChange,
  }: {
    index: number;
    onAnswerChange?: (answer: unknown) => void;
  }) => (
    <button type="button" onClick={() => onAnswerChange?.(`ans-${index}`)}>
      trả-lời
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderRunner() {
  const { userEvent } = await import("@testing-library/user-event");
  const { SubmissionRunner } = await import("./SubmissionRunner");
  render(
    <MemoryRouter>
      <SubmissionRunner
        exerciseId="ex1"
        lessonTitle="Bài học"
        marking="silent"
        questionLabelById={{ q1: label("ĐỌC"), q2: label("VIẾT") }}
      />
    </MemoryRouter>,
  );
  // Chờ lượt làm khởi động xong: chưa có attemptId thì chưa có ô đính kèm.
  await screen.findByRole("button", { name: "trả-lời" });
  return userEvent.setup();
}

const explanationButton = () =>
  screen.queryByRole("button", { name: /Xem lời giải/ });

const fileInput = () =>
  document.querySelector('input[type="file"]') as HTMLInputElement;

describe("SubmissionRunner — khoá Xem lời giải theo mạch", () => {
  it("chưa làm thì chưa có nút", async () => {
    await renderRunner();

    expect(explanationButton()).toBeNull();
  });

  it("xong mạch nào mở mạch đó, mạch chưa xong vẫn khoá", async () => {
    const user = await renderRunner();

    await user.click(screen.getByRole("button", { name: "trả-lời" }));
    expect(explanationButton()).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    expect(explanationButton()).toBeNull();
  });

  it("modal lời giải mang tiêu đề Đáp án/ Gợi ý", async () => {
    const user = await renderRunner();

    await user.click(screen.getByRole("button", { name: "trả-lời" }));
    await user.click(explanationButton()!);

    expect(await screen.findByText("Đáp án/ Gợi ý")).toBeTruthy();
  });

  it("câu tự luận chỉ đính kèm file vẫn tính là đã làm", async () => {
    const user = await renderRunner();

    const file = new File(["bai-lam"], "bai-lam.png", { type: "image/png" });
    await user.upload(fileInput(), file);

    await screen.findByRole("button", { name: /Xem lời giải/ });
  });
});
