/**
 * P02 — Multiple choice / checkbox MCQ.
 * schema: multiple_choice · interactionType: "checkbox"
 */
import React, { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, ContentImage, useGrading, useGradeMode, useInstantGrading, sameSet, showGeneratedOptionLabels, optionDisplayLabel, optionBodyNode, optionCardWidthClass, optionTextLength, pictureLedChoices, CircleLetterMarker, ColorFillChoiceButton, ColorFillPalette, COLOR_FILL_PALETTE, type ContentBlock, type PlayerProps } from "./shared";
import { displayLayoutKey, layoutContainerClass, shouldInlineChoiceOptions } from "@/core/exercise/display-layout";
import { useSkin } from "@/core/exercise/skin";
import { useColorFillRecall, useRememberColorFill } from "./color-fill-memory";

/**
 * Multiple choice keeps its purple accent as the default crayon (and as the
 * fill for restored picks whose colour the runner's color-fill memory lacks).
 */
const MULTI_ACCENT = COLOR_FILL_PALETTE[4];

export interface MultiChoiceOption {
  /** The letter printed in the book — books skip F and J, so this is not
   * the option's position (issue #660). Resolved via optionDisplayLabel. */
  id: string;
  text?: string;
  imageUrl?: string;
  content?: { blocks?: ContentBlock[] };
}

export interface MultiChoicePlayerProps extends PlayerProps {
  options: MultiChoiceOption[];
  correctIds: string[];
  variant?: "checkbox" | "circle" | "color_fill";
  /** Read-only mode without implying that grading/submission has happened. */
  disabled?: boolean;
  /** web-own: khoá sổ nhớ màu color_fill (= questionId) — xem color-fill-memory. */
  colorFillKey?: string;
}

interface MultiChoiceSelectionProps {
  options: MultiChoiceOption[];
  correctIds: string[];
  variant: NonNullable<MultiChoicePlayerProps["variant"]>;
  layout: PlayerProps["layout"];
  submitted: boolean;
  recordOnly: boolean;
  locked: boolean;
  successful: boolean;
  /** Self-check ("Kiểm tra" trong player) vừa chấm sai — hiển thị lựa chọn sai màu đỏ. */
  errored: boolean;
  /** Người chơi đổi lựa chọn sau khi sai → xoá trạng thái sai để thử lại. */
  clearError: () => void;
  initialPicked: string[];
  /** Sorted-set key of the parent-supplied answer (see selectionKey below). */
  selectionKey: string;
  report: (answer: unknown, verdict: "correct" | "incorrect" | "incomplete") => void;
  /** CHẤM NGAY: chấm từng ô ngay khi tick (mặc định). */
  instantFeedback: boolean;
  onElementGraded?: PlayerProps["onElementGraded"];
  onProgress?: PlayerProps["onProgress"];
  colorFillKey?: string;
}

function MultiChoiceSelection({
  options,
  correctIds,
  variant,
  layout,
  submitted,
  recordOnly,
  locked,
  successful,
  errored,
  clearError,
  initialPicked,
  selectionKey,
  report,
  instantFeedback,
  onElementGraded,
  onProgress,
  colorFillKey,
}: MultiChoiceSelectionProps) {
  const skin = useSkin();
  // - mode "parent": nút "Kiểm tra" tự-chấm bị ẩn (cha chấm) — mọi thay đổi
  //   lựa chọn đã được emit ngay trong toggle() bên dưới.
  // - revealCorrect=false (web BUG-03): sau submit chỉ tô xanh ô đúng đã CHỌN;
  //   ô đúng chưa chọn giữ nguyên để không lộ đáp án. Mặc định giữ như cũ.
  const { mode, revealCorrect } = useGradeMode();
  const [picked, setPicked] = useState<string[]>(initialPicked);
  // Rehydrate only when the parent supplies a semantically different set. A
  // key-remount here would also fire when the parent merely echoes our own
  // report back (answer → prop), which replayed the CircleLetterMarker draw
  // animation on every "Kiểm tra" — so sync in-render instead of remounting.
  const [syncedKey, setSyncedKey] = useState(selectionKey);
  if (syncedKey !== selectionKey) {
    setSyncedKey(selectionKey);
    if (JSON.stringify([...picked].sort()) !== selectionKey) setPicked(initialPicked);
  }
  // NHIỀU PHƯƠNG ÁN NGẮN (Owner 4/8): tác giả không khai layout + trên 4 phương
  // án chữ ngắn → xếp NGANG có wrap. Ca thật `b7_q1` (13 phương án "Phòng
  // học.", "Khu vệ sinh."…) trước đây là 13 pill full-width phải cuộn mãi.
  const autoInline = shouldInlineChoiceOptions(layout, options.map(optionTextLength));
  // Legacy workbook data can declare checkbox + list even when every option is
  // a picture. Those cards must behave as image choices: a compact 2-column
  // grid prevents four natural-size scans from becoming one very long column.
  // `pictureLedChoices` (Owner 8/8): một nhãn NGẮN cạnh ảnh ("1", "Tranh 2")
  // không làm thẻ mất tư cách thẻ tranh — chú thích dài mới giữ list.
  //
  // Nâng cả layout `inline` (kể cả tác giả khai — bai9_q2 Đạo đức 4): inline
  // là bố cục cho PILL CHỮ ngắn, không suy ra được từ ảnh (đúng triết lý
  // shouldInlineChoiceOptions từ chối inline khi có ảnh) — flex-wrap với thẻ
  // ảnh natural-size thành mỗi thẻ tràn một hàng, tệ hơn cả list. `grid_3/4`
  // tác giả khai vẫn giữ nguyên: đó là bố cục lưới chủ ý.
  const pictureOnlyChoices = pictureLedChoices(options);
  const baseLayoutKey = displayLayoutKey(layout);
  const effectiveLayout =
    pictureOnlyChoices && (baseLayoutKey === "list" || baseLayoutKey === "inline")
      ? "grid_2"
      : layout;
  const layoutKey = autoInline ? "inline" : displayLayoutKey(effectiveLayout);
  const isCircle = variant === "circle";
  const isColorFill = variant === "color_fill";
  // Circle and color_fill both carry the option letter inside their marker, so
  // the separate generated "A." label is redundant — suppress it for either.
  const hasLetterMarker = isCircle || isColorFill;
  const showLabels = showGeneratedOptionLabels(variant, layoutKey);
  // Crayon currently held, and the colour each already-coloured card was filled
  // with. Purple stays the default so an untouched question looks as before.
  // web-own: khởi tạo từ sổ nhớ màu để quay lại câu vẫn đúng màu đã tô.
  const colorMemo = useColorFillRecall(isColorFill ? colorFillKey : undefined);
  const [brush, setBrush] = useState<string>(colorMemo?.brush ?? MULTI_ACCENT);
  const [fills, setFills] = useState<Record<string, string>>(colorMemo?.fills ?? {});
  useRememberColorFill(isColorFill ? colorFillKey : undefined, fills, brush);

  // CHẤM NGAY từng ô (giống TileSelectPlayer / ImageChoiceMultiPlayer cùng type
  // multiple_choice): tick ô đúng → xanh, tick ô sai → đỏ, bỏ tick → xoá verdict.
  // Verdict CẢ CÂU do toggle tự báo khi tập đã chọn khớp đáp án — useInstantGrading
  // chỉ coi là "xong" khi MỌI ô đều có verdict, điều không bao giờ xảy ra ở câu
  // nhiều lựa chọn (học sinh chỉ tick những ô mình cho là đúng).
  const elementIds = useMemo(() => options.map((o) => o.id), [options]);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const instant = useInstantGrading({
    elementIds,
    // Câu chọn-một-tập: "xong" là khớp TẬP, không phải bấm qua hết
    // mọi phương án (xem ghi chú expectedIds trong useInstantGrading).
    expectedIds: correctIds,
    instantFeedback,
    // color_fill CHẤM NGAY y hệt checkbox/circle (Owner 4/8). Trước đây nó bị
    // loại trừ (`recordOnly || isColorFill`) vì sợ verdict tô đè xanh/đỏ làm
    // "xoá nét bút học sinh" — lý do đó SAI bản chất: color_fill là câu TRẮC
    // NGHIỆM dạng tô màu, tô chỉ để ĐÁNH DẤU LỰA CHỌN (tương đương tick), màu
    // bút không phải bài làm cần bảo tồn. Đừng khôi phục ngoại lệ đó.
    // Nút "Kiểm tra" tự biến mất theo gate `!instant.active` bên dưới.
    recordOnly,
    buildAnswer: () => pickedRef.current,
    report,
    onElementGraded,
    onProgress,
  });

  const toggle = (id: string) => {
    if (locked) return;
    // Tapping an already-coloured card while holding a DIFFERENT crayon
    // recolours it rather than clearing it — colouring over is the paper
    // gesture, and clearing would make a change of mind about the colour cost
    // two taps (and briefly drop the option out of the answer). Same crayon
    // still toggles the pick off.
    if (isColorFill && picked.includes(id) && (fills[id] ?? MULTI_ACCENT) !== brush) {
      setFills((prev) => ({ ...prev, [id]: brush }));
      if (errored) clearError();
      return;
    }
    const adding = !picked.includes(id);
    const next = adding ? [...picked, id] : picked.filter((x) => x !== id);
    setPicked(next);
    pickedRef.current = next;
    if (adding) setFills((prev) => ({ ...prev, [id]: brush }));
    if (!instant.active && errored) clearError();
    if (!instant.active) {
      // Đường CŨ (chấm bằng nút "Kiểm tra", hoặc recordOnly/chấm kín): LUÔN emit
      // đáp án hiện tại lên cha — mode "parent" ẩn nút nên toggle là kênh duy nhất;
      // verdict "incomplete" nên self-mode không chấm/không âm thanh.
      report(next, "incomplete");
      return;
    }
    // CHẤM NGAY: verdict từng ô (grade/clear tự emit đáp án lên cha qua report).
    if (adding) instant.grade(id, correctIds.includes(id) ? "correct" : "incorrect");
    else instant.clear(id);
    // Tập đã chọn khớp đáp án → cả câu đúng: báo verdict thật để host (mascot)
    // khen và player khoá lại. Chưa khớp thì giữ "incomplete" mà grade/clear
    // vừa emit — KHÔNG báo sai cả câu khi học sinh mới tick được một phần.
    if (sameSet(next, correctIds)) report(next, "correct");
  };

  const check = () => {
    if (locked || picked.length === 0) return;
    if (recordOnly) {
      report(picked, "incomplete");
      return;
    }
    report(picked, sameSet(picked, correctIds) ? "correct" : "incorrect");
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
        role="group"
        aria-label="Các lựa chọn"
      >
        {options.map((opt, i) => {
          const selected = picked.includes(opt.id);
          // CHẤM NGAY: verdict của chính ô này thắng mọi suy luận theo trạng thái
          // cả câu (reveal trả undefined khi instant tắt / chấm kín).
          const rv = instant.reveal(opt.id);
          const showCorrect = rv
            ? rv === "correct"
            : !recordOnly && (submitted || successful) && correctIds.includes(opt.id) && (revealCorrect !== false || selected);
          // Wrong notation also after an in-player "Kiểm tra" (errored) — not
          // only when the host pre-submits. Correct answers stay hidden while
          // errored so the pupil can retry without the answer being leaked.
          const showWrong = rv
            ? rv === "incorrect"
            : !recordOnly && (submitted || errored) && selected && !correctIds.includes(opt.id);
          const label = optionDisplayLabel(opt, i);
          // Everything except the picture rendered by `ContentImage` below — see
          // optionBodyNode for why the image block must not render twice.
          const body = optionBodyNode(opt);
          // Thẻ tranh dùng chrome DỌC (ảnh trên, nhãn dưới) kể cả khi có nhãn
          // ngắn — trong hàng flex ngang, ContentImage `shrink-0` cạnh marker
          // và nhãn sẽ TRÀN khỏi thẻ khi ô lưới hẹp (bai9_q2: ảnh chồm qua
          // viền, "Tranh 2" bị ép dọc). Chữ dưới ảnh giờ có thể tới hai dòng
          // (PICTURE_CARD_CAPTION_MAX nâng lên 80 ngày 10/8) — chrome dọc vốn
          // sinh ra để chứa đúng thứ đó, nên nhãn dài không còn phải giữ list.
          const compactPictureCard = pictureOnlyChoices;
          const state = showCorrect
            ? "correct"
            : showWrong
              ? "wrong"
              : selected
                ? "selected"
                : "idle";
          const markerState = showCorrect
            ? "correct"
            : showWrong
              ? "wrong"
              : selected
                ? "filled"
                : "idle";
          // color_fill: flood the whole card (reference `?book=viet2`) instead
          // of a checkbox glyph or letter. Multiple keeps its purple accent.
          if (isColorFill) {
            return (
              <ColorFillChoiceButton
                key={opt.id}
                role="checkbox"
                selected={selected}
                state={state}
                accent={fills[opt.id] ?? MULTI_ACCENT}
                locked={locked}
                onSelect={() => toggle(opt.id)}
                stack={compactPictureCard}
                className={`rounded-3xl hover:border-purple-300 focus-visible:ring-purple-400 ${optionCardWidthClass(opt, body)}`}
              >
                {opt.imageUrl && (
                  <ContentImage
                    src={opt.imageUrl}
                    alt=""
                    className={compactPictureCard ? "!max-h-40 sm:!max-h-44 max-w-full self-center" : undefined}
                  />
                )}
                {body && (
                  <div className={compactPictureCard ? "min-w-0 text-center" : "min-w-0 flex-1"}>
                    {body}
                  </div>
                )}
              </ColorFillChoiceButton>
            );
          }
          const cardCls =
            skin.optionCard?.(state, "secondary") ??
            `relative flex items-center gap-3 px-4 py-3 rounded-3xl border-4 font-semibold text-sm sm:text-base md:text-lg transition-all text-left
                ${
                  showCorrect
                    ? "bg-green-50  border-green-400 text-green-700 "
                    : showWrong
                      ? "bg-red-50  border-red-400 text-red-600"
                      : selected
                        ? "bg-purple-50  border-purple-400 text-purple-700 "
                        : "bg-white border-slate-200 text-slate-800 hover:border-purple-300  hover:bg-purple-50 "
                }`;
          const labelCls =
            skin.optionLabel?.("secondary") ?? "font-black mr-1 text-purple-500";
          return (
            <motion.button
              key={opt.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              tabIndex={locked ? -1 : 0}
              whileHover={!locked ? { scale: 1.02 } : undefined}
              whileTap={!locked ? { scale: 0.97 } : undefined}
              onClick={() => toggle(opt.id)}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  toggle(opt.id);
                }
              }}
              disabled={locked}
              className={`${cardCls} ${compactPictureCard ? "w-full flex-col justify-center p-3" : optionCardWidthClass(opt, body)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2`}
            >
              {isCircle ? (
                <CircleLetterMarker label={label} state={state} accent="#a855f7" />
              ) : (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none flex items-center justify-center w-7 h-7 shrink-0 text-white transition-all ${compactPictureCard ? "absolute top-3 right-3 z-10" : ""} ${
                    skin.marker?.(markerState) ??
                    `rounded-lg border-4 ${
                      showCorrect
                        ? "bg-green-400 border-green-400"
                        : showWrong
                          ? "bg-red-400 border-red-400"
                          : selected
                            ? "bg-purple-400 border-purple-400"
                            : "bg-white border-slate-200 text-transparent"
                    }`
                  }`}
                >
                  {(showCorrect || selected) && "✓"}
                </span>
              )}
              {showLabels && !hasLetterMarker && !compactPictureCard && <span className={labelCls}>{label}.</span>}
              {opt.imageUrl && (
                <ContentImage
                  src={opt.imageUrl}
                  alt=""
                  className={compactPictureCard ? "!max-h-40 sm:!max-h-44 max-w-full self-center" : undefined}
                />
              )}
              {/* KHÔNG in chữ cái tự sinh (A./B./C.) trên thẻ tranh — Owner
                  10/8. Nhãn đó sinh ra để gọi tên một thẻ chỉ-có-ảnh, nhưng nó
                  chen giữa ảnh và phần chữ của tác giả, và với thẻ đã có mô tả
                  thì thành hai nhãn chồng nhau. Thẻ CHỮ (không phải thẻ tranh)
                  vẫn giữ nhãn như cũ ở nhánh trên. */}
              {/* Vertical block flow for the option content. The option button is
                  always `display:flex`, so without this wrapper each `<p>` block
                  becomes a horizontal flex item and paragraph/line breaks are lost
                  (#506). Block flow (not flex) so each block still fills the width
                  and honours its own text-align. Omitted entirely for a
                  picture-only option: an empty `flex-1` spacer is what stretched
                  the card past the picture it wraps. */}
              {/* `[&>*:first-child]:mt-0`: bỏ margin-top đầu của nội dung để căn
                  giữa đúng với nhãn A./B. trong pill (`items-center`). */}
              {body && (
                <div
                  className={
                    compactPictureCard
                      ? // Thẻ tranh flex-col: nhãn nằm DƯỚI ảnh, căn giữa,
                        // không flex-1 (kéo dọc vô nghĩa trong cột).
                        "min-w-0 text-center [&>*:first-child]:mt-0"
                      : "min-w-0 flex-1 [&>*:first-child]:mt-0"
                  }
                >
                  {body}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <PlayerErrorFeedback show={!instant.active && errored && !submitted} />

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
                : "bg-purple-400 border-purple-500 text-white hover:bg-purple-500"
            }`
          }
        >
          Kiểm tra
        </motion.button>
      )}
    </>
  );
}

export const MultiChoicePlayer: React.FC<MultiChoicePlayerProps> = ({
  options,
  correctIds,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  disabled = false,
  selfAssessment,
  answer,
  variant = "checkbox",
  layout = "list",
  instantFeedback = true,
  onElementGraded,
  onProgress,
  colorFillKey,
  ...shell
}) => {
  const { status, setStatus, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const hasKey = Array.isArray(correctIds) && correctIds.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  // CHẤM NGAY không khoá câu khi đúng (giống TileSelect/ImageChoiceMulti): học
  // sinh vẫn đổi ý được; đường "Kiểm tra" cũ mới khoá sau khi chấm đúng.
  const instantActive = instantFeedback && !recordOnly;
  const locked = disabled || submitted || (!instantActive && status === "success");
  const initialPicked = Array.isArray(answer) ? answer.map(String) : [];
  // Multi-choice answers are sets: order-only parent changes should not discard
  // a responsive local draft, while a different set must rehydrate it.
  const selectionKey = JSON.stringify([...initialPicked].sort());
  const clearError = () => {
    setStatus("idle");
    onStatusChange?.("idle");
  };

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <MultiChoiceSelection
        options={options}
        correctIds={correctIds}
        variant={variant}
        layout={layout}
        submitted={submitted}
        recordOnly={recordOnly}
        locked={locked}
        successful={status === "success"}
        errored={status === "error"}
        clearError={clearError}
        initialPicked={initialPicked}
        selectionKey={selectionKey}
        report={report}
        instantFeedback={instantFeedback}
        onElementGraded={onElementGraded}
        onProgress={onProgress}
        colorFillKey={colorFillKey}
      />
    </PlayerShell>
  );
};
