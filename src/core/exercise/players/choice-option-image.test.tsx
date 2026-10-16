/**
 * Ảnh của lựa chọn chỉ được vẽ MỘT lần, và thẻ lựa chọn không rộng hơn ảnh.
 *
 * Hồi quy cho `b34_q3` (VBT Toán 2 - Tập 1, "Tô màu vào các hình tứ giác"):
 * mỗi hình hiện hai lần trong cùng một thẻ — một bản to (ContentImage, kích
 * thước gốc) cạnh một bản nhỏ có khung trắng (RichContentBlocks). Nguyên nhân
 * ở `adaptOptions` (dispatch): nó suy ra `imageUrl` từ chính block ảnh đầu tiên
 * của `content` rồi vẫn truyền nguyên `content` xuống player, nên player vẽ cả
 * hai. Xem `optionBodyNode` trong ./shared.
 *
 * jsdom không layout, nên test khoá đường ống: số thẻ <img> và class chiều rộng
 * của thẻ lựa chọn.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MultiChoicePlayer } from "./MultiChoicePlayer";
import { SingleChoicePlayer } from "./SingleChoicePlayer";

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

const imgs = () => Array.from(container.querySelectorAll("img"));
const optionCards = () =>
  Array.from(container.querySelectorAll<HTMLElement>('[role="checkbox"], [role="radio"]'));

/** Lựa chọn chỉ có ảnh, đúng hình dạng dispatch tạo ra cho b34_q3. */
function pictureOption(id: string, url: string) {
  return {
    id,
    imageUrl: url,
    content: { blocks: [{ type: "image" as const, url, alt: `Hình ${id}` }] },
  };
}

describe("lựa chọn chỉ có ảnh — không lặp ảnh, thẻ ôm sát ảnh", () => {
  it("multiple_choice / color_fill (b34_q3) vẽ đúng một ảnh mỗi lựa chọn", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Tô màu vào các hình tứ giác."
          variant="color_fill"
          layout="list"
          options={[pictureOption("A", "/s1.png"), pictureOption("B", "/s2.png")]}
          correctIds={["B"]}
        />,
      );
    });
    expect(imgs().map((img) => img.getAttribute("src"))).toEqual(["/s1.png", "/s2.png"]);
  });

  it("thẻ color_fill không kéo rộng hết cột khi chỉ có ảnh", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Tô màu vào các hình tứ giác."
          variant="color_fill"
          layout="list"
          options={[pictureOption("A", "/s1.png")]}
          correctIds={["A"]}
        />,
      );
    });
    const card = optionCards()[0];
    expect(card.className).toContain("w-fit");
    // Không còn cột nội dung rỗng — chính nó đã đẩy thẻ rộng ra trước đây.
    expect(card.querySelector(".flex-1")).toBeNull();
  });

  it("single_choice / circle cũng chỉ vẽ một ảnh", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Khoanh vào hình đúng"
          variant="circle"
          layout="list"
          options={[pictureOption("A", "/s1.png"), pictureOption("B", "/s2.png")]}
          correctId="A"
        />,
      );
    });
    expect(imgs()).toHaveLength(2);
  });

  it("lựa chọn có ảnh KÈM chú thích vẫn giữ cả hai, thẻ giữ chiều rộng cũ", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn hình"
          variant="color_fill"
          layout="list"
          options={[
            {
              id: "A",
              imageUrl: "/s1.png",
              content: {
                blocks: [
                  { type: "image", url: "/s1.png", alt: "Hình thang" },
                  { type: "paragraph", text: "Hình thang" },
                ],
              },
            },
          ]}
          correctIds={["A"]}
        />,
      );
    });
    expect(imgs()).toHaveLength(1);
    expect(container.textContent).toContain("Hình thang");
    const card = optionCards()[0];
    expect(card.className).not.toContain("w-fit");
    expect(card.querySelector(".flex-1")).not.toBeNull();
  });

  it("ảnh riêng trong block khác ảnh `imageUrl` thì vẫn vẽ cả hai", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn hình"
          variant="checkbox"
          layout="list"
          options={[
            {
              id: "A",
              imageUrl: "/icon.png",
              content: { blocks: [{ type: "image", url: "/scan.png", alt: "Bản scan" }] },
            },
          ]}
          correctIds={["A"]}
        />,
      );
    });
    // `RichContentBlocks` đưa ảnh qua `resolveAssetUrl` nên src có thể là URL
    // tuyệt đối — chỉ cần đủ hai ảnh khác nhau, không phải cùng một ảnh vẽ đôi.
    const srcs = imgs().map((img) => img.getAttribute("src") ?? "");
    expect(srcs).toHaveLength(2);
    expect(srcs[0]).toBe("/icon.png");
    expect(srcs[1].endsWith("/scan.png")).toBe(true);
  });

  it("lựa chọn chỉ có chữ giữ nguyên bố cục cũ", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn đáp án"
          variant="checkbox"
          layout="list"
          options={[{ id: "A", text: "Một" }, { id: "B", text: "Hai" }]}
          correctIds={["A"]}
        />,
      );
    });
    expect(imgs()).toHaveLength(0);
    expect(container.textContent).toContain("Một");
    optionCards().forEach((card) => {
      expect(card.className).not.toContain("w-fit");
      expect(card.querySelector(".flex-1")).not.toBeNull();
    });
  });
});
