// @vitest-environment jsdom
/**
 * ArenaRunner (Task 13): no per-question "Kiểm tra" (grading is server-side
 * at submit, unlike PracticeRunner's practice/game modes), the countdown
 * header renders, and expiry auto-submits exactly once (guarded — see
 * `useCountdown`'s `firedRef` + this component's `submitLockRef`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ArenaAttempt, ArenaSubmitResult } from "@/modules/student/api/arenaApi";

const attempt: ArenaAttempt = {
  attempt_id: "at1",
  round_id: "r1",
  attempt_no: 1,
  started_at: "2026-07-24T00:00:00.000Z",
  expires_at: "2026-07-24T00:10:00.000Z", // 600s limit
  questions: [
    {
      id: "q1",
      type: "single_choice",
      content: "1 + 1 = ?",
      options: [
        { id: "A", content: "1" },
        { id: "B", content: "2" },
      ],
      payload: null,
      points: 10,
    },
    {
      id: "q2",
      type: "single_choice",
      content: "2 + 2 = ?",
      options: [
        { id: "A", content: "3" },
        { id: "B", content: "4" },
      ],
      payload: null,
      points: 10,
    },
  ],
  answers: {},
};

const fakeResult: ArenaSubmitResult = {
  score: 500,
  correct_count: 1,
  question_count: 2,
  duration_seconds: 600,
  is_best: true,
  rank: 3,
};

vi.mock("@/modules/student/api/arenaApi", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/modules/student/api/arenaApi")>();
  return { ...mod, saveArenaAnswers: vi.fn(async () => {}) };
});

vi.mock("@/modules/student/api/arenaHooks", () => ({
  useSubmitArenaAttempt: vi.fn(),
}));

// Stub player: same minimal shape used by PracticeRunner's tests — exposes
// answer + a button to change it, no "Kiểm tra" chrome of its own.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    answer,
    onAnswerChange,
  }: {
    answer?: unknown;
    onAnswerChange?: (a: unknown) => void;
  }) => (
    <div data-testid="qp" data-answer={String(answer ?? "")}>
      <button onClick={() => onAnswerChange?.("B")}>chọn B</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

async function renderRunner(onSubmitted = vi.fn()) {
  const { ArenaRunner } = await import("./ArenaRunner");
  const utils = render(
    <MemoryRouter>
      <ArenaRunner attempt={attempt} onSubmitted={onSubmitted} />
    </MemoryRouter>,
  );
  return { ...utils, onSubmitted };
}

async function mockSubmitHook(mutateAsync = vi.fn(async () => fakeResult)) {
  const { useSubmitArenaAttempt } = await import("@/modules/student/api/arenaHooks");
  vi.mocked(useSubmitArenaAttempt).mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useSubmitArenaAttempt>);
  return mutateAsync;
}

describe("ArenaRunner", () => {
  beforeEach(async () => {
    await mockSubmitHook();
  });

  it("không render nút 'Kiểm tra' (thi đấu trường không chấm từng câu)", async () => {
    await renderRunner();
    expect(screen.queryByRole("button", { name: "Kiểm tra" })).toBeNull();
  });

  it("đồng hồ đếm ngược hiển thị mm:ss (10 phút → '10:00')", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(attempt.started_at));
    await renderRunner();
    expect(screen.getByText("10:00")).toBeTruthy();
  });

  it("hết giờ (fake timer) → tự động nộp bài, gọi submit đúng 1 lần", async () => {
    const mutateAsync = await mockSubmitHook();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(attempt.started_at));
    const { onSubmitted } = await renderRunner();

    // Vượt mốc hết hạn (600s) — useCountdown tick mỗi 1s, onExpire bắn đúng 1
    // lần (firedRef); advanceTimersByTimeAsync để các await trong doSubmit
    // (flush rồi submit) có nhịp chạy giữa các tick.
    await vi.advanceTimersByTimeAsync(605_000);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith("at1");
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledWith(fakeResult);

    // Tick tiếp — không được nộp thêm lần nào nữa.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });
  it("nút Câu trước/Câu tiếp điều hướng và disable ở hai đầu", async () => {
    await mockSubmitHook();
    await renderRunner();
    const prev = screen.getByRole("button", { name: /Câu trước/i }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: /Câu tiếp/i }) as HTMLButtonElement;
    // Câu 1: prev disabled, next enabled.
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    // Bấm next tới câu cuối → next disabled, prev enabled.
    const total = attempt.questions.length;
    for (let i = 0; i < total - 1; i++) fireEvent.click(next);
    expect(screen.getByText(`${total} / ${total}`)).toBeTruthy();
    expect(next.disabled).toBe(true);
    expect(prev.disabled).toBe(false);
    // Quay lại 1 bước.
    fireEvent.click(prev);
    expect(screen.getByText(`${total - 1} / ${total}`)).toBeTruthy();
  });
  it("nút Nộp bài chỉ nổi bật (btn-pop) khi đã làm hết các câu", async () => {
    await mockSubmitHook();
    // Chưa làm câu nào → nút dịu (outline, không btn-pop).
    await renderRunner();
    const subdued = screen.getByRole("button", { name: /Nộp bài/i });
    expect(subdued.className).not.toContain("btn-pop");
    cleanup();
    // Đã trả lời đủ mọi câu (answers prefill từ server) → nút nổi bật.
    const { ArenaRunner } = await import("./ArenaRunner");
    render(
      <MemoryRouter>
        <ArenaRunner
          attempt={{ ...attempt, answers: { q1: "B", q2: "B" } }}
          onSubmitted={vi.fn()}
        />
      </MemoryRouter>,
    );
    const prominent = screen.getByRole("button", { name: /Nộp bài/i });
    expect(prominent.className).toContain("btn-pop");
  });
  it("nút Câu tiếp nổi bật trừ khi ở câu cuối", async () => {
    await mockSubmitHook();
    await renderRunner();
    const next = screen.getByRole("button", { name: /Câu tiếp/i }) as HTMLButtonElement;
    // Câu 1/2: nổi bật (primary + btn-pop).
    expect(next.className).toContain("bg-primary");
    expect(next.className).toContain("btn-pop");
    // Sang câu cuối: hết nổi bật + disabled.
    fireEvent.click(next);
    expect(next.className).not.toContain("btn-pop");
    expect(next.disabled).toBe(true);
  });
});
