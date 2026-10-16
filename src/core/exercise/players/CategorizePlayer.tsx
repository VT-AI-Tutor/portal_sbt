/**
 * P24 — Classification / "buckets".
 * Items sit in a tray. Click an item to select it, then click a category
 * bucket to drop it in (HTML5 drag also supported). "Kiểm tra" grades every
 * item against correctMappings (itemId → categoryId). Answer = Record<itemId, categoryId>.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, ContentImage, groupedMappingReveal, useGrading, useHydratedRecordAnswer, useInstantGrading, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { chipTrayClass, displayLayoutKey } from "@/core/exercise/display-layout";
import { plainTextFromAuthoredMath } from "@/core/math/plainTextFromAuthoredMath";
import { authoredGroupColor } from "./authoredGroupColor";
import { joinReveal, revealName } from "./answer-name";

export interface CategorizePlayerProps extends PlayerProps {
  categories: { id: string; label: string; imageUrl?: string; imageWidth?: string; color?: string }[];
  items: { id: string; text: string; imageUrl?: string; imageWidth?: string }[];
  /** itemId → categoryId */
  correctMappings: Record<string, string>;
}

/**
 * Bảng màu DỰ PHÒNG xoay theo VỊ TRÍ nhóm — chỉ chạy khi skin không khai
 * `dropZone`. Màu phân biệt nhóm theo NỘI DUNG đến từ `category.color` tác giả
 * khai (xem `authoredGroupColor`).
 */
const BUCKET_ACCENTS = [
  "border-fuchsia-300  bg-fuchsia-50 ",
  "border-amber-300  bg-amber-50 ",
  "border-emerald-300  bg-emerald-50 ",
  "border-sky-300  bg-sky-50 ",
  "border-violet-300  bg-violet-50 ",
];

export const CategorizePlayer: React.FC<CategorizePlayerProps> = ({
  categories,
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
  // itemId → categoryId (absent = still in tray). Khôi phục tại chỗ từ prop
  // `answer` do cha cấp (đúng Record player này emit) — không key-remount.
  const [placement, setPlacement] = useHydratedRecordAnswer(answer);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<string | null>(null);
  // Học sinh đang cầm một thẻ: MỌI nhóm đều là đích hợp lệ cùng lúc — player này
  // không theo dõi hover từng rổ như TwoBucketSort.
  const active = !!(selectedItem || dragItem);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || Object.keys(correctMappings ?? {}).length === 0;
  const elementIds = useMemo(() => items.map((it) => it.id), [items]);
  // buildAnswer must see the placement of the CURRENT interaction, not the
  // render closure — place() updates the ref before grading.
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
  // Lượt "Kiểm tra" trong player vừa chấm sai — tô đỏ các thẻ đặt sai nhóm.
  const errored = status === "error";
  const answerReveal = recordOnly
    ? null
    : // web-own: gộp theo nhóm (groupedMappingReveal). Khuôn mũi tên bên dưới là
      // đường lùi cho bài có thẻ không chữ — xem ghi chú tại helper ở shared.tsx.
      groupedMappingReveal({ groups: categories, items, correctMappings }) ??
      joinReveal(
        Object.entries(correctMappings).map(([itemId, categoryId]) => {
          const ii = items.findIndex((x) => x.id === itemId);
          const gi = categories.findIndex((g) => g.id === categoryId);
          return [revealName(items[ii], ii, "Thẻ"), " → ", revealName(categories[gi], gi, "Nhóm")];
        }),
      );

  const place = (itemId: string, categoryId: string | null) => {
    if (locked) return;
    const next = { ...placement };
    if (categoryId) next[itemId] = categoryId;
    else delete next[itemId];
    setPlacement(next);
    setSelectedItem(null);
    onAnswerChange?.(next);
    placementRef.current = next;
    // Đổi cách xếp sau khi bị chấm sai → xoá trạng thái sai để thử lại.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    if (!categoryId) {
      instant.clear(itemId);
    } else {
      instant.grade(itemId, next[itemId] === correctMappings[itemId] ? "correct" : "incorrect");
    }
  };

  const clickItem = (id: string) => {
    if (locked) return;
    setSelectedItem((cur) => (cur === id ? null : id));
  };

  const dropInBucket = (categoryId: string) => {
    if (locked) return;
    const id = dragItem ?? selectedItem;
    if (!id) return;
    place(id, categoryId);
    setDragItem(null);
  };

  const returnToTray = (itemId: string) => place(itemId, null);

  const grade = () => {
    if (locked) return;
    // Không có đáp án (hoặc tự đánh giá): chỉ ghi nhận, không chấm.
    if (recordOnly) {
      report(placement, "incomplete");
      return;
    }
    const allPlaced = items.every((it) => placement[it.id]);
    if (!allPlaced) {
      report(placement, "incomplete");
      return;
    }
    const correct = items.every((it) => placement[it.id] === correctMappings[it.id]);
    report(placement, correct ? "correct" : "incorrect");
  };

  useEffect(() => {
    if (submitted && status === "idle") grade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const trayItems = items.filter((it) => !placement[it.id]);
  // A tray made entirely of picture cards is a visual choice set. A responsive
  // grid keeps four workbook pictures balanced (2×2 on compact screens, one
  // row of four on desktop) instead of leaving a lonely final flex item.
  const pictureTray = items.length > 1 && items.every((it) => Boolean(it.imageUrl));

  const chip = (
    it: { id: string; text: string; imageUrl?: string; imageWidth?: string },
    opts?: { inBucket?: boolean; categoryId?: string },
  ) => {
    // Picture cards in the unsorted tray should remain drag targets, not grow
    // to their source scan dimensions. The tray is an interaction control, so
    // it uses compact cards even when the surrounding skin preserves natural
    // sizes for ordinary content images.
    const compactPictureCard = Boolean(it.imageUrl);
    const selected = selectedItem === it.id;
    const rv = instant.reveal(it.id);
    const ok = rv
      ? rv === "correct"
      : submitted && !!opts?.inBucket && placement[it.id] === correctMappings[it.id];
    // Wrong notation also after an in-player "Kiểm tra" (errored) — correct
    // placements stay uncolored while errored so retrying leaks no answers.
    const wrong = rv
      ? rv === "incorrect"
      : (submitted || errored) && !!opts?.inBucket && placement[it.id] !== correctMappings[it.id];
    const chipState = wrong
      ? "wrong"
      : ok
        ? "correct"
        : selected
          ? "selected"
          : opts?.inBucket
            ? "placed"
            : "idle";
    return (
      // Drag source = shared module-scope `DraggableChip`. It keeps every Framer
      // transform (`layout`, hover, entrance) off the draggable node — a transform
      // written on the source right after `dragstart` makes Chrome cancel the drag
      // (#533/#563/#569). Click-to-select still works: passing `onClick` renders
      // the inner node as a <button>.
      <DraggableChip
        key={it.id}
        wrapperClassName={compactPictureCard ? (pictureTray ? "w-full" : "w-52 sm:w-64 max-w-full") : undefined}
        dragging={dragItem === it.id}
        locked={locked}
        onDragStart={() => setDragItem(it.id)}
        onDragEnd={() => setDragItem(null)}
        onClick={() =>
          opts?.inBucket ? returnToTray(it.id) : clickItem(it.id)
        }
        className={
          "max-w-full min-w-0 break-words [overflow-wrap:anywhere] " +
          (skin.chip?.(chipState, "neutral") ??
          `${it.imageUrl ? "p-1.5 rounded-2xl" : "px-4 py-2 rounded-full"} border-4 font-bold text-sm sm:text-base transition-all
          ${
            wrong
              ? "bg-red-50  border-red-400 text-red-600"
              : ok
                ? "bg-green-50  border-green-400 text-green-700 "
                : selected
                  ? "bg-yellow-100  border-yellow-400 text-yellow-800  scale-105"
                  : "bg-white border-slate-200 text-slate-800 hover:border-sky-400 hover:bg-sky-50 "
          }`) +
          (compactPictureCard ? " w-full [&_img]:!max-h-32 sm:[&_img]:!max-h-40 [&_img]:!max-w-full [&_img]:mx-auto" : "")
        }
      >
        {it.imageUrl ? (
          <ContentImage
            src={it.imageUrl}
            alt={it.text}
            width={it.imageWidth}
            draggable={false}
            className={compactPictureCard ? "!max-h-32 sm:!max-h-40 !max-w-full mx-auto" : undefined}
          />
        ) : (
          <RichTextValue value={it.text} />
        )}
      </DraggableChip>
    );
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      {/* Tray */}
      <div className={`p-3 sm:p-4 mb-5 min-h-[64px] ${skin.panel?.("tray") ?? "bg-white/60 rounded-3xl border-4 border-white"}`}>
        <div
          data-layout-region="classification-tray"
          data-display-layout={displayLayoutKey(layout)}
          className={pictureTray ? "grid grid-cols-2 gap-3 lg:grid-cols-4" : chipTrayClass()}
          role="group"
          aria-label="Các thẻ chưa phân loại"
        >
          {trayItems.length === 0 ? (
            <span className={`italic px-2 py-1 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
              Đã sắp xếp hết các thẻ
            </span>
          ) : (
            trayItems.map((it) => chip(it))
          )}
        </div>
      </div>

      {/* Buckets: co giãn LẤP ĐẦY chiều rộng, KHÔNG phụ thuộc nội dung (Owner
          31/7). Bản cũ dùng `minmax(max-content,1fr)` + `overflow-x-auto` để ảnh
          tiêu đề nhóm không bị ép nhỏ — nhưng hệ quả là kéo chip vào thì rổ PHÌNH
          NGANG, chip cuối bị cắt ở mép phải và phải cuộn ngang mới thấy. Nay rổ
          chỉ được CAO lên: `min-w-0` để nội dung không đẩy cột, chip bên trong tự
          wrap xuống dòng. Ảnh tiêu đề nhóm co theo cột bằng `max-w-full` của
          ContentImage. Dùng flex-wrap: bề rộng breakpoint (1/2/3 rổ mỗi hàng) chỉ
          là NGƯỠNG WRAP, còn `grow` cho rổ tự nở LẤP ĐẦY hết chiều rộng hàng —
          hàng thiếu rổ (vd 2 rổ ở lg 3 cột) giãn ra full-width thay vì để trống,
          và không bao giờ vượt quá bề rộng (wrap + `min-w-0`, không cuộn ngang). */}
      <div className="flex flex-wrap gap-3 sm:gap-4">
        {categories.map((cat, ci) => {
          const inHere = items.filter((it) => placement[it.id] === cat.id);
          const zoneState = active ? "active" : inHere.length > 0 ? "filled" : "idle";
          // web-own (CHƯA upstream lên studio): màu tác giả khai thắng skin trên
          // khung rổ + tiêu đề nhóm. Copy đè từ studio gỡ mất import
          // authoredGroupColor → gãy biên dịch; ghép tay lại thay vì bỏ import.
          //
          // `activeZone` khi đang cầm thẻ: nhánh skin ở đây báo "thả được vào đây"
          // THUẦN bằng màu (không ring, không scale), nên màu tác giả đè lên là
          // mất sạch tín hiệu. Xem ghi chú ở authoredGroupColor.
          const authored = authoredGroupColor(cat.color);
          return (
            <div
              key={cat.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropInBucket(cat.id)}
              onClick={() => selectedItem && dropInBucket(cat.id)}
              // `min-w-0`: nội dung dài vẫn nong ô ra dù đã khai bề rộng. Không có
              // nó thì chip nhãn dài ("e. Làm thức ăn bị nhiễm bẩn") lại đẩy rổ
              // phình ngang như cũ.
              style={{ minWidth: 0, ...(active ? authored?.activeZone : authored?.zone) }}
              // `grow` + bề rộng breakpoint: bề rộng là ngưỡng wrap (1/2/3 rổ mỗi
              // hàng), `grow` cho rổ nở LẤP ĐẦY hết chiều rộng hàng — kể cả hàng
              // thiếu rổ — mà không vượt quá bề rộng container.
              className={
                `grow w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.6667rem)] ` +
                (skin.dropZone?.(zoneState)
                  ? `${skin.dropZone(zoneState)} min-h-[120px] ${active ? "cursor-pointer" : ""}`
                  : `rounded-3xl border-4 border-dashed p-3 sm:p-4 min-h-[120px] transition-all
                ${BUCKET_ACCENTS[ci % BUCKET_ACCENTS.length]}
                ${active ? "ring-2 ring-sky-300 cursor-pointer" : ""}`)
              }
            >
              <h3
                style={authored?.head}
                className={`mb-2 text-base sm:text-lg ${
                  authored
                    ? "rounded-2xl px-3 py-2 text-center font-black"
                    : (skin.emphasis?.("neutral", "strong") ?? "font-black text-slate-800")
                }`}
              >
                {cat.imageUrl ? (
                  <ContentImage src={cat.imageUrl} alt={cat.label} width={cat.imageWidth} draggable={false} />
                ) : (
                  <RichTextValue value={cat.label} />
                )}
              </h3>
              <div
                data-layout-region="classification-bucket-items"
                data-display-layout={displayLayoutKey(layout)}
                className={chipTrayClass()}
                role="group"
                aria-label={`Các thẻ trong nhóm ${plainTextFromAuthoredMath(cat.label)}`}
              >
                {inHere.map((it) => chip(it, { inBucket: true, categoryId: cat.id }))}
              </div>
            </div>
          );
        })}
      </div>

      <PlayerErrorFeedback show={errored && !submitted} />

      {/* Luồng cha chấm (parent) sở hữu verdict — không hiện nút tự chấm. */}
      {mode !== "parent" && !instant.active && !locked && !recordOnly && (
        <div className="flex justify-center mt-6">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={grade}
            className={
              skin.actionButton?.(true, "primary") ??
              "px-8 py-3 rounded-full border-4 border-sky-500 bg-sky-400 text-white font-black text-lg shadow-md hover:bg-sky-500 transition-colors"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}
    </PlayerShell>
  );
};
