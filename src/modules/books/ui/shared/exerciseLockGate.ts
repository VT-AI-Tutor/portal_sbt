/**
 * Hạn mức làm thử bài tập của một cuốn sách — hàm THUẦN để test được mà không
 * phải dựng cả `BookLessonPage`.
 *
 * Gate mật khẩu bản đầu chặn TOÀN BỘ bài tập ngay khi được cấu hình. Luật hiện
 * tại xét theo TỪNG BÀI: 1/2 số bài đầu sách làm tự do, từ bài kế tiếp trở đi
 * mới hỏi mật khẩu — vẫn là mật khẩu dùng chung đang cấu hình, không sinh mã
 * mới cho từng bài — và nhập đúng một lần là mở nốt các bài còn lại của cuốn đó.
 */

/** Phần sách được làm tự do: 1/2. */
const FREE_LESSON_RATIO = 2;

/**
 * Số bài đầu sách không bị khoá: 1/2 tổng số bài, LÀM TRÒN LÊN để sách ít bài
 * vẫn còn bài làm thử (8 bài → 4, 5 bài → 3, 1 bài → 1).
 */
export function freeLessonCount(totalLessons: number): number {
  if (totalLessons <= 0) return 0;
  return Math.ceil(totalLessons / FREE_LESSON_RATIO);
}

/** Bài tập của bài đang mở có bị khoá sau mật khẩu không. */
export function isLessonExerciseLocked({
  passConfigured,
  bookUnlocked,
  lessonIndex,
  totalLessons,
}: {
  /** Gate có được bật không (provider + mật khẩu đã cấu hình). */
  passConfigured: boolean;
  /** Cuốn sách này đã nhập đúng mật khẩu lần nào chưa. */
  bookUnlocked: boolean;
  /** Vị trí bài trong mục lục sách, đếm từ 0. `-1` = chưa tra được. */
  lessonIndex: number;
  /** Tổng số bài của cả cuốn. */
  totalLessons: number;
}): boolean {
  if (!passConfigured || bookUnlocked) return false;
  // Chưa tra được bài nằm ở đâu trong sách (mục lục chưa về, hoặc lối vào xem
  // trước không có mục lục) thì KHÔNG khoá: thà lọt một bài còn hơn chặn nhầm
  // cả cuốn vì dữ liệu về chậm.
  if (lessonIndex < 0 || totalLessons <= 0) return false;
  return lessonIndex >= freeLessonCount(totalLessons);
}
