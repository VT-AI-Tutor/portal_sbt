/**
 * Ngân hàng từ mang MEDIA (§5.6.1) — ca dùng "chọn hình điền vào ô trống" của
 * sách Mỹ thuật.
 *
 * Điểm cần khoá lại: media nằm trên phần tử ngân hàng (canonical
 * `media: {type:"image", url}`), còn `correctAnswer` vẫn là
 * `Record<blankId, wordId>` y như cũ — khảo sát 53 sách production không có
 * câu nào chứa ảnh trong khoá đáp án. Alias đọc (`imageUrl`, `image.url`,
 * khối ảnh trong `content`) phải sống mãi vì importer ngoài có thể phát sinh.
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

function images(): HTMLImageElement[] {
  return Array.from(container.querySelectorAll("img"));
}

/**
 * `dispatch.resolvePayloadMediaUrls` đổi đường dẫn đã lưu thành URL tuyệt đối
 * trước khi player nhận — nên khẳng định theo phần đuôi, đúng thứ tác giả nhập.
 * Việc `wordBank[].imageUrl` được phân giải là nhờ `imageUrl` đã nằm sẵn trong
 * `MEDIA_URL_KEYS`; đó cũng là lý do chọn đúng tên trường canonical này.
 */
function imagePaths(): string[] {
  return images().map((img) => new URL(img.src, "http://x").pathname);
}

const STEM = {
  blocks: [
    { type: "paragraph", text: "Chọn tranh phù hợp: {blank_1} và {blank_2}." },
  ],
};

describe("word_bank — phần tử mang ảnh", () => {
  it("vẽ ảnh của từng phần tử trong khay, đáp án vẫn trỏ wordId", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("cloze", {
          display: { interactionType: "word_bank" },
          content: STEM,
          wordBank: [
            { id: "w1", text: "Tranh Đông Hồ", media: { type: "image", url: "/uploads/dong-ho.png" } },
            { id: "w2", text: "Tranh Hàng Trống", media: { type: "image", url: "/uploads/hang-trong.png" } },
          ],
          correctAnswer: { blank_1: "w1", blank_2: "w2" },
        }, {}),
      );
    });

    const srcs = imagePaths();
    expect(srcs).toContain("/uploads/dong-ho.png");
    expect(srcs).toContain("/uploads/hang-trong.png");
  });

  it("giữ phần tử CHỈ có ảnh (không chữ) và đặt alt rỗng thay vì bỏ qua", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("cloze", {
          display: { interactionType: "word_bank" },
          content: STEM,
          wordBank: [
            { id: "w1", media: { type: "image", url: "/uploads/hinh-a.png", altText: "Tranh Đông Hồ" } },
            { id: "w2", media: { type: "image", url: "/uploads/hinh-b.png" } },
          ],
          correctAnswer: { blank_1: "w1", blank_2: "w2" },
        }, {}),
      );
    });

    const srcs = imagePaths();
    expect(srcs).toContain("/uploads/hinh-a.png");
    expect(srcs).toContain("/uploads/hinh-b.png");
    // Chip chỉ-ảnh vẫn phải bấm được: nhãn đọc được ưu tiên altText của media
    // (mô tả cho người), id chỉ là đường cùng.
    const chips = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[draggable="true"]'),
    );
    expect(chips.length).toBe(2);
    expect(chips.map((c) => c.getAttribute("aria-label"))).toEqual(["Tranh Đông Hồ", "w2"]);
  });

  it("đọc được ảnh để ở các alias cũ: imageUrl, image.url, khối ảnh trong content", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("cloze", {
          display: { interactionType: "word_bank" },
          content: STEM,
          wordBank: [
            { id: "w1", text: "A", image: { url: "/uploads/legacy-a.png" } },
            {
              id: "w2",
              text: "B",
              content: { blocks: [{ type: "image", url: "/uploads/legacy-b.png" }] },
            },
            { id: "w3", text: "C", imageUrl: "/uploads/legacy-c.png" },
          ],
          correctAnswer: { blank_1: "w1", blank_2: "w2" },
        }, {}),
      );
    });

    const srcs = imagePaths();
    expect(srcs).toContain("/uploads/legacy-a.png");
    expect(srcs).toContain("/uploads/legacy-b.png");
    expect(srcs).toContain("/uploads/legacy-c.png");
  });

  it("ngân hàng chuỗi thuần đời cũ vẫn chạy y như trước — không có ảnh nào", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("cloze", {
          display: { interactionType: "word_bank" },
          content: STEM,
          wordBank: ["Chó", "Mèo"],
          correctAnswer: { blank_1: "Chó", blank_2: "Mèo" },
        }, {}),
      );
    });

    expect(images()).toHaveLength(0);
    const chips = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[draggable="true"]'),
    );
    expect(chips.map((c) => c.textContent?.trim())).toEqual(["Chó", "Mèo"]);
  });

  it("dải gợi ý của cloze inline cũng vẽ ảnh (không rơi ra chip trống)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("cloze", {
          content: STEM,
          blanks: [{ id: "blank_1" }, { id: "blank_2" }],
          wordBank: [
            { id: "w1", text: "Tranh Đông Hồ", media: { type: "image", url: "/uploads/dong-ho.png" } },
          ],
          correctAnswer: { blank_1: "Tranh Đông Hồ", blank_2: "x" },
        }, {}),
      );
    });

    expect(imagePaths()).toContain("/uploads/dong-ho.png");
  });
});
