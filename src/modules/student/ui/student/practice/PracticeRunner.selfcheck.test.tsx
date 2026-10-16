// @vitest-environment jsdom
/**
 * 1. Badge loại câu `short_answer` không có trong `QUESTION_TYPE_LABELS`
 *    (generated — chỉ có `essay`) nên trước đây rớt lookup và hiện thẳng
 *    slug thô "short_answer". Fallback ở `core/reference/practiceLabels.ts`
 *    phải sửa việc này (Task F3, 2026-07-28-practice-runner-9-types.md).
 * 2. Kiểm tra từng câu nay CHỈ còn ở chế độ Chơi game. Chế độ Luyện tập không
 *    còn nút "Kiểm tra" — kết quả (kể cả ghi chú cho câu không tự chấm được)
 *    chuyển hết sang màn kết quả sau khi nộp
 *    (2026-07-30-practice-result-pha1-man-ket-qua.md).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PracticeSession } from "@/modules/student/api/practiceApi";

const q = (id: string, order: number, question_type: string) => ({
  id,
  order,
  question_text: `Câu ${order + 1}`,
  question_type,
  payload: {
    score: 1,
  },
  level_code: "biet",
  outcome_code: "T4",
  content_code: "SO",
  difficulty: "medium" as const,
  points: 10,
});

const base: PracticeSession = {
  id: "s1",
  mode: "practice",
  source: "custom",
  subject_code: "toan",
  level: "4",
  framework_key: "gdpt-2018",
  ref: null,
  time_limit_seconds: null,
  status: "in_progress",
  started_at: "2026-07-24T00:00:00Z",
  questions: [q("q1", 0, "short_answer"), q("q2", 1, "essay")],
  answers: [],
  subject_name: "Toán",
  topic_label: "Số tự nhiên",
};

vi.mock("@/modules/student/api/practiceApi", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("@/modules/student/api/practiceApi")>();
  return { ...mod, savePracticeAnswers: vi.fn(async () => {}) };
});

vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    index,
    onAnswerChange,
  }: {
    index: number;
    onAnswerChange?: (a: unknown) => void;
  }) => (
    <div data-testid="qp" data-index={index}>
      <button onClick={() => onAnswerChange?.("bài làm của em")}>
        gõ đáp án
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function setup(session: PracticeSession = base) {
  const { userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  const { PracticeRunner } = await import("./PracticeRunner");
  render(
    <MemoryRouter>
      <PracticeRunner session={session} onSubmit={vi.fn()} submitting={false} />
    </MemoryRouter>,
  );
  return user;
}

describe("PracticeRunner — badge loại câu short_answer", () => {
  it('hiện "Trả lời ngắn" thay vì slug thô "short_answer"', async () => {
    await setup();
    expect(screen.getByText("Trả lời ngắn")).toBeTruthy();
    expect(screen.queryByText("short_answer")).toBeNull();
  });

  /**
   * Badge phải chuẩn hoá type qua CÙNG bộ alias với đường chính
   * (`canonicalQuestionType`): key trong registry là `drawing`, nên tra bằng
   * type thô `free_draw` sẽ rớt lookup và hiện slug thô cho học sinh.
   * Đường chính được pin ở `core/question-schema/adapter.test.ts`.
   */
  it('alias free_draw hiện "Vẽ tự do", không phải slug thô hay "Tự luận"', async () => {
    await setup({ ...base, questions: [q("q1", 0, "free_draw")] });
    expect(screen.getByText("Vẽ tự do")).toBeTruthy();
    expect(screen.queryByText("free_draw")).toBeNull();
    expect(screen.queryByText("Tự luận")).toBeNull();
  });
});

describe("PracticeRunner — kiểm tra từng câu", () => {
  it("chế độ Luyện tập KHÔNG còn nút Kiểm tra (kết quả chỉ hiện khi nộp)", async () => {
    await setup();
    expect(screen.queryByRole("button", { name: "Kiểm tra" })).toBeNull();
  });

  it("chế độ Chơi game vẫn có nút Kiểm tra — combo/XP dựa vào chấm tức thì", async () => {
    await setup({ ...base, mode: "game" });
    expect(screen.getByRole("button", { name: "Kiểm tra" })).toBeTruthy();
  });

  it("câu không tự chấm ở chế độ game: không hiện banner đúng/sai", async () => {
    const user = await setup({ ...base, mode: "game" });
    await user.click(screen.getByText("gõ đáp án"));
    await user.click(screen.getByRole("button", { name: "Kiểm tra" }));

    expect(screen.queryByText(/Chính xác!/)).toBeNull();
    expect(screen.queryByText("Chưa đúng — đừng nản nhé!")).toBeNull();
  });
});
