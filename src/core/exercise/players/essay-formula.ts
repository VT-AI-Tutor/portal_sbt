/**
 * Bài tự luận có công thức toán.
 *
 * Học sinh viết bài giải trong MỘT trường MathLive (`default-mode="text"`):
 * văn xuôi là mặc định, bấm nút bàn phím của trường để chèn công thức, Enter
 * xuống dòng. Bài làm vì thế vẫn là CHUỖI — không đổi schema, không đụng lưu
 * trữ, không đụng luật chấm (`essay` do giáo viên chấm).
 *
 * Hai phép biến đổi ở đây là thao tác chuỗi thuần nên test được không cần DOM.
 */
import { plainTextFromAuthoredMath } from "@/core/math/plainTextFromAuthoredMath";

/**
 * `$ 54- $` → `$54-$`.
 *
 * MathLive chèn dấu cách ngay trong cặp `$`. Bộ tách của `InlineMathText` theo
 * luật Pandoc, đòi ký tự KHÔNG trắng ngay sau `$` mở — cố ý, để `giá 5$` không bị
 * hiểu là công thức. Nên chuỗi MathLive trả về sẽ KHÔNG khớp và công thức hiện
 * thành chữ thô. Sửa ở đây thay vì nới lỏng bộ tách, để cái guard giá tiền còn nguyên.
 */
const PADDED_DOLLAR_RE = /(?<![\\$\d])\$[ \t]+([^$]*?[^\s$])[ \t]+\$(?!\d)/g;

export function normalizeMathDollarSpacing(value: string): string {
  return value.replace(PADDED_DOLLAR_RE, (_match, body: string) => `$${body}$`);
}

/**
 * Mỗi hàng của `\displaylines{…}` là một dòng bài giải.
 *
 * Cố ý THAM (khớp tới `}` cuối cùng): thân môi trường chứa `\text{…}`, `\frac{}{}`
 * nên khớp lười sẽ cắt ngay ở ngoặc đóng đầu tiên và mất phần còn lại. Giả định
 * đi kèm: môi trường là nhóm ngoặc CUỐI của bài làm — đúng với mọi chuỗi MathLive
 * trả về, vì `addRowAfter` bọc toàn bộ nội dung vào một môi trường duy nhất.
 */
const DISPLAYLINES_RE = /\\displaylines\{([\s\S]*)\}/;

/**
 * Bài làm hạ xuống văn bản phẳng — dùng để ĐẾM TỪ và cho các bề mặt chỉ nhận chuỗi.
 *
 * `\displaylines` là môi trường nhiều dòng của MathLive; mỗi hàng ngăn bởi `\\`
 * thành một dòng thật. Phần còn lại giao cho `plainTextFromAuthoredMath`, bộ hạ
 * TeX dùng chung — không viết bộ thứ hai.
 */
export function essayAnswerToPlainText(value: string): string {
  if (!value) return "";
  const rows = DISPLAYLINES_RE.exec(value);
  const source = rows ? rows[1] : value;
  return source
    .split("\\\\")
    .map((row) => plainTextFromAuthoredMath(`\\(${row}\\)`).trim())
    .filter((row, index, all) => row !== "" || all.length === 1)
    .join("\n");
}
