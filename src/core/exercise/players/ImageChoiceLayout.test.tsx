/**
 * Bố cục image-choice (Owner 30/7 — layout của web thắng, sửa ngược vào studio):
 *
 * - MẶC ĐỊNH (tác giả không khai display.layout → manifest cắm authored:false):
 *   lưới thẻ vuông count-aware — 2 hoặc 4 phương án → 2 cột (2×2 cân cho 4,
 *   tránh 3+1 lệch); còn lại 2/3 responsive. Ảnh phương án nằm trong HỘP CAO
 *   CỐ ĐỊNH (`h-40 sm:h-44`) + `object-contain` — KHÔNG còn `w-full aspect-square`
 *   (ăn theo bề rộng ô lưới → phình ~500px, tràn trên desktop). Lưới cũng bị
 *   chặn `max-w-2xl mx-auto`. (KHÔNG ContentImage natural-size — policy đó dành
 *   cho ảnh NỘI DUNG, không phải thumbnail phương án).
 * - Tác giả khai display.layout tường minh thì `layoutContainerClass` thắng.
 *
 * jsdom không layout — test khoá class container + data-display-layout + class ảnh.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ImageChoiceSinglePlayer } from "./ImageChoiceSinglePlayer";
import { ImageChoiceMultiPlayer } from "./ImageChoiceMultiPlayer";
import { normalizeDisplayLayout } from "@/core/exercise/display-layout";

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

const opts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `o${i}`, imageUrl: `/img-${i}.png`, text: `PA ${i}` }));

const grid = () => container.querySelector<HTMLElement>("[data-display-layout]")!;

describe("ImageChoiceSinglePlayer — lưới thẻ vuông count-aware mặc định", () => {
  it.each([
    [2, "grid_2"],
    [4, "grid_2"],
  ] as const)("%i phương án → 2 cột cố định (không responsive 3)", (n, key) => {
    act(() => {
      root.render(<ImageChoiceSinglePlayer title="Q" options={opts(n)} correctId="o0" />);
    });
    expect(grid().className).toContain("grid-cols-2");
    expect(grid().className).not.toContain("sm:grid-cols-3");
    expect(grid().dataset.displayLayout).toBe(key);
  });

  it.each([3, 5, 6])("%i phương án → 2/3 responsive", (n) => {
    act(() => {
      root.render(<ImageChoiceSinglePlayer title="Q" options={opts(n)} correctId="o0" />);
    });
    expect(grid().className).toContain("grid-cols-2");
    expect(grid().className).toContain("sm:grid-cols-3");
    expect(grid().dataset.displayLayout).toBe("grid_3");
  });

  it("ResolvedLayout fallback (authored:false) cũng ra lưới count-aware", () => {
    act(() => {
      root.render(
        <ImageChoiceSinglePlayer
          title="Q"
          options={opts(4)}
          correctId="o0"
          layout={{ ...normalizeDisplayLayout("list"), authored: false }}
        />,
      );
    });
    expect(grid().className).toContain("grid-cols-2");
    expect(grid().dataset.displayLayout).toBe("grid_2");
  });

  it("ảnh phương án nằm trong hộp cao cố định + object-contain (không phình theo bề rộng ô)", () => {
    act(() => {
      root.render(<ImageChoiceSinglePlayer title="Q" options={opts(2)} correctId="o0" />);
    });
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs).toHaveLength(2);
    for (const img of imgs) {
      // Ảnh bị chặn TRONG hộp: object-contain + max-h-full, KHÔNG còn aspect-square.
      expect(img.className).toContain("object-contain");
      expect(img.className).toContain("max-h-full");
      expect(img.className).not.toContain("aspect-square");
      // Hộp media bọc ảnh có chiều cao cố định (trần cao, không ăn theo cột).
      expect(img.parentElement!.className).toContain("h-40");
    }
    // Lưới bị chặn bề rộng để 2 cột không kéo dài hết container rộng.
    expect(grid().className).toContain("max-w-2xl");
  });

  it("tác giả khai display.layout tường minh thì layout đó thắng (string)", () => {
    act(() => {
      root.render(
        <ImageChoiceSinglePlayer title="Q" options={opts(4)} correctId="o0" layout="list" />,
      );
    });
    expect(grid().className).toContain("flex-col");
    expect(grid().className).not.toContain("grid-cols-2");
    expect(grid().dataset.displayLayout).toBe("list");
  });

  it("tác giả khai tường minh thắng (ResolvedLayout authored:true)", () => {
    act(() => {
      root.render(
        <ImageChoiceSinglePlayer
          title="Q"
          options={opts(3)}
          correctId="o0"
          layout={{ ...normalizeDisplayLayout("grid_4"), authored: true }}
        />,
      );
    });
    expect(grid().className).toContain("lg:grid-cols-4");
    expect(grid().dataset.displayLayout).toBe("grid_4");
  });
});

describe("ImageChoiceMultiPlayer — cùng quy tắc lưới", () => {
  it("mặc định 4 phương án → 2 cột, ảnh vuông", () => {
    act(() => {
      root.render(<ImageChoiceMultiPlayer title="Q" options={opts(4)} correctIds={["o0"]} />);
    });
    expect(grid().className).toContain("grid-cols-2");
    expect(grid().className).not.toContain("sm:grid-cols-3");
    expect(grid().dataset.displayLayout).toBe("grid_2");
    const img = container.querySelector("img")!;
    expect(img.className).toContain("object-contain");
    expect(img.className).not.toContain("aspect-square");
    expect(img.parentElement!.className).toContain("h-40");
  });

  it("mặc định 5 phương án → 2/3 responsive", () => {
    act(() => {
      root.render(<ImageChoiceMultiPlayer title="Q" options={opts(5)} correctIds={["o0"]} />);
    });
    expect(grid().className).toContain("sm:grid-cols-3");
    expect(grid().dataset.displayLayout).toBe("grid_3");
  });

  it("tác giả khai display.layout tường minh thì layout đó thắng", () => {
    act(() => {
      root.render(
        <ImageChoiceMultiPlayer title="Q" options={opts(4)} correctIds={["o0"]} layout="grid_3" />,
      );
    });
    expect(grid().className).toContain("lg:grid-cols-3");
    expect(grid().dataset.displayLayout).toBe("grid_3");
  });
});
