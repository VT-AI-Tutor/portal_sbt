import type { ReactNode } from "react";
import {
  AccentProvider,
  useSkin,
  type PlayerAccentName,
  type QuestionPlayerSkin,
} from "@/core/exercise/skin";

/**
 * web-own: chưa upstream lên studio (xem WEB-OWN PATCHES trong
 * apps/learner/scripts/detokenize-players.mjs).
 *
 * Bản sắc CỘT của các player matching — một nguồn cho cả ConnectLinesPlayer,
 * TwoColumnMatchPlayer (cột đích) lẫn ChainMatchPlayer (cả ba cột).
 *
 * Vì sao phải là component chứ không phải một chuỗi class đè thêm: đè literal
 * Tailwind lên sau `skin.chip?.()` thì twMerge ghi đè MỌI skin, kể cả `darkSkin`
 * (ô xám đậm dính `hover:bg-blue-50` gần trắng → chữ `text-gray-200` không còn
 * đọc được) và `studioSkin` (bản render trung thực cho QA). Hệ accent có sẵn
 * (`PLAYER_ACCENTS`) sinh ra đúng để giải việc này: bọc cột trong accent `blue`
 * thì skin accent-aware tự trả tông xanh, còn skin thường giữ nguyên bảng màu
 * của nó — không rò một giọt nào.
 *
 * Kèm render-prop vì className là prop của thẻ ở scope CHA, mà accent chỉ tới
 * được component CON: `children(skin)` đẩy phần tính class xuống dưới provider.
 *
 * Huy hiệu tròn A/B/C lấy màu từ `BADGE_TONE` trong MatchingColumnLabel.tsx —
 * đổi hue ở đây thì đổi cả bên đó.
 */
export const MATCH_TARGET_ACCENT = "blue" as const;

/**
 * Chuỗi ba cột: mỗi cột MỘT accent, vì "nhìn nhầm cột này ra cột kia" nặng hơn
 * hẳn khi có ba cột. Trái giữ đúng accent của player (fuchsia) như cột A của
 * bản hai cột, phải giữ `MATCH_TARGET_ACCENT` như cột B; cột giữa lấy violet —
 * nằm giữa hai tông kia trên vòng màu mà vẫn tránh xa ba màu ĐÃ MANG NGHĨA
 * trong player: vàng (ô đang chọn), xanh lá (đúng), đỏ (sai).
 */
export const MATCH_CHAIN_ACCENTS = {
  left: "fuchsia",
  middle: "violet",
  right: MATCH_TARGET_ACCENT,
} as const;


/**
 * Chấm đầu nối của một ô, theo ĐÚNG màu viền của ô ở từng state (inline style/SVG
 * không nhận class Tailwind nên phải là hex). Hex phải khớp `PLAYER_ACCENTS[accent]`
 * + bảng state của skin — đổi một bên thì đổi cả hai.
 *
 * Đây là chi tiết per-element mà hệ skin cố ý không với tới (cùng nhóm với
 * LINE_COLORS/EXAMPLE_LINE_HEX), nên nó là literal ở cả mọi skin.
 */
export type MatchEndpointState = "idle" | "selected" | "placed" | "correct" | "wrong";

/** Hai state ăn theo TÔNG CỘT: viền `-300` lúc nghỉ, `-400` lúc đã nối. */
const ACCENT_ENDPOINT_HEX: Record<
  (typeof MATCH_CHAIN_ACCENTS)[keyof typeof MATCH_CHAIN_ACCENTS],
  { idle: string; placed: string }
> = {
  fuchsia: { idle: "#f0abfc", placed: "#e879f9" },
  violet: { idle: "#c4b5fd", placed: "#a78bfa" },
  blue: { idle: "#93c5fd", placed: "#60a5fa" },
};

/** Ba state còn lại là NGHĨA chung, không phải bản sắc cột — mọi cột dùng chung. */
const VERDICT_ENDPOINT_HEX = {
  selected: "#facc15", // border-yellow-400 — gợi ý "thả vào đây"
  correct: "#4ade80", // border-green-400
  wrong: "#f87171", // border-red-400
} as const;

export function matchEndpointHex(
  accent: keyof typeof ACCENT_ENDPOINT_HEX,
  state: MatchEndpointState,
): string {
  if (state === "idle" || state === "placed") return ACCENT_ENDPOINT_HEX[accent][state];
  return VERDICT_ENDPOINT_HEX[state];
}

export const TARGET_ENDPOINT_HEX: Record<MatchEndpointState, string> = {
  idle: matchEndpointHex(MATCH_TARGET_ACCENT, "idle"),
  selected: matchEndpointHex(MATCH_TARGET_ACCENT, "selected"),
  placed: matchEndpointHex(MATCH_TARGET_ACCENT, "placed"),
  correct: matchEndpointHex(MATCH_TARGET_ACCENT, "correct"),
  wrong: matchEndpointHex(MATCH_TARGET_ACCENT, "wrong"),
};

function ColumnSkin({
  children,
}: {
  children: (skin: QuestionPlayerSkin) => ReactNode;
}) {
  const skin = useSkin();
  return <>{children(skin)}</>;
}

/** Bọc MỘT cột trong accent của nó và trả skin ĐÃ bind accent cho phần tính class. */
export function MatchingColumnAccent({
  accent,
  children,
}: {
  accent: PlayerAccentName;
  children: (skin: QuestionPlayerSkin) => ReactNode;
}) {
  return (
    <AccentProvider accent={accent}>
      <ColumnSkin>{children}</ColumnSkin>
    </AccentProvider>
  );
}

export function MatchingTargetColumn({
  children,
}: {
  children: (skin: QuestionPlayerSkin) => ReactNode;
}) {
  return <MatchingColumnAccent accent={MATCH_TARGET_ACCENT}>{children}</MatchingColumnAccent>;
}
