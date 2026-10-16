/**
 * web-own: chưa upstream lên studio (xem WEB-OWN PATCHES trong
 * apps/learner/scripts/detokenize-players.mjs).
 *
 * Literal dùng chung của các player matching — phần KHÔNG phụ thuộc accent.
 *
 * Ranh giới với `MatchingTargetColumn.tsx`: file kia giữ thứ SUY RA TỪ ACCENT
 * (tông từng cột, huy hiệu, hex chấm đầu nối theo state); file này giữ thứ
 * giống hệt nhau ở mọi cột và mọi skin — hình dạng chấm, kiểu nét chờ, và bảng
 * màu "cặp nối mẫu". Ba player (columns, lines, chain) từng khai lại y nguyên
 * sáu hằng dưới đây, nên sửa một chỗ là hai chỗ kia lặng lẽ lệch.
 *
 * Đây là chi tiết per-element mà hệ skin cố ý không với tới (cùng nhóm với
 * LINE_HEX/PAIR_COLORS), nên nó là literal ở cả mọi skin.
 */

/** Chấm đầu nối gắn ở mép ô; call site thêm `-left-3` hoặc `-right-3`. */
export const MATCH_ENDPOINT_CLASS =
  "pointer-events-none absolute top-1/2 z-20 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white shadow";

/**
 * Chấm đầu RA lúc chưa nối: xám trung tính, KHÔNG theo tông cột — nó chỉ nói
 * "còn trống". (Đầu VÀO lúc trống thì ăn theo tông cột, xem `matchEndpointHex`.)
 */
export const MATCH_IDLE_SOURCE_ENDPOINT_HEX = "#cbd5e1"; // slate-300

/**
 * Nét chờ dùng đơn vị SVG cố định để mỗi gạch và mỗi khoảng hở giữ nguyên kích
 * thước bất kể hai cột cách nhau bao xa.
 */
export const MATCH_PENDING_LINE_DASH = "8 8";

// web#706 — cặp nối mẫu ("theo mẫu"): xám + nét đứt mảnh, đúng bảng màu của
// MatchingScenePlayer để sáu player nhìn giống nhau.
export const MATCH_EXAMPLE_LINE_HEX = "#64748b"; // slate-500
export const MATCH_EXAMPLE_LINE_DASH = "3 2";

/**
 * `skin.chip?.(state)` chỉ có 5 state (idle/selected/placed/correct/wrong) và
 * KHÔNG có "example"; mở rộng hợp đồng skin nằm ngoài phạm vi issue nên nhánh
 * chip mẫu đi vòng qua skin thay vì thêm state mới.
 */
export const MATCH_EXAMPLE_CHIP_CLASS =
  "rounded-3xl border-4 border-dashed border-slate-400 bg-slate-100 text-slate-600   ";
