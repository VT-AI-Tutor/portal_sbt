/**
 * Regression — 2 click LIỀN TAY trên 2 ô khác nhau không được nuốt click thứ nhất.
 *
 * Root cause (bug QA 31/7 trên bảng Đ/S): handler tính
 * `const next = { ...values, [id]: val }` từ closure `values` của RENDER hiện
 * tại. Hai click rơi vào cùng một task (React 18 concurrent root flush sync-lane
 * qua microtask → chưa re-render giữa 2 click) thì click 2 spread từ state CŨ
 * và ghi đè mất click 1 — lost update kinh điển.
 *
 * Test mô phỏng đúng race đó: dispatch 2 click trong CÙNG một act() (không flush
 * giữa chừng). Đáp án emit cuối cùng phải chứa CẢ HAI ô.
 *
 * Fix chuẩn (pattern CrosswordPlayer.setCell): đọc từ `valuesRef.current` và
 * ghi ref đồng bộ ngay khi set — mọi player record dạng click đều phải theo.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrueFalseTablePlayer } from "./TrueFalseTablePlayer";
import { CheckboxTablePlayer } from "./CheckboxTablePlayer";
import { TableFillPlayer, type TableFillTableData } from "./TableFillPlayer";
import { SemanticDifferentialPlayer } from "./SemanticDifferentialPlayer";

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

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

/** Đáp án emit CUỐI CÙNG lên cha — thứ autosave/chấm sẽ dùng. */
const lastAnswer = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;

describe("rapid double click — record players must not lose the first click", () => {
  it("TrueFalseTablePlayer: Đ ở dòng 1 rồi S ở dòng 2 liền tay → giữ cả hai", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <TrueFalseTablePlayer
          title="Q"
          statements={[
            { id: "s1", text: "A", correct: true },
            { id: "s2", text: "B", correct: false },
          ]}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    const dOfRow1 = rows[0].querySelectorAll("button")[0]; // Đ
    const sOfRow2 = rows[1].querySelectorAll("button")[1]; // S
    // 2 click trong CÙNG một act — không cho React flush giữa 2 click.
    act(() => {
      click(dOfRow1);
      click(sOfRow2);
    });
    expect(lastAnswer(onAnswerChange)).toEqual({ s1: true, s2: false });
  });

  it("CheckboxTablePlayer: tích 2 ô ở 2 dòng liền tay → giữ cả hai", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <CheckboxTablePlayer
          title="Q"
          columns={[
            { id: "c1", label: "Chẵn" },
            { id: "c2", label: "Lẻ" },
          ]}
          rows={[
            { id: "r1", label: "2" },
            { id: "r2", label: "3" },
          ]}
          correctCells={{ r1: ["c1"], r2: ["c2"] }}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    const r1c1 = rows[0].querySelectorAll("button")[0];
    const r2c2 = rows[1].querySelectorAll("button")[1];
    act(() => {
      click(r1c1);
      click(r2c2);
    });
    expect(lastAnswer(onAnswerChange)).toEqual({ r1: ["c1"], r2: ["c2"] });
  });

  it("TableFillPlayer: tích 2 ô tick ở 2 dòng liền tay → giữ cả hai", () => {
    const onAnswerChange = vi.fn();
    const table: TableFillTableData = {
      headers: [
        { id: "name", label: "Tên" },
        { id: "mark", label: "Chọn" },
      ],
      rows: [
        {
          id: "r1",
          cells: [
            { columnId: "name", cellType: "static", text: "Một" },
            { columnId: "mark", cellType: "tick", acceptedAnswers: ["true"] },
          ],
        },
        {
          id: "r2",
          cells: [
            { columnId: "name", cellType: "static", text: "Hai" },
            { columnId: "mark", cellType: "tick", acceptedAnswers: ["true"] },
          ],
        },
      ],
    };
    act(() =>
      root.render(
        <TableFillPlayer title="Q" table={table} onAnswerChange={onAnswerChange} />,
      ),
    );
    const boxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(boxes).toHaveLength(2);
    // 2 lần tích trong cùng một act — React chưa flush giữa 2 sự kiện.
    act(() => {
      boxes[0].click();
      boxes[1].click();
    });
    expect(lastAnswer(onAnswerChange)).toEqual({
      r1__mark: "true",
      r2__mark: "true",
    });
  });

  it("SemanticDifferentialPlayer: chấm điểm 2 cặp liền tay → giữ cả hai", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <SemanticDifferentialPlayer
          title="Q"
          pairs={[
            { id: "p1", leftLabel: "Chậm", rightLabel: "Nhanh", points: 5 },
            { id: "p2", leftLabel: "Cũ", rightLabel: "Mới", points: 5 },
          ]}
          correctValues={{ p1: 5, p2: 1 }}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );
    const dot = (label: string) =>
      container.querySelector(`button[aria-label="${label}"]`)!;
    act(() => {
      click(dot("Chậm–Nhanh: 5/5")); // p1 → điểm 5
      click(dot("Cũ–Mới: 1/5")); // p2 → điểm 1
    });
    expect(lastAnswer(onAnswerChange)).toEqual({ p1: 5, p2: 1 });
  });
});
