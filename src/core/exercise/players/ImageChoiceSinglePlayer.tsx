/**
 * P05 — Single choice / image grid.
 * schema: single_choice · interactionType: "image"
 */
import React from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, useGrading, useGradeMode, type PlayerProps } from "./shared";
import { useRestoredAnswerState } from "./answer-restore";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { displayLayoutKey, imageChoiceGridClass, imageChoiceGridKey, isAuthoredLayout, layoutContainerClass } from "@/core/exercise/display-layout";

export interface ImageChoiceOption {
  id: string;
  /** Vắng khi phương án chưa có ảnh — render placeholder, KHÔNG `<img src="">`. */
  imageUrl?: string;
  text?: string;
}

export interface ImageChoiceSinglePlayerProps extends PlayerProps {
  options: ImageChoiceOption[];
  correctId: string;
}

export const ImageChoiceSinglePlayer: React.FC<ImageChoiceSinglePlayerProps> = ({
  options,
  correctId,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  layout,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  const { revealCorrect } = useGradeMode();
  // Kênh khôi phục: đáp án đã lưu (chuỗi option id) hydrate lại lựa chọn.
  const [picked, setPicked] = useRestoredAnswerState<string | null>(
    typeof answer === "string" && answer.length > 0 ? answer : null,
  );
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const hasKey = typeof correctId === "string" && correctId.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  const locked = submitted || status === "success";

  const select = (id: string) => {
    if (locked) return;
    setPicked(id);
    if (recordOnly) report(id, "incomplete");
    else report(id, id === correctId ? "correct" : "incorrect");
  };

  // Mặc định (tác giả KHÔNG khai display.layout): lưới thẻ vuông count-aware
  // của web (Owner 30/7) — xem imageChoiceGridClass. Layout tác giả khai rõ thắng.
  const authored = isAuthoredLayout(layout);

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div
        className={`${authored ? layoutContainerClass(layout) : `${imageChoiceGridClass(options.length)} mx-auto max-w-2xl`} min-w-0`}
        data-display-layout={authored ? displayLayoutKey(layout) : imageChoiceGridKey(options.length)}
        role="radiogroup"
        aria-label="Các lựa chọn bằng hình ảnh"
      >
        {options.map((opt) => {
          const selected = picked === opt.id;
          // revealCorrect === false (BUG-03 web): sau submit chỉ tô xanh ô đúng
          // NẾU học sinh đã chọn nó — ô đúng chưa chọn không được lộ đáp án.
          const showCorrect =
            !recordOnly &&
            (submitted || status === "success") &&
            opt.id === correctId &&
            (revealCorrect !== false || selected);
          // Wrong notation also right after an incorrect self-graded pick
          // (status "error") — not only when the host pre-submits. A new pick
          // re-reports and overwrites the status; the correct answer stays
          // hidden while errored so retrying is still meaningful.
          const showWrong = !recordOnly && (submitted || status === "error") && selected && opt.id !== correctId;
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
              role="radio"
              aria-checked={selected}
              whileHover={!locked ? { scale: 1.04 } : undefined}
              whileTap={!locked ? { scale: 0.95 } : undefined}
              onClick={() => select(opt.id)}
              disabled={locked}
              className={`${
                skin.optionCard?.(state, "primary") ??
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
              } min-w-0 max-w-full`}
            >
              {/* Ảnh + nhãn nằm trong MỘT khối dọc do player sở hữu.
                  `skin.optionCard` trả về TOÀN BỘ className (kể cả layout) và
                  thay thế hẳn fallback — studioSkin trả `flex items-center`
                  (hàng ngang), nên nếu ảnh và chữ là con trực tiếp của nút thì
                  ảnh `w-full` chiếm hết hàng và ép chữ tràn ra ngoài thẻ
                  (issue #815). Bọc lại một lớp thì layout không còn phụ thuộc
                  skin, và token dùng chung vẫn nguyên vẹn cho các player dạng
                  hàng ngang (pill, chấm Likert, ô bảng). */}
              <span className="flex w-full min-w-0 flex-col items-center gap-2 text-center">
                {/* Hộp ảnh CAO CỐ ĐỊNH + object-contain: ảnh không còn ăn theo
                    bề rộng ô lưới (2 cột trên desktop ≈ nửa container → ảnh phình
                    ~500px, tràn). Trần cao đồng nhất giữ mọi tỉ lệ ảnh (bóng bầu
                    dục ngang, cốc nước dọc…) xếp gọn, không kéo giãn/ tràn. */}
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
      <PlayerErrorFeedback show={status === "error" && !submitted} />
    </PlayerShell>
  );
};
