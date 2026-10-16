import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NumericEntryPlayer } from "./NumericEntryPlayer";
import { typeBlur } from "./instant-test-utils";

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
      <NumericEntryPlayer title="Q" correctAnswer={42} onElementGraded={onElementGraded} />,
    ),
  );
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "42");
  expect(onElementGraded).toHaveBeenCalledWith("answer", "correct", undefined);
  expect(input.className).toContain("green");
});

it("hides the Kiểm tra button when instant (default) and shows it when instantFeedback=false", () => {
  act(() => root.render(<NumericEntryPlayer title="Q" correctAnswer={42} />));
  expect(container.textContent).not.toContain("Kiểm tra");

  act(() =>
    root.render(<NumericEntryPlayer title="Q" correctAnswer={42} instantFeedback={false} />),
  );
  expect(container.textContent).toContain("Kiểm tra");
});

it("marks a wrong answer red but leaves it editable, then re-grades to correct", () => {
  act(() => root.render(<NumericEntryPlayer title="Q" correctAnswer={42} />));
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "10");
  expect(input.className).toContain("red");
  expect(input.disabled).toBe(false);
  typeBlur(input, "42");
  expect(input.className).toContain("green");
});

it("button-mode wrong Kiểm tra turns the field red + shows the feedback line, and typing clears it without leaking", () => {
  act(() => root.render(<NumericEntryPlayer title="Q" correctAnswer={42} instantFeedback={false} />));
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "10"); // sai
  const checkButton = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Kiểm tra",
  )!;
  act(() => checkButton.click());
  expect(input.className).toContain("red");
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");

  // Gõ lại giá trị đúng: trạng thái sai được xoá và KHÔNG tô xanh
  // (không được lộ đáp án qua so khớp "sống" khi chưa Kiểm tra lại).
  typeBlur(input, "42");
  expect(input.className).not.toContain("red");
  expect(input.className).not.toContain("green");
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
});

it("record-only (no correct answer): hides Kiểm tra and reports incomplete on blur, never grading", () => {
  const onAnswerChange = vi.fn();
  const onStatusChange = vi.fn();
  act(() =>
    root.render(
      <NumericEntryPlayer
        title="Q"
        correctAnswer={null as unknown as number}
        onAnswerChange={onAnswerChange}
        onStatusChange={onStatusChange}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "7");
  expect(onAnswerChange).toHaveBeenCalledWith(7);
  expect(onStatusChange).toHaveBeenCalledWith("idle");
  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  expect(input.className).not.toContain("red");
});
