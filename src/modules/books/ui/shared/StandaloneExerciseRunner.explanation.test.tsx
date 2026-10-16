// @vitest-environment jsdom
/**
 * "Xem lời giải" trong runner: nút chỉ hiện khi câu CÓ lời giải VÀ mạch của câu
 * đó đã làm xong — góp ý 21/8: mở khoá theo NHÓM ("ĐỌC", "VIẾT"…), không bắt
 * xong hết cả bài. Câu không có lời giải thì không có nút, nên bài chấm-server
 * (server lột explanation) cũng không lộ đáp án.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { QuestionLabel } from "./lessonSections";

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

afterEach(cleanup);

const question = (id: string, withExplanation = true) => ({
  id,
  question_type: "fill_blank",
  payload: {
    content: { blocks: [{ type: "paragraph", text: "Điền số" }] },
    ...(withExplanation
      ? {
          explanation: {
            blocks: [{ type: "paragraph", text: `Lời giải của ${id}.` }],
          },
        }
      : {}),
  },
});

const label = (
  line: string,
  ordinal: number,
  lineTotal: number,
): QuestionLabel => ({
  line,
  sectionLabel: line,
  ordinal,
  lineTotal,
});

async function renderRunner(
  questions: ReturnType<typeof question>[],
  questionLabelById?: Record<string, QuestionLabel>,
) {
  const { StandaloneExerciseRunner } =
    await import("./StandaloneExerciseRunner");
  render(
    <StandaloneExerciseRunner
      lessonTitle="Bài"
      questions={questions}
      questionLabelById={questionLabelById}
    />,
  );
}

const explanationButton = () =>
  screen.queryByRole("button", { name: /Xem lời giải/ });

describe("StandaloneExerciseRunner — Xem lời giải", () => {
  it("chưa làm thì chưa có nút", async () => {
    await renderRunner([question("q1")]);

    expect(explanationButton()).toBeNull();
  });

  it("xong mạch nào thì mở lời giải mạch đó, mạch chưa xong vẫn khoá", async () => {
    await renderRunner([question("q1"), question("q2")], {
      q1: label("ĐỌC", 1, 1),
      q2: label("VIẾT", 1, 1),
    });

    fireEvent.click(screen.getByRole("button", { name: "trả-lời" }));
    expect(explanationButton()).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    expect(explanationButton()).toBeNull();
  });

  it("mạch nhiều câu: còn một câu chưa làm là vẫn khoá cả mạch", async () => {
    await renderRunner([question("q1"), question("q2")], {
      q1: label("ĐỌC", 1, 2),
      q2: label("ĐỌC", 2, 2),
    });

    fireEvent.click(screen.getByRole("button", { name: "trả-lời" }));
    expect(explanationButton()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    fireEvent.click(screen.getByRole("button", { name: "trả-lời" }));
    expect(explanationButton()).toBeTruthy();
  });

  it("bài không chia mạch: phải làm xong cả bài", async () => {
    await renderRunner([question("q1"), question("q2")]);

    fireEvent.click(screen.getByRole("button", { name: "trả-lời" }));
    expect(explanationButton()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    fireEvent.click(screen.getByRole("button", { name: "trả-lời" }));
    expect(explanationButton()).toBeTruthy();
  });

  it("mở modal đúng nội dung lời giải của câu đang mở", async () => {
    await renderRunner([question("q1")]);

    fireEvent.click(screen.getByRole("button", { name: "trả-lời" }));
    fireEvent.click(explanationButton()!);

    expect(screen.getByText("Đáp án/ Gợi ý")).toBeTruthy();
    expect(screen.getByText("Lời giải của q1.")).toBeTruthy();
  });

  it("ẩn nút khi câu không có lời giải, dù đã làm xong", async () => {
    await renderRunner([question("q1", false)]);

    fireEvent.click(screen.getByRole("button", { name: "trả-lời" }));

    expect(explanationButton()).toBeNull();
  });
});
