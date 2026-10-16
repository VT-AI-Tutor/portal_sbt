import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCENT,
  PLAYER_ACCENTS,
  isAccentAware,
  playfulAccentSkin,
  type AccentAwareSkin,
} from "@/core/exercise/skin";
import { withPresentation } from "./bookPlayerSkin";

/**
 * Cạm bẫy file này canh: skin mặc định là ACCENT-AWARE, token chỉ sinh lúc
 * `forAccent()` chạy. `{ ...skin, presentation }` qua được cả tsc lẫn runtime
 * nhưng trả skin RỖNG TOKEN — player mất sạch màu, không lỗi nào nổ.
 */
describe("withPresentation", () => {
  const accent = PLAYER_ACCENTS[DEFAULT_ACCENT];
  const patched = withPresentation(playfulAccentSkin, { hideChainMatchHint: true });

  it("giữ nguyên dạng accent-aware", () => {
    expect(isAccentAware(patched)).toBe(true);
  });

  it("giữ nguyên token của skin gốc", () => {
    const before = playfulAccentSkin.forAccent(accent);
    const after = (patched as AccentAwareSkin).forAccent(accent);
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    expect(after.heading).toBe(before.heading);
    expect(after.accentBar).toBe(before.accentBar);
  });

  it("thêm cờ mới mà không xoá cờ presentation đang có", () => {
    const before = playfulAccentSkin.forAccent(accent);
    const after = (patched as AccentAwareSkin).forAccent(accent);
    expect(after.presentation?.hideChainMatchHint).toBe(true);
    expect(after.presentation?.choicePill).toBe(before.presentation?.choicePill);
    expect(after.presentation?.contentAsHeading).toBe(
      before.presentation?.contentAsHeading,
    );
  });

  it("không đụng tới skin gốc", () => {
    expect(
      playfulAccentSkin.forAccent(accent).presentation?.hideChainMatchHint,
    ).toBeUndefined();
  });
});
