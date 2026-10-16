/**
 * Memory match — flip face-down cards two at a time to find pairs.
 * schema: memory_match
 *
 * Each pair contributes two cards (a + b). All cards are shuffled into a grid
 * and shown face-down. Flip two: if they share a pair id they stay matched,
 * otherwise they flip back. Win when every pair is matched →
 * report(matchedPairIds, "correct"). Answer = matched pair ids (string[]).
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, ExerciseImage, playError, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";
import { secureRandomInt } from "@/core/lib/security";
import { RichTextValue } from "@/core/rich-text/RichTextValue";

export interface MemoryPair {
  id: string;
  a: { text?: string; imageUrl?: string };
  b: { text?: string; imageUrl?: string };
}

export interface MemoryMatchPlayerProps extends PlayerProps {
  pairs: MemoryPair[];
}

interface Card {
  key: string;
  pairId: string;
  face: { text?: string; imageUrl?: string };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A card's front face. Module-scope on purpose: a component declared inside a
 * player body gets a new function identity on every render, so React remounts
 * its subtree on each state update. `players/dnd-source-shape.regression.test.ts`
 * bans that shape in this directory (it is what cancels native drags elsewhere).
 */
const Face: React.FC<{
  face: { text?: string; imageUrl?: string };
  textClass: string;
}> = ({ face, textClass }) => (
  <div className="flex items-center justify-center w-full h-full p-2 text-center">
    {face.imageUrl ? (
      <ExerciseImage
        variant="frame"
        src={face.imageUrl}
        alt={face.text || "thẻ"}
        className="h-full w-full rounded-xl"
        draggable={false}
      />
    ) : (
      <span className={`text-sm sm:text-base md:text-lg leading-tight ${textClass}`}>
        <RichTextValue value={face.text} />
      </span>
    )}
  </div>
);

export const MemoryMatchPlayer: React.FC<MemoryMatchPlayerProps> = ({
  pairs,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  const cards = useMemo<Card[]>(
    () =>
      shuffle(
        pairs.flatMap((p) => [
          { key: `${p.id}-a`, pairId: p.id, face: p.a },
          { key: `${p.id}-b`, pairId: p.id, face: p.b },
        ]),
      ),
    [pairs],
  );

  // Kênh khôi phục cha cấp (`answer` = mảng pairId đã ghép — đúng shape emit,
  // đủ để khôi phục bàn chơi: cặp đã ghép lật ngửa, còn lại úp). YesNo
  // selectionKey pattern: chỉ reset khi cha đưa đáp án khác ngữ nghĩa (không
  // reset khi echo). Không remount.
  const initialMatched = Array.isArray(answer)
    ? [...new Set(
        answer.filter(
          (id): id is string => typeof id === "string" && pairs.some((p) => p.id === id),
        ),
      )]
    : [];
  const answerKey = JSON.stringify(initialMatched);

  const [flipped, setFlipped] = useState<string[]>([]); // card keys currently face-up (max 2)
  const [matched, setMatched] = useState<string[]>(initialMatched); // matched pair ids
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (JSON.stringify(matched) !== answerKey) setMatched(initialMatched);
  }
  const [busy, setBusy] = useState(false);
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const locked = submitted || status === "success";
  // Record-only (selfAssessment): the pairing game still plays out, but the
  // final report only syncs the answer — no verdict, no success sound.
  const recordOnly = selfAssessment === true;
  const faceLabel = (face: { text?: string; imageUrl?: string }) =>
    face.text ?? (face.imageUrl ? "(hình ảnh)" : "?");
  const reveal =
    selfAssessment !== true && pairs.length > 0
      ? pairs.map((p) => `${faceLabel(p.a)} ↔ ${faceLabel(p.b)}`).join("\n")
      : null;

  const isFaceUp = (c: Card) => flipped.includes(c.key) || matched.includes(c.pairId);

  const flip = (c: Card) => {
    if (locked || busy) return;
    if (isFaceUp(c)) return;
    if (flipped.length >= 2) return;
    const next = [...flipped, c.key];
    setFlipped(next);
    if (next.length === 2) {
      const [k1, k2] = next;
      const c1 = cards.find((x) => x.key === k1)!;
      const c2 = cards.find((x) => x.key === k2)!;
      if (c1.pairId === c2.pairId) {
        const nextMatched = [...matched, c1.pairId];
        setMatched(nextMatched);
        setFlipped([]);
        if (nextMatched.length === pairs.length) {
          report(nextMatched, recordOnly ? "incomplete" : "correct");
        } else {
          onAnswerChange?.(nextMatched);
        }
      } else {
        // Mismatch — never silent: error sound plus the flip-back.
        playError();
        setBusy(true);
        setTimeout(() => {
          setFlipped([]);
          setBusy(false);
        }, 800);
      }
    }
  };

  useEffect(() => {
    if (submitted && status === "idle" && !recordOnly && matched.length === pairs.length && pairs.length > 0) {
      report(matched, "correct");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const faceTextClass = skin.emphasis?.("neutral", "strong") ?? "font-black text-slate-800";

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => {
          const up = isFaceUp(c);
          const done = matched.includes(c.pairId);
          return (
            <motion.button
              key={c.key}
              type="button"
              onClick={() => flip(c)}
              disabled={locked || up}
              whileHover={!locked && !up ? { scale: 1.05 } : undefined}
              whileTap={!locked && !up ? { scale: 0.93 } : undefined}
              animate={{ rotateY: up ? 180 : 0 }}
              transition={{ duration: 0.35 }}
              className="relative aspect-square rounded-3xl"
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Back */}
              <div
                className={`absolute inset-0 rounded-3xl flex items-center justify-center shadow-md ${skin.accent?.("primary", "fill") ?? "border-4 border-fuchsia-300  bg-gradient-to-br from-fuchsia-400 to-purple-500"}`}
                style={{ backfaceVisibility: "hidden" }}
              >
                <span className="text-3xl sm:text-4xl">❓</span>
              </div>
              {/* Front */}
              <div
                className={`absolute inset-0 flex items-center justify-center shadow-md transition-colors ${
                  skin.chip?.(done ? "correct" : "idle", "secondary") ??
                  `rounded-3xl border-4 ${
                    done
                      ? "border-green-400 bg-green-50 "
                      : "border-fuchsia-300  bg-white"
                  }`
                }`}
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <Face face={c.face} textClass={faceTextClass} />
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className={`mt-5 text-center ${skin.emphasis?.("neutral", "medium") ?? "text-slate-500 font-bold"}`}>
        Đã ghép: {matched.length} / {pairs.length} cặp
      </p>

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-2 text-center text-green-600 font-black text-lg md:text-xl">
          Tuyệt vời! Bạn đã tìm hết các cặp! 🎉
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
