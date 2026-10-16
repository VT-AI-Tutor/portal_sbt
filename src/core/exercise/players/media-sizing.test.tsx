/**
 * Cỡ ảnh khi câu hỏi có NHIỀU ảnh (31/7).
 *
 * Bối cảnh đo được trên kho thật (1577 câu trong DB studio, 500 file ảnh đã
 * import): ảnh cao trung vị 336px, p75 525px, p90 822px, cá biệt 13612px
 * (nguyên trang scan). Ảnh content ĐƠN render nguyên khổ (chính sách #427 —
 * bản nhạc/vở phải đọc được), nên N ảnh liên tiếp = N ảnh nguyên khổ xếp dọc
 * và tràn màn hình.
 *
 * Van xả phóng to CÓ ở lưới content + ảnh đơn của đề, KHÔNG ở ảnh item — ranh
 * giới đó được khoá ở cuối file. Ba điều được khoá ở đây:
 *  1. lưới ảnh TỰ ĐỘNG cho chuỗi ≥2 ảnh trong ĐỀ BÀI, ảnh đơn không đụng tới;
 *  2. bố cục ITEM là việc của player — lớp rich-text KHÔNG được gom nhóm;
 *  3. cả hai việc trên nằm sau cờ `skin.presentation.autoMediaSizing` — tắt cờ
 *     là ảnh về hành vi cũ 100% (đường lùi không cần revert code).
 *
 * Cập nhật 3/8 (Owner: "cứ nhiều ảnh là phải relayout"): chuỗi ảnh CÓ `width`
 * tác giả cũng gom lưới. Ranh giới mới được khoá ở đây — trong LƯỚI `width` bị
 * bỏ qua (ô lưới quyết cỡ), ảnh ĐƠN vẫn tôn trọng `width` không đổi.
 */
import { act } from "react";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RichContentBlock } from "@/core/question-schema";

vi.mock("@/core/content/assetUrl", () => ({
  resolveAssetUrl: (u?: string) => (!u ? "" : u.startsWith("/") ? `https://api.test${u}` : u),
}));

import { renderInteractionPlayer } from "./dispatch";
import { SkinProvider } from "@/core/exercise/skin";
import type { QuestionPlayerSkin } from "@/core/exercise/skin";
import {
  ContentImage,
  MEDIA_GRID_MAX_HEIGHT,
  MEDIA_ITEM_MAX_HEIGHT,
  MEDIA_TICK_TABLE_MAX_HEIGHT,
  MEDIA_MATCH_ITEM_MAX_HEIGHT,
  PlayerHeader,
  RichContentBlocks,
  stemImageMaxHeight,
} from "./shared";
import {
  mediaRunGridColumns,
  videoRunGridClass,
  videoRunGridColumns,
  VIDEO_CONTROLS_FULLSCREEN_MIN_WIDTH,
  VIDEO_CONTROLS_FULL_MIN_WIDTH,
} from "@/core/exercise/display-layout";

/** Surface học sinh: cờ chỉnh cỡ ảnh BẬT (như playful/corporate/dark của web). */
const AUTO_MEDIA_SKIN: QuestionPlayerSkin = { presentation: { autoMediaSizing: true } };
/** Surface duyệt nội dung / đường lùi: cờ TẮT (như studioSkin). */
const NO_AUTO_MEDIA_SKIN: QuestionPlayerSkin = { presentation: {} };

/** Render dưới skin có cờ BẬT — mặc định của mọi bài test bên dưới. */
function renderAuto(node: React.ReactNode, skin: QuestionPlayerSkin = AUTO_MEDIA_SKIN) {
  act(() => {
    root.render(<SkinProvider skin={skin}>{node}</SkinProvider>);
  });
}

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

const img = (block: Partial<RichContentBlock> = {}): RichContentBlock =>
  ({ type: "image", url: "/uploads/scan.png", alt: "scan", ...block }) as RichContentBlock;
const para = (text: string): RichContentBlock => ({ type: "paragraph", text }) as RichContentBlock;
const vid = (block: Partial<RichContentBlock> = {}): RichContentBlock =>
  ({ type: "video", url: "/uploads/clip.mp4", ...block }) as RichContentBlock;

const grids = () => Array.from(document.querySelectorAll('[data-testid="content-media-grid"]'));
const imgs = (scope: ParentNode = container) => Array.from(scope.querySelectorAll("img"));
const videos = (scope: ParentNode = container) => Array.from(scope.querySelectorAll("video"));

describe("lưới ảnh tự động trong đề bài", () => {
  it("gom chuỗi ≥2 ảnh liền nhau thành lưới có trần cao", () => {
    renderAuto(
      <RichContentBlocks blocks={[para("Quan sát:"), img(), img(), img()]} allowMediaGrid />,
    );
    expect(grids()).toHaveLength(1);
    const pictures = imgs();
    expect(pictures).toHaveLength(3);
    pictures.forEach((picture) => {
      expect(picture.style.maxHeight).toBe(MEDIA_GRID_MAX_HEIGHT);
      expect(picture.classList.contains("object-contain")).toBe(true);
    });
  });

  it("số cột = ceil(n/2) → mọi chuỗi ≤10 ảnh nằm gọn trong 2 HÀNG (Owner 3/8)", () => {
    // Trần 5 cột đo thật: ở 5 cột ảnh trung vị còn 124px rộng trong khung 788px;
    // 6 cột tụt xuống 97px nên KHÔNG nới thêm dù có ép được 2 hàng.
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10].map(mediaRunGridColumns)).toEqual([
      2, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
    // Đúng nghĩa "2 hàng": số cột luôn đủ chứa n ảnh trong 2 hàng.
    for (let n = 2; n <= 10; n += 1) {
      expect(Math.ceil(n / mediaRunGridColumns(n))).toBeLessThanOrEqual(2);
    }
  });

  it("TRẦN 5 CỘT thắng quy tắc 2 hàng — từ 11 ảnh trở lên chấp nhận >2 hàng", () => {
    // Ghi ngưỡng bằng số để Owner đọc được từ test: 11 ảnh là chỗ đầu tiên
    // ceil(n/2) đụng trần, và ảnh giữ nguyên cỡ thay vì co xuống cỡ favicon.
    expect(mediaRunGridColumns(10)).toBe(5);
    expect(mediaRunGridColumns(11)).toBe(5);
    expect(mediaRunGridColumns(13)).toBe(5);
    expect(mediaRunGridColumns(20)).toBe(5);
    expect(Math.ceil(11 / mediaRunGridColumns(11))).toBe(3);
    expect(Math.ceil(13 / mediaRunGridColumns(13))).toBe(3);
  });

  it("class lưới khớp số cột, và MỌI bậc giữ 2 cột ở mobile", () => {
    const runOf = (n: number) =>
      renderAuto(<RichContentBlocks blocks={Array.from({ length: n }, () => img())} allowMediaGrid />);

    runOf(2);
    expect(grids()[0].className).toContain("grid-cols-2");
    expect(grids()[0].className).not.toContain("sm:grid-cols-3");

    // 4 ảnh vẫn là 2×2 cân đối như trước, không đổi.
    runOf(4);
    expect(grids()[0].className).not.toContain("sm:grid-cols-3");
    expect(grids()[0].getAttribute("data-display-layout")).toBe("grid_2");

    runOf(6);
    expect(grids()[0].className).toContain("sm:grid-cols-3");
    expect(grids()[0].className).not.toContain("md:grid-cols-4");
    expect(grids()[0].getAttribute("data-display-layout")).toBe("grid_3");

    runOf(8);
    expect(grids()[0].className).toContain("md:grid-cols-4");
    expect(grids()[0].getAttribute("data-display-layout")).toBe("grid_4");

    // Ca thật b7_q1: 10 ảnh. Trước 3/8 là 4 cột × 3 hàng; giờ 5 cột × 2 hàng.
    runOf(10);
    expect(grids()[0].className).toContain("md:grid-cols-5");
    expect(grids()[0].className).not.toContain("md:grid-cols-4");
    expect(grids()[0].getAttribute("data-display-layout")).toBe("grid_5");

    // Mọi bậc vẫn giữ 2 cột ở mobile — dưới 2 cột thì không còn là lưới, mà 5
    // cột trên màn 390px thì mỗi ảnh ~60px. Quy tắc 2 hàng chỉ cam kết từ md.
    [2, 3, 4, 6, 8, 10, 13].forEach((n) => {
      runOf(n);
      expect(grids()[0].className).toContain("grid-cols-2");
      expect(grids()[0].className).not.toContain("sm:grid-cols-4");
      expect(grids()[0].className).not.toContain("sm:grid-cols-5");
    });
  });

  it("ẢNH ĐƠN không bị đụng tới — vẫn nguyên khổ, không lưới (chính sách #427)", () => {
    renderAuto(<RichContentBlocks blocks={[para("Bản nhạc:"), img()]} allowMediaGrid />);
    expect(grids()).toHaveLength(0);
    const picture = imgs()[0];
    expect(picture.style.maxHeight).toBe("");
    expect(picture.className).toContain("max-w-full");
    // Ảnh content đơn vẫn tự mang giấy trắng (PNG trong suốt, mực đen).
    expect(picture.className).toContain("bg-white");
  });

  /**
   * Ảnh ĐƠN của đề bài: cao đúng 45% khung khi bên dưới còn phần phải làm
   * (Owner chốt 10/8). jsdom không layout nên phép đo thật luôn trả `null` —
   * khoá PHÉP TÍNH ở đây, ranh giới DOM khoá bằng hai bài kế tiếp.
   */
  describe("trần ảnh đơn đề bài (stemImageMaxHeight)", () => {
    it("ảnh LÀ cả đề bài (không có gì phía dưới) → KHÔNG trần, giữ chính sách #427", () => {
      expect(stemImageMaxHeight({ port: 719, below: 0 })).toBeUndefined();
      // Vài pixel margin cuối khối vẫn tính là "không có gì phía dưới".
      expect(stemImageMaxHeight({ port: 719, below: 8 })).toBeUndefined();
    });

    it("có vùng trả lời phía dưới → luôn 45% khung, bất kể vùng đó to hay nhỏ", () => {
      // Ca thật `67287717/bai8` câu 1: khung 815 → 367px.
      expect(stemImageMaxHeight({ port: 815, below: 558 })).toBe("367px");
      // Vùng trả lời bé xíu cũng cùng một cỡ — luật PHẲNG, dễ đoán.
      expect(stemImageMaxHeight({ port: 815, below: 60 })).toBe("367px");
      expect(stemImageMaxHeight({ port: 1000, below: 300 })).toBe("450px");
    });

    /**
     * Điểm chính của luật phẳng: kết quả KHÔNG phụ thuộc phép đo chỗ trống nữa.
     * Trước đây `available` chốt khác nhau tuỳ thời điểm đo, mà hai bên ngưỡng
     * chênh nhau 3–4 lần, nên cùng một câu vào hai lần cho hai cỡ ảnh (Owner
     * 10/8, ca `67287717/bai8`: 410px rồi 819px).
     */
    it("cùng khung + cùng phần dưới → LUÔN ra một kết quả, không có nhánh để nhảy", () => {
      const lanDau = stemImageMaxHeight({ port: 815, below: 558 });
      const quayLai = stemImageMaxHeight({ port: 815, below: 558 });
      expect(lanDau).toBe(quayLai);
      // Và phần dưới đo lệch vài chục pixel cũng không đổi kết quả.
      for (const below of [500, 530, 558, 580, 610]) {
        expect(stemImageMaxHeight({ port: 815, below })).toBe("367px");
      }
    });

    it("vùng trả lời TỰ NÓ đã tràn màn → nới trần ra một màn, vì siết không cứu được gì", () => {
      // Ca thật `61741164/bai8` câu 5: khung 536, dưới 558 (104% khung).
      expect(stemImageMaxHeight({ port: 536, below: 558 })).toBe("536px");
      // Ngưỡng bỏ cuộc = 80% khung: 56% vẫn áp trần thường, 104% thì nới.
      expect(stemImageMaxHeight({ port: 711, below: 395 })).toBe("320px");
      expect(stemImageMaxHeight({ port: 711, below: 569 })).toBe("711px");
    });

    it("MOBILE: có vùng trả lời phía dưới → trần phẳng MỘT MÀN thay cho 45% (Owner 12/8)", () => {
      // Cùng số đo với nhánh 45% của desktop — mobile cho nguyên một màn.
      expect(stemImageMaxHeight({ port: 600, below: 300, mobile: true })).toBe("600px");
      expect(stemImageMaxHeight({ port: 815, below: 60, mobile: true })).toBe("815px");
      // Nhánh bỏ-cuộc ra cùng kết quả — mobile chỉ còn MỘT cỡ, không nhánh nhảy.
      expect(stemImageMaxHeight({ port: 536, below: 558, mobile: true })).toBe("536px");
    });

    it("MOBILE: ảnh LÀ cả đề bài vẫn nguyên khổ (#427), và mobile:false giữ y luật desktop", () => {
      expect(stemImageMaxHeight({ port: 600, below: 0, mobile: true })).toBeUndefined();
      expect(stemImageMaxHeight({ port: 600, below: 8, mobile: true })).toBeUndefined();
      expect(stemImageMaxHeight({ port: 815, below: 60, mobile: false })).toBe("367px");
    });

    it("bỏ cuộc KHÔNG phải thả tự do — ảnh không bao giờ cao quá một màn", () => {
      // Thả tự do thì ca bai8 về 1024×1446, nội dung 2090px trên khung 719px:
      // đúng cái "ảnh quá to" mà tính năng này sinh ra để chữa.
      for (const port of [536, 719, 960]) {
        const cap = stemImageMaxHeight({ port, below: port });
        expect(cap).toBe(`${port}px`);
        expect(Number.parseInt(cap!, 10)).toBeLessThanOrEqual(port);
      }
    });

    it("chưa đo được (render đầu / môi trường không có ResizeObserver) → không trần", () => {
      expect(stemImageMaxHeight({ port: null, below: null })).toBeUndefined();
    });
  });

  it("ảnh đơn đề bài đi qua nhánh StemImage, và cờ TẮT thì về nguyên khổ như cũ", () => {
    renderAuto(<RichContentBlocks blocks={[para("Quan sát tranh:"), img()]} allowMediaGrid />);
    expect(document.querySelectorAll('[data-testid="stem-image"]')).toHaveLength(1);
    // jsdom không layout → chưa đo được → KHÔNG áp trần nào (an toàn mặc định).
    expect(imgs()[0].style.maxHeight).toBe("");

    renderAuto(
      <RichContentBlocks blocks={[para("Quan sát tranh:"), img()]} allowMediaGrid />,
      NO_AUTO_MEDIA_SKIN,
    );
    expect(document.querySelectorAll('[data-testid="stem-image"]')).toHaveLength(0);
  });

  it("ảnh của câu con trong nhóm (compact) KHÔNG đi nhánh StemImage — ô nhóm tự có trần riêng", () => {
    renderAuto(<RichContentBlocks blocks={[img()]} compact allowMediaGrid />);
    expect(document.querySelectorAll('[data-testid="stem-image"]')).toHaveLength(0);
  });

  it("chữ xen giữa CẮT chuỗi — hai ảnh cách nhau bởi một đoạn văn không gom", () => {
    renderAuto(
      <RichContentBlocks blocks={[img(), para("Hình 2 cho thấy:"), img()]} allowMediaGrid />,
    );
    expect(grids()).toHaveLength(0);
  });

  it("đoạn RỖNG (spacer #503) KHÔNG cắt chuỗi, và bị lưới nuốt", () => {
    renderAuto(<RichContentBlocks blocks={[img(), para(""), img()]} allowMediaGrid />);
    expect(grids()).toHaveLength(1);
    expect(imgs()).toHaveLength(2);
    // Spacer giữa chuỗi không được render lại thành dòng trống thừa.
    expect(container.querySelectorAll("br")).toHaveLength(0);
  });

  it("CHUỖI có width tác giả VẪN gom, và width bị ô lưới bỏ qua (Owner 3/8)", () => {
    // Trước 3/8 một ảnh khai `width` là bỏ gom cả chuỗi. Điều kiện đó làm tính
    // năng gần như chết vì khâu số hoá gán `%` mặc định hàng loạt.
    renderAuto(<RichContentBlocks blocks={[img(), img({ width: "40%" })]} allowMediaGrid />);
    expect(grids()).toHaveLength(1);
    const pictures = imgs();
    expect(pictures).toHaveLength(2);
    pictures.forEach((picture) => {
      // `%` quy chiếu khung chứa, mà khung chứa đã đổi hẳn khi vào ô lưới.
      expect(picture.style.maxWidth).toBe("");
      expect(picture.style.maxHeight).toBe(MEDIA_GRID_MAX_HEIGHT);
    });
  });

  it("ca thật b7_q1: 10 ảnh CÙNG width 55% gom thành MỘT lưới 5 cột × 2 hàng", () => {
    renderAuto(
      <RichContentBlocks
        blocks={Array.from({ length: 10 }, () => img({ width: "55%" }))}
        allowMediaGrid
      />,
    );
    expect(grids()).toHaveLength(1);
    expect(imgs()).toHaveLength(10);
    expect(grids()[0].className).toContain("md:grid-cols-5");
    imgs().forEach((picture) => expect(picture.style.maxWidth).toBe(""));
  });

  it("RANH GIỚI: ảnh ĐƠN vẫn tôn trọng width tác giả y như cũ", () => {
    renderAuto(<RichContentBlocks blocks={[para("Bản nhạc:"), img({ width: "40%" })]} allowMediaGrid />);
    expect(grids()).toHaveLength(0);
    expect(imgs()[0].style.maxWidth).toBe("40%");
    expect(imgs()[0].style.maxHeight).toBe("");
  });

  it("layout block tác giả khai đi đường riêng, không bị auto-grid xen vào", () => {
    const layout = {
      type: "layout",
      variant: "media-grid",
      columns: [[img(), img()]],
    } as unknown as RichContentBlock;
    renderAuto(<RichContentBlocks blocks={[layout]} allowMediaGrid />);
    expect(grids()).toHaveLength(0);
    expect(imgs()).toHaveLength(2);
  });

  it("đề bài đi qua PlayerHeader được bật lưới (đường dây thật, không chỉ prop)", () => {
    renderAuto(
      <PlayerHeader title="Quan sát" richContent={{ blocks: [img(), img()] }} />,
    );
    expect(grids()).toHaveLength(1);
  });
});

/**
 * Lưới VIDEO (Owner 8/8). Ca thật `99688484/bai2` câu 1: 4 video xếp dọc, mỗi
 * cái 1018×573 → nội dung 2945px trong khung cuộn 818px = ~3,6 màn.
 */
describe("lưới video tự động trong đề bài", () => {
  it("gom chuỗi ≥2 video liền nhau thành lưới có trần cao", () => {
    renderAuto(<RichContentBlocks blocks={[para("Xem:"), vid(), vid(), vid(), vid()]} allowMediaGrid />);
    expect(grids()).toHaveLength(1);
    expect(grids()[0].getAttribute("data-media-run-kind")).toBe("video");
    const players = videos();
    expect(players).toHaveLength(4);
    players.forEach((player) => {
      expect(player.style.maxHeight).toBe(MEDIA_GRID_MAX_HEIGHT);
      expect(player.controls).toBe(true);
    });
  });

  it("số cột = ceil(n/2) tới TRẦN 3 → ≤6 video nằm gọn 2 hàng", () => {
    expect([2, 3, 4, 5, 6].map(videoRunGridColumns)).toEqual([2, 2, 2, 3, 3]);
    for (let n = 2; n <= 6; n += 1) {
      expect(Math.ceil(n / videoRunGridColumns(n))).toBeLessThanOrEqual(2);
    }
    // Trần 3 cột thắng quy tắc 2 hàng: video hẹp hơn ~300px thì thanh điều
    // khiển gốc rụng nút, tệ hơn là phải cuộn thêm một hàng.
    expect(videoRunGridColumns(7)).toBe(3);
    expect(Math.ceil(7 / videoRunGridColumns(7))).toBe(3);
  });

  it("class lưới khớp số cột, và mobile giữ 1 CỘT (khác lưới ảnh)", () => {
    const runOf = (n: number) =>
      renderAuto(<RichContentBlocks blocks={Array.from({ length: n }, () => vid())} allowMediaGrid />);

    runOf(4);
    expect(grids()[0].className).toContain("grid-cols-1");
    expect(grids()[0].className).toContain("sm:grid-cols-2");
    expect(grids()[0].className).not.toContain("md:grid-cols-3");
    expect(grids()[0].getAttribute("data-display-layout")).toBe("grid_2");

    runOf(6);
    expect(grids()[0].className).toContain("md:grid-cols-3");
    expect(grids()[0].getAttribute("data-display-layout")).toBe("grid_3");

    [2, 3, 4, 5, 6, 9].forEach((n) => {
      runOf(n);
      expect(grids()[0].className).toContain("grid-cols-1");
      expect(grids()[0].className).not.toContain("md:grid-cols-4");
    });
  });

  /**
   * Số đo biến thành ràng buộc chạy được (rules §4: "ngưỡng = hằng số có tên +
   * lý do ĐO"). Bề ngang khung đo trên máy thật, ngưỡng thanh điều khiển đo
   * bằng cách dựng video ở từng bề ngang rồi soi nút nào còn nút nào mất.
   */
  describe("ngưỡng thanh điều khiển — cơ sở của trần cột và của sàn mobile", () => {
    const GAP = 12; // gap-3
    const cellWidth = (containerWidth: number, columns: number) =>
      (containerWidth - GAP * (columns - 1)) / columns;

    it("desktop: trần 3 cột giữ ĐỦ nút, 4 cột đã tụt dưới ngưỡng", () => {
      const STEM_CONTAINER = 1018; // đo trên khung 1280px
      expect(videoRunGridColumns(4)).toBe(2);
      expect(videoRunGridColumns(6)).toBe(3);
      expect(cellWidth(STEM_CONTAINER, 3)).toBeGreaterThanOrEqual(VIDEO_CONTROLS_FULL_MIN_WIDTH);
      expect(cellWidth(STEM_CONTAINER, 4)).toBeLessThan(VIDEO_CONTROLS_FULL_MIN_WIDTH);
    });

    it("mobile 375px: 1 cột còn đủ nút, 2 cột mất cả nút toàn màn hình", () => {
      const MOBILE_GRID = 293; // đo trên máy thật ở khung 375px
      expect(MOBILE_GRID).toBeGreaterThanOrEqual(VIDEO_CONTROLS_FULL_MIN_WIDTH);
      expect(cellWidth(MOBILE_GRID, 2)).toBeLessThan(VIDEO_CONTROLS_FULLSCREEN_MIN_WIDTH);
      // Vì vậy lưới video khởi từ 1 cột — ngoại lệ đã ghi trong PLAYER-LAYOUT-RULES.
      expect(videoRunGridClass(4)).toContain("grid-cols-1");
      expect(videoRunGridClass(6)).toContain("grid-cols-1");
    });

    it("mọi bậc lưới video đều nằm TRÊN mốc mất nút toàn màn hình", () => {
      const STEM_CONTAINER = 1018;
      for (const n of [2, 3, 4, 5, 6, 9]) {
        expect(cellWidth(STEM_CONTAINER, videoRunGridColumns(n))).toBeGreaterThanOrEqual(
          VIDEO_CONTROLS_FULLSCREEN_MIN_WIDTH,
        );
      }
    });
  });

  it("VIDEO ĐƠN không bị đụng tới — vẫn full width, không lưới", () => {
    renderAuto(<RichContentBlocks blocks={[para("Xem:"), vid()]} allowMediaGrid />);
    expect(grids()).toHaveLength(0);
    expect(videos()).toHaveLength(1);
    expect(videos()[0].style.maxHeight).toBe("");
  });

  it("chuỗi thuần một LOẠI — ảnh và video cạnh nhau tách thành 2 lưới", () => {
    renderAuto(<RichContentBlocks blocks={[img(), img(), vid(), vid()]} allowMediaGrid />);
    expect(grids().map((g) => g.getAttribute("data-media-run-kind"))).toEqual(["image", "video"]);
    expect(imgs()).toHaveLength(2);
    expect(videos()).toHaveLength(2);
  });

  it("cờ autoMediaSizing TẮT → video về xếp dọc như cũ (đường lùi)", () => {
    renderAuto(
      <RichContentBlocks blocks={[vid(), vid(), vid(), vid()]} allowMediaGrid />,
      NO_AUTO_MEDIA_SKIN,
    );
    expect(grids()).toHaveLength(0);
    expect(videos()).toHaveLength(4);
  });
});

describe("bố cục item KHÔNG do lớp rich-text quyết định", () => {
  it("mặc định TẮT gom lưới — không truyền allowMediaGrid thì xếp dọc như cũ", () => {
    renderAuto(<RichContentBlocks blocks={[img(), img()]} />);
    expect(grids()).toHaveLength(0);
    expect(imgs()).toHaveLength(2);
  });

  it("matching/columns: mỗi item có ảnh vẫn là MỘT hàng trong cột, không lưới chen vào", () => {
    const payload = {
      display: { interactionType: "columns" },
      leftItems: [
        { id: "L1", imageUrl: "/uploads/a.png" },
        { id: "L2", imageUrl: "/uploads/b.png" },
        { id: "L3", imageUrl: "/uploads/c.png" },
      ],
      rightItems: [
        { id: "R1", text: "Một" },
        { id: "R2", text: "Hai" },
        { id: "R3", text: "Ba" },
      ],
      correctAnswer: { L1: "R1", L2: "R2", L3: "R3" },
    };
    renderAuto(
      renderInteractionPlayer("matching", payload as never, {} as never),
    );

    // Không có container lưới ảnh nào được sinh ra trong đường item.
    expect(grids()).toHaveLength(0);
    // Đủ 3 ảnh item, mỗi ảnh nhận trần của ITEM (không phải trần lưới).
    const pictures = imgs().filter((picture) => picture.src.includes("/uploads/"));
    expect(pictures).toHaveLength(3);
    pictures.forEach((picture) =>
      expect(picture.style.maxHeight).toBe(MEDIA_MATCH_ITEM_MAX_HEIGHT),
    );
    // Điểm neo đường nối = chính thẻ <button> của item (TwoColumnMatchPlayer đo
    // getBoundingClientRect trên nó). Ba ảnh phải nằm ở BA button KHÁC NHAU —
    // gom lưới sẽ nhét chúng chung một ô và làm sai toạ độ đường nối.
    const owners = pictures.map((picture) => picture.closest("button"));
    expect(owners.every(Boolean)).toBe(true);
    expect(new Set(owners).size).toBe(3);
    // Và ba button đó vẫn là anh em trong CÙNG một cột (xếp dọc, không lưới).
    expect(new Set(owners.map((owner) => owner!.parentElement)).size).toBe(1);
  });

  it("một ITEM tự nó nhiều ảnh vẫn xếp DỌC, chỉ đổi CỠ", () => {
    renderAuto(<RichContentBlocks blocks={[img(), img()]} compact capImages />);
    expect(grids()).toHaveLength(0);
    const pictures = imgs();
    expect(pictures).toHaveLength(2);
    pictures.forEach((picture) => expect(picture.style.maxHeight).toBe(MEDIA_ITEM_MAX_HEIGHT));
  });
});

describe("van xả phóng to — CÓ ở lưới content, KHÔNG ở ảnh item", () => {
  it("ô lựa chọn có ảnh: không sinh phần tử tương tác lồng bên trong", () => {
    // Ô lựa chọn của SingleChoicePlayer chính là một <button>. Bản 31/7 gắn nút
    // phóng to vào ảnh và tạo ra <button> lồng <button> (HTML không hợp lệ +
    // widget ARIA lồng nhau nuốt tên gọi của ô lựa chọn). Van xả đã được mở lại
    // (lưới content + ảnh đơn của đề) nhưng CỐ Ý chừa đường ảnh item ra: test
    // này giữ nguyên để chốt đúng cái ranh giới đó.
    const payload = {
      display: { interactionType: "radio" },
      content: { blocks: [{ type: "paragraph", text: "Chọn hình đúng." }] },
      options: [
        { id: "A", content: { blocks: [img()] } },
        { id: "B", content: { blocks: [img()] } },
      ],
      correctAnswer: "A",
    };
    renderAuto(renderInteractionPlayer("single_choice", payload as never, {} as never));

    expect(container.querySelectorAll("button button")).toHaveLength(0);
    expect(container.querySelectorAll("[data-image-zoom]")).toHaveLength(0);
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  });

  it("mỗi ô của lưới content là một nút phóng to riêng, có nhãn", () => {
    // Trần 224px/ô mà không có đường xem nguyên khổ là vi phạm chính sách #427.
    // "Riêng" là yêu cầu của Owner: N ảnh → N nút, không phải một nút chung.
    renderAuto(<RichContentBlocks blocks={[img(), img()]} allowMediaGrid />);
    expect(grids()).toHaveLength(1);
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons).toHaveLength(2);
    buttons.forEach((btn) => {
      expect(btn.getAttribute("aria-label")).toMatch(/^Phóng to ảnh/);
      expect(btn.className).toContain("cursor-zoom-in");
      // Không có <button> lồng nhau ở đây (ô lưới không có button bao ngoài).
      expect(btn.querySelectorAll("button")).toHaveLength(0);
    });
    // Chưa bấm thì chưa có overlay nào trong DOM.
    expect(document.querySelectorAll('[data-testid="image-lightbox"]')).toHaveLength(0);
  });

  it("bấm ô lưới mở overlay nguyên khổ; Esc đóng lại", () => {
    renderAuto(<RichContentBlocks blocks={[img(), img()]} allowMediaGrid />);
    const first = container.querySelector("button") as HTMLButtonElement;

    act(() => first.click());
    const overlay = document.querySelector('[data-testid="image-lightbox"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute("role")).toBe("dialog");
    expect(overlay?.getAttribute("aria-modal")).toBe("true");
    // Ảnh trong overlay KHÔNG mang trần của ô lưới — đó là cả điểm của van xả.
    const zoomed = overlay?.querySelector("img") as HTMLImageElement;
    expect(zoomed.style.maxHeight).toBe("");
    expect(zoomed.className).toContain("max-h-[92svh]");
    // Nền bị khoá cuộn khi overlay mở.
    expect(document.body.style.overflow).toBe("hidden");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector('[data-testid="image-lightbox"]')).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("ảnh đơn của đề KHÔNG bị trần cắn thì không có nút phóng to", () => {
    // jsdom không layout nên useAvailableSpace trả null → stemImageMaxHeight
    // undefined → ảnh nguyên khổ. Đúng ca "ảnh LÀ cả đề bài" của chính sách
    // #427: đã nguyên khổ thì phóng to không cho thêm gì, nút chỉ tổ che ảnh.
    // Nửa còn lại (có trần → có nút) phụ thuộc phép đo thật, khoá ở
    // stemImageMaxHeight + nghiệm thu tay trên /dev/players.
    renderAuto(<RichContentBlocks blocks={[img()]} allowMediaGrid />);
    const stem = container.querySelector('[data-testid="stem-image"]');
    expect(stem).not.toBeNull();
    expect(stem?.querySelectorAll("button")).toHaveLength(0);
    expect(stem?.querySelectorAll('[data-image-zoom]')).toHaveLength(0);
  });
});

describe("cờ skin.presentation.autoMediaSizing — công tắc + đường lùi", () => {
  it("TẮT: chuỗi ≥2 ảnh KHÔNG gom lưới, ảnh về kích thước gốc", () => {
    renderAuto(
      <RichContentBlocks blocks={[para("Quan sát:"), img(), img(), img()]} allowMediaGrid />,
      NO_AUTO_MEDIA_SKIN,
    );
    expect(grids()).toHaveLength(0);
    const pictures = imgs();
    expect(pictures).toHaveLength(3);
    pictures.forEach((picture) => {
      expect(picture.style.maxHeight).toBe("");
      expect(picture.className).toContain("max-w-full");
    });
  });

  it("TẮT: ảnh trong item/đáp án KHÔNG bị cap", () => {
    renderAuto(<RichContentBlocks blocks={[img(), img()]} compact capImages />, NO_AUTO_MEDIA_SKIN);
    expect(grids()).toHaveLength(0);
    imgs().forEach((picture) => expect(picture.style.maxHeight).toBe(""));
  });

  it("TẮT: `width` tác giả vẫn thắng y như trước", () => {
    renderAuto(<RichContentBlocks blocks={[img({ width: "40%" })]} allowMediaGrid />, NO_AUTO_MEDIA_SKIN);
    expect(imgs()[0].style.maxWidth).toBe("40%");
  });

  it("TẮT: chuỗi ảnh CÓ width — đường lùi duy nhất lấy lại xếp dọc (Owner 3/8)", () => {
    // Từ 3/8 lưới không còn né chuỗi có `width`, nên cờ này là công tắc DUY
    // NHẤT đưa ca b7_q1 về xếp dọc nguyên khổ nếu QA phản đối.
    renderAuto(
      <RichContentBlocks
        blocks={Array.from({ length: 10 }, () => img({ width: "55%" }))}
        allowMediaGrid
      />,
      NO_AUTO_MEDIA_SKIN,
    );
    expect(grids()).toHaveLength(0);
    expect(imgs()).toHaveLength(10);
    imgs().forEach((picture) => expect(picture.style.maxWidth).toBe("55%"));
  });

  it("BẬT: đúng hành vi của 2 bài test đầu file (pin cả hai chiều của cờ)", () => {
    renderAuto(<RichContentBlocks blocks={[img(), img()]} allowMediaGrid />, AUTO_MEDIA_SKIN);
    expect(grids()).toHaveLength(1);
    imgs().forEach((picture) => expect(picture.style.maxHeight).toBe(MEDIA_GRID_MAX_HEIGHT));

    renderAuto(<RichContentBlocks blocks={[img(), img()]} compact capImages />, AUTO_MEDIA_SKIN);
    imgs().forEach((picture) => expect(picture.style.maxHeight).toBe(MEDIA_ITEM_MAX_HEIGHT));
  });
});

describe("cột nối (matching) — ảnh item phải lọt màn để còn nối được", () => {
  const withImages = (n: number) => ({
    display: { interactionType: "columns" },
    leftItems: Array.from({ length: n }, (_, i) => ({
      id: `L${i}`,
      imageUrl: `/uploads/a${i}.png`,
    })),
    rightItems: Array.from({ length: n }, (_, i) => ({ id: `R${i}`, text: `Đáp ${i}` })),
    correctAnswer: Object.fromEntries(Array.from({ length: n }, (_, i) => [`L${i}`, `R${i}`])),
  });

  it("dùng trần CHẶT của cột nối, không phải trần item thường", () => {
    renderAuto(renderInteractionPlayer("matching", withImages(3) as never, {} as never));
    const pictures = imgs().filter((picture) => picture.src.includes("/uploads/"));
    expect(pictures).toHaveLength(3);
    pictures.forEach((picture) => {
      expect(picture.style.maxHeight).toBe(MEDIA_MATCH_ITEM_MAX_HEIGHT);
      // Chặt hơn trần item thường — đây chính là điểm khác biệt của ngữ cảnh nối.
      expect(picture.style.maxHeight).not.toBe(MEDIA_ITEM_MAX_HEIGHT);
    });
  });

  it("ngân sách chiều cao: 3 ảnh + khoảng cách lọt trong vùng nối của màn 720px", () => {
    // jsdom không layout, nên khoá bằng SỐ: 3 × (128px + ~40px chrome) ≈ 504px,
    // vừa trong ~520px còn lại của viewport 720 sau khi trừ đề bài + vỏ player.
    const capPx = parseFloat(MEDIA_MATCH_ITEM_MAX_HEIGHT) * 16;
    expect(capPx).toBe(128);
    expect(3 * (capPx + 40)).toBeLessThanOrEqual(520);
  });

  it("width tác giả vẫn thắng trần cột nối", () => {
    // Đường thật của #783: `width` đi từ KHỐI ẢNH trong content của item, nên
    // kiểm ở tầng component — trần chặt của cột nối cũng không được đè lên nó.
    renderAuto(
      <ContentImage src="/uploads/icon.png" width="300px" maxHeight={MEDIA_MATCH_ITEM_MAX_HEIGHT} />,
    );
    expect(imgs()[0].style.maxWidth).toBe("300px");
    expect(imgs()[0].style.maxHeight).toBe("");
  });

  it("cờ autoMediaSizing TẮT → cột nối về hành vi cũ, không trần nào", () => {
    renderAuto(
      renderInteractionPlayer("matching", withImages(3) as never, {} as never),
      NO_AUTO_MEDIA_SKIN,
    );
    imgs()
      .filter((picture) => picture.src.includes("/uploads/"))
      .forEach((picture) => expect(picture.style.maxHeight).toBe(""));
  });
});

/**
 * Bảng đánh dấu (`CheckboxTablePlayer`): ảnh nằm trong Ô NHÃN HÀNG, mỗi hàng một
 * tranh tình huống. Trần item mặc định 22rem không cắn với tranh ~348px cao nên
 * ca thật `32069345/bai5` câu 1 dài 3,1 màn — xem bảng đo ở
 * {@link MEDIA_TICK_TABLE_MAX_HEIGHT}.
 */
describe("bảng đánh dấu — trần ảnh của ô nhãn hàng", () => {
  /** Bảng Đ/S có cột tranh: ảnh nằm trong ô nhận định (`TrueFalseTablePlayer`). */
  const tickTable = (rows: number) => ({
    statements: Array.from({ length: rows }, (_, i) => ({
      id: `s${i}`,
      imageUrl: `/uploads/tranh${i}.png`,
      correct: i % 2 === 0,
    })),
    columns: { trueLabel: "🙂", falseLabel: "😟" },
  });

  it("ảnh trong ô nhận định nhận trần CHẶT của bảng đánh dấu, không phải trần item 22rem", () => {
    renderAuto(
      renderInteractionPlayer("multi_true_false_table", tickTable(3) as never, {} as never),
    );
    const pictures = imgs().filter((picture) => picture.src.includes("/uploads/"));
    expect(pictures).toHaveLength(3);
    for (const picture of pictures) {
      expect(picture.style.maxHeight).toBe(MEDIA_TICK_TABLE_MAX_HEIGHT);
      expect(picture.style.maxHeight).not.toBe(MEDIA_ITEM_MAX_HEIGHT);
    }
  });

  /**
   * Ràng buộc Owner 9/8: "màn hình tối thiểu phải thấy 4 dòng". Đo trên ca thật
   * (khung cuộn 808px, trừ 100px phía trên bảng và 56px hàng tiêu đề → 652px
   * cho các hàng): mỗi hàng phải ≤ 163px, mà hàng = ảnh + đệm dọc + viền ≈
   * ảnh + 17px với `py-2`. Khoá bằng SỐ ĐO chứ không bằng ảnh chụp.
   */
  it("trần đủ nhỏ để BỐN hàng lọt màn (khung 808px)", () => {
    const KHUNG = 808;
    const TREN_BANG = 100;
    const HANG_TIEU_DE = 56;
    const DEM_VA_VIEN = 17; // py-2 (8+8) + viền hàng
    const anh = Number.parseFloat(MEDIA_TICK_TABLE_MAX_HEIGHT) * 16;
    const caoHang = anh + DEM_VA_VIEN;
    const soHang = (KHUNG - TREN_BANG - HANG_TIEU_DE) / caoHang;
    expect(soHang).toBeGreaterThanOrEqual(4);
    // ...nhưng không nhỏ quá mức nhìn ra tranh: dưới 8rem là ảnh rộng ~225px,
    // tình huống thành tem thư.
    expect(anh).toBeGreaterThanOrEqual(128);
  });

  it("cờ autoMediaSizing TẮT → về hành vi cũ, không trần nào", () => {
    renderAuto(
      renderInteractionPlayer("multi_true_false_table", tickTable(2) as never, {} as never),
      NO_AUTO_MEDIA_SKIN,
    );
    imgs()
      .filter((picture) => picture.src.includes("/uploads/"))
      .forEach((picture) => expect(picture.style.maxHeight).toBe(""));
  });
});
