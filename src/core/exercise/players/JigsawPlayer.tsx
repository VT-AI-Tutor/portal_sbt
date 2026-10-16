/**
 * Jigsaw — reassemble an image from shuffled pieces.
 * schema: jigsaw
 *
 * The image is conceptually sliced into rows×cols pieces (rendered via
 * background-position on each piece div). Pieces are shuffled into a tray; the
 * student drags (native HTML5 DnD) each piece into its slot on the board. A
 * piece `r-c` belongs in slot `r-c`. Correct when every piece sits in its
 * matching slot → report(placements, "correct").
 * Answer = { pieceId, slotId }[].
 *
 * TOUCH: native HTML5 drag never fires on iOS/iPadOS, so every placement is
 * also reachable by tapping — chạm mảnh trong khay để chọn, chạm ô để đặt,
 * chạm mảnh đã đặt để trả về khay. Same grammar as Categorize/CardSort.
 */
import React, { useEffect, useMemo, useState } from "react";
import { PlayerInlineFeedback, PlayerShell, PlayerErrorFeedback, useGrading, useHydratedRecordAnswer, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { secureRandomInt } from "@/core/lib/security";

export interface JigsawPlayerProps extends PlayerProps {
  imageUrl?: string;
  rows: number;
  cols: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const JigsawPlayer: React.FC<JigsawPlayerProps> = ({
  imageUrl,
  rows,
  cols,
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  ...shell
}) => {
  const skin = useSkin();
  // pieceId / slotId = "r-c"
  const pieceIds = useMemo(() => {
    const ids: string[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) ids.push(`${r}-${c}`);
    return ids;
  }, [rows, cols]);

  const shuffledTray = useMemo(() => shuffle(pieceIds), [pieceIds]);

  // Restore channel: the parent-supplied `answer` is the exact shape emit()
  // reports ({ pieceId, slotId }[]). Convert it back to the slotId → pieceId
  // record (dropping malformed/unknown entries) and hydrate in place — no
  // key-remount, so no entrance-animation replay.
  const hydratedPlacement = useMemo(() => {
    if (!Array.isArray(answer)) return undefined;
    const valid = new Set(pieceIds);
    const record: Record<string, string> = {};
    for (const entry of answer) {
      if (!entry || typeof entry !== "object") continue;
      const { pieceId, slotId } = entry as { pieceId?: unknown; slotId?: unknown };
      if (typeof pieceId !== "string" || typeof slotId !== "string") continue;
      if (!valid.has(pieceId) || !valid.has(slotId)) continue;
      record[slotId] = pieceId;
    }
    return record;
  }, [answer, pieceIds]);
  // slotId → pieceId
  const [placement, setPlacement] = useHydratedRecordAnswer(hydratedPlacement);
  const [dragPiece, setDragPiece] = useState<string | null>(null);
  // Tap-to-select fallback: the piece waiting for a slot tap (touch/keyboard).
  const [selected, setSelected] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<string | null>(null);
  const { status, setStatus, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const locked = submitted || status === "success";
  // The puzzle always carries its implicit key (piece r-c belongs in slot r-c),
  // so record-only is purely the selfAssessment flag.
  const recordOnly = selfAssessment === true;
  const clearError = () => {
    if (status !== "error") return;
    setStatus("idle");
    onStatusChange?.("idle");
  };

  const pieceInSlot = (slotId: string) => placement[slotId] ?? null;
  const slotOfPiece = (pieceId: string) =>
    Object.entries(placement).find(([, p]) => p === pieceId)?.[0] ?? null;
  const trayPieces = shuffledTray.filter((p) => !slotOfPiece(p));

  const emit = (next: Record<string, string>) =>
    Object.entries(next).map(([slotId, pieceId]) => ({ pieceId, slotId }));

  const evaluate = (next: Record<string, string>) => {
    if (recordOnly) {
      report(emit(next), "incomplete");
      return;
    }
    const filled = pieceIds.every((id) => !!next[id]);
    const all = pieceIds.every((id) => next[id] === id);
    if (all) {
      report(emit(next), "correct");
    } else if (filled) {
      // Board fully placed but wrong → never silent: red line + error sound.
      report(emit(next), "incorrect");
    } else {
      onAnswerChange?.(emit(next));
      // Moving a piece after a wrong verdict clears the error for the retry.
      clearError();
    }
  };

  const clearPending = () => {
    setDragPiece(null);
    setSelected(null);
    setOverSlot(null);
  };

  /**
   * Put `pieceId` in a slot. Both interactions land here: the native drag
   * (`dragPiece` on drop) and the tap fallback (`selected` on a slot tap).
   */
  const moveToSlot = (pieceId: string, slotId: string) => {
    if (locked) return;
    const next = { ...placement };
    // free the moved piece's previous slot
    const prev = slotOfPiece(pieceId);
    if (prev) delete next[prev];
    // if slot occupied, that piece goes back to tray (just overwrite it)
    next[slotId] = pieceId;
    setPlacement(next);
    clearPending();
    evaluate(next);
  };

  const moveToTray = (pieceId: string) => {
    if (locked) return;
    const prev = slotOfPiece(pieceId);
    if (!prev) return;
    const next = { ...placement };
    delete next[prev];
    setPlacement(next);
    clearPending();
    onAnswerChange?.(emit(next));
    clearError();
  };

  const dropOnSlot = (slotId: string) => {
    const pieceId = dragPiece ?? selected;
    if (!pieceId) return;
    moveToSlot(pieceId, slotId);
  };

  const dropOnTray = () => {
    const pieceId = dragPiece ?? selected;
    if (!pieceId) return;
    moveToTray(pieceId);
  };

  /** Tray tap = pick up / put down; a tap on a placed piece returns it. */
  const tapPiece = (pieceId: string, inSlot: boolean) => {
    if (locked) return;
    if (inSlot) moveToTray(pieceId);
    else setSelected((cur) => (cur === pieceId ? null : pieceId));
  };

  useEffect(() => {
    if (submitted && status === "idle" && !recordOnly) {
      const all = pieceIds.every((id) => placement[id] === id);
      if (all && pieceIds.length > 0) report(emit(placement), "correct");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const pieceStyle = (pieceId: string): React.CSSProperties => {
    const [r, c] = pieceId.split("-").map(Number);
    return {
      backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
      backgroundSize: `${cols * 100}% ${rows * 100}%`,
      backgroundPosition:
        cols > 1 || rows > 1
          ? `${(c / (cols - 1 || 1)) * 100}% ${(r / (rows - 1 || 1)) * 100}%`
          : "center",
    };
  };

  // Drag source = shared module-scope `DraggableChip`; see its docblock for why
  // an inline component here would cancel the drag (#533/#563/#569).
  const pieceChip = (pieceId: string, inSlot?: boolean) => (
    <DraggableChip
      key={pieceId}
      dragging={dragPiece === pieceId}
      locked={locked}
      entrance={false}
      wrapperClassName="w-full h-full"
      onDragStart={() => setDragPiece(pieceId)}
      onDragEnd={() => { setDragPiece(null); setOverSlot(null); }}
      onClick={(e) => { e.stopPropagation(); tapPiece(pieceId, !!inSlot); }}
      ariaLabel={`Mảnh ghép ${pieceId}`}
      className={`w-full h-full bg-no-repeat shadow ${
        skin.chip?.(selected === pieceId ? "selected" : inSlot ? "placed" : "idle", "primary") ??
        `rounded-xl border-4 ${
          selected === pieceId
            ? "border-yellow-400 ring-2 ring-yellow-300"
            : inSlot
              ? "border-emerald-300 "
              : "border-white"
        }`
      } ${!imageUrl ? `flex items-center justify-center ${skin.accent?.("primary", "fill") ?? "bg-gradient-to-br from-emerald-200 to-teal-300"}` : ""}`}
    >
      <div className="w-full h-full" style={pieceStyle(pieceId)}>
        {!imageUrl && (
          <span className={`text-lg ${skin.emphasis?.("primary", "strong") ?? "font-black text-emerald-800 "}`}>{pieceId}</span>
        )}
      </div>
    </DraggableChip>
  );

  const slotIds = pieceIds; // same coordinate space

  // "Đáp án đúng" của bài ghép hình là HÌNH GỐC nguyên vẹn — mảnh `r-c` về đúng
  // ô `r-c`, nên liệt kê cặp id ra chữ chỉ là nhiễu. Không có ảnh thì nói bằng
  // lời thay vì render khung rỗng.
  const answerReveal = imageUrl ? (
    <img
      src={imageUrl}
      alt="Hình hoàn chỉnh"
      className="max-h-48 w-auto rounded-lg border border-emerald-200"
    />
  ) : (
    "Mỗi mảnh ghép về đúng vị trí của nó để tạo lại hình ban đầu."
  );

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      {/* Board */}
      <div className={`p-3 sm:p-4 ${skin.panel?.("board") ?? "bg-white/60 rounded-3xl border-4 border-white shadow-lg"}`}>
        <div
          className="grid gap-1.5 mx-auto max-w-xl aspect-square"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {slotIds.map((slotId) => {
            const piece = pieceInSlot(slotId);
            const active = overSlot === slotId && !!dragPiece;
            const wrong = submitted && piece !== null && piece !== slotId;
            return (
              <div
                key={slotId}
                onDragOver={(e) => {
                  if (!locked) {
                    e.preventDefault();
                    setOverSlot(slotId);
                  }
                }}
                onDragLeave={() => setOverSlot((o) => (o === slotId ? null : o))}
                onDrop={() => dropOnSlot(slotId)}
                onClick={() => { if (selected) moveToSlot(selected, slotId); }}
                className={`relative border-dashed transition-all ${selected ? "cursor-pointer ring-2 ring-emerald-300 " : ""}${
                  skin.dropZone?.(active ? "active" : wrong ? "wrong" : "idle") ??
                  `rounded-xl border-4 ${
                    active
                      ? "border-emerald-500 bg-emerald-100 "
                      : wrong
                        ? "border-red-400 bg-red-50 "
                        : "border-slate-200 bg-white/50"
                  }`
                }`}
              >
                {piece && pieceChip(piece, true)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tray */}
      <div
        onDragOver={(e) => {
          if (!locked) e.preventDefault();
        }}
        onDrop={dropOnTray}
        className={`mt-5 p-3 transition-colors ${
          skin.panel?.("tray", dragPiece || selected ? "active" : "idle") ??
          `rounded-3xl border-4 border-dashed ${
            dragPiece || selected ? "border-emerald-300  bg-emerald-50/60" : "border-slate-200 bg-white/40"
          }`
        }`}
      >
        <h3 className={`${skin.emphasis?.("neutral", "soft") ?? "font-black text-slate-500"} text-sm mb-2 uppercase tracking-wide`}>
          Các mảnh ghép
        </h3>
        <div className="flex flex-wrap gap-2">
          {trayPieces.length === 0 ? (
            <span className={`italic text-sm px-2 py-6 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
              Đã đặt hết các mảnh! 🧩
            </span>
          ) : (
            trayPieces.map((p) => (
              <div key={p} className="w-16 h-16 sm:w-20 sm:h-20">
                {pieceChip(p)}
              </div>
            ))
          )}
        </div>
      </div>

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-center text-green-600 font-black text-lg md:text-xl">
          Hoàn thành bức tranh! 🧩✨
        </PlayerInlineFeedback>
      )}
      <PlayerErrorFeedback show={status === "error" && !submitted}>
        Bức tranh chưa đúng, đổi chỗ các mảnh thử lại nhé! 🤔
      </PlayerErrorFeedback>
    </PlayerShell>
  );
};
