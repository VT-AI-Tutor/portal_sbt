import type { AppRouteDef } from "@/core/routing/types";
import { RequireAuth } from "@/core/auth/RequireAuth";
import { BookDetailPage } from "@/modules/books/ui/public/BookDetailPage";
import { BookLessonPage } from "@/modules/books/ui/public/BookLessonPage";
import { ExerciseHistoryPage } from "@/modules/books/ui/public/ExerciseHistoryPage";
import { SubmissionResultPage } from "@/modules/books/ui/public/SubmissionResultPage";

export const booksRoutes: AppRouteDef[] = [
  {
    path: "/sach-bai-tap/:bookCode",
    element: <BookDetailPage />,
    layout: "public",
  },
  // Bài học CƠ BẢN — luồng cũ (gọi API DB). Bài NÂNG CAO giờ mở DIALOG từ
  // AdvancedBookSection (xem DigitizedExerciseDialog) — không còn route riêng.
  {
    path: "/sach-bai-tap/:bookCode/:lessonCode",
    element: <BookLessonPage />,
    layout: "public",
  },
  { path: "/sach/:bookCode", element: <BookDetailPage />, layout: "public" },
  // GAP-037: đã gỡ alias "/sach/bai-hoc/:lessonCode". Nó KHÔNG THỂ chạy: thiếu tham số sách nên
  // useCatalogBook không fire → không resolve được lesson id → useCatalogBookLesson bị disable
  // (enabled cần bookId) → trang chỉ ra nhánh "không tìm thấy", và mọi link bài trong đó trả "#"
  // (buildLessonPath fallback khi thiếu bookRouteCode). Không nơi nào trong app trỏ tới alias
  // này, và không có API tra bài→sách để cứu nó. Đường đúng vẫn còn:
  // /sach-bai-tap/:bookCode/:lessonCode.
  // GAP-070: lịch sử + kết quả cần đăng nhập (điều kiện tiên quyết của BOOK-HISTORY/RESULT);
  // Khách vào thẳng URL → chuyển về trang chủ thay vì trang trống/lỗi 401.
  {
    path: "/lich-su-bai-tap",
    element: (
      <RequireAuth loginPath="/">
        <ExerciseHistoryPage />
      </RequireAuth>
    ),
    layout: "public",
  },
  {
    path: "/ket-qua/:submissionId",
    element: (
      <RequireAuth loginPath="/">
        <SubmissionResultPage />
      </RequireAuth>
    ),
    layout: "public",
  },
];
