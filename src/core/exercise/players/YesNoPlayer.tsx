/**
 * P04 — Yes / No.
 * schema: true_false · interactionType: "yes_no"
 */
import React, { useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { displayLayoutKey, isAuthoredLayout, layoutContainerClass } from "@/core/exercise/display-layout";

export interface YesNoPlayerProps extends PlayerProps {
  correct: boolean;
  trueLabel?: string;
  falseLabel?: string;
  /** Read-only mode without implying that grading/submission has happened. */
  disabled?: boolean;
}

interface YesNoSelectionProps {
  correct: boolean;
  trueLabel: string;
  falseLabel: string;
  layout: PlayerProps["layout"];
  submitted: boolean;
  recordOnly: boolean;
  locked: boolean;
  successful: boolean;
  /** Lượt chọn gần nhất bị chấm sai (gradeMode self) — tô đỏ lựa chọn sai. */
  errored: boolean;
  initialPicked: boolean | null;
  /** JSON key of the parent-supplied answer (see selectionKey below). */
  selectionKey: string;
  report: (answer: unknown, verdict: "correct" | "incorrect" | "incomplete") => void;
}

function YesNoSelection({
  correct,
  trueLabel,
  falseLabel,
  layout,
  submitted,
  recordOnly,
  locked,
  successful,
  errored,
  initialPicked,
  selectionKey,
  report,
}: YesNoSelectionProps) {
  const skin = useSkin();
  const [picked, setPicked] = useState<boolean | null>(initialPicked);
  // Rehydrate only when the parent supplies a semantically different answer. A
  // key-remount would also fire when the parent merely echoes our own report
  // back (answer → prop), which replayed the pill transition on every pick —
  // so sync in-render instead of remounting.
  const [syncedKey, setSyncedKey] = useState(selectionKey);
  if (syncedKey !== selectionKey) {
    setSyncedKey(selectionKey);
    if (JSON.stringify(picked) !== selectionKey) setPicked(initialPicked);
  }
  const layoutKey = displayLayoutKey(layout);

  const choose = (value: boolean) => {
    if (locked) return;
    setPicked(value);
    if (recordOnly) report(value, "incomplete");
    else report(value, value === correct ? "correct" : "incorrect");
  };

  const pills: { value: boolean; label: string; selectedCls: string }[] = [
    { value: true, label: trueLabel, selectedCls: recordOnly ? "bg-blue-50  border-blue-400 text-blue-700 " : "bg-green-100  border-green-400 text-green-700 " },
    { value: false, label: falseLabel, selectedCls: recordOnly ? "bg-blue-50  border-blue-400 text-blue-700 " : "bg-red-100  border-red-400 text-red-600" },
  ];

  // skin.presentation.pairedBinaryChoice (surface học sinh): mặc định (không
  // có display.layout tác giả) là 2 pill GỌN đặt CẠNH NHAU căn giữa như web —
  // cờ tắt (studio QA) giữ fallback "list" xếp chồng dọc. Layout tác giả khai
  // rõ vẫn được tôn trọng ở cả hai chế độ.
  const paired = skin.presentation?.pairedBinaryChoice === true && !isAuthoredLayout(layout);

  return (
    <>
    <div
      className={paired ? "flex flex-wrap gap-4 justify-center" : layoutContainerClass(layout)}
      data-display-layout={paired ? "inline" : layoutKey}
      role="radiogroup"
      aria-label="Chọn có hoặc không"
    >
      {pills.map((p) => {
          const selected = picked === p.value;
          const showCorrect = !recordOnly && (submitted || successful) && p.value === correct;
          // Wrong notation also right after an incorrect self-graded pick
          // (errored) — not only when the host pre-submits. The correct answer
          // stays hidden while errored so retrying is still meaningful.
          const showWrong = !recordOnly && (submitted || errored) && selected && p.value !== correct;
          const state = showCorrect
            ? "correct"
            : showWrong
              ? "wrong"
              : selected
                ? "selected"
                : "idle";
          return (
            <motion.button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={selected}
              whileHover={!locked ? { scale: 1.05 } : undefined}
              whileTap={!locked ? { scale: 0.92 } : undefined}
              onClick={() => choose(p.value)}
              disabled={locked}
              className={`min-w-[140px] ${
                skin.optionCard?.(state, "neutral") ??
                `px-10 py-5 rounded-full border-4 font-bold text-xl sm:text-2xl transition-all min-w-[140px]
                ${
                  showCorrect
                    ? "bg-green-50  border-green-400 text-green-700 "
                    : showWrong
                      ? "bg-red-50  border-red-400 text-red-600"
                      : selected
                        ? p.selectedCls
                        : "bg-white border-slate-200 text-slate-800 hover:border-cyan-300  hover:bg-cyan-50 "
                }`
              }`}
            >
              <RichTextValue value={p.label} />
            </motion.button>
          );
      })}
    </div>
    <PlayerErrorFeedback show={errored && !submitted} />
    </>
  );
}

export const YesNoPlayer: React.FC<YesNoPlayerProps> = ({
  correct,
  trueLabel = "Có",
  falseLabel = "Không",
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  disabled = false,
  selfAssessment,
  answer,
  // KHÔNG default "list": layout vắng mặt để skin quyết định look mặc định
  // (pairedBinaryChoice — 2 pill cạnh nhau ở surface học sinh, list ở studio).
  layout,
  ...shell
}) => {
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true;
  const locked = disabled || submitted || status === "success";
  const initialPicked = typeof answer === "boolean" ? answer : null;
  // Keep interaction updates immediate, but replace the local draft whenever
  // the parent supplies a semantically different answer.
  const selectionKey = JSON.stringify(initialPicked);

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <YesNoSelection
        correct={correct}
        trueLabel={trueLabel}
        falseLabel={falseLabel}
        layout={layout}
        submitted={submitted}
        recordOnly={recordOnly}
        locked={locked}
        successful={status === "success"}
        errored={status === "error"}
        initialPicked={initialPicked}
        selectionKey={selectionKey}
        report={report}
      />
    </PlayerShell>
  );
};
