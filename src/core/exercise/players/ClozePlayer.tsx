/**
 * P13 — Cloze (multiple lines, inline blanks).
 * schema: cloze · interactionType: "inline"
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

export interface ClozeBlank {
  blankId: string;
  acceptedAnswers: string[];
  /** web-own: nhãn tác giả khai cho khối "Đáp án đúng" (blank-label.ts). Chuỗi
   * rỗng = bỏ hẳn tiền tố; vắng mặt = rơi về "Số N". KHÔNG in cạnh ô nhập ở
   * đường có marker — nhãn đã nằm sẵn trong câu văn. */
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
  /**
   * II.7 — danh sách lựa chọn riêng của ô này. Có thì ô render thành dropdown,
   * không thì giữ ô nhập tự do. Giá trị chọn được đem so thẳng với
   * `acceptedAnswers` nên không phát sinh luật chấm mới.
   */
  options?: string[];
  /** Media đề bài của Ô TRỐNG (§5.6) — vd ảnh "nhìn tranh rồi điền". */
  media?: AnswerElementMedia;
}
export type ClozeSegment = { text: PlayerText } | ClozeBlank;

export interface ClozeLine {
  id: string;
  segments: ClozeSegment[];
}

export interface ClozePlayerProps extends PlayerProps {
  lines: ClozeLine[];
  /** Full content blocks; when present the inputs render IN PLACE at their marker
   * position, preserving paragraph order and ContentLayout (#399). `lines` still
   * supplies the per-blank answer keys. */
  content?: { blocks?: ContentBlock[] };
  /**
   * Non-interactive content that belongs immediately above the input lines.
   * This keeps an image-only nested cloze child visible when it has no blank
   * marker inside `content` itself (the b18_i2_q1 question-group shape).
   */
  leadingContent?: { blocks?: ContentBlock[] };
  wordBank?: WordBankEntry[];
}

const isBlank = (s: ClozeSegment): s is ClozeBlank =>
  (s as ClozeBlank).blankId !== undefined;

export function matchBlank(value: string, blank: ClozeBlank): boolean {
  // Bỏ MỌI whitespace trước khi so (Owner 12/8): "A, B, O" với "A,B,O" là một
  // — spacing không phải kiến thức được chấm, và bàn phím điện thoại hay chèn
  // space thừa/space cứng (NBSP, \s bắt được) làm câu đúng bị chấm sai.
  // Cùng luật với matchBlank của FillBlankPlayer — sửa là sửa CẢ HAI.
  const norm = (v: string) => {
    const flat = v.replace(/\s+/g, "");
    return blank.caseSensitive ? flat : flat.toLowerCase();
  };
  const target = norm(value);
  return blank.acceptedAnswers.some((a) => norm(a) === target);
}

export const ClozePlayer: React.FC<ClozePlayerProps> = ({
  lines,
  content,
  leadingContent,
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
  const blanks = useMemo(
    () => lines.flatMap((l) => l.segments).filter(isBlank),
    [lines],
  );
  const [values, setValues] = useHydratedRecordAnswer(answer);
  // `buildAnswer` của instant grading có thể chạy NGAY trong cùng sự kiện với
  // setValues (đường dropdown II.7 chấm lúc onChange), lúc đó `values` vẫn là
  // của render trước → báo lên cha một map RỖNG. Ref này luôn giữ bản mới nhất.
  // Đường gõ tay không lộ lỗi vì nó chấm lúc blur, state đã flush từ trước.
  const valuesRef = useRef(values);
  valuesRef.current = values;
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
    buildAnswer: () => ({ ...valuesRef.current }),
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
    valuesRef.current = next;
    setValues(next);
    // Ghi nhận mỗi lần gõ (web-parity): mode "parent" ẩn nút "Kiểm tra" nên
    // onAnswerChange trực tiếp là kênh đáp án duy nhất; các mode khác cũng
    // hưởng autosave-khi-gõ mà không đổi hành vi chấm.
    onAnswerChange?.(next);
  };

  /**
   * `justPicked` cho đường DROPDOWN (II.7): ô gõ tay chấm lúc blur nên `values`
   * đã kịp cập nhật, còn dropdown chấm ngay trong `onChange` — lúc đó setState
   * chưa vào nên đọc `values` sẽ ra giá trị CŨ và chấm nhầm một nhịp.
   */
  const gradeOne = (b: ClozeBlank, justPicked?: string) => {
    const merged =
      justPicked === undefined ? values : { ...values, [b.blankId]: justPicked };
    if (recordOnly) {
      // Record-only: đồng bộ đáp án lên cha qua report — không chấm, không âm thanh.
      report({ ...merged }, "incomplete");
      return;
    }
    const v = (merged[b.blankId] ?? "").trim();
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

  const blankState = (b: ClozeBlank) => {
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
    const map = new Map<string, ClozeBlank>();
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

  // Ô trống mang MEDIA đề bài (`blanks[].media`, §5.6 — vd "nhìn tranh rồi
  // điền"): media đứng NGAY TRƯỚC ô nhập, cùng khối inline để cặp ảnh–ô không
  // bị ngắt dòng khỏi nhau. Riêng ô NHIỀU DÒNG render block full-width (#444)
  // nên media xếp DỌC phía trên — ép inline sẽ bóp width 100% của textarea về
  // cỡ nội dung (kiểu "viết dưới mỗi tranh" của Mỹ thuật).
  const renderInput = (b: ClozeBlank) => {
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

  const renderInputControl = (b: ClozeBlank) => {
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
          : "bg-white border-teal-300 text-slate-800 focus:border-teal-500";
    // II.7 — ô có danh sách lựa chọn riêng: dropdown ngay trong câu.
    // Chấm ngay lúc `onChange` chứ không đợi `onBlur` như ô gõ tay: chọn xong là
    // xác định, bắt học sinh bấm ra ngoài mới biết đúng/sai là vô cớ.
    if (b.options && b.options.length > 0) {
      return (
        <span className={`relative group inline-block align-middle${skinned ? "" : " mx-1"}`}>
          <select
            value={values[b.blankId] ?? ""}
            onChange={(e) => {
              setOne(b.blankId, e.target.value);
              gradeOne(b, e.target.value);
            }}
            disabled={locked}
            style={blankSizeStyle}
            className={`max-w-full ${
              skinned ??
              `inline-block min-w-0 shrink px-2 py-1 text-center rounded-xl border-4 font-black outline-none transition-all cursor-pointer ${stateClasses}`
            }`}
          >
            <option value="">…</option>
            {b.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </span>
      );
    }
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

  /** In-place renderer: the blank id from the marker → the input, using the answer
   * key from `lines`. A marker with no matching blank spec renders an inert input. */
  const renderInlineBlank = (blankId: string) =>
    renderInput(blankById.get(blankId) ?? { blankId, acceptedAnswers: [] });

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      {wordBank && wordBank.length > 0 && (
        <WordBankHint
          entries={wordBank}
          fallbackChipClass="font-bold rounded-full bg-teal-50 border-4 border-teal-200 text-teal-700"
        />
      )}

      {/* leadingContent render TRƯỚC container space-y-4 với chrome PlayerHeader
          (mb-4 md:mb-6 + flex flex-col gap-1; compact: mb-3) — giữ khoảng cách
          tiêu-đề-promote → thanh accent (Picture cloze P25b) = 4px; đặt trong
          space-y-4 làm bar tụt 16px, lệch pixel. (Upstream từ web 30/7.) */}
      {(leadingContent?.blocks?.length ?? 0) > 0 &&
        (shell.compact ? (
          <div className="mb-3">
            <RichContentBlocks blocks={leadingContent!.blocks!} compact allowMediaGrid />
          </div>
        ) : (
          <div className="mb-4 md:mb-6">
            <div className="flex flex-col gap-1">
              <RichContentBlocks blocks={leadingContent!.blocks!} allowMediaGrid />
            </div>
          </div>
        ))}

      <div className="space-y-4" style={{ containerType: "inline-size" }}>
        {inPlace ? (
          <RichContentBlocks
            blocks={content!.blocks!}
            compact
            allowMediaGrid
            renderInlineBlank={renderInlineBlank}
          />
        ) : (
          lines.map((line) => {
            // Dòng KHÔNG có chữ (toàn ô điền) → căn giữa: không có văn xuôi
            // nào để bám lề, và nội dung phía trên (ảnh của picture-cloze)
            // vốn đã căn giữa — ô điền lệch trái trông rơi khỏi bố cục
            // (Owner 8/8, bai18). Dòng có chữ giữ căn trái như văn xuôi.
            const hasText = line.segments.some(
              (seg) => !isBlank(seg) && !playerTextIsEmpty(seg.text),
            );
            return (
              <p
                key={line.id}
                className={`leading-relaxed flex flex-wrap items-center gap-x-1 gap-y-3 ${
                  hasText ? "" : "justify-center "
                }${skin.emphasis?.("neutral", "strong") ?? "font-semibold text-slate-800"}`}
                style={{ fontSize: "clamp(1rem, 4cqi, 1.25rem)" }}
              >
                {line.segments.map((seg, i) =>
                  isBlank(seg) ? (
                    <React.Fragment key={seg.blankId}>{renderInput(seg)}</React.Fragment>
                  ) : (
                    <PlayerTextValue key={i} value={seg.text} className="min-w-0" />
                  ),
                )}
              </p>
            );
          })
        )}
      </div>

      <PlayerErrorFeedback show={status === "error" && !submitted} />

      {/* No blanks → read-only illustration (e.g. a group's sample cell): no
          "Kiểm tra" — nothing to record or grade (#440). */}
      {blanks.length > 0 && !instant.active && !locked && !recordOnly && mode !== "parent" && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={check}
          className={
            skin.actionButton?.(true, "primary")
              ? `mt-6 ${skin.actionButton(true, "primary")}`
              : "mt-6 px-6 py-3 rounded-full border-4 border-teal-500 bg-teal-400 text-white font-black text-base sm:text-lg shadow-sm hover:bg-teal-500 transition-colors"
          }
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
  );
};
