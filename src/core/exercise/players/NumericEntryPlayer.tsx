/**
 * P14 — Numeric answer.
 * schema: numeric_answer · interactionType: "numeric"
 */
import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface NumericEntryPlayerProps extends PlayerProps {
  correctAnswer: number;
  tolerance?: number;
  unit?: string;
}

export const NumericEntryPlayer: React.FC<NumericEntryPlayerProps> = ({
  correctAnswer,
  tolerance = 0,
  unit,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  answer,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  ...shell
}) => {
  const skin = useSkin();
  // Kênh khôi phục cha cấp (`answer`) — YesNo selectionKey pattern: chỉ reset
  // draft khi cha đưa một đáp án khác về NGỮ NGHĨA (không reset khi cha echo
  // lại chính report của player). Không key-remount.
  const initialRaw =
    typeof answer === "number" && !Number.isNaN(answer) ? String(answer) : "";
  const answerKey = JSON.stringify(
    typeof answer === "number" && !Number.isNaN(answer) ? answer : null,
  );
  const [raw, setRaw] = useState(initialRaw);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    const parsedLocal = raw.trim() === "" ? NaN : parseFloat(raw.replace(",", ".").trim());
    const localKey = JSON.stringify(Number.isNaN(parsedLocal) ? null : parsedLocal);
    if (localKey !== answerKey) setRaw(initialRaw);
  }
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || correctAnswer == null || Number.isNaN(correctAnswer);
  const instant = useInstantGrading({
    elementIds: useMemo(() => ["answer"], []),
    instantFeedback,
    recordOnly,
    buildAnswer: () => parseFloat(raw.replace(",", ".").trim()),
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  const answerReveal = recordOnly ? undefined : `${correctAnswer}${unit ? ` ${unit}` : ""}`;

  const handleChange = (v: string) => {
    setRaw(v);
    // Sửa lại sau khi bị chấm sai → xoá trạng thái sai để thử lại (đồng thời
    // tránh việc so khớp "sống" khi đang gõ làm lộ đáp án).
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
  };

  const check = () => {
    if (locked) return;
    const parsed = parseFloat(raw.replace(",", ".").trim());
    if (recordOnly) {
      // Record-only (không có đáp án đúng): chỉ ghi nhận — không chấm.
      report(Number.isNaN(parsed) ? null : parsed, "incomplete");
      return;
    }
    if (Number.isNaN(parsed)) {
      report(null, "incomplete");
      return;
    }
    const ok = Math.abs(parsed - correctAnswer) <= tolerance;
    report(parsed, ok ? "correct" : "incorrect");
  };

  const gradeOne = () => {
    const v = raw.trim();
    if (recordOnly) {
      // Record-only: đồng bộ đáp án lên cha qua report — không chấm, không âm thanh.
      const parsed = parseFloat(v.replace(",", "."));
      report(Number.isNaN(parsed) ? null : parsed, "incomplete");
      return;
    }
    if (!v) {
      instant.clear("answer");
      return;
    }
    const parsed = parseFloat(v.replace(",", "."));
    if (Number.isNaN(parsed)) {
      instant.clear("answer");
      return;
    }
    const ok = Math.abs(parsed - correctAnswer) <= tolerance;
    instant.grade("answer", ok ? "correct" : "incorrect");
  };

  const rv = instant.reveal("answer");
  // Once instant grading is active, a cleared field must go back to idle even
  // though local `status` still holds the previous verdict (report() only
  // fires again once the single element is re-graded).
  // Blank while instant-active → idle (aligns with FillBlank blankState; not stale red/green).
  const clearedWhileActive = instant.active && rv === undefined && raw.trim() === "";
  // status "error" cũng hiển thị (tô đỏ) — lượt "Kiểm tra" chấm sai không được im lặng.
  const showResult =
    !clearedWhileActive &&
    (rv !== undefined || submitted || status === "success" || status === "error");
  const parsed = parseFloat(raw.replace(",", ".").trim());
  const isOk = rv
    ? rv === "correct"
    : !Number.isNaN(parsed) && Math.abs(parsed - correctAnswer) <= tolerance;

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={gradeOne}
          disabled={locked}
          placeholder="?"
          className={
            skin.input?.(showResult ? (isOk ? "correct" : "wrong") : "idle")
              ? `w-40 sm:w-52 text-2xl ${skin.input(showResult ? (isOk ? "correct" : "wrong") : "idle")}`
              : `w-40 sm:w-52 px-4 py-3 text-center rounded-2xl border-4 font-black text-2xl outline-none transition-all
            ${
              showResult
                ? isOk
                  ? "bg-green-50  border-green-400 text-green-700 "
                  : "bg-red-50  border-red-400 text-red-600"
                : "bg-white border-indigo-300  text-slate-800 focus:border-indigo-500"
            }`
          }
        />
        {unit && (
          <span className={`text-xl sm:text-2xl ${skin.emphasis?.("neutral", "strong") ?? "font-black text-slate-500"}`}>{unit}</span>
        )}
      </div>

      <PlayerErrorFeedback show={status === "error" && !submitted} />

      {mode !== "parent" && !instant.active && !locked && !recordOnly && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={check}
          className={
            skin.actionButton?.(true, "primary")
              ? `mt-6 ${skin.actionButton(true, "primary")}`
              : "mt-6 px-6 py-3 rounded-full border-4 border-indigo-500 bg-indigo-400 text-white font-black text-base sm:text-lg shadow-sm hover:bg-indigo-500 transition-colors"
          }
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
  );
};
