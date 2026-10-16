/**
 * P12 — Fill in the blank (single sentence).
 * schema: fill_blank · interactionType: "text"
 */
import React, { useMemo, useRef } from "react";
import { motion } from "motion/react";
import { ResizeHandle } from "@/core/exercise/field-resize-context";
import {
  AutoGrowInput,
  AutoGrowTextarea,
  PlayerShell,
  PlayerErrorFeedback,
  PlayerTextValue,
  playerTextIsEmpty,
  RichContentBlocks,
  useHydratedRecordAnswer,
  useGrading,
  type PlayerText,
  type ContentBlock,
  useInstantGrading,
  type PlayerProps, blankAnswerWidth, blankBoxStyle } from "./shared";
import { useSkin } from "@/core/exercise/skin";
import type { AnswerElementMedia, BlankInputSpec, WordBankEntry } from "@/core/question-schema";
import { blankRevealLine } from "./blank-label";
import { WordBankHint } from "./WordBankHint";
import { AnswerMediaView } from "./AnswerMediaView";

export interface BlankSegment {
  blankId: string;
  acceptedAnswers: string[];
  /** web-own: nhãn tác giả khai cho khối "Đáp án đúng" — xem ClozeBlank.label. */
  label?: string;
  caseSensitive?: boolean;
  width?: string;
  /** false khi `width` chỉ là default của dispatch (payload KHÔNG khai
   * width/input.size). Surface học sinh (skin.presentation.spaciousBlanks)
   * render blank default TO cố định như web (không clamp 42cqi); explicit
   * size (#444) vẫn thắng ở mọi surface. */
  widthAuthored?: boolean;
  /** Rendering-only input config (#444): mode/size/rows. Never affects grading. */
  input?: BlankInputSpec;
  /** Media đề bài của Ô TRỐNG (§5.6) — vd ảnh "nhìn tranh rồi điền". */
  media?: AnswerElementMedia;
}
/** Line break between rows — e.g. one labeled blank per line ("a. …", "b. …"). */
export type FillBreak = { break: true };
export type FillSegment = { text: PlayerText } | BlankSegment | FillBreak;

export interface FillBlankPlayerProps extends PlayerProps {
  segments: FillSegment[];
  /** Full content blocks; when present the inputs render IN PLACE at their marker
   * position, preserving paragraph order and ContentLayout (#399). `segments` still
   * supplies the per-blank answer keys. */
  content?: { blocks?: ContentBlock[] };
  wordBank?: WordBankEntry[];
}

const isBlank = (s: FillSegment): s is BlankSegment =>
  (s as BlankSegment).blankId !== undefined;
const isBreak = (s: FillSegment): s is FillBreak =>
  (s as FillBreak).break === true;

/** So khớp đáp án: bỏ MỌI whitespace + (tuỳ chọn) hạ chữ thường. */
export function matchBlank(value: string, blank: BlankSegment): boolean {
  // Bỏ MỌI whitespace trước khi so (Owner 12/8): "A, B, O" với "A,B,O" là một
  // — spacing không phải kiến thức được chấm, và bàn phím điện thoại hay chèn
  // space thừa/space cứng (NBSP, \s bắt được) làm câu đúng bị chấm sai.
  // Cùng luật với matchBlank của ClozePlayer — sửa là sửa CẢ HAI.
  const norm = (v: string) => {
    const flat = v.replace(/\s+/g, "");
    return blank.caseSensitive ? flat : flat.toLowerCase();
  };
  const target = norm(value);
  return blank.acceptedAnswers.some((a) => norm(a) === target);
}

export const FillBlankPlayer: React.FC<FillBlankPlayerProps> = ({
  segments,
  content,
  wordBank,
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
  const blanks = useMemo(() => segments.filter(isBlank), [segments]);
  const [values, setValues] = useHydratedRecordAnswer(answer);
  const { status, setStatus, report, mode } = useGrading({
    onAnswerChange,
    onComplete,
    onStatusChange,
  });
  const hasKey = blanks.some((b) => (b.acceptedAnswers?.length ?? 0) > 0);
  const recordOnly = selfAssessment === true || !hasKey;
  const instant = useInstantGrading({
    elementIds: useMemo(() => blanks.map((b) => b.blankId), [blanks]),
    instantFeedback,
    recordOnly,
    buildAnswer: () => ({ ...values }),
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  const reveal = !recordOnly
    ? blanks
        // web-own: chưa upstream lên studio — studio cũng đang in cứng "Số N".
        .map((b, i) =>
          blankRevealLine({
            label: b.label,
            index: i,
            separator: ": ",
            value: b.acceptedAnswers.join(" / "),
          }),
        )
        .join("\n")
    : undefined;

  const setOne = (id: string, v: string) => {
    if (locked) return;
    // Người chơi sửa lại sau khi bị chấm sai → xoá trạng thái sai để thử lại
    // (đồng thời tránh chấm "sống" khi đang gõ — không lộ đáp án).
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    const next = { ...values, [id]: v };
    setValues(next);
    // Ghi nhận mỗi lần gõ (web-parity): mode "parent" ẩn nút "Kiểm tra" nên
    // onAnswerChange trực tiếp là kênh đáp án duy nhất; các mode khác cũng
    // hưởng autosave-khi-gõ mà không đổi hành vi chấm.
    onAnswerChange?.(next);
  };

  const gradeOne = (b: BlankSegment) => {
    if (recordOnly) {
      // Record-only: đồng bộ đáp án lên cha qua report — không chấm, không âm thanh.
      report({ ...values }, "incomplete");
      return;
    }
    const v = (values[b.blankId] ?? "").trim();
    if (v === "") {
      instant.clear(b.blankId);
      return;
    }
    instant.grade(b.blankId, matchBlank(v, b) ? "correct" : "incorrect");
  };

  const check = () => {
    if (locked) return;
    const answer = { ...values };
    if (recordOnly) {
      report(answer, "incomplete");
      return;
    }
    const allFilled = blanks.every((b) => (values[b.blankId] ?? "").trim() !== "");
    if (!allFilled) {
      report(answer, "incomplete");
      return;
    }
    const allCorrect = blanks.every((b) => matchBlank(values[b.blankId] ?? "", b));
    report(answer, allCorrect ? "correct" : "incorrect");
  };

  const blankState = (b: BlankSegment) => {
    const rv = instant.reveal(b.blankId);
    if (rv) return rv === "correct" ? "ok" : "bad";
    if (!submitted && status === "error") {
      // "Kiểm tra" vừa chấm sai — chỉ tô đỏ các ô SAI; ô đúng giữ nguyên (idle)
      // để không lộ đáp án khi còn được thử lại.
      const v = values[b.blankId] ?? "";
      if (v.trim() === "" || b.acceptedAnswers.length === 0) return "idle";
      return matchBlank(v, b) ? "idle" : "bad";
    }
    if (!submitted && status !== "success") return "idle";
    const v = values[b.blankId] ?? "";
    if (v.trim() === "") return "idle";
    return matchBlank(v, b) ? "ok" : "bad";
  };

  const blankById = useMemo(() => {
    const map = new Map<string, BlankSegment>();
    for (const b of blanks) map.set(b.blankId, b);
    return map;
  }, [blanks]);
  const inPlace = (content?.blocks?.length ?? 0) > 0;

  // Per-blank input refs so the edit-preview ResizeHandle can measure its field
  // (an <input> for single_line blanks, a <textarea> for multiline ones).
  const inputRefs = useRef(
    new Map<string, React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>>(),
  );
  const inputRefFor = (blankId: string) => {
    let ref = inputRefs.current.get(blankId);
    if (!ref) {
      ref = React.createRef<HTMLInputElement | HTMLTextAreaElement>();
      inputRefs.current.set(blankId, ref);
    }
    return ref;
  };

  // Cùng hợp đồng với ClozePlayer: media của ô trống đứng NGAY TRƯỚC ô nhập;
  // ô nhiều dòng render block full-width nên media xếp DỌC phía trên.
  const renderInput = (b: BlankSegment) => {
    if (!b.media) return renderInputControl(b);
    if (b.input?.mode === "multiline") {
      return (
        <span className="flex w-full flex-col items-start gap-2">
          <AnswerMediaView media={b.media} size="prompt" />
          {renderInputControl(b)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2 align-middle max-w-full">
        <AnswerMediaView media={b.media} size="prompt" />
        {renderInputControl(b)}
      </span>
    );
  };

  const renderInputControl = (b: BlankSegment) => {
    const st = blankState(b);
    const inputState = st === "ok" ? "correct" : st === "bad" ? "wrong" : "idle";
    const preferredWidth = b.width ?? "7rem";
    // skin.presentation.spaciousBlanks (surface học sinh): blank default (tác
    // giả KHÔNG khai width/input.size) render TO cố định như web — không clamp
    // co giãn 42cqi.
    const widthAuthored = b.widthAuthored ?? b.width != null;
    // Không khai width → suy SÀN từ ĐÁP ÁN, "giống sách": chỗ trống dài ngắn
    // theo đáp án (Owner 12/8). Chỉ ô MỘT DÒNG — ô tự luận nhiều dòng vẫn theo
    // cỡ mặc định vì đáp án ở đó là cả câu. Không suy được (câu tự chấm không
    // có key) → giữ nguyên cỡ mặc định như trước.
    const autoWidth =
      (b.input?.mode === "multiline" ? undefined : blankAnswerWidth(b.acceptedAnswers)) ??
      preferredWidth;
    // Cỡ hộp: xem `blankBoxStyle` trong shared.tsx. Ô GÕ TAY (`grows: true`) tự
    // rộng theo chữ nên trên surface học sinh width tác giả khai chỉ là SÀN;
    // dropdown và textarea không tự giãn ngang nên vẫn là hộp khoá như cũ.
    const spaciousBlanks = skin.presentation?.spaciousBlanks === true;
    const blankBoxArgs = { preferredWidth, autoWidth, widthAuthored, spacious: spaciousBlanks };
    const blankSizeStyle = blankBoxStyle({ ...blankBoxArgs, grows: false });
    const blankInputStyle = blankBoxStyle({ ...blankBoxArgs, grows: true });
    const skinned = skin.input?.(inputState);
    const stateClasses =
      st === "ok"
        ? "bg-green-50 border-green-400 text-green-700"
        : st === "bad"
          ? "bg-red-50 border-red-400 text-red-600"
          : "bg-white border-amber-300 text-slate-800 focus:border-amber-500";
    // Multiline blank (#444): a textarea with the same value/blur-grade wiring.
    // `size: "full"` (width "100%") renders as a full-width block so long
    // free-form answers get the whole line; other sizes stay inline.
    if (b.input?.mode === "multiline") {
      // Width "100%" is what sizeToWidth("full") resolves to in parseCloze;
      // checking `size` too keeps direct player usage (no dispatch) consistent.
      const full = b.input.size === "full" || preferredWidth === "100%";
      return (
        <span
          className={`relative group ${full ? "block w-full" : "inline-block align-middle"}${skinned || full ? "" : " mx-1"}`}
        >
          {/* `rows` chỉ là SÀN — ô cao dần theo chữ (AutoGrowTextarea), cùng
              luật với ô điền một dòng ngay dưới: không giấu chữ trong hộp cuộn. */}
          <AutoGrowTextarea
            ref={inputRefFor(b.blankId) as React.RefObject<HTMLTextAreaElement | null>}
            rows={b.input.rows ?? 2}
            value={values[b.blankId] ?? ""}
            onChange={(v) => setOne(b.blankId, v)}
            onBlur={() => gradeOne(b)}
            disabled={locked}
            style={full ? undefined : blankSizeStyle}
            className={
              skinned
                ? `${full ? "w-full" : "inline-block min-w-0 shrink align-middle"} resize-none ${skinned}`
                : `${full ? "w-full" : "inline-block min-w-0 shrink align-middle"} resize-none px-2 py-1 text-left rounded-xl border-4 font-black outline-none transition-all ${stateClasses}`
            }
          />
          <ResizeHandle unit="rem" fieldId={b.blankId} targetRef={inputRefFor(b.blankId)} />
        </span>
      );
    }
    // The input can't contain children, so the resize handle (edit preview only —
    // renders null without a FieldResizeContext provider) sits in a wrapper span.
    // The default skin's mx-1 moves to the wrapper so visual spacing is unchanged.
    return (
      <span className={`relative group inline-block max-w-full align-middle${skinned ? "" : " mx-1"}`}>
        <AutoGrowInput
          ref={inputRefFor(b.blankId) as React.RefObject<HTMLInputElement | null>}
          value={values[b.blankId] ?? ""}
          onChange={(v) => setOne(b.blankId, v)}
          onBlur={() => gradeOne(b)}
          disabled={locked}
          style={blankInputStyle}
          className={
            skinned ??
            `min-w-0 shrink px-2 py-1 text-center rounded-xl border-4 font-black outline-none transition-all
            ${stateClasses}`
          }
        />
        <ResizeHandle unit="rem" fieldId={b.blankId} targetRef={inputRefFor(b.blankId)} />
      </span>
    );
  };

  const renderInlineBlank = (blankId: string) =>
    renderInput(blankById.get(blankId) ?? { blankId, acceptedAnswers: [] });

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      {wordBank && wordBank.length > 0 && (
        <WordBankHint
          entries={wordBank}
          fallbackChipClass="font-bold rounded-full bg-amber-50 border-4 border-amber-200 text-amber-700"
        />
      )}

      <div style={{ containerType: "inline-size" }}>
        {inPlace ? (
          <RichContentBlocks
            blocks={content!.blocks!}
            compact
            allowMediaGrid
            renderInlineBlank={renderInlineBlank}
          />
        ) : (
          <p
            // Không có chữ nào (toàn ô điền / ngắt dòng) → căn giữa: không có
            // văn xuôi để bám lề, nội dung phía trên (ảnh) vốn căn giữa — ô
            // điền lệch trái trông rơi khỏi bố cục (Owner 8/8, bai18, cùng
            // luật với ClozePlayer). Có chữ giữ căn trái như văn xuôi.
            className={`leading-relaxed flex flex-wrap items-center gap-x-1 gap-y-3 ${
              segments.some((seg) => !isBlank(seg) && !isBreak(seg) && !playerTextIsEmpty(seg.text))
                ? ""
                : "justify-center "
            }${skin.emphasis?.("neutral", "strong") ?? "font-semibold text-slate-800"}`}
            style={{ fontSize: "clamp(1rem, 4cqi, 1.25rem)" }}
          >
            {segments.map((seg, i) => {
              if (isBreak(seg)) {
                // basis-full forces a wrap in the flex-wrap row → next blank on its own line.
                return <span key={i} className="basis-full h-0" aria-hidden="true" />;
              }
              if (isBlank(seg)) {
                return <React.Fragment key={seg.blankId}>{renderInput(seg)}</React.Fragment>;
              }
              return <PlayerTextValue key={i} value={seg.text} className="min-w-0" />;
            })}
          </p>
        )}
      </div>

      <PlayerErrorFeedback show={status === "error" && !submitted} />

      {/* No blanks → read-only content: no "Kiểm tra" — nothing to grade (#440 parity). */}
      {blanks.length > 0 && !instant.active && !locked && !recordOnly && mode !== "parent" && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={check}
          className={
            skin.actionButton?.(true, "primary")
              ? `mt-6 ${skin.actionButton(true, "primary")}`
              : "mt-6 px-6 py-3 rounded-full border-4 border-amber-500 bg-amber-400 text-white font-black text-base sm:text-lg shadow-sm hover:bg-amber-500 transition-colors"
          }
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
  );
};
