import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TableFillPlayer,
  type TableFillTableData,
} from "./TableFillPlayer";
import { FieldResizeContext } from "@/core/exercise/field-resize-context";
import { SkinProvider, studioSkin } from "@/core/exercise/skin";
import { typeBlur } from "./instant-test-utils";
import { renderInteractionPlayer } from "./dispatch";

let container: HTMLDivElement;
let root: Root;

const inputTable: TableFillTableData = {
  headers: [{ id: "answer", label: "Trả lời" }],
  rows: [
    {
      id: "row-1",
      cells: [{ columnId: "answer", cellType: "input" }],
    },
  ],
};

const sizedTable: TableFillTableData = {
  headers: [
    { id: "answer", label: "Trả lời" },
    { id: "note", label: "Ghi chú" },
    { id: "label", label: "Nhãn" },
    { id: "mark", label: "Chọn" },
  ],
  rows: [{
    id: "row_1",
    cells: [
      { columnId: "answer", cellType: "input", width: "8.5rem", height: "4rem" },
      { columnId: "note", cellType: "essay", width: "20rem", height: "10rem", rowLines: 4 },
      { columnId: "label", cellType: "static", text: "Tĩnh", width: "9rem", height: "8rem" },
      { columnId: "mark", cellType: "tick", width: "9rem", height: "8rem" },
    ],
  }],
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("TableFillPlayer", () => {
  it("renders validated input/essay dimensions while retaining horizontal scrolling", () => {
    act(() => root.render(<TableFillPlayer title="Điền bảng" table={sizedTable} />));

    const fields = container.querySelectorAll<HTMLElement>("[data-table-field-width]");
    expect(fields).toHaveLength(2);
    // Ô GÕ MỘT DÒNG trên surface học sinh (skin mặc định của context là
    // playful): bề rộng tác giả khai thành SÀN, vì ô nay nở ngang theo chữ —
    // giữ nó làm trần thì gõ quá 8.5rem là chữ khuất trong hộp. Trình soạn vẫn
    // khoá đúng con số đó; xem ca studio ngay dưới.
    expect(fields[0].style.width).toBe("");
    expect(fields[0].style.minWidth).toBe("8.5rem");
    // Ô essay không đi đường đó: nó xuống dòng + cao dần nên bề rộng khai vẫn
    // là bề rộng thật, không giấu chữ nào.
    expect(fields[1].style.width).toBe("20rem");
    expect(fields[0].style.height).toBe("4rem");
    expect(fields[1].style.height).toBe("10rem");
    // Ô essay LUÔN khởi đầu 1 dòng rồi tự giãn theo nội dung — `rowLines` của
    // tác giả (ở đây 4) không còn quyết định chiều cao lúc trống (Owner 9/8).
    expect(container.querySelector("textarea")?.rows).toBe(1);
    expect(container.querySelector("[data-table-scroll-container]")?.className).toContain("overflow-x-auto");
    expect(container.querySelector("table")?.className).toContain("min-w-[36rem]");
    expect(container.querySelectorAll("[data-resize-handle]")).toHaveLength(0);
  });

  /**
   * Ca thật: TV4 bài 10 — "khi HS điền dài, các ô trong bảng lệch rất xấu".
   * Ô cũ là `<input>` bề rộng cứng nên chữ dài hơn hộp thì cuộn ngang bên
   * trong và phần vượt biến mất.
   *
   * Cơ chế `AutoGrowInput` với `wrapperClassName` riêng: sàn là bề rộng CỘT
   * (`min-w-full`), không trần — max-content chảy lên `<td>` nên cả cột nở và
   * mọi ô trong cột nở theo nhau. Vẫn là `<input>` nên không có `\n` lọt vào
   * đáp án.
   */
  describe("ô một dòng nở ngang theo chữ (AutoGrowInput)", () => {
    const mirror = () =>
      container.querySelector<HTMLElement>("span[aria-hidden='true'].invisible");

    it("bản sao đo chạy theo chữ đang gõ, sàn là bề rộng cột, không có trần", () => {
      act(() => root.render(<TableFillPlayer title="Điền bảng" table={inputTable} />));
      const el = container.querySelector("input")!;
      changeInput(el, "hai mươi nghìn không trăm bảy mươi ba");

      // Bản sao đứng yên = ô không bao giờ rộng ra.
      expect(mirror()?.textContent).toContain("hai mươi nghìn không trăm bảy mươi ba");
      expect(mirror()?.className).toContain("whitespace-pre");
      // `w-full` của `inputBase` phải bị đè, nếu không bản sao rộng 100% rãnh
      // và thôi đo.
      expect(mirror()?.style.width).toBe("auto");

      const box = mirror()!.parentElement!;
      expect(box.className).toContain("min-w-full");
      // `w-max` mang toàn bộ cơ chế và gỡ nó đi thì không test nào khác kêu:
      // đo bản nháp thiếu nó trên P45, gõ 72 ký tự thì ô đứng im 489px và giấu
      // 219px chữ — đúng lỗi đang sửa, mà cả bộ test vẫn xanh.
      expect(box.className).toContain("w-max");
      // Trần = chỗ chữ bị giấu. Không được có trần nào, kể cả `max-w-full` của
      // ô điền trong dòng chữ (ở đó trần là bề rộng dòng và ô xuống dòng được;
      // trong ô bảng thì không).
      expect(box.className).not.toContain("max-w-full");
      expect(box.style.maxWidth).toBe("");
      // Ô nhập bám rãnh grid chứ không tự đặt bề rộng; `size=1` để ô TRỐNG
      // không phình quá sàn (xem AutoGrowInput).
      expect(el.className).toContain("w-full");
      expect(el.size).toBe(1);
    });

    it("vẫn là <input>: Enter không thành ký tự xuống dòng, chuỗi emit không đổi", () => {
      const seen: unknown[] = [];
      act(() =>
        root.render(
          <TableFillPlayer
            title="Điền bảng"
            table={inputTable}
            onAnswerChange={(a) => seen.push(a)}
          />,
        ),
      );
      const el = container.querySelector("input")!;
      expect(el.tagName).toBe("INPUT");
      expect(container.querySelector("textarea")).toBeNull();
      changeInput(el, "hà nội");
      expect(seen.at(-1)).toEqual({ "row-1__answer": "hà nội" });
    });

    /**
     * Cái giá của "nở ngang" trong một bảng rộng cố định: cột nhập nở ra là lấy
     * chỗ của cột bên cạnh, và trình duyệt vặt cột chữ tới min-content (một từ)
     * TRƯỚC khi chịu cho bảng vượt khung. Đo trên /dev/players P45: cột "Quốc
     * gia" tụt 270px → 76px, "Việt Nam" gãy hai dòng. Sàn chặn đúng chỗ đó.
     */
    const staticCellOf = (text: string) =>
      [...container.querySelectorAll("tbody td")].find((td) =>
        td.textContent?.includes(text),
      );

    it("cột chữ bên cạnh có SÀN nên không bị vặt còn một từ", () => {
      act(() => root.render(<TableFillPlayer title="Điền bảng" table={sizedTable} />));
      expect(staticCellOf("Tĩnh")?.className).toContain("min-w-[7.5rem]");
    });

    it("bảng KHÔNG có ô nở ngang giữ nguyên bố cục cũ — không sàn", () => {
      // Ô essay xuống dòng + cao dần, không kéo cột nào rộng ra, nên cột chữ
      // cạnh nó không cần được bảo vệ.
      const essayOnly: TableFillTableData = {
        headers: [
          { id: "label", label: "Nhãn" },
          { id: "note", label: "Ghi chú" },
        ],
        rows: [
          {
            id: "row_1",
            cells: [
              { columnId: "label", cellType: "static", text: "Tĩnh" },
              { columnId: "note", cellType: "essay" },
            ],
          },
        ],
      };
      act(() => root.render(<TableFillPlayer title="Điền bảng" table={essayOnly} />));
      expect(staticCellOf("Tĩnh")?.className).not.toContain("min-w-");
    });

    it("trình soạn giữ HỘP KHOÁ: đúng con số tác giả đặt, không nở", () => {
      // Ca 2 của `blankBoxStyle`, áp cho ô bảng: người soạn phải thấy đúng bề
      // rộng mình đặt, và tay kéo `ResizeHandle` đo trên chính hộp đó.
      act(() =>
        root.render(
          <SkinProvider skin={studioSkin}>
            <TableFillPlayer title="Điền bảng" table={sizedTable} />
          </SkinProvider>,
        ),
      );
      const field = container.querySelector<HTMLElement>("[data-table-field-width]")!;
      expect(field.style.width).toBe("8.5rem");
      expect(field.style.minWidth).toBe("");
      expect(mirror()).toBeNull();
      // Không nở thì cũng không có gì để bảo vệ: cột chữ giữ nguyên như cũ.
      expect(staticCellOf("Tĩnh")?.className).not.toContain("min-w-");
    });
  });

  /**
   * Ô tự luận trong bảng: khởi đầu MỘT dòng, tự giãn theo nội dung, và có sàn
   * bề rộng (Owner 9/8). Đo trên `32069345/bai2` câu 5: cột "Lí do" tự co còn
   * 168px nên ô nhập chỉ 135px (~15 ký tự một dòng).
   */
  describe("ô essay: một dòng + tự giãn + sàn bề rộng", () => {
    const essayTable: TableFillTableData = {
      headers: [{ id: "lido", label: "Lí do" }],
      rows: [{ id: "r1", cells: [{ columnId: "lido", cellType: "essay", rowLines: 5 }] }],
    };

    it("bỏ qua rowLines tác giả khai — luôn khởi đầu 1 dòng", () => {
      act(() => root.render(<TableFillPlayer title="Bảng" table={essayTable} />));
      expect(container.querySelector("textarea")?.rows).toBe(1);
    });

    it("ô KHÔNG khai width nhận sàn bề rộng; ô có khai thì giữ nguyên", () => {
      act(() => root.render(<TableFillPlayer title="Bảng" table={essayTable} />));
      expect(container.querySelector<HTMLElement>("[data-table-field-width]")?.style.minWidth).toBe(
        "14rem",
      );
      // `sizedTable` khai width 20rem cho ô essay → tôn trọng, không áp sàn.
      act(() => root.render(<TableFillPlayer title="Bảng" table={sizedTable} />));
      const fields = container.querySelectorAll<HTMLElement>("[data-table-field-width]");
      expect(fields[1].style.width).toBe("20rem");
      expect(fields[1].style.minWidth).toBe("");
    });

    it("tự giãn: chiều cao đặt theo nội dung, và ô khai height thì KHÔNG đụng", () => {
      // jsdom không layout nên `scrollHeight` là 0 — kiểm ĐÚNG CƠ CHẾ: ô tự giãn
      // có style.height do JS đặt và lớp `h-auto` đè `h-full`; ô khai height thì
      // không có cả hai.
      act(() => root.render(<TableFillPlayer title="Bảng" table={essayTable} />));
      const grow = container.querySelector<HTMLTextAreaElement>("textarea")!;
      expect(grow.className).toContain("h-auto");
      expect(grow.style.height).not.toBe("");

      act(() => root.render(<TableFillPlayer title="Bảng" table={sizedTable} />));
      const fixed = container.querySelector<HTMLTextAreaElement>("textarea")!;
      expect(fixed.className).not.toContain("h-auto");
      expect(fixed.style.height).toBe("");
    });
  });

  it("renders stable resize handles only for input/essay cells under edit-preview context", () => {
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          <TableFillPlayer title="Điền bảng" table={sizedTable} />
        </FieldResizeContext.Provider>,
      );
    });

    expect(container.querySelector('[data-resize-handle="row_1__answer"]')).toBeTruthy();
    expect(container.querySelector('[data-resize-handle="row_1__note"]')).toBeTruthy();
    expect(container.querySelector('[data-resize-handle="row_1__label"]')).toBeNull();
    expect(container.querySelector('[data-resize-handle="row_1__mark"]')).toBeNull();
    expect(container.querySelectorAll("[data-resize-handle]")).toHaveLength(2);
  });

  it("emits independent rem width/height patches from the corner handle", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const onGeometry = vi.fn();
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry }}>
          <TableFillPlayer title="Điền bảng" table={sizedTable} />
        </FieldResizeContext.Provider>,
      );
    });

    const field = container.querySelector<HTMLElement>('[data-table-field-width="8.5rem"]')!;
    field.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 136,
      height: 64,
      right: 136,
      bottom: 64,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const handle = container.querySelector<HTMLElement>(
      '[data-resize-handle="row_1__answer"]',
    )!;

    act(() => {
      handle.dispatchEvent(new MouseEvent("pointerdown", {
        bubbles: true,
        clientX: 136,
        clientY: 64,
      }));
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 168, clientY: 64 }));
    });
    expect(onGeometry).toHaveBeenLastCalledWith("row_1__answer", { width: "10.5rem" });

    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 136, clientY: 112 }));
    });
    expect(onGeometry).toHaveBeenLastCalledWith("row_1__answer", { height: "7rem" });

    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
  });

  it("ignores malformed/out-of-range persisted dimensions and keeps default sizing", () => {
    const table: TableFillTableData = {
      headers: [{ id: "bad", label: "Sai" }],
      rows: [{
        id: "r1",
        cells: [{ columnId: "bad", cellType: "input", width: "50%", height: "2rem" }],
      }],
    };
    act(() => root.render(<TableFillPlayer title="Điền bảng" table={table} />));
    const wrapper = container.querySelector<HTMLElement>("[data-table-field-width]");
    expect(wrapper?.dataset.tableFieldWidth).toBe("");
    expect(wrapper?.dataset.tableFieldHeight).toBe("");
    expect(wrapper?.style.width).toBe("");
    expect(wrapper?.style.height).toBe("");
    expect(wrapper?.className).toContain("w-full");
  });

  it("renders interactive tick cells with stable row-column keys in a scrollable table", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <TableFillPlayer
          title="Đánh dấu vị trí"
          table={tickTable}
          selfAssessment
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    const scrollContainer = container.querySelector<HTMLElement>("[data-table-scroll-container]");
    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );

    expect(scrollContainer?.className).toContain("overflow-x-auto");
    expect(container.querySelector("table")?.className).toContain("min-w-[36rem]");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.map((checkbox) => checkbox.dataset.answerKey)).toEqual([
      "row1__safe",
      "row1__unsafe",
    ]);

    act(() => checkboxes[1].click());

    expect(onAnswerChange).toHaveBeenLastCalledWith({
      "row1__safe": "false",
      "row1__unsafe": "true",
    });
    expect(container.textContent).not.toContain("Kiểm tra");
  });

  it.each(["submitted", "disabled"] as const)(
    "keeps a checked answer visible and blocks changes when %s",
    (lockMode) => {
      const onAnswerChange = vi.fn();
      act(() => {
        root.render(
          <TableFillPlayer
            title="Đánh dấu vị trí"
            table={tickTable}
            selfAssessment
            answer={{ "row1__unsafe": true }}
            submitted={lockMode === "submitted"}
            disabled={lockMode === "disabled"}
            onAnswerChange={onAnswerChange}
          />,
        );
      });

      const checkboxes = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      expect(checkboxes[1].checked).toBe(true);
      expect(checkboxes.every((checkbox) => checkbox.disabled)).toBe(true);

      act(() => checkboxes[1].click());
      expect(checkboxes[1].checked).toBe(true);
      expect(onAnswerChange).not.toHaveBeenCalled();
    },
  );

  it("preserves the focused input while a controlled parent records each keystroke", () => {
    function ControlledTable() {
      const [answer, setAnswer] = useState<Record<string, string>>({});
      return (
        <TableFillPlayer
          title="Điền bảng"
          table={inputTable}
          selfAssessment
          answer={answer}
          onAnswerChange={(next) => setAnswer(next as Record<string, string>)}
        />
      );
    }

    act(() => root.render(<ControlledTable />));

    const input = container.querySelector<HTMLInputElement>('input[data-answer-key="row-1__answer"]')!;
    act(() => input.focus());

    changeInput(input, "N");
    expect(document.activeElement).toBe(input);
    expect(container.querySelector('input[data-answer-key="row-1__answer"]')).toBe(input);

    changeInput(input, "Nguyễn Du");
    expect(input.value).toBe("Nguyễn Du");
    expect(document.activeElement).toBe(input);
    expect(container.querySelector('input[data-answer-key="row-1__answer"]')).toBe(input);
  });
const table: TableFillTableData = {
  headers: [
    { id: "col1", label: "Câu hỏi" },
    { id: "col2", label: "Trả lời" },
  ],
  rows: [
    {
      id: "row1",
      cells: [
        { columnId: "col1", cellType: "text", text: "2 + 2" },
        { columnId: "col2", cellType: "input", acceptedAnswers: ["4"] },
      ],
    },
  ],
};

const tickTable: TableFillTableData = {
  headers: [
    { id: "label", label: "Nội dung" },
    { id: "safe", label: "An toàn" },
    { id: "unsafe", label: "Không an toàn" },
  ],
  tickGroups: [["safe", "unsafe"]],
  rows: [
    {
      id: "row1",
      cells: [
        { columnId: "label", cellType: "static", text: "Cổng trường" },
        { columnId: "safe", cellType: "tick" },
        { columnId: "unsafe", cellType: "tick" },
      ],
    },
  ],
};

const gradedTickTable: TableFillTableData = {
  ...tickTable,
  rows: [
    {
      ...tickTable.rows[0],
      cells: [
        { columnId: "label", cellType: "static", text: "Cổng trường" },
        { columnId: "safe", cellType: "tick", acceptedAnswers: ["true"] },
        { columnId: "unsafe", cellType: "tick", acceptedAnswers: ["false"] },
      ],
    },
  ],
};

it("renders tick cells as checkboxes in a horizontally scrollable mixed table", () => {
  const onAnswerChange = vi.fn();
  act(() =>
    root.render(
      <TableFillPlayer
        title="Đánh dấu"
        table={tickTable}
        selfAssessment
        onAnswerChange={onAnswerChange}
      />,
    ),
  );

  const checkboxes = Array.from(
    container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  );
  expect(container.querySelector("[data-table-scroll-container]")?.className).toContain("overflow-x-auto");
  expect(container.querySelector("table")?.className).toContain("min-w-[36rem]");
  expect(checkboxes).toHaveLength(2);

  act(() => checkboxes[0].click());
  expect(checkboxes[0].checked).toBe(true);
  expect(onAnswerChange).toHaveBeenLastCalledWith({
    "row1__safe": "true",
    "row1__unsafe": "false",
  });

  act(() => checkboxes[1].click());
  expect(checkboxes[0].checked).toBe(false);
  expect(checkboxes[1].checked).toBe(true);
});

it("instant-grades a tick and its mutually exclusive peer", () => {
  const onElementGraded = vi.fn();
  const onProgress = vi.fn();
  act(() =>
    root.render(
      <TableFillPlayer
        title="Đánh dấu"
        table={gradedTickTable}
        onElementGraded={onElementGraded}
        onProgress={onProgress}
      />,
    ),
  );

  const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  act(() => checkboxes[0].click());

  expect(onElementGraded).toHaveBeenNthCalledWith(1, "row1__safe", "correct", undefined);
  expect(onElementGraded).toHaveBeenNthCalledWith(2, "row1__unsafe", "correct", undefined);
  expect(onProgress).toHaveBeenLastCalledWith({ correct: 2, wrong: 0, total: 2, done: true });
  expect(checkboxes[0].className).toContain("green");
});

it("grades one cell on blur and emits onElementGraded (instant default)", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <TableFillPlayer title="Q" table={table} onElementGraded={onElementGraded} />,
    ),
  );
  const inputs = container.querySelectorAll("input");
  typeBlur(inputs[0] as HTMLInputElement, "4");
  expect(onElementGraded).toHaveBeenCalledWith("row1__col2", "correct", undefined);
  // ô đúng tô xanh (class chứa green)
  expect((inputs[0] as HTMLInputElement).className).toContain("green");
});

it("hides the Kiểm tra button when instant (default) and shows it when instantFeedback=false", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={table} />));
  expect(container.textContent).not.toContain("Kiểm tra");

  act(() => root.render(<TableFillPlayer title="Q" table={table} instantFeedback={false} />));
  expect(container.textContent).toContain("Kiểm tra");
});

it("marks a wrong cell red but leaves it editable, then re-grades to correct", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={table} />));
  const inputs = container.querySelectorAll("input");
  typeBlur(inputs[0] as HTMLInputElement, "5");
  expect((inputs[0] as HTMLInputElement).className).toContain("red");
  expect((inputs[0] as HTMLInputElement).disabled).toBe(false);
  typeBlur(inputs[0] as HTMLInputElement, "4");
  expect((inputs[0] as HTMLInputElement).className).toContain("green");
});

// Regression: a cell graded correct then cleared back to blank must show idle,
// NOT stale red. `status` stays "success" after the correct grade, so without a
// blank-value guard the fallback would paint the emptied cell red.
it("shows idle (not red) when a graded cell is cleared back to blank", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={table} />));
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "4");
  expect(input.className).toContain("green");
  typeBlur(input, "");
  expect(input.className).not.toContain("red");
  expect(input.className).not.toContain("green");
});

const twoCellTable: TableFillTableData = {
  headers: [
    { id: "c1", label: "A" },
    { id: "c2", label: "B" },
  ],
  rows: [
    {
      id: "r1",
      cells: [
        { columnId: "c1", cellType: "input", acceptedAnswers: ["1"] },
        { columnId: "c2", cellType: "input", acceptedAnswers: ["2"] },
      ],
    },
  ],
};

it("grading one cell does not affect the other cell's state", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <TableFillPlayer title="Q" table={twoCellTable} onElementGraded={onElementGraded} />,
    ),
  );
  const inputs = container.querySelectorAll("input");
  typeBlur(inputs[0] as HTMLInputElement, "1"); // r1__c1 correct
  expect((inputs[0] as HTMLInputElement).className).toContain("green");
  // The other, untouched cell stays idle — no green, no red.
  expect((inputs[1] as HTMLInputElement).className).not.toContain("green");
  expect((inputs[1] as HTMLInputElement).className).not.toContain("red");
  expect(onElementGraded).toHaveBeenCalledTimes(1);
  expect(onElementGraded).toHaveBeenCalledWith("r1__c1", "correct", undefined);
});

it("instantFeedback=false: filling then clicking Kiểm tra grades via the legacy flow", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={table} instantFeedback={false} />));
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "4"); // sets value via onChange; blur is a no-op when instant inactive
  expect(input.className).not.toContain("green"); // no instant reveal
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Kiểm tra"),
  ) as HTMLButtonElement;
  act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(input.className).toContain("green");
});
it("disables the legacy check action again after clearing the only answer", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={table} instantFeedback={false} />));
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "4");
  expect((container.querySelector("button") as HTMLButtonElement).disabled).toBe(false);
  typeBlur(input, "");
  expect((container.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
});

// Issue #575 — spanning caption/2-tier header above the column-name row.
const captionTable: TableFillTableData = {
  caption: "Phân loại động vật theo lớp bao phủ của cơ thể",
  headers: [
    { id: "c1", label: "Nhóm vỏ cứng" },
    { id: "c2", label: "Nhóm có vảy" },
    { id: "c3", label: "Nhóm lông mao" },
  ],
  rows: [
    {
      id: "r1",
      cells: [
        { columnId: "c1", cellType: "input" },
        { columnId: "c2", cellType: "input" },
        { columnId: "c3", cellType: "input" },
      ],
    },
  ],
};

it("renders the table caption as a spanning header row ABOVE the column names (issue #575)", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={captionTable} />));
  const headRows = container.querySelectorAll("thead tr");
  // Two tiers: caption row, then the column-name row.
  expect(headRows).toHaveLength(2);
  const captionCell = headRows[0].querySelector("th") as HTMLTableCellElement;
  expect(captionCell.colSpan).toBe(3);
  expect(captionCell.textContent).toContain("Phân loại động vật");
  // The spanning title is above the 3 column names, which stay one cell each.
  expect(headRows[1].querySelectorAll("th")).toHaveLength(3);
});

it("omits the caption row entirely when no caption is authored", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={table} />));
  // Only the single column-name row — no empty spanning tier.
  expect(container.querySelectorAll("thead tr")).toHaveLength(1);
  expect(container.querySelector("thead th[colspan]")).toBeNull();
});

// Issue #575 — group-header rows must span every column (not render N cells).
const groupHeaderTable: TableFillTableData = {
  headers: [
    { id: "c1", label: "A" },
    { id: "c2", label: "B" },
    { id: "c3", label: "C" },
  ],
  rows: [
    {
      id: "group1",
      isGroupHeader: true,
      cells: [{ columnId: "c1", cellType: "static", text: "Nhóm động vật có vảy" }],
    },
    {
      id: "r1",
      cells: [
        { columnId: "c1", cellType: "input" },
        { columnId: "c2", cellType: "input" },
        { columnId: "c3", cellType: "input" },
      ],
    },
  ],
};

it("renders an isGroupHeader row as one spanning cell, no blank inputs (issue #575)", () => {
  act(() => root.render(<TableFillPlayer title="Q" table={groupHeaderTable} />));
  const bodyRows = container.querySelectorAll("tbody tr");
  expect(bodyRows).toHaveLength(2);
  const groupCells = bodyRows[0].querySelectorAll("td");
  // A single colSpan cell — not one <td> per column.
  expect(groupCells).toHaveLength(1);
  expect((groupCells[0] as HTMLTableCellElement).colSpan).toBe(3);
  expect(groupCells[0].textContent).toContain("Nhóm động vật có vảy");
  // The section title is a label, never an editable field.
  expect(bodyRows[0].querySelectorAll("input, textarea")).toHaveLength(0);
  // The following data row keeps its per-column inputs.
  expect(bodyRows[1].querySelectorAll("input")).toHaveLength(3);
});

// ---------------------------------------------------------------------------
// GAP-229 — bảng v2 (`columns` / `headerRows` / `colSpan` / `rowSpan`).
// Tất cả đi qua `renderInteractionPlayer` để chạy đúng đường thật:
// manifest → dispatch → `resolveTableModel` → lưới chiếm chỗ → trình hiển thị.
// ---------------------------------------------------------------------------

const bodyRowsOf = () => Array.from(container.querySelectorAll("tbody tr"));
const cellsOf = (row: Element) => Array.from(row.querySelectorAll<HTMLTableCellElement>("td"));

/** Bảng v2 đủ món: tiêu đề 2 tầng (có cả `rowSpan` lẫn `colSpan`), width/align
 *  mức cột, và một ô nhập có đáp án. */
const v2Payload = {
  table: {
    columns: [
      { id: "c1", label: "Việc làm", width: "40%", align: "left" },
      { id: "c2", label: "Có", align: "center" },
      { id: "c3", label: "Không", align: "right" },
    ],
    headerRows: [
      {
        id: "h1",
        cells: [
          { columnId: "c1", cellType: "static", text: "Việc làm", rowSpan: 2 },
          { columnId: "c2", cellType: "static", text: "Mức độ", colSpan: 2 },
        ],
      },
      {
        id: "h2",
        cells: [
          { columnId: "c2", cellType: "static", text: "Có" },
          { columnId: "c3", cellType: "static", text: "Không" },
        ],
      },
    ],
    rows: [
      {
        id: "r1",
        cells: [
          { columnId: "c1", cellType: "static", text: "Rửa tay" },
          { columnId: "c2", cellType: "input" },
          { columnId: "c3", cellType: "static", text: "—" },
        ],
      },
    ],
  },
  correctAnswer: { r1__c2: "có" },
};

it("hiển thị trọn vẹn một payload v2 qua dispatch (columns + headerRows nhiều tầng)", () => {
  act(() => root.render(renderInteractionPlayer("table_completion", v2Payload, {})));

  const headRows = container.querySelectorAll("thead tr");
  expect(headRows).toHaveLength(2);

  const tier1 = Array.from(headRows[0].querySelectorAll<HTMLTableCellElement>("th"));
  expect(tier1).toHaveLength(2);
  expect(tier1[0].rowSpan).toBe(2);
  expect(tier1[0].textContent).toContain("Việc làm");
  expect(tier1[1].colSpan).toBe(2);
  expect(tier1[1].textContent).toContain("Mức độ");

  // Tầng 2 chỉ còn 2 cột: cột đầu đã bị `rowSpan` của tầng 1 phủ xuống.
  const tier2 = Array.from(headRows[1].querySelectorAll<HTMLTableCellElement>("th"));
  expect(tier2).toHaveLength(2);
  expect(tier2.map((th) => th.textContent)).toEqual(["Có", "Không"]);
  // Ô đầu tiên của tầng 2 không nằm ở cột 0 → phải tự kẻ bù viền trái.
  expect(tier2[0].className).toContain("border-l-2");

  const body = bodyRowsOf();
  expect(body).toHaveLength(1);
  expect(cellsOf(body[0])).toHaveLength(3);
  expect(container.querySelector('input[data-answer-key="r1__c2"]')).toBeTruthy();
});

it("render RichContent v2 của tiêu đề và ô tĩnh mà không làm phẳng block", () => {
  const payload = {
    table: {
      columns: [{ id: "c1", align: "left" }, { id: "c2" }],
      headerRows: [{
        id: "title",
        cells: [{
          columnId: "c1",
          colSpan: 2,
          cellType: "static",
          content: {
            blocks: [{
              type: "heading",
              level: 2,
              align: "center",
              content: [
                { text: "Tiêu đề ", annotations: { bold: true } },
                { text: "nghiêng", annotations: { italic: true } },
              ],
            }],
          },
        }],
      }],
      rows: [{
        id: "r1",
        cells: [
          {
            columnId: "c1",
            cellType: "static",
            content: {
              blocks: [{
                type: "list",
                ordered: false,
                items: ["Mục một", "Mục hai"],
                itemsRuns: [
                  [{ text: "Mục một", annotations: { bold: true } }],
                  [{ text: "Mục hai", annotations: {} }],
                ],
              }],
            },
          },
          { columnId: "c2", cellType: "static", text: "Cũ" },
        ],
      }],
    },
  };

  act(() => root.render(renderInteractionPlayer("table_completion", payload, {})));

  const heading = container.querySelector<HTMLElement>('[data-content-heading-level="2"]')!;
  expect(heading).toBeTruthy();
  expect(heading.className).toContain("text-center");
  expect(heading.querySelector("strong")?.textContent).toBe("Tiêu đề ");
  expect(heading.querySelector("em")?.textContent).toBe("nghiêng");

  const list = container.querySelector("tbody ul.list-disc")!;
  expect(list.querySelectorAll("li")).toHaveLength(2);
  expect(list.querySelector("strong")?.textContent).toBe("Mục một");
  expect(cellsOf(bodyRowsOf()[0])[1].textContent).toBe("Cũ");
});

// Issue #820 — tiêu đề bảng là nội dung tác giả nhập: player không được tự
// chuẩn hoá kiểu chữ. Trước đây ô `<th>` thường (không phải banner) mang class
// Tailwind `uppercase`, biến `a × b` thành `A × B` ngay trong QA preview.
it("giữ nguyên hoa/thường của tiêu đề bảng (text thuần lẫn RichContent)", () => {
  const payload = {
    table: {
      columns: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
      headerRows: [{
        id: "h1",
        cells: [
          { columnId: "c1", cellType: "static", text: "a × b" },
          { columnId: "c2", cellType: "static", text: "(a × b) × c" },
          {
            columnId: "c3",
            cellType: "static",
            content: {
              blocks: [{
                type: "paragraph",
                content: [{ text: "b × a", annotations: {} }],
              }],
            },
          },
        ],
      }],
      rows: [{
        id: "r1",
        cells: [
          { columnId: "c1", cellType: "input" },
          { columnId: "c2", cellType: "input" },
          { columnId: "c3", cellType: "input" },
        ],
      }],
    },
  };

  act(() => root.render(renderInteractionPlayer("table_completion", payload, {})));

  const headerCells = Array.from(
    container.querySelectorAll<HTMLTableCellElement>("thead th"),
  );
  expect(headerCells).toHaveLength(3);
  expect(headerCells.map((th) => th.textContent)).toEqual(["a × b", "(a × b) × c", "b × a"]);
  // Không còn `text-transform: uppercase` trên chính ô lẫn cây con RichContent.
  for (const th of headerCells) {
    expect(th.className).not.toContain("uppercase");
    for (const node of Array.from(th.querySelectorAll<HTMLElement>("*"))) {
      expect(node.className).not.toContain("uppercase");
    }
  }
});

it("giữ nguyên chữ hoa khi chính tác giả nhập chữ hoa ở tiêu đề bảng", () => {
  const payload = {
    table: {
      columns: [{ id: "c1" }],
      headerRows: [{
        id: "h1",
        cells: [{ columnId: "c1", cellType: "static", text: "TỔNG KẾT" }],
      }],
      rows: [{ id: "r1", cells: [{ columnId: "c1", cellType: "input" }] }],
    },
  };

  act(() => root.render(renderInteractionPlayer("table_completion", payload, {})));

  expect(container.querySelector("thead th")?.textContent).toBe("TỔNG KẾT");
});

it("không vẽ trùng ảnh v2 khi imageUrl được giải từ chính content block", () => {
  const payload = {
    table: {
      columns: [{ id: "c1" }],
      headerRows: [],
      rows: [{
        id: "r1",
        cells: [{
          columnId: "c1",
          cellType: "static",
          content: {
            blocks: [
              { type: "image", url: "/uploads/cell.png", alt: "Ảnh ô" },
              { type: "paragraph", content: [{ text: "Chú thích", annotations: { bold: true } }] },
            ],
          },
        }],
      }],
    },
  };

  act(() => root.render(renderInteractionPlayer("table_completion", payload, {})));

  expect(container.querySelectorAll('img[src*="/uploads/cell.png"]')).toHaveLength(1);
  expect(container.querySelector("tbody strong")?.textContent).toBe("Chú thích");
});

it("đưa width/align mức cột của v2 ra DOM (colgroup + căn lề từng ô)", () => {
  act(() => root.render(renderInteractionPlayer("table_completion", v2Payload, {})));

  const cols = Array.from(container.querySelectorAll<HTMLTableColElement>("colgroup col"));
  expect(cols).toHaveLength(3);
  expect(cols[0].style.width).toBe("40%");
  expect(cols[1].style.width).toBe("");
  expect(cols.map((col) => col.dataset.columnAlign)).toEqual(["left", "center", "right"]);

  // `<colgroup>` không áp được text-align, nên căn lề phải thắng ngay trên ô.
  const cells = cellsOf(bodyRowsOf()[0]);
  expect(cells[0].className).toContain("text-left");
  expect(cells[1].className).toContain("text-center");
  expect(cells[2].className).toContain("text-right");
});

/** Dạng của `b21_q2` (books/43-lich-su-va-dia-li-5/data/bai21.json): một ô nhắc
 *  việc trải hết chiều ngang, rồi một ô NHẬP cũng trải hết chiều ngang và có
 *  đáp án thật. Bảng cũng không có tầng tên cột nào (`headerRows: []`) — dạng
 *  của 186 bảng trong kho. */
const v2ColSpanPayload = {
  table: {
    columns: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
    headerRows: [],
    rows: [
      {
        id: "r_prompt2",
        cells: [{ columnId: "c1", cellType: "static", text: "Ghi lại cảm nghĩ", colSpan: 3 }],
      },
      { id: "r_input2", cells: [{ columnId: "c1", cellType: "input", colSpan: 3 }] },
      {
        id: "r_pair",
        cells: [
          { columnId: "c1", cellType: "static", text: "A", colSpan: 2 },
          { columnId: "c3", cellType: "static", text: "B" },
        ],
      },
    ],
  },
  correctAnswer: { r_input2__c1: "Rất vui" },
};

it("không dựng tầng tên cột khi headerRows rỗng (186 bảng trong kho)", () => {
  act(() => root.render(renderInteractionPlayer("table_completion", v2ColSpanPayload, {})));
  // Không có <thead> rỗng, cũng không có hàng ô trắng lấp chỗ.
  expect(container.querySelector("thead")).toBeNull();
  expect(bodyRowsOf()).toHaveLength(3);
});

it("phát colSpan của ô thân bảng và giữ đúng số ô còn lại của hàng", () => {
  act(() => root.render(renderInteractionPlayer("table_completion", v2ColSpanPayload, {})));
  const body = bodyRowsOf();

  const prompt = cellsOf(body[0]);
  expect(prompt).toHaveLength(1);
  expect(prompt[0].colSpan).toBe(3);
  expect(prompt[0].textContent).toContain("Ghi lại cảm nghĩ");
  expect(body[0].querySelectorAll("input, textarea")).toHaveLength(0);

  const pair = cellsOf(body[2]);
  expect(pair.map((td) => td.colSpan)).toEqual([2, 1]);
  expect(pair.map((td) => td.textContent)).toEqual(["A", "B"]);
});

it("một ô GỘP vẫn có thể là ô nhập và vẫn chấm được (ca b21_q2)", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(renderInteractionPlayer("table_completion", v2ColSpanPayload, { onElementGraded })),
  );

  const cells = cellsOf(bodyRowsOf()[1]);
  expect(cells).toHaveLength(1);
  expect(cells[0].colSpan).toBe(3);

  const input = container.querySelector<HTMLInputElement>('input[data-answer-key="r_input2__c1"]')!;
  expect(input).toBeTruthy();
  typeBlur(input, "rất vui"); // chấm không phân biệt hoa/thường
  expect(onElementGraded).toHaveBeenCalledWith("r_input2__c1", "correct", undefined);
  expect(input.className).toContain("green");
});

/** Dạng của `b18_i3_q1` (books/30-tieng-viet-5/data/bai18.json): "Triển khai"
 *  gộp dọc 3 hàng thân bảng — các hàng sau bỏ hẳn ô ở cột đó. */
const v2RowSpanPayload = {
  table: {
    columns: [{ id: "phan" }, { id: "y" }, { id: "ghi" }],
    headerRows: [],
    rows: [
      {
        id: "trienkhai1",
        cells: [
          { columnId: "phan", cellType: "static", text: "Triển khai", rowSpan: 3 },
          { columnId: "y", cellType: "static", text: "Ý 1" },
          { columnId: "ghi", cellType: "static", text: "G1" },
        ],
      },
      {
        id: "trienkhai2",
        cells: [
          { columnId: "y", cellType: "static", text: "Ý 2" },
          { columnId: "ghi", cellType: "static", text: "G2" },
        ],
      },
      {
        id: "trienkhai3",
        cells: [
          { columnId: "y", cellType: "static", text: "Ý 3" },
          { columnId: "ghi", cellType: "static", text: "G3" },
        ],
      },
    ],
  },
};

it("mang rowSpan xuống các hàng dưới, mỗi hàng chỉ phát ô của chính nó", () => {
  act(() => root.render(renderInteractionPlayer("table_completion", v2RowSpanPayload, {})));
  const body = bodyRowsOf();
  expect(body).toHaveLength(3);

  const first = cellsOf(body[0]);
  expect(first).toHaveLength(3);
  expect(first[0].rowSpan).toBe(3);
  expect(first[0].textContent).toContain("Triển khai");

  // Hai hàng sau chỉ có 2 ô — cột "phan" đã bị ô trên phủ, KHÔNG được bù ô rỗng.
  expect(cellsOf(body[1]).map((td) => td.textContent)).toEqual(["Ý 2", "G2"]);
  expect(cellsOf(body[2]).map((td) => td.textContent)).toEqual(["Ý 3", "G3"]);
  // Nhãn gộp chỉ xuất hiện đúng một lần trong cả bảng.
  expect(container.querySelectorAll("tbody td")).toHaveLength(7);
  // Ô đầu của hàng bị phủ nằm ở cột 1 → tự kẻ bù viền trái.
  expect(cellsOf(body[1])[0].className).toContain("border-l-2");
});

it("phát một ô vừa colSpan vừa rowSpan", () => {
  const payload = {
    table: {
      columns: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
      headerRows: [],
      rows: [
        {
          id: "r1",
          cells: [
            { columnId: "c1", cellType: "static", text: "Gộp", colSpan: 2, rowSpan: 2 },
            { columnId: "c3", cellType: "static", text: "A3" },
          ],
        },
        { id: "r2", cells: [{ columnId: "c3", cellType: "static", text: "B3" }] },
      ],
    },
  };
  act(() => root.render(renderInteractionPlayer("table_completion", payload, {})));

  const body = bodyRowsOf();
  const merged = cellsOf(body[0])[0];
  expect(merged.colSpan).toBe(2);
  expect(merged.rowSpan).toBe(2);
  expect(cellsOf(body[0])).toHaveLength(2);
  // Hàng 2 chỉ còn cột cuối; một ô đơn lẻ KHÔNG bị nhầm thành hàng tiêu đề nhóm.
  const second = cellsOf(body[1]);
  expect(second).toHaveLength(1);
  expect(second[0].colSpan).toBe(1);
  expect(second[0].textContent).toBe("B3");
});

// ---------------------------------------------------------------------------
// v1 vẫn phải hiển thị y hệt — 47 câu hỏi đang chạy có hàng thiếu ô, và 91 trong
// 125 hàng đó thiếu ô ở CỘT ĐẦU. Bù nhầm (theo số lượng thay vì theo `columnId`)
// sẽ đẩy toàn bộ ô của hàng lệch sang trái một cột.
// ---------------------------------------------------------------------------

const v1ShortFrontTable: TableFillTableData = {
  headers: [
    { id: "vd", label: "Ví dụ" },
    { id: "cau", label: "Câu" },
    { id: "tl", label: "Trả lời" },
  ],
  rows: [
    {
      id: "r0",
      cells: [
        { columnId: "vd", cellType: "static", text: "M" },
        { columnId: "cau", cellType: "static", text: "2 + 2" },
        { columnId: "tl", cellType: "static", text: "4" },
      ],
    },
    {
      id: "r1",
      cells: [
        { columnId: "cau", cellType: "static", text: "3 + 3" },
        { columnId: "tl", cellType: "input", acceptedAnswers: ["6"] },
      ],
    },
  ],
};

it("v1: hàng thiếu ô ở CỘT ĐẦU vẫn bù đúng chỗ, không đẩy lệch cột", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <TableFillPlayer title="Q" table={v1ShortFrontTable} onElementGraded={onElementGraded} />,
    ),
  );

  const body = bodyRowsOf();
  const short = cellsOf(body[1]);
  expect(short).toHaveLength(3);
  expect(short[0].textContent).toBe(""); // ô bù, nằm ở ĐẦU hàng
  expect(short[1].textContent).toContain("3 + 3");
  expect(short[2].querySelector("input")).toBeTruthy();
  // Không ô nào bị gộp — hàng ngắn không được biến thành ô trải ngang.
  expect(short.every((td) => td.colSpan === 1)).toBe(true);

  const input = container.querySelector<HTMLInputElement>('input[data-answer-key="r1__tl"]')!;
  typeBlur(input, "6");
  expect(onElementGraded).toHaveBeenCalledWith("r1__tl", "correct", undefined);
});

it("sọc chẵn/lẻ xen kẽ theo HÀNG DỮ LIỆU, hàng banner không làm gãy nhịp", () => {
  const dataRow = (id: string, text: string) => ({
    id,
    cells: [
      { columnId: "c1", cellType: "static" as const, text },
      { columnId: "c2", cellType: "input" as const },
    ],
  });
  const bannerTable: TableFillTableData = {
    headers: [{ id: "c1", label: "Phép tính" }, { id: "c2", label: "Kết quả" }],
    rows: [
      dataRow("r1", "1 + 1"),
      dataRow("r2", "2 + 2"),
      { id: "g1", cells: [{ columnId: "c1", cellType: "static", text: "Nhóm B", colSpan: 2 }] },
      dataRow("r3", "3 + 3"),
      dataRow("r4", "4 + 4"),
    ],
  };
  act(() => root.render(<TableFillPlayer title="Q" table={bannerTable} />));

  const rows = bodyRowsOf();
  const stripeOf = (row: Element) =>
    Array.from(row.classList).find((cls) => cls.startsWith("bg-"));
  // Hàng banner (ô trải ngang) không mang sọc — nền riêng nằm trên <td>.
  expect(cellsOf(rows[2])).toHaveLength(1);
  expect(stripeOf(rows[2])).toBeUndefined();

  const [even1, odd1, , even2, odd2] = rows.map(stripeOf);
  expect(odd1).not.toBe(even1);
  // Nhịp chạy tiếp sau banner: nếu banner bị tính vào chỉ số thì `even2` sẽ
  // trùng `odd1` và hai hàng cạnh nhau ra cùng màu.
  expect(even2).toBe(even1);
  expect(odd2).toBe(odd1);
});

it("v1: bảng không có nhãn cột nào thì bỏ hẳn tầng tên cột (kế hoạch §3, 186 bảng)", () => {
  const blankHeaderTable: TableFillTableData = {
    headers: [{ id: "c1", label: "" }, { id: "c2", label: "" }],
    rows: [
      {
        id: "r1",
        cells: [
          { columnId: "c1", cellType: "static", text: "A" },
          { columnId: "c2", cellType: "input" },
        ],
      },
    ],
  };
  act(() => root.render(<TableFillPlayer title="Q" table={blankHeaderTable} selfAssessment />));
  // Trước đây dựng một hàng <th> rỗng; giờ không dựng gì cả.
  expect(container.querySelector("thead")).toBeNull();
  expect(cellsOf(bodyRowsOf()[0])).toHaveLength(2);
});

it('khối "Đáp án đúng" dựng lại đúng lưới của đề, không phải danh sách trơ', () => {
  // Dữ liệu thật b27_q1 ("V v X x"): 5 cột, chỉ cột `res` có đáp án, và các hàng
  // sau hàng mẫu thiếu ô ở cột đầu. Trước đây khối đáp án chỉ in "vừa / vữa /
  // xưa" — không đối chiếu được đáp án nào của hàng nào.
  const combineTable: TableFillTableData = {
    headers: [
      { id: "lbl", label: "" },
      { id: "b", label: "" },
      { id: "v", label: "" },
      { id: "t", label: "" },
      { id: "res", label: "" },
    ],
    rows: [
      {
        id: "r1",
        cells: [
          { columnId: "lbl", cellType: "static", text: "M:" },
          { columnId: "b", cellType: "static", text: "b" },
          { columnId: "v", cellType: "static", text: "ia" },
          { columnId: "t", cellType: "static", text: "`" },
          { columnId: "res", cellType: "static", text: "bìa" },
        ],
      },
      {
        id: "r2",
        cells: [
          { columnId: "b", cellType: "static", text: "v" },
          { columnId: "v", cellType: "static", text: "ưa" },
          { columnId: "t", cellType: "static", text: "`" },
          { columnId: "res", cellType: "input", acceptedAnswers: ["vừa"] },
        ],
      },
      {
        id: "r3",
        cells: [
          { columnId: "b", cellType: "static", text: "x" },
          { columnId: "v", cellType: "static", text: "ia" },
          { columnId: "t", cellType: "static", text: "ˀ" },
          { columnId: "res", cellType: "input", acceptedAnswers: ["xỉa"] },
        ],
      },
    ],
  };
  act(() => root.render(<TableFillPlayer title="Q" table={combineTable} submitted />));

  // Bảng thứ hai là khối đáp án; nó phải cùng số hàng/số ô với bảng của đề để
  // đọc theo hàng là ra ngay đáp án của hàng đó.
  const tables = container.querySelectorAll("table");
  expect(tables).toHaveLength(2);
  const revealRows = Array.from(tables[1].querySelectorAll("tbody tr"));
  expect(revealRows).toHaveLength(3);
  const textOf = (row: Element) =>
    Array.from(row.querySelectorAll("th,td")).map((c) => c.textContent?.trim() ?? "");
  expect(textOf(revealRows[0])).toEqual(["M:", "b", "ia", "`", "bìa"]);
  expect(textOf(revealRows[1])).toEqual(["", "v", "ưa", "`", "vừa"]);
  expect(textOf(revealRows[2])).toEqual(["", "x", "ia", "ˀ", "xỉa"]);
});

});
