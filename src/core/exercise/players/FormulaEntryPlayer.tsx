/** P17 — Math expression / formula entry. */
import React, { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { MathField, type MathFieldHandle } from "@/core/math/MathField";
import { MATH_FIELD_AS_INPUT, MathFieldChromeStyles } from "./math-field-chrome";
import {
  gradeMathExpression,
  type MathGradingMode,
} from "@/core/math/grading";
import { PlayerShell, PlayerErrorFeedback, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface FormulaEntryPlayerProps extends PlayerProps {
  acceptedAnswers: string[];
  gradingMode?: MathGradingMode;
  tolerance?: number;
  inputMode?: "formula" | "text";
}

export const FormulaEntryPlayer: React.FC<FormulaEntryPlayerProps> = ({
  acceptedAnswers,
  gradingMode = "symbolic",
  tolerance = 1e-9,
  inputMode = "formula",
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  ...shell
}) => {
  const skin = useSkin();
  // Hydrated from the parent-owned `answer` (LaTeX string). MathField mirrors
  // `expr` into the mathlive element only when the values differ, so restoring
  // never fights the caret while the pupil is typing.
  const [expr, setExpr] = useState(() => (typeof answer === "string" ? answer : ""));
  // Resync only when the parent supplies a semantically DIFFERENT answer
  // (YesNoPlayer's selectionKey pattern) — echoes of our own onAnswerChange
  // come back equal to `expr` and are ignored.
  const parentExpr = typeof answer === "string" ? answer : "";
  const [syncedExpr, setSyncedExpr] = useState(parentExpr);
  if (syncedExpr !== parentExpr) {
    setSyncedExpr(parentExpr);
    if (expr !== parentExpr) setExpr(parentExpr);
  }
  const fieldRef = useRef<MathFieldHandle>(null);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || !acceptedAnswers?.length;
  const instant = useInstantGrading({
    elementIds: useMemo(() => ["answer"], []),
    instantFeedback,
    recordOnly,
    buildAnswer: () => expr,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  const answerReveal = recordOnly ? undefined : acceptedAnswers.join(" / ");

  const updateExpression = (next: string) => {
    setExpr(next);
    // Sửa lại sau khi bị chấm sai → xoá trạng thái sai để thử lại.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    onAnswerChange?.(next);
  };

  const grade = () =>
    gradeMathExpression(expr, acceptedAnswers, gradingMode, tolerance);

  const check = () => {
    if (locked) return;
    if (recordOnly) {
      // Record-only: chỉ ghi nhận đáp án — không chấm, không âm thanh.
      report(expr, "incomplete");
      return;
    }
    if (expr.trim() === "") {
      report(expr, "incomplete");
      return;
    }
    report(expr, grade());
  };

  const gradeOne = () => {
    if (expr.trim() === "") {
      instant.clear("answer");
      return;
    }
    instant.grade("answer", grade());
  };

  const rv = instant.reveal("answer");
  // Once instant grading is active, a cleared field must go back to idle even
  // though local `status` still holds the previous verdict.
  // Blank while instant-active → idle (aligns with FillBlank blankState; not stale red/green).
  const clearedWhileActive = instant.active && rv === undefined && expr.trim() === "";
  // status "error" cũng hiển thị (tô đỏ) — lượt "Kiểm tra" chấm sai không được im lặng.
  const showResult =
    !clearedWhileActive &&
    (rv !== undefined || submitted || status === "success" || status === "error");
  const isCorrect = rv ? rv === "correct" : status === "success";
  const inputClass =
    skin.input?.(showResult ? (isCorrect ? "correct" : "wrong") : "idle") ??
    `block min-h-14 w-full rounded-2xl border-4 px-4 py-3 text-xl outline-none transition-colors
      ${showResult
        ? isCorrect
          ? "border-green-400 bg-green-50 text-green-700"
          : "border-red-400 bg-red-50 text-red-600"
        : "border-violet-300 bg-white text-slate-800 focus-within:border-violet-500"}`;

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      <MathFieldChromeStyles />

      {inputMode === "formula" ? (
        <MathField
          ref={fieldRef}
          value={expr}
          onChange={updateExpression}
          onBlur={gradeOne}
          disabled={locked}
          ariaLabel="Nhập biểu thức toán học"
          placeholder="Nhập biểu thức…"
          // Thẻ `math-field` co đúng bằng nội dung nên ô rỗng chỉ rộng hơn 200px và
          // cao một dòng — nhỏ hơn hẳn một biểu thức cần viết. Đặt bằng style để
          // không phụ thuộc lớp mà skin truyền vào có `w-full` hay không.
          style={{ display: "block", width: "100%", minHeight: "3.25rem", fontSize: "1.35rem" }}
          className={`${MATH_FIELD_AS_INPUT} ${inputClass}`}
        />
      ) : (
        <input
          type="text"
          value={expr}
          onChange={(event) => updateExpression(event.target.value)}
          onBlur={gradeOne}
          disabled={locked}
          placeholder="Nhập biểu thức…"
          spellCheck={false}
          className={inputClass}
        />
      )}

      <PlayerErrorFeedback show={status === "error" && !submitted} />

      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={check}
          className={
            skin.actionButton?.(true, "secondary")
              ? `mt-6 ${skin.actionButton(true, "secondary")}`
              : "mt-6 rounded-full border-4 border-violet-500 bg-violet-400 px-6 py-3 text-base font-black text-white shadow-sm transition-colors hover:bg-violet-500 sm:text-lg"
          }
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
  );
};
