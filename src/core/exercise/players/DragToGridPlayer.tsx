/**
 * P29 — Drag & drop / "grid".
 * schema: drag_drop · interactionType: "grid"
 *
 * Student drags tokens from a tray and snaps them into the cells of a rows×cols
 * CSS grid using native HTML5 drag-and-drop. Each cell holds one token; dropping
 * a token onto a filled cell swaps the previous token back to the tray. Tokens
 * already in a cell can be dragged to another cell or back to the tray.
 * "Kiểm tra" grades each cell's token vs correctCells (cellKey "r-c" → tokenId).
 * Answer = Record<cellKey, tokenId>.
 *
 * TOUCH: native HTML5 drag never fires on iOS/iPadOS, so every placement is
 * also reachable by tapping — chạm thẻ trong khay để chọn, chạm ô để đặt,
 * chạm thẻ đã đặt để trả về khay. Same grammar as Categorize/CardSort.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, useGrading, useHydratedRecordAnswer, useInstantGrading, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { joinReveal, revealName } from "./answer-name";

export interface DragToGridPlayerProps extends PlayerProps {
  rows: number;
  cols: number;
  tokens: { id: string; text: string; imageUrl?: string }[];
  /** cellKey "r-c" → tokenId */
  correctCells: Record<string, string>;
}

export const DragToGridPlayer: React.FC<DragToGridPlayerProps> = ({
  rows,
  cols,
  tokens,
  correctCells,
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
  // cells: cellKey "r-c" → tokenId. Hydrated in place from the parent-supplied
  // `answer` (the exact Record shape this player reports) — no key-remount.
  const [cells, setCells] = useHydratedRecordAnswer(answer);
  const [dragId, setDragId] = useState<string | null>(null);
  // Tap-to-select fallback: the token id waiting for a cell tap (touch/keyboard).
  const [selected, setSelected] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || Object.keys(correctCells ?? {}).length === 0;
  // element = each grid cell that has an expected token (matches correctCells'
  // cellKey → tokenId shape) — cells outside correctCells are decorative and
  // stay ungraded, same as the old whole-board check().
  const elementIds = useMemo(() => Object.keys(correctCells ?? {}), [correctCells]);
  // buildAnswer must see the cells of the CURRENT interaction, not the
  // render closure — commit() updates the ref before grading.
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => cellsRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  const answerReveal = recordOnly
    ? null
    : joinReveal(
        Object.entries(correctCells).map(([cellKey, tokenId]) => {
          const [r, c] = cellKey.split("-").map(Number);
          const ti = tokens.findIndex((t) => t.id === tokenId);
          return [revealName(tokens[ti], ti, "Thẻ"), ` → ô (${r + 1}, ${c + 1})`];
        }),
      );

  const cellOfToken = (tokenId: string) =>
    Object.entries(cells).find(([, t]) => t === tokenId)?.[0] ?? null;
  const placedTokenIds = new Set(Object.values(cells));
  const unplaced = tokens.filter((t) => !placedTokenIds.has(t.id));

  const commit = (next: Record<string, string>) => {
    setCells(next);
    cellsRef.current = next;
    onAnswerChange?.(next);
    // Rearranging after a wrong self-check clears the error so retry is clean.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
  };

  const clearPending = () => {
    setDragId(null);
    setSelected(null);
    setOverCell(null);
  };

  /**
   * Place `id` in a cell. Both interactions land here: the native drag
   * (`dragId` on drop) and the tap fallback (`selected` on a cell tap).
   */
  const moveToCell = (id: string, cellKey: string) => {
    if (locked) return;
    const next = { ...cells };
    // remove the moved token from its previous cell (if any)
    const prev = cellOfToken(id);
    if (prev) delete next[prev];
    // bump any existing occupant of the target cell back to the tray
    delete next[cellKey];
    next[cellKey] = id;
    commit(next);
    if (prev) instant.clear(prev);
    instant.grade(cellKey, next[cellKey] === correctCells[cellKey] ? "correct" : "incorrect");
    clearPending();
  };

  const moveToTray = (id: string) => {
    if (locked) return;
    const prev = cellOfToken(id);
    if (!prev) return;
    const next = { ...cells };
    delete next[prev];
    commit(next);
    instant.clear(prev);
    clearPending();
  };

  const dropToCell = (cellKey: string) => {
    const id = dragId ?? selected;
    if (!id) return;
    moveToCell(id, cellKey);
  };

  const dropToTray = () => {
    const id = dragId ?? selected;
    if (!id) return;
    moveToTray(id);
  };

  /** Tray tap = pick up / put down; a tap on a placed token returns it. */
  const tapToken = (id: string, inCell: boolean) => {
    if (locked) return;
    if (inCell) moveToTray(id);
    else setSelected((cur) => (cur === id ? null : id));
  };

  const check = () => {
    if (locked) return;
    // No answer key (or self-assessment): record only, never fake a verdict.
    if (recordOnly) {
      report(cells, "incomplete");
      return;
    }
    const keys = Object.keys(correctCells);
    const ok =
      keys.every((k) => cells[k] === correctCells[k]) &&
      Object.keys(cells).length === keys.length;
    report(cells, ok ? "correct" : "incorrect");
  };

  // Drag source = shared module-scope `DraggableChip`; see its docblock for why
  // an inline component here would cancel the drag (#533/#563/#569).
  const tokenChip = (id: string, text: string, imageUrl?: string, inCell?: boolean) => (
    <DraggableChip
      key={id}
      dragging={dragId === id}
      locked={locked}
      hoverScale={1.05}
      onDragStart={() => setDragId(id)}
      onDragEnd={() => { setDragId(null); setOverCell(null); }}
      onClick={(e) => { e.stopPropagation(); tapToken(id, !!inCell); }}
      ariaLabel={text}
      className={
        skin.chip?.(selected === id ? "selected" : inCell ? "placed" : "idle", "primary") ??
        `px-3 py-2 rounded-xl border-4 font-bold text-xs sm:text-sm shadow-md transition-colors whitespace-nowrap ${
          selected === id
            ? "border-yellow-400 bg-yellow-100  text-yellow-800 "
            : inCell
              ? "border-rose-400 bg-rose-100  text-rose-800 "
              : "border-white bg-rose-50  text-slate-800 hover:border-rose-300 "
        }`
      }
    >
      {imageUrl && (
        <img src={imageUrl} alt={text} className="inline-block w-7 h-7 mr-1 rounded-lg object-contain align-middle" />
      )}
      <RichTextValue value={text} />
    </DraggableChip>
  );

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      {/* Grid */}
      <div
        className="grid gap-2 sm:gap-3 mx-auto"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 130}px` }}
      >
        {Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((__, c) => {
            const key = `${r}-${c}`;
            const tokenId = cells[key];
            const token = tokenId ? tokens.find((t) => t.id === tokenId) : null;
            const active = overCell === key && !!dragId;
            const rv = instant.reveal(key);
            const cellState = rv === "correct" ? "correct" : rv === "incorrect" ? "wrong" : active ? "active" : token ? "filled" : "idle";
            return (
              <div
                key={key}
                onDragOver={(e) => { if (!locked) { e.preventDefault(); setOverCell(key); } }}
                onDragLeave={() => setOverCell((o) => (o === key ? null : o))}
                onDrop={() => dropToCell(key)}
                onClick={() => { if (selected) moveToCell(selected, key); }}
                className={`${selected ? "cursor-pointer ring-2 ring-rose-300 " : ""}${
                  skin.dropZone?.(cellState) ??
                  `rounded-2xl border-4 transition-all ${
                    rv === "correct"
                      ? "border-green-400 bg-green-50 "
                      : rv === "incorrect"
                        ? "border-red-400 bg-red-50 "
                        : active
                          ? "border-dashed border-rose-400 bg-rose-50  scale-105"
                          : token
                            ? "border-rose-200  bg-rose-50/70"
                            : "border-dashed border-slate-200 bg-white/50"
                  }`
                } aspect-square flex items-center justify-center p-1.5 text-center`}
              >
                <AnimatePresence>
                  {token ? (
                    tokenChip(token.id, token.text, token.imageUrl, true)
                  ) : (
                    <span className={`text-lg ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-black"}`}>+</span>
                  )}
                </AnimatePresence>
              </div>
            );
          }),
        )}
      </div>

      {/* Tray */}
      <div
        onDragOver={(e) => { if (!locked) e.preventDefault(); }}
        onDrop={dropToTray}
        className={`flex flex-wrap gap-2 mt-6 min-h-[64px] p-3 transition-colors justify-center ${
          skin.panel?.("tray", dragId || selected ? "active" : "idle") ??
          `rounded-3xl border-4 border-dashed ${dragId || selected ? "border-rose-300  bg-rose-50/60" : "border-slate-200 bg-white/40"}`
        }`}
      >
        <AnimatePresence>
          {unplaced.map((t) => (
            tokenChip(t.id, t.text, t.imageUrl)
          ))}
        </AnimatePresence>
        {unplaced.length === 0 && (
          <span className={`italic text-sm self-center px-2 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
            Đã đặt hết các thẻ rồi! 👍
          </span>
        )}
      </div>

      {/* Parent-graded flows own the verdict — never show the self-check button. */}
      {mode !== "parent" && !instant.active && !locked && !recordOnly && (
        <div className="mt-6 flex justify-center">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={check}
            className={
              skin.actionButton?.(true, "primary") ??
              "px-8 py-3 rounded-full border-4 border-rose-500 bg-rose-400 text-white font-black text-lg shadow-md hover:bg-rose-500 transition-all"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-center text-green-600 font-black text-lg md:text-xl">
          Sắp xếp đúng hết rồi! 🎉
        </PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-center text-red-500 font-black text-lg md:text-xl">
          Có ô chưa đúng, thử lại nhé! 🤔
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
