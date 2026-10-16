/**
 * Regression — khối "Đáp án đúng" (CorrectAnswerReveal) của PlayerShell phải
 * tôn trọng `revealCorrect` của GradeModeContext.
 *
 * Bug QA 31/7: bấm Kiểm tra và sai → màn học sinh hiện khối xanh liệt kê TOÀN
 * BỘ đáp án kèm banner "Chưa đúng 😅", phá nguyên tắc hide-correct (chấm sai
 * không được lộ đáp án, retry còn ý nghĩa). Nguyên nhân: PlayerShell chỉ gate
 * theo `submitted`, không đọc `revealCorrect` — trong khi mọi player choice đã
 * đọc cờ này. Web facade QuestionPlayer truyền revealCorrect=false nên fix ở
 * shell tắt khối cho toàn surface học sinh; studio/QA (undefined) giữ nguyên.
 *
 * Việc 3 cùng đợt: reveal của TableFillPlayer in `true`/`false` thô cho ô
 * tick/cross ("Dòng 1 - Nên: true") — phải đọc thành Đúng/Sai.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GradeModeContext, PlayerShell, type GradeModeValue } from "./shared";
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

const renderShell = (grade: GradeModeValue) =>
  act(() =>
    root.render(
      <GradeModeContext.Provider value={grade}>
        <PlayerShell title="Q" submitted answerReveal={"Dòng 1 - Nên: Đúng"}>
          <div>body</div>
        </PlayerShell>
      </GradeModeContext.Provider>,
    ),
  );

describe("PlayerShell — khối Đáp án đúng theo revealCorrect", () => {
  it("revealCorrect=false + submitted + chấm sai → KHÔNG lộ đáp án", () => {
    renderShell({ mode: "parent", result: "incorrect", revealCorrect: false });
    expect(container.textContent).not.toContain("Đáp án đúng");
    expect(container.textContent).not.toContain("Dòng 1 - Nên");
    // Banner verdict vẫn còn — chỉ khối đáp án bị tắt.
    expect(container.textContent).toContain("Chưa đúng");
  });

  it("revealCorrect undefined (studio/QA) → vẫn hiện khối Đáp án đúng", () => {
    renderShell({ mode: "parent", result: "incorrect" });
    expect(container.textContent).toContain("Đáp án đúng");
    expect(container.textContent).toContain("Dòng 1 - Nên");
  });
});

describe("TableFillPlayer — reveal của ô tick/cross đọc được", () => {
  const table: TableFillTableData = {
    headers: [
      { id: "act", label: "Việc" },
      { id: "yes", label: "Nên" },
      { id: "no", label: "Không nên" },
    ],
    rows: [
      {
        id: "r1",
        cells: [
          { columnId: "act", cellType: "static", text: "Rửa tay" },
          { columnId: "yes", cellType: "tick", acceptedAnswers: ["true"] },
          { columnId: "no", cellType: "cross", acceptedAnswers: ["false"] },
        ],
      },
    ],
  };

  it('nhãn "Đúng"/"Sai" (aria-label) thay vì true/false thô', () => {
    act(() =>
      root.render(<TableFillPlayer title="Q" table={table} submitted instantFeedback={false} />),
    );
    const text = container.textContent ?? "";
    // web-own (SBT-63): ô tick in dấu, nhãn chữ chỉ còn cho trình đọc màn hình.
    const labels = Array.from(
      container.querySelectorAll("table")[1].querySelectorAll("[role=img]"),
    ).map((el) => el.getAttribute("aria-label"));
    expect(labels).toEqual(["Đúng", "Sai"]);
    expect(text).not.toContain("true");
    expect(text).not.toContain("false");
    expect(text).not.toContain("Dòng 1");
    expect(text).not.toContain("Nên:");
    expect(text).not.toContain("Không nên:");
    expect(text).not.toContain(": true");
    expect(text).not.toContain(": false");
  });

  it("ô nhập chữ giữ nguyên đáp án gốc", () => {
    const textTable: TableFillTableData = {
      headers: [{ id: "answer", label: "Trả lời" }],
      rows: [
        {
          id: "r1",
          cells: [{ columnId: "answer", cellType: "input", acceptedAnswers: ["Hà Nội"] }],
        },
      ],
    };
    act(() =>
      root.render(
        <TableFillPlayer title="Q" table={textTable} submitted instantFeedback={false} />,
      ),
    );
    // Khối đáp án dựng lại bảng của đề, nên ô đáp án nằm trong `<table>` thứ hai
    // chứ không còn là một chuỗi trơ nối sau chữ "Đáp án đúng".
    const revealTable = container.querySelectorAll("table")[1];
    expect(revealTable.textContent).toContain("Hà Nội");
    expect(container.textContent).not.toContain("Dòng 1");
    expect(container.textContent).not.toContain("Trả lời:");
  });
});
