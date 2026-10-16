/**
 * Nhãn của một Ô TRỐNG trong khối "Đáp án đúng" — cùng vai trò với
 * `authoredName` bên `answer-name.tsx`.
 *
 * `blanks[].label` đã có trong schema từ lâu và nội dung ĐÃ khai (TNXH 3 khai
 * "(1)"…"(4)", LS&ĐL 4 khai "5.1."…), nhưng cloze/fill_blank/word_bank chưa đọc
 * nên vẫn in cứng "Số N" — đây là chỗ nối lại.
 *
 * Ba trạng thái, KHÔNG gộp được thành hai:
 * - không khai  → "Số N" như cũ (840/853 câu production rơi vào đây)
 * - khai chữ    → in đúng chữ đó
 * - khai RỖNG   → bỏ hẳn tiền tố, chỉ còn đáp án (Tiếng Việt yêu cầu bỏ "Số 1")
 *
 * web-own: chưa upstream lên studio — xem mục G trong WEB-OWN PATCHES ở
 * apps/learner/scripts/detokenize-players.mjs.
 */

/**
 * Nhãn KẾT THÚC bằng dấu câu thì tự nó đã ngắt — nối thêm `separator` là ra dấu
 * kép ("5,4 : 8 =" + ": " → "5,4 : 8 =: 0,675"). Nhãn vốn viết để in CẠNH Ô
 * (#397) nên hay mang sẵn dấu: quét 76 nhãn thật thấy 24 nhãn tận cùng ":" và 3
 * nhãn tận cùng "=".
 *
 * `)` CỐ Ý không nằm trong tập này: 33 nhãn dạng "(1)" tận cùng ")" và vẫn cần
 * dấu phân cách ("(1): văn bản"). Tập chỉ gồm dấu NGẮT CÂU.
 */
const SELF_TERMINATED = /[:=?.!;…]$/;

/**
 * `String(...)` không thừa: `blanks` đi thẳng từ kho schemaless nên một
 * `label: 1` không có nháy sẽ làm `.trim()` ném lỗi và sập cả câu hỏi.
 *
 * Tham số dạng object chứ không phải 4 vị trí: `separator` và `value` đều là
 * chuỗi và nằm cạnh nhau, đảo nhầm thì TypeScript không kêu mà chỉ sai lúc chạy.
 */
export function blankRevealLine({
  label,
  index,
  separator,
  value,
}: {
  label: unknown;
  index: number;
  separator: string;
  value: string;
}): string {
  const prompt = label == null ? `Số ${index + 1}` : String(label).trim();
  if (!prompt) return value;
  return SELF_TERMINATED.test(prompt) ? `${prompt} ${value}` : `${prompt}${separator}${value}`;
}
