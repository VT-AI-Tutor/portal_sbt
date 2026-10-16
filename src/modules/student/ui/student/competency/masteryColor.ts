/**
 * Ngưỡng màu dùng chung cho mọi hiển thị "mức thành thạo" (%) trong màn Năng
 * lực + Luyện tập — thẻ môn học, LevelLadder, ComponentRadar, TopicList.
 *
 * Ngưỡng: ≥75 giỏi (xanh lá) · ≥60 khá (xanh dương) · ≥45 trung bình (vàng) ·
 * <45 yếu (đỏ) · null (chưa có dữ liệu) → xám.
 *
 * Hex cố định (không dùng CSS var) để dùng trực tiếp làm `fill` trong SVG
 * recharts — các mã lấy từ bảng màu Tailwind, đọc tốt trên cả nền sáng/tối.
 */
export type MasteryTone = "success" | "info" | "warning" | "danger" | "muted";

export interface MasteryColor {
  tone: MasteryTone;
  hex: string;
}

const TONE_HEX: Record<MasteryTone, string> = {
  success: "#10b981", // emerald-500 — ≥75%, Giỏi
  info: "#3b82f6", // blue-500 — ≥60%, Khá
  warning: "#f59e0b", // amber-500 — ≥45%, Trung bình
  danger: "#ef4444", // red-500 — <45%, Yếu
  muted: "#9ca3af", // gray-400 — chưa có dữ liệu
};

export function masteryColor(percent: number | null): MasteryColor {
  if (percent === null) {
    return { tone: "muted", hex: TONE_HEX.muted };
  }
  if (percent >= 75) {
    return { tone: "success", hex: TONE_HEX.success };
  }
  if (percent >= 60) {
    return { tone: "info", hex: TONE_HEX.info };
  }
  if (percent >= 45) {
    return { tone: "warning", hex: TONE_HEX.warning };
  }
  return { tone: "danger", hex: TONE_HEX.danger };
}

/** Chú giải màu — cùng nguồn TONE_HEX với thanh thật, không bao giờ lệch. */
export const MASTERY_LEGEND: { tone: MasteryTone; hex: string; label: string }[] = [
  { tone: "success", hex: TONE_HEX.success, label: "≥75 Giỏi" },
  { tone: "info", hex: TONE_HEX.info, label: "60–74 Khá" },
  { tone: "warning", hex: TONE_HEX.warning, label: "45–59 Trung bình" },
  { tone: "danger", hex: TONE_HEX.danger, label: "<45 Yếu" },
];
