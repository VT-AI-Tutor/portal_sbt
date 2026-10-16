/**
 * Skin context + provider + hook.
 *
 * The theme's default skin is resolved ONCE and provided at the app root
 * (AppProviders → <SkinProvider skin={getDefaultSkin()}>), so `useSkin()` is a
 * pure `useContext` read — no per-call resolution on the hot path (it runs many
 * times per render, once per player + shared chrome).
 *
 * Context default = `playfulSkin` (the empty no-op skin): a safe, static value
 * for any component rendered outside the root provider (e.g. an isolated test),
 * with no dependency on window.__APP_CONFIG__ at module-import time.
 *
 * Inheritance / override: a nested <SkinProvider> (e.g. the players demo, or a
 * question_group child with its own skin) overrides for its subtree; the
 * nearest provider wins, exactly as React context does.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { QuestionPlayerSkin, SkinName } from "./types";
import { playfulSkin, resolveSkin } from "./skins";
import { useSkinBoundToAccent, type AnySkin } from "./accent-context";

const SkinContext = createContext<AnySkin>(playfulSkin);

export function useSkin(): QuestionPlayerSkin {
  // Skin accent-aware (playfulSkin) được bind với accent của player đang
  // render; skin thường trả nguyên vẹn — xem accent-context.tsx.
  return useSkinBoundToAccent(useContext(SkinContext));
}

export function SkinProvider({
  skin,
  children,
}: {
  skin: AnySkin | SkinName | undefined;
  children: ReactNode;
}) {
  return (
    <SkinContext.Provider value={resolveSkin(skin)}>
      {children}
    </SkinContext.Provider>
  );
}
