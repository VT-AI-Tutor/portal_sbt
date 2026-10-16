/**
 * Nhãn tiếng Việt cho `submission_status` của một dòng tiến độ bài giao
 * (Task 8 / lát 1 teacher stack, GAP-094/096). Giá trị lạ trả về chính nó
 * để không nuốt mất dữ liệu chưa được map.
 */
const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  chua_lam: "Chưa làm",
  da_nop: "Đã nộp",
  nop_muon: "Nộp muộn",
  da_cham: "Đã chấm",
};

export function assignmentStatusLabel(status: string): string {
  return ASSIGNMENT_STATUS_LABELS[status] ?? status;
}
