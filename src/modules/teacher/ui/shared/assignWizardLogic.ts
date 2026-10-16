/**
 * Logic thuần cho hộp thoại Giao bài tập (AssignWizard) — tách khỏi component để test bằng
 * vitest, cùng khuôn với customPracticeLogic của khu học sinh.
 */

/**
 * Những thứ CÒN THIẾU để đi tiếp bước sau, viết bằng lời người đọc được.
 *
 * Vì sao cần: hộp thoại chỉ khoá nút "Tiếp tục" mà không nói thiếu gì. Thẻ lớp trông như đã
 * chọn sẵn khi trường chỉ có một lớp, nên giáo viên chọn phiếu xong thấy nút vẫn khoá và
 * không hiểu vì sao (báo lỗi nghiệm thu 19/8). Mảng rỗng = đủ điều kiện, nút mở.
 */
export function missingAssignFields(state: {
  classId: string | null | undefined;
  paperId: string | null | undefined;
  due: string | null | undefined;
}): string[] {
  return [
    !state.classId ? "lớp nhận bài" : null,
    !state.paperId ? "phiếu bài tập" : null,
    !state.due ? "hạn nộp" : null,
  ].filter((v): v is string => v !== null);
}
