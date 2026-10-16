/**
 * P36 — Select words / "tokens".
 * schema: highlight · interactionType: "tokens"
 *
 * Tokenize `passage` into words and render each word as a clickable chip.
 * Clicking toggles selection (marker / underline style). "Kiểm tra" grades
 * the selected word indices vs `correctWords` via set equality.
 * Shares the highlight visual states with P35.
 *
 * A passage may also arrive as `passageContent` blocks (bold/italic runs,
 * per-paragraph alignment, several paragraphs). Alignment is a block property and
 * marks are a run property, while grading only ever reads the plain text those
 * blocks project to — see `passage-tokens.ts`. So turning a word bold or pushing
 * the source line to the right never moves a word index.
 */
import React, { useMemo, useRef } from "react";
import { motion } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, textAlignClass, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { restoredNumberArray, useRestoredAnswerState } from "./answer-restore";
import { passageBlocksFrom, sliceRuns, type PassageToken } from "./passage-tokens";
import { useSkin } from "@/core/exercise/skin";
import type { RichContent } from "@/core/question-schema";
import { RichTextValue } from "@/core/rich-text/RichTextValue";

export interface SelectWordsPlayerProps extends PlayerProps {
  passage: string;
  /** Rich passage: blocks + runs. `passage` stays the plain-text fallback. */
  passageContent?: RichContent | null;
  /** Indices (into the word-token list) of the correct words. */
  correctWords: number[];
  instructionHint?: string;
}

function sameNumberSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export const SelectWordsPlayer: React.FC<SelectWordsPlayerProps> = ({
  passage,
  passageContent,
  correctWords,
  instructionHint,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  const blocks = useMemo(() => passageBlocksFrom(passageContent, passage), [passageContent, passage]);
  const tokens = useMemo(() => blocks.flatMap((block) => block.tokens), [blocks]);
  // Kênh khôi phục: đáp án đã lưu (mảng word index) hydrate lại lựa chọn.
  const [selected, setSelected] = useRestoredAnswerState<number[]>(restoredNumberArray(answer));
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const correct = new Set(correctWords);
  const recordOnly = selfAssessment === true || correctWords.length === 0;
  // element = each selectable word (its wordIndex).
  const elementIds = useMemo(
    () => tokens.filter((t): t is PassageToken & { wordIndex: number } => t.wordIndex !== null).map((t) => String(t.wordIndex)),
    [tokens],
  );
  // buildAnswer must see the selection of the CURRENT interaction, not the
  // render closure — toggle() updates the ref before grading.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => selectedRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");

  const toggle = (idx: number) => {
    if (locked) return;
    // Compute next from the render closure and fire side effects OUTSIDE the
    // setState updater (updaters must stay pure — StrictMode double-invokes them
    // in dev, which would double-fire onElementGraded/report/onComplete).
    const prev = selectedRef.current;
    const next = prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx];
    selectedRef.current = next;
    setSelected(next);
    if (recordOnly) {
      // Record-only: đồng bộ đáp án lên cha qua report — không chấm, không âm thanh.
      report(next, "incomplete");
      return;
    }
    onAnswerChange?.(next);
    // Đổi lựa chọn sau khi "Kiểm tra" chấm sai → xoá trạng thái sai để thử lại.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    if (next.includes(idx)) {
      instant.grade(String(idx), correct.has(idx) ? "correct" : "incorrect");
    } else {
      instant.clear(String(idx));
    }
  };

  const check = () => {
    if (locked) return;
    if (recordOnly) {
      report(selected, "incomplete");
      return;
    }
    report(selected, sameNumberSet(selected, correctWords) ? "correct" : "incorrect");
  };

  return (
    <PlayerShell {...shell} submitted={submitted}>
      {instructionHint && (
        <p className={`italic text-sm sm:text-base mb-3 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
          {instructionHint}
        </p>
      )}

      <div className={`p-4 sm:p-6 md:p-8 leading-relaxed text-lg sm:text-xl md:text-2xl shadow-lg ${skin.panel?.("card") ?? "bg-white/80 rounded-3xl border-4 border-white"} ${skin.emphasis?.("neutral", "strong") ?? "text-slate-800 font-bold"}`}>
        {blocks.map((block, bi) => (
          // Alignment is a BLOCK property — applied once here, never per word.
          <p key={bi} data-passage-block className={textAlignClass(block.align) || undefined}>
        {block.tokens.map((tok, i) => {
          if (tok.wordIndex === null) {
            return (
              <span key={i} className="whitespace-pre-wrap">
                <RichTextValue value={sliceRuns(block.runs, tok.start, tok.end)} />
              </span>
            );
          }

          const wIdx = tok.wordIndex;
          const isSelected = selected.includes(wIdx);
          const rv = instant.reveal(String(wIdx));
          const isCorrect = rv ? rv === "correct" : correct.has(wIdx);
          const showState = rv !== undefined || submitted || status === "success";
          // "Kiểm tra" vừa chấm sai (button mode) — chỉ tô đỏ từ CHỌN SAI; từ đúng
          // không được lộ (không tô xanh/gợi ý) khi còn được thử lại.
          const showWrongOnly =
            !showState && !recordOnly && status === "error" && isSelected && !isCorrect;

          const chipState = showState
            ? isSelected
              ? isCorrect
                ? "correct"
                : "wrong"
              : "idle"
            : showWrongOnly
              ? "wrong"
              : isSelected
                ? "selected"
                : "idle";
          const layout =
            "cursor-pointer rounded-lg px-1 mx-px transition-colors border-b-4 border-transparent ";
          let cls: string;
          const skinned = skin.chip?.(chipState, "primary");
          if (skinned) {
            cls = `${layout}${skinned}`;
          } else {
            cls = layout;
            if (showState) {
              if (isSelected && isCorrect) {
                cls += "bg-green-200 text-green-800  border-green-500";
              } else if (isSelected && !isCorrect) {
                cls += "bg-red-200 text-red-700  border-red-500 line-through";
              } else if (!isSelected && isCorrect) {
                cls += "bg-green-50  text-green-700  border-green-400 border-dashed";
              } else {
                cls += "text-slate-800";
              }
            } else if (showWrongOnly) {
              cls += "bg-red-200 text-red-700  border-red-500 line-through";
            } else if (isSelected) {
              cls += "bg-yellow-300 text-slate-800 border-yellow-500";
            } else {
              cls += "hover:bg-yellow-100  hover:border-yellow-300 ";
            }
          }

          return (
            <span key={i} role="button" onClick={() => toggle(wIdx)} className={cls}>
                <RichTextValue value={sliceRuns(block.runs, tok.start, tok.end)} />
            </span>
          );
        })}
          </p>
        ))}
      </div>

      {/* Nút tự-chấm chỉ ở gradeMode self — luồng parent-graded (thi) không thấy. */}
      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <div className="flex justify-center mt-6">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={check}
            disabled={selected.length === 0}
            className={
              skin.actionButton?.(selected.length > 0, "primary") ??
              "px-8 py-3 rounded-full border-4 border-yellow-500 bg-yellow-400 text-white font-black text-lg shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}

      {status === "error" && (
        <PlayerInlineFeedback kind="error" fallbackClass="text-center mt-3 text-red-500 font-bold">
          Chưa đúng rồi, thử lại nhé!
        </PlayerInlineFeedback>
      )}
      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="text-center mt-3 text-green-600 font-black">Tuyệt vời! 🎉</PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
