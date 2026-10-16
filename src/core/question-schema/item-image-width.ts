/**
 * `width` tác giả đặt trên khối ảnh **của một ITEM** — ô nối, thẻ phân loại,
 * nhãn kéo thả, ô bảng (issue #783).
 *
 * Chỉ nhận **độ dài tuyệt đối** (`px`/`rem`/`em`/`pt`/`ch`). `%` và số trần bị
 * BỎ QUA có chủ ý, không phải sót:
 *
 *  - Trước #783 trình hiển thị **bỏ hẳn** `width` ở nhánh item, nên mọi giá trị
 *    đang nằm trong dữ liệu **chưa từng được nhìn thấy khi soạn** — không ai
 *    kiểm lại chúng trên màn hình. Quét kho sách đã kiểm (2026-07-30, 8840 câu /
 *    56 sách) thấy **151 câu** dùng `%`, trong đó **59 câu ≤ 25%** và thấp nhất
 *    là **7%**. Bật thẳng chúng lên là thu ảnh xuống vài pixel — đúng lớp lỗi
 *    "ảnh quá bé/nhỏ" mà QA từng từ chối và PR #644 đã phải sửa.
 *  - `%` của ảnh ITEM quy chiếu theo **ô chứa** (thường rất hẹp), khác hẳn `%`
 *    của ảnh trong `content.blocks` của CÂU — nơi `RichContentBlocks` vẫn nhận
 *    `%` vì hộp chứa là cả cột đề. Cùng con số, hai ngữ cảnh, hai kết quả.
 *  - Số trần (`"160"`) không phải độ dài CSS hợp lệ; trình duyệt bỏ qua.
 *
 * Độ dài tuyệt đối thì rõ ràng ý đồ và đo được: 137 câu trong kho dùng `px`,
 * trung vị 150px, dải 22–390px — hợp lý, và chính là ca của #783 (`44px`).
 *
 * Muốn mở cho `%`: cần rà lại 151 câu đó trên màn hình trước, không phải nới
 * điều kiện ở đây.
 */
const ABSOLUTE_LENGTH = /^\d+(\.\d+)?\s*(px|rem|em|pt|ch)$/i;

/** Giá trị `width` dùng được cho ảnh của item, hoặc `undefined`. */
export function itemImageWidth(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return ABSOLUTE_LENGTH.test(trimmed) ? trimmed : undefined;
}
