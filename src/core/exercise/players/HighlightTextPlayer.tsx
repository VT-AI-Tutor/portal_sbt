/**
 * P35 — Highlight text / "text".
 * schema: highlight · interactionType: "text"
 *
 * Render a passage as a flow of clickable spans. Only segments with
 * `selectable !== false` are clickable; the rest are plain text
 * (punctuation / whitespace). Clicking toggles a yellow highlight.
 * "Kiểm tra" grades the selected set vs `correctIds` via sameSet.
 */
import React, { useMemo, useRef } from "react";
import { motion } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, useGrading, useInstantGrading, sameSet, type PlayerProps } from "./shared";
import { restoredStringArray, useRestoredAnswerState } from "./answer-restore";
import { useSkin } from "@/core/exercise/skin";
import type { RichTextRun } from "@/core/question-schema";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { passageColumnsClass } from "@/core/exercise/display-layout";
// web-own: căn lề mảnh không chọn được (SBT-71) — chưa upstream lên studio.
import {
  HIGHLIGHT_SEGMENT_ALIGN_CLASS,
  highlightSegmentAlign,
  splitAlignedSegment,
} from "./highlight-segment-align";

export interface HighlightSegment {
  id: string;
  text: string;
  /** Canonical annotated runs; `text` stays the plain-text fallback. */
  runs?: RichTextRun[];
  /** Defaults to true. When false the segment is plain, non-clickable text. */
  selectable?: boolean;
  /**
   * web-own (SBT-71): chỉ đọc khi `selectable: false`. Khai thì mảnh thành một
   * DÒNG RIÊNG căn theo giá trị này — dùng cho dòng nguồn "(Theo …)" sát lề phải.
   */
  align?: "left" | "center" | "right";
}

export interface HighlightTextPlayerProps extends PlayerProps {
  segments: HighlightSegment[];
  correctIds: string[];
}

export const HighlightTextPlayer: React.FC<HighlightTextPlayerProps> = ({
  segments,
  correctIds,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  layout,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  // Presentation-only: a passage printed in multiple columns (e.g. a two-column
  // poem) maps `display.layout` onto CSS multi-column. Never affects grading.
  const columnsClass = passageColumnsClass(layout);
  // Kênh khôi phục: đáp án đã lưu (mảng segment id) hydrate lại lựa chọn.
  const [selected, setSelected] = useRestoredAnswerState<string[]>(restoredStringArray(answer));
  const { status, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const correct = new Set(correctIds);
  const recordOnly = selfAssessment === true || correctIds.length === 0;
  // element = each clickable segment.
  const elementIds = useMemo(
    () => segments.filter((s) => s.selectable !== false).map((s) => s.id),
    [segments],
  );
  // buildAnswer must see the selection of the CURRENT interaction, not the
  // render closure — toggle() updates the ref before grading.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const instant = useInstantGrading({
    elementIds,
    // Câu chọn-một-tập: "xong" là khớp TẬP các đoạn phải tô, không phải bấm qua
    // hết mọi đoạn (xem ghi chú expectedIds trong useInstantGrading).
    expectedIds: correctIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => selectedRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");

  const toggle = (id: string) => {
    if (locked) return;
    // Compute next from the render closure and fire side effects OUTSIDE the
    // setState updater (updaters must stay pure — StrictMode double-invokes them
    // in dev, which would double-fire onElementGraded/report/onComplete).
    const prev = selectedRef.current;
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    selectedRef.current = next;
    setSelected(next);
    onAnswerChange?.(next);
    if (next.includes(id)) {
      instant.grade(id, correct.has(id) ? "correct" : "incorrect");
    } else {
      instant.clear(id);
    }
  };

  const check = () => {
    if (locked) return;
    if (recordOnly) {
      // Record-only (selfAssessment hoặc không có đáp án): chỉ ghi nhận — không chấm.
      report(selected, "incomplete");
      return;
    }
    report(selected, sameSet(selected, correctIds) ? "correct" : "incorrect");
  };

  // Khối "Đáp án đúng": chữ lấy thẳng từ `correctIds` nên không lệch đáp án chấm.
  // Gom theo cụm liền nhau vì một từ nhiều tiếng bị tách segment ("cô " + "giáo"),
  // segment chỉ-khoảng-trắng giữa hai mảnh cũng cho dính tiếp. Khử trùng vì
  // một từ có thể là đáp án ở nhiều chỗ trong đoạn.
  const answerReveal = useMemo(() => {
    if (recordOnly) return undefined;
    const answerIds = new Set(correctIds);
    const phrases: string[] = [];
    let current: string[] = [];
    const flush = () => {
      const phrase = current.join("").trim();
      if (phrase) phrases.push(phrase);
      current = [];
    };
    for (const seg of segments) {
      if (answerIds.has(seg.id)) current.push(seg.text);
      else if (current.length > 0 && seg.selectable === false && !/\S/.test(seg.text)) current.push(seg.text);
      else flush();
    }
    flush();
    return [...new Set(phrases)].join(", ") || undefined;
  }, [segments, correctIds, recordOnly]);

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      {/* wrapper đoạn văn là khung media/đọc, không phải card nội dung — panel("media") */}
      <div className={`p-4 sm:p-6 md:p-8 leading-relaxed text-lg sm:text-xl md:text-2xl shadow-lg ${columnsClass} ${skin.panel?.("media") ?? "bg-white/80 rounded-3xl border-4 border-white"} ${skin.emphasis?.("neutral", "strong") ?? "text-slate-800 font-bold"}`}>
        {segments.map((seg, segIndex) => {
          const clickable = seg.selectable !== false;
          if (!clickable) {
            // web-own (SBT-71): mảnh khai `align` là một dòng riêng căn lề, thay
            // cho cách cũ chèn dãy dấu cách để đẩy tên tác giả sang phải.
            // Dấu câu dính đầu mảnh (dấu chấm cuối đoạn) ở lại nội dòng.
            const align = highlightSegmentAlign(seg.align);
            if (align) {
              const { lead, body } = splitAlignedSegment(seg);
              return (
                <React.Fragment key={segIndex}>
                  {lead !== null && (
                    <span className="whitespace-pre-wrap">
                      <RichTextValue value={lead} />
                    </span>
                  )}
                  {body !== null && (
                    <span
                      data-segment-align={align}
                      className={`mt-2 block whitespace-pre-wrap ${HIGHLIGHT_SEGMENT_ALIGN_CLASS[align]}`}
                    >
                      <RichTextValue value={body} />
                    </span>
                  )}
                </React.Fragment>
              );
            }
            return (
              <span key={segIndex} className="whitespace-pre-wrap">
                <RichTextValue value={seg.runs ?? seg.text} />
              </span>
            );
          }

          const isSelected = selected.includes(seg.id);
          const rv = instant.reveal(seg.id);
          const isCorrect = rv ? rv === "correct" : correct.has(seg.id);
          const showState = rv !== undefined || submitted || status === "success";

          const chipState = showState
            ? isSelected
              ? isCorrect
                ? "correct"
                : "wrong"
              : "idle"
            : isSelected
              ? "selected"
              : "idle";
          // Typography-neutral base shared by both branches: the selectable
          // word must inherit the passage font-size/weight/line-height so it
          // sits on the same baseline as the non-selectable text around it.
          // State styling is background-only (no border / vertical padding)
          // so nothing shifts the baseline or detaches punctuation.
          const layout =
            "cursor-pointer rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ";
          let cls: string;
          const skinned = skin.inlineToken?.(chipState, "primary");
          if (skinned) {
            cls = `${layout}${skinned}`;
          } else {
            // Built-in fallback (e.g. playful skin): highlight via background
            // only. px-0.5 is cancelled by -mx-0.5 so neighbours don't move.
            cls = layout + "px-0.5 -mx-0.5 ";
            if (showState) {
              if (isSelected && isCorrect) {
                cls += "bg-green-200  text-green-800 ";
              } else if (isSelected && !isCorrect) {
                cls += "bg-red-200  text-red-700  line-through";
              } else if (!isSelected && isCorrect) {
                cls += "underline decoration-dashed decoration-green-500 text-green-700 ";
              } else {
                cls += "text-slate-800";
              }
            } else if (isSelected) {
              cls += "bg-yellow-300 text-slate-800";
            } else {
              cls += "hover:bg-yellow-100 ";
            }
          }

          return (
            <span
              // Keyed by position: two segments can share an id in a payload the
              // author is still repairing, and React must not see one key twice.
              key={segIndex}
              role="button"
              tabIndex={locked ? -1 : 0}
              aria-pressed={isSelected}
              onClick={() => toggle(seg.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(seg.id);
                }
              }}
              className={cls}
            >
                <RichTextValue value={seg.runs ?? seg.text} />
            </span>
          );
        })}
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
