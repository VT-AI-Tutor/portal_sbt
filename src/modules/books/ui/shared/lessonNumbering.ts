/**
 * Số "Bài N" của từng bài trong sách.
 *
 * Mục lục và màn bài học phải dùng CHUNG hàm này: mỗi màn tự phẳng-hoá chương
 * một kiểu là "Bài 3" ở mục lục thành "Bài 5" khi mở bài đó ra.
 */

interface NumberedChapter {
  lessons: Array<{ id: string | number; title: string }>;
}

/** Mở đầu bằng "ôn tập" — điều kiện cần, chưa đủ. */
const REVIEW_PREFIX = /^ôn\s+tập(?:\s|$)/iu;

/**
 * Mốc kì/năm học — thứ phân biệt ôn tập THEO KÌ với ôn tập thường.
 *
 * `k[ìỳ]` vì "kì" và "kỳ" đều là cách viết chuẩn và sách dùng cả hai. Bản đầu
 * chỉ nhận "kì", nên "Ôn tập cuối học kỳ 1" lặng lẽ VẪN được đánh số — bản xuất
 * hiện có toàn dùng "kì" nên lỗi này không cắn, và cũng vì thế mà không ai thấy.
 *
 * "cuối năm" tách khỏi "năm học" để bắt cả "Ôn tập cuối năm" (không có "học").
 */
const TERM_MARKER = /học\s+k[ìỳ]|giữa\s+k[ìỳ]|cuối\s+k[ìỳ]|cuối\s+năm|năm\s+học/iu;

/**
 * LCMS chưa trả `label`/`lessonNumber`, chỉ có tên + vị trí vật lý. Các mục ôn
 * tập THEO KÌ vẫn mở như một bài học nhưng theo mục lục in không mang số "Bài N".
 *
 * Luật cần HAI điều kiện, không phải một. Chỉ xét tiền tố "ôn tập" thì lớp 1 mất
 * 19 số ở Tập 1 và 9 số ở Tập 2: loại "Ôn tập" thường lặp đều giữa các bài chữ
 * VẪN là một bài có số — chính LCMS cũng đánh mã `bai5`, `bai10`, `bai15` cho
 * chúng. Chỉ "Ôn tập giữa/cuối học kì" và "Ôn tập cuối năm học" mới không mang số.
 *
 * Mã bài không dùng để phân biệt được: cả 44 mục ôn tập trong bản xuất đều mang
 * mã `bai<N>`, kể cả loại theo kì. Tên bài là tín hiệu duy nhất hiện có.
 *
 * Chuẩn hoá Unicode trước khi so để dữ liệu có dấu ở dạng tổ hợp vẫn khớp, và
 * gom khoảng trắng để "ôn   tập cuối kì" không trượt.
 */
export function isUnnumberedLessonTitle(title: string): boolean {
  const normalized = title.trim().normalize("NFC").replace(/\s+/g, " ");
  return REVIEW_PREFIX.test(normalized) && TERM_MARKER.test(normalized);
}

/**
 * Đánh số chạy suốt cả sách theo ĐÚNG thứ tự mục lục — nối các chương lại theo
 * thứ tự API trả về, không sắp xếp lại.
 */
export function lessonNumbersById(
  chapters: NumberedChapter[],
): Record<string, number> {
  const numbers: Record<string, number> = {};
  let running = 0;
  for (const chapter of chapters) {
    for (const lesson of chapter.lessons) {
      if (isUnnumberedLessonTitle(lesson.title)) continue;
      running += 1;
      numbers[String(lesson.id)] = running;
    }
  }
  return numbers;
}
