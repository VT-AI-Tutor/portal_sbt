/**
 * `corporateSkin` là BẢN FORK ĐỘC LẬP của `playfulAccentSkin` (chốt 20/08/2026).
 *
 * Bộ test này khoá HAI thuộc tính đối nghịch nhau — cả hai đều là lý do fork tồn tại:
 *
 *  (a) TƯƠNG ĐƯƠNG — ngày fork, mọi token × mọi accent × mọi đối số phải trả về
 *      ĐÚNG chuỗi class như playful. Đây là bằng chứng "không đổi pixel nào".
 *      Khi NXBGD bắt đầu customize corporate, các case ở đây SẼ đỏ — lúc đó
 *      sửa/xoá case tương ứng là ĐÚNG QUY TRÌNH, không phải regression.
 *
 *  (b) ĐỘC LẬP — hai skin KHÔNG dùng chung object nào. Các case này phải xanh
 *      VĨNH VIỄN: chúng chặn refactor "DRY" gộp `CORPORATE_PRESENTATION` /
 *      `corporateTokens` / `corporateTokenCache` ngược lại vào playful, vốn sẽ
 *      âm thầm huỷ toàn bộ mục đích của fork.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkinProvider, useSkin } from "./context";
import { AccentProvider, isAccentAware } from "./accent-context";
import { PLAYER_ACCENTS, type PlayerAccentName } from "./accents";
import { corporateSkin, playfulAccentSkin, SKINS } from "./skins";
import type {
  AccentRole,
  ChipState,
  EmphasisLevel,
  FeedbackKind,
  InputState,
  OptionState,
  PanelVariant,
  QuestionPlayerSkin,
  SkinTone,
  ZoneState,
} from "./types";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Render useSkin() under a given skin + accent and capture the bound tokens. */
function boundSkin(
  skin: Parameters<typeof SkinProvider>[0]["skin"],
  accent: PlayerAccentName,
): QuestionPlayerSkin {
  let captured: QuestionPlayerSkin | undefined;
  function Probe() {
    captured = useSkin();
    return null;
  }
  act(() => {
    root.render(
      <SkinProvider skin={skin}>
        <AccentProvider accent={accent}>
          <Probe />
        </AccentProvider>
      </SkinProvider>,
    );
  });
  if (!captured) throw new Error("useSkin() probe did not render");
  return captured;
}

const ACCENTS = Object.keys(PLAYER_ACCENTS) as PlayerAccentName[];

const TONES: SkinTone[] = ["primary", "secondary", "success", "danger", "neutral"];
const OPTION_STATES: OptionState[] = ["idle", "selected", "correct", "wrong"];
const INPUT_STATES: InputState[] = ["idle", "focus", "correct", "wrong"];
const CHIP_STATES: ChipState[] = ["idle", "placed", "selected", "correct", "wrong"];
const ZONE_STATES: ZoneState[] = ["idle", "active", "filled", "correct", "wrong"];
const FEEDBACK_KINDS: FeedbackKind[] = ["success", "error", "neutral"];
const PANEL_VARIANTS: PanelVariant[] = ["card", "tray", "media", "table", "board", "inset"];
const LEVELS: EmphasisLevel[] = ["strong", "medium", "soft"];
const ROLES: AccentRole[] = ["fill", "softFill", "text", "ring", "track", "shadow"];

/** Every (label, call) pair covering the whole token surface of a bound skin. */
function tokenCalls(s: QuestionPlayerSkin): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [
    ["accentBar", s.accentBar],
    ["heading", s.heading],
    ["body", s.body],
    ["instruction", s.instruction],
    ["surface", s.surface],
    ["banner.correct", s.banner?.correct],
    ["banner.wrong", s.banner?.wrong],
    ["banner.neutral", s.banner?.neutral],
  ];
  for (const t of TONES) {
    out.push([`optionLabel(${t})`, s.optionLabel?.(t)]);
    for (const st of OPTION_STATES) {
      out.push([`optionCard(${st},${t})`, s.optionCard?.(st, t)]);
      out.push([`inlineToken(${st},${t})`, s.inlineToken?.(st, t)]);
      out.push([`badge(${t},${st})`, s.badge?.(t, st)]);
    }
    for (const cs of CHIP_STATES) out.push([`chip(${cs},${t})`, s.chip?.(cs, t)]);
    for (const lv of LEVELS) out.push([`emphasis(${t},${lv})`, s.emphasis?.(t, lv)]);
    for (const r of ROLES) out.push([`accent(${t},${r})`, s.accent?.(t, r)]);
    for (const enabled of [true, false]) {
      out.push([`actionButton(${enabled},${t})`, s.actionButton?.(enabled, t)]);
    }
    for (const active of [true, false, undefined]) {
      out.push([`iconButton(${t},${active})`, s.iconButton?.(t, active)]);
    }
  }
  for (const st of INPUT_STATES) out.push([`input(${st})`, s.input?.(st)]);
  for (const zs of ZONE_STATES) {
    out.push([`dropZone(${zs})`, s.dropZone?.(zs)]);
    out.push([`marker(${zs})`, s.marker?.(zs)]);
  }
  for (const k of FEEDBACK_KINDS) out.push([`feedback(${k})`, s.feedback?.(k)]);
  for (const v of PANEL_VARIANTS) {
    out.push([`panel(${v})`, s.panel?.(v)]);
    for (const zs of ZONE_STATES) out.push([`panel(${v},${zs})`, s.panel?.(v, zs)]);
  }
  return out;
}

// ─── (a) TƯƠNG ĐƯƠNG tại thời điểm fork ──────────────────────────────────────

describe("corporateSkin renders identically to playfulAccentSkin (fork-day parity)", () => {
  it.each(ACCENTS)("every token returns the same string for accent %s", (accent) => {
    const p = tokenCalls(boundSkin(playfulAccentSkin, accent));
    const c = tokenCalls(boundSkin(corporateSkin, accent));
    expect(c.length).toBe(p.length);
    for (let i = 0; i < p.length; i++) {
      const [label, expected] = p[i];
      const [, actual] = c[i];
      expect(actual, `${label} @${accent}`).toBe(expected);
    }
  });

  it.each(ACCENTS)("declares exactly the same token keys for accent %s", (accent) => {
    expect(Object.keys(boundSkin(corporateSkin, accent)).sort()).toEqual(
      Object.keys(boundSkin(playfulAccentSkin, accent)).sort(),
    );
  });

  it("carries the same presentation flags (shape parity)", () => {
    expect(boundSkin(corporateSkin, "blue").presentation).toEqual(
      boundSkin(playfulAccentSkin, "blue").presentation,
    );
  });

  it("leaves optionCard undefined in BOTH — players keep their joyful fallback", () => {
    // Chủ ý kế thừa từ playful: một token phục vụ năm HỌ option (pill / ảnh /
    // likert / tile / semantic). Đây là điểm duy nhất hai skin còn dùng chung
    // sau fork — sửa fallback optionCard của player sẽ đổi CẢ HAI.
    expect(boundSkin(playfulAccentSkin, "blue").optionCard).toBeUndefined();
    expect(boundSkin(corporateSkin, "blue").optionCard).toBeUndefined();
  });
});

// ─── (b) ĐỘC LẬP — các case này phải xanh vĩnh viễn ─────────────────────────

describe("corporateSkin is independent of playfulAccentSkin (must stay green forever)", () => {
  it("is a distinct object, not an alias", () => {
    expect(corporateSkin).not.toBe(playfulAccentSkin);
    expect(SKINS.corporate).toBe(corporateSkin);
    expect(SKINS.playful).toBe(playfulAccentSkin);
  });

  it("is accent-aware, like playful", () => {
    expect(isAccentAware(corporateSkin)).toBe(true);
  });

  it("identifies itself as corporate", () => {
    expect(corporateSkin.name).toBe("corporate");
    expect(boundSkin(corporateSkin, "blue").name).toBe("corporate");
    expect(boundSkin(playfulAccentSkin, "blue").name).toBe("playful");
  });

  it("does NOT share the presentation object with playful", () => {
    // Chặn refactor gộp CORPORATE_PRESENTATION về PLAYFUL_PRESENTATION: cùng
    // giá trị (toEqual ở trên) nhưng PHẢI khác identity, nếu không sửa cờ của
    // skin này sẽ đổi luôn skin kia.
    expect(boundSkin(corporateSkin, "blue").presentation).not.toBe(
      boundSkin(playfulAccentSkin, "blue").presentation,
    );
  });

  it("does NOT share the token cache with playful", () => {
    // playfulTokenCache key theo TÊN HUE, không có skin trong key — dùng chung
    // Map sẽ khiến skin nào render hue trước thì "chiếm" hue đó.
    for (const accent of ACCENTS) {
      expect(boundSkin(corporateSkin, accent)).not.toBe(
        boundSkin(playfulAccentSkin, accent),
      );
    }
  });

  it("keeps its own per-accent identity so memo consumers don't churn", () => {
    expect(boundSkin(corporateSkin, "teal")).toBe(boundSkin(corporateSkin, "teal"));
    expect(boundSkin(corporateSkin, "teal")).not.toBe(boundSkin(corporateSkin, "amber"));
  });

  it("binds the surrounding accent into its own tokens", () => {
    const skin = boundSkin(corporateSkin, "fuchsia");
    expect(skin.accentBar).toContain("bg-fuchsia-400");
    expect(skin.input?.("idle")).toContain("border-fuchsia-300");
  });
});
