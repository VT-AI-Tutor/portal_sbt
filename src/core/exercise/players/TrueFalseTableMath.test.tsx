/**
 * #839 — nội dung nhận định của bảng Đúng/Sai phải render KaTeX.
 *
 * `dispatch` làm phẳng `content.blocks` về chuỗi nhưng GIỮ nguyên delimiter
 * `\( … \)`; player phải đưa chuỗi đó qua `RichTextValue`/`InlineMathText` thay
 * vì in thẳng vào `<td>`. Trước sửa: `td .katex` = 0.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

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

/** Payload thật của `b72_t2q2` (VBT Toán 5 — "Đúng ghi Đ, sai ghi S"). */
const fractionStatement = {
  blocks: [
    {
      type: "paragraph",
      content: [
        { text: "a) ", annotations: {} },
        { text: "\\(\\frac{1}{4}\\)", annotations: { code: true } },
        { text: " thế kỉ = 25 năm", annotations: {} },
      ],
    },
  ],
};

describe("bảng Đúng/Sai render math (#839)", () => {
  it("dựng KaTeX cho phân số trong nhận định multi_true_false", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "multi_true_false",
          {
            statements: [{ id: "a1", content: fractionStatement }],
            correctAnswer: { a1: true },
          },
          {},
        ),
      );
    });

    expect(container.querySelectorAll("td .katex").length).toBeGreaterThan(0);
    // Phân số dựng đứng thật (có gạch ngang), không phải chữ một dòng.
    expect(container.querySelectorAll("td .katex .mfrac").length).toBeGreaterThan(0);
    // Không được lộ delimiter thô ra màn hình (KaTeX vẫn giữ TeX gốc trong
    // <annotation> của MathML — đó là output hợp lệ, không phải rò rỉ).
    expect(container.textContent).not.toContain("\\(");
  });

  it("dựng KaTeX cho nhãn cột checkbox_table", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "checkbox_table",
          {
            columns: [{ id: "c1", label: "\\(\\frac{1}{2}\\) giờ" }],
            rows: [{ id: "r1", content: { blocks: [{ type: "paragraph", content: [{ text: "Dòng 1", annotations: {} }] }] } }],
            correctAnswer: { r1: ["c1"] },
          },
          {},
        ),
      );
    });

    expect(container.querySelectorAll("th .katex .mfrac").length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("\\(");
  });
});
