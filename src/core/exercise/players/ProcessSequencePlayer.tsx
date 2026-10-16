/**
 * P20 — Ordering / "process".
 * schema: ordering · interactionType: "process"
 *
 * Drag-reorder rendered as a wrapped step chain with arrows (→) between steps.
 * "Kiểm tra" grades an exact sequence match. Answer = ordered array of ids.
 *
 * TOUCH: native HTML5 drag never fires on iOS/iPadOS, so reordering is also
 * reachable by tapping — chạm bước để nhấc lên, chạm bước khác để thả vào
 * đúng vị trí đó. Both paths call the same `reorder(from, to)`.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { PlayerInlineFeedback, PlayerShell, ContentImage, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { cn } from "@/core/utils";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { displayLayoutKey, layoutContainerClass } from "@/core/exercise/display-layout";
import { secureRandomInt } from "@/core/lib/security";
import { joinReveal, revealName } from "./answer-name";

export interface ProcessItem {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface ProcessSequencePlayerProps extends PlayerProps {
  items: ProcessItem[];
  correctOrder: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Parse the parent-supplied `answer` (ordered id array — the exact shape this
 * player reports) into a full order: keep known ids in their answered order,
 * then append any missing item so the list always covers every item exactly
 * once. Returns null when the value is not a usable answer (wrong shape or no
 * recognizable id) so the caller falls back to its shuffled initial order.
 */
function orderFromAnswer(answer: unknown, ids: string[]): string[] | null {
  if (!Array.isArray(answer) || answer.length === 0) return null;
  const idSet = new Set(ids);
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const id of answer) {
    if (typeof id !== "string" || !idSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    resolved.push(id);
  }
  if (resolved.length === 0) return null;
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      resolved.push(id);
    }
  }
  return resolved;
}

export const ProcessSequencePlayer: React.FC<ProcessSequencePlayerProps> = ({
  items,
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
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  // Restore channel (`answer`): hydrate the order in place — hydrationKey/draft
  // pattern (see TwoColumnMatchPlayer), NOT a key-remount, so no entrance
  // animation replay and no reshuffle when the parent seeds a saved order.
  const hydratedOrder = useMemo(() => orderFromAnswer(answer, ids), [answer, ids]);
  const hydrationKey = JSON.stringify(hydratedOrder);
  const [draft, setDraft] = useState(() => {
    const shuffled = shuffle(ids);
    if (ids.length > 1 && shuffled.join() === ids.join()) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    return { hydrationKey, order: hydratedOrder ?? shuffled };
  });
  const order = draft.hydrationKey === hydrationKey ? draft.order : hydratedOrder ?? draft.order;
  const setOrder = (next: string[]) => setDraft({ hydrationKey, order: next });
  const [dragId, setDragId] = useState<string | null>(null);
  // Tap-to-select fallback: the row picked up and waiting for its destination.
  const [selected, setSelected] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const { status, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const hasKey = Array.isArray(correctOrder) && correctOrder.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  const reveal = !recordOnly
    ? joinReveal(correctOrder.map((id, i) => [`${i + 1}. `, revealName(byId.get(id), items.findIndex((x) => x.id === id), "Mục")]))
    : undefined;

  // element = each POSITION/slot (index into `order`). buildAnswer must see
  // the order of the CURRENT interaction, not the render closure — reorder()
  // updates the ref before grading.
  const elementIds = useMemo(() => items.map((_, i) => String(i)), [items]);
  const orderRef = useRef(order);
  orderRef.current = order;
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => orderRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  const ordered = order.map((id) => byId.get(id)!).filter(Boolean);

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    // Compute `next` from the current render's `order` state (not a
    // functional setState updater) — the updater callback isn't guaranteed
    // to run synchronously, and calling instant.grade() from inside it would
    // risk double-firing side effects under StrictMode's double-invocation.
    const next = [...order];
    const from = next.indexOf(fromId);
    const to = next.indexOf(toId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    setOrder(next);
    onAnswerChange?.(next);
    orderRef.current = next;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    for (let i = lo; i <= hi; i++) {
      instant.grade(String(i), next[i] === correctOrder[i] ? "correct" : "incorrect");
    }
  };

  /**
   * Tap fallback for reordering. First tap picks a step up, the second tap says
   * where it goes — tapping the same step again puts it back down. It routes
   * through the very same `reorder()` the native drop uses, so grading,
   * `onAnswerChange` and the instant-feedback slots behave identically.
   */
  const tapRow = (id: string) => {
    if (locked) return;
    if (!selected) {
      setSelected(id);
      return;
    }
    if (selected === id) {
      setSelected(null);
      return;
    }
    reorder(selected, id);
    setSelected(null);
  };

  const check = () => {
    if (locked) return;
    if (recordOnly) {
      report(order, "incomplete");
      return;
    }
    const correct =
      order.length === correctOrder.length &&
      order.every((id, i) => id === correctOrder[i]);
    report(order, correct ? "correct" : "incorrect");
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div
        data-layout-region="ordering-items"
        data-display-layout={displayLayoutKey(layout)}
        className={layoutContainerClass(layout)}
        role="list"
        aria-label="Trình tự hiện tại"
      >
        {ordered.map((item, idx) => {
          const isOver = overId === item.id && dragId !== item.id;
          const rv = instant.reveal(String(idx));
          const chipState = rv === "correct" ? "correct" : rv === "incorrect" ? "wrong" : isOver ? "placed" : dragId === item.id || selected === item.id ? "selected" : "idle";
          return (
            <div key={item.id} role="listitem" className="flex min-w-0 items-stretch gap-2 sm:gap-3">
              {/* Drag source = shared module-scope `DraggableChip`. It is deliberately
                  layout-free: `layout={dragId !== item.id}` still flips true→false at
                  `dragstart`, and that projection teardown is itself what makes Chrome
                  cancel the drag (#533/#563/#569). The step loses its spring reorder
                  animation as an accepted trade-off. (Was a bare `//` comment in JSX
                  children position — it rendered as literal text in every step row.) */}
              <DraggableChip
                dragging={dragId === item.id}
                locked={locked}
                entrance={false}
                hoverScale={false}
                wrapperClassName="flex min-w-0 flex-1 flex-col"
                onDragStart={() => setDragId(item.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragId) setOverId(item.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) reorder(dragId, item.id);
                  setDragId(null);
                  setOverId(null);
                }}
                onClick={() => tapRow(item.id)}
                ariaLabel={item.text}
                className={cn(
                  `relative flex min-w-0 flex-1 items-center gap-2 ${
                    selected === item.id ? "ring-4 ring-teal-400 " : ""
                  }${
                    skin.chip?.(chipState, "primary") ??
                    `rounded-2xl border-4 px-3 py-3 sm:px-4 shadow-lg transition-colors
                    ${
                      rv === "correct"
                        ? "border-green-400 bg-green-50 "
                        : rv === "incorrect"
                          ? "border-red-400 bg-red-50 "
                          : isOver
                            ? "border-teal-400 bg-teal-50 "
                            : dragId === item.id
                              ? "border-teal-300  bg-white opacity-60"
                              : "border-white bg-white/70"
                    }`
                  }`,
                  // Ảnh lớn → khoá bán kính, tránh pill rounded-full phình bầu dục.
                  item.imageUrl && "rounded-3xl",
                )}
              >
                <div className={`flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full text-sm sm:text-base shadow ${skin.badge?.("primary") ?? "bg-teal-500 text-white font-black"}`}>
                  {idx + 1}
                </div>
                <div className={`min-w-0 flex items-center gap-2 text-sm sm:text-base ${skin.emphasis?.("neutral", "medium") ?? "text-slate-800 font-bold"}`}>
                  {item.imageUrl && (
                    // KHÔNG áp lưới ảnh tự động của rank/reorder (WEB08) ở đây:
                    // mũi tên `→` giữa các bước giả định dòng chảy tuyến tính,
                    // wrap thành lưới thì mũi tên cuối hàng chỉ ra ngoài.
                    // `shrink` để ảnh co theo bước hẹp thay vì tràn khỏi thẻ.
                    <ContentImage src={item.imageUrl} alt={item.text} className="min-w-0 shrink" />
                  )}
                  <RichTextValue value={item.text} />
                </div>
              </DraggableChip>
              {idx < ordered.length - 1 && (
                <span className={`flex items-center shrink-0 ${skin.accent?.("primary", "text") ?? "text-teal-400"}`}>
                  <ArrowRight className="size-6 sm:size-7" />
                </span>
              )}
            </div>
          );
        })}
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
              : "mt-6 w-full sm:w-auto px-8 py-3 rounded-full bg-teal-500 hover:bg-teal-600 text-white font-black text-base sm:text-lg shadow-lg transition-colors"
          }
        >
          Kiểm tra
        </motion.button>
      )}
      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-green-600 font-black text-lg">🎉 Đúng quy trình!</PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-red-500 font-bold text-base">
          Trình tự chưa đúng, thử lại nhé!
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
