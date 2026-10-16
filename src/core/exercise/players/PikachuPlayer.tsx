/**
 * Pikachu (Onet) — clear a board by matching pairs of identical symbols.
 * schema: pikachu
 *
 * Symbols repeat in pairs. Tiles are laid out in an even grid. Click two tiles
 * with the SAME symbol to clear them (simplified rule: match-by-symbol only, no
 * pathfinding). Win when every tile is cleared → report(clearedPairs, "correct").
 * Answer = number of cleared pairs.
 *
 * KHÔNG khôi phục được từ prop `answer` (Bước A): emit chỉ là SỐ cặp đã ăn —
 * không dựng lại được cặp tile NÀO đã bị xoá khỏi bảng. Nâng shape lên mảng
 * tile id sẽ đổi hợp đồng đáp án đã lưu giữa studio↔web (và verdict "correct"
 * đã persist theo số cặp), nên chủ đích giữ nguyên và bỏ qua `answer`.
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, playError, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface PikachuTile {
  id: string;
  symbol: string;
}

export interface PikachuPlayerProps extends PlayerProps {
  tiles: PikachuTile[];
  /** Author-specified board size (spec §5.32). Only cols is used for layout —
   * falls back to an auto-computed column count when absent or unsupported. */
  grid?: { rows?: number; cols?: number };
}

const TILE_COLORS = [
  "from-amber-300 to-yellow-400 border-amber-400",
  "from-sky-300 to-blue-400 border-sky-400",
  "from-rose-300 to-pink-400 border-rose-400",
  "from-emerald-300 to-green-400 border-emerald-400",
  "from-violet-300 to-purple-400 border-violet-400",
  "from-orange-300 to-red-400 border-orange-400",
];

export const PikachuPlayer: React.FC<PikachuPlayerProps> = ({
  tiles,
  grid,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  ...shell
}) => {
  const skin = useSkin();
  // Pad to an even count so the grid stays balanced.
  const padded = useMemo<PikachuTile[]>(() => {
    if (tiles.length % 2 === 0) return tiles;
    return [...tiles, { id: "__pad__", symbol: "✨" }];
  }, [tiles]);

  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    for (const t of padded) {
      if (!map.has(t.symbol)) {
        map.set(t.symbol, TILE_COLORS[i % TILE_COLORS.length]);
        i++;
      }
    }
    return map;
  }, [padded]);

  const [cleared, setCleared] = useState<string[]>([]); // tile ids removed
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<string[]>([]);
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const locked = submitted || status === "success";
  // Record-only (selfAssessment): the matching game still plays out, but the
  // final report only syncs the answer — no verdict, no success sound.
  const recordOnly = selfAssessment === true;

  const totalPairs = padded.length / 2;

  const finishIfDone = (nextCleared: string[]) => {
    const pairs = nextCleared.length / 2;
    if (nextCleared.length === padded.length) {
      report(pairs, recordOnly ? "incomplete" : "correct");
    } else {
      onAnswerChange?.(pairs);
    }
  };

  const click = (t: PikachuTile) => {
    if (locked || cleared.includes(t.id) || wrongPair.length > 0) return;
    if (selected === t.id) {
      setSelected(null);
      return;
    }
    if (selected === null) {
      setSelected(t.id);
      return;
    }
    const first = padded.find((x) => x.id === selected)!;
    if (first.symbol === t.symbol) {
      const next = [...cleared, first.id, t.id];
      setCleared(next);
      setSelected(null);
      finishIfDone(next);
    } else {
      // Mismatch — never silent: error sound plus the shake.
      playError();
      setWrongPair([first.id, t.id]);
      setSelected(null);
      setTimeout(() => setWrongPair([]), 500);
    }
  };

  useEffect(() => {
    if (submitted && status === "idle" && !recordOnly && cleared.length === padded.length && padded.length > 0) {
      report(totalPairs, "correct");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const authoredCols = grid?.cols;
  const cols =
    authoredCols === 3 || authoredCols === 4 || authoredCols === 5
      ? authoredCols
      : padded.length <= 6
        ? 3
        : padded.length <= 12
          ? 4
          : 5;
  const colClass =
    cols === 3 ? "grid-cols-3" : cols === 4 ? "grid-cols-4" : "grid-cols-5";

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className={`grid ${colClass} gap-2 sm:gap-3`}>
        <AnimatePresence>
          {padded.map((t) => {
            if (cleared.includes(t.id)) return null;
            const isSel = selected === t.id;
            const isWrong = wrongPair.includes(t.id);
            const color = colorFor.get(t.symbol) ?? TILE_COLORS[0];
            return (
              <motion.button
                key={t.id}
                type="button"
                layout
                initial={{ scale: 1 }}
                exit={{ scale: 0, rotate: 20, opacity: 0 }}
                animate={isWrong ? { x: [0, -6, 6, -6, 0] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                whileHover={!locked ? { scale: 1.06 } : undefined}
                whileTap={!locked ? { scale: 0.92 } : undefined}
                onClick={() => click(t)}
                disabled={locked}
                className={`aspect-square bg-gradient-to-br shadow-md flex items-center justify-center text-3xl sm:text-4xl md:text-5xl transition-all ${
                  skin.chip?.(isWrong ? "wrong" : isSel ? "selected" : "idle", "primary") ??
                  `rounded-3xl border-4 ${color} ${isSel ? "ring-4 ring-yellow-300 scale-105" : ""} ${isWrong ? "ring-4 ring-red-400" : ""}`
                }`}
              >
                <span className="drop-shadow-sm">{t.symbol}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <p className={`mt-5 text-center ${skin.emphasis?.("neutral", "medium") ?? "text-slate-500 font-bold"}`}>
        Đã ăn: {cleared.length / 2} / {totalPairs} cặp
      </p>

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-2 text-center text-green-600 font-black text-lg md:text-xl">
          Hết bảng rồi! Giỏi lắm! ⚡
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
