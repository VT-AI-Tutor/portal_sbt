/**
 * Cổng "được hoàn tất hay chưa" — tách khỏi LectureFlow để test THUẦN, không
 * phải dựng cả cây component chỉ để kiểm một phép so sánh.
 *
 * Review Task 13 vòng 1: hoàn tất là CỬA MỘT CHIỀU (máy chủ khoá bài giảng,
 * status='ready', mọi sửa hoạt động sau đó bị từ chối). Để lọt một bản nháp
 * dở (dây chuyền sinh rớt mạng giữa chừng) hay một bản còn `sectionErrors`
 * treo qua cửa này thì nội dung thiếu bị khoá VĨNH VIỄN — không có cách sửa.
 *
 * Review vòng 2 (Nghiêm trọng) — bản đầu coi MỌI hoạt động có nội dung mà
 * `question_ids` rỗng là "thiếu quiz". SAI: máy chủ hợp lệ trả hoạt động
 * "đã xét, không cần quiz" (mô hình đề xuất 0 câu, hoặc use case bỏ hẳn khoá
 * quiz) — lúc đó `question_ids` rỗng ĐÚNG THIẾT KẾ, không phải lỗi. Chặn
 * nhầm ca này khoá VĨNH VIỄN một bài giảng hợp lệ, và đẩy
 * `LectureFlow.handleRegenerate` vào vòng lặp sinh-lại vô ích (sinh xong máy
 * chủ vẫn trả không-cần-quiz, `question_ids` vẫn rỗng).
 *
 * Máy chủ nay LƯU đặc tả quiz vào chính section (`LectureSection.quiz`,
 * xem teacherLectureApi.ts) — BA trạng thái: vắng mặt (chưa biết/bài giảng
 * cũ), `{count:0}` (đã xét, không cần), `{count:n>0, level_code}` (có đề
 * xuất thật). Cổng này CHỈ được chặn ở trạng thái thứ ba kết hợp
 * `question_ids` rỗng — `sectionMissingQuiz()` là nguồn thật DUY NHẤT cho
 * luật đó, dùng CHUNG với `LectureFlow.handleRegenerate` để hai nơi không
 * lệch pha nữa (từng mã hoá riêng `question_ids.length===0` ở cả hai chỗ).
 */
import type {
  LectureSection,
  LectureSectionKey,
} from "@/modules/teacher/api/teacherLectureApi";

function isEmptyContent(section: LectureSection): boolean {
  return section.blocks.length === 0 && section.slides.length === 0;
}

/**
 * Nguồn thật DUY NHẤT cho luật "hoạt động này có đang thiếu quiz hay
 * không" — dùng CHUNG ở `blockingSectionGroups` (cổng hoàn tất) VÀ
 * `LectureFlow.handleRegenerate` (chọn nhánh "Sinh lại phần này" có kèm
 * bốc/gắn quiz hay chỉ đổi nội dung). Gom về một hàm để không lệch pha giữa
 * hai nơi như bản đầu.
 *
 * CHỈ true khi: có nội dung (khối đọc hoặc slide), máy chủ CÓ đề xuất quiz
 * thật (`quiz.count > 0`), và chưa gắn câu nào (`question_ids` rỗng).
 * `quiz` vắng mặt (chưa sinh lần nào / bài giảng cũ trước khi máy chủ lưu
 * trường này) hoặc `quiz.count === 0` (máy chủ ĐÃ XÉT, không cần) đều KHÔNG
 * coi là thiếu.
 */
export function sectionMissingQuiz(section: LectureSection): boolean {
  return (
    !isEmptyContent(section) &&
    (section.quiz?.count ?? 0) > 0 &&
    section.question_ids.length === 0
  );
}

export interface BlockingSectionGroups {
  /** Rỗng cả khối đọc lẫn slide — CHƯA XONG nội dung. */
  incomplete: LectureSectionKey[];
  /** Có nội dung, máy chủ có đề xuất quiz thật nhưng chưa gắn câu nào —
   * THIẾU câu hỏi trắc nghiệm. */
  missingQuiz: LectureSectionKey[];
  /** Còn `sectionErrors` treo mà KHÔNG rơi vào hai nhóm trên (ví dụ lỗi xảy
   * ra ở một lượt sinh lại nội dung đã có sẵn và quiz đã ổn từ trước) — vẫn
   * phải chặn hoàn tất nhưng không quy được chính xác về "chưa xong nội
   * dung" hay "thiếu câu hỏi". */
  errored: LectureSectionKey[];
}

/**
 * Ba nhóm hoạt động đang CHẶN hoàn tất — tách riêng để nơi gọi (LectureFlow)
 * báo ĐÚNG lý do cho giáo viên (review vòng 2, mức Quan trọng): "chưa xong
 * nội dung" khác hẳn "còn thiếu câu hỏi trắc nghiệm", gộp chung một câu từng
 * khiến giáo viên tưởng nội dung hỏng rồi bấm sinh lại nhầm chỗ.
 */
export function blockingSectionGroups(
  sections: LectureSection[],
  sectionErrors: Partial<Record<LectureSectionKey, string>>,
): BlockingSectionGroups {
  const incomplete = sections.filter(isEmptyContent).map((s) => s.key);
  const missingQuiz = sections.filter(sectionMissingQuiz).map((s) => s.key);
  const accounted = new Set<LectureSectionKey>([
    ...incomplete,
    ...missingQuiz,
  ]);
  const errored = (Object.keys(sectionErrors) as LectureSectionKey[]).filter(
    (key) => !accounted.has(key),
  );
  return { incomplete, missingQuiz, errored };
}

/**
 * Khoá của các hoạt động đang CHẶN hoàn tất — hợp cả ba nhóm của
 * `blockingSectionGroups`, khử trùng. Mảng rỗng = đủ điều kiện hoàn tất.
 */
export function blockingSectionKeys(
  sections: LectureSection[],
  sectionErrors: Partial<Record<LectureSectionKey, string>>,
): LectureSectionKey[] {
  const { incomplete, missingQuiz, errored } = blockingSectionGroups(
    sections,
    sectionErrors,
  );
  return [...new Set([...incomplete, ...missingQuiz, ...errored])];
}
