/**
 * Tên rút gọn ở TẦNG DỮ LIỆU (spec §9.7): tên chương trình dài 4–20 từ không
 * được xử lý bằng CSS wrap. Dict cho các thành tố GDPT hay gặp; fallback cắt
 * ở ranh giới từ + "…" (tên đầy đủ luôn đi kèm qua title/tooltip ở UI).
 *
 * Khoá dict được chuẩn hoá qua `normalizeForLookup` trước khi so khớp — chữ
 * "và" và dấu phẩy đều là cách nối liệt kê trong văn bản chương trình gốc
 * ("...công cụ, phương tiện..." lẫn "...công cụ và phương tiện..." cùng một
 * thành tố), lệch dấu phẩy/"và" từng khiến một khoá không khớp và rơi về cắt
 * chung chung — tự nhận diện cả hai biến thể để không lặp lỗi đó.
 */
const COMPONENT_SHORT_RAW: Record<string, string> = {
  "tư duy và lập luận toán học": "Tư duy & lập luận",
  "mô hình hoá toán học": "Mô hình hoá",
  "mô hình hóa toán học": "Mô hình hoá",
  "giải quyết vấn đề toán học": "Giải quyết vấn đề",
  "giao tiếp toán học": "Giao tiếp",
  "sử dụng công cụ và phương tiện học toán": "Công cụ & phương tiện",
};

/** Chuẩn hoá để so khớp dict: hạ chữ thường, bỏ dấu phẩy, tách theo khoảng
 * trắng rồi loại token "và" — để "A, B" và "A và B" quy về cùng một khoá.
 * KHÔNG dùng kết quả này để hiển thị, chỉ để tra dict.
 *
 * CỐ Ý không dùng regex \b để nhận diện từ "và": \b trong JS coi ký tự có
 * dấu (à, ư, …) là KHÔNG PHẢI \w, nên biên từ quanh "và" — v(word)|à(non-word)
 * — không bao giờ khớp ở đầu ASCII lẫn cuối token, /\bvà\b/ lặng lẽ không
 * xoá được gì. Tách token theo khoảng trắng tránh hẳn cạm bẫy \b + dấu tiếng
 * Việt này (đã tự bắt lỗi bằng test cho biến thể dấu phẩy). */
function normalizeForLookup(label: string): string {
  return label
    .normalize("NFC")
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0 && token !== "và")
    .join(" ");
}

const COMPONENT_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(COMPONENT_SHORT_RAW).map(([key, short]) => [
    normalizeForLookup(key),
    short,
  ]),
);

/**
 * Bỏ tiền tố đánh số của tên chương trình ("1. ", "II) ", "Đ) ") — thứ không
 * mang thông tin cho học sinh và chiếm mất chỗ quý ở cột hẹp.
 */
export function stripLeadingIndex(label: string): string {
  return label.replace(/^[0-9IVXĐA-D]+[.)]\s*/u, "").trim();
}

export function shortenLabel(label: string, maxChars = 28): string {
  const cleaned = stripLeadingIndex(label);
  if (cleaned.length <= maxChars) return cleaned;
  const cut = cleaned.slice(0, maxChars + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return cleaned.slice(0, lastSpace > 12 ? lastSpace : maxChars).trimEnd() + "…";
}

/**
 * @param maxFallbackChars Ngân sách ký tự CHỈ áp dụng khi tên không có trong
 * dict (rơi về `shortenLabel`) — không ảnh hưởng các khoá đã có sẵn tên rút
 * gọn cố định trong dict. Mặc định 20 (dùng cho ComponentBars, nơi có nhiều
 * chỗ hơn); radar SVG truyền ngân sách hẹp hơn vì nhãn trục phải nằm gọn
 * trong viewBox ở MỌI góc — không phải rào cản chung cho mọi nơi gọi hàm.
 */
export function componentShortLabel(label: string, maxFallbackChars = 20): string {
  return (
    COMPONENT_SHORT[normalizeForLookup(label)] ??
    shortenLabel(label, maxFallbackChars)
  );
}
