/**
 * Ô của bảng `checkbox_table` phải hiện ẢNH tác giả soạn cùng với chữ, kể cả khi
 * khối ảnh bị ghi lồng trong `content` của đoạn văn (câu
 * `6a6042bbe35c670a1ada0063` — Tin học 4, ô "b)"): trước đây ô chỉ ra chữ rỗng
 * và ảnh không có đường render nào.
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

const IMAGE_URL = "/uploads/books/6a60428adbb5a6f99d8c79a4/media/64fb3f44c710_image.png";

const payload = () => ({
  id: "b16_q1",
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
        blocks: [{ type: "paragraph", content: [{ text: "a) Một chương trình Scratch…", annotations: {} }] }],
      },
    },
    {
      id: "s2",
      content: {
        blocks: [
          {
            type: "paragraph",
            // Hình dạng hỏng như trong DB: run bị đánh số và khối ảnh nằm TRONG
            // `content` thay vì ở tầng `blocks`.
            content: {
              0: { text: "b) Để thêm một phông nền mới, em nháy chuột vào nút lệnh.", annotations: {} },
              blocks: [
                { type: "image", url: IMAGE_URL },
                { type: "paragraph", content: [] },
              ],
            },
          },
        ],
      },
    },
  ],
  correctAnswer: { s1: ["dung"], s2: ["dung"] },
});

const rowCell = (index: number) =>
  container.querySelectorAll("tbody tr")[index]?.querySelector("td") ?? null;

it("hiện cả chữ lẫn ảnh trong ô, dù khối ảnh bị ghi lồng", () => {
  act(() => {
    root.render(renderInteractionPlayer("checkbox_table", payload(), {}));
  });

  const cell = rowCell(1);
  expect(cell?.textContent).toContain("b) Để thêm một phông nền mới");
  const img = cell?.querySelector("img");
  expect(img).not.toBeNull();
  expect(img?.getAttribute("src") ?? "").toContain("64fb3f44c710_image.png");
});

it("ô soạn đúng hình dạng vẫn như cũ — không mọc thêm ảnh", () => {
  act(() => {
    root.render(renderInteractionPlayer("checkbox_table", payload(), {}));
  });

  const cell = rowCell(0);
  expect(cell?.textContent).toContain("a) Một chương trình Scratch");
  expect(cell?.querySelector("img")).toBeNull();
});

/**
 * Shape CHUẨN (khối ảnh là anh em cùng cấp trong `content.blocks`) — đây là thứ
 * một bản sửa JSON sẽ ghi ra. Ô phải hiện chữ → ảnh → chữ đúng thứ tự tác giả
 * soạn, ngay bên trong ô của bảng.
 */
const canonicalPayload = () => ({
  ...payload(),
  rows: [
    payload().rows[0],
    {
      id: "s2",
      content: {
        blocks: [
          {
            type: "paragraph",
            content: [{ text: "b) Để thêm một phông nền mới, em nháy chuột vào nút lệnh", annotations: {} }],
          },
          { type: "image", url: IMAGE_URL },
          { type: "paragraph", content: [{ text: "ở góc dưới bên phải màn hình.", annotations: {} }] },
        ],
      },
    },
  ],
});

it("shape chuẩn: ảnh nằm TRONG ô, giữa hai đoạn chữ, đúng thứ tự", () => {
  act(() => {
    root.render(renderInteractionPlayer("checkbox_table", canonicalPayload(), {}));
  });

  const cell = rowCell(1);
  const img = cell?.querySelector("img");
  expect(img).not.toBeNull();
  expect(img?.getAttribute("src") ?? "").toContain("64fb3f44c710_image.png");

  // Ảnh phải nằm trong ĐÚNG ô nhãn hàng (không bị đẩy ra ngoài bảng/ô khác).
  expect(cell?.tagName).toBe("TD");
  expect(cell?.contains(img!)).toBe(true);

  // Thứ tự: chữ đầu → ảnh → chữ sau.
  const text = cell?.textContent ?? "";
  expect(text).toContain("b) Để thêm một phông nền mới");
  expect(text).toContain("ở góc dưới bên phải màn hình.");
  const nodes = Array.from(cell!.querySelectorAll("img, div"));
  const imgIndex = nodes.indexOf(img!);
  const firstTextIndex = nodes.findIndex((n) => (n.textContent ?? "").includes("b) Để thêm"));
  const lastTextIndex = nodes.findIndex((n) => (n.textContent ?? "").includes("ở góc dưới"));
  expect(firstTextIndex).toBeLessThan(imgIndex);
  expect(imgIndex).toBeLessThan(lastTextIndex);
});
