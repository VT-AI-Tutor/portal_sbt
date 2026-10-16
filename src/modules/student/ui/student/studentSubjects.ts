import { getSubjectDisplay } from "@/core/reference";

const LOWER_PRIMARY_SUBJECT_CODES = [
  "toan", "tieng-viet", "tu-nhien-xa-hoi", "tieng-anh", "dao-duc",
] as const;

const PRIMARY_SUBJECT_CODES = [
  "khoa-hoc", "toan", "tieng-viet", "lich-su-dia-li", "tieng-anh",
] as const;

const SECONDARY_SUBJECT_CODES = [
  "khoa-hoc-tu-nhien", "toan", "ngu-van", "lich-su-dia-li", "tieng-anh",
] as const;

const HIGH_SCHOOL_SUBJECT_CODES = [
  "toan", "ngu-van", "vat-li", "hoa-hoc", "sinh-hoc",
] as const;

/**
 * Bộ mã môn theo khối lớp — lớp 1-3 dùng bộ tiểu học dưới (Tự nhiên và Xã
 * hội/Đạo đức, chưa tách Khoa học & Lịch sử-Địa lí), lớp 4-5 dùng bộ tiểu học
 * trên (Khoa học/Lịch sử-Địa lí), lớp 6-9 dùng bộ THCS (KHTN/Ngữ văn), lớp
 * 10-12 dùng bộ THPT (Vật lí/Hoá học/Sinh học tách riêng thay vì gộp KHTN).
 * `level` không parse được hoặc ngoài khoảng → fallback bộ tiểu học trên.
 */
export function getStudentSubjectCodes(level: string | null | undefined): string[] {
  const n = level == null ? NaN : parseInt(level, 10);
  if (n >= 1 && n <= 3) return [...LOWER_PRIMARY_SUBJECT_CODES];
  if (n >= 4 && n <= 5) return [...PRIMARY_SUBJECT_CODES];
  if (n >= 6 && n <= 9) return [...SECONDARY_SUBJECT_CODES];
  if (n >= 10 && n <= 12) return [...HIGH_SCHOOL_SUBJECT_CODES];
  return [...PRIMARY_SUBJECT_CODES];
}

export function getStudentSubjects(level: string | null | undefined) {
  return [
    { code: "all", label: "Tất cả", emoji: "✨" },
    ...getStudentSubjectCodes(level).map((code) => {
      const d = getSubjectDisplay(code);
      return { code, label: d.label, emoji: d.emoji };
    }),
  ];
}
