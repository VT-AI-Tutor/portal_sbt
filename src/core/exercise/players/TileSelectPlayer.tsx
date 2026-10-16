/**
 * P07 — Tile select (Kahoot-style).
 * schema: single_choice · interactionType: "tile"
 * Supports `multiple` (checkbox + submit via correctIds) or single (radio via correctId).
 */
import React, { useMemo, useRef } from "react";
import { motion } from "motion/react";
import { PlayerShell, ExerciseImage, PlayerErrorFeedback, useGrading, useGradeMode, useInstantGrading, sameSet, type PlayerProps } from "./shared";
import { restoredStringArray, useRestoredAnswerState } from "./answer-restore";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { displayLayoutKey, isAuthoredLayout, layoutContainerClass } from "@/core/exercise/display-layout";

export interface TileOption {
  id: string;
  text?: string;
  imageUrl?: string;
}

export interface TileSelectPlayerProps extends PlayerProps {
  options: TileOption[];
  correctId: string;
  multiple?: boolean;
  correctIds?: string[];
}

/**
 * Chrome tile "joyful" (Kahoot) — chỉ dùng khi skin KHÔNG khai `optionCard`.
 * Đây là hình dạng cố ý của surface học sinh: tile to, chữ trắng lớn, bo tròn.
 */
const joyfulTileClass = (stateCls: string) =>
  `flex flex-col items-center justify-center gap-2 min-h-[96px] sm:min-h-[120px] p-4 rounded-3xl border-4 text-white font-bold text-lg sm:text-2xl text-center transition-all ${stateCls}`;

/**
 * WEB18 — prefix của surface studio/QA: thẻ nút CO GỌN THEO NỘI DUNG. Khoảng
 * đệm do `skin.optionCard` quyết định (studio: `px-4 py-2.5 text-sm`); ở đây chỉ
 * giữ sàn vùng chạm `min-h-11` (44px) để nút một từ vẫn dễ bấm mà không bị kéo
 * cao 96–120px như chrome joyful. Ô trong lưới vẫn giãn đều theo cột nên bố cục
 * lưới không đổi.
 */
const STUDIO_TILE_PREFIX =
  "flex min-h-11 min-w-0 flex-col items-center justify-center gap-2 text-center";

const TILE_COLORS = [
  { bg: "bg-red-400", hover: "hover:bg-red-500", border: "border-red-500" },
  { bg: "bg-blue-400", hover: "hover:bg-blue-500", border: "border-blue-500" },
  { bg: "bg-amber-400", hover: "hover:bg-amber-500", border: "border-amber-500" },
  { bg: "bg-green-400", hover: "hover:bg-green-500", border: "border-green-500" },
];

export const TileSelectPlayer: React.FC<TileSelectPlayerProps> = ({
  options,
  correctId,
  multiple = false,
  correctIds = [],
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  layout,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  const { revealCorrect } = useGradeMode();
  // Kênh khôi phục: single emit chuỗi id, multiple emit mảng id — coerce cả hai
  // về mảng (shape state nội bộ), không đổi shape emit.
  const [picked, setPicked] = useRestoredAnswerState<string[]>(
    typeof answer === "string" && answer.length > 0 ? [answer] : restoredStringArray(answer),
  );
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const hasKey = multiple
    ? Array.isArray(correctIds) && correctIds.length > 0
    : typeof correctId === "string" && correctId.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  const isCorrectId = (id: string) =>
    multiple ? correctIds.includes(id) : id === correctId;

  // Instant per-tile grading only applies to the `multiple` (checkbox) variant —
  // single-select already self-grades the whole question on click.
  const elementIds = useMemo(() => options.map((o) => o.id), [options]);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const instant = useInstantGrading({
    elementIds,
    // Câu chọn-một-tập: "xong" là khớp TẬP, không phải bấm qua hết
    // mọi phương án (xem ghi chú expectedIds trong useInstantGrading).
    expectedIds: correctIds,
    instantFeedback,
    recordOnly: recordOnly || !multiple,
    buildAnswer: () => pickedRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  // Lượt "Kiểm tra"/chọn gần nhất bị chấm sai (gradeMode self) — tô đỏ + báo lỗi.
  const errored = status === "error";
  const clearError = () => {
    setStatus("idle");
    onStatusChange?.("idle");
  };

  const handle = (id: string) => {
    if (locked) return;
    if (multiple) {
      // Button-driven multiple path: changing the picks clears a previous
      // wrong verdict so the pupil can retry (instant path re-reports itself).
      if (!instant.active && errored) clearError();
      // Compute `next` from the current render's state (not a functional
      // setState updater) — the updater callback is not guaranteed to run
      // synchronously here, which would leave the instant-grade call below
      // reading a stale/undefined value.
      const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
      setPicked(next);
      pickedRef.current = next;
      if (recordOnly) report(next, "incomplete");
      if (next.includes(id)) {
        instant.grade(id, isCorrectId(id) ? "correct" : "incorrect");
      } else {
        instant.clear(id);
      }
    } else {
      setPicked([id]);
      if (recordOnly) report(id, "incomplete");
      else report(id, id === correctId ? "correct" : "incorrect");
    }
  };

  const check = () => {
    if (locked || picked.length === 0) return;
    if (recordOnly) {
      report(picked, "incomplete");
      return;
    }
    report(picked, sameSet(picked, correctIds) ? "correct" : "incorrect");
  };

  // skin.presentation.bigTiles (surface học sinh): mặc định (không có
  // display.layout tác giả) là LƯỚI TILE TO 2 cột kiểu Kahoot như web, và tile
  // giữ nguyên chrome joyful full-size (không ép prefix hug-content). Cờ tắt
  // (studio QA) theo layoutContainerClass + tile gọn. Layout tác giả khai rõ
  // vẫn được tôn trọng ở cả hai chế độ.
  const bigTiles = skin.presentation?.bigTiles === true;
  const kahootGrid = bigTiles && !isAuthoredLayout(layout);

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div
        className={kahootGrid ? "grid grid-cols-2 gap-3 sm:gap-4" : layoutContainerClass(layout)}
        data-display-layout={kahootGrid ? "grid_2" : displayLayoutKey(layout)}
        role={multiple ? "group" : "radiogroup"}
        aria-label="Các lựa chọn dạng nút"
      >
        {options.map((opt, i) => {
          const color = TILE_COLORS[i % TILE_COLORS.length];
          const selected = picked.includes(opt.id);
          const rv = instant.reveal(opt.id);
          // revealCorrect === false (BUG-03 web): sau submit chỉ tô xanh ô đúng
          // NẾU học sinh đã chọn nó — ô đúng chưa chọn không được lộ đáp án.
          // Mặc định (undefined/true) giữ nguyên hành vi reveal đầy đủ.
          const showCorrect = rv
            ? rv === "correct"
            : !recordOnly &&
              (submitted || status === "success") &&
              isCorrectId(opt.id) &&
              (revealCorrect !== false || selected);
          // Wrong notation also right after an incorrect self-graded pick /
          // "Kiểm tra" (errored) — not only when the host pre-submits. The
          // correct answer stays hidden while errored so retrying is meaningful.
          const showWrong = rv
            ? rv === "incorrect"
            : !recordOnly && (submitted || errored) && selected && !isCorrectId(opt.id);
          const state = showCorrect
            ? "correct"
            : showWrong
              ? "wrong"
              : selected
                ? "selected"
                : "idle";
          const stateCls = showCorrect
            ? "bg-green-500 border-green-600 ring-4 ring-green-200"
            : showWrong
              ? "bg-red-500 border-red-600 ring-4 ring-red-200"
              : selected
                ? `${color.bg} ${color.border} ring-4 ring-white`
                : `${color.bg} ${color.border} ${!locked ? color.hover : ""}`;
          const skinCard = skin.optionCard?.(state, "primary");
          return (
            <motion.button
              key={opt.id}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={selected}
              whileHover={!locked ? { scale: 1.03 } : undefined}
              whileTap={!locked ? { scale: 0.96 } : undefined}
              onClick={() => handle(opt.id)}
              disabled={locked}
              // bigTiles: tile TO joyful (cao ≥96px, chữ trắng lớn, bo tròn to,
              // border-4, màu nền xoay vòng) là chrome riêng của web — không ép
              // prefix hug-content của studio đè lên. Cờ tắt giữ prefix studio.
              // Khi skin không khai `optionCard` thì KHÔNG ghép prefix vào chrome
              // joyful: hai lớp min-height cùng lúc sẽ phụ thuộc thứ tự CSS.
              className={
                bigTiles || !skinCard
                  ? skinCard ?? joyfulTileClass(stateCls)
                  : `${STUDIO_TILE_PREFIX} ${skinCard}`
              }
            >
              {opt.imageUrl && (
                <ExerciseImage variant="frame" src={opt.imageUrl} alt="" className="h-14 w-14" />
              )}
              <RichTextValue value={opt.text} />
            </motion.button>
          );
        })}
      </div>

      {/* Instant path already shows per-tile red — the uniform red line covers
          the button-fallback + single click-graded paths only. */}
      <PlayerErrorFeedback show={!instant.active && errored && !submitted} />

      {/* Nút tự-chấm chỉ ở gradeMode self — luồng parent-graded (thi) không thấy. */}
      {multiple && !instant.active && !locked && !recordOnly && mode !== "parent" && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={check}
          disabled={picked.length === 0}
          className={
            skin.actionButton?.(picked.length > 0, "primary")
              ? `mt-5 ${skin.actionButton(picked.length > 0, "primary")}`
              : `mt-5 px-8 py-3 rounded-full border-4 font-black text-base sm:text-lg transition-all
            ${
              picked.length === 0
                ? "bg-slate-100 border-slate-200 text-slate-500"
                : "bg-indigo-400 border-indigo-500 text-white hover:bg-indigo-500"
            }`
          }
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
  );
};
