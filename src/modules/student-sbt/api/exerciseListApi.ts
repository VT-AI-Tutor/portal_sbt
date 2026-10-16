/**
 * Nguồn dữ liệu màn "Bài tập của tôi" (I.8): quét TOÀN BỘ bài tập của học sinh qua
 * `exercise-list` (không truyền lessonId ⇒ trả mọi bài, kèm bookId/bookName, môn học
 * và mã sách). Response tự đủ dữ liệu — không cần gọi thêm `lcmsListBooks`.
 *
 * Phân trang tới hết thay vì cắt cứng 1 trang. Điều kiện dừng CHẮC CHẮN là **trang
 * rỗng** (server hết dữ liệu) — KHÔNG dựa vào trang ngắn hơn PAGE_SIZE vì server có
 * thể tự giới hạn kích thước trang. `total` chỉ dùng như cận trên để dừng sớm.
 * MAX_PAGES là chốt chặn chống lặp vô hạn.
 */
import { lcmsListExerciseSubmissions } from "@/core/api/lcmsAdapter";
import type { ExerciseSubmissionGroup } from "@/core/api/lcmsAdapter";

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export async function fetchAllExerciseGroups(): Promise<
  ExerciseSubmissionGroup[]
> {
  const groups: ExerciseSubmissionGroup[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { groups: batch, total } = await lcmsListExerciseSubmissions({
      page,
      limit: PAGE_SIZE,
    });
    if (batch.length === 0) break; // hết dữ liệu — dừng chắc chắn
    groups.push(...batch);
    if (total != null && total > 0 && groups.length >= total) break; // đã đủ theo total
  }
  return groups;
}
