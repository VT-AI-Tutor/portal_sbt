/**
 * Trang trí bìa sách suy ra từ TÔNG MÀU semantic của môn học
 * (getSubjectDisplay().color) — không switch theo subject_code.
 *
 * Tách khỏi PatternSvg.tsx để file component chỉ export component (react-refresh).
 */

export type CoverPattern =
  | "dots"
  | "grid"
  | "waves"
  | "stars"
  | "circles"
  | "triangles";

export const COLOR_GRADIENT: Record<string, string> = {
  primary: "from-primary via-primary to-info",
  destructive: "from-destructive via-fun to-warning",
  warning: "from-warning via-destructive to-fun",
  success: "from-success via-info to-primary",
  info: "from-info via-fun to-primary",
  fun: "from-fun via-primary to-info",
};

export const COLOR_PATTERN: Record<string, CoverPattern> = {
  primary: "grid",
  destructive: "waves",
  warning: "dots",
  success: "circles",
  info: "stars",
  fun: "triangles",
};
