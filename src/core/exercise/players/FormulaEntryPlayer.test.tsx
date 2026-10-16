import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FormulaEntryPlayer } from "./FormulaEntryPlayer";
import { typeBlur } from "./instant-test-utils";

// NOTE: FormulaEntryPlayer's default `inputMode="formula"` renders a
// `<math-field>` custom element (MathField), which does not register or
// behave in jsdom. This suite forces `inputMode="text"` to exercise the
// blur-grading path through a plain `<input>`. The `<math-field>` onBlur
// wiring is verified manually.

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("grades on blur and emits onElementGraded (instant default)", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <FormulaEntryPlayer
        title="Q"
        inputMode="text"
        acceptedAnswers={["4"]}
        gradingMode="numeric"
        onElementGraded={onElementGraded}
      />,
    ),
  );
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "4");
  expect(onElementGraded).toHaveBeenCalledWith("answer", "correct", undefined);
  expect(input.className).toContain("green");
  expect(container.textContent).not.toContain("Kiểm tra");
});

it("shows the Kiểm tra button when instantFeedback=false", () => {
  act(() =>
    root.render(
      <FormulaEntryPlayer
        title="Q"
        inputMode="text"
        acceptedAnswers={["4"]}
        gradingMode="numeric"
        instantFeedback={false}
      />,
    ),
  );
  expect(container.textContent).toContain("Kiểm tra");
});

it("button-mode wrong Kiểm tra turns the field red + shows the feedback line, and typing clears it", () => {
  act(() =>
    root.render(
      <FormulaEntryPlayer
        title="Q"
        inputMode="text"
        acceptedAnswers={["4"]}
        gradingMode="numeric"
        instantFeedback={false}
      />,
    ),
  );
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "5"); // sai
  const checkButton = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Kiểm tra",
  )!;
  act(() => checkButton.click());
  expect(input.className).toContain("red");
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");

  // Sửa lại → xoá trạng thái sai (và không tô xanh khi chưa Kiểm tra lại).
  typeBlur(input, "4");
  expect(input.className).not.toContain("red");
  expect(input.className).not.toContain("green");
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
});

it("record-only (no accepted answers): hides Kiểm tra and never grades", () => {
  const onAnswerChange = vi.fn();
  const onStatusChange = vi.fn();
  act(() =>
    root.render(
      <FormulaEntryPlayer
        title="Q"
        inputMode="text"
        acceptedAnswers={[]}
        onAnswerChange={onAnswerChange}
        onStatusChange={onStatusChange}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "x+1");
  expect(onAnswerChange).toHaveBeenCalledWith("x+1");
  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  expect(input.className).not.toContain("red");
});
