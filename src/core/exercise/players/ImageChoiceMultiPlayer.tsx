/**
 * P06 — Multiple choice / image grid.
 * schema: multiple_choice · interactionType: "image"
 */
import React, { useMemo, useRef } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, useGrading, useGradeMode, useInstantGrading, sameSet, type PlayerProps } from "./shared";
import { restoredStringArray, useRestoredAnswerState } from "./answer-restore";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { displayLayoutKey, imageChoiceGridClass, imageChoiceGridKey, isAuthoredLayout, layoutContainerClass } from "@/core/exercise/display-layout";

export interface ImageChoiceOption {
  id: string;
  /** Vắng khi phương án chưa có ảnh — render placeholder, KHÔNG `<img src="">`. */
  imageUrl?: string;
  text?: string;
}

export interface ImageChoiceMultiPlayerProps extends PlayerProps {
  options: ImageChoiceOption[];
  correctIds: string[];
}

export const ImageChoiceMultiPlayer: React.FC<ImageChoiceMultiPlayerProps> = ({
  options,
  correctIds,
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
  // Kênh khôi phục: đáp án đã lưu (mảng option id) hydrate lại lựa chọn.
  const [picked, setPicked] = useRestoredAnswerState<string[]>(restoredStringArray(answer));
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const hasKey = Array.isArray(correctIds) && correctIds.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  const elementIds = useMemo(() => options.map((o) => o.id), [options]);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const instant = useInstantGrading({
    elementIds,
    // Câu chọn-một-tập: "xong" là khớp TẬP, không phải bấm qua hết
    // mọi phương án (xem ghi chú expectedIds trong useInstantGrading).
    expectedIds: correctIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => pickedRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  // Lượt "Kiểm tra" gần nhất bị chấm sai (gradeMode self) — tô đỏ + báo lỗi.
  const errored = status === "error";
  const clearError = () => {
    setStatus("idle");
    onStatusChange?.("idle");
  };

  const toggle = (id: string) => {
    if (locked) return;
    // Button-driven path: changing the picks clears a previous wrong verdict
    // so the pupil can retry (instant path re-reports itself).
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
      instant.grade(id, correctIds.includes(id) ? "correct" : "incorrect");
    } else {
      instant.clear(id);
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

  // Mặc định (tác giả KHÔNG khai display.layout): lưới thẻ vuông count-aware
  // của web (Owner 30/7) — xem imageChoiceGridClass. Layout tác giả khai rõ thắng.
  const authored = isAuthoredLayout(layout);

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div
        className={`${authored ? layoutContainerClass(layout) : `${imageChoiceGridClass(options.length)} mx-auto max-w-2xl`} min-w-0`}
        data-display-layout={authored ? displayLayoutKey(layout) : imageChoiceGridKey(options.length)}
        role="group"
        aria-label="Các lựa chọn bằng hình ảnh"
      >
        {options.map((opt) => {
          const selected = picked.includes(opt.id);
          const rv = instant.reveal(opt.id);
          // revealCorrect === false (BUG-03 web): sau submit chỉ tô xanh ô đúng
          // NẾU học sinh đã chọn nó — ô đúng chưa chọn không được lộ đáp án.
          // Mặc định (undefined/true) giữ nguyên hành vi reveal đầy đủ.
          const showCorrect = rv
            ? rv === "correct"
            : !recordOnly &&
              (submitted || status === "success") &&
              correctIds.includes(opt.id) &&
              (revealCorrect !== false || selected);
          // Wrong notation also after an in-player "Kiểm tra" (errored) — not
          // only when the host pre-submits. Correct answers stay hidden while
          // errored so the pupil can retry without the answer being leaked.
          const showWrong = rv
            ? rv === "incorrect"
            : !recordOnly && (submitted || errored) && selected && !correctIds.includes(opt.id);
          const state = showCorrect
            ? "correct"
            : showWrong
              ? "wrong"
              : selected
                ? "selected"
                : "idle";
          return (
            <motion.button
              key={opt.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              tabIndex={locked ? -1 : 0}
              whileHover={!locked ? { scale: 1.04 } : undefined}
              whileTap={!locked ? { scale: 0.95 } : undefined}
              onClick={() => toggle(opt.id)}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  toggle(opt.id);
                }
              }}
              disabled={locked}
              className={`relative min-w-0 max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2 ${
                skin.optionCard?.(state, "secondary") ??
                `flex flex-col items-center gap-2 p-3 rounded-2xl border-4 transition-all
                ${
                  showCorrect
                    ? "bg-green-50  border-green-400"
                    : showWrong
                      ? "bg-red-50  border-red-400"
                      : selected
                        ? "bg-fuchsia-50  border-fuchsia-400"
                        : "bg-white border-slate-200 hover:border-fuchsia-300  hover:bg-fuchsia-50 "
                }`
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute top-2 right-2 z-10 flex items-center justify-center w-6 h-6 rounded-lg text-white transition-all ${
                  skin.marker?.(selected ? "filled" : "idle") ??
                  `border-4 ${selected ? "bg-fuchsia-400 border-fuchsia-400 text-white" : "bg-white border-slate-200 text-transparent"}`
                }`}
              >
                {selected && "✓"}
              </span>
              {/* Ảnh + nhãn nằm trong MỘT khối dọc do player sở hữu.
                  `skin.optionCard` trả về TOÀN BỘ className (kể cả layout) và
                  thay thế hẳn fallback — studioSkin trả `flex items-center`
                  (hàng ngang), nên nếu ảnh và chữ là con trực tiếp của nút thì
                  ảnh `w-full` chiếm hết hàng và ép chữ tràn ra ngoài thẻ, chen
                  sang cột kế bên (issue #815). Bọc lại một lớp thì layout không
                  còn phụ thuộc skin, và token dùng chung vẫn nguyên vẹn cho các
                  player dạng hàng ngang (pill, chấm Likert, ô bảng). */}
              <span className="flex w-full min-w-0 flex-col items-center gap-2 text-center">
                {/* Hộp ảnh CAO CỐ ĐỊNH + object-contain — xem ghi chú ở
                    ImageChoiceSinglePlayer: chặn ảnh phình theo bề rộng ô lưới. */}
                <span className="flex h-40 w-full items-center justify-center sm:h-44">
                  {/* Phương án chưa có ảnh: báo thẳng, KHÔNG render `<img src="">`
                      (React log lỗi mỗi phương án + trình duyệt tải lại trang). */}
                  {opt.imageUrl ? (
                    <img
                      src={opt.imageUrl}
                      alt={opt.text ?? ""}
                      className="max-h-full max-w-full object-contain rounded-xl"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center rounded-xl border-4 border-dashed border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 sm:text-sm">
                      Chưa có ảnh
                    </span>
                  )}
                </span>
                {opt.text && (
                  <span className={`w-full min-w-0 break-words text-sm sm:text-base text-center ${skin.emphasis?.("neutral", "medium") ?? "font-bold text-slate-800"}`}>
                    <RichTextValue value={opt.text} />
                  </span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Instant path already shows per-image red — the uniform red line covers
          the button-fallback path only. */}
      <PlayerErrorFeedback show={!instant.active && errored && !submitted} />

      {/* Nút tự-chấm chỉ ở gradeMode self — luồng parent-graded (thi) không thấy. */}
      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={check}
          disabled={picked.length === 0}
          className={
            skin.actionButton?.(picked.length > 0, "secondary")
              ? `mt-5 ${skin.actionButton(picked.length > 0, "secondary")}`
              : `mt-5 px-8 py-3 rounded-full border-4 font-black text-base sm:text-lg transition-all
            ${
              picked.length === 0
                ? "bg-slate-100 border-slate-200 text-slate-500"
                : "bg-fuchsia-400 border-fuchsia-500 text-white hover:bg-fuchsia-500"
            }`
          }
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
  );
};
