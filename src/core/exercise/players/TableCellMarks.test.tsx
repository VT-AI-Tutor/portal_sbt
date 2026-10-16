/**
 * issue #670 — ô `cross` (dấu ✗) của table_completion, spec §5.16.3.
 *
 * Sách in hai loại dấu khác nhau ("đã thực hiện được (✓)" / "chưa thực hiện được
 * (✗)"). `cross` giống HỆT `tick` về dữ liệu, đáp án và chấm điểm — chỉ khác dấu
 * vẽ trong ô — nên nội dung cũ không phải migrate.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TableFillPlayer } from "./TableFillPlayer";

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

// ---------------------------------------------------------------------------
// table_completion (TableFillPlayer) — chính là dạng của câu b23_q1 nêu trong
// issue: question_group → bảng có ô `cellType: "tick"`, hai cột "Đã thực hiện
// được (✓)" / "Chưa thực hiện được (✗)". Trước khi sửa, ô tick là checkbox gốc
// của trình duyệt nên LUÔN hiện dấu ✓ ở cả hai cột.
// ---------------------------------------------------------------------------

const b23Table = {
  headers: [
    { id: "quytac", label: "Quy tắc ứng xử trong ăn uống để đảm bảo an toàn" },
    { id: "da", label: "Đã thực hiện được (✓)" },
    { id: "chua", label: "Chưa thực hiện được (✗)" },
  ],
  tickGroups: [["da", "chua"]],
  rows: [
    {
      id: "r1",
      cells: [
        { columnId: "quytac", cellType: "static" as const, text: "Rửa tay sạch bằng xà phòng" },
        { columnId: "da", cellType: "tick" as const },
        { columnId: "chua", cellType: "cross" as const },
      ],
    },
  ],
};

function tickInputs(): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
}
function iconClasses(): string[] {
  return Array.from(container.querySelectorAll("svg")).map((s) => s.getAttribute("class") ?? "");
}

it("table_completion: ô cellType=cross vẽ dấu ×, ô tick vẫn dấu ✓ (ca b23_q1)", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={b23Table} selfAssessment />));
  const marks = iconClasses();
  expect(marks.some((c) => /lucide-check/.test(c))).toBe(true);
  expect(marks.some((c) => /lucide-x/.test(c))).toBe(true);
});

it("table_completion: cross vẫn là <input type=checkbox> thật — trạng thái + đáp án không đổi", () => {
  const onAnswerChange = vi.fn();
  act(() =>
    root.render(
      <TableFillPlayer title="Q" table={b23Table} selfAssessment onAnswerChange={onAnswerChange} />,
    ),
  );
  const inputs = tickInputs();
  expect(inputs).toHaveLength(2);
  act(() => inputs[1].click());
  expect(inputs[1].checked).toBe(true);
  expect(onAnswerChange).toHaveBeenCalled();
});

it("table_completion: cross tham gia tickGroups — tick ô kia tự bỏ tick ô này", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={b23Table} selfAssessment />));
  const [da, chua] = tickInputs();
  act(() => chua.click());
  expect(chua.checked).toBe(true);
  act(() => da.click());
  expect(da.checked).toBe(true);
  expect(chua.checked).toBe(false);
});

it("table_completion: cross CHẤM ĐƯỢC như tick qua correctAnswer[rowId__colId]", () => {
  const graded = {
    ...b23Table,
    rows: [
      {
        id: "r1",
        cells: [
          { columnId: "quytac", cellType: "static" as const, text: "Rửa tay" },
          { columnId: "da", cellType: "tick" as const, acceptedAnswers: ["false"] },
          { columnId: "chua", cellType: "cross" as const, acceptedAnswers: ["true"] },
        ],
      },
    ],
  };
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <TableFillPlayer title="Q" table={graded} onElementGraded={onElementGraded} />,
    ),
  );
  const [, chua] = tickInputs();
  act(() => chua.click());
  expect(onElementGraded).toHaveBeenCalledWith("r1__chua", "correct", undefined);
});

it("table_completion: bảng KHÔNG có cross giữ nguyên checkbox gốc (câu cũ không đổi hình thức)", () => {
  const plain = {
    headers: [
      { id: "quytac", label: "Quy tắc" },
      { id: "da", label: "Đã làm" },
    ],
    rows: [
      {
        id: "r1",
        cells: [
          { columnId: "quytac", cellType: "static" as const, text: "Rửa tay" },
          { columnId: "da", cellType: "tick" as const },
        ],
      },
    ],
  };
  act(() => root.render(<TableFillPlayer title="Q" table={plain} selfAssessment />));
  expect(iconClasses().some((c) => /lucide-check|lucide-x/.test(c))).toBe(false);
  expect(tickInputs()[0].className).toContain("accent-orange-500");
});
