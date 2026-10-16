/**
 * P21 — Ordering / "timeline" (new interaction).
 * schema: ordering · interactionType: "timeline"
 *
 * A horizontal timeline axis with N labeled slots (dates/periods). Drag items
 * from the tray onto slots; each slot holds one item and swaps on conflict.
 * "Kiểm tra" grades item-in-slot vs `correctOrder` (item id per slot index).
 * Answer = array of item ids by slot index (null where empty).
 *
 * TOUCH: native HTML5 drag never fires on iOS/iPadOS, so every placement is
 * also reachable by tapping — chạm thẻ để chọn, chạm mốc thời gian để đặt,
 * chạm thẻ đã đặt để trả về khay. The tap pick reuses `DragSource`, so both
 * paths feed the same `dropOnSlot`/`returnToTray`.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { CalendarDays } from "lucide-react";
import { PlayerInlineFeedback, PlayerShell, ContentImage, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { cn } from "@/core/utils";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { chipTrayClass, displayLayoutKey } from "@/core/exercise/display-layout";

export interface TimelineItem {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface TimelineSlot {
  id: string;
  label: string;
}

export interface TimelinePlayerProps extends PlayerProps {
  items: TimelineItem[];
  slots: TimelineSlot[];
  /** Correct item id for each slot index. */
  correctOrder: string[];
}

type DragSource =
  | { kind: "tray"; itemId: string }
  | { kind: "slot"; slotIndex: number };

export const TimelinePlayer: React.FC<TimelinePlayerProps> = ({
  items,
  slots,
  correctOrder,
  layout,
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
  // Restore channel (`answer`): the exact shape this player reports — item id
  // per slot index, null where empty. Only hydrate when the array matches the
  // CURRENT slot count and every entry is string|null; anything else is a
  // stale answer for a changed payload and is ignored, never mis-aligned.
  // hydrationKey/draft pattern (see TwoColumnMatchPlayer) — no key-remount.
  const hydratedPlacement = useMemo(() => {
    if (!Array.isArray(answer) || answer.length !== slots.length) return null;
    if (!answer.every((value) => value === null || typeof value === "string")) return null;
    return answer as (string | null)[];
  }, [answer, slots.length]);
  const hydrationKey = JSON.stringify(hydratedPlacement);
  // placement[slotIndex] = itemId | null
  const [draft, setDraft] = useState(() => ({
    hydrationKey,
    placement: hydratedPlacement ?? slots.map(() => null as string | null),
  }));
  const placement =
    draft.hydrationKey === hydrationKey ? draft.placement : hydratedPlacement ?? draft.placement;
  const setPlacement = (next: (string | null)[]) => setDraft({ hydrationKey, placement: next });
  const [drag, setDrag] = useState<DragSource | null>(null);
  // Tap-to-select fallback: the pick waiting for a slot tap (touch/keyboard).
  // Same `DragSource` shape, so it flows into the same move functions.
  const [selected, setSelected] = useState<DragSource | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [overTray, setOverTray] = useState(false);

  const { status, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const hasKey = Array.isArray(correctOrder) && correctOrder.some((id) => !!id);
  const recordOnly = selfAssessment === true || !hasKey;
  // element = each slot (position on the timeline)
  const elementIds = useMemo(() => slots.map((_, i) => String(i)), [slots]);
  const placementRef = useRef(placement);
  placementRef.current = placement;
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => placementRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  const reveal = !recordOnly
    ? slots
        .map((slot, i) => `${i + 1}. ${slot.label}: ${byId.get(correctOrder[i])?.text ?? correctOrder[i] ?? "—"}`)
        .join("\n")
    : undefined;
  const placedIds = useMemo(
    () => new Set(placement.filter((x): x is string => !!x)),
    [placement],
  );
  const trayItems = items.filter((i) => !placedIds.has(i.id));

  /**
   * Drop an item (by id) into a target slot, swapping any current occupant.
   * Computes `next` from the current render's `placement` state (not a
   * functional setState updater) — the updater callback is not guaranteed to
   * run synchronously here, which would leave the instant-grade calls below
   * reading a stale/undefined value.
   */
  const dropOnSlot = (targetSlot: number, source: DragSource) => {
    if (locked) return;
    const next = [...placement];
    let movingId: string;
    if (source.kind === "tray") {
      movingId = source.itemId;
      // remove from any slot it may already occupy (shouldn't, tray items aren't placed)
      const at = next.indexOf(movingId);
      if (at >= 0) next[at] = null;
    } else {
      movingId = next[source.slotIndex] ?? "";
      if (!movingId) return;
    }
    const occupant = next[targetSlot];
    next[targetSlot] = movingId;
    if (source.kind === "slot") {
      // swap: occupant goes back to the source slot (or vanishes to tray if none)
      next[source.slotIndex] = occupant ?? null;
    } else if (occupant && occupant !== movingId) {
      // tray drop displacing an occupant → occupant returns to tray
      // (already overwritten above, so it's effectively unplaced)
    }
    setPlacement(next);
    placementRef.current = next;
    onAnswerChange?.(next);
    const targetId = next[targetSlot];
    if (targetId) {
      instant.grade(String(targetSlot), targetId === correctOrder[targetSlot] ? "correct" : "incorrect");
    } else {
      instant.clear(String(targetSlot));
    }
    if (source.kind === "slot" && source.slotIndex !== targetSlot) {
      const sourceId = next[source.slotIndex];
      if (sourceId) {
        instant.grade(String(source.slotIndex), sourceId === correctOrder[source.slotIndex] ? "correct" : "incorrect");
      } else {
        instant.clear(String(source.slotIndex));
      }
    }
  };

  const returnToTray = (source: DragSource) => {
    if (locked || source.kind !== "slot") return;
    const next = [...placement];
    next[source.slotIndex] = null;
    setPlacement(next);
    placementRef.current = next;
    onAnswerChange?.(next);
    instant.clear(String(source.slotIndex));
  };

  const allFilled = placement.every((x) => !!x);

  const check = () => {
    if (locked) return;
    if (recordOnly) {
      report(placement, "incomplete");
      return;
    }
    if (!allFilled) {
      report(placement, "incomplete");
      return;
    }
    const correct = placement.every((id, i) => id === correctOrder[i]);
    report(placement, correct ? "correct" : "incorrect");
  };

  const clearDragState = () => {
    setDrag(null);
    setSelected(null);
    setOverSlot(null);
    setOverTray(false);
  };

  const sameSource = (a: DragSource | null, b: DragSource) =>
    a?.kind === b.kind &&
    (b.kind === "tray"
      ? (a as { itemId: string }).itemId === b.itemId
      : (a as { slotIndex: number }).slotIndex === b.slotIndex);

  /** Tap a chip: pick it up, or put it down if it was already the pick. */
  const tapChip = (source: DragSource) => {
    if (locked) return;
    setSelected((cur) => (sameSource(cur, source) ? null : source));
  };

  /** Tap a slot: place the current pick there (nothing picked = no-op). */
  const tapSlot = (targetSlot: number) => {
    if (locked || !selected) return;
    dropOnSlot(targetSlot, selected);
    clearDragState();
  };

  /** Tap the tray: send a picked slot item back (a tray pick just deselects). */
  const tapTray = () => {
    if (locked || !selected) return;
    if (selected.kind === "slot") returnToTray(selected);
    clearDragState();
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      {/* Timeline axis with slots */}
      {/* `px-2 pt-0.5`: chừa chỗ cho hiệu ứng phóng của ô sát mép — vùng cuộn
          cắt mọi thứ vẽ ra ngoài padding-box (xem ChainMatchPlayer). */}
      <div className="relative overflow-x-auto px-2 pt-0.5 pb-2">
        <div className="flex items-stretch gap-3 sm:gap-4 min-w-min">
          {slots.map((slot, idx) => {
            const itemId = placement[idx];
            const item = itemId ? byId.get(itemId) : undefined;
            const isOver = overSlot === idx;
            const rv = instant.reveal(String(idx));
            const correctHere = rv
              ? rv === "correct"
              : (submitted || status === "success") && itemId === correctOrder[idx];
            const wrongHere = rv
              ? rv === "incorrect"
              : submitted && !!itemId && itemId !== correctOrder[idx];
            return (
              <div key={slot.id} className="flex flex-col items-center gap-2 w-40 sm:w-48 shrink-0">
                {/* date/period label + axis dot */}
                <div className={`flex items-center gap-1.5 text-sm sm:text-base ${skin.emphasis?.("primary", "strong") ?? "text-rose-600 font-black"}`}>
                  <CalendarDays className="size-4" />
                  <RichTextValue value={slot.label} />
                </div>
                <div className={`h-3 w-3 rounded-full shadow ${skin.accent?.("primary", "fill") ?? "bg-rose-400"}`} />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (drag) setOverSlot(idx);
                  }}
                  onDragLeave={() => setOverSlot((s) => (s === idx ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag) dropOnSlot(idx, drag);
                    clearDragState();
                  }}
                  onClick={() => tapSlot(idx)}
                  className={`flex w-full min-h-[5rem] items-center justify-center ${
                    selected ? "cursor-pointer ring-2 ring-rose-300 " : ""
                  }${
                    skin.dropZone?.(
                      correctHere
                        ? "correct"
                        : wrongHere
                          ? "wrong"
                          : isOver
                            ? "active"
                            : item
                              ? "filled"
                              : "idle",
                    ) ??
                    `rounded-2xl border-4 p-3 text-center transition-colors
                    ${
                      correctHere
                        ? "border-green-400 bg-green-50 "
                        : wrongHere
                          ? "border-red-400 bg-red-50 "
                          : isOver
                            ? "border-rose-400 bg-rose-50 "
                            : item
                              ? "border-rose-200  bg-white"
                              : "border-dashed border-rose-200  bg-white/40"
                    }`
                  }`}
                >
                  {item ? (
                    // Drag source = shared module-scope `DraggableChip`. It is
                    // deliberately layout-free: `layout={!(dragging)}` still flips
                    // true→false at `dragstart`, and that projection teardown is
                    // itself what makes Chrome cancel the drag (#533/#563/#569).
                    <DraggableChip
                      dragging={drag?.kind === "slot" && drag.slotIndex === idx}
                      locked={locked}
                      entrance={false}
                      hoverScale={false}
                      wrapperClassName="w-full"
                      onDragStart={() => setDrag({ kind: "slot", slotIndex: idx })}
                      onDragEnd={clearDragState}
                      onClick={(e) => {
                        e.stopPropagation();
                        tapChip({ kind: "slot", slotIndex: idx });
                      }}
                      ariaLabel={item.text}
                      className={cn(
                        `w-full ${
                          skin.chip?.(
                            sameSource(selected, { kind: "slot", slotIndex: idx }) ? "selected" : "placed",
                            "primary",
                          ) ??
                          `rounded-xl px-2 py-2 text-slate-800 font-bold text-sm sm:text-base ${
                            sameSource(selected, { kind: "slot", slotIndex: idx })
                              ? "bg-yellow-100  ring-4 ring-yellow-400"
                              : "bg-rose-100 "
                          }`
                        } flex items-center gap-1.5`,
                        // Ảnh lớn → khoá bán kính, tránh pill rounded-full phình bầu dục.
                        item.imageUrl && "rounded-3xl",
                      )}
                    >
                      {item.imageUrl && (
                        <ContentImage src={item.imageUrl} alt={item.text} />
                      )}
                      <RichTextValue value={item.text} />
                    </DraggableChip>
                  ) : (
                    <span className={`text-sm ${skin.emphasis?.("primary", "soft") ?? "text-rose-300 font-bold"}`}>Kéo hoặc chạm để đặt</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tray */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (drag?.kind === "slot") setOverTray(true);
        }}
        onDragLeave={() => setOverTray(false)}
        onDrop={(e) => {
          e.preventDefault();
          if (drag) returnToTray(drag);
          clearDragState();
        }}
        onClick={tapTray}
        className={`mt-6 p-3 sm:p-4 transition-colors min-h-[5rem] ${
          skin.panel?.("tray", overTray || selected?.kind === "slot" ? "active" : "idle") ??
          `rounded-2xl border-4 ${overTray || selected?.kind === "slot" ? "border-rose-400 bg-rose-50 " : "border-white bg-white/50"}`
        }`}
      >
        <p className={`mb-2 text-xs sm:text-sm uppercase tracking-wide ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-black"}`}>
          Kéo hoặc chạm để đưa thẻ vào đúng mốc thời gian
        </p>
        <div
          data-layout-region="timeline-tray"
          data-display-layout={displayLayoutKey(layout)}
          className={chipTrayClass()}
          role="group"
          aria-label="Các thẻ chưa đặt lên dòng thời gian"
        >
          {trayItems.length === 0 && (
            <span className={`text-sm italic py-2 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
              Đã xếp hết các thẻ!
            </span>
          )}
          {trayItems.map((item) => (
            // Drag source = shared module-scope `DraggableChip`. It is deliberately
            // layout-free: `layout={!(dragging)}` still flips true→false at
            // `dragstart`, and that projection teardown is itself what makes Chrome
            // cancel the drag (#533/#563/#569).
            <DraggableChip
              key={item.id}
              dragging={drag?.kind === "tray" && drag.itemId === item.id}
              locked={locked}
              entrance={false}
              hoverScale={false}
              wrapperClassName="flex flex-col"
              onDragStart={() => setDrag({ kind: "tray", itemId: item.id })}
              onDragEnd={clearDragState}
              onClick={(e) => {
                e.stopPropagation();
                tapChip({ kind: "tray", itemId: item.id });
              }}
              ariaLabel={item.text}
              className={cn(
                `${
                  skin.chip?.(
                    sameSource(selected, { kind: "tray", itemId: item.id }) ? "selected" : "idle",
                    "primary",
                  ) ??
                  `rounded-2xl border-4 px-3 py-2 text-slate-800 font-bold text-sm sm:text-base shadow ${
                    sameSource(selected, { kind: "tray", itemId: item.id })
                      ? "border-yellow-400 bg-yellow-100 "
                      : "border-rose-200  bg-white"
                  }`
                } flex items-center gap-1.5`,
                // Ảnh lớn → khoá bán kính, tránh pill rounded-full phình bầu dục.
                item.imageUrl && "rounded-3xl",
              )}
            >
              {item.imageUrl && (
                <ContentImage src={item.imageUrl} alt={item.text} />
              )}
              <RichTextValue value={item.text} />
            </DraggableChip>
          ))}
        </div>
      </div>

      {/* Parent-graded flows own the verdict — never show the self-check button. */}
      {mode !== "parent" && !instant.active && !locked && !recordOnly && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={check}
          className={
            skin.actionButton?.(true, "primary")
              ? `mt-6 w-full sm:w-auto ${skin.actionButton(true, "primary")}`
              : "mt-6 w-full sm:w-auto px-8 py-3 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-black text-base sm:text-lg shadow-lg transition-colors"
          }
        >
          Kiểm tra
        </motion.button>
      )}
      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-green-600 font-black text-lg">🎉 Dòng thời gian chuẩn!</PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-red-500 font-bold text-base">
          {allFilled
            ? "Có thẻ chưa đúng mốc, thử lại nhé!"
            : "Hãy xếp hết các thẻ trước khi kiểm tra!"}
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
