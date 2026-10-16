/**
 * AccentContext + binding accent vào skin. File SYNC CHUNG studio↔web —
 * useSkin() của mỗi repo gọi bindSkinToAccent() (context.tsx mỗi repo chỉ
 * lệch vài dòng perf, phần binding nằm trọn ở đây).
 *
 * Luồng: dispatch tra PLAYER_ACCENT_OF[component] → bọc <AccentProvider>
 * quanh player → useSkin() đọc cả SkinContext lẫn AccentContext:
 * - skin thường (studioSkin/darkSkin/object tuỳ biến) → trả nguyên vẹn,
 *   accent không ảnh hưởng (tương thích ngược tuyệt đối);
 * - skin accent-aware (playfulAccentSkin, corporateSkin) → gọi factory
 *   `forAccent(accentSet)` và memo theo (skin, accent) — mọi call site
 *   `skin.input("idle")` giữ nguyên.
 *
 * `corporateSkin` nằm ở nhóm THỨ HAI từ 20/08/2026 (trước đó là skin thường):
 * nó là bản fork độc lập của playful và cũng là factory `forAccent`.
 *
 * PlayerShell cũng đọc AccentContext để vẽ thanh accent bar (thay prop
 * `accent="bg-x-400"` cũ của từng player).
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { QuestionPlayerSkin } from "./types";
import {
  DEFAULT_ACCENT,
  PLAYER_ACCENTS,
  type PlayerAccentName,
  type PlayerAccentSet,
} from "./accents";

/**
 * Skin accent-aware: thay vì một object token tĩnh, khai một factory nhận
 * accent của player đang render. `name` giữ ở ngoài để resolveSkin/debug
 * không phải gọi factory.
 */
export interface AccentAwareSkin {
  name: string;
  forAccent: (accent: PlayerAccentSet) => QuestionPlayerSkin;
}

export type AnySkin = QuestionPlayerSkin | AccentAwareSkin;

export function isAccentAware(skin: AnySkin): skin is AccentAwareSkin {
  return typeof (skin as AccentAwareSkin).forAccent === "function";
}

const AccentContext = createContext<PlayerAccentSet>(
  PLAYER_ACCENTS[DEFAULT_ACCENT],
);

export function useAccent(): PlayerAccentSet {
  return useContext(AccentContext);
}

export function AccentProvider({
  accent,
  children,
}: {
  accent: PlayerAccentName | undefined;
  children: ReactNode;
}) {
  const set = PLAYER_ACCENTS[accent ?? DEFAULT_ACCENT] ?? PLAYER_ACCENTS[DEFAULT_ACCENT];
  return (
    <AccentContext.Provider value={set}>
      {/* data-accent để test/QA soi player đang mang bản sắc nào */}
      <div data-accent={set.name} className="contents">
        {children}
      </div>
    </AccentContext.Provider>
  );
}

/**
 * Hook dùng trong useSkin() của từng repo: bind skin hiện hành với accent
 * hiện hành. Memo theo cặp (skin, accent) — factory chỉ chạy lại khi một
 * trong hai đổi, giữ chi phí ngang useContext thuần cho skin thường.
 */
export function useSkinBoundToAccent(skin: AnySkin): QuestionPlayerSkin {
  const accent = useAccent();
  return useMemo(
    () => (isAccentAware(skin) ? skin.forAccent(accent) : skin),
    [skin, accent],
  );
}
