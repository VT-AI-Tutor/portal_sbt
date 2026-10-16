/**
 * Matching item pictures size the card, not the other way round.
 *
 * Regression for workbook scans rendered as ~60px thumbnails (QA: "ảnh quá
 * nhỏ, khó nhìn rõ"). jsdom does not lay out images, so this asserts the class
 * pipeline that produces the sizing: natural pixel size, no fixed square, no
 * square frame, no crop — the card sizes to the image.
 *
 * Cập nhật 31/7: thêm ĐÚNG MỘT trần cao ở đuôi phân bố
 * (`MEDIA_ITEM_MAX_HEIGHT` = 22rem = 352px, ngay TRÊN p50 đo được 336px) cho
 * ca nhiều ảnh làm tràn màn hình. Ảnh cỡ trung vị vẫn không đổi, nên hồi quy
 * "ảnh quá nhỏ" bên trên vẫn được khoá. Trần này nằm sau cờ
 * `skin.presentation.autoMediaSizing`, nên bài test phải nói rõ skin.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkinProvider } from "@/core/exercise/skin";
import type { QuestionPlayerSkin } from "@/core/exercise/skin";
import { MEDIA_ITEM_MAX_HEIGHT, MatchItemImage, hasItemLabel } from "./shared";

/** Surface học sinh — cờ chỉnh cỡ ảnh BẬT. */
const AUTO_MEDIA_SKIN: QuestionPlayerSkin = { presentation: { autoMediaSizing: true } };

function render(node: React.ReactNode) {
  act(() => {
    root.render(<SkinProvider skin={AUTO_MEDIA_SKIN}>{node}</SkinProvider>);
  });
}

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

const imgOf = () => container.querySelector("img") as HTMLImageElement;
/** Exact class token — `max-w-full` must not read as `w-full`. */
const has = (cls: string) => imgOf().classList.contains(cls);

describe("MatchItemImage", () => {
  it("renders at natural size — no fixed square, no width cap beyond the column", () => {
    render(<MatchItemImage src="/img/scan-400x260.png" alt="cờ" />);
    expect(has("h-auto")).toBe(true);
    expect(has("w-auto")).toBe(true);
    expect(has("object-contain")).toBe(true);
    const cls = imgOf().className;
    // Không khung vuông 60px, không cắt ảnh, không ép tỉ lệ.
    expect(cls).not.toContain("3.75rem");
    expect(cls).not.toContain("aspect-");
    expect(cls).not.toContain("object-cover");
    // Trần rộng duy nhất là chiều rộng cột — trước đây KHÔNG có, nên một scan
    // rộng hơn cột tràn ngang ra ngoài thẻ.
    expect(has("max-w-full")).toBe(true);
    expect(cls).not.toContain("max-h"); // trần cao là style, không phải class
  });

  it("caps only the tail of the height distribution", () => {
    render(<MatchItemImage src="/img/tall-200x1200.png" />);
    expect(imgOf().style.maxHeight).toBe(MEDIA_ITEM_MAX_HEIGHT);
    // Ảnh là <img> thuần: không nút phóng to, không overlay (Owner 31/7).
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("[data-image-zoom]")).toBeNull();
  });

  it("cờ autoMediaSizing TẮT → không trần cao nào, đúng hành vi cũ", () => {
    act(() => {
      root.render(
        <SkinProvider skin={{ presentation: {} }}>
          <MatchItemImage src="/img/tall-200x1200.png" />
        </SkinProvider>,
      );
    });
    expect(imgOf().style.maxHeight).toBe("");
  });

  it("keeps an authored width winning outright — no height cap layered on top", () => {
    render(<MatchItemImage src="/img/icon.png" width="120px" />);
    expect(imgOf().style.maxWidth).toBe("120px");
    expect(imgOf().style.maxHeight).toBe("");
  });

  it("is not squeezed by a flex sibling, and is never rounded", () => {
    render(<MatchItemImage src="/img/tall-200x1200.png" />);
    expect(has("shrink-0")).toBe(true);
    expect(imgOf().className).not.toContain("rounded");
  });
});

describe("hasItemLabel", () => {
  it("is false for a picture-only item carrying an empty content object", () => {
    expect(hasItemLabel({ content: { blocks: [] } })).toBe(false);
    expect(hasItemLabel({ text: "   ", content: { blocks: [{ type: "paragraph", text: "" }] } })).toBe(false);
  });

  it("is true once the item actually renders words", () => {
    expect(hasItemLabel({ text: "Trật tự khi chào cờ" })).toBe(true);
    expect(hasItemLabel({ content: { blocks: [{ type: "paragraph", text: "chào cờ" }] } })).toBe(true);
  });
});
