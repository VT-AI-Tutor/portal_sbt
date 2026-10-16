import type { StudentBand } from "@/modules/manager/api/managerApi";

/** Nhãn + màu cho xếp loại học lực, dùng chung mọi bảng khu Ban giám hiệu. */
export const BAND_LABELS: Record<StudentBand, string> = {
  hoc_tot: "Học tốt",
  trung_binh: "Trung bình",
  can_ho_tro: "Cần hỗ trợ",
  chua_du_lieu: "Chưa có dữ liệu",
};

export const BAND_CLASSES: Record<StudentBand, string> = {
  hoc_tot: "bg-green-100 text-green-700",
  trung_binh: "bg-sky-100 text-sky-700",
  can_ho_tro: "bg-amber-100 text-amber-800",
  chua_du_lieu: "bg-muted text-muted-foreground",
};

/** Điểm hiển thị kiểu Việt Nam (dấu phẩy thập phân); chưa có điểm thì gạch ngang. */
export function formatScore(score: number | null): string {
  return score === null ? "—" : score.toFixed(1).replace(".", ",");
}
