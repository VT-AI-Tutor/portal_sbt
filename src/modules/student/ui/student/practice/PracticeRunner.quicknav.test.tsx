// @vitest-environment jsdom
/**
 * Dãy số nhảy nhanh tới câu (mockup 2026-07-24): hiện ở practice/thi thử,
 * click nhảy thẳng và GIỮ đáp án đã chọn; game mode ẩn (bảo vệ combo tuần tự).
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
      { id: "A", content: "1" },
      { id: "B", content: "2" },
    ],
    correctAnswer: "B",
    score: 1,
  },
  level_code: "biet",
  outcome_code: "T4",
  content_code: "SO",
  difficulty: "easy" as const,
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
  questions: [q("q1", 0), q("q2", 1)],
  answers: [],
  subject_name: "Toán",
  topic_label: "Phân số",
};

vi.mock("@/modules/student/api/practiceApi", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/modules/student/api/practiceApi")>();
  return { ...mod, savePracticeAnswers: vi.fn(async () => {}) };
});

// Stub player: phơi index + answer để khẳng định nhảy câu giữ state.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    index,
    answer,
    onAnswerChange,
  }: {
    index: number;
    answer?: unknown;
    onAnswerChange?: (a: unknown) => void;
  }) => (
    <div data-testid="qp" data-index={index} data-answer={String(answer ?? "")}>
      <button onClick={() => onAnswerChange?.("B")}>chọn B</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderRunner(session: PracticeSession) {
  const { PracticeRunner } = await import("./PracticeRunner");
  return render(
    <MemoryRouter>
      <PracticeRunner session={session} onSubmit={vi.fn()} submitting={false} />
    </MemoryRouter>,
  );
}

describe("PracticeRunner — quick-nav + header mới", () => {
  it("header hiện breadcrumb + tiêu đề từ nhãn BE; badge điểm/độ khó", async () => {
    await renderRunner(base);
    expect(screen.getByText(/Toán · Lớp 4 · Luyện tập/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Phân số" })).toBeTruthy();
    expect(screen.getByText("+10 điểm")).toBeTruthy();
    expect(screen.getByText("Dễ")).toBeTruthy();
    expect(screen.getByText("Trắc nghiệm 1 đáp án")).toBeTruthy();
  });

  it("click số 2 nhảy thẳng tới câu 2 và quay lại câu 1 vẫn giữ đáp án", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await renderRunner(base);

    await user.click(screen.getByText("chọn B")); // trả lời câu 1
    await user.click(screen.getByRole("button", { name: "Tới câu 2" }));
    expect(screen.getByTestId("qp").getAttribute("data-index")).toBe("1");

    await user.click(screen.getByRole("button", { name: "Tới câu 1" }));
    const qp = screen.getByTestId("qp");
    expect(qp.getAttribute("data-index")).toBe("0");
    expect(qp.getAttribute("data-answer")).toBe("B");
  });

  it("game mode ẩn dãy nhảy câu", async () => {
    await renderRunner({ ...base, mode: "game" });
    expect(screen.queryByRole("button", { name: "Tới câu 2" })).toBeNull();
  });

  it("không có topic_label → tiêu đề 'Luyện tập tổng hợp'", async () => {
    await renderRunner({ ...base, topic_label: null });
    expect(screen.getByRole("heading", { name: "Luyện tập tổng hợp" })).toBeTruthy();
  });

  it("Trước/Sau điều hướng từng câu; tắt ở hai đầu", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await renderRunner(base);

    // Câu đầu: Trước tắt, Sau bật.
    expect((screen.getByRole("button", { name: "Trước" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Sau" }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getByRole("button", { name: "Sau" }));
    expect(screen.getByTestId("qp").getAttribute("data-index")).toBe("1");
    // Câu cuối: Sau tắt, Trước bật.
    expect((screen.getByRole("button", { name: "Sau" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Trước" }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getByRole("button", { name: "Trước" }));
    expect(screen.getByTestId("qp").getAttribute("data-index")).toBe("0");
  });

  it("Nộp bài xuất hiện sau khi tới câu cuối, rồi giữ lại ở MỌI câu", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await renderRunner(base);

    // Chưa tới câu cuối → chưa có Nộp bài.
    expect(screen.queryByRole("button", { name: "Nộp bài" })).toBeNull();

    // Tới câu cuối → Nộp bài hiện.
    await user.click(screen.getByRole("button", { name: "Tới câu 2" }));
    expect(screen.getByRole("button", { name: "Nộp bài" })).toBeTruthy();

    // Quay lại câu đầu → Nộp bài VẪN còn (đã đến câu cuối một lần).
    await user.click(screen.getByRole("button", { name: "Tới câu 1" }));
    expect(screen.getByTestId("qp").getAttribute("data-index")).toBe("0");
    expect(screen.getByRole("button", { name: "Nộp bài" })).toBeTruthy();
  });

  it("game mode ẩn thanh Trước/Sau", async () => {
    await renderRunner({ ...base, mode: "game" });
    expect(screen.queryByRole("button", { name: "Trước" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sau" })).toBeNull();
  });

  it("game mode: giữ 'Câu tiếp' (không có quick-nav, tránh kẹt khi trả lời sai)", async () => {
    await renderRunner({ ...base, mode: "game" });
    expect(screen.getByRole("button", { name: /Câu tiếp/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Câu trước/ })).toBeNull();
  });
});
