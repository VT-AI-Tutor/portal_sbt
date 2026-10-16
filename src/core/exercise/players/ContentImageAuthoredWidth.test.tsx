/**
 * `width` tác giả đặt trên KHỐI ẢNH của một mục phải tới được ảnh (issue #783).
 *
 * Ảnh của mục (ô nối, thẻ phân loại, ô bảng…) mặc định render ở kích thước
 * gốc — đúng cho bản scan vở bài tập, nhưng sai khi tác giả muốn một BIỂU
 * TƯỢNG NHỎ nằm cạnh chữ: ảnh nguồn ~600×600 chiếm gần trọn cột trái và bóp
 * phần chữ còn "một chữ mỗi dòng" (`b13_q4`, VBT Tin học 3). `width` là cách
 * duy nhất tác giả nói "cái này là icon", và trước đây nó bị bỏ trên đường từ
 * `content.blocks` tới `ContentImage`.
 *
 * jsdom không layout ảnh, nên bài test khoá ĐƯỜNG ỐNG: `width` của khối ảnh →
 * `imageWidth` của mục → `style.maxWidth` của thẻ `<img>`, giống hệt ảnh trong
 * `content.blocks` của câu (`RichContentBlocks`). Kích thước gốc vẫn là mặc
 * định khi KHÔNG có `width` — `ContentImageSizing`/`MatchItemImage` khoá phần đó.
 */
import { act } from "react";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/content/assetUrl", () => ({
  resolveAssetUrl: (u?: string) => (!u ? "" : u.startsWith("/") ? `https://api.test${u}` : u),
}));

import { renderInteractionPlayer } from "./dispatch";
import { ContentImage } from "./shared";

// TwoColumnMatchPlayer đo cột qua ResizeObserver; jsdom không có.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

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
function playerOf(type: string, payload: unknown) {
  return (renderInteractionPlayer(type, payload as never, {} as never) as WrappedPlayer).props
    .children.props.children;
}

const imgByAlt = (alt: string) => container.querySelector<HTMLImageElement>(`img[alt="${alt}"]`);

/** Khối ảnh icon cạnh một dòng chữ — đúng hình dạng payload của `b13_q4`. */
const iconBlocks = (alt: string, width?: string) => ({
  blocks: [
    { type: "paragraph", text: "1) Khởi động phần mềm trình chiếu từ biểu tượng trên màn hình nền:" },
    { type: "image", url: "/uploads/ppt.png", alt, align: "center", ...(width ? { width } : {}) },
  ],
});

describe("ContentImage — width tác giả", () => {
  it("áp `width` thành maxWidth; không có width thì không đặt maxWidth", () => {
    act(() => root.render(<ContentImage src="/a.png" alt="có" width="44px" />));
    expect(imgByAlt("có")?.style.maxWidth).toBe("44px");

    act(() => root.render(<ContentImage src="/a.png" alt="không" />));
    expect(imgByAlt("không")?.style.maxWidth).toBe("");
  });

  it("width tác giả thắng tuyệt đối — KHÔNG chồng thêm trần cao mặc định", () => {
    act(() => root.render(<ContentImage src="/a.png" alt="icon" width="44px" />));
    const img = imgByAlt("icon")!;
    expect(img.className).toContain("h-auto");
    expect(img.className).toContain("w-auto");
    expect(img.style.maxWidth).toBe("44px");
    // Đây là điểm mấu chốt của #783: đã khai width thì trần cao mặc định
    // (MEDIA_ITEM_MAX_HEIGHT) không được áp chồng lên ý đồ tác giả.
    expect(img.style.maxHeight).toBe("");
  });
});

describe("matching · columns — icon nhỏ inline trong ô nối (b13_q4)", () => {
  const matchingPayload = (width?: string) => ({
    display: { interactionType: "columns" },
    leftItems: [{ id: "L1", content: iconBlocks("Biểu tượng PowerPoint", width) }],
    rightItems: [{ id: "R1", text: "Trình chiếu" }],
    correctAnswer: { L1: "R1" },
  });

  // Ô nối đặt `alt` theo CHỮ của mục (không phải alt của khối), nên chọn theo src.
  const itemImg = () =>
    container.querySelector<HTMLImageElement>('img[src="https://api.test/uploads/ppt.png"]');

  it("width của khối ảnh tới được thẻ <img> trong ô nối", () => {
    act(() => root.render(renderInteractionPlayer("matching", matchingPayload("44px") as never, {} as never)));
    expect(itemImg()).not.toBeNull();
    expect(itemImg()?.style.maxWidth).toBe("44px");
  });

  it("không khai width → ảnh giữ kích thước gốc, không maxWidth", () => {
    act(() => root.render(renderInteractionPlayer("matching", matchingPayload() as never, {} as never)));
    expect(itemImg()).not.toBeNull();
    expect(itemImg()?.style.maxWidth).toBe("");
  });

  it("width dạng % bị BỎ — ảnh giữ kích thước gốc như trước #783", () => {
    // 151 câu trong kho đang mang `%` chưa từng được kiểm bằng mắt (59 câu ≤25%,
    // thấp nhất 7%); bật lên là tái diễn lớp lỗi "ảnh quá bé" của PR #644.
    act(() => root.render(renderInteractionPlayer("matching", matchingPayload("20%") as never, {} as never)));
    expect(itemImg()).not.toBeNull();
    expect(itemImg()?.style.maxWidth).toBe("");
  });

  it("alias phẳng `imageUrl` thắng URL nên KHÔNG mượn width của khối ảnh", () => {
    const player = playerOf("matching", {
      display: { interactionType: "columns" },
      leftItems: [{ id: "L1", imageUrl: "/uploads/phang.png", content: iconBlocks("khối", "44px") }],
      rightItems: [{ id: "R1", text: "Trình chiếu" }],
      correctAnswer: { L1: "R1" },
    });
    const left = player.props.leftItems as Array<{ imageUrl?: string; imageWidth?: string }>;
    expect(left[0].imageUrl).toBe("https://api.test/uploads/phang.png");
    expect(left[0].imageWidth).toBeUndefined();
  });
});

describe("cùng khuôn mẫu — các nhóm player khác cũng nhận width", () => {
  it("phân loại/buckets: thẻ mục và tiêu đề nhóm", () => {
    const player = playerOf("classification", {
      categories: [{ id: "c1", content: iconBlocks("nhóm", "60px") }, { id: "c2", label: "Nhóm 2" }],
      items: [{ id: "i1", content: iconBlocks("thẻ", "48px") }],
      correctAnswer: [{ itemId: "i1", categoryId: "c1" }],
    });
    const cats = player.props.categories as Array<{ imageWidth?: string }>;
    const items = player.props.items as Array<{ imageWidth?: string }>;
    expect(cats[0].imageWidth).toBe("60px");
    expect(cats[1].imageWidth).toBeUndefined();
    expect(items[0].imageWidth).toBe("48px");
  });

  it("phân loại/two_bucket: rổ", () => {
    const player = playerOf("classification", {
      display: { interactionType: "two_bucket" },
      categories: [{ id: "c1", content: iconBlocks("rổ", "52px") }, { id: "c2", label: "Nhóm 2" }],
      items: [{ id: "i1", text: "x" }],
      correctAnswer: [{ itemId: "i1", categoryId: "c1" }],
    });
    expect((player.props.buckets as Array<{ imageWidth?: string }>)[0].imageWidth).toBe("52px");
  });

  it("card_sort: chồng thẻ theo nhóm", () => {
    const player = playerOf("card_sort", {
      categories: [{ id: "c1", content: iconBlocks("nhóm", "40px") }],
      cards: [{ id: "k1", text: "x" }],
      correctAnswer: [{ cardId: "k1", categoryId: "c1" }],
    });
    expect((player.props.categories as Array<{ imageWidth?: string }>)[0].imageWidth).toBe("40px");
  });

  it("labeling: nhãn kéo thả", () => {
    const player = playerOf("labeling", {
      image: { url: "/uploads/diagram.png" },
      labels: [{ id: "l1", content: iconBlocks("nhãn", "32px") }],
      targets: [{ id: "t1", x: 0.5, y: 0.5 }],
      correctAnswer: [{ labelId: "l1", targetId: "t1" }],
    });
    expect((player.props.labels as Array<{ imageWidth?: string }>)[0].imageWidth).toBe("32px");
  });

  it("multi_true_false: cột phát biểu và cột tình huống", () => {
    const player = playerOf("multi_true_false", {
      statements: [
        { id: "s1", content: iconBlocks("phát biểu", "36px"), situation: iconBlocks("tình huống", "28px") },
      ],
      correctAnswer: { s1: true },
    });
    const stmts = player.props.statements as Array<{ imageWidth?: string; situationImageWidth?: string }>;
    expect(stmts[0].imageWidth).toBe("36px");
    expect(stmts[0].situationImageWidth).toBe("28px");
  });

  it("table_completion: ô tĩnh trong bảng", () => {
    const player = playerOf("table_completion", {
      table: {
        headers: [{ id: "h1", label: "H" }],
        rows: [
          { id: "r1", cells: [{ columnId: "h1", cellType: "text", content: iconBlocks("ô", "24px") }] },
          { id: "r2", cells: [{ columnId: "h1", cellType: "text", text: "chữ" }] },
        ],
      },
      correctAnswer: {},
    });
    const table = player.props.table as { bodyRows: Array<{ cells: Array<{ imageWidth?: string }> }> };
    expect(table.bodyRows[0].cells[0].imageWidth).toBe("24px");
    expect(table.bodyRows[1].cells[0].imageWidth).toBeUndefined();
  });

  it("bảng tick: nhãn hàng", () => {
    const player = playerOf("checkbox_table", {
      columns: [{ id: "c1", label: "Cột" }],
      rows: [{ id: "r1", content: iconBlocks("hàng", "30px") }],
      correctAnswer: { r1: ["c1"] },
    });
    expect((player.props.rows as Array<{ imageWidth?: string }>)[0].imageWidth).toBe("30px");
  });
});
