/**
 * P18 — Ordering / "list".
 * schema: ordering · interactionType: "list"
 *
 * Vertical list of draggable cards. Drag to reorder; "Kiểm tra" grades an
 * exact sequence match against `correctOrder`. Answer = ordered array of ids.
 *
 * TOUCH: native HTML5 drag never fires on iOS/iPadOS, so reordering is also
 * reachable by tapping — chạm thẻ để nhấc lên, chạm thẻ khác để thả vào
 * đúng vị trí đó. Both paths call the same `reorder(from, to)`.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { GripVertical } from "lucide-react";
import { MEDIA_ORDER_ITEM_MAX_HEIGHT, PlayerInlineFeedback, PlayerShell, ContentImage, useAvailableHeight, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { cn } from "@/core/utils";
import { secureRandomInt } from "@/core/lib/security";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import {
  displayLayoutKey,
  imageChoiceGridClass,
  imageChoiceGridColumns,
  imageChoiceGridKey,
  layoutContainerClass,
} from "@/core/exercise/display-layout";
import { joinReveal, revealName } from "./answer-name";

export interface ReorderItem {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface ReorderListPlayerProps extends PlayerProps {
  items: ReorderItem[];
  correctOrder: string[];
  /**
   * Authored per-book display order (item ids). When present and valid it sets
   * the INITIAL order the student sees — so the digital question reproduces the
   * printed page instead of shuffling randomly. Absent → shuffle as before.
   */
  displayOrder?: string[];
}

/**
 * Resolve the initial visible order. With a valid authored `displayOrder`, keep
 * its ids (in order, de-duplicated) and append any item it forgot, so the result
 * always covers every item exactly once. Without one, shuffle — guaranteeing a
 * different order than the answer when possible.
 */
function initialOrder(ids: string[], displayOrder: string[] | undefined): string[] {
  if (Array.isArray(displayOrder) && displayOrder.length > 0) {
    const idSet = new Set(ids);
    const seen = new Set<string>();
    const resolved: string[] = [];
    for (const id of displayOrder) {
      if (idSet.has(id) && !seen.has(id)) {
        seen.add(id);
        resolved.push(id);
      }
    }
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        resolved.push(id);
      }
    }
    return resolved;
  }
  const shuffled = shuffle(ids);
  if (ids.length > 1 && shuffled.join() === ids.join()) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
}

/**
 * Parse the parent-supplied `answer` (ordered id array — the exact shape this
 * player reports) into a full order: keep known ids in their answered order,
 * then append any missing item so the list always covers every item exactly
 * once. Returns null when the value is not a usable answer (wrong shape or no
 * recognizable id) so the caller falls back to its normal initial order.
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

/** Deterministic-ish shuffle that guarantees a different order when possible. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ReorderListPlayer: React.FC<ReorderListPlayerProps> = ({
  items,
  correctOrder,
  displayOrder,
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
  const [draft, setDraft] = useState(() => ({
    hydrationKey,
    order: hydratedOrder ?? initialOrder(ids, displayOrder),
  }));
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
   * Tap fallback for reordering. First tap picks a row up, the second tap says
   * where it goes — tapping the same row again puts it back down. It routes
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

  // Xem RankPlayer — cùng luật WEB08: thẻ có ảnh thì `list` (kể cả `list` do
  // tác giả khai) đổi thành lưới count-aware; layout ngang tác giả khai giữ nguyên.
  const autoImageGrid = ordered.some((item) => item.imageUrl) && displayLayoutKey(layout) === "list";

  /**
   * VỪA MÀN: ảnh của thẻ co theo chỗ TRỐNG THẬT còn lại, không theo số cứng.
   *
   * Đo vùng cuộn của host rồi chia đều cho số hàng: đề bài dài ra thì phần đo
   * được tự nhỏ đi và ảnh co theo, không phải chỉnh tay từng câu (Owner 8/8).
   * Chưa đo được (render đầu / jsdom) thì trả null → giữ nguyên trần 22rem cũ.
   */
  const gridRef = useRef<HTMLDivElement>(null);
  const availableHeight = useAvailableHeight(gridRef);
  const gridColumns = autoImageGrid ? imageChoiceGridColumns(ordered.length) : 1;
  const hasItemImages = ordered.some((item) => item.imageUrl);
  const imageMaxHeight = React.useMemo(() => {
    if (!hasItemImages) return undefined;
    // Bố cục KHÔNG phải `list` (ca `12773888/bai23` câu 5: tác giả khai
    // `inline`) trước đây chẳng có trần nào — ảnh giữ cỡ tự nhiên, ba thẻ cao
    // 361/341/385px, nội dung 1255px trong khung 715px = 1,76 màn cho vỏn vẹn
    // ba bước. Owner 10/8: "chỉ cần xử lý cho size ảnh nhỏ đi là được" — nên
    // chỉ hạ CỠ ẢNH, giữ nguyên bố cục tác giả khai.
    //
    // Dùng trần cố định thay vì đo: xem `MEDIA_ORDER_ITEM_MAX_HEIGHT`.
    if (!autoImageGrid) return MEDIA_ORDER_ITEM_MAX_HEIGHT;
    if (availableHeight === null) return undefined;
    const rows = Math.ceil(ordered.length / gridColumns);
    // Vỏ thẻ (padding + viền + tay cầm/số khi xếp ngang) ~40px, khe giữa hàng 16px.
    const perRow = (availableHeight - (rows - 1) * 16) / rows;
    const px = Math.round(perRow - 40);
    // Sàn 96px để ảnh không nhỏ đến mức vô nghĩa; trần 352px = trần item cũ.
    return `${Math.min(352, Math.max(96, px))}px`;
  }, [hasItemImages, autoImageGrid, availableHeight, ordered.length, gridColumns]);

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div
        ref={gridRef}
        data-layout-region="ordering-items"
        data-display-layout={autoImageGrid ? imageChoiceGridKey(ordered.length) : displayLayoutKey(layout)}
        className={`${autoImageGrid ? imageChoiceGridClass(ordered.length) : layoutContainerClass(layout)} md:gap-4`}
        role="list"
        aria-label="Thứ tự hiện tại"
      >
        {ordered.map((item, idx) => {
          const isOver = overId === item.id && dragId !== item.id;
          const rv = instant.reveal(String(idx));
          const chipState = rv === "correct" ? "correct" : rv === "incorrect" ? "wrong" : isOver ? "placed" : dragId === item.id || selected === item.id ? "selected" : "idle";
          return (
            // Drag source = shared module-scope `DraggableChip`. It is deliberately
            // layout-free: `layout={dragId !== item.id}` still flips true→false at
            // `dragstart`, and that projection teardown is itself what makes Chrome
            // cancel the drag (#533/#563/#569). The row loses its spring reorder
            // animation as an accepted trade-off.
            <DraggableChip
              key={item.id}
              role="listitem"
              dragging={dragId === item.id}
              locked={locked}
              entrance={false}
              hoverScale={false}
              wrapperClassName="flex flex-col"
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
                `group flex items-center gap-3 sm:gap-4 ${
                  selected === item.id ? "ring-4 ring-purple-400 " : ""
                }${
                  skin.chip?.(chipState, "secondary") ??
                  `rounded-2xl border-4 p-3 sm:p-4 shadow-lg transition-colors
                  ${
                    rv === "correct"
                      ? "border-green-400 bg-green-50 "
                      : rv === "incorrect"
                        ? "border-red-400 bg-red-50 "
                        : isOver
                          ? "border-purple-400 bg-purple-50 "
                          : dragId === item.id
                            ? "border-purple-300  bg-white opacity-60"
                            : "border-white bg-white/70"
                  }`
                }`,
                // Ảnh lớn → khoá bán kính, tránh pill rounded-full phình bầu dục.
                item.imageUrl && "rounded-3xl",
              )}
            >
              <span className={`shrink-0 text-slate-500 transition-colors ${skin.accent?.("secondary", "text") ?? "group-hover:text-purple-400"}`}>
                <GripVertical className="size-6" />
              </span>
              <div className={`flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full text-base sm:text-lg shadow-md ${skin.badge?.("secondary") ?? "bg-purple-500 text-white font-black"}`}>
                {idx + 1}
              </div>
              <div className={`flex-1 min-w-0 flex items-center gap-2 text-sm sm:text-base md:text-lg ${skin.emphasis?.("neutral", "medium") ?? "text-slate-800 font-bold"}`}>
                {item.imageUrl && (
                  // Xem RankPlayer: `shrink` để ảnh co theo ô lưới; trần cao
                  // giữ nguyên 22rem.
                  <ContentImage
                    src={item.imageUrl}
                    alt={item.text}
                    className="min-w-0 shrink"
                    maxHeight={imageMaxHeight}
                  />
                )}
                <RichTextValue value={item.text} />
              </div>
            </DraggableChip>
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
            skin.actionButton?.(true, "secondary")
              ? `mt-6 w-full sm:w-auto ${skin.actionButton(true, "secondary")}`
              : "mt-6 w-full sm:w-auto px-8 py-3 rounded-full bg-purple-500 hover:bg-purple-600 text-white font-black text-base sm:text-lg shadow-lg transition-colors"
          }
        >
          Kiểm tra
        </motion.button>
      )}
      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-green-600 font-black text-lg">🎉 Chính xác!</PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-red-500 font-bold text-base">
          Chưa đúng thứ tự, thử lại nhé!
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
