/**
 * Instant per-element grading for CrosswordPlayer: each WHITE CELL is one
 * element; blurring a filled cell grades it immediately — no "Kiểm tra"
 * button needed while instant is active, and a wrong cell stays editable.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CrosswordPlayer, type CrosswordEntry } from "./CrosswordPlayer";
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

const size = { rows: 3, cols: 3 };
const entries: CrosswordEntry[] = [
  { id: "e1", row: 0, col: 0, dir: "across", answer: "CAT", clue: "Mèo" },
];

function cellInput(r: number, c: number) {
  // Cells render in row-major order; only white cells get an <input>.
  const inputs = Array.from(container.querySelectorAll("input"));
  return inputs[r * size.cols + c] as HTMLInputElement | undefined;
}

it("blurring a wrong letter emits onElementGraded incorrect and stays editable", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <CrosswordPlayer
        title="Q"
        size={size}
        entries={entries}
        onElementGraded={onElementGraded}
      />,
    ),
  );
  const first = cellInput(0, 0)!;
  typeBlur(first, "X"); // expected "C"
  expect(onElementGraded).toHaveBeenCalledWith("0-0", "incorrect", undefined);
  expect(first.className).toContain("red");
  expect(first.disabled).toBe(false);
});

it("blurring a correct letter emits correct, and clearing it goes back to idle", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <CrosswordPlayer
        title="Q"
        size={size}
        entries={entries}
        onElementGraded={onElementGraded}
      />,
    ),
  );
  const first = cellInput(0, 0)!;
  typeBlur(first, "C");
  expect(onElementGraded).toHaveBeenLastCalledWith("0-0", "correct", undefined);
  expect(first.className).toContain("green");

  typeBlur(first, "");
  expect(first.className).not.toContain("green");
  expect(first.className).not.toContain("red");
});

it("hides Kiểm tra when instant, shows it when instantFeedback=false", () => {
  act(() =>
    root.render(<CrosswordPlayer title="Q" size={size} entries={entries} />),
  );
  expect(container.textContent).not.toContain("Kiểm tra");

  act(() =>
    root.render(
      <CrosswordPlayer
        title="Q"
        size={size}
        entries={entries}
        instantFeedback={false}
      />,
    ),
  );
  expect(container.textContent).toContain("Kiểm tra");
});
