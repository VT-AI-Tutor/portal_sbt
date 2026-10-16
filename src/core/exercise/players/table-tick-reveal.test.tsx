/**
 * web-own (SBT-63) — khối "Đáp án đúng" của bảng có ô tick/cross vẽ dấu như bản in:
 * khoá "true" → dấu của chính cellType, khoá "false" → ô trống. Nhãn Đúng/Sai
 * chỉ còn ở aria-label. Đường chấm điểm giữ khoá "true"/"false".
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { TableFillPlayer, type TableFillTableData } from "./TableFillPlayer";

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

// Dáng b19_i1_q1 (VBT Tiếng Việt 4/1, bài 19) — đáp án lấy từ payload thật.
const key: Array<[boolean, boolean]> = [
  [true, false],
  [false, true],
  [false, true],
  [true, false],
];
const bongTable: TableFillTableData = {
  headers: [
    { id: "col_statement", label: "Nhận định" },
    { id: "col_true", label: "Đúng" },
    { id: "col_false", label: "Sai" },
  ],
  tickGroups: [["col_true", "col_false"]],
  rows: key.map(([t, f], i) => ({
    id: `s${i + 1}`,
    cells: [
      { columnId: "col_statement", cellType: "static", text: `Nhận định ${i + 1}` },
      { columnId: "col_true", cellType: "tick", acceptedAnswers: [String(t)] },
      { columnId: "col_false", cellType: "tick", acceptedAnswers: [String(f)] },
    ],
  })),
};

const revealTable = () => container.querySelectorAll("table")[1];
const revealBodyCells = (rowIndex: number) =>
  Array.from(revealTable().querySelectorAll("tbody tr")[rowIndex].querySelectorAll("td"));

it("ô khoá true có dấu ✓, ô khoá false để trống, không in chữ Đúng/Sai", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={bongTable} submitted />));

  key.forEach(([t, f], i) => {
    const [, trueCell, falseCell] = revealBodyCells(i);
    for (const [cell, checked] of [[trueCell, t], [falseCell, f]] as const) {
      expect(cell.textContent).toBe("");
      expect(cell.querySelector(".lucide-check") !== null).toBe(checked);
      expect(cell.querySelector("[role=img]")?.getAttribute("aria-label")).toBe(
        checked ? "Đúng" : "Sai",
      );
    }
  });
});

it("ô cross in dấu ✗, không phải ✓", () => {
  const crossTable: TableFillTableData = {
    headers: [
      { id: "rule", label: "Quy tắc" },
      { id: "done", label: "Đã làm" },
      { id: "notyet", label: "Chưa làm" },
    ],
    rows: [
      {
        id: "r1",
        cells: [
          { columnId: "rule", cellType: "static", text: "Rửa tay" },
          { columnId: "done", cellType: "tick", acceptedAnswers: ["false"] },
          { columnId: "notyet", cellType: "cross", acceptedAnswers: ["true"] },
        ],
      },
    ],
  };
  act(() => root.render(<TableFillPlayer title="Q" table={crossTable} submitted />));

  const [, doneCell, notYetCell] = revealBodyCells(0);
  expect(doneCell.querySelector("svg")).toBeNull();
  expect(notYetCell.querySelector(".lucide-x")).not.toBeNull();
  expect(notYetCell.querySelector(".lucide-check")).toBeNull();
});

it("ô input cùng bảng vẫn in chữ đáp án", () => {
  const mixed: TableFillTableData = {
    headers: [
      { id: "word", label: "Từ" },
      { id: "ok", label: "Viết đúng" },
      { id: "fix", label: "Sửa lại" },
    ],
    rows: [
      {
        id: "r1",
        cells: [
          { columnId: "word", cellType: "static", text: "dành dụm" },
          { columnId: "ok", cellType: "tick", acceptedAnswers: ["true"] },
          { columnId: "fix", cellType: "input", acceptedAnswers: ["dành dụm", "giành dụm"] },
        ],
      },
    ],
  };
  act(() => root.render(<TableFillPlayer title="Q" table={mixed} submitted />));

  const [, tickCell, inputCell] = revealBodyCells(0);
  expect(tickCell.querySelector(".lucide-check")).not.toBeNull();
  expect(inputCell.textContent).toBe("dành dụm / giành dụm");
});

it("chấm điểm không đổi: tích sai cột vẫn bị bắt, tích đúng cột vẫn được nhận", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={bongTable} />));
  const box = (k: string) =>
    container.querySelector<HTMLInputElement>(`input[data-answer-key="${k}"]`)!;

  act(() => box("s1__col_false").click());
  expect(box("s1__col_false").className).toContain("ring-red-400");

  act(() => box("s1__col_true").click());
  expect(box("s1__col_true").className).toContain("ring-green-400");
});
