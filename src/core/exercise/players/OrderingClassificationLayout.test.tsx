import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DisplayLayout } from "@/core/exercise/display-layout";
import { SkinProvider } from "@/core/exercise/skin";
import type { QuestionPlayerSkin } from "@/core/exercise/skin";
import { MEDIA_ITEM_MAX_HEIGHT, MEDIA_ORDER_ITEM_MAX_HEIGHT } from "./shared";
import { CategorizePlayer } from "./CategorizePlayer";
import { ProcessSequencePlayer } from "./ProcessSequencePlayer";
import { RankPlayer } from "./RankPlayer";
import { ReorderListPlayer } from "./ReorderListPlayer";
import { TimelinePlayer } from "./TimelinePlayer";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";

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

const items = [
  { id: "one", text: "Một" },
  { id: "two", text: "Hai" },
  { id: "three", text: "Ba" },
];

function render(player: ReactElement) {
  act(() => root.render(player));
}

function layoutRegion(name: string) {
  const region = container.querySelector<HTMLElement>(`[data-layout-region="${name}"]`);
  expect(region).not.toBeNull();
  return region!;
}

function expectClassTokens(element: HTMLElement, tokens: string[]) {
  for (const token of tokens) expect(element.classList.contains(token)).toBe(true);
}

describe("ordering display layouts", () => {
  it.each<[DisplayLayout, string[]]>([
    ["list", ["flex", "flex-col"]],
    ["grid_2", ["grid", "sm:grid-cols-2"]],
    ["grid_4", ["grid", "lg:grid-cols-4"]],
    ["inline", ["flex", "flex-wrap"]],
  ])("renders reorder items with the %s layout", (layout, classTokens) => {
    render(
      <ReorderListPlayer
        title="Sắp xếp"
        items={items}
        correctOrder={items.map((item) => item.id)}
        layout={layout}
      />,
    );

    const region = layoutRegion("ordering-items");
    expect(region.dataset.displayLayout).toBe(layout);
    expect(region.getAttribute("role")).toBe("list");
    expectClassTokens(region, classTokens);
    expect(region.querySelectorAll('[draggable="true"]')).toHaveLength(items.length);
    expect(region.querySelectorAll('[role="listitem"]')).toHaveLength(items.length);
  });

  // WEB08 — thẻ CÓ ẢNH mà tác giả không khai `display.layout` thì fallback
  // "list" của manifest làm 4 thẻ ảnh xếp một cột. Cùng luật image-choice:
  // không authored → lưới count-aware; authored → tôn trọng tác giả.
  const AUTO_MEDIA_SKIN: QuestionPlayerSkin = { presentation: { autoMediaSizing: true } };
  const imageItems = items.map((item) => ({ ...item, imageUrl: `/${item.id}.png` }));
  const notAuthored = { key: "list", mode: "list", flow: "column", columns: 1, order: "column-major", authored: false } as const;

  it.each([
    ["rank", (layout: never) => <RankPlayer title="Xếp hạng" items={imageItems} correctOrder={imageItems.map((i) => i.id)} layout={layout} />],
    ["reorder", (layout: never) => <ReorderListPlayer title="Sắp xếp" items={imageItems} correctOrder={imageItems.map((i) => i.id)} layout={layout} />],
  ])("%s: thẻ ảnh không khai layout → lưới, ảnh co theo ô", (_name, build) => {
    render(<SkinProvider skin={AUTO_MEDIA_SKIN}>{build(notAuthored as never)}</SkinProvider>);

    const region = layoutRegion("ordering-items");
    expectClassTokens(region, ["grid", "grid-cols-2"]);
    expect(region.classList.contains("flex-col")).toBe(false);
    expect(region.dataset.displayLayout).toBe("grid_3");
    const img = region.querySelector("img");
    expect(img).not.toBeNull();
    // Trần cao GIỮ NGUYÊN 22rem (luật 31/7 chống "ảnh quá bé"); bề rộng ô lưới
    // mới là thứ thu nhỏ ảnh, nên `shrink-0` phải bị gỡ.
    expect(img!.style.maxHeight).toBe(MEDIA_ITEM_MAX_HEIGHT);
    expect(img!.classList.contains("shrink-0")).toBe(false);
  });

  // Owner 10/8, ca `12773888/bai23` câu 5 ("Sắp xếp các bước trồng cây trong vỏ
  // trứng"): tác giả khai `inline` nên bố cục được tôn trọng, KHÔNG lên lưới —
  // nhưng ảnh giữ cỡ tự nhiên thì ba thẻ cao 361/341/385px, nội dung 1,76 màn.
  // Owner chốt "chỉ cần xử lý cho size ảnh nhỏ đi", nên trần cỡ phải cắn ở mọi
  // bố cục ngang, còn số cột vẫn do tác giả quyết.
  const inlineLayout = { key: "inline", mode: "inline", flow: "row", columns: 0, order: "row-major", authored: true } as const;

  it.each([
    ["rank", (layout: never) => <RankPlayer title="Xếp hạng" items={imageItems} correctOrder={imageItems.map((i) => i.id)} layout={layout} />],
    ["reorder", (layout: never) => <ReorderListPlayer title="Sắp xếp" items={imageItems} correctOrder={imageItems.map((i) => i.id)} layout={layout} />],
  ])("%s: `inline` tác giả khai giữ bố cục nhưng HẠ TRẦN ẢNH", (_name, build) => {
    render(<SkinProvider skin={AUTO_MEDIA_SKIN}>{build(inlineLayout as never)}</SkinProvider>);

    const region = layoutRegion("ordering-items");
    expect(region.dataset.displayLayout).toBe("inline");
    expect(region.classList.contains("grid")).toBe(false);
    const img = region.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.style.maxHeight).toBe(MEDIA_ORDER_ITEM_MAX_HEIGHT);
  });

  it("rank: `list` do TÁC GIẢ khai cũng thành lưới khi thẻ có ảnh", () => {
    // WEB08 — nội dung nhập thật khai `list` tường minh; "mỗi hàng một thẻ" áp
    // cho thẻ-là-ảnh thì mỗi hàng ăn trọn màn hình, nên `list` bị thay.
    render(
      <RankPlayer
        title="Xếp hạng"
        items={imageItems}
        correctOrder={imageItems.map((item) => item.id)}
        layout="list"
      />,
    );

    const region = layoutRegion("ordering-items");
    expectClassTokens(region, ["grid", "grid-cols-2"]);
    expect(region.classList.contains("flex-col")).toBe(false);
  });

  it("rank: layout NGANG tác giả khai vẫn được tôn trọng dù có ảnh", () => {
    render(
      <RankPlayer
        title="Xếp hạng"
        items={imageItems}
        correctOrder={imageItems.map((item) => item.id)}
        layout="grid_4"
      />,
    );

    const region = layoutRegion("ordering-items");
    expectClassTokens(region, ["grid", "lg:grid-cols-4"]);
    expect(region.dataset.displayLayout).toBe("grid_4");
  });

  it("applies layout to rank items", () => {
    render(
      <RankPlayer
        title="Xếp hạng"
        items={items}
        correctOrder={items.map((item) => item.id)}
        layout="inline"
      />,
    );

    expectClassTokens(layoutRegion("ordering-items"), ["flex", "flex-wrap"]);
  });

  it("keeps process arrows grouped with a grid of draggable steps", () => {
    render(
      <ProcessSequencePlayer
        title="Quy trình"
        items={items}
        correctOrder={items.map((item) => item.id)}
        layout="grid_4"
      />,
    );

    const region = layoutRegion("ordering-items");
    expectClassTokens(region, ["grid", "lg:grid-cols-4"]);
    expect(region.getAttribute("role")).toBe("list");
    expect(region.children).toHaveLength(items.length);
    expect(region.querySelectorAll(':scope > [role="listitem"]')).toHaveLength(items.length);
    expect(region.querySelectorAll('[draggable="true"]')).toHaveLength(items.length);
    expect(region.querySelectorAll(".lucide-arrow-right")).toHaveLength(items.length - 1);
  });

  it("KHAY chip luôn wrap ngang (bỏ qua layout), trục thời gian giữ nguyên", () => {
    render(
      <TimelinePlayer
        title="Dòng thời gian"
        items={items}
        slots={items.map((item) => ({ id: `slot-${item.id}`, label: item.text }))}
        correctOrder={items.map((item) => item.id)}
        layout="grid_2"
      />,
    );

    // Owner 31/7: khay CHIP không đọc `display.layout` nữa — chip là đơn vị nhỏ,
    // `list`/`grid_2` áp vào đó chỉ làm khay dài lê thê. Dấu vết layout tác giả
    // khai vẫn còn ở `data-display-layout` cho QA soi.
    const tray = layoutRegion("timeline-tray");
    expectClassTokens(tray, ["flex", "flex-wrap"]);
    expect(tray.classList.contains("grid")).toBe(false);
    expect(tray.getAttribute("data-display-layout")).toBe("grid_2");
    expect(tray.getAttribute("role")).toBe("group");
    expect(tray.querySelectorAll('[draggable="true"]')).toHaveLength(items.length);

    const axis = container.querySelector<HTMLElement>(".overflow-x-auto > .min-w-min");
    expect(axis).not.toBeNull();
    expectClassTokens(axis!, ["flex"]);
    expect(axis!.classList.contains("grid")).toBe(false);
  });
});

describe("classification display layouts", () => {
  it("KHAY + nhóm chip trong rổ luôn wrap ngang; lưới RỔ vẫn theo bố cục riêng", () => {
    render(
      <CategorizePlayer
        title="Phân loại"
        categories={[
          { id: "odd", label: "Lẻ" },
          { id: "even", label: "Chẵn" },
        ]}
        items={items}
        correctMappings={{ one: "odd", two: "even", three: "odd" }}
        layout="grid_4"
      />,
    );

    const tray = layoutRegion("classification-tray");
    expectClassTokens(tray, ["flex", "flex-wrap"]);
    expect(tray.classList.contains("grid")).toBe(false);
    // Layout tác giả khai vẫn được ghi lại, chỉ không còn quyết định CLASS.
    expect(tray.getAttribute("data-display-layout")).toBe("grid_4");
    expect(tray.getAttribute("role")).toBe("group");
    const bucketRegions = Array.from(
      container.querySelectorAll<HTMLElement>('[data-layout-region="classification-bucket-items"]'),
    );
    expect(bucketRegions).toHaveLength(2);
    bucketRegions.forEach((region) => {
      expectClassTokens(region, ["flex", "flex-wrap"]);
      expect(region.classList.contains("grid")).toBe(false);
      expect(region.getAttribute("role")).toBe("group");
    });

    const bucketGrid = bucketRegions[0].parentElement?.parentElement;
    expect(bucketGrid).not.toBeNull();
    // Owner 31/7: rổ rộng theo breakpoint (1/2/3 rổ mỗi hàng) LÀM NGƯỠNG WRAP,
    // còn `grow` cho rổ nở LẤP ĐẦY hết chiều rộng hàng (kể cả hàng thiếu rổ) mà
    // không vượt quá bề rộng. Bản cũ dùng `minmax(max-content,1fr)` cho ảnh tiêu
    // đề nhóm khỏi bị ép nhỏ, nhưng hệ quả là thả chip vào thì rổ phình ngang.
    expectClassTokens(bucketGrid!, ["flex", "flex-wrap"]);
    expect(bucketGrid!.classList.contains("grid")).toBe(false);
    expect(bucketGrid!.classList.contains("justify-center")).toBe(false);
    expect(bucketGrid!.className).not.toContain("max-content");
    const bucketBox = bucketRegions[0].parentElement!;
    expectClassTokens(bucketBox, [
      "grow",
      "w-full",
      "sm:w-[calc(50%-0.5rem)]",
      "lg:w-[calc(33.333%-0.6667rem)]",
    ]);
  });

  it("applies the layout to the tray and two bucket item regions", () => {
    render(
      <TwoBucketSortPlayer
        title="Chia hai nhóm"
        buckets={[
          { id: "yes", label: "Đúng" },
          { id: "no", label: "Sai" },
        ]}
        items={items}
        correctMappings={{ one: "yes", two: "no", three: "yes" }}
        layout="inline"
      />,
    );

    expectClassTokens(layoutRegion("classification-tray"), ["flex", "flex-wrap"]);
    expect(layoutRegion("classification-tray").getAttribute("role")).toBe("group");
    const bucketRegions = Array.from(
      container.querySelectorAll<HTMLElement>('[data-layout-region="classification-bucket-items"]'),
    );
    expect(bucketRegions).toHaveLength(2);
    bucketRegions.forEach((region) => {
      expectClassTokens(region, ["flex", "flex-wrap"]);
      expect(region.getAttribute("role")).toBe("group");
    });

    const bucketGrid = bucketRegions[0].parentElement?.parentElement;
    expect(bucketGrid).not.toBeNull();
    // Hai rổ chia ĐÔI cứng — xem chú thích ở bài test trên.
    expectClassTokens(bucketGrid!, ["grid", "grid-cols-2"]);
    expect(bucketGrid!.className).not.toContain("max-content");
    expect(bucketGrid!.classList.contains("lg:grid-cols-4")).toBe(false);
  });
});
