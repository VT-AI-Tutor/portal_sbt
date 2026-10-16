/**
 * P01 — Single choice / radio MCQ.
 * schema: single_choice · interactionType: "radio" (default)
 */
import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, ContentImage, useGrading, useGradeMode, showGeneratedOptionLabels, optionDisplayLabel, optionBodyNode, optionCardWidthClass, optionTextLength, pictureLedChoices, CircleLetterMarker, ColorFillChoiceButton, ColorFillPalette, COLOR_FILL_PALETTE, type ContentBlock, type PlayerProps } from "./shared";
import { displayLayoutKey, layoutContainerClass, shouldInlineChoiceOptions } from "@/core/exercise/display-layout";
import { useSkin } from "@/core/exercise/skin";
import { useColorFillRecall, useRememberColorFill } from "./color-fill-memory";

/**
 * Single choice keeps its blue accent as the default crayon (and as the fill
 * for a restored pick whose colour the runner's color-fill memory lacks).
 */
const SINGLE_ACCENT = COLOR_FILL_PALETTE[0];

export interface ChoiceOption {
  /** The letter printed in the book — books skip F and J, so this is not
   * the option's position (issue #660). Resolved via optionDisplayLabel. */
  id: string;
  text?: string;
  imageUrl?: string;
  content?: { blocks?: ContentBlock[] };
}

export interface SingleChoicePlayerProps extends PlayerProps {
  options: ChoiceOption[];
  correctId: string;
  variant?: "radio" | "circle" | "color_fill";
  /** Read-only mode without implying that grading/submission has happened. */
  disabled?: boolean;
  /** web-own: khoá sổ nhớ màu color_fill (= questionId) — xem color-fill-memory. */
  colorFillKey?: string;
}

interface SingleChoiceSelectionProps {
  options: ChoiceOption[];
  correctId: string;
  variant: NonNullable<SingleChoicePlayerProps["variant"]>;
  layout: PlayerProps["layout"];
  submitted: boolean;
  recordOnly: boolean;
  locked: boolean;
  successful: boolean;
  /** Lượt chọn gần nhất bị chấm sai (gradeMode self) — tô đỏ lựa chọn sai. */
  errored: boolean;
  initialPicked: string | null;
  /** JSON key of the parent-supplied answer (see selectionKey below). */
  selectionKey: string;
  report: (answer: unknown, verdict: "correct" | "incorrect" | "incomplete") => void;
  colorFillKey?: string;
}

function SingleChoiceSelection({
  options,
  correctId,
  variant,
  layout,
  submitted,
  recordOnly,
  locked,
  successful,
  errored,
  initialPicked,
  selectionKey,
  report,
  colorFillKey,
}: SingleChoiceSelectionProps) {
  const skin = useSkin();
  // revealCorrect=false (web BUG-03): sau submit chỉ tô xanh ô đúng nếu học
  // sinh ĐÃ CHỌN nó — ô đúng chưa chọn giữ nguyên để không lộ đáp án khi
  // review/retry. Mặc định (undefined/true) giữ hành vi studio: tô ô đúng.
  const { revealCorrect } = useGradeMode();
  const [picked, setPicked] = useState<string | null>(initialPicked);
  // Crayon currently held, and the colour the picked card was filled with. Blue
  // stays the default so an untouched question looks as before.
  // web-own: khởi tạo từ sổ nhớ màu để quay lại câu vẫn đúng màu đã tô.
  const colorKey = variant === "color_fill" ? colorFillKey : undefined;
  const colorMemo = useColorFillRecall(colorKey);
  const [brush, setBrush] = useState<string>(colorMemo?.brush ?? SINGLE_ACCENT);
  const [fill, setFill] = useState<string | null>(
    initialPicked !== null ? colorMemo?.fills[initialPicked] ?? null : null,
  );
  const memoFills = useMemo(
    () => (picked !== null && fill !== null ? { [picked]: fill } : {}),
    [picked, fill],
  );
  useRememberColorFill(colorKey, memoFills, brush);
  // Rehydrate only when the parent supplies a semantically different answer. A
  // key-remount would also fire when the parent merely echoes our own report
  // back (answer → prop), which replayed the CircleLetterMarker draw animation
  // on every pick — so sync in-render instead of remounting.
  const [syncedKey, setSyncedKey] = useState(selectionKey);
  if (syncedKey !== selectionKey) {
    setSyncedKey(selectionKey);
    if (JSON.stringify(picked) !== selectionKey) {
      setPicked(initialPicked);
      // The answer carries no colour, so a foreign pick starts from the default
      // crayon rather than inheriting whatever the last local pick was tinted.
      setFill(null);
    }
  }
  // NHIỀU PHƯƠNG ÁN NGẮN (Owner 4/8): tác giả không khai layout + trên 4 phương
  // án chữ ngắn → xếp NGANG có wrap thay vì mỗi phương án một dòng full-width
  // (ca `b7_q1` 13 phương án phải cuộn mãi). Layout tác giả khai vẫn thắng.
  const autoInline = shouldInlineChoiceOptions(layout, options.map(optionTextLength));
  // Toàn thẻ tranh (ảnh + nhãn ngắn) mà layout là list mặc định → lưới 2 cột,
  // cùng luật với MultiChoicePlayer (xem pictureLedChoices — Owner 8/8): mỗi
  // scan một hàng full-width là một cột rất dài phải cuộn mãi. Nâng cả
  // `inline` (kể cả tác giả khai): inline là bố cục cho pill CHỮ, flex-wrap
  // với thẻ ảnh natural-size thành mỗi thẻ tràn một hàng — tệ hơn cả list;
  // `grid_3/4` tác giả khai vẫn giữ.
  const baseLayoutKey = displayLayoutKey(layout);
  const pictureCards = pictureLedChoices(options);
  const effectiveLayout =
    pictureCards && (baseLayoutKey === "list" || baseLayoutKey === "inline")
      ? "grid_2"
      : layout;
  const layoutKey = autoInline ? "inline" : displayLayoutKey(effectiveLayout);
  // skin.presentation.choicePill (surface học sinh): pill chrome rounded-full
  // border-4 ở MỌI layout — "pill không phải layout". Cờ tắt (studio QA):
  // layout list giữ nhánh radio-row trung thực (chấm tròn + dòng) bên dưới.
  const choicePill = skin.presentation?.choicePill === true;
  const isListLayout = layoutKey === "list" && !choicePill;
  const isCircle = variant === "circle";
  const isColorFill = variant === "color_fill";
  // Both circle and color_fill render the option letter inside their own marker,
  // so the separately-generated "A." label would be redundant chrome — suppress
  // it for either, the same way `!isCircle` used to guard it.
  const hasLetterMarker = isCircle || isColorFill;
  const showLabels = showGeneratedOptionLabels(variant, layoutKey, { choicePill });

  const select = (id: string) => {
    if (locked) return;
    setPicked(id);
    setFill(brush);
    if (recordOnly) report(id, "incomplete");
    else report(id, id === correctId ? "correct" : "incorrect");
  };

  return (
    <>
    {isColorFill && !locked && (
      <ColorFillPalette selected={brush} onSelect={setBrush} />
    )}
    <div
      className={layoutContainerClass(autoInline ? "inline" : effectiveLayout)}
      data-display-layout={layoutKey}
      data-interaction-type={variant}
      role="radiogroup"
      aria-label="Các lựa chọn"
    >
      {options.map((opt, i) => {
        const selected = picked === opt.id;
        const showCorrect =
          !recordOnly && (submitted || successful) && opt.id === correctId && (revealCorrect !== false || selected);
        // Wrong notation also right after an incorrect self-graded pick
        // (errored) — not only when the host pre-submits. The correct answer
        // stays hidden while errored so retrying is still meaningful.
        const showWrong = !recordOnly && (submitted || errored) && selected && opt.id !== correctId;
        const label = optionDisplayLabel(opt, i);
        // Everything except the picture rendered by `ContentImage` below — see
        // optionBodyNode for why the image block must not render twice.
        const body = optionBodyNode(opt);
        const state = showCorrect
          ? "correct"
          : showWrong
            ? "wrong"
            : selected
              ? "selected"
              : "idle";
        // color_fill: the whole card is coloured in (reference `?book=viet2`),
        // no per-option marker or letter. Same for list & pill layouts.
        if (isColorFill) {
          return (
            <ColorFillChoiceButton
              key={opt.id}
              role="radio"
              selected={selected}
              state={state}
              accent={fill ?? SINGLE_ACCENT}
              locked={locked}
              onSelect={() => select(opt.id)}
              stack={pictureCards}
              className={`${pictureCards ? "rounded-3xl" : "rounded-full"} hover:border-blue-300 focus-visible:ring-blue-400 ${optionCardWidthClass(opt, body)}`}
            >
              {opt.imageUrl && (
                <ContentImage
                  src={opt.imageUrl}
                  alt=""
                  className={pictureCards ? "!max-h-40 sm:!max-h-44 max-w-full self-center" : undefined}
                />
              )}
              {body && (
                <div className={pictureCards ? "min-w-0 text-center" : "min-w-0 flex-1"}>{body}</div>
              )}
            </ColorFillChoiceButton>
          );
        }
        // Skin override → otherwise the built-in playful pill look. `text-left`
        // giữ chữ căn trái khi option dài xuống dòng (pill mọi layout như web).
        // `rounded-full` chỉ hợp với pill chữ NGẮN một dòng: option mang ẢNH (hoặc
        // nội dung cao) biến pill thành hình bầu dục khổng lồ, bo góc ăn vào nội
        // dung/ảnh. Khi có ảnh dùng bán kính có giới hạn (`rounded-3xl`).
        const cardRadius = opt.imageUrl ? "rounded-3xl" : "rounded-full";
        const cardCls =
          skin.optionCard?.(state, "primary") ??
          `relative px-4 py-2 sm:px-6 sm:py-3 ${cardRadius} border-4 font-semibold text-sm sm:text-base md:text-lg transition-all flex items-center gap-2 text-left
              ${
                showCorrect
                  ? "bg-green-50  border-green-400 text-green-700 "
                  : showWrong
                    ? "bg-red-50  border-red-400 text-red-600"
                    : selected
                      ? "bg-blue-50  border-blue-400 text-blue-700 "
                      : "bg-white border-slate-200 text-slate-800 hover:border-blue-300  hover:bg-blue-50 "
              }`;
        const labelCls =
          skin.optionLabel?.("primary") ?? "font-black mr-0.5 text-blue-500 shrink-0";
        if (isListLayout) {
          const markerCls = showCorrect
            ? "border-green-500 bg-green-500"
            : showWrong
              ? "border-red-500 bg-red-500"
              : selected
                ? "border-blue-500 bg-blue-500"
                : "border-slate-200 bg-white group-hover:border-blue-400";
          return (
            <motion.button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              whileHover={!locked ? { scale: 1.02 } : undefined}
              whileTap={!locked ? { scale: 0.99 } : undefined}
              onClick={() => select(opt.id)}
              disabled={locked}
              className={`group flex ${optionCardWidthClass(opt, body) || "w-full"} items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                ${
                  showCorrect
                    ? "bg-green-50 text-green-700  "
                    : showWrong
                      ? "bg-red-50 text-red-600 "
                      : selected
                        ? "bg-blue-50 text-blue-700  "
                        : "text-slate-800 hover:bg-blue-50/70 "
                }`}
            >
              {isCircle ? (
                <CircleLetterMarker label={label} state={state} />
              ) : (
                <span
                  aria-hidden="true"
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${markerCls}`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {showLabels && !hasLetterMarker && <span className={labelCls}>{label}.</span>}
                {opt.imageUrl && (
                  <ContentImage src={opt.imageUrl} alt="" className="mr-2 inline-block align-middle" />
                )}
                {body}
              </div>
            </motion.button>
          );
        }
        return (
          <motion.button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            whileHover={!locked ? { scale: 1.05 } : undefined}
            whileTap={!locked ? { scale: 0.92 } : undefined}
            onClick={() => select(opt.id)}
            disabled={locked}
            // Vòng focus bàn phím của nhánh radio-row giữ trên pill (như web).
            className={`${cardCls} ${optionCardWidthClass(opt, body)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}
          >
            {isCircle ? (
              <CircleLetterMarker label={label} state={state} />
            ) : (
              showLabels && <span className={labelCls}>{label}.</span>
            )}
            {opt.imageUrl && (
              <ContentImage
                src={opt.imageUrl}
                alt=""
                // Thẻ tranh trong lưới: cap chiều cao + căn giữa, kẻo ảnh
                // shrink-0 tràn khỏi pill trong ô hẹp (cùng luật với Multi).
                className={pictureCards ? "!max-h-40 sm:!max-h-44 max-w-full self-center" : undefined}
              />
            )}
            {/* Vertical block flow for the option content. Without this wrapper the
                option's `<p>` blocks become direct flex items of the button and lay
                out horizontally, dropping paragraph/line breaks (#506). Block flow
                (not flex) so each block still fills the width and honours its own
                text-align. Mirrors the list branch's content wrapper. Omitted for a
                picture-only option so the pill hugs the picture. */}
            {/* `[&>*:first-child]:mt-0`: nội dung phương án (bodyCls mở đầu bằng
                `mt-1`) nằm trong pill căn giữa (`items-center`) — bỏ margin-top
                đầu để chữ/số căn giữa đúng với nhãn A./B., không bị lệch xuống. */}
            {body && <div className="min-w-0 flex-1 [&>*:first-child]:mt-0">{body}</div>}
          </motion.button>
        );
      })}
    </div>
    <PlayerErrorFeedback show={errored && !submitted} />
    </>
  );
}

export const SingleChoicePlayer: React.FC<SingleChoicePlayerProps> = ({
  options,
  correctId,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  disabled = false,
  selfAssessment,
  answer,
  variant = "radio",
  layout = "list",
  colorFillKey,
  ...shell
}) => {
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const hasKey = typeof correctId === "string" && correctId.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  const locked = disabled || submitted || status === "success";
  const initialPicked = typeof answer === "string" ? answer : null;
  // Keep interaction updates immediate, but replace the local draft whenever
  // the parent supplies a semantically different answer.
  const selectionKey = JSON.stringify(initialPicked);

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <SingleChoiceSelection
        options={options}
        correctId={correctId}
        variant={variant}
        layout={layout}
        submitted={submitted}
        recordOnly={recordOnly}
        locked={locked}
        successful={status === "success"}
        errored={status === "error"}
        initialPicked={initialPicked}
        selectionKey={selectionKey}
        report={report}
        colorFillKey={colorFillKey}
      />
    </PlayerShell>
  );
};
