/**
 * P08 — Dropdown select.
 * schema: single_choice · interactionType: "dropdown"
 */
import React, { useState } from "react";
import { PlayerShell, PlayerErrorFeedback, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";
import { plainTextFromHtml } from "@/core/rich-text/html";
// `<option>` bắt buộc là text thuần: không render được KaTeX, nên TeX tác giả
// soạn phải hạ về chữ đọc được thay vì lộ delimiter `\( … \)` (#839).
import { plainTextFromAuthoredMath } from "@/core/math/plainTextFromAuthoredMath";
import { nameOrOrdinal } from "./answer-name";

export interface DropdownOption {
  id: string;
  text?: string;
}

export interface DropdownSelectPlayerProps extends PlayerProps {
  options: DropdownOption[];
  correctId: string;
}

export const DropdownSelectPlayer: React.FC<DropdownSelectPlayerProps> = ({
  options,
  correctId,
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
  const initialPicked =
    typeof answer === "string" && options.some((opt) => opt.id === answer) ? answer : "";
  const answerKey = JSON.stringify(initialPicked);
  const [picked, setPicked] = useState<string>(initialPicked);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (JSON.stringify(picked) !== answerKey) setPicked(initialPicked);
  }
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const hasKey = typeof correctId === "string" && correctId.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  const locked = submitted || status === "success";

  const change = (id: string) => {
    if (locked) return;
    setPicked(id);
    if (id) {
      if (recordOnly) report(id, "incomplete");
      else report(id, id === correctId ? "correct" : "incorrect");
    }
  };

  const isCorrect = !recordOnly && (submitted || status === "success") && picked === correctId && picked !== "";
  // Wrong notation also right after an incorrect self-graded pick (status
  // "error") — not only when the host pre-submits. A new pick re-reports and
  // overwrites the status, so retrying clears it automatically.
  const isWrong = !recordOnly && (submitted || status === "error") && picked !== "" && picked !== correctId;

  const inputState = isCorrect ? "correct" : isWrong ? "wrong" : picked ? "focus" : "idle";

  const ringCls = isCorrect
    ? "border-green-400 ring-4 ring-green-200 text-green-700 "
    : isWrong
      ? "border-red-400 ring-4 ring-red-200 text-red-600"
      : picked
        ? "border-blue-400 text-blue-700 "
        : "border-slate-200 text-slate-800";

  const correctOption = options.find((opt) => opt.id === correctId);
  const reveal =
    !recordOnly && correctOption
      ? nameOrOrdinal(correctOption, options.indexOf(correctOption), "Phương án")
      : null;

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div className="max-w-md">
        <select
          value={picked}
          disabled={locked}
          onChange={(e) => change(e.target.value)}
          className={
            skin.input?.(inputState)
              ? `w-full ${skin.input(inputState)}`
              : `w-full rounded-2xl border-4 p-3 bg-white font-bold text-base sm:text-lg outline-none transition-all disabled:opacity-90 ${ringCls}`
          }
        >
          <option value="" disabled>
            -- Chọn đáp án --
          </option>
          {options.map((opt, i) => (
            // <option> chỉ chứa text — render <span>/markup bên trong là invalid
            // HTML (React hydration warning); hạ rich text về plain text.
            <option key={opt.id} value={opt.id}>
              {plainTextFromAuthoredMath(plainTextFromHtml(nameOrOrdinal(opt, i, "Phương án")))}
            </option>
          ))}
        </select>
        <PlayerErrorFeedback show={status === "error" && !submitted} />
      </div>
    </PlayerShell>
  );
};
