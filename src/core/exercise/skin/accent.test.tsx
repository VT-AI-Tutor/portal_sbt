/**
 * Accent-aware skin contract (Owner 30/7 — "skin thật GIỮ CẦU VỒNG"):
 *
 *  (a) playfulSkin bound inside an AccentProvider yields tokens in that
 *      accent's hue; switching the accent switches the hue while the skin
 *      registered in SKINS stays one object.
 *  (b) plain skins (studioSkin) are NOT affected by the surrounding accent.
 *  (c) PLAYER_ACCENT_OF covers every component in the player manifest — a new
 *      player MUST declare its identity accent.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkinProvider, useSkin } from "./context";
import { AccentProvider, isAccentAware } from "./accent-context";
import { PLAYER_ACCENTS, PLAYER_ACCENT_OF, type PlayerAccentName } from "./accents";
import { playfulAccentSkin, playfulSkin, studioSkin, SKINS } from "./skins";
import type { QuestionPlayerSkin } from "./types";
import { PLAYER_MANIFEST } from "../players/manifest";

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

describe("playfulAccentSkin is accent-aware", () => {
  it("binds the surrounding accent into its tokens (fuchsia player → fuchsia chrome)", () => {
    const skin = boundSkin(playfulAccentSkin, "fuchsia");
    expect(skin.accentBar).toContain("bg-fuchsia-400");
    expect(skin.input?.("idle")).toContain("border-fuchsia-300");
    expect(skin.actionButton?.(true, "primary")).toContain("bg-fuchsia-500");
    expect(skin.emphasis?.("primary", "strong")).toContain("text-fuchsia-700");
    expect(skin.panel?.("inset")).toContain("bg-fuchsia-50");
  });

  it("changes hue when the accent changes, from the SAME registered skin object", () => {
    const fuchsia = boundSkin(playfulAccentSkin, "fuchsia");
    const amber = boundSkin(playfulAccentSkin, "amber");
    expect(fuchsia.accentBar).toContain("bg-fuchsia-400");
    expect(amber.accentBar).toContain("bg-amber-400");
    expect(amber.accentBar).not.toContain("fuchsia");
    // web-own: từ 31/07/2026 registry "playful" của web LÀ bản accent-aware
    // (Owner duyệt bật mặc định) — một object, cầu vồng đến từ kênh accent.
    // Bản CHỈ-CỜ playfulSkin còn lại làm context default tĩnh, không accent-aware.
    expect(SKINS.playful).toBe(playfulAccentSkin);
    expect(isAccentAware(SKINS.playful)).toBe(true);
    expect(isAccentAware(playfulSkin)).toBe(false);
  });

  it("keeps semantic states fixed (correct/wrong stay green/red in every accent)", () => {
    for (const accent of ["fuchsia", "amber", "teal"] as const) {
      const skin = boundSkin(playfulAccentSkin, accent);
      expect(skin.input?.("correct")).toContain("border-green-400");
      expect(skin.input?.("wrong")).toContain("border-red-400");
      expect(skin.banner?.correct).toContain("green");
      expect(skin.banner?.wrong).toContain("red");
    }
  });

  it("returns the same token object for the same accent (cached identity)", () => {
    expect(boundSkin(playfulAccentSkin, "teal")).toBe(boundSkin(playfulAccentSkin, "teal"));
  });
});

describe("plain skins ignore the accent", () => {
  it("studioSkin comes back untouched no matter the surrounding accent", () => {
    expect(boundSkin("studio", "fuchsia")).toBe(studioSkin);
    expect(boundSkin("studio", "amber")).toBe(studioSkin);
    expect(studioSkin.accentBar).toContain("bg-gray-300");
  });

  it("the default registry skin is playful (web student surface)", () => {
    // web-own: khác studio — SKINS.default của web là playfulAccentSkin
    // (surface học sinh, accent-aware từ 31/07/2026).
    expect(SKINS.default).toBe(playfulAccentSkin);
  });
});

describe("PLAYER_ACCENT_OF covers the whole manifest", () => {
  it("every manifest component declares an identity accent", () => {
    const components = [...new Set(PLAYER_MANIFEST.map((entry) => entry.component))];
    const missing = components.filter((component) => !PLAYER_ACCENT_OF[component]);
    // Player mới phải khai accent trong PLAYER_ACCENT_OF (skin/accents.ts).
    expect(missing).toEqual([]);
  });

  it("every declared accent resolves to a real accent set", () => {
    for (const [component, accent] of Object.entries(PLAYER_ACCENT_OF)) {
      expect(PLAYER_ACCENTS[accent], `${component} → ${accent}`).toBeDefined();
    }
  });
});
