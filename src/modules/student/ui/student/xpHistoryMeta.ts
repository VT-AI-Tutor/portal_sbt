/**
 * Nhãn + nhóm icon hiển thị cho một dòng "Lịch sử XP" (Achievements page).
 * Tách khỏi component để test thuần — `xp_history[].type` do BE trả về, danh
 * sách giá trị đã biết: correct_answers, session_completed, coins_* (nhiều
 * loại thưởng xu khác nhau, gộp chung nhãn). Type lạ → hiển thị nguyên văn,
 * không throw.
 */
export type XpHistoryIconKey = "correct" | "session" | "coins" | "default";

export interface XpHistoryMeta {
  label: string;
  icon: XpHistoryIconKey;
}

export function getXpHistoryMeta(type: string): XpHistoryMeta {
  if (type === "correct_answers") {
    return { label: "Trả lời đúng", icon: "correct" };
  }
  if (type === "session_completed") {
    return { label: "Hoàn thành bài", icon: "session" };
  }
  if (type.startsWith("coins_")) {
    return { label: "Thưởng xu", icon: "coins" };
  }
  return { label: type, icon: "default" };
}
