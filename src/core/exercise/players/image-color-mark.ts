/**
 * Ô đánh dấu ✓ / ✗ cho P62 image_color — phần THUẦN TÍNH TOÁN.
 *
 * web-own: chưa upstream lên studio — xem WEB-OWN PATCHES trong
 * apps/learner/scripts/detokenize-players.mjs.
 *
 * Để riêng một tệp (khuôn `blank-label.ts`) vì bước sync chỉ COPY ĐÈ các
 * tệp có sẵn bên studio: tệp lạ không bị xoá, nên lần sync sau chỉ phải nối lại
 * vài dòng gọi trong `ImageColorClassifyPlayer.tsx` thay vì dựng lại cả bản vá.
 *
 * Kiểu khai tại chỗ (không import từ player) để tệp này tự đứng được; kiểu của
 * player thoả cấu trúc nên truyền thẳng vào được.
 */

/** Phần `ColorCategory` mà ô đánh dấu cần biết. */
export interface MarkCategoryLike {
  mark?: string;
}

/** Phần `ImageRegionItem` mà ô đánh dấu cần biết. */
export interface MarkRegionLike {
  shape: "circle" | "rect" | "polygon";
  x?: number;
  y?: number;
  radius?: number;
  width?: number;
  height?: number;
  points?: Array<[number, number]>;
}

// Hình học mặc định khi người soạn bỏ trống — PHẢI khớp `regionStyle` bên
// player, nếu không ô dấu sẽ đo theo một vùng khác với vùng đang vẽ.
export const DEFAULT_CIRCLE_RADIUS = 0.06;
export const DEFAULT_RECT_SIDE = 0.1;

// Cạnh ô = MARK_SIZE_RATIO phần cạnh NGẮN của vùng, nhưng CHẶN hai đầu. Chặn
// dưới để vùng bé (mặt từng bạn trong tranh đông người — câu Đạo đức 3 khai
// radius ~0.04) vẫn đọc được dấu; chặn trên để vùng to không đẻ ra ô che mất
// hình. Vùng vuông 60px → ô 33px; 40px → 22px; 200px → 40px.
export const MARK_SIZE_RATIO = 0.55;
export const MARK_MIN_PX = 16;
export const MARK_MAX_PX = 40;
/** Cỡ chữ trong ô, theo cạnh ô — chừa viền và một chút thở hai bên. */
export const MARK_GLYPH_SCALE = 0.72;
/** Dấu xem trước (rê chuột lên ô còn rỗng) mờ đi, ô thì vẫn rõ. */
export const MARK_GHOST_OPACITY = 0.45;
/** Viền ô CHƯA đánh: xám trung tính, không mượn màu nhóm đang chọn — mượn thì
 *  mọi ô rỗng đã xanh/đỏ sẵn, nhìn như đã chấm xong cả bài. */
export const EMPTY_MARK_COLOR = "#64748b";
/** Nền ô ĐÃ đánh. Ô rỗng để trong suốt vì nó nằm ngay trên mặt từng bạn. */
export const MARK_FILL = "rgba(255,255,255,0.92)";
/** Bo góc và độ dày viền theo cạnh ô — ô bé thì viền mảnh cho khỏi bít ruột. */
export const MARK_RADIUS_RATIO = 0.18;
export const MARK_BORDER_PX = 3;
export const MARK_BORDER_THIN_PX = 2;
export const MARK_BORDER_THIN_BELOW_PX = 24;

/**
 * Dấu đã khai của một nhóm, đã bỏ khoảng trắng; nhóm không khai → null.
 * Chỉ nhận chuỗi: payload do người soạn gõ tay có thể ra `"mark": 1`, mà
 * `(1).trim` là undefined — gọi thẳng sẽ ném và làm hỏng cả câu hỏi.
 */
export function markGlyph(cat: MarkCategoryLike | null | undefined): string | null {
  const mark = typeof cat?.mark === "string" ? cat.mark.trim() : "";
  return mark ? mark : null;
}

/**
 * Khung bao của polygon, hoặc null nếu KHÔNG đủ tư cách polygon (cần ≥ 3 đỉnh
 * và mọi toạ độ hữu hạn). Đúng một luật cho cả lối vẽ SVG lẫn chỗ đặt ô dấu:
 * tách hai luật ra thì polygon hỏng vẽ theo lối hộp mà ô dấu vẫn tính theo
 * `points` — toạ độ NaN đẩy ô về góc trên trái, polygon 2 đỉnh đẩy ô ra khỏi
 * vùng của nó.
 */
export function polygonBounds(
  item: MarkRegionLike,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (item.shape !== "polygon" || !Array.isArray(item.points) || item.points.length < 3) return null;
  if (!item.points.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))) {
    return null;
  }
  const xs = item.points.map(([x]) => x);
  const ys = item.points.map(([, y]) => y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Tâm vùng (0–1) — ĐÚNG hình học người soạn kéo, không dò theo nét vẽ. */
export function regionCenter(item: MarkRegionLike): { cx: number; cy: number } {
  if (item.shape === "circle") return { cx: item.x ?? 0, cy: item.y ?? 0 };
  const bounds = polygonBounds(item);
  if (bounds) {
    return { cx: (bounds.minX + bounds.maxX) / 2, cy: (bounds.minY + bounds.maxY) / 2 };
  }
  return {
    cx: (item.x ?? 0) + (item.width ?? DEFAULT_RECT_SIDE) / 2,
    cy: (item.y ?? 0) + (item.height ?? DEFAULT_RECT_SIDE) / 2,
  };
}

/**
 * Bề ngang · bề dọc của vùng (0–1). Circle lấy ĐƯỜNG KÍNH cho cả hai chiều,
 * giống hệt `regionStyle` — nó cũng đặt width/height bằng `r * 200%`, nên vùng
 * "tròn" thật ra là ellipse khi ảnh không vuông.
 */
export function regionSpan(item: MarkRegionLike): { w: number; h: number } {
  if (item.shape === "circle") {
    const d = (item.radius ?? DEFAULT_CIRCLE_RADIUS) * 2;
    return { w: d, h: d };
  }
  const bounds = polygonBounds(item);
  if (bounds) return { w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY };
  return { w: item.width ?? DEFAULT_RECT_SIDE, h: item.height ?? DEFAULT_RECT_SIDE };
}

/**
 * Cạnh ô đánh dấu (px) cho một vùng, đã CHẶN hai đầu. Chưa đo được khung ảnh
 * (containerWidth/Height = 0, lúc mới mount hay ở jsdom) thì rơi về chặn dưới —
 * dấu vẫn vẽ ra, chỉ bé, rồi lần đo sau nở đúng cỡ.
 */
export function markBoxSize(
  item: MarkRegionLike,
  containerWidth: number,
  containerHeight: number,
): number {
  const span = regionSpan(item);
  const shortSide = Math.min(span.w * containerWidth, span.h * containerHeight);
  return Math.round(Math.min(MARK_MAX_PX, Math.max(MARK_MIN_PX, shortSide * MARK_SIZE_RATIO)));
}
