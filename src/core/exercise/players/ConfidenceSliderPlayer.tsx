/**
 * P33 — Confidence slider scale / "confidence".
 * schema: scale · interactionType: "confidence"
 *
 * A 0–100% "% tự tin" slider. Self-report by default (records "incomplete" with
 * a gentle "Đã ghi nhận"). If `correctValue` is given, a "Kiểm tra" button
 * grades the pick (exact match ⇒ correct).
 */
import React, { useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface ConfidenceSliderPlayerProps extends PlayerProps {
  correctValue?: number;
}

const tierLabel = (v: number): string => {
  if (v < 34) return "Chưa chắc lắm";
  if (v < 67) return "Khá tự tin";
  return "Rất tự tin";
};

export const ConfidenceSliderPlayer: React.FC<ConfidenceSliderPlayerProps> = ({
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
  // LƯU Ý touched: mặc định 50 KHÔNG emit — có answer nghĩa là học sinh đã kéo,
  // nên restore phải set touched=true (không thì "Đã ghi nhận" biến mất và
  // giá trị 50 khôi phục không phân biệt được với chưa đụng).
  const hasAnswer = typeof answer === "number";
  const initialValue = hasAnswer ? (answer as number) : 50;
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
  // Lượt "Kiểm tra" gần nhất bị chấm sai (gradeMode self) — tô đỏ + báo lỗi.
  const errored = graded && status === "error";
  const answerReveal =
    selfAssessment === true || !graded ? undefined : `${correctValue}%`;

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
    report(value, value === correctValue ? "correct" : "incorrect");
  };

  // Static tone buckets (no dynamic class strings). A wrong self-check turns
  // the readout red regardless of the confidence tier.
  const readoutTone = errored
    ? "text-red-500"
    : value < 34 ? "text-red-500" : value < 67 ? "text-amber-500" : "text-green-500";
  // The readout colour is SEMANTIC, so ask the skin for the matching tone
  // instead of always "primary" — otherwise a skin that implements `emphasis`
  // (playfulSkin now does) paints a wrong verdict in the brand colour and the
  // red disappears. The fallback string is unchanged.
  const readoutSkinTone = errored ? "danger" : "primary";

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      <div className="max-w-2xl mx-auto pt-6">
        <div className="text-center mb-5">
          <span className={`text-5xl sm:text-6xl tabular-nums ${skin.emphasis?.(readoutSkinTone, "strong") ?? `font-black ${readoutTone}`}`}>
            {value}%
          </span>
          <p className={`mt-1 text-base sm:text-lg ${skin.emphasis?.(readoutSkinTone, "strong") ?? `font-black ${readoutTone}`}`}>
            {tierLabel(value)} tự tin
          </p>
        </div>

        {/* Gradient track (red → amber → green) sits behind the range input. */}
        <div className="relative">
          <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 rounded-full pointer-events-none ${skin.accent?.("primary", "track") ?? "bg-gradient-to-r from-red-400 via-amber-400 to-green-400"}`} />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            disabled={locked}
            onChange={(e) => onSlide(Number(e.target.value))}
            className="relative w-full h-4 appearance-none bg-transparent accent-white cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        <div className={`flex justify-between mt-3 text-sm sm:text-base ${skin.emphasis?.("neutral", "soft") ?? "font-bold text-slate-500"}`}>
          <span>0% · Không tự tin</span>
          <span>100% · Hoàn toàn tự tin</span>
        </div>

        <PlayerErrorFeedback show={errored && !submitted} />

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
                "px-8 py-3 rounded-full border-4 border-emerald-400 bg-emerald-500 text-white font-black text-lg shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
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
