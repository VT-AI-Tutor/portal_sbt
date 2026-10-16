/**
 * Nhãn tiếng Việt cho các mã của phiên luyện tập (GAP-109).
 *
 * Đặt ở `core/reference` vì cả khu học sinh lẫn khu quản trị đều cần: trước đây bảng "Phiên gần
 * nhất" của màn Tài khoản (trước tên "Quản lý người dùng") hiển thị thẳng mã thô (`practice`, `in_progress`…), còn nhãn
 * tiếng Việt thì nằm private trong StudentActivityPage nên không dùng lại được.
 *
 * "game" là "Chơi game" — KHÔNG phải "Thi đấu" (Thi đấu là màn riêng, xem GAP-091).
 */
export const PRACTICE_MODE_LABEL: Record<string, string> = {
  practice: "Luyện tập",
  game: "Chơi game",
  timed: "Tính giờ",
};

export const PRACTICE_STATUS_LABEL: Record<string, string> = {
  in_progress: "Đang làm",
  completed: "Hoàn thành",
  abandoned: "Đã bỏ dở",
};

export const PRACTICE_SOURCE_LABEL: Record<string, string> = {
  ai_suggested: "AI gợi ý",
  topic: "Theo chủ đề",
  library: "Thư viện",
};

/** Mã lạ (BE thêm giá trị mới) → trả về chính mã, không vỡ giao diện. */
export function practiceModeLabel(code: string): string {
  return PRACTICE_MODE_LABEL[code] ?? code;
}

export function practiceStatusLabel(code: string): string {
  return PRACTICE_STATUS_LABEL[code] ?? code;
}

export function practiceSourceLabel(code: string): string {
  return PRACTICE_SOURCE_LABEL[code] ?? code;
}

/**
 * Nhãn cho các loại câu KHÔNG có trong `QUESTION_TYPE_LABELS` (generated,
 * `core/question-schema/question-types.generated.ts` — cấm sửa tay) VÀ cũng
 * không có alias trong `canonicalQuestionType` (`core/question-schema/adapter.ts`).
 *
 * Sau khi PracticeRunner chuẩn hoá type qua `canonicalQuestionType`, các alias
 * v1.0 (`free_draw` → `drawing` → "Vẽ tự do") tự khớp registry nên KHÔNG cần
 * mặt ở đây. Bảng này chỉ còn giữ loại nằm NGOÀI registry: `short_answer` không
 * nằm trong `QuestionTypeV1` (registry §5.0 chỉ có `essay`) — mapper (F1) route
 * nó qua essay player nhưng `SessionQuestion.question_type` vẫn giữ nguyên
 * `"short_answer"`; không có fallback thì badge hiện thẳng slug thô, mà gấp về
 * `essay` lại hiện sai nhãn "Tự luận". Đã rà soát 8 loại còn lại trong "9 loại
 * câu" của phiên luyện tập (single_choice, multiple_choice, multi_true_false,
 * ordering, matching, classification, question_group, essay) — tất cả đều có
 * trong `QUESTION_TYPE_LABELS`, chỉ `short_answer` cần fallback.
 */
export const PRACTICE_QUESTION_TYPE_LABEL_FALLBACK: Record<string, string> = {
  short_answer: "Trả lời ngắn",
};
