/**
 * Loại đề/phiếu và nhãn hiển thị — HẰNG SỐ của miền, không phải dữ liệu mẫu.
 *
 * Tách khỏi `mock-papers` khi gỡ dữ liệu giả khỏi khu Giáo viên. `PaperSource`
 * và hai bảng nhãn đi kèm từng sống ở đây cho mấy thẻ "nguồn tạo" thời dữ liệu
 * giả; gỡ khi bỏ thẻ "Theo vở bài tập" — lúc đó không chỗ nào còn nhập chúng.
 */
export type PaperKind = "exam" | "worksheet";

export const KIND_LABEL: Record<PaperKind, string> = {
  exam: "Đề kiểm tra",
  worksheet: "Phiếu bài tập",
};
