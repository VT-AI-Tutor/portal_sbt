// @vitest-environment jsdom
/**
 * Phản hồi trong lúc làm bài.
 *
 * Chế độ Luyện tập KHÔNG còn kiểm tra từng câu (2026-07-30): không nút "Kiểm
 * tra", không banner đúng/sai — toàn bộ kết quả chuyển sang màn kết quả sau
 * khi nộp. Chế độ Chơi game giữ nguyên chấm tức thì vì combo/XP dựa vào đó.
 *
 * Box "Giải thích AI" inline đã GỠ từ trước (Owner 24/7 — bank chưa có data
 * explanation, fallback lộ id thô kiểu "s1, s2, s4").
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PracticeSession } from "@/modules/student/api/practiceApi";

const q = (id: string, order: number) => ({
  id,
  order,
  question_text: `Câu ${order + 1}`,
  question_type: "single_choice",
  payload: {
    options: [
      { id: "A", content: "47205" },
      { id: "B", content: "40725" },
    ],
    correctAnswer: "A",
    score: 1,
  },
  level_code: "biet",
  outcome_code: "T4",
  content_code: "SO",
  difficulty: "medium" as const,
  points: 15,
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
  questions: [q("q1", 0), q("q2", 1)],
  answers: [],
  subject_name: "Toán",
  topic_label: "Số tự nhiên",
};

vi.mock("@/modules/student/api/practiceApi", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/modules/student/api/practiceApi")>();
  return { ...mod, savePracticeAnswers: vi.fn(async () => {}) };
});

// Stub player có 2 nút: chọn đúng (A) / chọn sai (B).
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    index,
    onAnswerChange,
  }: {
    index: number;
    onAnswerChange?: (a: unknown) => void;
  }) => (
    <div data-testid="qp" data-index={index}>
      <button onClick={() => onAnswerChange?.("A")}>chọn đúng</button>
      <button onClick={() => onAnswerChange?.("B")}>chọn sai</button>
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

describe("PracticeRunner — chế độ Luyện tập không phản hồi từng câu", () => {
  it("chọn đáp án SAI: không banner đỏ, không nút Kiểm tra", async () => {
    const user = await setup();
    await user.click(screen.getByText("chọn sai"));

    expect(screen.queryByRole("button", { name: "Kiểm tra" })).toBeNull();
    expect(screen.queryByText("Chưa đúng — đừng nản nhé!")).toBeNull();
    expect(screen.queryByText(/Giải thích AI/)).toBeNull();
  });

  it("chọn đáp án ĐÚNG: không banner xanh, không lộ điểm từng câu", async () => {
    const user = await setup();
    await user.click(screen.getByText("chọn đúng"));

    expect(screen.queryByText(/Chính xác! \+15 điểm/)).toBeNull();
    expect(screen.queryByText(/Giữ vững phong độ/)).toBeNull();
  });

  it("câu cuối: nút Nộp bài trong card mở dialog xác nhận", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Tới câu 2" }));
    await user.click(screen.getByText("chọn đúng"));

    expect(screen.queryByRole("button", { name: /Câu tiếp theo/ })).toBeNull();
    const submitButtons = screen.getAllByRole("button", { name: "Nộp bài" });
    await user.click(submitButtons[submitButtons.length - 1]);
    expect(await screen.findByText("Em chắc chắn muốn nộp bài?")).toBeTruthy();
  });
});

describe("PracticeRunner — chế độ Chơi game giữ chấm tức thì", () => {
  it("bấm Kiểm tra vẫn chấm và cho đi tiếp", async () => {
    const user = await setup({ ...base, mode: "game" });
    await user.click(screen.getByText("chọn đúng"));
    await user.click(screen.getByRole("button", { name: "Kiểm tra" }));

    // Game tự sang câu sau khi đúng (GAME_AUTO_ADVANCE_MS) — chỉ cần chắc là
    // nút Kiểm tra tồn tại và bấm được, không khẳng định banner (game ẩn banner).
    expect(screen.getByTestId("qp")).toBeTruthy();
  });
});
