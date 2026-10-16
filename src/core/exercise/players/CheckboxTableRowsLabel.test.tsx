/**
 * issue #843 — ô tiêu đề của cột nhãn hàng (ô góc trên bên trái) trong
 * `checkbox_table` phải in nhãn tác giả đặt, thay vì luôn trống.
 *
 * Khoá chuẩn là `rowsLabel`; `statementLabel` được nhận thêm để payload chuyển
 * sang từ `multi_true_false` không phải viết lại.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
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

/** Payload rút gọn từ câu `b5_q7` (Tin học lớp 4) trong issue. */
const basePayload = () => ({
  id: "b5_q7",
  type: "checkbox_table",
  version: 2,
  display: { interactionType: "rows" },
  columns: [
    { id: "dung", label: "Đúng" },
    { id: "sai", label: "Sai" },
  ],
  rows: [
    {
      id: "s1",
      content: {
        blocks: [
          {
            type: "paragraph",
            content: [{ text: "a) Có thể di chuyển, đổi tên, xoá tệp.", annotations: {} }],
          },
        ],
      },
    },
    {
      id: "s2",
      content: {
        blocks: [
          {
            type: "paragraph",
            content: [{ text: "b) Di chuyển là tạo thêm một bản sao.", annotations: {} }],
          },
        ],
      },
    },
  ],
  correctAnswer: { s1: ["sai"], s2: ["sai"] },
});

const headerCells = () =>
  Array.from(container.querySelectorAll("thead th")).map((th) =>
    (th.textContent ?? "").replace(/ /g, "").trim(),
  );

it("in `rowsLabel` vào ô tiêu đề đầu tiên của bảng", () => {
  act(() => {
    root.render(
      renderInteractionPlayer("checkbox_table", { ...basePayload(), rowsLabel: "Phát biểu" }, {}),
    );
  });

  expect(headerCells()).toEqual(["Phát biểu", "Đúng", "Sai"]);
});

it("nhận `statementLabel` cho payload chuyển từ multi_true_false", () => {
  act(() => {
    root.render(
      renderInteractionPlayer(
        "checkbox_table",
        { ...basePayload(), statementLabel: "Nhận định" },
        {},
      ),
    );
  });

  expect(headerCells()).toEqual(["Nhận định", "Đúng", "Sai"]);
});

it("giữ ô trống như cũ khi payload không khai báo tiêu đề", () => {
  act(() => {
    root.render(renderInteractionPlayer("checkbox_table", basePayload(), {}));
  });

  expect(headerCells()).toEqual(["", "Đúng", "Sai"]);
});

it("nhãn cột đi qua RichTextValue — công thức không in ra delimiter", () => {
  act(() => {
    root.render(
      renderInteractionPlayer(
        "checkbox_table",
        {
          ...basePayload(),
          rowsLabel: "Phát biểu",
          columns: [
            { id: "a", label: "\\(\\frac{1}{2}\\)" },
            { id: "b", label: "Sai" },
          ],
        },
        {},
      ),
    );
  });

  const first = container.querySelectorAll("thead th")[1];
  // KaTeX đã dựng công thức (annotation của nó vẫn giữ TeX gốc, nên chỉ kiểm tra
  // rằng delimiter `\( \)` không còn nằm nguyên trong ô).
  expect(first?.querySelector(".katex")).not.toBeNull();
  expect(first?.textContent).not.toContain("\\(");
});
