import type { AppRouteDef } from "@/core/routing/types";

/**
 * Routes cho nội dung TỰ SỐ HÓA — bài NÂNG CAO.
 *
 * Trước đây có route `/sach-bai-tap/:bookCode/nang-cao/:lessonCode` mở trang
 * `DigitizedBookLessonPage` riêng. Nay luồng nâng cao đã chuyển sang DIALOG
 * (xem `DigitizedExerciseDialog` + `AdvancedBookSection`) — click bài trong
 * section nâng cao mở dialog nhập pass → runner, không navigate. Nên route
 * này không còn cần nữa.
 *
 * Bài CƠ BẢN vẫn dùng `/sach-bai-tap/:bookCode/:lessonCode` (xem booksRoutes).
 */
export const digitizedContentRoutes: AppRouteDef[] = [];
