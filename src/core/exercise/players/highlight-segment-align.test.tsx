/**
 * SBT-71 — dòng nguồn "(Theo …)" của bài highlight nằm riêng một dòng, sát lề
 * phải, nhờ `align` khai trên mảnh không chọn được.
 *
 * web-own: chưa upstream lên studio. File này không tồn tại bên studio nên
 * sync-bằng-copy không đè, và nó đỏ ngay nếu một đợt copy HighlightTextPlayer.tsx
 * nuốt mất bản vá — hệt cách blank-label-reveal.test.tsx giữ mục G.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { highlightSegmentAlign, trimAlignedSegmentValue } from "./highlight-segment-align";

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

/** Nguồn in nghiêng chữ "Theo" — đúng dạng runs của VBT Tiếng Việt 4 bài 24. */
const theoKaoSon = [
  { text: "(", annotations: {} },
  { text: "Theo ", annotations: { italic: true } },
  { text: "Kao Sơn)", annotations: {} },
];

function payload(source: Record<string, unknown>) {
  return {
    content: { blocks: [{ type: "paragraph", text: "Gạch dưới các tính từ trong đoạn văn sau:" }] },
    segments: [
      { id: "w1", text: "quả", selectable: true },
      { id: "p1", text: " ", selectable: false },
      { id: "adj", text: "chín mọng", selectable: true },
      { id: "p2", text: ".", selectable: false },
      { id: "src", selectable: false, ...source },
    ],
    correctAnswer: ["adj"],
    display: { interactionType: "text" },
  };
}

function render(source: Record<string, unknown>, submitted = false) {
  act(() => {
    root.render(renderInteractionPlayer("highlight", payload(source) as never, { submitted }));
  });
}

const aligned = () => container.querySelector<HTMLElement>("[data-segment-align]");

describe("highlight — mảnh không chọn được có `align`", () => {
  it("align right → một dòng riêng, căn phải, giữ chữ nghiêng của runs", () => {
    render({ text: "(Theo Kao Sơn)", runs: theoKaoSon, align: "right" });
    const line = aligned();
    expect(line).toBeTruthy();
    expect(line!.dataset.segmentAlign).toBe("right");
    expect(line!.className).toContain("block");
    expect(line!.className).toContain("text-right");
    expect(line!.textContent).toBe("(Theo Kao Sơn)");
    expect(line!.querySelector("em")?.textContent).toBe("Theo ");
  });

  it("dữ liệu cũ đệm \"\\n\" + dãy dấu cách: thêm align là đủ, khoảng trắng hai đầu bị cắt", () => {
    // Đúng dạng `b_src` của b9_i2_q1: "\n" + hơn 100 dấu cách trước "(".
    const pad = "\n" + " ".repeat(105);
    render({
      text: `${pad}(Theo Thụy Khuê)`,
      runs: [
        { text: `${pad}(`, annotations: {} },
        { text: "Theo ", annotations: { italic: true } },
        { text: "Thụy Khuê)", annotations: {} },
      ],
      align: "right",
    });
    const line = aligned()!;
    expect(line.textContent).toBe("(Theo Thụy Khuê)");
    expect(line.querySelector("br")).toBeNull();
  });

  it("chỉ có text (không runs) cũng được cắt và căn", () => {
    render({ text: "\n(Trà Ngân)  ", align: "right" });
    expect(aligned()!.textContent).toBe("(Trà Ngân)");
  });

  it("align center / left dùng đúng class tương ứng", () => {
    render({ text: "(Theo Kao Sơn)", align: "center" });
    expect(aligned()!.className).toContain("text-center");
    render({ text: "(Theo Kao Sơn)", align: "left" });
    expect(aligned()!.className).toContain("text-left");
  });

  it("không khai align → nội dòng như cũ, khoảng trắng giữ nguyên", () => {
    render({ text: "   (Theo Kao Sơn)", runs: undefined });
    expect(aligned()).toBeNull();
    const plain = Array.from(container.querySelectorAll("span.whitespace-pre-wrap")).find((s) =>
      s.textContent?.includes("Kao Sơn"),
    );
    expect(plain?.className).not.toContain("block");
    expect(plain?.textContent).toBe("   (Theo Kao Sơn)");
  });

  it("giá trị align lạ (\"Right\", số) → coi như không khai", () => {
    render({ text: "(Theo Kao Sơn)", align: "Right" });
    expect(aligned()).toBeNull();
    render({ text: "(Theo Kao Sơn)", align: 1 });
    expect(aligned()).toBeNull();
  });

  it("align trên mảnh CHỌN ĐƯỢC bị bỏ qua — mảnh vẫn là nút chọn nội dòng", () => {
    render({ text: "(Theo Kao Sơn)", selectable: true, align: "right" });
    expect(aligned()).toBeNull();
    const buttons = Array.from(container.querySelectorAll('[role="button"]')).map((b) => b.textContent);
    expect(buttons).toContain("(Theo Kao Sơn)");
  });

  it("không đụng tới chấm và khối Đáp án đúng", () => {
    render({ text: "(Theo Kao Sơn)", runs: theoKaoSon, align: "right" }, true);
    const heading = Array.from(container.querySelectorAll("p")).find(
      (p) => p.textContent?.trim() === "Đáp án đúng",
    );
    expect(heading).toBeTruthy();
    const reveal = heading!.parentElement!.textContent ?? "";
    expect(reveal).toContain("chín mọng");
    expect(reveal).not.toContain("Kao Sơn");
    // Mảnh nguồn không phải nút chọn.
    const buttons = Array.from(container.querySelectorAll('[role="button"]')).map((b) => b.textContent);
    expect(buttons).not.toContain("(Theo Kao Sơn)");
  });
});

describe("helper", () => {
  it("highlightSegmentAlign chỉ nhận left/center/right", () => {
    expect(highlightSegmentAlign("right")).toBe("right");
    expect(highlightSegmentAlign("Right")).toBeUndefined();
    expect(highlightSegmentAlign("toString")).toBeUndefined();
    expect(highlightSegmentAlign(undefined)).toBeUndefined();
  });

  it("trimAlignedSegmentValue bỏ run chỉ toàn khoảng trắng ở hai đầu, giữ khoảng trắng giữa các run", () => {
    expect(
      trimAlignedSegmentValue({
        text: "",
        runs: [
          { text: "\n   ", annotations: {} },
          { text: "  (", annotations: {} },
          { text: "Theo ", annotations: { italic: true } },
          { text: "Kao Sơn)  ", annotations: {} },
          { text: " \n", annotations: {} },
        ],
      }),
    ).toEqual([
      { text: "(", annotations: {} },
      { text: "Theo ", annotations: { italic: true } },
      { text: "Kao Sơn)", annotations: {} },
    ]);
  });

  it("trimAlignedSegmentValue không sửa runs gốc của payload", () => {
    const runs = [{ text: "\n(", annotations: {} }, { text: "Trà Ngân)", annotations: {} }];
    trimAlignedSegmentValue({ text: "", runs });
    expect(runs[0].text).toBe("\n(");
  });
});

/** Đoạn văn mà dấu chấm cuối đoạn nằm DÍNH trong mảnh nguồn — đúng dạng dữ liệu thật. */
function renderGlued(source: Record<string, unknown>) {
  act(() => {
    root.render(
      renderInteractionPlayer(
        "highlight",
        {
          content: { blocks: [{ type: "paragraph", text: "Gạch dưới các tính từ trong đoạn văn sau:" }] },
          segments: [
            { id: "w1", text: "quả mâm xôi ", selectable: true },
            { id: "adj", text: "chín mọng", selectable: true },
            { id: "src", selectable: false, align: "right", ...source },
          ],
          correctAnswer: ["adj"],
          display: { interactionType: "text" },
        } as never,
        {},
      ),
    );
  });
}

/** Chữ của đoạn văn nằm NGOÀI dòng căn lề. */
const passageOutsideLine = () => {
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelector("[data-segment-align]")?.remove();
  return clone.textContent ?? "";
};

describe("highlight — dữ liệu bẩn và dấu câu dính đầu mảnh nguồn", () => {
  it("mảnh thiếu `text`, runs rỗng → không sập, không sinh dòng căn lề rỗng", () => {
    expect(() => renderGlued({ runs: [] })).not.toThrow();
    expect(aligned()).toBeNull();
    expect(container.textContent).toContain("chín mọng");
  });

  it("run có `text: null` / số → coi như rỗng, không sập", () => {
    expect(() =>
      renderGlued({
        text: "(Cảnh Yên)",
        runs: [
          { text: null, annotations: {} },
          { text: "(Cảnh Yên)", annotations: {} },
          { text: 42, annotations: {} },
        ],
      }),
    ).not.toThrow();
    expect(aligned()?.textContent).toBe("(Cảnh Yên)");
  });

  it('p83 ".⟨113 dấu cách⟩(Theo Kao Sơn)" có runs → "." ở lại cuối đoạn, dòng phải chỉ còn nguồn, "Theo" nghiêng', () => {
    const pad = " ".repeat(113);
    renderGlued({
      text: `.${pad}(Theo Kao Sơn)`,
      runs: [
        { text: `.${pad}(`, annotations: {} },
        { text: "Theo ", annotations: { italic: true } },
        { text: "Kao Sơn)", annotations: {} },
      ],
    });
    const line = aligned()!;
    expect(line.textContent).toBe("(Theo Kao Sơn)");
    expect(line.querySelector("em")?.textContent).toBe("Theo ");
    expect(passageOutsideLine()).toMatch(/chín mọng\.$/);
  });

  it('p37 ".\\n⟨25 dấu cách⟩(Bảo Ngọc)" chỉ có text', () => {
    renderGlued({ text: `.\n${" ".repeat(25)}(Bảo Ngọc)` });
    expect(aligned()!.textContent).toBe("(Bảo Ngọc)");
    expect(passageOutsideLine()).toMatch(/chín mọng\.$/);
  });

  it('p87 ".\\n⟨113 dấu cách⟩(Cảnh Yên)" chỉ có text', () => {
    renderGlued({ text: `.\n${" ".repeat(113)}(Cảnh Yên)` });
    expect(aligned()!.textContent).toBe("(Cảnh Yên)");
    expect(passageOutsideLine()).toMatch(/chín mọng\.$/);
  });

  it('mảnh chỉ có "." → dấu chấm ở lại cuối đoạn, không có dòng căn lề', () => {
    renderGlued({ text: "." });
    expect(aligned()).toBeNull();
    expect(passageOutsideLine()).toMatch(/chín mọng\.$/);
  });
});
