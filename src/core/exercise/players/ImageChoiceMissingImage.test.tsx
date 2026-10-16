/**
 * Phương án image-choice CHƯA CÓ ẢNH không được render `<img src="">`.
 *
 * `adaptImageOptions` từng ép `contentImageUrl(o) ?? ""`, nên mỗi phương án
 * thiếu ảnh sinh một `<img src="">`: React log lỗi ("An empty string was passed
 * to the src attribute…") và trình duyệt tải lại chính trang hiện tại.
 *
 * Hợp đồng render trung thực: không có ảnh thì nói thẳng "Chưa có ảnh", không
 * bịa `<img>` rỗng.
 *
 * jsdom không layout → test khoá DOM, không đo pixel.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { ImageChoiceMultiPlayer } from "./ImageChoiceMultiPlayer";
import { ImageChoiceSinglePlayer } from "./ImageChoiceSinglePlayer";

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

/** Phương án có ảnh (khối `image` trong content, dạng dữ liệu thật của sách). */
const withImage = (i: number) => ({
  id: `o${i}`,
  content: {
    blocks: [
      { type: "image", url: `/uploads/books/x/assets/opt_${i}.png`, alt: `Ảnh ${i}` },
      { type: "paragraph", content: [{ text: `Phương án ${i}`, annotations: {} }] },
    ],
  },
});

/** Phương án CHỈ có chữ — tác giả chưa gắn ảnh cho nó. */
const withoutImage = (i: number) => ({
  id: `o${i}`,
  content: {
    blocks: [{ type: "paragraph", content: [{ text: `Phương án ${i}`, annotations: {} }] }],
  },
});

const payload = () => ({
  content: { blocks: [{ type: "paragraph", content: [{ text: "Chọn hình đúng.", annotations: {} }] }] },
  display: { layout: "grid_2", interactionType: "image" },
  selfAssessment: true,
  options: [withImage(1), withoutImage(2), withImage(3), withoutImage(4)],
});

describe("image-choice: phương án thiếu ảnh", () => {
  it.each(["multiple_choice", "single_choice"] as const)(
    "%s: không có `<img src=\"\">`, chỉ đúng số ảnh thật",
    (schemaType) => {
      act(() => {
        root.render(renderInteractionPlayer(schemaType, payload(), {}));
      });

      const imgs = Array.from(container.querySelectorAll("img"));
      expect(imgs).toHaveLength(2);
      for (const img of imgs) {
        // `getAttribute` chứ không phải `img.src` — jsdom phân giải src rỗng
        // thành URL của trang, đúng cái hành vi tải lại trang đang bị lỗi.
        expect(img.getAttribute("src")).toBeTruthy();
      }
    },
  );

  it("nói thẳng 'Chưa có ảnh' cho đúng những phương án thiếu ảnh", () => {
    act(() => {
      root.render(renderInteractionPlayer("multiple_choice", payload(), {}));
    });

    const cards = Array.from(container.querySelectorAll<HTMLElement>('[role="checkbox"]'));
    expect(cards).toHaveLength(4);
    const missing = cards.filter((c) => c.textContent?.includes("Chưa có ảnh"));
    expect(missing).toHaveLength(2);
    // Đúng hai thẻ không ảnh, và chúng vẫn giữ nhãn chữ của mình.
    for (const card of missing) expect(card.querySelector("img")).toBeNull();
    for (const card of cards.filter((c) => !missing.includes(c))) {
      expect(card.querySelector("img")).not.toBeNull();
    }
  });

  it("phương án có ảnh không bị chèn placeholder", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "single_choice",
          { ...payload(), options: [withImage(1), withImage(2)] },
          {},
        ),
      );
    });
    expect(container.textContent).not.toContain("Chưa có ảnh");
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  // Chuỗi rỗng cũng là "chưa có ảnh": dữ liệu cũ / caller khác vẫn có thể truyền
  // `imageUrl: ""`, và đó chính là thứ sinh ra `<img src="">`.
  it.each([undefined, ""] as const)("player nhận imageUrl=%o vẫn không dựng <img>", (imageUrl) => {
    const options = [{ id: "a", imageUrl, text: "A" }];
    act(() => {
      root.render(<ImageChoiceMultiPlayer title="Q" options={options} correctIds={["a"]} />);
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Chưa có ảnh");

    act(() => {
      root.render(<ImageChoiceSinglePlayer title="Q" options={options} correctId="a" />);
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Chưa có ảnh");
  });
});
