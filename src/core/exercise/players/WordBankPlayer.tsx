/**
 * P25 — Cloze / "word_bank".
 * A sentence with blank slots plus a bank of word chips below. Drag a chip into
 * a blank (or click-select a chip then click a blank). Each word is used once;
 * replacing a blank returns the old word to the bank. "Kiểm tra" grades
 * blankId → wordId. Answer = Record<blankId, wordId>.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  PlayerShell,
  PlayerErrorFeedback,
  RichContentBlocks,
  useHydratedRecordAnswer,
  useGrading,
  useInstantGrading,
  type ContentBlock,
  type PlayerProps,
} from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { plainTextFromRuns } from "@/core/rich-text/html";
import type { RichTextRun, WordBankEntry } from "@/core/question-schema";
import { wordBankEntryLabel } from "@/core/question-schema";
import { AnswerMediaView } from "./AnswerMediaView";
import { BLANK_MARKER_RE } from "./blank-markers";
import { blankRevealLine } from "./blank-label";

type Segment = { text: string | RichTextRun[] } | { blankId: string };

export interface WordBankPlayerProps extends PlayerProps {
  /** Flat segment list — used only as a fallback when `content` has no marker. */
  segments?: Segment[];
  /** Full content blocks; when present the blanks render IN PLACE at their marker
   * position, preserving paragraph order and ContentLayout (#398/#399). */
  content?: { blocks?: ContentBlock[] };
  /** Canonical blank order (grading key). Falls back to the blanks in `segments`. */
  blankIds?: string[];
  /**
   * web-own: nhãn tác giả khai cho khối "Đáp án đúng", tra theo blankId
   * (blank-label.ts). Record RIÊNG chứ không nhét vào `blankIds`: thứ tự chấm
   * dựng từ marker trong câu văn, còn nhãn đến từ `blanks[]` — hai nguồn khác
   * nhau, gộp lại là ép dispatch join chỉ để truyền prop.
   */
  blankLabels?: Record<string, string>;
  wordBank: WordBankEntry[];
  /** blankId → wordId */
  correctMappings: Record<string, string>;
}

const isBlank = (s: Segment): s is { blankId: string } =>
  (s as { blankId?: string }).blankId !== undefined;

function blockHasBlankMarker(block: ContentBlock): boolean {
  if (block.type === "layout" && Array.isArray(block.columns)) {
    return block.columns.some((column) => column.some(blockHasBlankMarker));
  }
  const text = Array.isArray(block.content)
    ? plainTextFromRuns(block.content)
    : block.text ?? "";
  return BLANK_MARKER_RE.test(text);
}

/**
 * Mặt của một phần tử ngân hàng — chữ, media, hoặc media kèm chú thích.
 *
 * Ô trống đã điền nhỏ hơn con chip trong khay nên media lấy trần cỡ khác; ngoài
 * cỡ thì hai chỗ vẽ giống hệt nhau, để học sinh nhận ra đúng thứ mình vừa kéo.
 */
const WordBankEntryBody: React.FC<{ entry: WordBankEntry; inBlank?: boolean }> = ({
  entry,
  inBlank = false,
}) => {
  if (!entry.media) return <RichTextValue value={entry.text} />;
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <AnswerMediaView media={entry.media} alt={entry.text} size={inBlank ? "blank" : "chip"} />
      {entry.text ? <RichTextValue value={entry.text} /> : null}
    </span>
  );
};

export const WordBankPlayer: React.FC<WordBankPlayerProps> = ({
  segments,
  content,
  blankIds: blankIdsProp,
  blankLabels,
  wordBank,
  correctMappings,
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  richContent,
  ...shell
}) => {
  // blankId → wordId
  const skin = useSkin();
  const [fills, setFills] = useHydratedRecordAnswer(answer);
  const fillsRef = useRef(fills);
  useEffect(() => {
    fillsRef.current = fills;
  }, [fills]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [dragWord, setDragWord] = useState<string | null>(null);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  const usedWordIds = new Set(Object.values(fills));
  const bankAvailable = wordBank.filter((w) => !usedWordIds.has(w.id));
  const blankIds = useMemo(
    () =>
      blankIdsProp?.length
        ? blankIdsProp
        : (segments ?? []).filter(isBlank).map((s) => s.blankId),
    [blankIdsProp, segments],
  );
  const inPlace = (content?.blocks?.length ?? 0) > 0;
  const firstBlockIsRequirement =
    inPlace && !blockHasBlankMarker(content!.blocks![0]);
  const requirementContent = firstBlockIsRequirement
    ? { ...content, blocks: content!.blocks!.slice(0, 1) }
    : undefined;
  const interactionContent = firstBlockIsRequirement
    ? { ...content, blocks: content!.blocks!.slice(1) }
    : content;
  const recordOnly = selfAssessment === true || Object.keys(correctMappings ?? {}).length === 0;
  const instant = useInstantGrading({
    elementIds: blankIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => ({ ...fillsRef.current }),
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  // In-player "Kiểm tra" just graded incorrect — wrong-filled blanks turn red
  // (the expected words are NOT revealed while the pupil can retry).
  const errored = status === "error";
  const answerReveal = recordOnly
    ? null
    : blankIds
        .map((blankId, i) => {
          const word = wordBank.find((w) => w.id === correctMappings[blankId]);
          // Phần tử chỉ-ảnh không có chữ nào để in ra bảng đáp án — rơi về nhãn
          // đọc được của nó thay vì để trống ô.
          const label = word ? wordBankEntryLabel(word) : undefined;
          // web-own: chưa upstream lên studio — studio cũng đang in cứng "Số N".
          return blankRevealLine({
            label: blankLabels?.[blankId],
            index: i,
            separator: " → ",
            value: label ?? correctMappings[blankId] ?? "?",
          });
        })
        .join("\n");

  const wordById = (id: string | undefined) =>
    id ? wordBank.find((w) => w.id === id) : undefined;
  const blankOwningWord = (wordId: string) =>
    Object.keys(fills).find((bid) => fills[bid] === wordId);

  const fillBlank = (blankId: string, wordId: string) => {
    if (locked) return;
    const next = { ...fills };
    // Remove word from any other blank it currently occupies.
    const prevBlank = blankOwningWord(wordId);
    if (prevBlank) delete next[prevBlank];
    next[blankId] = wordId;
    fillsRef.current = next;
    setFills(next);
    setSelectedWord(null);
    onAnswerChange?.(next);
    // Refilling after a wrong self-check clears the error for the retry.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    if (prevBlank) instant.clear(prevBlank);
    instant.grade(blankId, correctMappings[blankId] === wordId ? "correct" : "incorrect");
  };

  const clearBlank = (blankId: string) => {
    if (locked || !fills[blankId]) return;
    const next = { ...fills };
    delete next[blankId];
    fillsRef.current = next;
    setFills(next);
    onAnswerChange?.(next);
    // Emptying a blank after a wrong self-check clears the error too.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    instant.clear(blankId);
  };

  const clickWord = (id: string) => {
    if (locked) return;
    setSelectedWord((cur) => (cur === id ? null : id));
  };

  const blankClicked = (blankId: string) => {
    if (locked) return;
    const incoming = dragWord ?? selectedWord;
    if (incoming) {
      fillBlank(blankId, incoming);
      setDragWord(null);
    } else if (fills[blankId]) {
      clearBlank(blankId);
    }
  };

  const wordDropped = (event: React.DragEvent<HTMLButtonElement>, blankId: string) => {
    event.preventDefault();
    if (locked) return;
    const transferredWord = event.dataTransfer.getData("text/plain");
    const incoming = transferredWord || dragWord;
    if (incoming && wordById(incoming)) fillBlank(blankId, incoming);
    setDragWord(null);
  };

  const grade = () => {
    if (locked) return;
    const allFilled = blankIds.every((bid) => fills[bid]);
    if (!allFilled) {
      report(fills, "incomplete");
      return;
    }
    if (recordOnly) {
      report(fills, "incomplete");
      return;
    }
    const correct = blankIds.every((bid) => fills[bid] === correctMappings[bid]);
    report(fills, correct ? "correct" : "incorrect");
  };

  useEffect(() => {
    if (submitted && status === "idle") grade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const renderBlank = (blankId: string) => {
    const word = wordById(fills[blankId]);
    const rv = instant.reveal(blankId);
    // Wrong notation also right after an in-player "Kiểm tra" (errored) — the
    // blank keeps showing the pupil's own word, so nothing is revealed.
    const wrong =
      rv !== undefined
        ? rv === "incorrect"
        : !recordOnly && (submitted || errored) && fills[blankId] !== correctMappings[blankId];
    const ok =
      rv !== undefined
        ? rv === "correct"
        : !recordOnly && submitted && fills[blankId] === correctMappings[blankId];
    const zoneState = wrong
      ? "wrong"
      : ok
        ? "correct"
        : word
          ? "filled"
          : selectedWord || dragWord
            ? "active"
            : "idle";
    return (
      <button
        type="button"
        // web-own: GHÉP nhãn tác giả vào, không thay thế. aria-label đè nội
        // dung nút, nên bỏ chữ "Chỗ trống" là học sinh khiếm thị chỉ nghe
        // "(1), nút" — không còn gì cho biết đây là ô cần điền. Không khai
        // nhãn thì rơi về đúng chuỗi cũ.
        aria-label={`Chỗ trống ${blankLabels?.[blankId]?.trim() || blankIds.indexOf(blankId) + 1}`}
        onClick={() => blankClicked(blankId)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(event) => wordDropped(event, blankId)}
        disabled={locked}
        className={
          skin.dropZone?.(zoneState) ??
          `inline-flex items-center justify-center align-middle mx-1 my-1 min-w-[90px] px-3 py-1.5 rounded-2xl border-4 font-black transition-all
          ${
            wrong
              ? "bg-red-50 border-red-400 text-red-600"
              : ok
                ? "bg-green-50 border-green-400 text-green-700"
                : word
                  ? "bg-violet-100 border-violet-400 text-violet-700 hover:border-violet-500"
                  : selectedWord || dragWord
                    ? "bg-violet-50 border-dashed border-violet-400 text-violet-400"
                    : "bg-slate-100 border-dashed border-slate-200 text-slate-500"
          }`
        }
      >
        {word ? <WordBankEntryBody entry={word} inBlank /> : "______"}
      </button>
    );
  };

  return (
    <PlayerShell
      {...shell}
      richContent={requirementContent ?? richContent}
      submitted={submitted}
      answerReveal={answerReveal}
    >
      {/* Thứ tự web — câu/đoạn văn TRƯỚC, ngân hàng từ SAU (bank-trên của #490
          là lựa chọn layout, không phải yêu cầu chức năng blank-in-place:
          kéo-thả/click hoạt động như nhau). All body blocks keep their original
          order and rich content. Segment-only payloads use the same order. */}
      <div className={`p-4 sm:p-6 leading-relaxed text-lg sm:text-xl md:text-2xl ${skin.panel?.("card") ?? "rounded-3xl bg-white/70 border-4 border-white"} ${skin.emphasis?.("neutral", "medium") ?? "font-bold text-slate-800"}`}>
        {inPlace ? (
          <RichContentBlocks
            blocks={interactionContent!.blocks!}
            compact
            allowMediaGrid
            renderInlineBlank={renderBlank}
          />
        ) : (
          <span className="inline">
            {(segments ?? []).map((seg, i) =>
              isBlank(seg) ? (
                <React.Fragment key={i}>{renderBlank(seg.blankId)}</React.Fragment>
              ) : (
                <span key={i} className="whitespace-pre-wrap">
                  <RichTextValue value={seg.text} />
                </span>
              ),
            )}
          </span>
        )}
      </div>


      {/* Word bank — SAU nội dung (thứ tự web) */}
      <div className={`p-3 sm:p-4 mt-6 min-h-[64px] ${skin.panel?.("tray") ?? "bg-white/60 rounded-3xl border-4 border-white"}`}>
        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
          {bankAvailable.length === 0 ? (
            <span className={`italic px-2 py-1 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
              Đã dùng hết các từ
            </span>
          ) : (
            bankAvailable.map((w) => {
              const selected = selectedWord === w.id;
              return (
                // Drag source = shared module-scope `DraggableChip` — see its
                // docblock: Framer transforms stay off the draggable node so
                // Chrome does not cancel the drag (#533/#563/#569).
                <DraggableChip
                  key={w.id}
                  dragging={dragWord === w.id}
                  locked={locked}
                  onDragStartCapture={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", w.id);
                    setDragWord(w.id);
                  }}
                  onDragStart={() => setDragWord(w.id)}
                  onDragEnd={() => setDragWord(null)}
                  onClick={() => clickWord(w.id)}
                  className={
                    skin.chip?.(selected ? "selected" : "idle", "secondary") ??
                    `px-4 py-2 rounded-full border-4 font-bold text-sm sm:text-base md:text-lg transition-all
                    ${
                      selected
                        ? "bg-yellow-100 border-yellow-400 text-yellow-800 scale-105"
                        : "bg-white border-violet-300 text-violet-700 hover:border-violet-500 hover:bg-violet-50"
                    }`
                  }
                  ariaLabel={wordBankEntryLabel(w)}
                >
                  <WordBankEntryBody entry={w} />
                </DraggableChip>
              );
            })
          )}
        </div>
      </div>

      <PlayerErrorFeedback show={errored && !submitted} />

      {/* No blanks → read-only content: no "Kiểm tra" — nothing to grade (#440 parity).
          Parent-graded flows own the verdict — never show the self-check button. */}
      {mode !== "parent" && blankIds.length > 0 && !instant.active && !locked && !recordOnly && (
        <div className="flex justify-center mt-6">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={grade}
            className={
              skin.actionButton?.(true, "secondary") ??
              "px-8 py-3 rounded-full border-4 border-violet-500 bg-violet-400 text-white font-black text-lg shadow-md hover:bg-violet-500 transition-colors"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}
    </PlayerShell>
  );
};
