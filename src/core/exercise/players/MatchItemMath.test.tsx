/**
 * #931 — TeX trong NHÃN ITEM của nhóm nối/phân loại/nối điểm.
 *
 * Cùng lớp lỗi với #839 (bảng Đúng/Sai) nhưng ở vùng item: nhãn item đi qua
 * đường chuỗi thuần (`item.text` / `item.label`) chứ không phải `content.blocks`
 * của đề bài, nên delimiter `\( … \)` in thẳng ra màn hình. Khối "Đáp án đúng"
 * dựng chuỗi bằng nội suy nhãn nên rò cùng kiểu.
 *
 * Trước sửa: `.katex` = 0 trong thân câu, `textContent` chứa `\(`.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const TEX = "\\(\\frac{1}{8}\\)";

function render(type: string, payload: Record<string, unknown>, submitted = false) {
  act(() => {
    root.render(renderInteractionPlayer(type, payload, { submitted }));
  });
}

/** Không còn delimiter thô ở BẤT KỲ đâu trong cây (KaTeX giữ TeX gốc trong
 *  <annotation> MathML — đó là output hợp lệ, không tính là rò rỉ). */
function expectNoRawTex() {
  expect(container.textContent).not.toContain("\\(");
}

describe("#931 — nhãn item chuỗi thuần dựng KaTeX", () => {
  it("matching: leftItems/rightItems dùng `text`", () => {
    render("matching", {
      leftItems: [{ id: "tam", text: "Một phần tám" }],
      rightItems: [{ id: "f8", text: TEX }],
      correctAnswer: [{ item: "tam", target: "f8" }],
    });
    expect(container.querySelectorAll(".katex .mfrac").length).toBeGreaterThan(0);
    expectNoRawTex();
  });

  it("multi_true_false: statements dùng `text` phẳng (b14_q1)", () => {
    // Bài thật của khách: VBT Toán 3 tập một, bài 14 "Một phần mấy" — nhận định
    // vào theo đường `statements[].text` (bản nhập cũ), không phải
    // `content.blocks`. Không có khối rich nào nên `AlignedRichText` rơi về
    // fallback; fallback in thẳng là học sinh đọc được `\(\frac{1}{5}\)`.
    render("multi_true_false", {
      statements: [{ id: "s_a", text: `a) Đã tô màu ${TEX} của hình.` }],
      correctAnswer: { s_a: true },
    });
    expect(container.querySelectorAll(".katex .mfrac").length).toBeGreaterThan(0);
    expectNoRawTex();
  });

  it("matching: columns[].items[].label (b16_t1q1)", () => {
    render("matching", {
      columns: [
        { id: "left", items: [{ id: "a", label: "Một phần năm" }] },
        { id: "right", items: [{ id: "b", label: "\\(\\frac{1}{5}\\)" }] },
      ],
      correctAnswer: [{ item: "a", target: "b" }],
    });
    expect(container.querySelectorAll(".katex .mfrac").length).toBeGreaterThan(0);
    expectNoRawTex();
  });

  it("classification: item.text và category.label", () => {
    render("classification", {
      items: [{ id: "i1", text: TEX }],
      categories: [{ id: "cat", label: "\\(\\frac{1}{2}\\)" }],
      correctAnswer: { i1: "cat" },
    });
    expect(container.querySelectorAll(".katex .mfrac").length).toBeGreaterThan(0);
    expectNoRawTex();
  });

  it("connect_points: points[].content.blocks[].text (b23_t4q2)", () => {
    render("connect_points", {
      points: [
        {
          id: "p1",
          x: 10,
          y: 10,
          content: { blocks: [{ type: "paragraph", content: [{ text: TEX }] }] },
        },
        { id: "p2", x: 60, y: 60, label: "\\(\\frac{2}{15}\\)" },
      ],
      correctAnswer: ["p1", "p2"],
    });
    expect(container.querySelectorAll(".katex .mfrac").length).toBeGreaterThan(0);
    expectNoRawTex();
  });

  it("matching interactionType=scene: nhãn node", () => {
    render("matching", {
      display: { interactionType: "scene" },
      leftItems: [{ id: "a", text: "Một phần tám", x: 10, y: 10 }],
      rightItems: [{ id: "b", text: TEX, x: 60, y: 60 }],
      correctAnswer: [{ item: "a", target: "b" }],
    });
    expect(container.querySelectorAll(".katex .mfrac").length).toBeGreaterThan(0);
    expectNoRawTex();
  });

  it("matching interactionType=chain: nhãn cột giữa", () => {
    render("matching", {
      display: { interactionType: "chain" },
      leftItems: [{ id: "a", text: "Một phần tám" }],
      middleItems: [{ id: "m", text: TEX }],
      rightItems: [{ id: "b", text: "0,125" }],
      correctAnswer: [
        { item: "a", target: "m" },
        { item: "m", target: "b" },
      ],
    });
    expect(container.querySelectorAll(".katex .mfrac").length).toBeGreaterThan(0);
    expectNoRawTex();
  });

  it("word_bank: từ trong kho (cloze + interactionType word_bank)", () => {
    render("cloze", {
      display: { interactionType: "word_bank" },
      content: { blocks: [{ type: "paragraph", text: "Kết quả là {blank_1}." }] },
      wordBank: [TEX],
      correctAnswer: { blank_1: TEX },
    });
    expect(container.querySelectorAll(".katex .mfrac").length).toBeGreaterThan(0);
    expectNoRawTex();
  });
});

describe('#931 — khối "Đáp án đúng" không in TeX thô', () => {
  it("matching (b14_q2)", () => {
    render(
      "matching",
      {
        leftItems: [{ id: "tam", text: "Một phần tám" }],
        rightItems: [{ id: "f8", text: TEX }],
        correctAnswer: [{ item: "tam", target: "f8" }],
      },
      true,
    );
    const reveal = container.querySelector(".whitespace-pre-wrap");
    expect(reveal?.textContent ?? "").toContain("Một phần tám");
    expectNoRawTex();
  });

  it("classification", () => {
    render(
      "classification",
      {
        items: [{ id: "i1", text: "Một phần tám" }],
        categories: [{ id: "cat", label: TEX }],
        correctAnswer: { i1: "cat" },
      },
      true,
    );
    expectNoRawTex();
  });

  it("connect_points", () => {
    render(
      "connect_points",
      {
        points: [
          { id: "p1", x: 10, y: 10, label: TEX },
          { id: "p2", x: 60, y: 60, label: "\\(\\frac{2}{15}\\)" },
        ],
        correctAnswer: ["p1", "p2"],
      },
      true,
    );
    expectNoRawTex();
  });
});
