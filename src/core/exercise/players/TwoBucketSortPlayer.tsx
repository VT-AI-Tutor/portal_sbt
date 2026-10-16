/**
 * P28 — Classification / "two_bucket".
 * schema: classification · interactionType: "two_bucket"
 *
 * Student drags items from a center tray into one of exactly two side-by-side
 * bucket columns using native HTML5 drag-and-drop. Each bucket collects any
 * number of items; dragging an item to the other bucket (or back to the tray)
 * moves it. "Kiểm tra" grades itemId → bucketId against correctMappings.
 * Answer = Record<itemId, bucketId>.
 *
 * TOUCH: native HTML5 drag never fires on iOS/iPadOS, so every placement is
 * also reachable by tapping — chạm thẻ trong khay để chọn, chạm rổ để đặt,
 * chạm thẻ đã đặt để trả về khay. Same grammar as Categorize/CardSort.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, ContentImage, groupedMappingReveal, useGrading, useHydratedRecordAnswer, useInstantGrading, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { chipTrayClass, displayLayoutKey } from "@/core/exercise/display-layout";
import { plainTextFromAuthoredMath } from "@/core/math/plainTextFromAuthoredMath";
import { authoredGroupColor } from "./authoredGroupColor";
import { joinReveal, revealName } from "./answer-name";

export interface TwoBucketSortPlayerProps extends PlayerProps {
  buckets: [
    { id: string; label: string; imageUrl?: string; imageWidth?: string; color?: string },
    { id: string; label: string; imageUrl?: string; imageWidth?: string; color?: string },
  ];
  items: { id: string; text: string; imageUrl?: string; imageWidth?: string }[];
  /** itemId → bucketId */
  correctMappings: Record<string, string>;
}

/**
 * Bảng màu DỰ PHÒNG theo VỊ TRÍ rổ (rổ 1 cam, rổ 2 tím) — chỉ còn chạy khi skin
 * không khai `dropZone`/`accent`. Skin học sinh (`playfulAccent`) khai cả hai
 * nên trên surface đó bảng này không bao giờ hiện; màu phân biệt hai nhóm giờ
 * đến từ `bucket.color` tác giả khai (xem `authoredGroupColor`).
 */
const BUCKET_THEME = [
  { border: "border-orange-200 ", bg: "bg-orange-50 ", head: "bg-orange-500", chip: "border-orange-300  bg-orange-100  text-orange-800 ", over: "border-orange-400 bg-orange-100 " },
  { border: "border-violet-200 ", bg: "bg-violet-50 ", head: "bg-violet-500", chip: "border-violet-300  bg-violet-100  text-violet-800 ", over: "border-violet-400 bg-violet-100 " },
];

export const TwoBucketSortPlayer: React.FC<TwoBucketSortPlayerProps> = ({
  buckets,
  items,
  correctMappings,
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
  // mappings: itemId → bucketId. Hydrated in place from the parent-supplied
  // `answer` (the exact Record shape this player reports) — no key-remount.
  const [mappings, setMappings] = useHydratedRecordAnswer(answer);
  const [dragId, setDragId] = useState<string | null>(null);
  // Tap-to-select fallback: the id waiting for a bucket tap (touch/keyboard).
  const [selected, setSelected] = useState<string | null>(null);
  const [overBucket, setOverBucket] = useState<string | null>(null);
  const { status, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || Object.keys(correctMappings ?? {}).length === 0;
  const elementIds = useMemo(() => items.map((it) => it.id), [items]);
  // buildAnswer must see the mappings of the CURRENT interaction, not the
  // render closure — dropTo/dropToTray update the ref before grading.
  const mappingsRef = useRef(mappings);
  mappingsRef.current = mappings;
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => mappingsRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  const answerReveal = recordOnly
    ? null
    : // web-own: gộp theo nhóm (groupedMappingReveal). Khuôn mũi tên bên dưới là
      // đường lùi cho bài có thẻ không chữ — xem ghi chú tại helper ở shared.tsx.
      groupedMappingReveal({ groups: buckets, items, correctMappings }) ??
      joinReveal(
        Object.entries(correctMappings).map(([itemId, bucketId]) => {
          const ii = items.findIndex((x) => x.id === itemId);
          const gi = buckets.findIndex((g) => g.id === bucketId);
          return [revealName(items[ii], ii, "Thẻ"), " → ", revealName(buckets[gi], gi, "Nhóm")];
        }),
      );

  const inBucket = (bucketId: string) =>
    Object.entries(mappings).filter(([, b]) => b === bucketId).map(([i]) => i);
  const unplaced = items.filter((i) => !mappings[i.id]);

  const commit = (next: Record<string, string>) => {
    setMappings(next);
    mappingsRef.current = next;
    onAnswerChange?.(next);
    if (status === "error") onStatusChange?.("idle");
  };

  const clearPending = () => {
    setDragId(null);
    setSelected(null);
    setOverBucket(null);
  };

  /**
   * Place `id` in a bucket. Both interactions land here: the native drag
   * (`dragId` on drop) and the tap fallback (`selected` on a bucket tap).
   */
  const moveToBucket = (id: string, bucketId: string) => {
    if (locked) return;
    const next = { ...mappings, [id]: bucketId };
    commit(next);
    instant.grade(id, next[id] === correctMappings[id] ? "correct" : "incorrect");
    clearPending();
  };

  const moveToTray = (id: string) => {
    if (locked || !mappings[id]) return;
    const next = { ...mappings };
    delete next[id];
    commit(next);
    instant.clear(id);
    clearPending();
  };

  const dropTo = (bucketId: string) => {
    const id = dragId ?? selected;
    if (!id) return;
    moveToBucket(id, bucketId);
  };

  const dropToTray = () => {
    const id = dragId ?? selected;
    if (!id) return;
    moveToTray(id);
  };

  /** Tray tap = pick up / put down; a tap on a placed chip returns it. */
  const tapChip = (id: string, placed: boolean) => {
    if (locked) return;
    if (placed) moveToTray(id);
    else setSelected((cur) => (cur === id ? null : id));
  };

  const check = () => {
    if (locked) return;
    if (recordOnly) {
      report(mappings, "incomplete");
      return;
    }
    const keys = Object.keys(correctMappings);
    const ok =
      keys.every((k) => mappings[k] === correctMappings[k]) &&
      Object.keys(mappings).length === keys.length;
    report(mappings, ok ? "correct" : "incorrect");
  };

  // The drag source is the shared module-scope `DraggableChip` — NOT a component
  // defined here. An inline component gets a new identity on every `setDragId`,
  // which remounts the chip during `dragstart` and makes Chrome cancel the drag
  // (the "card only greys out" bug — #533/#563, root-caused in #569).
  const chip = (
    id: string,
    text: string,
    imageUrl?: string,
    imageWidth?: string,
    theme?: string,
    verdict?: "correct" | "incorrect",
    placed?: boolean,
  ) => {
    const isSelected = selected === id;
    const fallbackTheme =
      verdict === "correct"
        ? "border-green-400 bg-green-50  text-green-700 "
        : verdict === "incorrect"
          ? "border-red-400 bg-red-50  text-red-600"
          : isSelected
            ? "border-yellow-400 bg-yellow-100  text-yellow-800 "
            : theme;
    return (
      <DraggableChip
        key={id}
        dragging={dragId === id}
        locked={locked}
        onDragStart={() => setDragId(id)}
        onDragEnd={() => { setDragId(null); setOverBucket(null); }}
        onClick={(e) => { e.stopPropagation(); tapChip(id, !!placed); }}
        ariaLabel={text}
        className={
          "max-w-full min-w-0 break-words [overflow-wrap:anywhere] " +
          (skin.chip?.(
            verdict === "correct"
              ? "correct"
              : verdict === "incorrect"
                ? "wrong"
                : isSelected
                  ? "selected"
                  : theme
                    ? "placed"
                    : "idle",
            "neutral",
          ) ??
          `${imageUrl ? "p-1.5" : "px-4 py-3"} rounded-2xl border-4 font-bold text-sm sm:text-base shadow-md transition-colors ${
            fallbackTheme ?? "border-white bg-slate-100 text-slate-800 hover:border-slate-200"
          }`)
        }
      >
        {imageUrl ? (
          <ContentImage src={imageUrl} alt={text} width={imageWidth} draggable={false} />
        ) : (
          <RichTextValue value={text} />
        )}
      </DraggableChip>
    );
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      {/* Center tray */}
      <div
        data-layout-region="classification-tray"
        data-display-layout={displayLayoutKey(layout)}
        role="group"
        aria-label="Các thẻ chưa phân loại"
        onDragOver={(e) => { if (!locked) e.preventDefault(); }}
        onDrop={dropToTray}
        className={`${chipTrayClass()} mb-6 min-h-[64px] p-3 transition-colors justify-center ${
          skin.panel?.("tray", dragId || selected ? "active" : "idle") ??
          `rounded-3xl border-4 border-dashed ${dragId || selected ? "border-amber-300  bg-amber-50/60" : "border-slate-200 bg-white/40"}`
        }`}
      >
        <AnimatePresence>
          {unplaced.map((it) => (
            chip(it.id, it.text, it.imageUrl, it.imageWidth)
          ))}
        </AnimatePresence>
        {unplaced.length === 0 && (
          <span className={`italic text-sm self-center px-2 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
            Đã phân loại hết rồi! 👍
          </span>
        )}
      </div>

      {/* Hai rổ cạnh nhau, CHIA ĐÔI cứng — chiều rộng không phụ thuộc nội dung
          (Owner 31/7, cùng lý do với CategorizePlayer): bản cũ
          `minmax(max-content,1fr)` + `overflow-x-auto` làm rổ phình ngang khi
          kéo chip vào, chip cuối bị cắt ở mép phải. Nay rổ chỉ CAO lên; ảnh
          trong rổ co theo cột bằng `max-w-full` của ContentImage. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {buckets.map((bucket, bi) => {
          const theme = BUCKET_THEME[bi];
          const placed = inBucket(bucket.id);
          const active = overBucket === bucket.id && !!dragId;
          // web-own (CHƯA upstream lên studio): màu tác giả khai thắng skin trên
          // KHUNG + THANH TIÊU ĐỀ (inline style đè class). Copy đè file này từ
          // studio sẽ gỡ mất import authoredGroupColor → gãy biên dịch; ghép tay
          // lại thay vì bỏ import.
          //
          // `activeZone` chứ KHÔNG phải `zone` khi đang nhắm tới: skin phân biệt
          // active/idle CHỈ bằng hai class màu (cả hai đều border-dashed), mà màu
          // tác giả đè đúng lên đó — không có nhánh này thì hai trạng thái chỉ còn
          // khác nhau mỗi scale-[1.02] và học sinh kéo thẻ tới không thấy rổ sáng
          // lên. Xem ghi chú ở authoredGroupColor.
          const authored = authoredGroupColor(bucket.color);
          return (
            <div
              key={bucket.id}
              onDragOver={(e) => { if (!locked) { e.preventDefault(); setOverBucket(bucket.id); } }}
              onDragLeave={() => setOverBucket((b) => (b === bucket.id ? null : b))}
              onDrop={() => dropTo(bucket.id)}
              onClick={() => { if (selected) moveToBucket(selected, bucket.id); }}
              // `min-w-0`: ô lưới mặc định `min-width:auto` nên nội dung dài vẫn
              // nong cột dù đã khai `1fr` — không có nó thì rổ lại phình ngang.
              style={{ minWidth: 0, ...(active ? authored?.activeZone : authored?.zone) }}
              className={`${
                skin.dropZone?.(active ? "active" : placed.length > 0 ? "filled" : "idle")
                  ? `${skin.dropZone(active ? "active" : placed.length > 0 ? "filled" : "idle")} overflow-hidden min-h-[160px]`
                  : `rounded-3xl border-4 overflow-hidden shadow-lg transition-all min-h-[160px] ${
                      active ? `${theme.over} scale-[1.02]` : `${theme.border} ${theme.bg}`
                    }`
              } ${selected ? "cursor-pointer ring-2 ring-amber-300" : ""}`}
            >
              <div
                style={authored?.head}
                className={`px-3 py-3 text-base sm:text-lg text-center ${
                  authored ? "font-black" : (skin.accent?.("primary", "fill") ?? `font-black ${theme.head} text-white`)
                }`}
              >
                {bucket.imageUrl ? (
                  <ContentImage src={bucket.imageUrl} alt={bucket.label} width={bucket.imageWidth} draggable={false} className="mx-auto" />
                ) : (
                  <RichTextValue value={bucket.label} />
                )}
              </div>
              <div
                data-layout-region="classification-bucket-items"
                data-display-layout={displayLayoutKey(layout)}
                className={`p-3 min-h-[90px] ${chipTrayClass()}`}
                role="group"
                aria-label={`Các thẻ trong nhóm ${plainTextFromAuthoredMath(bucket.label)}`}
              >
                <AnimatePresence>
                  {placed.map((itemId) => {
                    const it = items.find((x) => x.id === itemId);
                    return it
                      ? chip(itemId, it.text, it.imageUrl, it.imageWidth, theme.chip, instant.reveal(itemId), true)
                      : null;
                  })}
                </AnimatePresence>
                {placed.length === 0 && (
                  <span className={`italic text-sm text-center py-2 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
                    Kéo hoặc chạm để đặt thẻ vào đây
                  </span>
                )}
              </div>
            </div>
          );
        })}
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
              "px-8 py-3 rounded-full border-4 border-orange-500 bg-orange-400 text-white font-black text-lg shadow-md hover:bg-orange-500 transition-all"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-center text-green-600 font-black text-lg md:text-xl">
          Phân loại đúng hết! 🎉
        </PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-center text-red-500 font-black text-lg md:text-xl">
          Có thẻ xếp nhầm rồi, thử lại nhé! 🤔
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
