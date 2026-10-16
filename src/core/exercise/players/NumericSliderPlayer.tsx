/**
 * P31 — Numeric slider scale / "slider".
 * schema: scale · interactionType: "slider"
 *
 * Self-report by default: sliding records the answer as "incomplete" with a
 * gentle "Đã ghi nhận". If `correctValue` is given, a "Kiểm tra" button grades
 * the value within an optional `tolerance` (default 0).
 */
import React, { useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface NumericSliderPlayerProps extends PlayerProps {
  min: number;
  max: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  correctValue?: number;
  tolerance?: number;
}

export const NumericSliderPlayer: React.FC<NumericSliderPlayerProps> = ({
  min,
  max,
  step = 1,
  minLabel,
  maxLabel,
  correctValue,
  tolerance = 0,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  const mid = Math.round((min + max) / 2);
  // Kênh khôi phục cha cấp (`answer`) — YesNo selectionKey pattern: chỉ reset
  // khi cha đưa đáp án khác ngữ nghĩa (không reset khi echo). Không remount.
  // Như ConfidenceSlider: mặc định (mid) không emit — có answer ⇒ đã kéo ⇒
  // restore set touched=true.
  const hasAnswer = typeof answer === "number";
  const initialValue = hasAnswer ? (answer as number) : mid;
  const answerKey = JSON.stringify(hasAnswer ? answer : null);
  const [value, setValue] = useState<number>(initialValue);
  const [touched, setTouched] = useState(hasAnswer);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (JSON.stringify(touched ? value : null) !== answerKey) {
      setValue(initialValue);
      setTouched(hasAnswer);
    }
  }
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  // selfAssessment questions are record-only even when a key exists — no
  // Kiểm tra button, no verdicts (recordOnly convention).
  const graded = correctValue != null && selfAssessment !== true;
  const locked = submitted || status === "success";
  const answerReveal =
    selfAssessment === true || !graded ? undefined : String(correctValue);

  const onSlide = (v: number) => {
    if (locked) return;
    setValue(v);
    setTouched(true);
    // Moving the slider after a wrong verdict clears it for the retry.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    if (!graded) report(v, "incomplete");
    else onAnswerChange?.(v);
  };

  const check = () => {
    if (locked) return;
    if (!graded) {
      report(value, "incomplete");
      return;
    }
    report(value, Math.abs(value - (correctValue as number)) <= tolerance ? "correct" : "incorrect");
  };

  const pct = ((value - min) / (max - min)) * 100;
  const bubbleTone =
    graded && status === "success"
      ? skin.badge?.("success") ?? "bg-green-500 border-green-300 "
      : graded && status === "error"
        ? skin.badge?.("danger") ?? "bg-red-500 border-red-300 "
        : skin.badge?.("primary") ?? "bg-sky-500 border-sky-300 ";

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      <div className="max-w-2xl mx-auto pt-6">
        {/* Live value bubble */}
        <div className="relative h-16 mb-1">
          <motion.div
            className={`absolute -translate-x-1/2 flex items-center justify-center min-w-14 h-14 px-3 rounded-2xl text-2xl ${skin.emphasis?.("neutral", "strong") ?? "border-4 font-black text-white shadow-lg"} ${bubbleTone}`}
            style={{ left: `${pct}%` }}
            animate={{ left: `${pct}%` }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {value}
          </motion.div>
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={locked}
          onChange={(e) => onSlide(Number(e.target.value))}
          className={`w-full h-4 appearance-none rounded-full cursor-pointer disabled:cursor-not-allowed ${skin.accent?.("primary", "track") ?? "bg-sky-100  accent-sky-500"}`}
        />

        <div className={`flex justify-between mt-3 text-sm sm:text-base ${skin.emphasis?.("neutral", "soft") ?? "font-bold text-slate-500"}`}>
          <span className="text-left max-w-[45%]">{minLabel ?? min}</span>
          <span className="text-right max-w-[45%]">{maxLabel ?? max}</span>
        </div>

        {/* The red value bubble already marks the error — this adds the uniform red line. */}
        <PlayerErrorFeedback show={graded && status === "error" && !submitted} />

        {touched && !graded && (
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
              whileHover={!locked ? { scale: 1.05 } : undefined}
              whileTap={!locked ? { scale: 0.94 } : undefined}
              onClick={check}
              disabled={locked}
              className={
                skin.actionButton?.(!locked, "primary") ??
                "px-8 py-3 rounded-full border-4 border-sky-400 bg-sky-500 text-white font-black text-lg shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              }
            >
              Kiểm tra
            </motion.button>
          </div>
        )}
      </div>
    </PlayerShell>
  );
};
