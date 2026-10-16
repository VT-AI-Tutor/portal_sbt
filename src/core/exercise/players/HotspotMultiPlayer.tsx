/**
 * P10 — Hotspot / "multiple".
 * schema: hotspot · interactionType: "multiple"
 *
 * Click hotspots to toggle them on/off; selected ones get a highlighted ring
 * covering the hotspot's whole declared area (same geometry the reveal-correct-
 * on-lock rings use). Hit-testing is shape-aware (circle center+radius / rect top-left+size /
 * polygon — see hotspot-hit.ts). A "Kiểm tra" button grades via set-equality
 * against correctIds — or, with correctAnswer {count}, by selection COUNT alone
 * (any hotspots, "Tô màu 2 bông hoa").
 */
import React, { useMemo, useRef } from "react";
import { motion } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, useGrading, useInstantGrading, sameSet, type PlayerProps } from "./shared";
import { findHitHotspot, hotspotMarkerBox, type HotspotShape } from "./hotspot-hit";
import { restoredStringArray, useRestoredAnswerState } from "./answer-restore";
import { useSkin } from "@/core/exercise/skin";
import { useFieldResize } from "@/core/exercise/field-resize-context";
import { HotspotEditOverlay } from "./HotspotEditOverlay";
import { Check, X } from "lucide-react";
import {
  MARK_STROKE_RATIO,
  MISSED_MARK_OPACITY,
  hotspotMarkCenter,
  hotspotMarkSize,
  useHotspotContainerSize,
  type HotspotMarkKind,
} from "./hotspot-check-mark";

export type MultiHotspot = HotspotShape;

export interface HotspotMultiPlayerProps extends PlayerProps {
  imageUrl: string;
  imageAlt?: string;
  hotspots: MultiHotspot[];
  correctIds: string[];
  /**
   * correctAnswer = {count}: đúng khi chọn ĐỦ số vùng, bất kể vùng nào
   * ("Tô màu 2 bông hoa"). Loại trừ lẫn nhau với correctIds.
   */
  correctCount?: number;
  /**
   * `display.mark` của câu ("✓" / "✗", spec §5.13.3). Có thì vùng đã chọn vẽ DẤU
   * ở tâm vùng — ngay trong ô vuông in sẵn — thay cho vòng/khung + nền. Khi đã
   * có đúng/sai (câu có chấm), dấu theo kết quả: đúng ✓ xanh, sai ✗ đỏ; câu Không
   * chấm luôn vẽ dấu khai. Chế độ đếm (`correctCount`) bỏ qua prop này.
   * Không khai thì giữ vòng: câu "Khoanh tròn vào…" cần đúng cái vòng đó.
   */
  mark?: HotspotMarkKind | null;
}

export const HotspotMultiPlayer: React.FC<HotspotMultiPlayerProps> = ({
  imageUrl,
  imageAlt,
  hotspots,
  correctIds,
  correctCount,
  mark: declaredMark,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  // Studio edit preview only — null everywhere else. While geometry editing is
  // active the play click is suppressed (edit mode must not grade) and the
  // invisible hotspots are rendered as draggable dashed outlines.
  const editing = useFieldResize()?.onGeometry != null;
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Chế độ đếm không có đúng/sai từng vùng để dấu báo — bỏ dấu, giữ vòng.
  const countMode = correctIds.length === 0 && correctCount != null && correctCount > 0;
  const mark = countMode ? null : declaredMark;
  // Cỡ dấu theo pixel thật của vùng — chỉ đo khi câu có khai dấu.
  const containerSize = useHotspotContainerSize(containerRef, mark != null);
  // Kênh khôi phục: đáp án đã lưu (mảng hotspot id). Toạ độ click không nằm
  // trong emit (lossy có chủ đích) — ring vẽ theo hình học hotspot nên không cần.
  const [selected, setSelected] = useRestoredAnswerState<string[]>(restoredStringArray(answer));
  const { status, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || (correctIds.length === 0 && !countMode);
  // element = each hotspot.
  const elementIds = useMemo(() => hotspots.map((h) => h.id), [hotspots]);
  // buildAnswer must see the selection of the CURRENT interaction, not the
  // render closure — handleClick updates the ref before grading.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const instant = useInstantGrading({
    elementIds,
    // Câu chọn-một-tập: "xong" là khớp TẬP, không phải bấm qua hết
    // mọi phương án (xem ghi chú expectedIds trong useInstantGrading).
    expectedIds: correctIds,
    // Câu đếm ({count}): "xong" là chọn ĐỦ số vùng, vùng nào cũng được.
    expectedCount: countMode ? correctCount : undefined,
    instantFeedback,
    recordOnly,
    buildAnswer: () => selectedRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;

    // Shape-aware hit-test; overlapping hits toggle the nearest center.
    const best = findHitHotspot(hotspots, rx, ry);
    if (!best) return;

    const hitId = best.id;
    const deselecting = selected.includes(hitId);
    const next = deselecting
      ? selected.filter((id) => id !== hitId)
      : [...selected, hitId];
    setSelected(next);
    onAnswerChange?.(next);
    if (status === "error") onStatusChange?.("idle");
    selectedRef.current = next;
    if (next.includes(hitId)) {
      // Chế độ đếm: vùng nào cũng chấp nhận được — mỗi lượt chọn là "correct",
      // đúng/sai cả câu quyết định bằng SỐ LƯỢNG (expectedCount).
      instant.grade(hitId, countMode || correctIds.includes(hitId) ? "correct" : "incorrect");
    } else {
      instant.clear(hitId);
    }
  };

  const check = () => {
    if (locked || selected.length === 0) return;
    if (recordOnly) {
      report(selected, "incomplete");
      return;
    }
    const isCorrect = countMode ? selected.length === correctCount : sameSet(selected, correctIds);
    report(selected, isCorrect ? "correct" : "incorrect");
  };

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className={`overflow-hidden ${skin.panel?.("media") ?? "bg-white/60 rounded-3xl border-4 border-white shadow-lg"}`}>
        <div
          ref={containerRef}
          className={`relative select-none ${locked || editing ? "cursor-default" : "cursor-crosshair"}`}
          onClick={editing ? undefined : handleClick}
        >
          <img
            src={imageUrl}
            alt={imageAlt || "Hình minh họa bài tập"}
            className="w-full"
            draggable={false}
          />

          {editing && <HotspotEditOverlay shapes={hotspots} containerRef={containerRef} />}

          {hotspots.map((hs) => {
            // Ring covers the hotspot's declared area — circle, rect or polygon.
            const box = hotspotMarkerBox(hs);
            const on = selected.includes(hs.id);
            const rv = instant.reveal(hs.id);
            // Chế độ đếm: từng vùng KHÔNG có đúng/sai riêng nên bỏ qua verdict
            // per-element (rv luôn "correct" — chọn thừa vẫn hiện xanh nếu tin
            // rv). Xanh chỉ khi CẢ CÂU đang đúng (đủ số lượng); chọn thêm/bớt
            // làm lệch count thì quay về màu chọn thường; đỏ chỉ khi đã nộp mà
            // số lượng lệch. Cũng vì bỏ qua rv nên khoá tại chỗ (submitted bật
            // trên player đang sống) không bị map chấm cũ che màu.
            const countOk = countMode && selected.length === correctCount;
            const showCorrect = countMode
              ? on && countOk && (locked || status === "success")
              : rv
                ? rv === "correct"
                : locked && correctIds.includes(hs.id);
            const showWrong = countMode
              ? submitted && on && !countOk
              : rv
                ? rv === "incorrect"
                : submitted && on && !correctIds.includes(hs.id);
            // Câu đánh dấu — dấu là phần DUY NHẤT nhìn thấy, nên nó
            // gánh luôn màu đúng/sai. Chưa chọn thì không vẽ gì: ô in sẵn trên
            // ảnh đã là "ô trống". Câu "Không chấm" không có verdict nên dấu
            // giữ màu chọn ngay từ lúc bấm. Khoá bài rồi thì ô đúng mà học sinh
            // bỏ sót vẫn hiện dấu xanh (như vòng xanh ở lối vòng tròn), nhưng
            // mờ đi để không lẫn với dấu học sinh tự đánh.
            if (mark) {
              // Câu Không chấm vẫn có thể mang correctAnswer — đừng để nó lộ ra.
              const markCorrect = !recordOnly && showCorrect;
              const markWrong = !recordOnly && showWrong;
              const missed = !on && markCorrect;
              if (!on && !missed) return null;
              const size = hotspotMarkSize(hs, containerSize.w, containerSize.h);
              const center = hotspotMarkCenter(hs);
              // Có đúng/sai thì dấu theo kết quả: đúng ✓, sai ✗ — một hình cho
              // cả hai thì chỉ còn màu để phân biệt. Chưa có thì vẽ dấu câu khai.
              const glyph: HotspotMarkKind = markCorrect ? "check" : markWrong ? "cross" : mark;
              const Glyph = glyph === "cross" ? X : Check;
              return (
                <motion.div
                  key={hs.id}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: missed ? MISSED_MARK_OPACITY : 1 }}
                  transition={{ duration: 0.2 }}
                  // Chỉ có nét, không nền: không che gì của bản scan, nên khác
                  // vòng chọn ở dưới, dấu không cần mix-blend-multiply — blend
                  // thì đoạn nét đè lên viền ô in nhân ra đen, dấu đứt khúc.
                  className="absolute pointer-events-none flex items-center justify-center"
                  data-hotspot-marker={hs.id}
                  data-hotspot-mark={glyph}
                  data-hotspot-missed={missed || undefined}
                  style={{
                    left: `${Number((center.x * 100).toFixed(4))}%`,
                    top: `${Number((center.y * 100).toFixed(4))}%`,
                    width: size,
                    height: size,
                    x: "-50%",
                    y: "-50%",
                    color: markCorrect ? "#16a34a" : markWrong ? "#dc2626" : "#ea580c",
                  }}
                >
                  <Glyph
                    aria-hidden="true"
                    width={size}
                    height={size}
                    // viewBox lucide là 24 — nét tỉ lệ theo cạnh dấu.
                    strokeWidth={24 * MARK_STROKE_RATIO}
                  />
                </motion.div>
              );
            }
            return (
              <motion.div
                key={hs.id}
                animate={on ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                // ponytail: the marker sits ON the book scan, so it never uses
                // skin.marker() — those fills are opaque theme surfaces and hid
                // the printed text underneath (grid-of-letters questions became
                // unreadable). `mix-blend-multiply` keeps the ink showing
                // through the tint, so the marker reads as if printed *under*
                // the text. Idle is fully transparent — a hotspot the user has
                // not chosen must show nothing at all over the scan; the node
                // stays mounted (pointer-events-none, clicks are hit-tested on
                // the container) so its center anchoring keeps holding (#435).
                className="absolute pointer-events-none transition-colors border-4 mix-blend-multiply"
                data-hotspot-marker={hs.id}
                // Anchor via motion's x/y, NOT Tailwind translate classes: the
                // pop animation writes an inline `transform` that would clobber
                // a class-based translate (circle rings off by half a box).
                style={{
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                  aspectRatio: box.aspectRatio,
                  x: box.x,
                  y: box.y,
                  borderRadius: box.borderRadius,
                  clipPath: box.clipPath,
                  ...(showCorrect
                    ? { borderColor: "#22c55e", background: "rgba(134,239,172,0.45)" }
                    : showWrong
                      ? { borderColor: "#ef4444", background: "rgba(252,165,165,0.45)" }
                      : on
                        ? { borderColor: "#fb923c", background: "rgba(254,215,170,0.45)" }
                        : { borderColor: "transparent", background: "transparent" }),
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Nút tự-chấm chỉ ở gradeMode self — luồng parent-graded (thi) không thấy. */}
      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <div className="mt-5 flex justify-center">
          <motion.button
            type="button"
            whileHover={selected.length ? { scale: 1.05 } : undefined}
            whileTap={selected.length ? { scale: 0.94 } : undefined}
            onClick={check}
            disabled={selected.length === 0}
            className={
              skin.actionButton?.(selected.length > 0, "primary") ??
              `px-8 py-3 rounded-full border-4 font-black text-lg transition-all ${
                selected.length
                  ? "bg-orange-400 border-orange-500 text-white shadow-md hover:bg-orange-500"
                  : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
              }`
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-center text-green-600 font-black text-lg md:text-xl">
          Tuyệt vời! Đúng hết rồi! 🎉
        </PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-center text-red-500 font-black text-lg md:text-xl">
          Chưa đúng, kiểm tra lại nhé! 🤔
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
