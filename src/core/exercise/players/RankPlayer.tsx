/**
 * P19 — Ordering / "rank".
 * schema: ordering · interactionType: "rank"
 *
 * Same drag mechanics as Reorder but framed as a ranking: rank #1 is highest.
 * Optional top/bottom labels frame the scale. Answer = ordered array of ids.
 *
 * TOUCH: native HTML5 drag never fires on iOS/iPadOS, so reordering is also
 * reachable by tapping — chạm thẻ để nhấc lên, chạm thẻ khác để thả vào
 * đúng vị trí đó. Both paths call the same `reorder(from, to)`.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { GripVertical, ChevronsUp, ChevronsDown } from "lucide-react";
import { MEDIA_ORDER_ITEM_MAX_HEIGHT, PlayerInlineFeedback, PlayerShell, ContentImage, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { cn } from "@/core/utils";
import { secureRandomInt } from "@/core/lib/security";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import {
  displayLayoutKey,
  imageChoiceGridClass,
  imageChoiceGridKey,
  layoutContainerClass,
} from "@/core/exercise/display-layout";
import { joinReveal, revealName } from "./answer-name";

export interface RankItem {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface RankPlayerProps extends PlayerProps {
  items: RankItem[];
  correctOrder: string[];
  topLabel?: string;
  bottomLabel?: string;
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

export const RankPlayer: React.FC<RankPlayerProps> = ({
  items,
  correctOrder,
  layout,
  topLabel = "Cao nhất",
  bottomLabel = "Thấp nhất",
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
    // Grade every slot between the old and new position — a splice shifts
    // all of them, not just the moved item.
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

  const n = ordered.length;
  // WEB08 — thẻ CÓ ẢNH thì `list` (một thẻ mỗi hàng) luôn đổi thành lưới
  // count-aware, cùng lưới `imageChoiceGridClass` của image-choice (Owner 30/7)
  // nên 4 thẻ ra 2×2 chứ không 3+1.
  //
  // Áp cho CẢ `list` do tác giả khai, không chỉ fallback của manifest: `list`
  // nghĩa là "mỗi hàng một thẻ", mà thẻ-là-ảnh thì một hàng ăn trọn màn hình —
  // ý đồ tác giả không thể tôn trọng theo nghĩa đen. Nội dung nhập thật khai
  // `list` tường minh rất nhiều (xem evo-books-app: 3 lần vá WEB08 đều vì lý do
  // này), nên gác theo `isAuthoredLayout` sẽ không chữa được ca thật.
  //
  // Layout NGANG tác giả khai (`grid_2/3/4`, `inline`) vẫn được tôn trọng
  // nguyên vẹn — chỉ `list` bị thay.
  const autoImageGrid = ordered.some((item) => item.imageUrl) && displayLayoutKey(layout) === "list";
  // Layout ngang tác giả khai giữ nguyên BỐ CỤC, nhưng phải hạ CỠ ẢNH: xếp
  // ngang mà ảnh cao 22rem thì mỗi thẻ vẫn ăn trọn một hàng. Xem
  // `MEDIA_ORDER_ITEM_MAX_HEIGHT` (ca `12773888/bai23` câu 5 ở ReorderList —
  // hai player này dùng chung luật WEB08 nên sửa thì sửa cả hai).
  const itemImageMaxHeight =
    !autoImageGrid && ordered.some((item) => item.imageUrl)
      ? MEDIA_ORDER_ITEM_MAX_HEIGHT
      : undefined;

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div className={`mb-2 flex items-center gap-2 text-sm sm:text-base ${skin.emphasis?.("primary", "strong") ?? "text-amber-600 font-black"}`}>
        <ChevronsUp className="size-5" /> {topLabel}
      </div>

      <div
        data-layout-region="ordering-items"
        data-display-layout={autoImageGrid ? imageChoiceGridKey(n) : displayLayoutKey(layout)}
        className={`${autoImageGrid ? imageChoiceGridClass(n) : layoutContainerClass(layout)} md:gap-4`}
        role="list"
        aria-label="Thứ hạng hiện tại"
      >
        {ordered.map((item, idx) => {
          const isOver = overId === item.id && dragId !== item.id;
          const rank = idx + 1;
          const rankColor =
            skin.badge?.("primary") ??
            (rank === 1 ? "bg-amber-500" : rank === 2 ? "bg-amber-400" : "bg-slate-400");
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
                  selected === item.id ? "ring-4 ring-amber-400 " : ""
                }${
                  skin.chip?.(chipState, "primary") ??
                  `rounded-2xl border-4 p-3 sm:p-4 shadow-lg transition-colors
                  ${
                    rv === "correct"
                      ? "border-green-400 bg-green-50 "
                      : rv === "incorrect"
                        ? "border-red-400 bg-red-50 "
                        : isOver
                          ? "border-amber-400 bg-amber-50 "
                          : dragId === item.id
                            ? "border-amber-300  bg-white opacity-60"
                            : "border-white bg-white/70"
                  }`
                }`,
                // Ảnh lớn → khoá bán kính, tránh pill rounded-full phình bầu dục.
                item.imageUrl && "rounded-3xl",
              )}
            >
              <span className={`shrink-0 text-slate-500 transition-colors ${skin.accent?.("primary", "text") ?? "group-hover:text-amber-400"}`}>
                <GripVertical className="size-6" />
              </span>
              <div
                className={`flex shrink-0 items-center justify-center rounded-2xl px-3 size-10 sm:size-12 text-base sm:text-lg shadow-md ${skin.badge?.("primary") ? "" : "font-black text-white"} ${rankColor}`}
              >
                #{rank}
              </div>
              <div className={`flex-1 min-w-0 flex items-center gap-2 text-sm sm:text-base md:text-lg ${skin.emphasis?.("neutral", "medium") ?? "text-slate-800 font-bold"}`}>
                {item.imageUrl && (
                  // `shrink` ghi đè `shrink-0` của ContentImage qua twMerge: ô
                  // lưới hẹp hơn cột đầy, ảnh phải co theo ô thay vì tràn ra
                  // khỏi thẻ. KHÔNG hạ trần cao ở đây — trần 22rem là quyết
                  // định 31/7 chống hồi quy "ảnh quá bé"; bề rộng ô mới là ràng
                  // buộc cắn (scan trung vị 660×340 trong ô ~380px chỉ còn cao
                  // ~195px).
                  <ContentImage
                    src={item.imageUrl}
                    alt={item.text}
                    className="min-w-0 shrink"
                    maxHeight={itemImageMaxHeight}
                  />
                )}
                <RichTextValue value={item.text} />
              </div>
            </DraggableChip>
          );
        })}
      </div>

      {n > 0 && (
        <div className={`mt-2 flex items-center gap-2 text-sm sm:text-base ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-black"}`}>
          <ChevronsDown className="size-5" /> {bottomLabel}
        </div>
      )}

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
              : "mt-6 w-full sm:w-auto px-8 py-3 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-black text-base sm:text-lg shadow-lg transition-colors"
          }
        >
          Kiểm tra
        </motion.button>
      )}
      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-green-600 font-black text-lg">🎉 Xếp hạng chuẩn!</PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-red-500 font-bold text-base">
          Thứ hạng chưa đúng, thử lại nhé!
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
