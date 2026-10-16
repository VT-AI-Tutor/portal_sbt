/**
 * Ô nhận định của bảng Đúng/Sai và ô nhãn của bảng tích chọn phải hiện CẢ chữ
 * lẫn ảnh (issue #837).
 *
 * Trước đây cả hai player render ô đó theo dạng ba ngôi `imageUrl ? ảnh : chữ`.
 * Nhận định nào vừa có câu chữ vừa có ảnh minh hoạ trong `content.blocks` thì
 * ảnh THẮNG và toàn bộ câu chữ biến mất khỏi ô — chữ chỉ còn sống trong `alt`
 * của `<img>`, tức học sinh không đọc được phát biểu để mà chọn Đ/S. Ca thật:
 * VBT Tin học 4, bài 16 câu 1, ý b) — icon nút lệnh "Chọn một Phông nền" nằm
 * giữa câu.
 *
 * Bài test khoá ở tầng `dispatch` (đúng đường mà `QuestionRenderer` đi) để cả
 * hai đầu của seam đều được kiểm: dispatch phải chuyển `content` xuống, và
 * player phải render nó theo thứ tự khối thay vì chọn một trong hai.
 */
import { act } from "react";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/content/assetUrl", () => ({
  resolveAssetUrl: (u?: string) => (!u ? "" : u.startsWith("/") ? `https://api.test${u}` : u),
}));

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

// renderInteractionPlayer → GradeMode provider → AccentProvider → player.
type WrappedPlayer = React.ReactElement<{
  children: React.ReactElement<{ children: React.ReactElement<Record<string, unknown>> }>;
}>;
function render(type: string, payload: unknown) {
  const node = (renderInteractionPlayer(type, payload as never, {} as never) as WrappedPlayer).props
    .children.props.children;
  act(() => root.render(node));
}

const HEAD = "b) Để thêm một phông nền mới, em nháy chuột vào nút lệnh Chọn một Phông nền";
const TAIL = "ở góc dưới bên phải màn hình.";
const ICON = "/uploads/books/6a60428adbb5a6f99d8c79a4/assets/bai16_q1_phongnen.png";

/** Nhận định đúng hình dạng của ý b): chữ → ảnh → chữ. */
const textImageTextBlocks = {
  blocks: [
    { type: "paragraph", content: [{ text: HEAD, annotations: {} }] },
    { type: "image", url: ICON, alt: "Nút lệnh Chọn một Phông nền", width: "220px" },
    { type: "paragraph", content: [{ text: TAIL, annotations: {} }] },
  ],
};

/** `<td>` đầu của mỗi hàng — ô nhận định / ô nhãn hàng. */
const firstCells = () =>
  Array.from(container.querySelectorAll("tbody tr")).map((tr) => tr.querySelector("td")!);

describe("bảng Đúng/Sai — ô nhận định (issue #837)", () => {
  const payload = {
    type: "multi_true_false",
    statements: [
      {
        id: "s1",
        content: {
          blocks: [
            {
              type: "paragraph",
              content: [{ text: "a) Một chương trình Scratch có thể có nhiều nhân vật.", annotations: {} }],
            },
          ],
        },
      },
      { id: "s2", content: textImageTextBlocks },
    ],
    correctAnswer: { s1: true, s2: true },
  };

  it("giữ cả câu chữ lẫn ảnh trong ô, đúng thứ tự tác giả viết", () => {
    render("multi_true_false", payload);
    const cell = firstCells()[1];

    // Hồi quy chính: trước khi sửa, `textContent` của ô này RỖNG.
    expect(cell.textContent).toContain(HEAD);
    expect(cell.textContent).toContain(TAIL);

    const img = cell.querySelector("img")!;
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe(`https://api.test${ICON}`);
    // `width` tác giả khai vẫn tới được ảnh (#783) qua đường mới.
    expect(img.style.maxWidth).toBe("220px");

    // Thứ tự: chữ đầu → ảnh → chữ đuôi.
    const order = cell.textContent!.indexOf(HEAD) < cell.textContent!.indexOf(TAIL);
    expect(order).toBe(true);
    expect(
      img.compareDocumentPosition(cell) & Node.DOCUMENT_POSITION_CONTAINS,
    ).toBeTruthy();
  });

  it("hàng chỉ có chữ vẫn render như cũ, không sinh ảnh và không lộ id", () => {
    render("multi_true_false", payload);
    const cell = firstCells()[0];
    expect(cell.textContent).toContain("a) Một chương trình Scratch có thể có nhiều nhân vật.");
    expect(cell.querySelector("img")).toBeNull();
    expect(cell.textContent).not.toContain("s1");
  });

  it("nhận định CHỈ có ảnh không kéo theo id làm nhãn rác", () => {
    render("multi_true_false", {
      type: "multi_true_false",
      statements: [
        { id: "s9", content: { blocks: [{ type: "image", url: ICON, alt: "" }] } },
      ],
      correctAnswer: { s9: true },
    });
    const cell = firstCells()[0];
    expect(cell.querySelector("img")).toBeTruthy();
    expect(cell.textContent).not.toContain("s9");
  });
});

/**
 * `label` của nhận định là TIỀN TỐ in trước thân ô, render bằng một `<span>`
 * riêng — độc lập với ba ngôi mà #837 sửa. Đo trên prod (mẫu 300 câu
 * `multi_true_false`, 1198 nhận định): 1182 nhận định không có `label`, 12 có
 * `label` là mỗi dấu mục ("a)"), và 4 có `label` chép NGUYÊN câu nhận định.
 *
 * Nhóm 4 câu đó là bẫy của #837: trước đây thân ô của hàng có ảnh chỉ hiện ảnh
 * nên nhãn trùng không lộ ra; nay thân ô hiện chữ, nếu giữ nguyên nhãn thì câu
 * nhận định bị in HAI lần. Ca thật: `b5_q12` (VBT Toán 1 - Tập 1).
 */
describe("tiền tố `label` không nhân đôi câu nhận định (issue #837)", () => {
  const withLabel = (label: string, paragraph: string) => ({
    type: "multi_true_false",
    statements: [
      {
        id: "s1",
        label,
        content: {
          blocks: [
            { type: "paragraph", content: [{ text: paragraph, annotations: {} }] },
            { type: "image", url: ICON, alt: "" },
          ],
        },
      },
    ],
    correctAnswer: { s1: true },
  });

  it("nhãn chép nguyên câu (hình dạng `b5_q12`) chỉ hiện MỘT lần", () => {
    const sentence = "a) 4 gồm 1 và 3.";
    render("multi_true_false", withLabel(sentence, sentence));
    const cell = firstCells()[0];
    const hits = cell.textContent!.split(sentence).length - 1;
    expect(hits).toBe(1);
    expect(cell.querySelector("img")).toBeTruthy();
  });

  it("nhãn là dấu mục ('a)') vẫn giữ, và câu nhận định vẫn hiện đủ", () => {
    render("multi_true_false", withLabel("a)", "Chu vi hai thửa đất là bằng nhau."));
    const cell = firstCells()[0];
    expect(cell.textContent).toContain("a)");
    expect(cell.textContent).toContain("Chu vi hai thửa đất là bằng nhau.");
    expect(cell.textContent!.split("a)").length - 1).toBe(1);
  });

  it("nhận định CHỈ có nhãn thì nhãn hiện đúng một lần, không rơi về id", () => {
    render("multi_true_false", {
      type: "multi_true_false",
      statements: [{ id: "s7", label: "a) Chỉ có nhãn." }],
      correctAnswer: { s7: true },
    });
    const cell = firstCells()[0];
    expect(cell.textContent!.split("a) Chỉ có nhãn.").length - 1).toBe(1);
    expect(cell.textContent).not.toContain("s7");
  });
});

describe("bảng tích chọn — ô nhãn hàng (issue #837)", () => {
  it("giữ cả câu chữ lẫn ảnh trong ô nhãn", () => {
    render("checkbox_table", {
      type: "checkbox_table",
      columns: [
        { id: "c1", label: "Đúng" },
        { id: "c2", label: "Sai" },
      ],
      rows: [{ id: "r1", content: textImageTextBlocks }],
      correctAnswer: { r1: ["c1"] },
    });
    const cell = firstCells()[0];

    expect(cell.textContent).toContain(HEAD);
    expect(cell.textContent).toContain(TAIL);
    expect(cell.querySelector("img")?.getAttribute("src")).toBe(`https://api.test${ICON}`);
  });
});
