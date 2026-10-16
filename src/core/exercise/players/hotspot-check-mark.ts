/**
 * Dấu ✓ / ✗ cho P10 hotspot "multiple" (spec §5.13.3 `display.mark`) — phần
 * THUẦN TÍNH TOÁN: lọc giá trị khai, cỡ dấu, tâm dấu, đo khung ảnh.
 *
 * Câu nào khai `display.mark` thì vùng đã chọn KHÔNG tô vòng/khung + nền nữa
 * mà vẽ một dấu ở tâm vùng — tức ngay trong ô in sẵn trên sách ("Đánh dấu ✓
 * vào ☐…"). Không khai thì y như cũ: câu "Khoanh tròn vào…" vẫn cần vòng.
 * Câu có chấm thì dấu theo đúng/sai (✓ / ✗), không theo dấu khai; chế độ đếm
 * không dùng dấu — xem HotspotMultiPlayer.
 */
import React from "react";
import { hotspotCenter, hotspotMarkerBox, type HotspotShape } from "./hotspot-hit";

/** Dấu vẽ bằng nét (icon) — chữ "✓" phụ thuộc phông máy, có máy ra emoji. */
export type HotspotMarkKind = "check" | "cross";

/** Các cách người soạn hay gõ cho từng dấu. */
const CHECK_ALIASES = new Set(["✓", "✔", "✔️", "v", "check"]);
const CROSS_ALIASES = new Set(["✗", "✘", "✕", "×", "x", "cross"]);

/**
 * Dấu đã khai của câu, hoặc null nếu không khai / khai lạ. Chỉ nhận chuỗi:
 * payload gõ tay trong tab JSON có thể ra `"mark": 1` — ép kiểu sẽ ném hoặc
 * bật nhầm chế độ đánh dấu cho câu đang cần vòng tròn.
 */
export function hotspotMarkKind(raw: unknown): HotspotMarkKind | null {
  if (typeof raw !== "string") return null;
  const mark = raw.trim().toLowerCase();
  if (CHECK_ALIASES.has(mark)) return "check";
  if (CROSS_ALIASES.has(mark)) return "cross";
  return null;
}

// Cạnh dấu = MARK_SIZE_RATIO phần cạnh NGẮN của vùng, CHẶN hai đầu. Đa số
// vùng được kéo SÁT ô in (HĐTN 3 b8_q7: khung 65px quanh ô ○ in; HĐTN 2
// b5_q3: vòng bám ○ 57px) nên dấu phải lấp được phần lớn ô như nét bút thật —
// 0.4 chỉ ra 23–26px, lọt thỏm. Vùng kéo RỘNG hơn ô in (HĐTN 1 b1_q3: vòng
// đường kính 0.12 bề ngang quanh ô ~0.045) thì chặn trên MARK_MAX_PX giữ dấu
// xấp xỉ cỡ ô thay vì tràn sang chữ bên cạnh.
export const MARK_SIZE_RATIO = 0.65;
export const MARK_MIN_PX = 16;
export const MARK_MAX_PX = 48;
/** Nét dấu theo cạnh dấu — dày như nét bút, không thành khối đục che ô in. */
export const MARK_STROKE_RATIO = 0.14;
/** Dấu hiện lại cho ô đúng mà học sinh bỏ sót, sau khi khoá bài. */
export const MISSED_MARK_OPACITY = 0.5;

/**
 * Cạnh ngắn (px) của phần đang vẽ. Đọc thẳng hộp của `hotspotMarkerBox` thay
 * vì tự tính lại hình học: hàm đó đã lo bán kính mặc định, polygon/line hỏng
 * rơi về hình tròn, bề dày dải `line` — chép tay là hai luật trôi khỏi nhau.
 */
function hotspotSpan(hs: HotspotShape, containerWidth: number, containerHeight: number): number {
  const box = hotspotMarkerBox(hs);
  const w = (parseFloat(box.width) / 100) * containerWidth;
  // Hình tròn không có `height`: nó giữ `aspect-ratio: 1/1` theo bề ngang.
  const h = box.height == null ? w : (parseFloat(box.height) / 100) * containerHeight;
  return Math.min(w, h);
}

/**
 * Tâm đặt dấu (0–1). Polygon lấy tâm KHUNG BAO như `hotspotMarkerBox`, không
 * lấy trung bình đỉnh của `hotspotCenter`: tác giả kéo dồn đỉnh về một phía
 * (hay lặp lại đỉnh đầu để khép hình) là trung bình lệch theo, dấu tràn khỏi ô
 * in sang chữ bên cạnh. Các hình khác giữ `hotspotCenter` — `line` cần điểm
 * giữa theo chiều dài, tâm khung bao của đường cong có thể nằm ngoài đường.
 */
export function hotspotMarkCenter(hs: HotspotShape): { x: number; y: number } {
  const box = hotspotMarkerBox(hs);
  if (hs.shape === "polygon" && box.clipPath && box.height != null) {
    return {
      x: (parseFloat(box.left) + parseFloat(box.width) / 2) / 100,
      y: (parseFloat(box.top) + parseFloat(box.height) / 2) / 100,
    };
  }
  return hotspotCenter(hs);
}

/**
 * Cạnh dấu (px) cho một vùng, đã chặn hai đầu. Chưa đo được khung ảnh (lúc
 * mới mount, jsdom) thì rơi về chặn dưới — dấu vẫn hiện, lần đo sau nở đúng cỡ.
 */
export function hotspotMarkSize(
  hs: HotspotShape,
  containerWidth: number,
  containerHeight: number,
): number {
  const side = hotspotSpan(hs, containerWidth, containerHeight) * MARK_SIZE_RATIO;
  return Math.round(Math.min(MARK_MAX_PX, Math.max(MARK_MIN_PX, Number.isFinite(side) ? side : 0)));
}

/**
 * Cỡ khung ảnh ĐANG HIỂN THỊ (px). Không đo được (jsdom, trình duyệt thiếu
 * ResizeObserver) thì giữ 0 — cỡ dấu rơi về chặn dưới. `enabled` false thì
 * không quan sát gì: câu không khai dấu không tốn thêm một observer nào.
 */
export function useHotspotContainerSize(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): { w: number; h: number } {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const measure = () =>
      setSize((prev) =>
        prev.w === el.clientWidth && prev.h === el.clientHeight
          ? prev
          : { w: el.clientWidth, h: el.clientHeight },
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    // Ảnh tải xong làm khung cao lên, xoay máy làm khung co — observer bắt cả hai.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return size;
}
