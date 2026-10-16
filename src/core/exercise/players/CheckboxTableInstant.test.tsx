/**
 * Instant per-element grading for CheckboxTablePlayer: each checkbox CELL is
 * one element; toggling it grades its tick-state vs the expected state right
 * away — no need to wait for "Kiểm tra".
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CheckboxTablePlayer } from "./CheckboxTablePlayer";

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

const columns = [
  { id: "c1", label: "Chẵn" },
  { id: "c2", label: "Lẻ" },
];
const rows = [
  { id: "r1", label: "2" },
  { id: "r2", label: "3" },
];
// row r1 (số 2) is correctly checked under column c1 (Chẵn).
const correctCells = { r1: ["c1"], r2: ["c2"] };

function checkboxesInRow(rowLabel: string): HTMLButtonElement[] {
  const rowEl = Array.from(container.querySelectorAll("tr")).find((tr) =>
    tr.textContent?.includes(rowLabel),
  )!;
  return Array.from(rowEl.querySelectorAll("button"));
}

it('emits onElementGraded("incorrect") and turns the checkbox red when a wrong cell is ticked', () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <CheckboxTablePlayer
        title="Q"
        columns={columns}
        rows={rows}
        correctCells={correctCells}
        onElementGraded={onElementGraded}
      />,
    ),
  );
  // Row "2" (r1), column c2 (Lẻ) is the WRONG cell to tick.
  const [, wrongCheckbox] = checkboxesInRow("2");
  act(() => wrongCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(onElementGraded).toHaveBeenCalledWith("r1::c2", "incorrect", undefined);
  expect(wrongCheckbox.className).toMatch(/red/);
});

it("hides Kiểm tra when instant, shows it when instantFeedback=false", () => {
  act(() =>
    root.render(
      <CheckboxTablePlayer title="Q" columns={columns} rows={rows} correctCells={correctCells} />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");

  act(() =>
    root.render(
      <CheckboxTablePlayer
        title="Q"
        columns={columns}
        rows={rows}
        correctCells={correctCells}
        instantFeedback={false}
      />,
    ),
  );
  expect(container.textContent).toContain("Kiểm tra");
});

it("a correctly ticked cell turns green immediately, and unticking it clears the color", () => {
  act(() =>
    root.render(
      <CheckboxTablePlayer title="Q" columns={columns} rows={rows} correctCells={correctCells} />,
    ),
  );
  const [correctCheckbox] = checkboxesInRow("2"); // r1 x c1 — correct
  act(() => correctCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(correctCheckbox.className).toMatch(/green/);

  act(() => correctCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  // Bỏ tích = ô trở lại TRỐNG: không xanh, không đỏ, và aria-pressed=false.
  // Trước đây ô chỉ đổi màu (xanh → đỏ) nên vẫn hiện dấu ✓, nhìn như còn tích.
  expect(correctCheckbox.className).not.toMatch(/red|green/);
  expect(correctCheckbox.getAttribute("aria-pressed")).toBe("false");
});

it("dấu ✓ chỉ hiện ở ô ĐƯỢC tích — ô chưa tích là hộp trống", () => {
  act(() =>
    root.render(
      <CheckboxTablePlayer title="Q" columns={columns} rows={rows} correctCells={correctCells} />,
    ),
  );
  const [a, b] = checkboxesInRow("2");
  // Chưa bấm gì: cả bảng trống, không ô nào in ✓ (skin có thể đặt màu chữ bất
  // kỳ, nên không được dựa vào `text-transparent` để giấu glyph).
  expect(Array.from(container.querySelectorAll("tbody button")).every((el) => !el.textContent?.includes("✓"))).toBe(true);

  act(() => a.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(a.textContent).toContain("✓");
  expect(b.textContent).not.toContain("✓");

  act(() => a.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(a.textContent).not.toContain("✓");
});

it("bỏ tích một ô tích SAI cũng trả ô về trạng thái trống (không còn đỏ)", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <CheckboxTablePlayer
        title="Q"
        columns={columns}
        rows={rows}
        correctCells={correctCells}
        onElementGraded={onElementGraded}
      />,
    ),
  );
  const [, wrongCheckbox] = checkboxesInRow("2"); // r1 x c2 — sai
  act(() => wrongCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(wrongCheckbox.className).toMatch(/red/);

  act(() => wrongCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(wrongCheckbox.className).not.toMatch(/red|green/);
  expect(wrongCheckbox.getAttribute("aria-pressed")).toBe("false");
  // Không phát sinh verdict mới cho lần bỏ tích.
  expect(onElementGraded).toHaveBeenCalledTimes(1);
});

it("button-mode wrong Kiểm tra turns wrongly-ticked cells red + shows the feedback line, without leaking key cells, and clears on retry", () => {
  act(() =>
    root.render(
      <CheckboxTablePlayer
        title="Q"
        columns={columns}
        rows={rows}
        correctCells={correctCells}
        instantFeedback={false}
      />,
    ),
  );
  const [keyCheckbox, wrongCheckbox] = checkboxesInRow("2"); // r1: c1 đúng, c2 sai
  act(() => wrongCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  const checkButton = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Kiểm tra",
  )!;
  act(() => checkButton.click());

  expect(wrongCheckbox.className).toMatch(/red/);
  // Ô đáp án đúng chưa tick KHÔNG được tô xanh — không lộ đáp án khi còn thử lại.
  expect(keyCheckbox.className).not.toMatch(/green/);
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");

  // Đổi lựa chọn → xoá trạng thái sai.
  act(() => wrongCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(wrongCheckbox.className).not.toMatch(/red/);
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
});

it("record-only (no key): hides Kiểm tra, syncs ticks as incomplete, never grades", () => {
  const onAnswerChange = vi.fn();
  const onStatusChange = vi.fn();
  act(() =>
    root.render(
      <CheckboxTablePlayer
        title="Q"
        columns={columns}
        rows={rows}
        correctCells={{}}
        onAnswerChange={onAnswerChange}
        onStatusChange={onStatusChange}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");
  const [firstCheckbox] = checkboxesInRow("2");
  act(() => firstCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(onAnswerChange).toHaveBeenCalledWith({ r1: ["c1"] });
  expect(onStatusChange).toHaveBeenCalledWith("idle");
  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  expect(firstCheckbox.className).not.toMatch(/red|green/);
});
