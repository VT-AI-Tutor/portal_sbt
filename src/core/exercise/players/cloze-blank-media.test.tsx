/**
 * Ô TRỐNG mang media đề bài (`blanks[].media`, §5.6) — kiểu "nhìn tranh rồi
 * điền" của Tiếng Việt/Mỹ thuật.
 *
 * Fixture alias chuỗi (`blanks[].image`) theo shape dữ liệu trích xuất thật
 * (sách Tiếng Việt: `{"id":"blank_1","image":"…","before":"con "}`, đáp án
 * "ghẹ"). Alias chỉ nhận path resolve được (bắt đầu `/` hoặc http) — path
 * tương đối `assets/…` không có base để phân giải nên bị bỏ qua thay vì
 * render icon ảnh vỡ. `correctAnswer` mọi ca vẫn là chữ.
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

function imagePaths(): string[] {
  return Array.from(container.querySelectorAll("img")).map(
    (img) => new URL(img.src, "http://x").pathname,
  );
}

describe("cloze — blanks[].media", () => {
  it("marker trong đề: media của ô trống render ngay cạnh ô nhập", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: {
              blocks: [{ type: "paragraph", text: "Bước 1: {blank_1} — Bước 2: {blank_2}" }],
            },
            blanks: [
              { id: "blank_1", media: { type: "image", url: "/uploads/buoc-1.png" } },
              { id: "blank_2", media: { type: "image", url: "/uploads/buoc-2.png" } },
            ],
            correctAnswer: { blank_1: ["xé giấy"], blank_2: ["dán hình"] },
          },
          {},
        ),
      );
    });
    expect(imagePaths()).toEqual(
      expect.arrayContaining(["/uploads/buoc-1.png", "/uploads/buoc-2.png"]),
    );
    expect(container.querySelectorAll("input").length).toBe(2);
  });

  it("không có marker (picture-word): mỗi blank một dòng, media vẫn hiện", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "Viết tên con vật trong tranh." }] },
            blanks: [
              { id: "b1", before: "con ", media: { type: "image", url: "/uploads/con-ghe.png" } },
            ],
            correctAnswer: { b1: ["ghẹ"] },
          },
          {},
        ),
      );
    });
    expect(imagePaths()).toContain("/uploads/con-ghe.png");
    expect(container.querySelectorAll("input").length).toBe(1);
  });

  it("alias chuỗi `blanks[].image` với path đã root được đọc và resolve URL", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "con {blank_1}" }] },
            blanks: [
              { id: "blank_1", image: "/uploads/books/x/assets/bai16_q4_1.png", before: "con " },
            ],
            correctAnswer: { blank_1: ["ghẹ"] },
          },
          {},
        ),
      );
    });
    expect(imagePaths()).toContain("/uploads/books/x/assets/bai16_q4_1.png");
  });

  it("alias chuỗi path TƯƠNG ĐỐI (assets/…) bị bỏ qua — không render icon ảnh vỡ", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "con {blank_1}" }] },
            blanks: [{ id: "blank_1", image: "assets/images/bai16_q4_1.png", before: "con " }],
            correctAnswer: { blank_1: ["ghẹ"] },
          },
          {},
        ),
      );
    });
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelectorAll("input").length).toBe(1);
  });

  it("fill_blank (P12) cũng render media của ô trống — không nuốt như trước fix", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "fill_blank",
          {
            content: { blocks: [{ type: "paragraph", text: "Viết tên con vật." }] },
            blanks: [
              { id: "b1", label: "a.", media: { type: "image", url: "/uploads/con-meo.png" } },
            ],
            correctAnswer: { b1: ["mèo"] },
          },
          {},
        ),
      );
    });
    expect(imagePaths()).toContain("/uploads/con-meo.png");
    expect(container.querySelectorAll("input").length).toBe(1);
  });

  it("ô NHIỀU DÒNG: media xếp DỌC trên textarea, không ép inline", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "Mô tả từng bước." }] },
            blanks: [
              {
                id: "b1",
                media: { type: "image", url: "/uploads/buoc-1.png" },
                input: { mode: "multiline", size: "full", rows: 2 },
              },
            ],
            correctAnswer: { b1: [] },
            selfAssessment: true,
          },
          {},
        ),
      );
    });
    const img = container.querySelector("img")!;
    expect(new URL(img.src, "http://x").pathname).toBe("/uploads/buoc-1.png");
    // Media và textarea phải nằm trong wrapper xếp dọc (flex-col) — ép inline
    // sẽ bóp width 100% của ô nhiều dòng về cỡ nội dung.
    const wrapper = img.closest("span")!;
    expect(wrapper.className).toContain("flex-col");
    expect(wrapper.querySelector("textarea")).not.toBeNull();
  });

  it("blank không có media giữ nguyên hành vi cũ — không render ảnh nào", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "Thủ đô là {blank_1}." }] },
            blanks: [{ id: "blank_1" }],
            correctAnswer: { blank_1: ["Hà Nội"] },
          },
          {},
        ),
      );
    });
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
