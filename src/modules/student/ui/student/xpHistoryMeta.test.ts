import { describe, expect, it } from "vitest";
import { getXpHistoryMeta } from "./xpHistoryMeta";

describe("getXpHistoryMeta", () => {
  it("correct_answers → 'Trả lời đúng'", () => {
    expect(getXpHistoryMeta("correct_answers")).toEqual({
      label: "Trả lời đúng",
      icon: "correct",
    });
  });

  it("session_completed → 'Hoàn thành bài'", () => {
    expect(getXpHistoryMeta("session_completed")).toEqual({
      label: "Hoàn thành bài",
      icon: "session",
    });
  });

  it("coins_* → 'Thưởng xu' (mọi hậu tố)", () => {
    expect(getXpHistoryMeta("coins_bonus")).toEqual({ label: "Thưởng xu", icon: "coins" });
    expect(getXpHistoryMeta("coins_streak")).toEqual({ label: "Thưởng xu", icon: "coins" });
  });

  it("type lạ → hiển thị nguyên văn, icon default", () => {
    expect(getXpHistoryMeta("mystery_event")).toEqual({
      label: "mystery_event",
      icon: "default",
    });
  });
});
