/**
 * Header/profile subtitle cho học sinh — ưu tiên `class_name` (VD "4A") do
 * giáo viên/HS tự đặt; chỉ fallback về `Lớp {level}` khi chưa có class_name.
 * Rồi nối với `school_name` nếu có. Không có gì → fallback email → "Học sinh".
 */
export interface StudentSubtitleUser {
  class_name?: string;
  level?: string;
  school_name?: string;
  email?: string;
}

export function buildStudentSubtitle(
  user: StudentSubtitleUser | null | undefined,
): string {
  const className = user?.class_name?.trim();
  const parts = [
    className || (user?.level ? `Lớp ${user.level}` : null),
    user?.school_name ?? null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return user?.email ?? "Học sinh";
}
