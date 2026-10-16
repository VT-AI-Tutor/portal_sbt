/**
 * P30 — Likert scale / "likert".
 * schema: scale · interactionType: "likert"
 *
 * Self-report by default: picking a point records the answer as "incomplete"
 * with a gentle "Đã ghi nhận". If `correctValue` is given, a "Kiểm tra" button
 * grades the pick (exact match ⇒ correct).
 */
import React, { useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";

export interface LikertPoint {
  value: number;
  label: string;
}

export interface LikertPlayerProps extends PlayerProps {
  points: LikertPoint[];
  correctValue?: number;
}

export const LikertPlayer: React.FC<LikertPlayerProps> = ({
  points,
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
  const initialPicked = typeof answer === "number" ? answer : null;
  const answerKey = JSON.stringify(initialPicked);
  const [picked, setPicked] = useState<number | null>(initialPicked);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (JSON.stringify(picked) !== answerKey) setPicked(initialPicked);
  }
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  // selfAssessment questions are record-only even when a key exists — no
  // Kiểm tra button, no verdicts (recordOnly convention).
  const graded = correctValue != null && selfAssessment !== true;
  const locked = submitted || status === "success";
  // Lượt "Kiểm tra" gần nhất bị chấm sai (gradeMode self) — tô đỏ + báo lỗi.
  const errored = status === "error";

  const select = (value: number) => {
    if (locked) return;
    setPicked(value);
    // Changing the pick after a wrong verdict clears it for the retry.
    if (errored) {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    // Graded mode waits for the Kiểm tra button; self-report records immediately.
    if (!graded) report(value, "incomplete");
    else onAnswerChange?.(value);
  };

  const check = () => {
    if (picked == null || locked) return;
    if (!graded) {
      report(picked, "incomplete");
      return;
    }
    report(picked, picked === correctValue ? "correct" : "incorrect");
  };

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {points.map((p) => {
          const selected = picked === p.value;
          const showCorrect = graded && (submitted || status === "success") && p.value === correctValue;
          // Wrong notation also right after an in-player "Kiểm tra" (errored) —
          // not only when the host pre-submits. The correct answer stays hidden
          // while errored so retrying is still meaningful.
          const showWrong = graded && (submitted || errored) && selected && p.value !== correctValue;
          const state = showCorrect
            ? "correct"
            : showWrong
              ? "wrong"
              : selected
                ? "selected"
                : "idle";
          return (
            <motion.button
              key={p.value}
              type="button"
              whileHover={!locked ? { scale: 1.07, y: -2 } : undefined}
              whileTap={!locked ? { scale: 0.92 } : undefined}
              onClick={() => select(p.value)}
              disabled={locked}
              className="flex flex-col items-center gap-2 w-24 sm:w-28 focus:outline-none"
            >
              <span
                // Playful nhẹ đi một nấc (xem skins.ts) KHÔNG áp cho ô này: đây là CON SỐ
                // của thang đo trong vòng tròn w-12 — giữ font-black để đọc được.
                className={
                  skin.optionCard?.(state, "primary") ??
                  `flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 font-black text-lg sm:text-xl transition-all
                  ${
                    showCorrect
                      ? "bg-green-50  border-green-400 text-green-600"
                      : showWrong
                        ? "bg-red-50  border-red-400 text-red-500"
                        : selected
                          ? "bg-violet-100  border-violet-400 text-violet-600"
                          : "bg-white border-slate-200 text-slate-500 hover:border-violet-300  hover:bg-violet-50 "
                  }`
                }
              >
                {p.value}
              </span>
              <span
                className={`text-center text-xs sm:text-sm leading-tight ${
                  selected
                    ? skin.emphasis?.("primary", "medium") ?? "font-bold text-violet-600"
                    : skin.emphasis?.("neutral", "soft") ?? "font-bold text-slate-500"
                }`}
              >
                <RichTextValue value={p.label} />
              </span>
            </motion.button>
          );
        })}
      </div>

      <PlayerErrorFeedback show={errored && !submitted} />

      {picked != null && !graded && (
        <p
          className={
            skin.feedback?.("neutral") ??
            "mt-6 text-center text-emerald-600 font-black text-base sm:text-lg"
          }
        >
          ✓ Đã ghi nhận
        </p>
      )}

      {graded && mode !== "parent" && (
        <div className="mt-6 flex justify-center">
          <motion.button
            type="button"
            whileHover={picked != null && !locked ? { scale: 1.05 } : undefined}
            whileTap={picked != null && !locked ? { scale: 0.94 } : undefined}
            onClick={check}
            disabled={picked == null || locked}
            className={
              skin.actionButton?.(picked != null && !locked, "primary") ??
              "px-8 py-3 rounded-full border-4 border-violet-400 bg-violet-500 text-white font-black text-lg shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}
    </PlayerShell>
  );
};
