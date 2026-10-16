/**
 * P16 — Essay / long text (manual grading).
 * schema: essay · interactionType: "long_text"
 *
 * Supports two modes:
 *  - Single prompt (no `prompts`/`imagePrompts` prop): one textarea, answer = string
 *  - Multiple prompts (`prompts: string[]` and/or `imagePrompts`): one textarea
 *    per prompt, answer = string[] indexed by prompt position
 */
import React, { useState } from "react";
import {
  AutoGrowTextarea,
  PlayerShell,
  PlayerTextValue,
  ContentImage,
  useGrading,
  type PlayerProps,
} from "./shared";
import { EssaySolutionField } from "./EssaySolutionField";
import { normalizeMathDollarSpacing } from "./essay-formula";
import { HideResultBanner, RecordedReceipt } from "./recorded-receipt";
import { useSkin } from "@/core/exercise/skin";
import { twoRowGridClass } from "@/core/exercise/display-layout";

export interface EssayRubricItem {
  criterion: string;
  maxScore: number;
}

/** One picture the pupil writes about — the scan of a workbook frame plus the
 * line printed under it ("Tranh 1", "Tình huống 2 — Em sẽ:"). */
export interface EssayImagePrompt {
  url: string;
  alt?: string;
  label?: string;
}

export interface EssayPlayerProps extends PlayerProps {
  minWords?: number;
  maxWords?: number;
  rubric?: EssayRubricItem[];
  /**
   * Multiple sub-prompts rendered as separate labelled text areas.
   * When provided, `onAnswerChange` fires with `string[]` (one entry per prompt).
   * When absent, falls back to single-textarea mode (answer = string).
   */
  prompts?: string[];
  /**
   * Picture prompts: one workbook scan per answer slot, each with the line
   * printed beneath it in `label`. Zipped with `prompts` by index when both
   * exist; on its own it drives multi-prompt mode the same way `prompts` does,
   * with `label` as the prompt text. Stored under `imagePrompts` in the
   * question payload — books whose stem says "các tranh dưới đây" carry the
   * pictures HERE, not in `content.blocks`.
   */
  imagePrompts?: EssayImagePrompt[];
  /**
   * Cho phép học sinh chèn công thức toán vào bài làm.
   *
   * Tắt mặc định: bài văn Tiếng Việt không cần nút này, và mọi câu tự luận đang
   * chạy giữ nguyên hành vi cũ. Bài làm vẫn là chuỗi — công thức nằm trong đó
   * dưới dạng `\( … \)`.
   */
  allowFormula?: boolean;
  /**
   * Display-only mode: render the prompt/content chrome (via PlayerShell) with
   * no textarea(s), no word count, no submit button, and no locked state. For
   * self-assessed / paper-writing tasks where the student writes in the
   * physical workbook. Distinct from `selfAssessment` / `manualGrading` —
   * those still take input.
   */
  readOnly?: boolean;
  /**
   * Chữ mờ trong ô viết, do content khai (`placeholder` trong payload).
   *
   * Không khai thì giữ chuỗi mặc định của player — "Viết bài của em ở đây..."
   * cho ô đơn, "Viết câu trả lời của em..." cho từng ô của câu nhiều ý. Sách
   * Toán muốn "Viết bài giải của em vào đây", Đạo đức muốn đúng "…" trong
   * khung điền: cùng một ô viết, khác nhau mỗi dòng chữ mờ.
   */
  placeholder?: string;
}

/**
 * Check minWords/maxWords của câu tự luận TẠI ĐƯỜNG NỘP BÀI của runner (web).
 * HIỆN TRẢ `true` VÔ ĐIỀU KIỆN (Owner 8/8): chưa bài nào khai minWords — giữ
 * chỗ cắm đúng vị trí, sau này thay thân hàm bằng phép đếm từ thật.
 */
export function essayAnswerMeetsMinWords(
  _payload: { minWords?: number; maxWords?: number },
  _answer: unknown,
): boolean {
  return true;
}

/** Parent-supplied `answer` → single-mode text (emit shape: string). */
function essaySingleFromAnswer(answer: unknown): string {
  return typeof answer === "string" ? answer : "";
}

/**
 * Parent-supplied `answer` → multi-mode texts. The emit shape is `string[]`
 * indexed by slot (see handleMultiChange/submit); a Record keyed by the slot
 * index ({"0": "…"} — JSON round-trips from older hosts) is accepted too.
 */
function essayMultiFromAnswer(answer: unknown, count: number): string[] {
  const read = (value: unknown): string =>
    typeof value === "string" ? value : value == null ? "" : String(value);
  if (Array.isArray(answer)) {
    return Array.from({ length: count }, (_, i) => read(answer[i]));
  }
  if (answer && typeof answer === "object") {
    const record = answer as Record<string, unknown>;
    return Array.from({ length: count }, (_, i) => read(record[String(i)]));
  }
  return Array.from({ length: count }, () => "");
}

/** An answer slot: the line the pupil reads, and the picture above it. */
interface EssaySlot {
  text?: string;
  image?: EssayImagePrompt;
}

/**
 * Zip `prompts` and `imagePrompts` into one slot list. Either alone drives
 * multi-prompt mode; together they pair by index (picture 1 with prompt 1).
 * An `imagePrompts`-only question uses each picture's `label` as its prompt
 * line, which is exactly what the workbook prints under the frame.
 */
export function essaySlots(
  prompts: string[] | undefined,
  imagePrompts: EssayImagePrompt[] | undefined,
): EssaySlot[] {
  const texts = Array.isArray(prompts) ? prompts : [];
  const images = Array.isArray(imagePrompts) ? imagePrompts.filter((ip) => ip?.url) : [];
  const count = Math.max(texts.length, images.length);
  return Array.from({ length: count }, (_, i) => ({
    text: texts[i] ?? images[i]?.label,
    image: images[i],
  }));
}

/**
 * Câu tự luận mà MỌI ô trả lời đều có tranh riêng ("Hãy mô tả các bước làm
 * khung ảnh" — mỗi bước một ảnh). Chỉ những câu như vậy mới đổi bố cục; ô chữ
 * thuần hoặc câu trộn ảnh-với-chữ giữ nguyên xếp dọc như cũ.
 * (upstream evo-books-web feat/essay-picture-slots-grid)
 */
function essayPictureSlots(slots: EssaySlot[]): boolean {
  return slots.length > 1 && slots.every((s) => Boolean(s.image?.url));
}

/**
 * Trần cao ảnh của MỘT Ô khi câu có từ 3 ô tranh trở lên (14rem = 224px, thấp
 * hơn trần item mặc định 22rem).
 *
 * Đo trên bai9 câu 5 (Mĩ thuật 3, 5 ô): trần 22rem cho mỗi khối cao 468px,
 * cả câu dài 2640px = gần 5 màn cuộn ở vùng làm bài 544px. Từ 3 ô trở lên,
 * ảnh là chuỗi minh hoạ các bước — học sinh liếc để nhận ra bước nào, không
 * cần khổ lớn như một ảnh đơn phải đọc chi tiết. Dưới 3 ô thì giữ 22rem.
 */
const PICTURE_SLOT_MAX_HEIGHT = "14rem";
const PICTURE_SLOT_DENSE_FROM = 3;

/**
 * Picture + prompt line for one slot. The picture IS the content (a workbook
 * frame the pupil must read), so it renders at natural size via ContentImage
 * rather than as a capped thumbnail.
 */
function EssayPromptLabel({
  text,
  skin,
}: {
  text: string;
  skin: ReturnType<typeof useSkin>;
}) {
  // Prompt renders verbatim — the player never prepends its own a./b./c.
  // label; content owns its numbering.
  return (
    <p
      className={`text-sm sm:text-base mb-2 leading-snug ${skin.emphasis?.("neutral", "medium") ?? "font-bold text-slate-800"}`}
    >
      <PlayerTextValue value={text} />
    </p>
  );
}

function EssayPromptHeader({
  slot,
  skin,
  imageMaxHeight,
}: {
  slot: EssaySlot;
  skin: ReturnType<typeof useSkin>;
  /** Trần cao riêng cho ảnh của ô — xem PICTURE_SLOT_MAX_HEIGHT. */
  imageMaxHeight?: string;
}) {
  return (
    <>
      {slot.image && (
        <ContentImage
          src={slot.image.url}
          alt={slot.image.alt ?? ""}
          className="mb-2"
          maxHeight={imageMaxHeight}
        />
      )}
      {slot.text ? <EssayPromptLabel text={slot.text} skin={skin} /> : null}
    </>
  );
}

/**
 * MỘT Ô TRANH trong lưới — ảnh · nhãn · (chỗ viết do caller truyền vào).
 *
 * Ảnh nằm trong khối `flex-1` căn giữa, nhãn và chỗ viết dính đáy: ô lưới cao
 * bằng nhau (grid stretch) nên ảnh CAO THẤP KHÁC NHAU vẫn cho nhãn và ô viết
 * của cả hàng thẳng một đường (Owner 8/8: "ảnh 5 align lệch" — ảnh 5 thấp hơn
 * ảnh 4 nên nhãn (5) trôi lên trên).
 */
function EssayPictureSlot({
  slot,
  skin,
  imageMaxHeight,
  children,
}: {
  slot: EssaySlot;
  skin: ReturnType<typeof useSkin>;
  imageMaxHeight?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center">
        {slot.image && (
          <ContentImage
            src={slot.image.url}
            alt={slot.image.alt ?? ""}
            className="mb-2"
            maxHeight={imageMaxHeight}
          />
        )}
      </div>
      {slot.text ? <EssayPromptLabel text={slot.text} skin={skin} /> : null}
      {children}
    </div>
  );
}

export const EssayPlayer: React.FC<EssayPlayerProps> = ({
  minWords = 0,
  maxWords,
  rubric,
  prompts,
  allowFormula = false,
  imagePrompts,
  readOnly = false,
  placeholder,
  instantFeedback = true,
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  ...shell
}) => {
  const skin = useSkin();
  // Chữ mờ do content khai; khai chuỗi rỗng/toàn khoảng trắng thì coi như
  // không khai, để ô không mất hẳn dòng gợi ý.
  const authoredPlaceholder = placeholder?.trim() || undefined;
  // One slot per prompt: text from `prompts` (or the picture's own `label`),
  // picture from `imagePrompts`, zipped by index when a question carries both.
  const slots = essaySlots(prompts, imagePrompts);
  const multiMode = slots.length > 0;
  // Toàn ô tranh → lưới chia cột tối đa 2 hàng, ảnh trên - chỗ viết dưới, nhãn
  // và ô viết căn đáy; từ 3 ô trở lên hạ trần ảnh.
  const pictureSlots = essayPictureSlots(slots);
  const denseSlotImages = pictureSlots && slots.length >= PICTURE_SLOT_DENSE_FROM;

  if (readOnly) {
    // Display-only: PlayerShell renders the stem chrome (title/instruction/
    // blocks) from `shell`; the pictures still belong to the question, so they
    // render here — no input, no submit, no grading callbacks in this mode.
    return (
      <PlayerShell {...shell} submitted={submitted}>
        {multiMode ? (
          // Cùng bố cục với chế độ làm bài để màn duyệt nội dung thấy đúng
          // thứ học sinh thấy (chỉ khác: không có ô viết).
          <div className={pictureSlots ? twoRowGridClass(slots.length) : "space-y-5"}>
            {slots.map((slot, i) =>
              pictureSlots ? (
                <EssayPictureSlot
                  key={i}
                  slot={slot}
                  skin={skin}
                  imageMaxHeight={denseSlotImages ? PICTURE_SLOT_MAX_HEIGHT : undefined}
                />
              ) : (
                <div key={i}>
                  <EssayPromptHeader slot={slot} skin={skin} />
                </div>
              ),
            )}
          </div>
        ) : null}
      </PlayerShell>
    );
  }

  // Single mode state — hydrated from the parent-owned `answer` (restore channel).
  const [text, setText] = useState(() => essaySingleFromAnswer(answer));
  // Multi mode state — hydrated by slot index from `answer` (string[] emit shape).
  const [texts, setTexts] = useState<string[]>(() => essayMultiFromAnswer(answer, slots.length));

  /**
   * Chuẩn hoá `$ … $` CHỈ ở đường phát ra ngoài, không phải ở state nuôi lại ô.
   *
   * Chuẩn hoá ngay trong `onChange` thì giá trị đẩy ngược về trường khác thứ
   * trường vừa phát ra, `MathField` nạp lại giữa chừng và MathLive vỡ khi parse.
   * State giữ nguyên văn bản của trường; bản chuẩn hoá chỉ dành cho bài làm gửi lên.
   */
  const forAnswer = (value: string) =>
    allowFormula ? normalizeMathDollarSpacing(value) : value;

  // Rehydrate only when the parent supplies a semantically different answer
  // (YesNoPlayer's selectionKey pattern): echoes of our own onAnswerChange come
  // back as the same value and must not clobber in-progress typing.
  const answerKey = JSON.stringify(answer ?? null);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    // So trên dạng ĐÃ PHÁT RA: state giữ văn bản thô của trường, còn cha vọng lại
    // bản chuẩn hoá. So thô với chuẩn hoá thì tiếng vọng của chính mình cũng bị
    // coi là bài làm mới, và ô bị nạp lại giữa lúc học sinh đang gõ.
    const currentKey = JSON.stringify(multiMode ? texts.map(forAnswer) : forAnswer(text));
    if (currentKey !== answerKey) {
      if (multiMode) setTexts(essayMultiFromAnswer(answer, slots.length));
      else setText(essaySingleFromAnswer(answer));
    }
  }

  // web-own (SBT-61): nút "Nộp câu trả lời" trong câu chỉ bật dòng ghi nhận, KHÔNG khoá
  // câu — chỉ `submitted` (nộp cả bài) mới khoá. Sửa bài thì dòng tắt, nút hiện lại.
  const [confirmed, setConfirmed] = useState(false);
  const { report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const locked = submitted;
  const hasAnswer = multiMode ? texts.some((t) => t.trim() !== "") : text.trim() !== "";

  const handleSingleChange = (val: string) => {
    setText(val);
    setConfirmed(false);
    onAnswerChange?.(forAnswer(val));
  };

  const handleMultiChange = (idx: number, val: string) => {
    const next = texts.map((t, i) => (i === idx ? val : t));
    setTexts(next);
    setConfirmed(false);
    onAnswerChange?.(next.map(forAnswer));
  };

  const submit = () => {
    if (locked || !hasAnswer) return;
    setConfirmed(true);
    report(multiMode ? texts.map(forAnswer) : forAnswer(text), "incomplete");
  };

  // `resize-none`: ô đã tự cao đúng bằng nội dung (AutoGrowTextarea) nên tay
  // kéo chỉ tồn tại đến lần gõ kế tiếp rồi bị JS đặt lại — bỏ hẳn tay kéo cho
  // một hành vi duy nhất, giống ô tự luận trong bảng.
  const textareaClass = (locked: boolean) =>
    skin.input?.("idle")
      ? `w-full resize-none ${skin.input("idle")}`
      : `w-full resize-none px-4 py-3 rounded-2xl border-4 font-bold text-base md:text-lg outline-none transition-all ${
          locked
            ? "bg-rose-50 border-rose-300 text-slate-800"
            : "bg-white border-rose-300 text-slate-800 focus:border-rose-500"
        }`;

  /**
   * Ô nhập của một phần bài làm.
   *
   * `allowFormula` → MỘT trường MathLive: văn xuôi mặc định, nút bàn phím của
   * trường mở bàn phím công thức, Enter xuống dòng. Không có cờ thì giữ nguyên
   * `<textarea>` cũ — bài văn Tiếng Việt không cần bàn phím toán.
   */
  const renderInput = (
    slotValue: string,
    onSlotChange: (value: string) => void,
    ariaLabel: string,
    slotPlaceholder: string,
    rows: number,
  ) =>
    allowFormula ? (
      <EssaySolutionField
        value={slotValue}
        onChange={onSlotChange}
        disabled={locked}
        ariaLabel={ariaLabel}
        placeholder={slotPlaceholder}
        // Dùng CHUNG lớp với `<textarea>` bên dưới: hai ô cùng là chỗ viết bài
        // nên chúng phải giống nhau ở mọi skin, khác nhau mỗi việc có gõ được
        // công thức hay không.
        className={textareaClass(locked)}
        rows={rows}
      />
    ) : (
      <AutoGrowTextarea
        rows={rows}
        value={slotValue}
        onChange={onSlotChange}
        disabled={locked}
        placeholder={slotPlaceholder}
        className={textareaClass(locked)}
      />
    );

  return (
    <HideResultBanner>
    <PlayerShell {...shell} submitted={submitted}>
      {rubric && rubric.length > 0 && (
        <div
          className={`mb-4 p-3 md:p-4 ${
            // rubric box là card đứng độc lập, không phải well lõm — corporate cần
            // bg-primary-light (UI_04.3); panel("card"), không "inset".
            skin.panel?.("card") ?? "bg-rose-50 border-4 border-rose-200 rounded-2xl"
          }`}
        >
          <p
            className={`mb-2 text-sm sm:text-base ${
              skin.emphasis?.("primary", "strong") ?? "font-black text-rose-700"
            }`}
          >
            Tiêu chí chấm điểm:
          </p>
          <ul className="space-y-1">
            {rubric.map((r, i) => (
              <li
                key={i}
                className={`text-sm sm:text-base flex justify-between gap-3 ${
                  skin.emphasis?.("primary", "medium") ?? "font-bold text-rose-600"
                }`}
              >
                <span>• {r.criterion}</span>
                <span className="shrink-0">{r.maxScore} đ</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {multiMode ? (
        // ── Multi-prompt mode ──────────────────────────────────────────────
        // Câu TOÀN Ô TRANH xếp LƯỚI 2 CỘT, trong mỗi ô thì ảnh nằm CẠNH chỗ
        // viết (Owner 8/8): xếp dọc một cột làm ảnh chỉ chiếm nửa bề ngang,
        // nửa còn lại bỏ trống, mà cả câu dài gần 5 màn cuộn. Câu có ô chữ
        // thuần giữ nguyên xếp dọc.
        <div className={pictureSlots ? twoRowGridClass(slots.length) : "space-y-5"}>
          {slots.map((slot, i) =>
            pictureSlots ? (
              // Ô tranh: ảnh căn giữa khối co giãn, nhãn + chỗ viết dính đáy →
              // cả hàng thẳng một đường dù ảnh cao thấp khác nhau.
              <EssayPictureSlot
                key={i}
                slot={slot}
                skin={skin}
                imageMaxHeight={denseSlotImages ? PICTURE_SLOT_MAX_HEIGHT : undefined}
              >
                {/* Mỗi ô 2 dòng lúc trống là đủ nhìn thấy cả cụm (Owner 8/8);
                    viết dài thì ô tự cao lên. */}
                {renderInput(
                  texts[i],
                  (val) => handleMultiChange(i, val),
                  `Viết câu trả lời ý ${i + 1}`,
                  authoredPlaceholder ?? "Viết câu trả lời của em...",
                  2,
                )}
              </EssayPictureSlot>
            ) : (
              <div key={i}>
                <EssayPromptHeader slot={slot} skin={skin} />
                {/* Mỗi ô 2 dòng lúc trống là đủ nhìn thấy cả cụm (Owner 8/8);
                    viết dài thì ô tự cao lên. */}
                {renderInput(
                  texts[i],
                  (val) => handleMultiChange(i, val),
                  `Viết câu trả lời ý ${i + 1}`,
                  authoredPlaceholder ?? "Viết câu trả lời của em...",
                  2,
                )}
              </div>
            ),
          )}
        </div>
      ) : (
        // ── Single-prompt mode ─────────────────────────────────────────────
        // 4 dòng lúc mở (Owner 8/8): 8 dòng chiếm gần hết màn, đẩy nút xuống
        // dưới nếp gấp. 4 dòng là SÀN — viết dài thì ô tự cao thêm đúng bằng
        // nội dung, không còn cuộn bên trong một hộp cố định (WEB20/WEB25).
        renderInput(
          text,
          handleSingleChange,
          "Viết bài của em",
          authoredPlaceholder ?? "Viết bài của em ở đây...",
          4,
        )
      )}

      {/* web-own (SBT-61): mọi chế độ đều có nút, mờ khi chưa viết gì; minWords vẫn
          chặn ở đường Nộp bài của runner — xem essayAnswerMeetsMinWords. */}
      <RecordedReceipt locked={locked} hasAnswer={hasAnswer} confirmed={confirmed} onSubmit={submit} />
    </PlayerShell>
    </HideResultBanner>
  );
};
