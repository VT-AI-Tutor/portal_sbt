/**
 * Khay/nhóm CHIP luôn wrap ngang, KHÔNG đọc `display.layout` (Owner 31/7).
 *
 * Hồi quy `b5_i4_q1` (classification/buckets, `display.layout = "list"`): các
 * thẻ từ rất ngắn ("sấm", "hươu", "giờ"…) bị xếp DỌC mỗi thẻ một dòng, câu dài
 * lê thê, cuộn mãi không hết. `list` là ý đồ thật với thẻ phương án DÀI, nhưng
 * vô nghĩa với chip một từ — và theo luật Owner 30/7, `display.layout` chỉ
 * quyết định CÁCH XẾP, nên với chip cách xếp đúng luôn là wrap ngang.
 *
 * `data-layout-region` + `data-display-layout` vẫn giữ nguyên để QA soi được
 * layout tác giả khai; chỉ CLASS là không theo nữa.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/content/assetUrl", () => ({
  resolveAssetUrl: (u?: string) => (!u ? "" : u),
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

const render = (type: string, payload: unknown) =>
  act(() => {
    root.render(renderInteractionPlayer(type, payload as never, {} as never));
  });

const region = (name: string) =>
  container.querySelector<HTMLElement>(`[data-layout-region="${name}"]`);

/** Chip ngắn đúng hình dạng payload đã báo lỗi. */
const SHORT_WORDS = ["sấm", "hươu", "giờ", "trời", "mưa", "gió"];

describe("classification/buckets — khay chip (b5_i4_q1)", () => {
  const payload = {
    display: { interactionType: "buckets", layout: "list" },
    categories: [
      { id: "c1", label: "Nhóm 1" },
      { id: "c2", label: "Nhóm 2" },
    ],
    items: SHORT_WORDS.map((text, i) => ({ id: `i${i}`, text })),
    correctAnswer: SHORT_WORDS.map((_, i) => ({
      itemId: `i${i}`,
      categoryId: i % 2 === 0 ? "c1" : "c2",
    })),
  };

  it('layout "list" KHÔNG còn xếp khay chip thành cột dọc', () => {
    render("classification", payload);
    const tray = region("classification-tray")!;
    expect(tray).toBeTruthy();
    expect(tray.className).toContain("flex-wrap");
    expect(tray.className).not.toContain("flex-col");
    expect(tray.className).not.toContain("grid");
  });

  it("vẫn giữ dấu vết layout tác giả khai cho QA soi", () => {
    render("classification", payload);
    expect(region("classification-tray")!.getAttribute("data-display-layout")).toBe("list");
  });

  it("render đủ chip và chạm-để-chọn vẫn hoạt động", () => {
    render("classification", payload);
    const tray = region("classification-tray")!;
    const chips = tray.querySelectorAll("button");
    expect(chips).toHaveLength(SHORT_WORDS.length);

    // Chạm để chọn: chip nhận trạng thái chọn, không văng lỗi.
    act(() => chips[0].dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(region("classification-tray")!.querySelectorAll("button").length).toBe(
      SHORT_WORDS.length,
    );
  });

  it("nhóm chip TRONG rổ cũng wrap ngang", () => {
    render("classification", payload);
    const inBucket = container.querySelector<HTMLElement>(
      '[data-layout-region="classification-bucket-items"]',
    )!;
    expect(inBucket.className).toContain("flex-wrap");
    expect(inBucket.className).not.toContain("flex-col");
  });
});

describe("các khay chip cùng họ", () => {
  it("classification/two_bucket: khay và hai rổ đều wrap ngang", () => {
    render("classification", {
      display: { interactionType: "two_bucket", layout: "list" },
      categories: [
        { id: "c1", label: "Đúng" },
        { id: "c2", label: "Sai" },
      ],
      items: SHORT_WORDS.map((text, i) => ({ id: `i${i}`, text })),
      correctAnswer: SHORT_WORDS.map((_, i) => ({
        itemId: `i${i}`,
        categoryId: i % 2 === 0 ? "c1" : "c2",
      })),
    });
    const trays = container.querySelectorAll<HTMLElement>("[data-layout-region]");
    expect(trays.length).toBeGreaterThan(0);
    trays.forEach((tray) => {
      expect(tray.className).toContain("flex-wrap");
      expect(tray.className).not.toContain("flex-col");
    });
  });

  it("sequencing/timeline: khay chip wrap ngang", () => {
    render("sequencing", {
      display: { interactionType: "timeline", layout: "list" },
      items: SHORT_WORDS.slice(0, 4).map((text, i) => ({ id: `i${i}`, text })),
      correctAnswer: ["i0", "i1", "i2", "i3"],
    });
    const tray = region("timeline-tray");
    if (tray) {
      expect(tray.className).toContain("flex-wrap");
      expect(tray.className).not.toContain("flex-col");
    }
  });
});

describe("thẻ PHƯƠNG ÁN thì KHÔNG đổi — `list` vẫn là cột dọc", () => {
  it("single_choice giữ nguyên cột dọc khi tác giả khai list", () => {
    render("single_choice", {
      display: { interactionType: "radio", layout: "list" },
      content: { blocks: [{ type: "paragraph", text: "Chọn đáp án đúng." }] },
      options: [
        { id: "A", text: "Một phương án dài cần trọn một dòng" },
        { id: "B", text: "Một phương án dài khác" },
      ],
      correctAnswer: "A",
    });
    const group = container.querySelector<HTMLElement>("[data-display-layout]")!;
    expect(group.className).toContain("flex-col");
  });
});

describe("rổ phân loại: kéo chip vào chỉ CAO lên, KHÔNG rộng ra", () => {
  /** Nhãn dài đúng kiểu payload thật đã làm rổ phình ngang. */
  const LONG = [
    "a. Làm thức ăn bị nhiễm bẩn",
    "b. Gây bệnh đường tiêu hoá",
    "c. Ruồi nhặng đậu vào",
    "d. Rửa tay trước khi ăn",
    "e. Làm thức ăn bị nhiễm bẩn",
  ];
  const payload = {
    display: { interactionType: "buckets", layout: "list" },
    categories: [
      { id: "c1", label: "Nên làm" },
      { id: "c2", label: "Không nên làm" },
    ],
    items: LONG.map((text, i) => ({ id: `i${i}`, text })),
    correctAnswer: LONG.map((_, i) => ({ itemId: `i${i}`, categoryId: "c1" })),
  };

  const buckets = () =>
    Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-layout-region="classification-bucket-items"]',
      ),
    ).map((region) => region.parentElement as HTMLElement);

  it("rổ chia đều lấp đầy chiều rộng, không còn max-content và không còn vùng cuộn ngang", () => {
    render("classification", payload);
    const grid = buckets()[0].parentElement as HTMLElement;
    // Rổ dùng flex-wrap + `grow` (bề rộng breakpoint làm ngưỡng wrap, rổ nở lấp
    // đầy hàng) thay cho lưới cứng grid-cols — xem CategorizePlayer.
    expect(grid.className).toContain("flex");
    expect(grid.className).toContain("flex-wrap");
    expect(grid.className).not.toContain("grid-cols");
    expect(grid.className).not.toContain("max-content");
    // Bọc cuộn ngang cũ đã bị gỡ — không tổ tiên nào của rổ còn overflow-x-auto.
    for (let el: HTMLElement | null = grid; el && el !== container; el = el.parentElement) {
      expect(el.className).not.toContain("overflow-x-auto");
    }
  });

  it("chip nhãn dài được wrap/ngắt chữ chứ không đẩy rổ rộng ra", () => {
    render("classification", payload);
    const tray = region("classification-tray")!;
    const chip = tray.querySelector("button")!;
    expect(chip.className).toContain("max-w-full");
    expect(chip.className).toContain("min-w-0");
    expect(chip.className).toContain("break-words");
  });

  it("đặt HẾT chip vào một rổ: cấu trúc rổ không đổi, chip nằm trong rổ", () => {
    render("classification", payload);
    const widthDefiningClassBefore = (buckets()[0].parentElement as HTMLElement).className;

    // Chạm chip rồi chạm rổ = đặt chip vào rổ (đường tap-to-select).
    for (let i = 0; i < LONG.length; i++) {
      const tray = region("classification-tray")!;
      const chip = tray.querySelector("button");
      if (!chip) break;
      act(() => chip.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      const bucket = buckets()[0];
      act(() => bucket.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    }

    const first = container.querySelectorAll<HTMLElement>(
      '[data-layout-region="classification-bucket-items"]',
    )[0];
    expect(first.querySelectorAll("button").length).toBe(LONG.length);
    // Lưới rổ vẫn là lưới chia đều y như lúc rỗng — chiều rộng do CỘT quyết
    // định, không do nội dung (jsdom không layout nên khoá bằng class).
    expect((buckets()[0].parentElement as HTMLElement).className).toBe(
      widthDefiningClassBefore,
    );
    expect(first.className).toContain("flex-wrap");
  });
});
