/**
 * P32 — Star/heart rating scale / "stars".
 * schema: scale · interactionType: "stars"
 *
 * Self-report by default: clicking records the number of filled icons as
 * "incomplete" with a gentle "Đã ghi nhận". If `correctValue` is given, a
 * "Kiểm tra" button grades the pick (exact match ⇒ correct).
 */
import React, { useState } from "react";
import { motion } from "motion/react";
import { Star, Heart } from "lucide-react";
import { PlayerShell, PlayerErrorFeedback, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface StarRatingPlayerProps extends PlayerProps {
  max?: number;
  icon?: "star" | "heart";
  correctValue?: number;
}

export const StarRatingPlayer: React.FC<StarRatingPlayerProps> = ({
  max = 5,
  icon = "star",
  correctValue,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  // Kênh khôi phục cha cấp (`answer`) — YesNo selectionKey pattern: chỉ reset
  // khi cha đưa đáp án khác ngữ nghĩa (không reset khi echo). Không remount.
  const initialValue = typeof answer === "number" ? answer : 0;
  const answerKey = JSON.stringify(typeof answer === "number" ? answer : null);
  const [value, setValue] = useState<number>(initialValue);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (JSON.stringify(value === 0 ? null : value) !== answerKey) setValue(initialValue);
  }
  const [hover, setHover] = useState<number>(0);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  // selfAssessment questions are record-only even when a key exists — no
  // Kiểm tra button, no verdicts (recordOnly convention).
  const graded = correctValue != null && selfAssessment !== true;
  const locked = submitted || status === "success";
  const Icon = icon === "heart" ? Heart : Star;
  const answerReveal =
    selfAssessment === true || !graded ? undefined : `${correctValue} / ${max}`;

  const select = (n: number) => {
    if (locked) return;
    setValue(n);
    // Changing the pick after a wrong verdict clears it for the retry.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    if (!graded) report(n, "incomplete");
    else onAnswerChange?.(n);
  };

  const check = () => {
    if (value === 0 || locked) return;
    if (!graded) {
      report(value, "incomplete");
      return;
    }
    report(value, value === correctValue ? "correct" : "incorrect");
  };

  const active = hover || value;
  const tone =
    graded && status === "success"
      ? "text-green-400"
      : graded && status === "error"
        ? "text-red-400"
        : icon === "heart"
          ? "text-rose-400"
          : "text-amber-400";

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      <div className="flex justify-center gap-2 sm:gap-3 pt-4">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const filled = n <= active;
          return (
            <motion.button
              key={n}
              type="button"
              whileHover={!locked ? { scale: 1.2, rotate: -6 } : undefined}
              whileTap={!locked ? { scale: 0.85 } : undefined}
              onClick={() => select(n)}
              onMouseEnter={() => !locked && setHover(n)}
              onMouseLeave={() => setHover(0)}
              disabled={locked}
              aria-label={`${n} / ${max}`}
              className="focus:outline-none disabled:cursor-not-allowed"
            >
              <Icon
                className={`w-10 h-10 sm:w-14 sm:h-14 transition-colors ${
                  skin.chip?.(filled ? "selected" : "idle", "primary") ??
                  (filled ? `${tone} fill-current drop-shadow` : "text-slate-200")
                }`}
                strokeWidth={2.5}
              />
            </motion.button>
          );
        })}
      </div>

      {value > 0 && (
        <p className={`mt-4 text-center text-lg ${skin.emphasis?.("neutral", "strong") ?? "font-black text-slate-500"}`}>
          {value} / {max}
        </p>
      )}

      {/* Red stars already mark the error — this adds the uniform red line. */}
      <PlayerErrorFeedback show={graded && status === "error" && !submitted} />

      {value > 0 && !graded && (
        <p
          className={
            skin.feedback?.("neutral") ??
            "mt-2 text-center text-emerald-600 font-black text-base sm:text-lg"
          }
        >
          ✓ Đã ghi nhận
        </p>
      )}

      {graded && mode !== "parent" && (
        <div className="mt-6 flex justify-center">
          <motion.button
            type="button"
            whileHover={value > 0 && !locked ? { scale: 1.05 } : undefined}
            whileTap={value > 0 && !locked ? { scale: 0.94 } : undefined}
            onClick={check}
            disabled={value === 0 || locked}
            className={
              skin.actionButton?.(value > 0 && !locked, "primary") ??
              "px-8 py-3 rounded-full border-4 border-amber-400 bg-amber-500 text-white font-black text-lg shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}
    </PlayerShell>
  );
};
