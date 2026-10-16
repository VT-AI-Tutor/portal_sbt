/**
 * P34 — Semantic differential scale / "differential".
 * schema: scale · interactionType: "differential"
 *
 * Each pair renders  leftLabel … [o o o o o o o] … rightLabel  with selectable
 * dots (1-indexed). Answer = Record<pairId, chosenPoint>.
 *
 * Self-report by default: each pick records the partial answer as "incomplete"
 * with a gentle "Đã ghi nhận" once every row has a value. If `correctValues`
 * is given, a "Kiểm tra" button grades all rows (every row must match).
 */
import React, { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export interface DifferentialPair {
  id: string;
  leftLabel: string;
  rightLabel: string;
  points?: number;
}

export interface SemanticDifferentialPlayerProps extends PlayerProps {
  pairs: DifferentialPair[];
  correctValues?: Record<string, number>;
}

export const SemanticDifferentialPlayer: React.FC<SemanticDifferentialPlayerProps> = ({
  pairs,
  correctValues,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  // Kênh khôi phục cha cấp (`answer` = Record<pairId, point>) — YesNo
  // selectionKey pattern với key ổn định theo thứ tự `pairs` (đáp án là object,
  // JSON thô phụ thuộc thứ tự chèn key): chỉ reset khi cha đưa đáp án khác ngữ
  // nghĩa (không reset khi echo). Không remount.
  const stableKey = (record: Record<string, number>) =>
    JSON.stringify(pairs.map((p) => [p.id, record[p.id] ?? null]));
  const initialAnswers: Record<string, number> = {};
  if (answer && typeof answer === "object" && !Array.isArray(answer)) {
    for (const p of pairs) {
      const v = (answer as Record<string, unknown>)[p.id];
      if (typeof v === "number") initialAnswers[p.id] = v;
    }
  }
  const answerKey = stableKey(initialAnswers);
  const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (stableKey(answers) !== answerKey) setAnswers(initialAnswers);
  }
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  // Bản mới nhất của answers cho handler click — 2 click liền tay có thể tới
  // trước khi re-render kịp; spread từ closure cũ sẽ nuốt click trước.
  const answersRef = useRef(answers);
  answersRef.current = answers;
  // selfAssessment questions are record-only even when a key exists — no
  // Kiểm tra button, no verdicts (recordOnly convention).
  const graded = correctValues != null && selfAssessment !== true;
  const locked = submitted || status === "success";
  // Lượt "Kiểm tra" gần nhất bị chấm sai (gradeMode self) — tô đỏ + báo lỗi.
  const errored = status === "error";

  const allAnswered = useMemo(
    () => pairs.every((p) => answers[p.id] != null),
    [pairs, answers],
  );

  const select = (pairId: string, point: number) => {
    if (locked) return;
    const next = { ...answersRef.current, [pairId]: point };
    answersRef.current = next;
    setAnswers(next);
    // Changing a pick after a wrong verdict clears it for the retry.
    if (errored) {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    if (!graded) report(next, "incomplete");
    else onAnswerChange?.(next);
  };

  const check = () => {
    if (!allAnswered || locked) return;
    if (!graded) {
      report(answers, "incomplete");
      return;
    }
    const allCorrect = pairs.every((p) => answers[p.id] === correctValues?.[p.id]);
    report(answers, allCorrect ? "correct" : "incorrect");
  };

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        {pairs.map((pair) => {
          const count = pair.points ?? 7;
          const chosen = answers[pair.id];
          return (
            <div
              key={pair.id}
              className={`flex items-center gap-2 sm:gap-4 p-3 ${skin.panel?.("card") ?? "bg-white/70 rounded-2xl border-4 border-white"}`}
            >
              <span className={`w-20 sm:w-28 text-right text-sm sm:text-base shrink-0 ${skin.emphasis?.("neutral", "soft") ?? "font-bold text-slate-500"}`}>
                {pair.leftLabel}
              </span>

              <div className="flex-1 flex justify-between items-center gap-1">
                {Array.from({ length: count }, (_, i) => i + 1).map((point) => {
                  const selected = chosen === point;
                  const correct = correctValues?.[pair.id];
                  const showCorrect =
                    graded && (submitted || status === "success") && point === correct;
                  // Wrong notation also right after an in-player "Kiểm tra"
                  // (errored) — the correct dots stay hidden while errored so
                  // retrying is still meaningful.
                  const showWrong =
                    graded && (submitted || errored) && selected && point !== correct;
                  const state = showCorrect
                    ? "correct"
                    : showWrong
                      ? "wrong"
                      : selected
                        ? "selected"
                        : "idle";
                  return (
                    <motion.button
                      key={point}
                      type="button"
                      whileHover={!locked ? { scale: 1.25 } : undefined}
                      whileTap={!locked ? { scale: 0.85 } : undefined}
                      onClick={() => select(pair.id, point)}
                      disabled={locked}
                      aria-label={`${pair.leftLabel}–${pair.rightLabel}: ${point}/${count}`}
                      className={`w-6 h-6 sm:w-7 sm:h-7 shrink-0 disabled:cursor-not-allowed ${
                        skin.optionCard?.(state, "primary") ??
                        `rounded-full border-4 transition-colors
                        ${
                          showCorrect
                            ? "bg-green-400 border-green-500"
                            : showWrong
                              ? "bg-red-400 border-red-500"
                              : selected
                                ? "bg-fuchsia-400 border-fuchsia-500"
                                : "bg-white border-slate-200 hover:border-fuchsia-300 "
                        }`
                      }`}
                    />
                  );
                })}
              </div>

              <span className={`w-20 sm:w-28 text-left text-sm sm:text-base shrink-0 ${skin.emphasis?.("neutral", "soft") ?? "font-bold text-slate-500"}`}>
                {pair.rightLabel}
              </span>
            </div>
          );
        })}
      </div>

      <PlayerErrorFeedback show={errored && !submitted} />

      {allAnswered && !graded && (
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
            whileHover={allAnswered && !locked ? { scale: 1.05 } : undefined}
            whileTap={allAnswered && !locked ? { scale: 0.94 } : undefined}
            onClick={check}
            disabled={!allAnswered || locked}
            className={
              skin.actionButton?.(allAnswered && !locked, "primary") ??
              "px-8 py-3 rounded-full border-4 border-fuchsia-400 bg-fuchsia-500 text-white font-black text-lg shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}
    </PlayerShell>
  );
};
