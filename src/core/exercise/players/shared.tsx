/**
 * Shared kit for the 39 question players.
 *
 * Every player is a standalone component: it self-grades, reports the current
 * answer via `onAnswerChange`, fires `onComplete` once fully correct, and
 * surfaces a coarse status via `onStatusChange`.
 *
 * Players are selected by (schema `type` + `display.interactionType`, with
 * legacy matching `layout` fallback) — see ./manifest.ts. The kit below removes
 * the per-file boilerplate (header chrome,
 * status plumbing, feedback sounds) so each player only contains its
 * interaction logic.
 */
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import type { TaskStatus } from "../tasks/types";
import { playSuccess, playError } from "../tasks/AudioUtils";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import { useSkin, type QuestionPlayerSkin } from "@/core/exercise/skin";
import { useAccent } from "@/core/exercise/skin/accent-context";
import { MathRenderer } from "@/core/math/MathRenderer";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { plainTextFromHtml, plainTextFromRichContent, plainTextFromRuns } from "@/core/rich-text/html";
import type { RichContent, RichContentBlock, RichTextRun } from "@/core/question-schema";
import {
  BLANK_MARKER_RE,
  blankIdFromMarker,
  splitRichRunsAroundBlankMarkers,
  splitTextAroundBlankMarkers,
} from "./blank-markers";
import {
  mediaRunGridClass,
  mediaRunGridKey,
  videoRunGridClass,
  videoRunGridKey,
  type LayoutInput,
} from "../display-layout";
import {
  getLayoutBlockColumns,
  getLayoutBlockVariant,
} from "@/core/rich-text/content-layout";
import { getBlockMediaUrl } from "@/core/rich-text/media-blocks";
import { flattenNestedContentBlocks } from "@/core/rich-text/nested-blocks";
import { itemImageWidth } from "@/core/question-schema/item-image-width";
import { contentTableCellText } from "@/core/question-schema/table";
import { cn } from "@/core/utils";

export type { TaskStatus };
export { playSuccess, playError };

export type PlayerText = string | RichTextRun[];

/** true khi PlayerText không có chữ nào (rỗng/toàn khoảng trắng, cả dạng runs). */
export function playerTextIsEmpty(value?: PlayerText | null): boolean {
  if (value == null) return true;
  const raw = Array.isArray(value) ? plainTextFromRuns(value) : value;
  return raw.trim() === "";
}

/** Shared text boundary for exercise players, including rich text and math. */
export function PlayerTextValue({
  value,
  className,
}: {
  value?: PlayerText | null;
  className?: string;
}) {
  return <RichTextValue value={value} className={className} />;
}

/**
 * Grading mode — supplied by the parent through context (see dispatch.tsx).
 *
 *  - "self"   (default): the player computes the verdict, plays feedback sounds
 *    and shows per-element correct/wrong styling. Backwards-compatible.
 *  - "parent": the player ONLY emits the answer via onAnswerChange. It does not
 *    decide correctness, play sounds, or fire onComplete. The parent grades
 *    (see gradeByType) and feeds the overall `result` back for display.
 */
/**
 * Chế độ chấm mà HOST khai báo.
 *  - "self"   : player tự chấm và phản hồi ngay cho học sinh.
 *  - "parent" : player chỉ phát đáp án; host sở hữu verdict (thi / bài GV giao).
 *  - "silent" : player VẪN tự chấm chính xác theo loại của nó, nhưng KHÔNG phản
 *    hồi tức thời — không tô màu, không âm thanh, không khoá câu, không nút
 *    "Kiểm tra", không mascot. Verdict đi tới host qua `onSilentVerdict`, và
 *    ResultBanner chỉ hiện SAU KHI nộp (`submitted`).
 */
export type GradeMode = "self" | "parent" | "silent";

/**
 * Mode nhìn từ BÊN TRONG player. "silent" được ánh xạ thành "parent" ở tầng
 * context (xem dispatch.renderInteractionPlayer): 41 player đã neo chrome tự
 * chấm vào `mode !== "parent"` và 59 player khoá câu theo `status`, nên ánh xạ
 * này cho "silent" hưởng trọn hành vi câm mà KHÔNG phải sửa file player nào.
 * Cờ `silent` trong context phân biệt hai bên khi cần.
 */
export type InnerGradeMode = "self" | "parent";

export interface GradeModeValue {
  mode: InnerGradeMode;
  /** Parent-supplied overall verdict, shown by PlayerShell in "parent" mode. */
  result?: "correct" | "incorrect" | "incomplete";
  /**
   * Host renders its own verdict UI (practice FeedbackBox…) — suppress the
   * shell's ResultBanner so the learner never sees two banners. (web-delta)
   */
  hideBanner?: boolean;
  /**
   * Chấm KÍN (mode "parent"): player vẫn tính verdict theo ngữ nghĩa loại của
   * CHÍNH NÓ — thứ chính xác nhất hệ thống có. Kênh này đưa verdict đó cho host
   * ghi nhận mà KHÔNG hiển thị gì: không status, không âm thanh, không tô màu.
   * Host không cần thì bỏ trống. (web-delta)
   */
  onSilentVerdict?: (verdict: Verdict) => void;
  /** Host khai "silent" (khác "parent" thật: player vẫn tự chấm, chỉ câm). */
  silent?: boolean;
  /**
   * Verdict player tự chấm gần nhất, do tầng context giữ. PlayerShell dùng nó
   * vẽ ResultBanner khi `submitted` — banner phản ánh chính bài chấm của player
   * chứ không cần host bơm `result` từng câu.
   */
  silentVerdict?: Verdict;
  /**
   * When false, a wrong submission highlights only the learner's OWN wrong
   * picks — unpicked correct options stay unmarked so retry/review does not
   * leak the answer key (web BUG-03). Default true = studio/QA behaviour:
   * reveal the correct option after submit.
   */
  revealCorrect?: boolean;
}

export const GradeModeContext = createContext<GradeModeValue>({ mode: "self" });

export const useGradeMode = () => useContext(GradeModeContext);

/**
 * Ô viết CAO DẦN theo nội dung học sinh gõ — primitive dùng chung cho mọi
 * player có vùng viết dài (ô tự luận trong bảng, câu essay…).
 *
 * Vì sao cần: `rows` chỉ đặt cỡ LÚC TRỐNG. Gõ quá số dòng đó thì chữ cuộn bên
 * trong một hộp cố định — học sinh không đọc lại được cả câu mình vừa viết. Tự
 * giãn bỏ hẳn cái hộp cố định đó.
 *
 * `rows` ở đây là **SÀN**, không phải cỡ chết: ô mở ra đúng `rows` dòng lúc còn
 * trống (essay 4 dòng / ô bảng 1 dòng) rồi chỉ nở thêm, không bao giờ tụt xuống
 * dưới sàn. Không kẹp sàn thì `scrollHeight` của ô trống chỉ bằng 1 dòng và
 * thuộc tính `rows` bị chính chiều cao JS đặt vào đè mất.
 *
 * Ba chỗ phải đo lại, không chỉ lúc gõ:
 *  - lúc MOUNT: bài làm cũ khôi phục qua `value` phải cao đúng ngay từ đầu;
 *  - khi ĐỔI BỀ RỘNG (cửa sổ co, cột bảng đổi): chữ xuống dòng khác đi;
 *  - khi `value` bị đặt lại từ ngoài (làm lại bài).
 *
 * KHÔNG áp khi tác giả khai chiều cao ô (`fixedHeight`): con số đó là khoá hộp,
 * tự giãn sẽ đá nhau với nó (Tầng 2 — ý đồ tác giả thắng).
 */
export const AutoGrowTextarea = React.forwardRef<
  HTMLTextAreaElement,
  {
    className: string;
    /** Số dòng lúc trống — đồng thời là SÀN chiều cao khi tự giãn. */
    rows: number;
    /** Tác giả đã khai chiều cao cố định → tắt tự giãn. */
    fixedHeight?: boolean;
    value: string;
    onChange: (value: string) => void;
  } & Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "className" | "rows" | "value" | "onChange"
  >
>(function AutoGrowTextarea(
  { className, rows, fixedHeight = false, value, onChange, ...rest },
  forwardedRef,
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Ref nội bộ dùng để ĐO, nên không nhường cho bên gọi được; thay vào đó gắn
  // thêm ref của bên gọi (ô blank cần nó cho tay kéo đổi cỡ ở trình soạn).
  useLayoutEffect(() => {
    if (!forwardedRef) return;
    if (typeof forwardedRef === "function") {
      forwardedRef(ref.current);
      return () => forwardedRef(null);
    }
    forwardedRef.current = ref.current;
    return () => {
      forwardedRef.current = null;
    };
  }, [forwardedRef]);

  // useLayoutEffect: khôi phục bài làm cũ phải cao đúng NGAY khung hình đầu.
  // Với useEffect, ô sơn ở 1 dòng rồi mới giãn ra — nhìn thành một cú giật, và
  // đẩy cả bảng xuống (cùng họ lỗi "màn hình nháy" Owner báo 9/8).
  useLayoutEffect(() => {
    if (fixedHeight) return;
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      // `auto` trước rồi mới đọc `scrollHeight`: không reset thì scrollHeight
      // kẹt ở chiều cao đang có và ô chỉ phình ra chứ không co lại được.
      el.style.height = "auto";
      // `scrollHeight` KHÔNG tính viền, mà ô đang `box-sizing: border-box` với
      // `border-4` — đặt height = scrollHeight thì vùng chữ hụt đúng 8px và ô
      // vẫn cuộn bên trong dù nhìn như đã giãn đủ (đo được ở ca thật).
      const style = getComputedStyle(el);
      const borderBox = style.boxSizing === "border-box";
      const border = borderBox
        ? parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
        : 0;
      // Sàn = `rows` dòng chữ + padding (+ viền khi border-box). `line-height`
      // có thể là "normal" (không đọc ra số) → lùi về 1.5×font-size, đúng tỷ lệ
      // Tailwind dùng cho cỡ chữ base/lg của ô viết.
      const fontSize = parseFloat(style.fontSize) || 16;
      const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.5;
      const padding = borderBox
        ? parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        : 0;
      const floor = rows * lineHeight + padding + border;
      el.style.height = `${Math.max(el.scrollHeight + border, floor)}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    // Quan sát chính ô: bề rộng đổi (cửa sổ co, cột bảng co) thì chữ xuống dòng
    // khác đi, phải đo lại. `window.resize` không đủ vì cột còn co theo nội dung
    // của ô khác.
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, fixedHeight, rows]);

  return (
    <textarea
      {...rest}
      ref={ref}
      // `h-full` của `inputBase` phải bị đè: nó ép ô lấp đầy ô bảng nên chiều
      // cao do JS đặt không có tác dụng. Ô khai chiều cao thì giữ nguyên.
      className={fixedHeight ? className : `${className} h-auto`}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
});

/**
 * Ô điền RỘNG DẦN theo chữ học sinh gõ — primitive dùng chung cho ô một dòng
 * (blank của cloze / fill_blank…), song sinh với `AutoGrowTextarea` ở trên.
 *
 * Vì sao cần: `<input>` không bao giờ xuống dòng. Đặt `width` cứng cho nó thì
 * chữ dài hơn hộp sẽ CUỘN NGANG BÊN TRONG — phần vượt biến mất khỏi màn hình,
 * học sinh không đọc lại được đáp án mình vừa viết, cũng không soát được lỗi.
 * Đo trên kho: ô mặc định 7rem (≈88px vùng chữ, ≈8–9 ký tự đậm) trong khi
 * 16,5% ô blank có đáp án dài hơn 8 ký tự (837 ô > 10 ký tự, 244 ô > 20).
 * Ca báo lỗi `18-toan-4/bai1` câu 3 cần 29 ký tự — mất hai phần ba.
 *
 * Cách đo: KHÔNG dùng JS. Một bản sao chữ (`mirror`) mang **đúng cùng
 * `className`** với ô nhập nằm chồng ô nhập trong một `inline-grid` 1×1 — cùng
 * padding, viền, cỡ chữ, độ đậm nên rộng đúng bằng nhau. Rãnh grid rộng theo
 * cái to hơn, ô nhập `w-full` bám theo. Không `ResizeObserver`, không đo lại
 * lúc gõ, không giật khung: trình duyệt tự lo, kể cả khi đổi cỡ chữ hay font.
 *
 * SÀN là `minWidth` truyền vào (cỡ lúc trống, giữ nguyên như trước khi có tự
 * giãn); TRẦN là bề rộng dòng (`max-w-full`) — vượt nữa thì ô tự xuống dòng
 * riêng nhờ `flex-wrap` của dòng chứa nó, không đẻ ra cuộn ngang toàn trang.
 * Ô trong BẢNG đổi cả hai qua `wrapperClassName` (sàn = bề rộng cột, không
 * trần): ở đó cái nở ra là CỘT, và khung bảng đã có sẵn cuộn ngang riêng.
 *
 * KHÔNG áp khi tác giả khai `width` / `input.size`: con số đó là khoá hộp, y
 * như `fixedHeight` của `AutoGrowTextarea` (Tầng 2 — ý đồ tác giả thắng). Bên
 * gọi quyết định điều đó bằng cách vẫn đặt `maxWidth` cứng.
 */
export const AutoGrowInput = React.forwardRef<
  HTMLInputElement,
  {
    className: string;
    /** Cỡ ô lúc chưa có chữ + trần (khi tác giả khai width) — đặt lên khung grid. */
    style?: React.CSSProperties;
    /**
     * Lớp của KHUNG grid. Mặc định là ô inline trong dòng chữ: trần = bề rộng
     * dòng (`max-w-full`). Ô trong BẢNG đổi luật (`w-max min-w-full`): sàn là
     * bề rộng cột, không trần — max-content của bản sao chữ chảy lên `<td>` và
     * kéo cả cột rộng ra. Xem `TableTextCell`.
     *
     * `w-max` là bắt buộc: khung `inline-grid` bề rộng auto co vừa bề rộng Ô
     * BẢNG, bản sao chữ tràn ra ngoài mà không kéo được cột nào — đo P45, gõ
     * 72 ký tự thì ô đứng im 489px và giấu 219px chữ, y như trước khi sửa.
     */
    wrapperClassName?: string;
    value: string;
    onChange: (value: string) => void;
  } & Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "className" | "style" | "value" | "onChange" | "type"
  >
>(function AutoGrowInput(
  { className, style, wrapperClassName, value, onChange, ...rest },
  ref,
) {
  return (
    <span
      className={wrapperClassName ?? "inline-grid max-w-full align-middle"}
      style={style}
    >
      {/* Bản sao chữ chỉ để ĐO: cùng className nên cùng hộp; `invisible` giữ chỗ
          (khác `hidden`), `whitespace-pre` để dấu cách cuối cũng được tính.
          `aria-hidden` + không focus được nên trình đọc màn hình không thấy. */}
      <span
        aria-hidden="true"
        className={`${className} col-start-1 row-start-1 invisible whitespace-pre`}
        // `width: auto` đè mọi lớp bề rộng có sẵn trong `className` (ô bảng
        // dùng chung `inputBase` có `w-full`): bản sao chữ mà rộng 100% rãnh
        // thì nó không còn ĐO gì nữa, ô đứng im ở cỡ cột.
        style={{ width: "auto", minWidth: 0, maxWidth: "none" }}
      >
        {/* Đệm một ký tự: nếu ô rộng khít chữ thì con trỏ nháy nằm ngay trên
            viền, gõ tiếp không thấy mình đang gõ ở đâu. */}
        {`${value} `}
      </span>
      <input
        {...rest}
        ref={ref}
        type="text"
        // `size` mặc định của `<input>` là 20 KÝ TỰ, và rãnh grid `auto` tính
        // theo cỡ nội tại đó chứ không theo `width:100%` — để nguyên thì ô
        // trống rộng ~218px thay vì đứng đúng sàn 112px (đo trên /dev/players).
        // `size=1` trả quyền quyết cỡ về cho sàn `min-width` và bản sao chữ.
        size={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${className} col-start-1 row-start-1 w-full min-w-0`}
      />
    </span>
  );
});

/** Minimal shape of a content block used by PlayerHeader. */
export type ContentBlock = RichContentBlock;

export function textAlignClass(align?: string): string {
  switch (align) {
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    case "justify":
      return "text-justify";
    default:
      return "";
  }
}

function blockTextAlignClass(block: ContentBlock): string {
  const align = (block as ContentBlock & { align?: string }).align;
  const className = textAlignClass(align);
  return className ? ` ${className}` : "";
}

/**
 * web-own: block MANG CHỮ — ứng viên duy nhất cho typography đề bài.
 *
 * Nhà của nó phải là đây, cạnh {@link RichContentBlocks} — nơi quyết định thăng
 * cấp thật sự diễn ra. `splitClozeContentAtFirstBlank` (dispatch.tsx) cắt header
 * cloze bằng CHÍNH vị từ này: cắt tới một block mà RichContentBlocks lại từ chối
 * thăng cấp thì header ra không tiêu đề, không thanh accent, và không test nào
 * đỏ vì mỗi bên vẫn tự nhất quán. Hai bản sao là hai nguồn sự thật — giữ MỘT.
 */
export function blockRendersAsStem(block: ContentBlock): boolean {
  if (block.type !== "paragraph" && block.type !== "heading") return false;
  const text = Array.isArray(block.content) ? plainTextFromRuns(block.content) : block.text ?? "";
  return text.trim().length > 0;
}

/**
 * web-own: KHOẢNG ĐỆM mở đầu content — thứ đứng trước đề bài mà không phải đề
 * bài. Chỉ có hai loại: media dẫn nhập và đoạn rỗng (spacer #503).
 *
 * Cố ý KHÔNG gộp list/quote/table/math vào đây. Bước qua chúng thì đoạn văn
 * đứng sau — thường là chú thích hoặc nguồn dẫn — bị thăng cấp thành tiêu đề
 * câu hỏi và thanh accent rơi xuống tận đáy content.
 */
const LEAD_SPACER_MEDIA_TYPES = new Set(["image", "video", "audio"]);

function isLeadSpacerBlock(block: ContentBlock): boolean {
  if (LEAD_SPACER_MEDIA_TYPES.has(String(block.type ?? ""))) return true;
  if (block.type !== "paragraph" && block.type !== "heading") return false;
  const text = Array.isArray(block.content) ? plainTextFromRuns(block.content) : block.text ?? "";
  return text.trim().length === 0;
}

/**
 * Render an item's rich text blocks preserving per-block alignment (left/center/
 * right/justify), reusing PlayerTextValue for bold/italic/etc. runs. Unlike
 * RichContentBlocks this adds no heading/accent/margin chrome — the caller's card
 * already owns its typography — so it drops cleanly into matching/option cards
 * where only alignment + inline formatting need to survive.
 *
 * Image/media blocks are intentionally skipped: matching players render their own
 * item image via a dedicated `imageUrl` prop, so this only handles text-like blocks.
 * Falls back to the plain `fallback` string for legacy items that carry only
 * `text`/`label` and no rich content.
 */
export function AlignedRichText({
  blocks,
  fallback,
}: {
  blocks?: ContentBlock[];
  fallback?: string;
}): React.ReactElement {
  const textBlocks = flattenNestedContentBlocks(blocks).filter(
    (b) => b.type === "paragraph" || b.type === "heading" || b.type === "quote",
  );
  // #931: the fallback is authored content too — `\( … \)` in an item's
  // `text`/`label` must build a formula, not print the delimiters.
  if (textBlocks.length === 0) return <PlayerTextValue value={fallback ?? ""} />;
  return (
    <>
      {textBlocks.map((block, i) => (
        <div key={i} className={textAlignClass((block as ContentBlock & { align?: string }).align) || undefined}>
          <PlayerTextValue value={block.content ?? block.text} />
        </div>
      ))}
    </>
  );
}

/**
 * Whether a choice player should show its generated A./B./C. option prefix.
 * Decided purely from presentation, never from option content:
 * - plain checkbox/radio in "list" layout already render a marker per row —
 *   a second letter label is redundant chrome, hide it;
 * - "circle" / "color_fill" keep the letter (it IS what the learner marks),
 *   and compact pill layouts (inline/grid) keep it as the reference handle.
 *
 * `choicePill` (skin.presentation.choicePill, surface học sinh): pill chrome
 * mọi layout — "pill không phải layout". Nhánh radio-row theo list không render
 * nữa, nên "radio" không còn bị ẩn label ở list: pill web luôn in chữ cái "A."
 * bất kể layout (checkbox list vẫn ẩn — tick marker đã là chrome per-row).
 */
export function showGeneratedOptionLabels(
  variant: string,
  layoutKey: string,
  opts?: { choicePill?: boolean },
): boolean {
  if (opts?.choicePill) return !(layoutKey === "list" && variant === "checkbox");
  return !(layoutKey === "list" && (variant === "checkbox" || variant === "radio"));
}

/**
 * The option-letter rule lives in @/core/question-schema/option-label so the
 * players and the editing engine (which lets a human correct the letter) share
 * one copy — see that module for why an index-derived letter is wrong.
 */
export { optionDisplayLabel } from "@/core/question-schema/option-label";

/**
 * The "circle"/"khoanh tròn" interaction: the option letter (A, B, C…) with a
 * hand-drawn circle that is *drawn* around it when the option is picked —
 * mirroring how a pupil slowly circles an answer with a pen in a paper
 * workbook. Used by the single/multiple choice players when
 * `interactionType === "circle"`.
 *
 * The stroke is drawn, not faded in: `pathLength` grows 0 → 1 over ~1.6s
 * (the pen travelling around the letter) while `opacity` snaps on almost
 * instantly, so the line is visible as it is being traced. Starting from an
 * explicit `initial` (rather than `initial={false}`) means the draw also plays
 * when the marker mounts already selected — e.g. a QA preview or answer reveal
 * shows the pen going around the letter instead of a circle just appearing.
 */
export function CircleLetterMarker({
  label,
  state,
  accent = "#3b82f6",
}: {
  label: string;
  state: "idle" | "selected" | "correct" | "wrong";
  /** Stroke colour for the idle/selected states (correct/wrong stay green/red). */
  accent?: string;
}) {
  const active = state !== "idle";
  const stroke =
    state === "correct" ? "#22c55e" : state === "wrong" ? "#ef4444" : accent;
  return (
    <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center text-base font-black leading-none sm:text-lg">
      <span style={active ? { color: stroke } : undefined} className={active ? undefined : "text-slate-800"}>
        {label}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 40 40"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        {/*
          One continuous path that starts and ends at the top (12 o'clock) so
          the stroke traces as a SINGLE pen head sweeping around once — rather
          than a <circle>, whose stroke starts at 3 o'clock and leaves both
          rounded ends at the top, reading as two tips.

          HÌNH TRÒN ĐÚNG NGHĨA, bán kính 15/15 (Owner 9/8: "tôi muốn một hình
          tròn"). Bản trước là ellipse 16/14 — bẹt 14% — cộng `-rotate-6` nên
          đọc ra hình bầu dục nghiêng.

          `-rotate-6` đã GỠ theo: xoay một hình tròn không đổi gì, giữ lại chỉ
          làm người đọc sau tưởng nó còn tác dụng. Chất "vẽ tay" giờ nằm ở nét
          bo tròn đầu + hiệu ứng vẽ dần 1,6s bên dưới, không ở hình dạng nữa.
        */}
        <motion.path
          d="M 20 5 A 15 15 0 0 1 20 35 A 15 15 0 0 1 20 5"
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }}
          transition={{
            // The stroke fades in almost instantly, then the pen traces the
            // circle slowly and smoothly — like drawing it by hand, not popping.
            pathLength: { duration: 1.6, ease: [0.22, 0.61, 0.36, 1] },
            opacity: { duration: 0.3, ease: "easeOut" },
          }}
        />
      </svg>
    </span>
  );
}

/** Solid fill colour for a color_fill option card by state. */
function colorFillColor(
  state: "idle" | "selected" | "correct" | "wrong",
  accent: string,
): string {
  return state === "correct" ? "#22c55e" : state === "wrong" ? "#ef4444" : accent;
}

/**
 * Grading feedback colours shared across players — green = correct answer, red =
 * wrong answer. First consumer is the image_color region player; the other
 * players still inline these hex values pending refactor.
 */
export const CORRECT_COLOR = "#22c55e";
export const WRONG_COLOR = "#ef4444";

/**
 * The crayon box offered to the pupil for a `color_fill` question: they pick a
 * colour first, then tap the options to colour them in — the paper-workbook
 * gesture ("tô màu xanh vào…"), instead of every pick landing in one fixed
 * accent. Mirrors the reference workbook demo's colour tray.
 *
 * Deliberately excludes green-as-correct (`#22c55e`) and red-as-wrong
 * (`#ef4444`): those two are the grading colours a card flips to after
 * "Kiểm tra", so offering them as crayons would let a pupil colour a card into
 * something that reads as already-graded. Teal stands in for green.
 *
 * The chosen colour is presentation only — it never enters the reported answer
 * (still the option ids), so no schema or grading behaviour depends on it. It
 * lives in player-local state, which means a rehydration from the `answer` prop
 * repaints the restored picks in the default crayon.
 */
export const COLOR_FILL_PALETTE = [
  "#3b82f6", // xanh dương
  "#ec4899", // hồng
  "#f59e0b", // vàng cam
  "#14b8a6", // xanh ngọc
  "#a855f7", // tím
] as const;

/** Crayon tray for the color_fill interaction — pick the colour, then the cards. */
export function ColorFillPalette({
  colors = COLOR_FILL_PALETTE as readonly string[],
  selected,
  onSelect,
}: {
  colors?: readonly string[];
  selected: string;
  onSelect: (color: string) => void;
}) {
  const skin = useSkin();
  return (
    // A group of pressed-state buttons rather than a radiogroup: the option
    // cards below are the question's real radio/checkbox group, and a second
    // `role="radio"` set in the same player would make "the options" ambiguous
    // to both assistive tech and any `[role="radio"]` query.
    <div
      role="group"
      aria-label="Chọn màu tô"
      data-color-fill-palette=""
      className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3"
    >
      <span className={`text-sm ${skin.emphasis?.("neutral", "soft") ?? "font-bold text-slate-500"}`}>
        Chọn màu:
      </span>
      {colors.map((color) => {
        const active = selected === color;
        return (
          <motion.button
            key={color}
            type="button"
            aria-pressed={active}
            aria-label={`Màu ${color}`}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => onSelect(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "h-8 w-8 rounded-full border-4 shadow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:h-9 sm:w-9",
              active ? "scale-110 border-foreground" : "border-white ",
            )}
          />
        );
      })}
    </div>
  );
}

/**
 * The diagonal "shine" that sweeps *continuously* across a color_fill card while
 * it is active — the crayon-stroke wave from the reference workbook demo
 * (`sbt-demo…/?book=viet2`). Matching the demo's own markup, a full-bleed
 * (`inset-0`) skewed translucent-white band (`bg-white/20 skew-x-12`) travels
 * left → right on an infinite loop, so the fill visibly pulses between the solid
 * colour and a lighter shade like a wave, rather than filling once and sitting
 * static. The card is `relative overflow-hidden` so the skewed band is clipped
 * to the pill; it sits behind the label (`z-0`). The band travels at a steady,
 * constant pace (`linear`, no `repeatDelay`) so the wave glides across
 * continuously rather than pulsing in beats. The band is always in the DOM
 * (matching the demo, which renders it on every card) but only *loops* while
 * active — an idle card parks it off the left edge with no running animation, so
 * unselected options don't each drive a perpetual rAF. When a card mounts
 * already selected (QA preview / answer reveal) the loop starts immediately.
 */
function ColorFillSheen({ active }: { active: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 skew-x-12 bg-white/20"
      initial={{ x: "-100%" }}
      animate={{ x: active ? "100%" : "-100%" }}
      transition={
        active
          ? {
            duration: 2.4,
            ease: "linear",
            repeat: Infinity,
            repeatType: "loop",
          }
          : { duration: 0 }
      }
    />
  );
}

/**
 * The "color_fill"/"tô màu" interaction: instead of a per-letter marker, the
 * WHOLE option card is *coloured in* when picked — matching the reference
 * workbook demo (`?book=viet2`), where selecting a card floods it with a solid
 * colour (white bold text, white border) as a crayon-shine sweeps across. Used
 * by the single/multiple choice players when `interactionType === "color_fill"`,
 * one card per option, for both `radio` (single) and `checkbox` (multiple).
 *
 * Colour by state — correct `#22c55e`, wrong `#ef4444`, otherwise the caller's
 * `accent`, which is the crayon the pupil picked in `ColorFillPalette` (falling
 * back to the player's own accent when no tray is shown). The fill and the
 * white→colour flood are driven by a 500ms `transition-all`; the sheen adds the
 * hand-drawn feel. No option letter is shown — the whole cell is the mark.
 *
 * A flooded card forces its whole label to `color: inherit` (`[&_*]:text-inherit`
 * beats the plain `.text-slate-500`/`.text-slate-800` utilities on
 * specificity). Option text that arrives as rich-content blocks is rendered by
 * `RichContentBlocks`, which paints it with the skin's `body` class — studio's
 * `text-slate-500`. Left alone, that grey stayed grey on top of the
 * saturated fill and the label read as blank once a card was coloured in, while
 * plain-`text` options (which merely inherit) looked fine.
 */
export function ColorFillChoiceButton({
  role,
  selected,
  state,
  accent = "#3b82f6",
  locked,
  onSelect,
  className,
  stack = false,
  children,
}: {
  role: "radio" | "checkbox";
  selected: boolean;
  state: "idle" | "selected" | "correct" | "wrong";
  /** Fill colour for the selected (not correct/wrong) state. */
  accent?: string;
  locked: boolean;
  onSelect: () => void;
  /** Per-player extras: pill shape, idle hover, focus-ring accent. */
  className?: string;
  /** Thẻ tranh: xếp children DỌC (ảnh trên, nhãn dưới) thay vì hàng ngang —
   * trong ô lưới hẹp, ảnh `shrink-0` cạnh nhãn sẽ tràn/bị cắt. */
  stack?: boolean;
  children: React.ReactNode;
}) {
  const active = state !== "idle";
  return (
    <motion.button
      type="button"
      role={role}
      aria-checked={selected}
      tabIndex={locked ? -1 : 0}
      whileHover={!locked ? { scale: 1.03 } : undefined}
      whileTap={!locked ? { scale: 0.97 } : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onSelect();
        }
      }}
      disabled={locked}
      style={active ? { backgroundColor: colorFillColor(state, accent), borderColor: "#ffffff" } : undefined}
      className={cn(
        "relative overflow-hidden rounded-full border-4 px-4 py-2 text-left font-black text-sm transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-6 sm:py-3 sm:text-base md:text-lg",
        active
          ? "text-white shadow-xl [&_*]:text-inherit"
          : "bg-white border-slate-200 text-slate-800 shadow-lg",
        className,
      )}
    >
      <ColorFillSheen active={active} />
      <span
        className={cn(
          "relative z-10 flex w-full items-center gap-2",
          stack && "flex-col justify-center",
        )}
      >
        {children}
      </span>
    </motion.button>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cỡ ảnh trong player — hai trần cao, chọn theo SỐ ĐO CORPUS thật (spike 31/7,
 * 1577 câu trong DB studio + 500 file ảnh đã import):
 *
 *   ảnh (px)   p25      p50      p75      p90      max
 *   rộng       306      659      1290     1365     3508
 *   cao        244      336      525      822      13612   ← nguyên trang scan
 *
 * - `MEDIA_ITEM_MAX_HEIGHT` = 22rem (352px) — trần cho ảnh nằm TRONG item/đáp
 *   án/ô bảng. Đặt NGAY TRÊN p50 (336px) là cố ý: ảnh item cỡ trung vị không
 *   đổi một pixel nào so với hôm nay (không lặp lại vụ QA từ chối "ảnh quá bé"
 *   khi ép scan qua khung 60px / trần `max-h-48`=192px), chỉ cái ĐUÔI p75→max
 *   bị chặn. Một câu matching 6 item mà mỗi item là scan 822px cao thì dài
 *   ~5000px; chặn ở 352px đưa về ~2100px mà ảnh trung vị vẫn nguyên khổ.
 * - `MEDIA_GRID_MAX_HEIGHT` = 14rem (224px) — trần cho MỘT Ô của lưới ảnh tự
 *   động trong content (≥2 ảnh liền nhau). Thấp hơn vì ô lưới đã bị bó chiều
 *   RỘNG còn 1/2–1/3 cột, nên ảnh trung vị (659×336) tự co xuống ~194px cao —
 *   trần này chỉ thực sự cắn vào ảnh CAO-HẸP (bản nhạc, cột số liệu).
 *
 * "Van xả" xem ảnh nguyên khổ — CÓ, nhưng chỉ ở hai đường ảnh KHÔNG tương tác:
 * ô lưới content ({@link ZoomableThumb}) và ảnh đơn của đề ({@link StemImage},
 * qua {@link ImageZoomButton}). Xem {@link ImageLightbox}.
 *
 * Lịch sử để khỏi đi lại đường cũ: bản đầu (31/7) gắn van xả vào MỌI ảnh, kể cả
 * ảnh ITEM/đáp án — mà ô lựa chọn tự nó đã là `<button>`, nên sinh ra `<button>`
 * lồng `<button>`: HTML không hợp lệ + widget ARIA lồng nhau nuốt tên gọi của ô
 * lựa chọn. Owner bác cả tính năng ("không cần nút phóng to") và nó bị bỏ hẳn.
 * Lần này CỐ Ý bỏ đường ảnh item ra ngoài phạm vi: {@link ContentImage} vẫn là
 * `<img>` thuần, không nút, không overlay — test khoá điều đó vẫn còn nguyên.
 * Muốn phóng to ảnh item thì phải thiết kế lại (nhấn-giữ, hoặc nút NGOÀI thân
 * `<button>` của ô), không phải nhét lại nút vào trong.
 *
 * Lý do mở lại đúng hai đường trên: từ 3/8 điều kiện "không ảnh nào có `width`"
 * đã bị bỏ (Owner: "cứ nhiều ảnh là phải relayout"), nên MỌI chuỗi ≥2 ảnh đều
 * vào lưới chứ không còn là thiểu số ca an toàn — xem {@link autoMediaRuns}. Cap
 * 224px/ô mà không có đường xem nguyên khổ là vi phạm chính sách #427 (scan bản
 * nhạc/vở phải đọc được từng nét).
 *
 * Cũng CỐ Ý không có ngoại lệ "ảnh cao dạng scan thì đừng gom lưới" (Owner
 * 31/7: "thường sẽ ít có ảnh scan để đọc") — bớt một quy tắc phải giải thích,
 * và schema khối ảnh không mang cỡ pixel nên guard đó sẽ phải đo sau khi tải
 * rồi đổi bố cục, đắt hơn giá trị nó mang lại.
 *
 * Toàn bộ hai việc trên (gom lưới + cap cỡ) nằm sau MỘT công tắc:
 * `skin.presentation.autoMediaSizing`. Tắt cờ là ảnh về hành vi cũ 100%.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Trần cao cho ảnh trong item/đáp án/ô bảng (22rem = 352px, ngay trên p50). */
export const MEDIA_ITEM_MAX_HEIGHT = "22rem";
/** Trần cao cho một ô của lưới ảnh tự động trong content (14rem = 224px). */
export const MEDIA_GRID_MAX_HEIGHT = "14rem";

/**
 * Overlay xem ảnh nguyên khổ — "van xả" cho chỗ player cap cỡ ảnh content.
 *
 * Không thêm dependency: một portal + `max-h-[92svh] max-w-[95vw]`. A11y tối
 * thiểu nhưng đủ: `role="dialog"` + `aria-modal` + nhãn, focus nhảy vào nút
 * đóng khi mở và trả về phần tử mở khi đóng, Esc đóng, Tab bị giữ trong overlay
 * (chỉ có một điểm dừng nên "bẫy focus" = luôn kéo về nút đóng), khoá cuộn nền.
 *
 * `capture: true` trên listener để Esc đóng ảnh TRƯỚC khi tới các phím tắt của
 * player/dialog bao ngoài — trang bài học có `keydown` toàn cục thoát toàn màn
 * hình, đóng cả bài làm khi học sinh chỉ muốn đóng ảnh là hành vi sai.
 *
 * Click/pointer event trong lightbox cũng phải `stopPropagation` (xem
 * `stopBubble` bên dưới): portal mount ở `document.body` nên event bubble thẳng
 * lên document, Radix Dialog cha nghe `pointerdown` để phát hiện click-outside
 * và sẽ đóng luôn dialog nếu không chặn — đó là lỗi "đóng ảnh đóng luôn popup
 * làm bài" của bài tập nâng cao.
 *
 * PHẢI là portal ra `document.body`: player render bên trong khung
 * `overflow-hidden` của `PlayerShell`, overlay render tại chỗ sẽ bị cắt. `z-120`
 * để nằm trên overlay `z-50` của design system và header `z-40` của trang.
 *
 * Điện thoại: `svh` chứ không `vh` (thanh địa chỉ co giãn làm `vh` tính dư và
 * đẩy đáy ảnh xuống dưới mép màn), nút đóng 44px đúng ngưỡng chạm tối thiểu.
 */
function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === "Tab") {
        // Một điểm dừng duy nhất → giữ focus tại chỗ thay vì thoát ra nền.
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      restoreTo?.focus?.();
    };
  }, [onClose]);

  // Lightbox render qua portal ra `document.body` nên Radix Dialog cha thấy
  // "outside" và muốn đóng dialog. Dialog cha đã chặn việc này qua
  // `onPointerDownOutside` (xem DigitizedExerciseDialog) — nếu target nằm
  // trong lightbox thì `event.preventDefault()`, dialog không đóng. Lightbox
  // tự xử lý onClick để đóng chính nó.
  //
  // `stopPropagation` trên `<img>` chỉ để click ảnh KHÔNG bubble lên backdrop
  // (backdrop cũng có onClick={onClose} — click ảnh sẽ đóng lightbox oan).
  const stopBubble = (event: React.SyntheticEvent) => event.stopPropagation();

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt?.trim() ? `Ảnh phóng to: ${alt}` : "Ảnh phóng to"}
      data-testid="image-lightbox"
      style={{ pointerEvents: "auto" }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 sm:p-4"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="Đóng ảnh phóng to"
        onClick={onClose}
        className="absolute right-3 top-3 sm:right-4 sm:top-4 inline-flex size-11 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-slate-900 shadow-lg"
      >
        ✕
      </button>
      {/* `bg-white p-4`: scan là PNG nền trong suốt mực đen — trên nền tối của
          overlay thì nét vẽ biến mất nếu không tự mang giấy theo. */}
      <img
        src={src}
        alt={alt ?? ""}
        onClick={stopBubble}
        className="h-auto max-h-[92svh] w-auto max-w-[95vw] rounded-xl bg-white object-contain p-4"
      />
    </div>,
    document.body,
  );
}

/**
 * Bọc ảnh ĐƠN của đề bài thành một điểm bấm mở {@link ImageLightbox}.
 *
 * CẢ ẢNH là điểm bấm, không phải riêng kính lúp (Owner 12/8: "chạm vào ảnh là
 * phóng to, không phải nhắm đúng cái nút"). An toàn ở đây vì ảnh đề bài không
 * nằm trong `<button>` nào, không kéo-thả, không chạm-để-chọn — không thao tác
 * nào bị nuốt, không widget ARIA nào bị lồng. Cũng là điểm chạm rộng nhất có
 * thể trên điện thoại, khỏi phải bàn tới ngưỡng 44px.
 *
 * Kính lúp bên trong chỉ còn là GỢI Ý NHÌN: `aria-hidden` + `<span>` (không
 * phải nút thứ hai — sẽ thành `<button>` lồng `<button>`), 28px và mờ, vì nó
 * không còn phải bắt ngón tay nữa. Ảnh đề bài có ca co xuống rất nhỏ (xem ghi
 * chú trần ở {@link stemImageMaxHeight}) nên kính lúp to sẽ che gần hết ảnh.
 *
 * Kính lúp `absolute` là BẮT BUỘC, không phải lựa chọn thẩm mỹ: {@link
 * StemImage} tính trần cao của mình từ chỗ trống đo được dưới ảnh. Một phần tử
 * nằm TRONG luồng sẽ ăn vào `below`, đổi trần, đổi chiều cao ảnh, rồi kích hoạt
 * lại phép đo — đúng vòng lặp đã đẻ ra lỗi "vào lại câu thì ảnh đổi cỡ". Chính
 * `<button>` bọc ngoài cũng phải trung tính về bố cục: `inline-block`, không
 * padding/viền, để nó cao đúng bằng ảnh (đo thật: cộng thêm 0px).
 */
function ImageZoomTarget({
  src,
  alt,
  width,
  children,
}: {
  src: string;
  alt?: string;
  /**
   * `width` tác giả khai — nhận ở ĐÂY chứ không để lại trên `<img>`.
   *
   * `width` là phần trăm (`72%`), mà `%` quy chiếu KHỐI CHỨA. Để nguyên trên
   * ảnh thì nút bọc ngoài (inline-block, co theo nội dung) vẫn tính bề rộng
   * theo chỗ trống của cột, còn ảnh chỉ chiếm 72% của nút — kính lúp neo vào
   * góc NÚT nên trôi hẳn ra ngoài mép ảnh (thấy trên `43556966/bai1` câu 7).
   * Dồn lên nút thì nút rộng đúng 72%, ảnh `max-w-full` lấp đầy nút, kính lúp
   * về đúng góc ảnh.
   */
  width?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt?.trim() ? `Phóng to ảnh: ${alt}` : "Phóng to ảnh"}
        title="Xem ảnh cỡ lớn"
        style={width ? { maxWidth: width } : undefined}
        className="relative inline-block max-w-full cursor-zoom-in p-0 align-top"
      >
        {children}
        <span
          aria-hidden="true"
          data-image-zoom="stem"
          className="pointer-events-none absolute bottom-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-full bg-slate-900/30 text-[11px] leading-none text-white opacity-50 transition-opacity"
        >
          ⤢
        </span>
      </button>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Ô ảnh của lưới content tự động: cả ô là nút mở {@link ImageLightbox}.
 *
 * Ở đây bấm-cả-ảnh AN TOÀN (khác ảnh item): content của đề bài không kéo-thả,
 * không chạm-để-chọn, nên không có thao tác nào bị nuốt. Và vì không có
 * `<button>` bao ngoài, đây là `<button>` thật — có nhãn, bấm được bằng bàn
 * phím. Cả ô làm điểm chạm cũng là lựa chọn cho điện thoại: ô lưới rộng
 * 1/2–1/3 cột, một kính lúp 44px ở góc sẽ che mất phần đáng kể của ảnh.
 */
function ZoomableThumb({
  src,
  alt,
  maxHeight = MEDIA_GRID_MAX_HEIGHT,
}: {
  src: string;
  alt?: string;
  maxHeight?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt?.trim() ? `Phóng to ảnh: ${alt}` : "Phóng to ảnh"}
        className="flex w-full cursor-zoom-in items-center justify-center rounded-2xl bg-white p-3 drop-shadow-md"
      >
        {/* `bg-white p-3` giữ nguyên chính sách "ảnh tự mang giấy" của ảnh
            content đơn (PNG trong suốt mực đen), chỉ mỏng bớt padding cho ô nhỏ. */}
        <img
          src={src}
          alt={alt ?? ""}
          style={{ maxHeight }}
          className="h-auto w-auto max-w-full object-contain"
        />
      </button>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
/**
 * Trần cao cho ảnh của một item trong CỘT NỐI (matching) — 8rem = 128px.
 *
 * Chặt hơn hẳn `MEDIA_ITEM_MAX_HEIGHT` vì ràng buộc ở đây không phải "ảnh đọc
 * được" mà là "NỐI ĐƯỢC": muốn kéo từ item cột trái sang item cột phải thì cả
 * hai đầu phải cùng nằm trong màn hình. Trần 22rem quá lỏng cho ngữ cảnh này —
 * ảnh item ~300px cao làm item đầu chiếm gần trọn màn, phải cuộn mới thấy item
 * thứ hai và thao tác nối trở nên bất khả (báo cáo Owner 31/7).
 *
 * Chọn 128px từ ngân sách chiều cao thật: viewport 720px − chrome trình phát
 * và đề bài (~200px) ≈ 520px cho vùng nối; 3 item × (128px ảnh + ~40px padding
 * và khoảng cách) ≈ 504px → ba item đầu cùng thấy được, không cuộn. Ở 800px
 * còn dư cho item thứ tư.
 *
 * MỘT số cho mọi số lượng item (không count-aware như họ image-choice): cột
 * nối đã bó chiều RỘNG còn ~1/2 màn nên ảnh ngang tự co sẵn; thêm bậc theo số
 * item chỉ làm khó giải thích mà không đổi được kết quả "3 item lọt màn".
 */
export const MEDIA_MATCH_ITEM_MAX_HEIGHT = "8rem";

/**
 * Trần cao ảnh trong Ô NHÃN HÀNG của bảng đánh dấu (`CheckboxTablePlayer`).
 *
 * Vì sao cần (Owner 9/8, ca `32069345/bai5` câu 1 — 6 tranh tình huống, mỗi
 * tranh 611×348): trần item mặc định 22rem không cắn (348 < 352) nên mỗi hàng
 * cao 381px, cả bảng 2332px, nội dung 2506px trên khung 808px = **3,1 màn**.
 * Học sinh cuộn ba màn mới đánh dấu xong sáu tranh.
 *
 * Đo từng mức trên chính bảng đó:
 *
 * | trần   | cao hàng | nội dung | số màn |
 * |--------|----------|----------|--------|
 * | 22rem  | 381      | 2506     | 3,1    |
 * | 14rem  | 257      | 1776     | 2,2    |
 * | 12rem  | 225      | 1584     | 2,0    |
 * | 10rem  | 193      | 1392     | 1,7    |
 * | 8rem   | 161      | 1200     | 1,5    |
 *
 * Tranh tình huống MANG CHỮ trong bóng thoại ("Đây là quà tớ tặng bạn như đã
 * hứa."), nên trần không thể hạ tuỳ ý: dựng thử từng cỡ thì chữ còn đọc được
 * tới ~192–224px, dưới 160px là mất hẳn.
 *
 * **Cập nhật 9/8**: Owner đặt ràng buộc theo SỐ HÀNG chứ không theo số màn —
 * "màn hình phải thấy tối thiểu 4 dòng". Đo lại: khung cuộn 808px, trừ 100px
 * phía trên bảng và 56px hàng tiêu đề còn **652px** cho các hàng, nên mỗi hàng
 * phải ≤ 163px.
 *
 * | padding dọc ô | trần  | cao hàng | số hàng lọt |
 * |---------------|-------|----------|-------------|
 * | 16px          | 12rem | 225      | 2,9         |
 * | 16px          | 10rem | 193      | 3,4         |
 * | 16px          | 8rem  | 161      | 4,05        |
 * | 8px           | 10rem | 177      | 3,7         |
 * | **8px**       | **9rem** | **161** | **4,05**  |
 * | 8px           | 8rem  | 145      | 4,5         |
 *
 * Chọn **9rem + padding dọc 8px** thay vì 8rem + 16px: CÙNG cho 4 hàng nhưng
 * ảnh to hơn 12,5% (144px so với 128px) — đổi 8px đệm lấy 16px ảnh.
 *
 * ĐÁNH ĐỔI phải nói rõ: 144px là DƯỚI khoảng chữ-bóng-thoại đọc thoải mái
 * (192–224px). Ở 144px ảnh rộng ~253px, chữ trong bóng thoại còn ~8px — nhìn ra
 * chữ nhưng phải nhìn kỹ. Owner ưu tiên thấy 4 tình huống cùng lúc hơn là đọc
 * trọn chữ trong tranh; nấc lùi đã đo sẵn là 10rem (3,7 hàng) hoặc 12rem (2,9).
 *
 * Vẫn nằm sau `autoMediaSizing` (ContentImage tự đọc cờ) và `width` tác giả khai
 * vẫn thắng như mọi trần khác.
 */
export const MEDIA_TICK_TABLE_MAX_HEIGHT = "9rem";

/**
 * Sọc chẵn/lẻ (zebra) cho THÂN bảng: hàng đầu để trần, hàng kế tô nhạt — đúng
 * nhịp bảng Excel/Word, mắt bám được theo hàng ở bảng nhiều cột.
 *
 * MỘT hàm cho cả ba player bảng (P44 tích chọn, P45 điền ô, P46 Đúng/Sai) nên
 * ba bảng luôn cùng nhịp và chỉnh màu một chỗ.
 *
 * `index` là số thứ tự HÀNG DỮ LIỆU, không phải vị trí trong mảng hàng: hàng
 * tiêu đề nhóm (banner) có nền riêng và không được tính, nếu tính thì hai hàng
 * dữ liệu kề nhau ngay sau banner sẽ cùng màu.
 *
 * Màu do skin quyết qua role `stripe` (tách khỏi `softFill` của dải tiêu đề);
 * `oddFallback` giữ hue riêng của player cho skin không khai token này.
 *
 * web-own: studio KHÔNG có hàm này, cũng không có role `stripe` trong
 * skin/types.ts — sọc thân bảng chỉ tồn tại ở repo này. Copy đè `shared.tsx` từ
 * studio sẽ XOÁ hàm, và ba player bảng đang import nó sẽ gãy biên dịch. Ít nhất
 * lỗi này kêu to; nhưng đừng "sửa" bằng cách bỏ import — ghép tay hàm này lại.
 * Xem checklist WEB-OWN cuối apps/learner/scripts/detokenize-players.mjs.
 */
export function tableStripeClass(
  skin: QuestionPlayerSkin,
  index: number,
  oddFallback: string,
): string {
  if (index % 2 === 0) return "bg-transparent";
  return skin.accent?.("primary", "stripe") ?? oddFallback;
}

/**
 * Trần cao cho ảnh nằm trong MỘT Ô CON của nhóm câu hỏi xếp LƯỚI (≥2 cột) —
 * 10rem (160px), THẤP hơn {@link MEDIA_GRID_MAX_HEIGHT} (14rem) một bậc: ô con
 * không chỉ chứa ảnh như ô của lưới ảnh thuần mà còn mang cả INPUT (ô điền,
 * pill chọn…) bên dưới, nên ảnh phải nhường bớt chiều cao cho phần làm bài.
 * 224px Owner vẫn chê to (8/8) — 160px giữ ảnh đủ đọc mà cả cụm ảnh + ô điền
 * gọn trong một tầm nhìn.
 *
 * Vì sao cần (Owner 8/8, câu "Viết từ có tiếng chứa iêu hoặc ươu"): ảnh đề của
 * câu con KHÔNG có trần nào ngoài `max-w-full`, nên nó phình theo BỀ RỘNG CỘT.
 * Trên màn hẹp cột chỉ ~330px nên ảnh tự co còn ~220px cao và không ai thấy vấn
 * đề; trên màn rộng cột nở ra ~600px thì chính ảnh đó cao ~450px, mỗi ô thành
 * ~600px và bốn ô (lưới 2 cột × 2 hàng) dài hơn 1200px — học sinh phải cuộn mới
 * thấy được ô thứ hai, đúng lỗi trong ảnh chụp của Owner.
 *
 * Trần này CHỈ đổi CỠ, không đổi bố cục, và chỉ cắn khi ô rộng — màn hẹp giữ
 * nguyên từng pixel như hôm nay. `width` tác giả khai vẫn thắng, và cả cơ chế
 * nằm sau công tắc `skin.presentation.autoMediaSizing` như mọi trần khác.
 */
export const MEDIA_GROUP_TILE_MAX_HEIGHT = "10rem";

/**
 * Trần ảnh của THẺ SẮP XẾP khi bố cục KHÔNG phải `list` (tác giả khai `inline`
 * hoặc `grid_N`).
 *
 * Vì sao là số cố định chứ không đo như bố cục `list`: ở bố cục wrap, phép đo
 * chỗ trống SẬP THÀNH VÒNG LẶP. Đo trên ca thật `12773888/bai23` câu 5 ("Sắp
 * xếp các bước trồng cây trong vỏ trứng"): vùng cuộn mà `findScrollport` chọn
 * là lớp trong của PlayerShell, `clientHeight` 264px — chính nó co theo nội
 * dung — chứ không phải khung thật 715px của runner. Ảnh nhỏ → thẻ nhỏ → chỗ
 * trống đo được nhỏ → ảnh lại nhỏ, khoá cứng ở sàn 96px (ba ảnh 96px, nội dung
 * 136px trong khung 743px).
 *
 * 9rem = 144px, đo trên chính ca đó ở màn 1440px (bề rộng nội dung 1024px):
 * 10rem cho thẻ rộng 337px nên ba thẻ đã tràn xuống HAI hàng (3×337 + khe >
 * 1024), còn 9rem cho thẻ ~305px — ba thẻ nằm gọn MỘT hàng, nội dung 200px
 * trong khung 715px. Ảnh vẫn to gấp rưỡi so với sàn 96px mà phép đo rơi vào.
 */
export const MEDIA_ORDER_ITEM_MAX_HEIGHT = "9rem";

/**
 * Ảnh ĐƠN của đề bài cao đúng TỈ LỆ NÀY của khung cuộn, khi bên dưới ảnh còn
 * phần phải làm (xem {@link StemImage}).
 *
 * Chốt 45% (Owner 10/8). Trước đó luật là "trần = chỗ trống đo được, kẹp giữa
 * sàn 30% và trần 45%", và chính khoảng kẹp đó đẻ ra hai lỗi liên tiếp:
 *
 *  - `67287717/bai8` câu 1: chỗ trống thật 179px nằm ngay dưới sàn 245px, nên
 *    sai số đo vài chục pixel làm ảnh nhảy giữa 410px và 819px giữa hai lần vào
 *    cùng một câu;
 *  - vẫn ca đó sau khi kẹp lại: ảnh dừng ở sàn 245px — quá nhỏ để đọc chữ viết
 *    tay trong tranh 4 khung.
 *
 * Số đo cho thấy siết ảnh gần như không mua được gì: câu đó có 558px vùng trả
 * lời + 78px đề trong khung 815px, tức KHÔNG THỂ lọt một màn dù ảnh nhỏ cỡ nào.
 * Từ 245px lên 367px chỉ tốn thêm 0,15 màn cuộn mà ảnh to hơn 50%.
 *
 * | trần | ảnh cao | tổng nội dung | số màn |
 * |------|---------|---------------|--------|
 * | 245  | 245     | 881           | 1,08   |
 * | 326  | 326     | 962           | 1,18   |
 * | 367  | 367     | 1003          | 1,23   |
 * | 728 (nguyên khổ) | 728 | 1364   | 1,67   |
 *
 * Một tỉ lệ PHẲNG thay cho khoảng kẹp còn được thêm một thứ quan trọng hơn cỡ
 * ảnh: kết quả không còn phụ thuộc phép đo `available` nữa — chỉ còn `port` và
 * `below`, hai đại lượng ổn định. Không còn nhánh nào để nhảy thì cũng không
 * còn lỗi "vào lại thì ảnh đổi cỡ".
 */
export const STEM_IMAGE_PORT_RATIO = 0.45;

/**
 * Vùng trả lời chiếm quá tỉ lệ này của khung cuộn thì **bỏ trần hẳn**.
 *
 * Vì sao cần (Owner 9/8, ca `61741164/bai8` câu 5 — chính là lỗ hổng của bản
 * đầu): ảnh 1111×1588, khung cuộn 536px, phần trên 78px, phần dưới **558px**
 * (4 đề mục + 4 ô nhập). Vùng trả lời MỘT MÌNH đã lớn hơn cả khung, nên chỗ
 * trống tính ra −100px → chạm sàn → ảnh còn **125×161**, không đọc nổi.
 *
 * Bản đầu ngầm giả định "co ảnh thì mọi thứ lọt một màn". Giả định đó đúng ở ca
 * `95805075/bai5` (phần dưới 395px < khung 719px) nhưng SAI ở đây: dù ảnh có co
 * tới 0 thì học sinh vẫn phải cuộn. Co lúc đó là mất ảnh mà không mua được gì.
 *
 * Đo ngưỡng đọc được trên chính ảnh đó: chữ viết tay trong hình **mù ở 300px**,
 * **đọc được ở 432px**. Nên khi co không cứu được màn hình, chọn "để ảnh đọc
 * được rồi cuộn" thay vì "ảnh mù mà vẫn phải cuộn".
 *
 * Ngưỡng 0.8 tách đúng hai ca đo được: `bai5` 395/711 = 56% (vẫn co, cả câu lọt
 * một màn) · `bai8` 558/536 = 104% (bỏ cuộc).
 *
 * "Bỏ cuộc" = trần nới ra **một màn**, KHÔNG phải bỏ trần hẳn. Thả tự do thì ca
 * `bai8` về 1024×1446 (nội dung 2090px trên khung 719px) — đúng cái "ảnh quá to"
 * mà chuỗi việc này sinh ra để chữa. Một màn là mức vừa: ở khung 719 ảnh cao
 * 719px (mức "rõ" trong thang đọc được đo ở dưới), ở khung 536 là 536px ("vừa
 * đọc được"), mà không câu nào để ảnh nuốt quá một tầm nhìn.
 */
export const STEM_IMAGE_BELOW_GIVE_UP_RATIO = 0.8;

/**
 * Trần cao ảnh do NGỮ CẢNH BAO NGOÀI áp xuống, đi qua context thay vì prop.
 *
 * Người áp là {@link QuestionGroupPlayer} — nó biết mình xếp con thành lưới,
 * nhưng ảnh lại do player con (fill-blank, tự luận, chọn đáp án…) tự render sâu
 * bên trong qua render-prop của dispatcher. Nối bằng prop thì phải xuyên qua
 * dispatcher và MỌI player con; context đặt trần một lần cho cả cây con.
 *
 * `null` = không có trần ngữ cảnh (mặc định, hành vi cũ).
 */
const MediaCapContext = React.createContext<string | null>(null);

/** Trần cao ảnh của ngữ cảnh hiện tại, hoặc `null` nếu không có. */
export function useMediaCap(): string | null {
  return React.useContext(MediaCapContext);
}

/** Áp một trần cao ảnh cho cả cây con. `maxHeight` rỗng = gỡ trần. */
export function MediaCapProvider({
  maxHeight,
  children,
}: {
  maxHeight: string | null;
  children: React.ReactNode;
}) {
  return <MediaCapContext.Provider value={maxHeight}>{children}</MediaCapContext.Provider>;
}

/**
 * How an exercise image relates to its layout box.
 *
 * - `frame` — the UI defines a FIXED frame (thumbnail, card media) that keeps
 *   its designed size/ratio for stable layout and connector anchors, while the
 *   CONTENT image inside shows in full (`object-contain`, issue #465 — content
 *   images must never be cropped). Rounding lives on the frame with
 *   `overflow-hidden`.
 * - `cover` — reserved for images where the crop is deliberate design
 *   (decorative/background media). Fills the frame with `object-cover`.
 * - `intrinsic` — no fixed frame. The image keeps its natural ratio
 *   (`w-auto h-auto`) under responsive max caps, never cropped.
 * - `natural` — no caps at all. The image renders at its own pixel size and the
 *   surrounding layout sizes to IT, for images that ARE the content (a workbook
 *   scan inside a matching card). Sources are expected to be resized before
 *   import; nothing here defends against a pathological one. A separate variant
 *   rather than `max-w-none`/`max-h-none` overrides at the call site, because
 *   tailwind-merge does not treat those as replacing `max-w-full`/`max-h-48` —
 *   both would survive and stylesheet order would pick the winner.
 */
export type ExerciseImageVariant = "frame" | "cover" | "intrinsic" | "natural";

export interface ExerciseImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "className"> {
  variant: ExerciseImageVariant;
  /**
   * `frame`/`cover` → classes for the frame wrapper (size, rounding, margins,
   * `shrink-0`…). `intrinsic` → extra classes merged onto the img itself.
   */
  className?: string;
}

/**
 * Shared image element for the exercise players (issues #427/#465).
 * Centralizes the frame/cover/intrinsic rule so players stop hand-rolling
 * per-site fit combos. Content images use `frame` (full image, no crop);
 * `cover` stays only where cropping is the intended design.
 */
export function ExerciseImage({ variant, className, alt = "", ...imgProps }: ExerciseImageProps) {
  if (variant === "frame" || variant === "cover") {
    // A <span> (not <div>) so the frame stays valid inside inline/phrasing
    // contexts; `block` by default, overridable per call site (e.g. inline-block).
    const fit = variant === "frame" ? "object-contain" : "object-cover";
    return (
      <span className={cn("block overflow-hidden", className)}>
        <img alt={alt} {...imgProps} className={`h-full w-full ${fit} object-center`} />
      </span>
    );
  }
  if (variant === "natural") {
    return <img alt={alt} {...imgProps} className={cn("h-auto w-auto object-contain", className)} />;
  }
  return (
    <img
      alt={alt}
      {...imgProps}
      className={cn("h-auto w-auto max-w-full max-h-48 sm:max-h-64 object-contain", className)}
    />
  );
}

/**
 * Whether a matching item renders a visible label beside its picture.
 * An item can carry a `content` object whose blocks are all empty/media — that
 * is still a picture-only item, and must not lose card width to a label that
 * renders nothing.
 */
export function hasItemLabel(item: { text?: string; content?: RichContent | null }): boolean {
  return !!(item.text?.trim() || plainTextFromRichContent(item.content).trim());
}

/**
 * Picture that IS the content of an item — a workbook scan inside a matching
 * card, a classification chip, a bucket header, a table cell (issue: scans
 * rendered as 60px thumbnails, QA-rejected as "ảnh quá bé/nhỏ").
 *
 * The image sizes the card, not the other way round: natural pixel size,
 * uncropped, unrounded, no width or height ceiling — the card grows to whatever
 * the picture needs, and the columns grow with it. `shrink-0` keeps flex from
 * squeezing it back down when a label sits alongside.
 *
 * ONE ceiling, on height only: {@link MEDIA_ITEM_MAX_HEIGHT} (22rem = 352px),
 * sitting just ABOVE the measured p50 of the imported assets (336px) so the
 * median item picture is byte-for-byte what it is today — the "ảnh quá bé"
 * rejection came from square 60px frames and a 192px ceiling, both far below
 * this. Only the tail is bounded (p75 525px, p90 822px, worst case a 13612px
 * full-page scan that pushed every sibling item off the screen). The zoom
 * button restores full size, so nothing became unreadable.
 *
 * The picture still has NO width ceiling beyond `max-w-full`, no square frame,
 * no crop: the card still grows to what the picture needs.
 *
 * NOT for pictures whose fixed geometry is load-bearing — memory-match cards,
 * jigsaw slices, coordinate canvases (hotspot/diagram-fill/place-pin), or small
 * icons sitting beside a required text label. Those keep their frames.
 *
 * `width` is the ONE escape hatch (issue #783): the authored `width` of the
 * image block the picture came from. Natural size is the right default for a
 * scan that IS the item, but an author who needs a SMALL icon beside a text
 * label — a PowerPoint icon inline in a matching row — has no other way to say
 * so, and a 600px source then eats the whole column and squeezes the label down
 * to one character per line. Applied as `maxWidth`, exactly like a `content`
 * block picture in {@link RichContentBlocks}, so the same authored value means
 * the same thing in the stem and inside an item.
 */
export function ContentImage({
  src,
  alt,
  className,
  draggable,
  width,
  maxHeight,
}: {
  src: string;
  alt?: string;
  className?: string;
  draggable?: boolean;
  /** Authored `block.width` (CSS length) — caps the picture, else natural size. */
  width?: string;
  /**
   * Trần cao riêng của ngữ cảnh, thay cho {@link MEDIA_ITEM_MAX_HEIGHT}. Chỉ
   * dùng khi ràng buộc bố cục chặt hơn "ảnh đọc được" — hiện là cột nối
   * (matching), xem {@link MEDIA_MATCH_ITEM_MAX_HEIGHT}. `width` tác giả khai
   * vẫn thắng cả cái này.
   */
  maxHeight?: string;
}) {
  // Authored width wins outright (#783): an author who sized the picture has
  // already said how big it should be, so no height ceiling is layered on top.
  // Cờ tắt (`autoMediaSizing`) → không trần nào hết, đúng hành vi cũ.
  const skin = useSkin();
  const capped = skin.presentation?.autoMediaSizing === true;
  // Thứ tự: trần của CHÍNH call-site (cột nối) > trần NGỮ CẢNH (ô con của nhóm
  // lưới) > trần mặc định của item. Call-site đứng trước vì nó là ràng buộc
  // riêng, chặt hơn, do người viết player đó cân đo.
  const contextCap = useMediaCap();
  // TRONG Ô LƯỚI, `width` dạng PHẦN TRĂM bị bỏ qua (Owner 8/8 — "ưu tiên UX
  // hơn luật tác giả", ca bai13 Toán 5: khâu sinh gán width 90% đại trà làm
  // trần ô lưới vô hiệu, ảnh cái cân phình theo nửa cột). `%` quy chiếu khung
  // CHỨA — khung đó đã đổi hẳn khi vào ô lưới nên con số mất nghĩa gốc, cùng
  // triết lý autoMediaRuns đã bỏ width trong lưới ảnh đề bài. Width TUYỆT ĐỐI
  // (px — icon cỡ chủ ý, #783) vẫn thắng như cũ; ngoài ô lưới % giữ nguyên.
  const effectiveWidth =
    width && contextCap && String(width).trim().endsWith("%") ? undefined : width;
  // PHÂN RÕ mobile/ngữ-cảnh-trần vs desktop (Owner 12/8):
  //
  // - CÓ contextCap (MediaCapProvider — cột matching mobile, ô nhóm lưới):
  //   thẻ chứa có BỀ RỘNG CỐ ĐỊNH, dùng `min(width, 100%)` để width tác giả
  //   (vd 160px) không đè class max-w-full làm ảnh lòi khỏi thẻ hẹp hơn
  //   (ca 75817319/bai1 câu 3); icon nhỏ chủ ý (#783) vẫn nhỏ.
  //
  // - KHÔNG contextCap (desktop, thẻ co theo nội dung): giữ NGUYÊN
  //   `maxWidth: width`. CẤM đưa `%` vào đây: max-width chứa % bị bỏ qua
  //   trong pha đo intrinsic của thẻ co-theo-nội-dung → thẻ phình theo cỡ
  //   GỐC của ảnh rồi ảnh mới bị kẹp — thẻ khổng lồ ôm ảnh tí hon
  //   (ca 43556966/bai6 câu 3 "Nối." khay bánh, thẻ 349px/ảnh 59px).
  const style = effectiveWidth
    ? { maxWidth: contextCap ? `min(${effectiveWidth}, 100%)` : effectiveWidth }
    : capped
      ? { maxHeight: maxHeight ?? contextCap ?? MEDIA_ITEM_MAX_HEIGHT }
      : undefined;
  return (
    <ExerciseImage
      variant="natural"
      src={src}
      alt={alt}
      draggable={draggable}
      style={style}
      className={cn("shrink-0 max-w-full", className)}
    />
  );
}

/**
 * @deprecated Renamed to {@link ContentImage} once the same rule was applied
 * beyond matching (classification, tables, ordering, choice). Kept so the call
 * sites and tests introduced with the matching fix keep resolving.
 */
export const MatchItemImage = ContentImage;

/** A matching item as the players receive it from `textItems` (dispatch). */
export interface MatchItemContent {
  text?: string;
  imageUrl?: string;
  imageWidth?: string;
  content?: RichContent;
}

/**
 * Câu nối có media (ảnh/video) ở BẤT KỲ ô nào của BẤT KỲ cột nào — cửa cho
 * {@link matchColumnItemsClass}. Media tới bằng HAI đường: `imageUrl` phẳng, hoặc
 * một block trong `content` (tác giả soạn ảnh trong rich-text) — bỏ sót đường
 * thứ hai là câu có tranh vẫn bị coi là toàn chữ.
 */
export function matchItemsHaveMedia(...groups: (MatchItemContent[] | undefined)[]): boolean {
  return groups.some((items) =>
    (items ?? []).some(
      (item) =>
        Boolean(item.imageUrl) ||
        (item.content?.blocks ?? []).some(
          (block) => block.type === "image" || Boolean(getBlockMediaUrl(block)),
        ),
    ),
  );
}

function isAlignedTextBlock(block: ContentBlock): boolean {
  return block.type === "paragraph" || block.type === "heading" || block.type === "quote";
}

/**
 * Whether an item must render its `content.blocks` as an ordered sequence
 * instead of the historic "one picture, then the label" pair (issue #829).
 *
 * The pair markup is only faithful when the authored content is exactly that:
 * at most one image, sitting before every text block. Anything else — a second
 * image, or an image the author put *after* some text — loses content: dispatch
 * lifts only the FIRST image block into `imageUrl` and `AlignedRichText` drops
 * every image block, so image #2 has no render path at all and image #1 is
 * hoisted above the text it was written under.
 *
 * Kept narrow on purpose: items whose authored order the pair markup already
 * reproduces keep rendering through the exact same elements as before, so this
 * fix cannot reflow the thousands of one-picture matching items in the corpus.
 */
export function matchItemNeedsBlockSequence(content?: RichContent): boolean {
  const blocks = flattenNestedContentBlocks(content?.blocks) as ContentBlock[];
  const imageIndexes = blocks
    .map((block, index) => (block.type === "image" ? index : -1))
    .filter((index) => index >= 0);
  if (imageIndexes.length === 0) return false;
  if (imageIndexes.length > 1) return true;
  const firstText = blocks.findIndex(isAlignedTextBlock);
  return firstText >= 0 && imageIndexes[0] > firstText;
}

/**
 * Everything a matching item shows inside its card: the picture(s) and the
 * label, in the order the author wrote them.
 *
 * Two shapes, one component:
 * - **Pair (legacy, unchanged)** — picture then label, the markup every matching
 *   player has always emitted. Used whenever it still reproduces the authored
 *   order (see {@link matchItemNeedsBlockSequence}), including for the flat
 *   `imageUrl` / `image.url` aliases that carry a URL and no position.
 * - **Sequence** — `content.blocks` rendered in order, so text → ảnh → text →
 *   ảnh stays exactly that. A legacy alias URL that is NOT one of those blocks
 *   still renders once, ahead of them, as it did before; the block that dispatch
 *   lifted into `imageUrl` renders from its own position and never twice.
 */
export function MatchItemBody({
  item,
  labelClassName,
  imageClassName,
  imageMaxHeight,
  renderImage,
}: {
  item: MatchItemContent;
  /** Class of the <span> wrapping the label (each player owns its flex sizing). */
  labelClassName?: string;
  imageClassName?: string;
  /**
   * Trần chiều cao ảnh của item. Cột nối truyền
   * {@link MEDIA_MATCH_ITEM_MAX_HEIGHT} để 3 item đầu lọt một màn (Owner 31/7);
   * bỏ trống thì dùng trần item mặc định của ContentImage.
   */
  imageMaxHeight?: string;
  /** Player-specific picture (e.g. the fixed square chips of MatchRadialPlayer). */
  renderImage?: (image: { src: string; alt?: string; width?: string; className?: string }) => React.ReactNode;
}): React.ReactElement {
  const image = (src: string, width?: string) =>
    renderImage
      ? renderImage({ src, alt: item.text, width, className: imageClassName })
      : <ContentImage src={src} alt={item.text} width={width} className={imageClassName} maxHeight={imageMaxHeight} />;

  if (!matchItemNeedsBlockSequence(item.content)) {
    return (
      <>
        {item.imageUrl && image(item.imageUrl, item.imageWidth)}
        {hasItemLabel(item) && (
          <span className={labelClassName}>
            <AlignedRichText blocks={item.content?.blocks} fallback={item.text} />
          </span>
        )}
      </>
    );
  }

  const blocks = flattenNestedContentBlocks(item.content?.blocks) as ContentBlock[];
  const aliasImage =
    item.imageUrl &&
      !blocks.some((block) => block.type === "image" && getBlockMediaUrl(block) === item.imageUrl)
      ? item.imageUrl
      : undefined;

  return (
    <>
      {aliasImage && image(aliasImage, item.imageWidth)}
      <span className={cn("flex min-w-0 flex-col items-start gap-1", labelClassName)}>
        {blocks.map((block, i) => {
          if (block.type === "image") {
            const src = getBlockMediaUrl(block);
            if (!src) return null;
            return (
              <React.Fragment key={i}>
                {image(src, itemImageWidth((block as ContentBlock & { width?: unknown }).width))}
              </React.Fragment>
            );
          }
          if (!isAlignedTextBlock(block)) return null;
          return (
            <div key={i} className={cn("w-full", blockTextAlignClass(block).trim() || undefined)}>
              <PlayerTextValue value={block.content ?? block.text} />
            </div>
          );
        })}
      </span>
    </>
  );
}

/** An option as the choice players receive it from `adaptOptions` (dispatch). */
export interface ChoiceOptionContent {
  text?: string;
  imageUrl?: string;
  content?: { blocks?: ContentBlock[] };
}

/**
 * Everything a choice option shows BESIDES the picture the card already renders
 * through its own `imageUrl` slot. `null` when nothing is left — the caller then
 * drops the text column entirely so the card hugs the picture instead of
 * stretching a full-width pill around an empty half.
 *
 * `adaptOptions` (dispatch) derives `imageUrl` from the FIRST image block of
 * `content`, then passes `content` through untouched. Rendering both painted a
 * picture-only option TWICE — once at natural size by `ContentImage`, then again
 * clamped and framed by `RichContentBlocks` (`b34_q3` "Tô màu vào các hình tứ
 * giác": every shape appeared as a big copy beside a small copy). Dropping the
 * blocks that carry that same URL keeps one picture — the natural-size one —
 * while any caption/math block sitting beside it still renders.
 *
 * When blocks existed but were all that one picture the result is `null`, never
 * a fallback to `text`: `text` is derived from the same content, so falling back
 * would surface the image's alt string as a caption that was never shown before.
 */
export function optionBodyNode(option: ChoiceOptionContent): React.ReactNode | null {
  const blocks = option.content?.blocks ?? [];
  if (blocks.length > 0) {
    const rest = option.imageUrl
      ? blocks.filter(
        (block) => !(block.type === "image" && getBlockMediaUrl(block) === option.imageUrl),
      )
      : blocks;
    if (rest.length === 0) return null;
    return <RichContentBlocks blocks={rest} compact capImages />;
  }
  if (!option.text || (typeof option.text === "string" && option.text.trim() === "")) return null;
  return <RichTextValue value={option.text} />;
}

/**
 * Width class for an option card that ended up holding nothing but its picture:
 * `w-fit` so the card stops at the picture instead of stretching to the column
 * (flex `list` and grid cells both stretch an `auto`-width child). Empty string
 * for every other option, which keeps today's full-width pills.
 */
export function optionCardWidthClass(option: ChoiceOptionContent, body: React.ReactNode | null): string {
  return !body && option.imageUrl ? "w-fit max-w-full" : "";
}

/**
 * Độ dài chữ hiển thị của một phương án — đầu vào cho
 * {@link shouldInlineChoiceOptions} (bố cục ngang mặc định khi có nhiều phương
 * án). `null` khi phương án mang ẢNH: bề rộng thẻ khi đó do ảnh quyết định, đếm
 * chữ không nói lên gì.
 */
export function optionTextLength(option: ChoiceOptionContent): number | null {
  if (option.imageUrl) return null;
  const blocks = option.content?.blocks ?? [];
  if (blocks.length > 0) {
    if (blocks.some((block) => block.type === "image" || getBlockMediaUrl(block))) return null;
    return plainTextFromRichContent({ blocks } as RichContent).length;
  }
  return typeof option.text === "string" ? plainTextFromHtml(option.text).length : 0;
}

/**
 * Nhãn dài nhất mà một thẻ phương án CÓ ẢNH vẫn được coi là "thẻ tranh".
 *
 * Ban đầu là 12 (Owner 8/8): chỉ số thứ tự "1", chữ cái "a)", "Tranh 2" — chú
 * thích thật thì giữ `list` cho chữ đủ rộng mà đọc.
 *
 * Nâng lên 80 (Owner 10/8, ca `79921326/bai31` — "Đánh dấu ✓ vào những biện
 * pháp…", 6 phương án ảnh kèm mô tả 19–44 ký tự). Lý do đổi:
 *
 * - Thẻ tranh đã render chrome DỌC (`stack`: ảnh trên, chữ dưới) từ 8/8, nên
 *   nhãn dài không còn ép ảnh và chữ chen nhau trong một hàng ngang — đúng cách
 *   Owner đề nghị: "nhiều ký tự thì hiển thị chữ phía dưới ảnh". Ngưỡng 12 sinh
 *   ra TRƯỚC khi có chrome dọc, giờ nó chặn nhầm.
 * - 80 ký tự ≈ hai dòng trong ô lưới 2 cột (~460px) — vẫn là NHÃN, chưa thành
 *   đoạn văn. Dài hơn nữa thì chữ mới là nội dung chính và `list` full-width
 *   vẫn đúng.
 *
 * Đo trên kho: 150 phương án có ảnh, **100% nhãn ≤ 1 ký tự** — nâng ngưỡng
 * không đổi hành vi của câu nào đang có, chỉ mở đúng nhóm "ảnh + một dòng mô
 * tả" mà `list` đang kéo dài lê thê (ca trên: 6 hàng × 384px = 4,6 màn cuộn).
 */
const PICTURE_CARD_CAPTION_MAX = 80;

/** Phần CHỮ đứng cạnh ảnh của một phương án (bỏ block ảnh), đã trim. */
function optionCaptionText(option: ChoiceOptionContent): string {
  const blocks = option.content?.blocks ?? [];
  if (blocks.length > 0) {
    const rest = blocks.filter(
      (block) => !(block.type === "image" || getBlockMediaUrl(block)),
    );
    return plainTextFromRichContent({ blocks: rest } as RichContent).trim();
  }
  return typeof option.text === "string" ? plainTextFromHtml(option.text).trim() : "";
}

/**
 * Câu chọn mà MỌI phương án là THẺ TRANH — ảnh là nội dung chính, phần chữ
 * (nếu có) chỉ là nhãn ngắn kiểu số thứ tự. Câu như vậy xếp layout `list`
 * mặc định thành một cột thẻ full-width rất dài (mỗi scan một hàng, phải cuộn
 * mãi — Owner 8/8, câu "tô màu những tranh thể hiện quyền trẻ em" nhãn "1",
 * "2") → caller nâng lên lưới 2 cột.
 *
 * Trước đây luật này (`pictureOnlyChoices`) đòi phương án KHÔNG có chữ nào;
 * nhãn "1" làm luật trượt dù thẻ vẫn là thẻ tranh thuần. Chú thích THẬT
 * (> {@link PICTURE_CARD_CAPTION_MAX} ký tự) vẫn giữ list — thẻ khi đó là
 * thẻ chữ-kèm-ảnh, bề rộng full để đọc.
 *
 * Layout tác giả khai tường minh luôn thắng — caller chỉ nâng khi layout là
 * `list` mặc định.
 */
/**
 * Một NỘI DUNG là "ô tranh": có ảnh, phần chữ (nếu có) chỉ là nhãn ngắn.
 * Dùng cho câu con của nhóm — nơi chỉ có `content.blocks` chứ không có
 * `imageUrl` phẳng như phương án chọn.
 */
export function contentIsPictureLed(
  content: { blocks?: ContentBlock[] } | null | undefined,
): boolean {
  const blocks = content?.blocks ?? [];
  const isImage = (block: ContentBlock) =>
    block.type === "image" || Boolean(getBlockMediaUrl(block));
  if (!blocks.some(isImage)) return false;
  const rest = blocks.filter((block) => !isImage(block));
  return (
    plainTextFromRichContent({ blocks: rest } as RichContent).trim().length <=
    PICTURE_CARD_CAPTION_MAX
  );
}

export function pictureLedChoices(options: ChoiceOptionContent[]): boolean {
  if (options.length <= 1) return false;
  return options.every(
    (option) =>
      Boolean(option.imageUrl) &&
      optionCaptionText(option).length <= PICTURE_CARD_CAPTION_MAX,
  );
}

/** Verdict per element in instant-feedback mode. */
export type ElementVerdict = "correct" | "incorrect";

/** Aggregate progress emitted while grading on the fly. */
export interface InstantProgress {
  correct: number;
  wrong: number;
  total: number;
  done: boolean;
}

/**
 * The unified contract every player accepts. It is a superset of the legacy
 * task props so players can be dropped into the existing QuestionPlayer switch
 * without new plumbing.
 */
export interface PlayerProps {
  title: string;
  instruction?: string;
  /** Optional intro/context text rendered above the interaction. */
  context?: string;
  /** Optional illustration shown under the header. */
  imageSrc?: string;
  /**
   * Full rich content (paragraphs + images) from `payload.content`.
   * When provided, PlayerHeader renders blocks in order instead of just
   * the plain-text `title`. Images within the blocks are displayed inline.
   * Overrides `imageSrc`.
   */
  richContent?: { blocks?: ContentBlock[] };
  onComplete?: () => void;
  /** Parent-owned answer used to hydrate embeds and remounted players. */
  answer?: unknown;
  onAnswerChange?: (answer: unknown) => void;
  submitted?: boolean;
  onStatusChange?: (status: TaskStatus) => void;
  /** When true, hide the title/header chrome (used inside question_group). */
  compact?: boolean;
  /**
   * Player này là CÂU CON nằm trong ô của một wrapper (question_group, audio
   * anchor…) chứ không phải cả màn câu hỏi. Dispatcher đặt cờ theo
   * `scope: "nested"`. PlayerShell dùng nó để BỎ lớp padding màn
   * (`p-4 sm:p-6 md:p-8`) — ô bao ngoài đã có padding riêng, chồng hai lớp là
   * mỗi cạnh mất ~50px chỗ làm bài (Owner 8/8). Khác `compact`: compact chỉ
   * tắt heading chrome và còn được wrapper bật cho CHÍNH nó khi có shared
   * passage — shell cấp cao đó vẫn phải giữ padding màn.
   */
  nested?: boolean;
  /**
   * Self-assessment / survey question: there is no right answer. Graded players
   * MUST treat this as record-only — capture the pick, never show correct/wrong,
   * report the "incomplete" verdict. Players also infer record-only when the
   * data carries no correct answer at all.
   */
  selfAssessment?: boolean;
  /**
   * Grade each element the moment it is committed (blur / pair / drop) and reveal
   * per-element correctness inline. Default true. Independent of gradeMode — a
   * server-authoritative test passes false so answers are not leaked.
   */
  instantFeedback?: boolean;
  /** Fired each time one element is graded in instant mode. */
  onElementGraded?: (elementId: string, verdict: ElementVerdict, meta?: unknown) => void;
  /** Fired when instant-mode progress changes. */
  onProgress?: (progress: InstantProgress) => void;
  /** Schema `display.layout`; presentation-only and never used for grading. */
  layout?: LayoutInput;
  /** Canonical interaction selected by the capability resolver. */
  interactionType?: string;
}

function stableAnswerValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableAnswerValue).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableAnswerValue(record[key])}`).join(",")}}`;
}

/**
 * Hydrate record-shaped player answers without resetting local edits on every
 * parent render. The parent may recreate an equivalent answer object after
 * each keystroke, so the reset key is structural rather than referential.
 */
export function useHydratedRecordAnswer(answer: unknown): [Record<string, string>, React.Dispatch<React.SetStateAction<Record<string, string>>>] {
  const answerKey = useMemo(() => stableAnswerValue(answer), [answer]);
  const initial = useMemo(() => {
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) return {};
    return Object.fromEntries(
      Object.entries(answer as Record<string, unknown>)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)]),
    );
  }, [answer, answerKey]);
  const [value, setValue] = useState<Record<string, string>>(initial);
  const hydratedKey = useRef(answerKey);

  useEffect(() => {
    if (hydratedKey.current === answerKey) return;
    hydratedKey.current = answerKey;
    setValue(initial);
  }, [answerKey, initial]);

  return [value, setValue];
}

/**
 * Render `payload.content.blocks` according to their authored block semantics.
 * By default a paragraph stays body copy; only `type: "heading"` receives
 * heading typography, keeping editor H1/H2/H3 choices connected to playback.
 * The student surface opts into `skin.presentation.contentAsHeading`, which
 * renders EVERY text block as a big joyful heading instead (see below).
 */
/** Render one text block's prose, replacing each `{blank_*}` marker with the
 * player's inline widget while preserving surrounding rich-text runs. */
function renderContentWithInlineBlanks(
  block: ContentBlock,
  renderInlineBlank: (blankId: string) => React.ReactNode,
): React.ReactNode {
  const raw = block.content ?? block.text;
  const parts = Array.isArray(raw)
    ? splitRichRunsAroundBlankMarkers(raw)
    : splitTextAroundBlankMarkers(typeof raw === "string" ? raw : "");
  return parts.map((part, idx) => {
    if (typeof part === "string") {
      const blankId = blankIdFromMarker(part);
      if (blankId) return <React.Fragment key={idx}>{renderInlineBlank(blankId)}</React.Fragment>;

      // A vertical-arithmetic row such as `+ {blank_2}` lives in one centered
      // pre-wrap paragraph. CSS centres each newline-separated row on its own,
      // so the operator's width used to push the input to the right. Paint that
      // leading operator from a zero-width anchor: it remains visible and in the
      // accessibility tree, but does not contribute to the row's centred width.
      // This is presentation-only; authored payload text remains unchanged.
      const lastNewline = part.lastIndexOf("\n");
      const prefix = part.slice(0, lastNewline + 1);
      const trailingOperator = part.slice(lastNewline + 1);
      if (/^[+−×÷x:-] $/.test(trailingOperator)) {
        return (
          <React.Fragment key={idx}>
            {prefix && <PlayerTextValue value={prefix} className="whitespace-pre-wrap" />}
            <span className="relative inline-block w-0 overflow-visible whitespace-pre">
              <span className="absolute right-0">{trailingOperator}</span>
            </span>
          </React.Fragment>
        );
      }
    }
    return <PlayerTextValue key={idx} value={part} className="whitespace-pre-wrap" />;
  });
}

/**
 * Chuỗi ≥2 ảnh LIỀN NHAU trong content, đủ điều kiện gom thành lưới.
 *
 * Bối cảnh: ảnh content đơn render NGUYÊN KHỔ (chính sách #427 — scan bản
 * nhạc/vở phải đọc được). N ảnh liên tiếp = N ảnh nguyên khổ xếp dọc; đo corpus
 * thật thấy ảnh trung vị cao 336px, p90 cao 822px → một câu 4 ảnh có thể dài
 * 3000px+ và tràn hết màn hình. Gom thành lưới 2–3 cột + trần cao + lightbox
 * giải quyết đúng ca đó mà KHÔNG đụng ca ảnh đơn.
 *
 * Điều kiện gom:
 * - ≥2 block `image` liền nhau; đoạn RỖNG (spacer #503) xen giữa KHÔNG cắt
 *   chuỗi (và bị lưới nuốt luôn — lưới đã tự có `gap`);
 * - `layout` block do tác giả khai đi đường riêng, không bao giờ vào đây.
 *
 * ĐÃ BỎ điều kiện "không ảnh nào có `width` tác giả" (Owner 3/8: "cứ nhiều ảnh
 * là phải relayout"). Điều kiện đó biến tính năng thành gần như chết: đo kho
 * thật thấy phần lớn khối ảnh ĐÃ mang `width` — không phải vì tác giả cân nhắc
 * từng ảnh, mà vì khâu số hoá sinh hàng loạt một giá trị `%` mặc định. Ca thật
 * `b7_q1` (TNXH lớp 1) có 10 ảnh cùng `width: "55%"` → xếp dọc 10 ảnh, câu dài
 * lê thê, đúng thứ tính năng này sinh ra để chữa.
 *
 * Ranh giới MỚI thay cho ranh giới cũ (xem thêm ghi chú ở chỗ render lưới):
 * - ảnh ĐƠN vẫn tôn trọng `width` tác giả y như trước, không đổi một pixel;
 * - trong LƯỚI, `width` bị bỏ qua — ô lưới quyết cỡ. Không phải vì coi thường
 *   tác giả mà vì `%` đã mất nghĩa: nó quy chiếu chiều rộng khung CHỨA, và khi
 *   ảnh vào ô lưới thì khung chứa chỉ còn 1/2–1/4 cột. Giữ nguyên "55%" ở đó là
 *   áp một con số đo trên khung khác vào khung này, ra cỡ ngẫu nhiên chứ không
 *   ra ý đồ tác giả.
 *
 * VIDEO đi cùng luật, khác hai chỗ (Owner 8/8, ca thật `99688484/bai2` câu 1 có
 * 4 video xếp dọc = ~3,6 màn cuộn):
 * - chuỗi thuần một LOẠI: gặp video sau ảnh (hay ngược lại) là CẮT chuỗi. Trộn
 *   scan trong suốt "tự mang giấy" với khung video đen trong cùng một lưới thì
 *   hai ô cạnh nhau không còn cùng ngôn ngữ hình ảnh, mà cũng chẳng tiết kiệm
 *   thêm chiều cao nào so với hai lưới liền nhau;
 * - số cột theo {@link videoRunGridColumns} (trần 3) thay vì trần 5 của ảnh.
 *
 * @returns `starts` — index block đầu chuỗi → loại + danh sách index của chuỗi;
 *          `absorbed` — mọi index đã bị chuỗi nuốt (kể cả spacer), phải bỏ qua.
 */
type MediaRunKind = "image" | "video";

function autoMediaRuns(blocks: ContentBlock[]): {
  starts: Map<number, { kind: MediaRunKind; indexes: number[] }>;
  absorbed: Set<number>;
} {
  const starts = new Map<number, { kind: MediaRunKind; indexes: number[] }>();
  const absorbed = new Set<number>();
  const isEmptySpacer = (block: ContentBlock): boolean => {
    if (block?.type !== "paragraph" && block?.type !== "heading") return false;
    const raw = Array.isArray(block.content) ? plainTextFromRuns(block.content) : block.text ?? "";
    return !raw.trim();
  };
  const runKind = (block: ContentBlock): MediaRunKind | null =>
    block?.type === "image" ? "image" : block?.type === "video" ? "video" : null;
  let kind: MediaRunKind | null = null;
  let items: number[] = [];
  let spacers: number[] = [];
  const flush = () => {
    if (kind && items.length >= 2) {
      starts.set(items[0], { kind, indexes: items });
      for (const idx of items.slice(1)) absorbed.add(idx);
      // Spacer sau phần tử cuối cùng không thuộc chuỗi — chỉ nuốt cái nằm GIỮA.
      for (const idx of spacers) if (idx < items[items.length - 1]) absorbed.add(idx);
    }
    kind = null;
    items = [];
    spacers = [];
  };
  blocks.forEach((block, index) => {
    const blockKind = runKind(block);
    if (blockKind) {
      if (kind && blockKind !== kind) flush();
      kind = blockKind;
      items.push(index);
      return;
    }
    if (items.length > 0 && isEmptySpacer(block)) {
      spacers.push(index);
      return;
    }
    flush();
  });
  flush();
  return { starts, absorbed };
}

export function RichContentBlocks({
  blocks,
  compact = false,
  renderInlineBlank,
  allowMediaGrid = false,
  capImages = false,
}: {
  blocks: ContentBlock[];
  /** Inside a question_group child: every text block renders as body copy
   * (no big heading, no accent bar) — the group owns the heading chrome. */
  compact?: boolean;
  /**
   * Inline-blank mode. When provided, any text block containing a `{blank_*}`
   * marker renders its prose with the marker replaced IN PLACE by this widget
   * (the player's input / drop-zone), preserving the block's position within the
   * full content — including its ContentLayout column. Blocks with no marker
   * render as ordinary prose. Absent → classic read-only rendering (unchanged).
   */
  renderInlineBlank?: (blankId: string) => React.ReactNode;
  /**
   * Bật gom lưới ảnh tự động (xem {@link autoMediaRuns}). **Mặc định TẮT** và
   * CHỈ đường ĐỀ BÀI (stem) được bật.
   *
   * Vì sao mặc định tắt: bố cục của item là việc của PLAYER, không phải của
   * lớp rich-text. Matching/nối cột xếp mỗi item một HÀNG trong cột và đăng ký
   * điểm neo để vẽ đường nối; categorize/reorder/bảng cũng tự quyết số cột và
   * thứ tự. Gom ảnh của các item thành lưới sẽ vỡ cột và sai toạ độ đường nối.
   * Một item tự nó có nhiều ảnh vẫn xếp DỌC như cũ — chỉ nhận cap cỡ.
   *
   * Cũng cố ý KHÔNG truyền xuống khi đệ quy vào `layout` block: bố cục tác giả
   * đã khai luôn thắng.
   */
  allowMediaGrid?: boolean;
  /**
   * Áp trần cỡ cho ảnh của các block `image` (mặc định TẮT = nguyên khổ như
   * chính sách #427). KHÔNG kèm nút phóng to: đây là đường ảnh ITEM/ĐÁP ÁN, nơi
   * ô bao ngoài đã là `<button>` — xem ghi chú lịch sử ở đầu khối cỡ ảnh.
   *
   * Bật ở ngữ cảnh ITEM/ĐÁP ÁN/Ô BẢNG: ở đó ảnh chỉ là một trong N phần tử của
   * một danh sách, đúng cùng luật với {@link ContentImage} (ảnh phẳng
   * `imageUrl` của item). Một item mang nhiều ảnh trong `content.blocks` vẫn
   * xếp DỌC — cap chỉ đổi CỠ, không đổi bố cục.
   */
  capImages?: boolean;
}) {
  const skin = useSkin();
  const accentSet = useAccent();
  // MỘT chỗ duy nhất đọc cờ cho cả gom lưới lẫn cap cỡ — không rải điều kiện
  // ra từng player.
  const autoMediaSizing = skin.presentation?.autoMediaSizing === true;
  // Trần do ngữ cảnh bao ngoài áp xuống (ô con của nhóm xếp lưới). `ContentImage`
  // tự đọc context; nhánh ảnh nguyên khổ bên dưới cần biết để chuyển hướng.
  const mediaCap = useMediaCap();
  const mediaRuns = autoMediaRuns(allowMediaGrid && autoMediaSizing ? blocks : []);
  // Ô chật (thẻ đáp án / cột bài nối / ô con của nhóm) lấy `bodyCompact` nếu
  // skin có khai; không khai thì y như cũ. Xem QuestionPlayerSkin.bodyCompact.
  const bodyCls =
    (compact ? skin.bodyCompact : undefined) ??
    skin.body ??
    "mt-1 text-slate-800 font-bold text-base leading-snug whitespace-pre-wrap";
  // Content headings are subordinate to the exercise shell. Do not reuse the
  // shell-title skin here: doing so would make a semantic passage heading look
  // like a generated title and can override the authored H1/H2/H3 size.
  const headingBaseCls = "font-bold text-slate-800 leading-snug whitespace-pre-wrap";
  // skin.presentation.contentAsHeading (surface học sinh): TOÀN BỘ Question.Content
  // là "đề bài" — MỌI block text (paragraph/heading) render typography heading to
  // đậm kiểu joyful, thanh accent màu đúng MỘT lần sau block text cuối cùng.
  // Owner 30/7: bỏ heuristic "block text ĐẦU TIÊN = header" (promoteLeadParagraph
  // cũ chỉ thăng cấp block đầu). Ngoại lệ KỸ THUẬT (không phải nội dung phụ):
  //  - block chứa blank marker giữ render prose + inline blank — input KHÔNG được
  //    phóng cỡ theo h2;
  //  - heading tác giả giữ semantics level (element h2/h3/h4 +
  //    data-content-heading-level) nhưng vẫn nhận cỡ heading to;
  //  - đoạn RỖNG (spacer #503) giữ <p><br/></p> — không phịa heading rỗng;
  //  - image/table/quote/list/math/media không đổi;
  //  - compact (question_group con) tắt hẳn — group tự lo heading chrome.
  // Cờ tắt (studioSkin) render TRUNG THỰC theo block semantics như cũ.
  // whitespace-pre-wrap: giờ MỌI đoạn đề (kể cả đoạn thụt lề #394) render qua
  // headingCls, nên fallback phải giữ indent như bodyCls vẫn làm.
  const headingCls =
    skin.heading ?? "text-xl md:text-2xl font-black text-question-title tracking-tight font-player-display leading-tight whitespace-pre-wrap";
  const headingBarCls = skin.accentBar ?? `w-24 h-1.5 rounded-full ${accentSet.bar}`;
  // web-own: chế độ `"lead"` — CHỈ block text đầu lên heading (xem SkinPresentation).
  const headingMode = compact ? undefined : skin.presentation?.contentAsHeading;
  const leadHeadingOnly = headingMode === "lead";
  const contentAsHeading = headingMode === true || leadHeadingOnly;
  const eligibleForHeading = (b: ContentBlock): boolean => {
    if (b.type !== "paragraph" && b.type !== "heading") return false;
    const raw = Array.isArray(b.content) ? plainTextFromRuns(b.content) : b.text ?? "";
    if (!raw.trim()) return false; // empty spacer line keeps its <br>
    if (BLANK_MARKER_RE.test(raw)) return false; // inline blanks stay prose-sized
    return true;
  };
  // web-own: KHÁC promoteLeadParagraph cũ ở hai chỗ, cả hai đều có chủ đích —
  // bản cũ bỏ cuộc khi block đầu là heading tác giả hoặc đoạn thụt lề, còn ở
  // đây cả hai vẫn được thăng cấp. Lý do: `contentAsHeading: true` hôm nay cũng
  // thăng cấp chúng, nên loại trừ là tự tạo hồi quy chứ không phải khôi phục.
  const leadHeadingIdx = (() => {
    if (!leadHeadingOnly) return -1;
    // `"lead"` là bản THU HẸP của `true`, không phải luật riêng: cùng một vị từ
    // chấp nhận (`eligibleForHeading`), chỉ khác ở chỗ dừng lại sau block đầu.
    // Mọi điều kiện thêm thắt đều tạo ra ca mà `splitClozeContentAtFirstBlank`
    // cắt header tới một block rồi RichContentBlocks từ chối thăng cấp nó —
    // header ra không tiêu đề, không thanh accent, không test nào đỏ.
    //
    // Chỉ bước qua KHOẢNG ĐỆM thuần tuý (media mở đầu, đoạn rỗng #503). Gặp
    // block nội dung khác — list, quote, bảng, math — thì DỪNG và không thăng
    // cấp gì: đoạn văn nằm sau một cái bảng là chú thích của bảng, không phải
    // câu lệnh đề bài.
    const leadIdx = blocks.findIndex((b) => !isLeadSpacerBlock(b));
    if (leadIdx < 0) return -1;
    return eligibleForHeading(blocks[leadIdx]) ? leadIdx : -1;
  })();
  const rendersAsHeading = (b: ContentBlock, i: number): boolean =>
    leadHeadingOnly ? i === leadHeadingIdx : eligibleForHeading(b);
  const lastHeadingIdx = contentAsHeading
    ? blocks.reduce((acc, b, i) => (rendersAsHeading(b, i) ? i : acc), -1)
    : -1;
  // Thanh accent ĐÓNG đề bài — nó là vạch ngăn giữa đề và phần trả lời, nên
  // phải nằm dưới block CUỐI của đề, không phải dưới dòng CHỮ cuối. Ca thật
  // `10834585/bai26` câu 3 (Owner 8/8): đề là [chữ, chữ, hình thang vuông] →
  // vạch rơi vào giữa chữ và hình, trông như gạch chân tiêu đề bỏ quên cái hình
  // ở ngoài đề.
  //
  // NGOẠI LỆ: block mang `{blank_*}` là chỗ HỌC SINH TRẢ LỜI nằm lẫn trong đề.
  // Vạch phải đứng TRƯỚC nó (và trước mọi thứ sau nó), nếu không vạch "ngăn đề
  // với phần trả lời" lại nằm dưới chính ô nhập.
  const firstBlankIdx = contentAsHeading
    ? blocks.findIndex((b) => {
      if (b.type !== "paragraph" && b.type !== "heading") return false;
      const raw = Array.isArray(b.content) ? plainTextFromRuns(b.content) : b.text ?? "";
      return BLANK_MARKER_RE.test(raw);
    })
    : -1;
  let stemBarIdx = -1;
  if (leadHeadingOnly) {
    // web-own: vạch đóng NGAY dưới tiêu đề — phần content còn lại là ngữ liệu
    // học sinh phải đọc, không phải phần trả lời, nên vạch không được đẩy
    // xuống cuối như nhánh "cả khối là đề bài".
    //
    // CỐ Ý ĐÈ luật Owner 8/8 ghi ngay phía trên, KHÔNG phải sót: ở chế độ
    // `"lead"` một cái hình đứng sau câu lệnh là NGỮ LIỆU, nên nó nằm dưới vạch
    // chứ không nằm trong đề. Đã dựng cả hai phương án và so trên /dev/players
    // (câu "Đọc bản nhạc…"), Owner chốt giữ nguyên cách này ngày 25/08/2026.
    // Đừng "sửa" cho khớp lại luật 8/8 — ca đó thuộc nhánh `true`.
    stemBarIdx = leadHeadingIdx;
  } else if (lastHeadingIdx >= 0) {
    // Block bị lưới ảnh/video nuốt không render ra DOM — lùi về block render
    // thật gần nhất (chính là ô đầu chuỗi, tức cả cái lưới).
    for (let i = (firstBlankIdx === -1 ? blocks.length : firstBlankIdx) - 1; i >= 0; i -= 1) {
      if (!mediaRuns.absorbed.has(i)) {
        stemBarIdx = i;
        break;
      }
    }
    if (stemBarIdx < lastHeadingIdx) stemBarIdx = lastHeadingIdx;
  }
  return (
    <>
      {withStemBar(
        stemBarIdx,
        headingBarCls,
        blocks.map((block, i) => {
          if (mediaRuns.absorbed.has(i)) return null;
          const run = mediaRuns.starts.get(i);
          if (run && run.kind === "video") {
            // Video KHÔNG mượn vỏ "giấy trắng" của scan: khung video đã tự có nền
            // đen + thanh điều khiển, thêm giấy chỉ dày viền. Trần cao dùng CHUNG
            // với lưới ảnh để hai lưới cạnh nhau không so le hàng.
            return (
              <div
                key={i}
                data-testid="content-media-grid"
                data-media-run-kind="video"
                data-display-layout={videoRunGridKey(run.indexes.length)}
                className={`mt-3 ${videoRunGridClass(run.indexes.length)}`}
              >
                {run.indexes.map((blockIndex) => {
                  const runBlock = blocks[blockIndex];
                  const runUrl = getBlockMediaUrl(runBlock);
                  return (
                    <div key={blockIndex} className="flex w-full items-center justify-center">
                      {/* `w-auto` + trần CAO (không `w-full`): để chiều rộng co
                        theo tỉ lệ gốc. `w-full` + object-contain vẫn vừa khung
                        nhưng khung thừa ra hai bên thành dải đen — đúng ca
                        video 16:9 trong ô 2.2:1. Cùng luật với ô ảnh. */}
                      <video
                        src={runUrl ? resolveAssetUrl(runUrl) : undefined}
                        controls
                        preload="metadata"
                        style={{ maxHeight: mediaCap ?? MEDIA_GRID_MAX_HEIGHT }}
                        className="h-auto w-auto max-w-full rounded-lg"
                      />
                    </div>
                  );
                })}
              </div>
            );
          }
          if (run) {
            return (
              <div
                key={i}
                data-testid="content-media-grid"
                data-media-run-kind="image"
                data-display-layout={mediaRunGridKey(run.indexes.length)}
                className={`mt-3 ${mediaRunGridClass(run.indexes.length)}`}
              >
                {run.indexes.map((blockIndex) => {
                  const runBlock = blocks[blockIndex];
                  const runUrl = getBlockMediaUrl(runBlock);
                  return (
                    // Van xả cho trần 224px: cả ô là nút mở ảnh nguyên khổ — xem
                    // {@link ZoomableThumb} (vỏ `bg-white p-3` giữ nguyên).
                    //
                    // CỐ Ý không đọc `runBlock.width` ở đây: trong lưới, ô quyết
                    // cỡ (chia cột + trần cao + object-contain). `%` của tác giả
                    // quy chiếu khung CHỨA và khung đó đã đổi hẳn khi vào lưới —
                    // xem ghi chú ranh giới ở autoMediaRuns. Ảnh ĐƠN (nhánh
                    // RichContentBlocks bên dưới) vẫn tôn trọng `width`.
                    <ZoomableThumb
                      key={blockIndex}
                      src={runUrl ? resolveAssetUrl(runUrl) : ""}
                      alt={runBlock.alt ?? ""}
                      maxHeight={mediaCap ?? MEDIA_GRID_MAX_HEIGHT}
                    />
                  );
                })}
              </div>
            );
          }
          if (contentAsHeading && rendersAsHeading(block, i)) {
            // Authored headings keep their level semantics; promoted paragraphs
            // have none and render as a plain h2.
            const level = block.type === "heading" ? Math.min(3, Math.max(1, Number(block.level) || 2)) : undefined;
            const Heading = level === 2 ? "h3" : level === 3 ? "h4" : "h2";
            return (
              <Heading
                key={i}
                data-content-heading-level={level}
                className={`${headingCls}${blockTextAlignClass(block)}`}
              >
                <PlayerTextValue value={block.content ?? block.text} />
              </Heading>
            );
          }
          if (block.type === "image") {
            const mediaUrl = getBlockMediaUrl(block);
            const resolved = mediaUrl ? resolveAssetUrl(mediaUrl) : undefined;
            // Ngoài ngữ cảnh item/đáp án/ô (`capImages`), ĐỀ BÀI của một câu con
            // nằm trong ô lưới của nhóm cũng nhận trần — trần đó đến từ context
            // (`mediaCap`), xem MEDIA_GROUP_TILE_MAX_HEIGHT. Cả hai đi CHUNG một
            // nhánh ContentImage vì vỏ ảnh giống hệt nhau, chỉ khác con số trần.
            if ((capImages || mediaCap) && autoMediaSizing && resolved) {
              // Ngữ cảnh item/đáp án/ô: cùng luật với `ContentImage` — trần cao ở
              // đuôi phân bố + van xả, KHÔNG gom nhóm, vẫn xếp dọc.
              return (
                <div key={i} className="mt-3 flex justify-center">
                  {/* `bg-white p-5 rounded-2xl drop-shadow-md` giữ y nguyên vỏ
                    hôm nay của ảnh trong content (scan PNG trong suốt tự mang
                    giấy) — thay đổi ở đây CHỈ là cỡ, không phải diện mạo. */}
                  <ContentImage
                    src={resolved}
                    alt={block.alt ?? ""}
                    width={block.width}
                    className="rounded-2xl bg-white p-5 drop-shadow-md"
                  />
                </div>
              );
            }
            if (autoMediaSizing && allowMediaGrid && !compact) {
              return (
                <StemImage
                  key={i}
                  src={mediaUrl ? resolveAssetUrl(mediaUrl) : undefined}
                  alt={block.alt ?? ""}
                  width={block.width}
                />
              );
            }
            return (
              <div key={i} className="flex justify-center mt-3">
                {/* A content-block picture IS the question content (a music
                  sheet, a workbook scan, a diagram) — it renders at its own
                  natural pixel size, like `ContentImage`. The old
                  `max-h-48 sm:max-h-64` ceiling scaled a tall scan down to a
                  256px-high thumbnail no learner could read. The only guard
                  left is `max-w-full`, so a picture wider than the column
                  scales down instead of overflowing the layout; an authored
                  `block.width` still wins as explicit author intent.

                  `bg-white` is unconditional — NOT `dark:`-scoped. Scans come
                  in as transparent PNGs whose ink is black (a music sheet keeps
                  only its white staff lines opaque), so on a dark surface the
                  notes and lyrics disappear into the background. The picture
                  carries its own paper in every theme, with `p-5` of padding so
                  the paper extends a little past the ink instead of stopping
                  flush at the outermost note. */}
                <img
                  src={mediaUrl ? resolveAssetUrl(mediaUrl) : undefined}
                  alt={block.alt ?? ""}
                  className="h-auto w-auto max-w-full object-contain rounded-2xl drop-shadow-md bg-white p-5"
                  style={block.width ? { maxWidth: block.width } : undefined}
                />
              </div>
            );
          }
          if (block.type === "math") {
            return (
              <MathRenderer
                key={i}
                latex={block.latex}
                text={block.text}
                className="mt-3 overflow-x-auto text-slate-800"
              />
            );
          }
          if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
            const rawText = Array.isArray(block.content) ? plainTextFromRuns(block.content) : block.text ?? "";
            if (renderInlineBlank && BLANK_MARKER_RE.test(rawText)) {
              // Marker paragraph → render prose with the input/drop-zone in place.
              // Natural inline flow (no flex): the blank wraps with the text like a
              // word, filling leftover space on the last text line (#431).
              // leading-loose gives wrapped lines room around the inline inputs.
              const inlineContent = renderContentWithInlineBlanks(block, renderInlineBlank);
              // Đoạn KHÔNG có chữ nào ngoài marker (toàn ô điền) → căn giữa,
              // cùng luật với nhánh lines/segments của Cloze/FillBlank (Owner
              // 8/8, bai4 "Viết tên các nhạc cụ": ảnh căn giữa mà ô điền bám
              // trái trông rơi khỏi bố cục). Tác giả khai text-align thì thắng.
              const blanksOnly =
                !blockTextAlignClass(block).trim() &&
                rawText.replace(new RegExp(BLANK_MARKER_RE.source, "g"), "").trim() === "";
              const centerCls = blanksOnly ? " text-center" : "";
              if (block.type === "heading") {
                const level = Math.min(3, Math.max(1, Number(block.level) || 2));
                const Heading = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
                const sizeCls = level === 1 ? "text-xl md:text-2xl" : level === 2 ? "text-lg md:text-xl" : "text-base md:text-lg";
                return (
                  <Heading
                    key={i}
                    data-content-heading-level={level}
                    className={`${headingBaseCls} ${sizeCls}${blockTextAlignClass(block)}${centerCls} leading-loose`}
                  >
                    {inlineContent}
                  </Heading>
                );
              }
              if (block.type === "quote") {
                return (
                  <blockquote
                    key={i}
                    className={`${bodyCls}${blockTextAlignClass(block)}${centerCls} border-l-4 border-slate-200 pl-3 italic leading-loose`}
                  >
                    {inlineContent}
                  </blockquote>
                );
              }
              return <p key={i} className={`${bodyCls}${blockTextAlignClass(block)}${centerCls} leading-loose`}>{inlineContent}</p>;
            }
            if (block.type === "heading") {
              const level = Math.min(3, Math.max(1, Number(block.level) || 2));
              const Heading = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
              const sizeCls = compact
                ? level === 1 ? "text-lg" : "text-base"
                : level === 1 ? "text-xl md:text-2xl" : level === 2 ? "text-lg md:text-xl" : "text-base md:text-lg";
              return (
                <Heading
                  key={i}
                  data-content-heading-level={level}
                  className={`${headingBaseCls} ${sizeCls}${blockTextAlignClass(block)}`}
                >
                  <PlayerTextValue value={block.content ?? block.text} />
                </Heading>
              );
            }
            if (block.type === "quote") {
              return (
                <blockquote key={i} className={`${bodyCls}${blockTextAlignClass(block)} border-l-4 border-slate-200 pl-3 italic`}>
                  <PlayerTextValue value={block.content ?? block.text} />
                </blockquote>
              );
            }
            // Empty paragraph = an authored blank spacer line (#503). Render a
            // `<br>` so it keeps one line of height instead of collapsing; a
            // whitespace-only string is real indentation and stays as-is.
            const pRaw = block.content ?? block.text;
            const pIsEmpty = Array.isArray(pRaw) ? pRaw.length === 0 : !((pRaw ?? "").length);
            return (
              <p key={i} className={`${bodyCls}${blockTextAlignClass(block)}`}>
                {pIsEmpty ? <br /> : <PlayerTextValue value={pRaw} />}
              </p>
            );
          }
          if (block.type === "table") {
            // Headers/cells go through `contentTableCellText`: authored payloads
            // mix plain strings with the `{id, label}` column shape, and the raw
            // object renders as an empty cell (WEB13).
            const headers = (block.headers ?? []) as unknown[];
            const rows = (block.rows ?? []) as unknown[][];
            // Every label blank ⇒ no header layer at all, rather than a row of
            // empty cells — same rule the question-side resolver follows.
            const resolvedHeaders = headers.map(contentTableCellText);
            const headerTexts = resolvedHeaders.some((h) => h.length > 0) ? resolvedHeaders : [];
            return (
              <div key={i} className="mt-3 overflow-x-auto">
                <table className="min-w-full border border-slate-200 text-sm rounded-lg overflow-hidden">
                  {headerTexts.length > 0 && (
                    <thead className="bg-slate-100">
                      <tr>
                        {headerTexts.map((h, hi) => (
                          <th key={hi} className="border border-slate-200 px-3 py-2 text-left font-medium text-slate-800">
                            <PlayerTextValue value={h} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-100"}>
                        {(Array.isArray(row) ? row : []).map((cell, ci) => (
                          <td key={ci} className="border border-slate-200 px-3 py-2 text-slate-800">
                            <PlayerTextValue value={contentTableCellText(cell)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          if (block.type === "list") {
            const List = block.ordered ? "ol" : "ul";
            // Body-typography parity (#503): each item reuses the paragraph
            // `bodyCls` (font-size/color/line-height); only marker + indent differ.
            // Prefer canonical annotated runs (`itemsRuns`) so inline bold/italic
            // survives round-trip; fall back to legacy plain-text `items`.
            const runsItems = block.itemsRuns;
            const plainItems = block.items ?? [];
            const count = runsItems?.length ?? plainItems.length;
            return (
              <List key={i} className={`mt-3 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
                {Array.from({ length: count }).map((_, itemIndex) => (
                  <li key={itemIndex} className={bodyCls}>
                    <PlayerTextValue value={runsItems ? runsItems[itemIndex] : plainItems[itemIndex]} />
                  </li>
                ))}
              </List>
            );
          }
          if (block.type === "audio" || block.type === "video") {
            const storedUrl = getBlockMediaUrl(block);
            const mediaUrl = storedUrl ? resolveAssetUrl(storedUrl) : undefined;
            if (!mediaUrl) {
              return (
                <div key={i} className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500">
                  {block.type === "audio" ? "Audio" : "Video"}
                </div>
              );
            }
            return block.type === "audio" ? (
              <audio key={i} src={mediaUrl} controls preload="metadata" className="mt-3 w-full max-w-full" />
            ) : (
              <video key={i} src={mediaUrl} controls preload="metadata" className="mt-3 w-full max-w-full rounded-lg" />
            );
          }
          if (block.type === "divider") return <hr key={i} className="my-3 border-slate-200" />;
          if (block.type === "code") {
            return <pre key={i} className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-100"><code>{block.code ?? block.text}</code></pre>;
          }
          if (block.type === "diagram") {
            return <div key={i} className="mt-3 whitespace-pre-wrap rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-900"><PlayerTextValue value={block.text ?? block.content} /></div>;
          }
          if (block.type === "layout") {
            const variant = getLayoutBlockVariant(block);
            const columns = getLayoutBlockColumns(block);
            const [first, second] = columns;
            if (variant === "image-left" || variant === "image-right") {
              const left = variant === "image-left" ? first : second;
              const right = variant === "image-left" ? second : first;
              return (
                <div key={i} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="w-full shrink-0 sm:w-[42%]"><RichContentBlocks blocks={left ?? []} compact capImages={capImages} renderInlineBlank={renderInlineBlank} /></div>
                  <div className="min-w-0 flex-1"><RichContentBlocks blocks={right ?? []} compact capImages={capImages} renderInlineBlank={renderInlineBlank} /></div>
                </div>
              );
            }
            if (variant === "media-grid") {
              const [media, ...rest] = columns;
              return (
                <div key={i} className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(media ?? []).map((mediaBlock, mediaIndex) => (
                      <RichContentBlocks key={mediaIndex} blocks={[mediaBlock]} compact capImages={capImages} renderInlineBlank={renderInlineBlank} />
                    ))}
                  </div>
                  {rest.map((column, columnIndex) => (
                    <RichContentBlocks key={columnIndex} blocks={column} compact capImages={capImages} renderInlineBlank={renderInlineBlank} />
                  ))}
                </div>
              );
            }
            if (variant === "image-top" || variant === "image-bottom") {
              const ordered = variant === "image-top" ? columns : [...columns].reverse();
              return (
                <div key={i} className="mt-3 space-y-3">
                  {ordered.map((column, columnIndex) => (
                    <RichContentBlocks key={columnIndex} blocks={column} compact capImages={capImages} renderInlineBlank={renderInlineBlank} />
                  ))}
                </div>
              );
            }
            return (
              <div key={i} className={`mt-3 grid gap-3 ${variant === "two-column" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                {columns.map((column, columnIndex) => (
                  <div key={columnIndex} className="space-y-2"><RichContentBlocks blocks={column} compact capImages={capImages} renderInlineBlank={renderInlineBlank} /></div>
                ))}
              </div>
            );
          }
          if (block.text || block.content?.length) {
            return <p key={i} className={bodyCls}><PlayerTextValue value={block.content ?? block.text} /></p>;
          }
          return <div key={i} className="mt-3 rounded border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">{block.type}</div>;
        }),
      )}
    </>
  );
}

/**
 * Ảnh ĐƠN trong đề bài, co vừa chỗ trống ĐO ĐƯỢC của khung cuộn.
 *
 * Vấn đề (Owner 9/8, ca `95805075/bai5` câu 6): ảnh đơn cố tình render nguyên
 * khổ (chính sách #427 — scan bản nhạc/trang vở phải đọc được từng nét), nhưng
 * luật đó viết cho SCAN, còn ca này là TRANH MINH HOẠ 1078×722 của bài Đạo đức
 * lớp 1. Đo được: ảnh chiếm 1024×699 trong khung cuộn 544px, yêu cầu thật ("Kể
 * với các bạn…") nằm ở y=902 và hai ô viết ở 932/1060 — tổng nội dung 1087px,
 * đúng HAI màn. Học sinh lớp 1 nhìn màn đầu chỉ thấy tranh, không biết bên dưới
 * có việc phải làm.
 *
 * Ranh giới (hẹp có chủ ý):
 * - CHỈ cắn khi dưới ảnh còn nội dung (`below` > {@link STEM_IMAGE_BELOW_MIN}).
 *   Câu mà ảnh LÀ toàn bộ đề — đúng ca scan của #427 — không có gì phía dưới
 *   nên không bị đụng một pixel.
 * - CHỈ cắn khi co ảnh THẬT SỰ kéo được vùng làm bài vào màn. Vùng trả lời tự
 *   nó đã tràn màn (xem {@link STEM_IMAGE_BELOW_GIVE_UP_RATIO}), hoặc chỗ trống
 *   còn lại ít tới mức ảnh không ra hình → BỎ TRẦN, để ảnh đọc được rồi cuộn.
 * - Chỉ đổi CỠ. Không cắt, không ẩn, `object-contain` giữ nguyên tỉ lệ. Khi —
 *   và CHỈ khi — trần thật sự cắn thì thêm kính lúp ngoài luồng
 *   ({@link ImageZoomButton}) để xem nguyên khổ; ảnh không bị cắn thì không có
 *   nút, vì phóng to không cho thêm gì.
 * - `width` tác giả VẪN được tôn trọng — nó chặn bề rộng, trần này chặn chiều
 *   cao; hai thứ không tranh nhau.
 * - Nằm sau công tắc `autoMediaSizing`: tắt cờ là về nguyên khổ 100%.
 *
 * Đây là ngoại lệ ĐÃ ĐƯỢC DUYỆT cho chốt chặn #1 của Tầng 2 trong
 * `docs/PLAYER-LAYOUT-RULES.md` (Owner 9/8) — ngoại lệ duy nhất áp cho một phần
 * tử ĐƠN, và chỉ khi phần tử đó đẩy vùng làm bài ra khỏi màn.
 */
const STEM_IMAGE_BELOW_MIN = 8;

/**
 * Trần cao cho ảnh đơn của đề bài. Tách rời khỏi component để khoá được PHÉP
 * TÍNH bằng test (jsdom không layout nên đo thật luôn trả `null`).
 *
 * CHỈ đọc `port` và `below` — hai đại lượng ổn định. Bản trước còn dùng chỗ
 * trống đo được (`available`) để kẹp giữa sàn và trần, và chính chỗ đó đẻ ra
 * lỗi "vào lại câu thì ảnh đổi cỡ": `available` chốt khác nhau tuỳ thời điểm đo,
 * mà hai bên ngưỡng lại chênh nhau 3–4 lần. Xem {@link STEM_IMAGE_PORT_RATIO}.
 */
export function stemImageMaxHeight(space: {
  port: number | null;
  below: number | null;
  /**
   * Viewport MOBILE (`useIsMobile`, < 768px): trần phẳng MỘT MÀN thay cho tỉ lệ
   * 45% (Owner 12/8 — "mobile cần ảnh to hơn và không quá lo về việc scroll
   * dọc"). Cuộn dọc là thao tác tự nhiên trên điện thoại, còn 45% của khung
   * ~600px chỉ cho ảnh ~270px — quá bé để đọc. Vẫn giữ MỘT màn chứ không thả
   * tự do: scan nguyên trang 13612px không được nuốt nhiều tầm nhìn; và nhánh
   * "ảnh là cả đề" (below ≤ 8) vẫn nguyên khổ như desktop.
   */
  mobile?: boolean;
}): string | undefined {
  const { port, below, mobile } = space;
  if (port === null || below === null) return undefined;
  // Ảnh LÀ cả đề bài, không có gì bên dưới → giữ nguyên khổ (chính sách #427:
  // scan bản nhạc/trang vở phải đọc được từng nét).
  if (below <= STEM_IMAGE_BELOW_MIN) return undefined;
  const oneScreen = Math.round(port);
  if (mobile) return `${oneScreen}px`;
  // Vùng trả lời tự nó đã chiếm gần hết (hoặc hơn) một màn → mục tiêu "cùng lọt
  // một màn" bất khả thi ngay từ đầu, siết ảnh chỉ tổ mất ảnh mà vẫn phải cuộn.
  // Nới ra MỘT MÀN — không thả tự do, vì bỏ hẳn trần thì ca `61741164/bai8` câu
  // 5 về 1024×1446, đúng cái "ảnh quá to" mở đầu chuỗi việc này.
  if (below >= port * STEM_IMAGE_BELOW_GIVE_UP_RATIO) return `${oneScreen}px`;
  return `${Math.round(port * STEM_IMAGE_PORT_RATIO)}px`;
}

/**
 * Viewport mobile (< 768px, khớp breakpoint `md` + hook use-mobile của web)
 * cho luật ảnh đề. Hook NỘI BỘ thay vì import `@/core/hooks/use-mobile`:
 * file này sync nguyên vẹn web ↔ studio mà studio không có hook đó; và
 * jsdom/SSR không có `matchMedia` nên phải guard — mặc định `false` (luật
 * desktop) khi không đo được.
 */
const MOBILE_VIEWPORT_MAX = 768;
export function useMobileViewport(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_VIEWPORT_MAX - 1}px)`);
    const onChange = () => setMobile(window.innerWidth < MOBILE_VIEWPORT_MAX);
    mql.addEventListener("change", onChange);
    setMobile(window.innerWidth < MOBILE_VIEWPORT_MAX);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

function StemImage({ src, alt, width }: { src?: string; alt: string; width?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Chỉ cần `port` và `below`; `available` cố tình KHÔNG dùng — xem ghi chú ở
  // stemImageMaxHeight về lỗi ảnh đổi cỡ giữa hai lần vào cùng một câu.
  const { port, below } = useAvailableSpace(ref, 96);
  // Mobile nhận luật riêng (trần 1 màn) — xem stemImageMaxHeight. Hook có
  // listener matchMedia nên xoay ngang/dọc cũng tính lại.
  const mobile = useMobileViewport();
  const maxHeight = React.useMemo(
    () => stemImageMaxHeight({ port, below, mobile }),
    [port, below, mobile],
  );
  // Chỉ bọc thành điểm bấm khi trần THẬT SỰ cắn: ảnh đã nguyên khổ (`maxHeight`
  // undefined — ca "ảnh LÀ cả đề bài", chính sách #427) thì phóng to không cho
  // thêm gì, mà thêm `<button>` thì thêm một điểm dừng tab và một kính lúp che
  // ảnh, đổi lấy con số không.
  const zoomable = Boolean(src && maxHeight);
  const picture = (
    <img
      src={src}
      alt={alt}
      className="h-auto w-auto max-w-full object-contain rounded-2xl drop-shadow-md bg-white p-5"
      style={{
        // Khi có nút bọc ngoài thì `width` nằm trên NÚT (xem ImageZoomTarget) —
        // để cả hai chỗ thì `%` nhân hai lần, ảnh co còn 72% của 72%.
        ...(width && !zoomable ? { maxWidth: width } : null),
        ...(maxHeight ? { maxHeight } : null),
      }}
    />
  );
  return (
    <div ref={ref} className="flex justify-center mt-3" data-testid="stem-image">
      {zoomable ? (
        <ImageZoomTarget src={src as string} alt={alt} width={width}>
          {picture}
        </ImageZoomTarget>
      ) : (
        picture
      )}
    </div>
  );
}

/**
 * Chèn thanh accent ngay SAU node của block thứ `barIdx` (xem chỗ tính
 * `stemBarIdx`). Làm ở tầng danh sách đã render vì block cuối của đề có thể rơi
 * vào bất kỳ nhánh nào trong ~15 nhánh của map (ảnh, lưới, bảng, layout…) —
 * rải điều kiện vào từng nhánh là cách chắc chắn sẽ quên một nhánh.
 */
function withStemBar(
  barIdx: number,
  barCls: string,
  nodes: React.ReactNode[],
): React.ReactNode[] {
  if (barIdx < 0 || barIdx >= nodes.length) return nodes;
  return nodes.map((node, i) =>
    i === barIdx ? (
      <React.Fragment key={`stem-bar-${i}`}>
        {node}
        <div className={barCls} />
      </React.Fragment>
    ) : (
      node
    ),
  );
}

/** Header used by every player: title + accent bar + instruction.
 * The accent bar hue comes from AccentContext (the player's identity accent,
 * provided by dispatch) — players no longer pass an `accent` class prop. */
export function PlayerHeader({
  title,
  richContent,
  instruction,
  context,
  imageSrc,
  compact = false,
}: {
  title: string;
  richContent?: { blocks?: ContentBlock[] };
  instruction?: string;
  context?: string;
  imageSrc?: string;
  /** Inside a question_group, the group already shows shared title/instruction
   * chrome — suppress this child's own title/instruction/context, but still show
   * any image blocks: they're unique per-child content, not redundant chrome. */
  compact?: boolean;
}) {
  const skin = useSkin();
  const accent = useAccent();
  const blocks = richContent?.blocks;
  const hasRich = blocks && blocks.length > 0;
  const hasTitle = title.trim().length > 0;
  const hasHeaderContent = hasRich || hasTitle || Boolean(instruction || context || imageSrc);
  const headingCls =
    skin.heading ??
    "text-xl md:text-2xl font-black text-question-title tracking-tight font-player-display leading-tight";
  const barCls = skin.accentBar ?? `w-24 h-1.5 rounded-full ${accent.bar}`;
  const instructionCls =
    skin.instruction ??
    "text-slate-500 font-bold italic text-sm sm:text-base md:text-lg mt-2";

  if (compact) {
    // Child of a question_group: the group already renders the shared heading,
    // so suppress title/instruction chrome — but the child's OWN content blocks
    // (stem text, images, tables) are real content, render them compactly.
    if (!hasRich) return null;
    return (
      <div className="mb-3">
        <RichContentBlocks blocks={blocks!} compact allowMediaGrid />
      </div>
    );
  }

  if (!hasHeaderContent) return null;

  return (
    <div className="mb-4 md:mb-6">
      <div className="flex flex-col gap-1">
        {hasRich ? (
          <RichContentBlocks blocks={blocks!} allowMediaGrid />
        ) : hasTitle ? (
          <>
            <h2 className={headingCls}>
              <PlayerTextValue value={title} />
            </h2>
            <div className={barCls} />
          </>
        ) : null}
        {instruction && (
          <p className={instructionCls}>
            <PlayerTextValue value={instruction} />
          </p>
        )}
      </div>

      {/* imageSrc only used when richContent is absent (prevents duplicating images) */}
      {!hasRich && imageSrc && (
        <div className="flex justify-center mt-4">
          <img
            src={imageSrc}
            alt="Hình minh họa bài tập"
            // Same rule as the content-block picture above: the question's own
            // illustration renders at natural size, capped only by the column
            // width so it cannot overflow.
            className="h-auto w-auto max-w-full object-contain rounded-2xl drop-shadow-md"
          />
        </div>
      )}

      {context && (
        <div className={`p-3 md:p-4 mt-4 text-base md:text-lg italic ${skin.emphasis?.("neutral", "medium") ?? "text-slate-800 font-bold"} ${skin.panel?.("inset") ?? "bg-white/70 rounded-2xl border-4 border-white"}`}>
          <PlayerTextValue value={context} />
        </div>
      )}
    </div>
  );
}

/**
 * Uniform "Đáp án đúng" reveal footer, rendered by PlayerShell after the
 * interaction body once `submitted` is true and the player supplies
 * `answerReveal`. Mirrors the emerald styling used by
 * `QuestionAnswerSummary` (src/core/question-renderer/TypePresenters.tsx).
 */
export function CorrectAnswerReveal({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base md:text-lg text-emerald-900 ">
      <p className="text-sm md:text-base font-semibold text-emerald-700 ">Đáp án đúng</p>
      <div className="mt-1 whitespace-pre-wrap">
        {typeof children === "string" ? <PlayerTextValue value={children} /> : children}
      </div>
    </div>
  );
}

/** Dấu kết thúc một câu trọn vẹn, cho phép đóng ngoặc/nháy đứng sau. */
const SENTENCE_END = /[.!?…]["'”’)\]]?\s*$/;

/** Nối các thẻ của một nhóm — luật dấu câu ở docblock của `groupedMappingReveal`. */
function joinRevealMembers(members: string[]): string {
  // Dấu ngăn xét theo TỪNG thẻ đứng trước, không theo cả nhóm một lượt: nhóm
  // trộn câu với từ mà xét cả nhóm thì ra "vắng vẻ., chó.".
  const joined = members
    .map((member, i) => (i === 0 ? member : `${SENTENCE_END.test(members[i - 1]) ? " " : ", "}${member}`))
    .join("");
  // Thẻ CUỐI có dấu câu sẵn → đừng cộng thêm dấu chấm nữa ("trắng..").
  return SENTENCE_END.test(members[members.length - 1]) ? joined : `${joined}.`;
}

/** web-own: chưa upstream lên studio — xem checklist trong
 *  apps/learner/scripts/detokenize-players.mjs.
 *
 *  Bảng đáp án của nhóm phân loại (P24 categorize, card_sort, P28 two_bucket,
 *  P26 zones) GỘP THEO NHÓM — mỗi nhóm một dòng — chứ không in mỗi thẻ một dòng
 *  "thẻ → nhóm": khớp cách file đáp án NXB trình bày, và 9 câu Tiếng Việt 3/4/5
 *  đã bị báo lỗi vì dạng cũ (bảng ghi nhận lỗi TV, bài 4 & 24 TV3…).
 *
 *  THỨ TỰ lấy từ `groups` rồi `items` — KHÔNG từ `correctMappings`. Bảng mapping
 *  ghi theo thứ tự người nhập liệu gõ, nên duyệt xuôi nó thì các thẻ cùng nhóm
 *  chỉ TÌNH CỜ đứng cạnh nhau. Mapping ở đây chỉ dùng để tra cứu.
 *
 *  id lạ (mapping trỏ nhóm/thẻ không khai) KHÔNG bị nuốt: nối đuôi sau phần đã
 *  khai, in id thô làm nhãn — đúng hành vi của khuôn mũi tên cũ. NGOẠI LỆ: key
 *  trùng id một NHÓM đã khai mà KHÔNG phải thẻ đã khai là rác chiều ngược, bỏ
 *  qua — quét nội dung thật thấy TV3/1 "Để cháu nắm tay ông" khai cả hai chiều
 *  trong một `correctAnswer` (`c_hd: "s_c,s_d,s_e"` nằm cạnh `s_c: "c_hd"`), in
 *  ra là đẻ thêm ba nhóm ma. Chấm bài cũng bỏ qua đúng những key đó (nó duyệt
 *  theo items), nên bảng đáp án theo cùng một luật. Vế "không phải thẻ đã khai"
 *  là bắt buộc: bỏ theo mỗi id nhóm thì một thẻ khai thật mà id tình cờ trùng
 *  sẽ rơi im lặng khỏi bảng, không có cả đường lùi mũi tên.
 *
 *  DẤU CÂU xét theo TỪNG thẻ đứng trước nó, không theo cả nhóm một lượt: thẻ đã
 *  tự đóng bằng dấu câu (./!/?/…) thì ngăn bằng dấu cách, còn lại ngăn bằng dấu
 *  phẩy; cuối dòng đóng bằng dấu chấm như file NXB trừ khi thẻ cuối đã có sẵn.
 *  Xét cả nhóm một lượt thì nhóm TRỘN câu với từ rơi hết vào nhánh phẩy và ra
 *  "vắng vẻ., chó." — mà trộn là có thật khi tác giả gõ thừa dấu chấm ở một thẻ.
 *  Không cắt bớt dấu tác giả đã gõ: cắt là hỏng "v.v." và dấu nháy đóng.
 *
 *  Trả `null` = "không gộp được", chỗ gọi tự lùi về khuôn mũi tên: thẻ chỉ có
 *  ảnh (card_sort) gộp lại sẽ ra một dòng đầy URL, không đọc nổi. Thẻ có text
 *  rỗng hoặc toàn khoảng trắng tính là thẻ không chữ — text được `trim()` trước
 *  khi xét, nếu không nó lọt xuống thành một thẻ trống giữa dòng gộp. */
export function groupedMappingReveal({
  groups,
  items,
  correctMappings,
}: {
  groups: readonly { id: string; label: string }[];
  items: readonly { id: string; text?: string }[];
  correctMappings: Record<string, string>;
}): string | null {
  const groupLabel = new Map(groups.map((g) => [g.id, g.label]));
  const label = new Map(items.map((it) => [it.id, it.text?.trim()]));
  // Rác chiều ngược: key trỏ một nhóm đã khai VÀ bản thân nó không phải thẻ đã
  // khai → không phải một dòng đáp án, bỏ. Thẻ khai thật mà id tình cờ trùng id
  // một nhóm thì vẫn giữ, nếu không nó rơi im lặng khỏi bảng.
  const entries = Object.entries(correctMappings ?? {}).filter(
    ([key]) => !groupLabel.has(key) || label.has(key),
  );
  if (entries.length === 0) return null;
  // Một thẻ không có chữ thì cả bảng lùi về khuôn cũ — gộp nửa vời (vài dòng
  // gộp, vài dòng mũi tên) khó đọc hơn là giữ nguyên một khuôn.
  if (entries.some(([itemId]) => label.has(itemId) && !label.get(itemId))) return null;

  // Nhóm: đã khai trước, id lạ nối đuôi theo thứ tự xuất hiện trong mapping.
  const groupOrder = [...new Set([...groups.map((g) => g.id), ...entries.map(([, g]) => g)])];
  // Thẻ trong nhóm: cũng đã khai trước, id lạ nối đuôi.
  const known = new Set(entries.map(([i]) => i));
  const itemOrder = [
    ...items.map((it) => it.id).filter((id) => known.has(id)),
    ...entries.map(([i]) => i).filter((i) => !label.has(i)),
  ];

  const lines = groupOrder
    .map((groupId) => {
      const members = itemOrder
        .filter((itemId) => correctMappings[itemId] === groupId)
        .map((itemId) => label.get(itemId) ?? itemId);
      // Nhóm rỗng: bỏ hẳn dòng, file đáp án NXB không in nhóm không có từ nào.
      if (members.length === 0) return null;
      return `- ${groupLabel.get(groupId) ?? groupId}: ${joinRevealMembers(members)}`;
    })
    .filter((line): line is string => line !== null);

  return lines.length > 0 ? lines.join("\n") : null;
}

/** web-own: chưa upstream lên studio — xem checklist trong
 *  apps/learner/scripts/detokenize-players.mjs.
 *
 *  Ảnh trong khối đáp án: CHẶN TRẦN hai chiều chứ không ép khung vuông — băng
 *  chữ dài (900×120) lọt khung vuông 64px chỉ còn dải cao 8px, không đọc nổi.
 *  `width` tác giả vẫn bỏ qua: bảng đáp án là bản tóm tắt, không phải chỗ dựng
 *  lại kích thước thẻ gốc.
 *
 *  `alt` lấy nhãn của CHÍNH ô (không phải `item.text` mà MatchItemBody truyền
 *  vào — ô toàn ảnh có `text` rỗng nên ảnh sẽ câm với trình đọc màn hình). */
const matchPairRevealImage = (alt: string) => ({ src }: { src: string }) => (
  <ExerciseImage
    variant="natural"
    src={src}
    alt={alt}
    className="max-h-14 sm:max-h-16 max-w-[10rem] shrink-0 rounded-xl"
  />
);

/**
 * Nhãn ĐỌC ĐƯỢC của một item nối: chữ của item, hoặc `alt` tác giả đặt cho ảnh
 * khi item chỉ có tranh. Cùng thứ tự dự phòng với `nodeAccessibleLabel` của
 * scene player — item toàn ảnh vốn không có chữ nào để trình đọc màn hình đọc.
 */
function matchItemAccessibleLabel(item: MatchItemContent): string {
  const label = item.text?.trim() || plainTextFromRichContent(item.content).trim();
  if (label) return label;
  const blocks = flattenNestedContentBlocks(item.content?.blocks) as ContentBlock[];
  for (const block of blocks) {
    if (block.type !== "image") continue;
    const alt = (block.alt ?? block.altText)?.trim();
    if (alt) return alt;
  }
  return "";
}

/**
 * `max-w-full` là cái chặn cuối, đừng gỡ: ô KHOÁ CỨNG bề rộng (`shrink-0`) mà
 * không có trần thì rộng bằng max-content — chữ dài nằm trọn một dòng, không
 * ngắt. `flex-wrap` đẩy được ô sang dòng mới chứ không bóp nổi một ô đơn lẻ
 * rộng hơn dòng, mà `PlayerShell` bọc ngoài là `overflow-hidden` nên phần
 * tràn bị XÉN — học sinh mất hẳn đuôi đáp án và không có thanh cuộn nào báo.
 * Có trần thì chữ ngắt trong lòng ô như thường.
 */
const MATCH_PAIR_REVEAL_CHIP_BASE =
  "flex min-w-0 max-w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-300 bg-white px-3 py-2 text-center text-sm sm:text-base font-bold text-emerald-900";
/** Hàng HAI ô: chia đôi chỗ trống cho cân, không bao giờ phải xuống dòng. */
const MATCH_PAIR_REVEAL_CHIP = `${MATCH_PAIR_REVEAL_CHIP_BASE} flex-1`;
/**
 * Hàng BA Ô TRỞ LÊN (chuỗi nối ba cột) nằm LIỀN MỘT DÒNG: bỏ `flex-1` để ô
 * rộng đúng bằng nội dung, hết chỗ thì ô CO LẠI (`min-w-0` ở lớp nền) và chữ
 * dài tự ngắt bên trong ô — chứ không đẩy ô xuống dòng dưới.
 *
 * Dưới 640px thì ngược lại, cho xuống dòng: ba ô co hết cỡ trên màn điện thoại
 * thì chữ gãy thành cột dọc, và ô chứa ẢNH vốn KHÔNG co được
 * (`matchPairRevealImage` khoá `shrink-0`) nên ép liền dòng sẽ làm hàng tràn ra
 * ngoài màn hình. Từ 640px trở lên ba ảnh (trần 10rem) vẫn thừa chỗ.
 */
const MATCH_CHAIN_REVEAL_ROW = "flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3";
/**
 * Hàng chuỗi KHÔNG có ô nào nhường được chỗ (toàn ảnh, hoặc chỉ toàn nhãn
 * ngắn): ép liền dòng chỉ có thể kết thúc bằng tràn, nên cho xuống dòng ở MỌI
 * khổ. Vừa một dòng thì nó vẫn nằm một dòng.
 */
const MATCH_CHAIN_REVEAL_ROW_WRAP = "flex flex-wrap items-center gap-2 sm:gap-3";
const MATCH_PAIR_REVEAL_ROW = "flex items-center gap-2 sm:gap-3";
/**
 * Nhãn ngắn cỡ này thì bóp ô cũng chẳng bớt được mấy px, chỉ tổ gãy chữ làm
 * hai dòng. Đếm theo KÝ TỰ chứ không đo px: khối đáp án dựng xong mới biết bề
 * rộng thật, mà chọn lúc dựng thì chỉ có nhãn trong tay.
 */
const MATCH_CHAIN_SHORT_LABEL = 16;

/**
 * Ô có ảnh/video hay không — hỏi trên danh sách block ĐÃ PHẲNG, đúng danh sách
 * {@link MatchItemBody} dựng ra. `matchItemsHaveMedia` chỉ quét `content.blocks`
 * tầng một, nên ảnh bị soạn lồng vào `content` của một block khác thì nó trả
 * false trong khi ô vẫn render ảnh — vừa đủ để lỗi "ảnh trào qua viền" quay lại
 * bằng cửa sau. Để riêng ở đây chứ không sửa `matchItemsHaveMedia`, vì hàm đó
 * còn gác cả `matchColumnItemsClass` của mọi câu nối.
 */
function matchItemHasMedia(item: MatchItemContent): boolean {
  if (item.imageUrl) return true;
  const blocks = flattenNestedContentBlocks(item.content?.blocks) as ContentBlock[];
  return blocks.some((block) => block.type === "image" || Boolean(getBlockMediaUrl(block)));
}

/**
 * MỘT trong hai, không bao giờ cả hai và không bao giờ rỗng tay: `pairs` là
 * khuôn hai ô của bốn player nối hai cột, `rows` là hàng dài tuỳ ý của chuỗi ba
 * cột. Khai bằng union (chứ không phải hai prop cùng tuỳ chọn) để `<MatchPairsReveal />`
 * trống trơn không qua nổi trình biên dịch.
 */
type MatchPairsRevealProps =
  | { pairs: { item: MatchItemContent; target: MatchItemContent }[]; rows?: never }
  | { rows: MatchItemContent[][]; pairs?: never };

/**
 * Các cặp đúng của câu nối, dựng bằng CHÍNH thẻ item thay vì một dòng chữ
 * `trái → phải`. Item chỉ có ảnh (`text` rỗng) trước đây rơi ra chuỗi rỗng nên
 * khối đáp án chỉ còn mũi tên; ở đây ảnh hiện lại như ô trong bài.
 *
 * Một hàng là MỘT liên kết trọn vẹn, dài tuỳ ý: `pairs` cho câu nối hai cột,
 * `rows` cho chuỗi ba cột (`a → m → r`). Chuỗi mà tách thành hai hàng rời
 * (`a → m` rồi `m → r`) bắt học sinh tự ghép lại mới hiểu — NXB ghi nhận ở
 * TV4 tập 1 bài 2 và bài 28 ("chia rối").
 *
 * web-own: đường `rows` và cách dựng hàng chuỗi chưa upstream lên studio — xem
 * WEB-OWN PATCHES trong apps/learner/scripts/detokenize-players.mjs. Copy đè
 * file này từ studio sẽ trả lại lỗi "chia rối".
 */
export function MatchPairsReveal(props: MatchPairsRevealProps) {
  const lines = props.rows ?? props.pairs.map(({ item, target }) => [item, target]);
  return (
    <ul className="flex flex-col gap-2">
      {lines.map((items, i) => {
        const labels = items.map(matchItemAccessibleLabel);
        const chain = items.length > 2;
        // Chuỗi liền dòng: dồn phần CO vào ô dài nhất. Mặc định flexbox co đều
        // mọi ô, nên ô ngắn ("Mùa xuân") gãy làm hai dòng trong khi ô dài bên
        // cạnh mới là chỗ thừa chữ. Không ô nào đủ dài để gánh thì để cả hàng
        // cùng co như cũ, kẻo hàng tràn ra ngoài khung.
        //
        // Gánh được hay không phải hỏi ô CÓ MEDIA KHÔNG, chứ không chỉ nhìn
        // độ dài nhãn: ảnh khoá `shrink-0` nên ô chứa ảnh không nhường nổi một
        // px — kể cả ô vừa có ảnh vừa có một dòng chữ dài. Tính nhầm nó là ô
        // gánh thì ô bên cạnh được miễn co, còn ảnh bị bóp lòi hẳn ra ngoài
        // khung (đo ở cột 300px: ô ảnh còn 27px, ảnh tràn 31px). `hasItemLabel`
        // một mình chỉ loại được ô TOÀN ảnh; ô ảnh-kèm-chữ vẫn lọt qua, nên
        // phải hỏi thẳng `matchItemHasMedia` — nó bắt cả ảnh `imageUrl` phẳng
        // lẫn ảnh tác giả soạn thành block trong `content`, kể cả block lồng.
        const canAbsorb = (j: number) =>
          hasItemLabel(items[j])
          && !matchItemHasMedia(items[j])
          && labels[j].length > MATCH_CHAIN_SHORT_LABEL;
        const hasAbsorber = chain && items.some((_, j) => canAbsorb(j));
        // Ô KHÔNG gánh được thì khoá cứng bề rộng. Để nó co là co KHUNG chứ
        // không co nội dung: ảnh bên trong giữ nguyên cỡ và trào qua viền bo
        // (đo ở cột 300px: ảnh lòi ra khỏi ô 34px).
        const chipClass = (j: number) => (chain
          ? cn(MATCH_PAIR_REVEAL_CHIP_BASE, !canAbsorb(j) && "shrink-0")
          : MATCH_PAIR_REVEAL_CHIP);
        return (
          <li
            key={i}
            // Mũi tên là hình trang trí, các ô có thể toàn ảnh — không có nhãn
            // thì cả hàng câm với trình đọc màn hình. Thiếu nhãn dù chỉ MỘT ô
            // là bỏ hẳn aria-label để trình đọc quay về đọc nội dung từng ô.
            aria-label={labels.every(Boolean) ? labels.join(" → ") : undefined}
            className={
              chain
                ? (hasAbsorber ? MATCH_CHAIN_REVEAL_ROW : MATCH_CHAIN_REVEAL_ROW_WRAP)
                : MATCH_PAIR_REVEAL_ROW
            }
          >
            {items.map((item, j) => (
              <React.Fragment key={j}>
                {j > 0 && (
                  <span aria-hidden className="shrink-0 text-lg leading-none text-emerald-600">
                    →
                  </span>
                )}
                <span className={chipClass(j)}>
                  <MatchItemBody
                    item={item}
                    // Ô đã có chữ hiện ra thì để `alt` rỗng, kẻo trình đọc màn
                    // hình đọc cùng một nhãn hai lần (một cho ảnh, một cho chữ).
                    renderImage={matchPairRevealImage(hasItemLabel(item) ? "" : labels[j])}
                  />
                </span>
              </React.Fragment>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * CHỖ GOM cờ `presentation.hideInlineFeedback`: có được render DÒNG phản hồi
 * đúng/sai tự-hiển-thị bên trong nội dung câu hỏi hay không.
 *
 * Owner 4/8: surface học sinh KHÔNG hiện các dòng "🎉 Chính xác!" / "Tuyệt
 * vời! 🎉" / "Chưa đúng, thử lại nhé! 🤔" — chúng chen vào giữa nội dung bài.
 * Phản hồi CHÍNH vẫn còn nguyên: tô màu đúng/sai per-element + âm thanh
 * (useGrading) + `answerReveal` (đã bị revealCorrect=false chặn riêng ở web).
 * `studioSkin` không khai cờ → QA duyệt nội dung vẫn thấy đủ phản hồi.
 *
 * Dùng qua <PlayerInlineFeedback> khi markup là một dòng text thuần; gọi
 * thẳng hook này khi player có markup riêng (icon, span trong hàng nút…).
 */
export function useInlineFeedbackShown(): boolean {
  return useSkin().presentation?.hideInlineFeedback !== true;
}

/**
 * Một dòng phản hồi đúng/sai tự-hiển-thị trong nội dung câu hỏi. Tự ẩn ở
 * surface học sinh (xem useInlineFeedbackShown) và tự lấy class từ
 * `skin.feedback(kind)`, `fallbackClass` là class gốc của player.
 *
 * CHỈ dùng cho kind "success"/"error" (verdict). Dòng "Đã ghi nhận…" là kind
 * `neutral` — biên nhận đã lưu bài, KHÔNG đi qua đây và không bị ẩn.
 */
export function PlayerInlineFeedback({
  kind,
  show = true,
  fallbackClass,
  children,
}: {
  kind: "success" | "error";
  show?: boolean;
  fallbackClass: string;
  children: React.ReactNode;
}) {
  const skin = useSkin();
  const inlineFeedbackShown = useInlineFeedbackShown();
  if (!show || !inlineFeedbackShown) return null;
  return <p className={skin.feedback?.(kind) ?? fallbackClass}>{children}</p>;
}

/**
 * Uniform red "wrong, try again" line for the self-graded check path. Render
 * with `show={status === "error" && !submitted}` so an in-player "Kiểm tra"
 * that grades incorrect is NEVER silent — the error sound (useGrading) plus
 * this line is the guaranteed minimum feedback, on top of any per-element red
 * the player can draw. Skin-aware via `feedback("error")`.
 *
 * Ở surface học sinh (`presentation.hideInlineFeedback`) dòng này KHÔNG render
 * — âm thanh lỗi + màu đỏ per-element gánh phần phản hồi. Gate nằm ở ĐÂY nên
 * ~30 player đang dùng component này được gỡ mà không phải sửa dòng nào.
 */
export function PlayerErrorFeedback({
  show,
  children,
}: {
  show: boolean;
  children?: React.ReactNode;
}) {
  return (
    <PlayerInlineFeedback
      kind="error"
      show={show}
      fallbackClass="mt-4 text-center text-red-500 font-black text-lg md:text-xl"
    >
      {children ?? "Chưa đúng, thử lại nhé! 🤔"}
    </PlayerInlineFeedback>
  );
}

/** Overall verdict banner shown in "parent" grade mode. */
export function ResultBanner({
  result,
}: {
  result: "correct" | "incorrect" | "incomplete";
}) {
  const skin = useSkin();
  if (result === "incomplete") {
    return (
      <div
        className={
          skin.banner?.neutral ??
          "mt-4 rounded-2xl border-4 border-slate-200 bg-slate-100 p-3 text-center font-bold text-slate-500"
        }
      >
        Đã ghi nhận câu trả lời.
      </div>
    );
  }
  const correct = result === "correct";
  const cls = correct
    ? skin.banner?.correct ??
    "mt-4 rounded-2xl border-4 border-green-400 bg-green-50  p-3 text-center font-black text-green-700 "
    : skin.banner?.wrong ??
    "mt-4 rounded-2xl border-4 border-red-400 bg-red-50  p-3 text-center font-black text-red-600";
  return <div className={cls}>{correct ? "Đúng rồi! 🎉" : "Chưa đúng 😅"}</div>;
}

/**
 * Sàn/trần bề rộng ô điền khi bề rộng được suy TỪ ĐÁP ÁN (đơn vị `ch` — bề
 * rộng ký tự "0" của chính font đang dùng, nên tự đúng khi đổi cỡ chữ).
 *
 * MIN 6ch: sàn "đều đẹp" — các đáp án 1–4 ký tự ("3", "15", "một") cho ra cùng
 * một cỡ ô nên hàng ô điền không lởm chởm. MAX 24ch: đáp án dài (một câu) thì
 * dừng lại, phần dư để AutoGrowInput tự giãn theo chữ học sinh gõ.
 */
export const BLANK_ANSWER_MIN_CH = 6;
export const BLANK_ANSWER_MAX_CH = 24;

/**
 * Bề rộng ô điền suy từ đáp án — "giống sách": chỗ trống dài ngắn theo đáp án
 * (Owner 12/8, chốt bám sát độ dài thay vì gom bậc).
 *
 * Lấy đáp án DÀI NHẤT trong `acceptedAnswers` (không phải ngắn nhất) để không
 * bao giờ cắt chữ khi học sinh điền đúng một biến thể dài; cộng 2ch cho
 * padding + viền của ô.
 *
 * `undefined` = KHÔNG suy được (câu record-only/tự chấm không có key, hoặc đáp
 * án rỗng) → caller giữ nguyên cỡ mặc định như trước.
 *
 * Chỉ dùng cho ô MỘT DÒNG và chỉ khi tác giả KHÔNG khai `width`/`input.size`:
 * ý đồ tác giả vẫn thắng auto-sizing (Tầng 2 bộ rules player).
 */
export function blankAnswerWidth(acceptedAnswers?: string[]): string | undefined {
  if (!acceptedAnswers || acceptedAnswers.length === 0) return undefined;
  let daiNhat = 0;
  for (const answer of acceptedAnswers) {
    const len = String(answer ?? "").trim().length;
    if (len > daiNhat) daiNhat = len;
  }
  if (daiNhat <= 0) return undefined;
  const ch = Math.min(Math.max(daiNhat + 2, BLANK_ANSWER_MIN_CH), BLANK_ANSWER_MAX_CH);
  return `${ch}ch`;
}

/**
 * Cỡ hộp của một ô điền (cloze / fill_blank) — MỘT chỗ quyết định duy nhất cho
 * cả hai player, thay cho hai bản sao của cùng một biểu thức ba tầng.
 *
 * Bốn ca:
 *
 * 1. Tác giả KHAI `width`/`input.size` + surface HỌC SINH + ô gõ tay → con số
 *    đó là **SÀN**, không có trần. Đây là chỗ sửa: trước đây nhánh này khoá
 *    `maxWidth`, nên `<input>` cuộn ngang BÊN TRONG và chữ học sinh vừa gõ biến
 *    mất khỏi màn hình — đúng lớp lỗi mà `AutoGrowInput` sinh ra để chặn, chỉ
 *    khác là nó lọt qua ở mọi câu có khai bề rộng. Trần thật giờ là bề rộng
 *    dòng (`max-w-full` của khung grid); vượt nữa thì ô tự xuống dòng.
 * 2. Tác giả KHAI width nhưng surface STUDIO (QA / trình soạn) → giữ hộp khoá
 *    như cũ: người soạn phải thấy đúng con số mình đặt, và tay kéo đổi cỡ
 *    (`ResizeHandle`) chỉ chạy ở surface này.
 * 3. KHÔNG khai width, surface học sinh → sàn suy từ đáp án, không clamp.
 * 4. KHÔNG khai width, surface studio → sàn co theo khung như trước.
 *
 * `grows` = ô này có cơ chế tự rộng theo chữ hay không (chỉ `AutoGrowInput`).
 * Dropdown `<select>` và `<textarea>` nhiều dòng dùng chung hàm này nhưng
 * KHÔNG tự giãn ngang, nên bỏ trần cho chúng chỉ làm hộp phình theo lựa chọn
 * dài nhất mà chẳng cứu được chữ nào — chúng ở lại ca 2.
 *
 * `"100%"` (`input.size: "full"`) cũng ở lại ca 2: ô đã chiếm trọn dòng, biến
 * nó thành sàn không cứu được chữ dài, chỉ đổi bề rộng lúc ô còn trống.
 */
export function blankBoxStyle(opts: {
  /** `blanks[].width` hoặc preset `input.size` tác giả khai; mặc định 7rem/10rem. */
  preferredWidth: string;
  /** Sàn suy từ đáp án (`blankAnswerWidth`), đã fallback về `preferredWidth`. */
  autoWidth: string;
  widthAuthored: boolean;
  /** `skin.presentation.spaciousBlanks === true` — surface học sinh. */
  spacious: boolean;
  grows: boolean;
}): React.CSSProperties {
  const { preferredWidth, autoWidth, widthAuthored, spacious, grows } = opts;
  if (widthAuthored) {
    return spacious && grows && preferredWidth !== "100%"
      ? { minWidth: preferredWidth }
      : { width: `min(${preferredWidth}, 42cqi)`, minWidth: "3.5rem", maxWidth: preferredWidth };
  }
  return spacious
    ? { minWidth: autoWidth }
    : { minWidth: `max(3.5rem, min(${autoWidth}, 42cqi))` };
}

/** Scrollable shell wrapping the header + interaction body. */
export function PlayerShell({
  title,
  richContent,
  instruction,
  context,
  imageSrc,
  compact = false,
  nested = false,
  submitted,
  answerReveal,
  children,
}: PlayerProps & { answerReveal?: React.ReactNode; children: React.ReactNode }) {
  const { mode, result, hideBanner, revealCorrect, silent, silentVerdict } =
    useGradeMode();
  // Chấm câm: banner chỉ hiện SAU KHI nộp, lấy verdict player tự chấm. Chấm kín
  // thật (bài GV giao) giữ nguyên: hiện ngay khi host bơm `result` xuống.
  const bannerResult = silent
    ? submitted
      ? silentVerdict
      : undefined
    : mode === "parent"
      ? result
      : undefined;
  return (
    // `overflow-hidden` ở đây và `overflow-y-auto` ở lớp trong là bộ khung của
    // MÀN LÀM BÀI: chặn nội dung tràn ra ngoài vùng chơi và cho cuộn khi câu
    // dài. Câu CON (`nested`) không có màn riêng — nó nằm trong ô của nhóm —
    // nên hai lớp cắt đó chỉ còn tác hại; xem ghi chú ở lớp trong.
    <div className={`flex flex-col h-full ${nested ? "" : "overflow-hidden"}`}>
      {/* `relative` chặn .sr-only absolute (QuestionGroup) neo ra body làm cửa
          sổ cuộn được ra vùng trống — web-delta 0c92d1f, đừng bỏ.

          Padding: `p-2 sm:p-3 md:p-4` là padding MÀN — dành cho shell cấp cao
          chiếm trọn vùng làm bài. Câu CON (`nested`) bỏ lớp này: ô của wrapper
          đã có padding riêng, chồng thêm là mỗi ô mất ~50px mỗi cạnh.

          `overflow-y-auto` cũng CHỈ cho shell cấp cao (Owner 9/8). Ở câu con nó
          vừa vô dụng vừa có hại: vô dụng vì lớp này cao bằng nội dung nên không
          bao giờ cuộn (khung cuộn thật là của runner); có hại vì cắt mọi thứ vẽ
          ra ngoài padding-box, mà từ lúc bỏ padding màn cho `nested` thì thẻ
          đáp án nằm SÁT mép — đo trên `10834585/bai26` câu 3: ô "A 1 góc" mép
          trái đúng 148px, bằng mép lớp cắt, nên `whileHover scale 1.02` phình
          1,4px là xén mất nét viền trái. */}
      <div
        className={`relative flex-1 pb-2 ${nested ? "" : "overflow-y-auto p-2 sm:p-3 md:p-4"
          }`}
      >
        <div className="max-w-4xl mx-auto">
          <PlayerHeader
            title={title}
            richContent={richContent}
            instruction={instruction}
            context={context}
            imageSrc={imageSrc}
            compact={compact}
          />
          {children}
          {/* Khối "Đáp án đúng" tôn trọng revealCorrect như các player choice:
              revealCorrect=false (surface học sinh — QuestionPlayer web truyền
              xuống) thì chấm sai KHÔNG được liệt kê đáp án, retry mới còn ý
              nghĩa. undefined = studio/QA, giữ nguyên để duyệt nội dung. */}
          {submitted && answerReveal && revealCorrect !== false && (
            <CorrectAnswerReveal>{answerReveal}</CorrectAnswerReveal>
          )}
          {bannerResult && !hideBanner && <ResultBanner result={bannerResult} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Common grading lifecycle: report answer, play feedback, fire status + onComplete.
 *
 * `evaluate` returns:
 *  - "correct"    → success state, fires onComplete after a beat
 *  - "incorrect"  → error flash (caller decides whether to reset)
 *  - "incomplete" → answer recorded, no grading yet (e.g. essay / scale)
 */
export type Verdict = "correct" | "incorrect" | "incomplete";

export function useGrading({
  onAnswerChange,
  onComplete,
  onStatusChange,
}: Pick<PlayerProps, "onAnswerChange" | "onComplete" | "onStatusChange">) {
  const { mode, onSilentVerdict } = useGradeMode();
  const [status, setStatus] = useState<TaskStatus>("idle");

  const report = useCallback(
    (answer: unknown, verdict: Verdict) => {
      onAnswerChange?.(answer);
      // Parent-graded: the player only emits the answer. The parent owns the
      // verdict, sounds and completion — so we never self-grade here.
      if (mode === "parent") {
        // Verdict vừa tính vẫn ĐÚNG theo loại; host chấm kín cần nó để ghi điểm
        // mà không phải chấm lại bằng bộ chấm ngoài. Không hiển thị gì thêm.
        onSilentVerdict?.(verdict);
        setStatus("idle");
        onStatusChange?.("idle");
        return;
      }
      if (verdict === "correct") {
        setStatus("success");
        onStatusChange?.("success");
        playSuccess();
        if (onComplete) setTimeout(onComplete, 1200);
      } else if (verdict === "incorrect") {
        setStatus("error");
        onStatusChange?.("error");
        playError();
      } else {
        setStatus("idle");
        onStatusChange?.("idle");
      }
    },
    [mode, onAnswerChange, onComplete, onStatusChange, onSilentVerdict],
  );

  // `mode` được trả ra để player gate chrome tự-chấm (nút "Kiểm tra"…) bằng
  // `mode !== "parent"` — luồng thi/parent-graded không được thấy nút. (web-delta)
  return { status, setStatus, report, mode };
}

/** Order-independent set equality for string ids. */
export function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/**
 * Instant per-element grading. The player owns per-element correctness and calls
 * `grade(id, verdict)` on each commit event; this hook holds the verdict map,
 * emits onElementGraded/onProgress, and (once every element has a verdict)
 * replays the existing whole-question `report` so sounds + onComplete keep working.
 *
 * Inactive when instantFeedback is false or recordOnly — then `reveal` returns
 * undefined and the player falls back to its button-driven behaviour.
 *
 * Parent-graded (gradeMode "parent" — thi/bài giao chấm kín): `grade`/`emit` vẫn
 * chạy để đáp án luôn được đẩy lên cha (report → onAnswerChange; sounds/status đã
 * bị useGrading nuốt ở parent mode), nhưng `reveal` trả undefined — KHÔNG lộ
 * verdict per-element (màu đúng/sai) khi đang làm.
 */
/**
 * Tìm vùng CUỘN THẬT bọc phần tử — nơi chiều cao BỊ CHẶN từ bên ngoài.
 *
 * Không được lấy bừa tổ tiên `overflow-y:auto` gần nhất: PlayerShell có một lớp
 * như vậy nhưng chiều cao của nó bằng chính nội dung (host mới chặn chiều cao),
 * nên đo theo nó rồi co nội dung sẽ làm nó co theo — vòng sau đo lại nhỏ hơn,
 * cứ thế tụt tới sàn.
 *
 * Một lớp được coi là CHẶN THẬT khi nó đang cuộn (nội dung cao hơn) hoặc còn
 * chỗ thừa (nội dung thấp hơn) — tức chiều cao của nó KHÔNG do nội dung quyết.
 */

/**
 * Vùng cuộn THẬT bao quanh một khối.
 *
 * Thứ tự ưu tiên, và lý do (Owner 10/8, ca `67287717/bai8` câu 1 — cùng một câu
 * vào hai lần cho hai cỡ ảnh):
 *
 * 1. Lớp ĐANG CUỘN THẬT (`scrollHeight > clientHeight`). Đây là bằng chứng chắc
 *    chắn nhất rằng chiều cao của nó là ngân sách thật.
 * 2. Không có lớp nào đang cuộn → lấy lớp có `clientHeight` NHỎ NHẤT. Ngân sách
 *    thật luôn là cái hộp chật nhất trong chuỗi.
 *
 * Luật cũ lấy "lớp gần nhất có khe hở" và chính nó gây lỗi: lớp cuộn của
 * `PlayerShell` nằm gần khối nhất và gần như LÚC NÀO cũng có khe hở, nên tuỳ
 * thời điểm đo mà hàm trả về 1197px (lớp shell, cao bằng nội dung, không bao
 * giờ cuộn) hay 815px (khung cuộn thật của runner) — trần ảnh vì thế nhảy giữa
 * 381px và 561px.
 */
/**
 * Tỉ lệ tối thiểu so với vùng cuộn BAO NGOÀI để một vùng cuộn được coi là
 * "khung thật" (bị ép chiều cao) thay vì "co theo nội dung".
 *
 * Vì sao cần (Owner 12/8, ca `43556966/bai6` câu 6): `PlayerShell` khai
 * `overflow-y-auto` nên nó LÀ một vùng cuộn hợp lệ, nhưng nó nằm trong một khối
 * KHÔNG bị ép chiều cao bên trong khung cuộn của runner — nghĩa là nó cao đúng
 * bằng nội dung của chính nó. Chọn nó làm `port` sinh ra vòng tự khoá: ảnh nhỏ →
 * shell ngắn → `port` nhỏ → trần nhỏ → ảnh nhỏ. Đo được: shell 363px trong khi
 * khung runner thật 715px, nên trần 45% ra 149px thay vì 322px.
 *
 * 0.9: khung bị ép luôn xấp xỉ phần khả dụng của khung bao ngoài (chênh nhau
 * chút padding/viền), còn khung co-theo-nội-dung thì nhỏ hơn hẳn.
 */
const SCROLLPORT_CONSTRAINED_RATIO = 0.9;

/**
 * Chốt vùng cuộn với HYSTERESIS MỘT CHIỀU: chỉ đổi sang khung CAO HƠN, không
 * bao giờ hạ xuống khung thấp hơn (trừ khi khung đang giữ đã rời DOM).
 *
 * Vì sao cần (Owner 12/8, ca `43556966/bai15` — màn NHÁY): tiêu chí chọn khung
 * phụ thuộc gián tiếp vào chính cỡ ảnh mà nó quyết định, nên tự dao động. Đo
 * được ở màn đó: khung runner 515px đang tràn (528) → chọn runner → ảnh co →
 * runner HẾT tràn → luật ≥90% chuyển sang shell 520px → ảnh to thêm 2px →
 * runner tràn lại → quay về 515… lặp mỗi frame. Biên độ chỉ vài pixel nhưng
 * lặp vô hạn nên mắt thấy NHÁY.
 *
 * Một chiều "chỉ lên" cắt đứt vòng: sau khi đã nhận khung cao hơn thì lần
 * resolve sau trả khung thấp hơn cũng bị bỏ qua → hội tụ ngay. Chọn hướng LÊN
 * vì khung thật là khung bị ép ngoài cùng, còn các ứng viên thấp hơn là loại
 * co-theo-nội-dung (xem SCROLLPORT_CONSTRAINED_RATIO). Cửa sổ thu nhỏ vẫn đúng:
 * ta giữ NODE, còn `clientHeight` của node đó tự cập nhật.
 */
export function stickyPort(
  hienTai: HTMLElement | null,
  ungVien: HTMLElement | null,
): HTMLElement | null {
  if (!ungVien) return hienTai && hienTai.isConnected ? hienTai : null;
  if (!hienTai || !hienTai.isConnected) return ungVien;
  if (ungVien === hienTai) return hienTai;
  return ungVien.clientHeight > hienTai.clientHeight + 1 ? ungVien : hienTai;
}

function findScrollport(el: HTMLElement): HTMLElement | null {
  const candidates: HTMLElement[] = [];
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      // Đang tràn = chắc chắn bị ép chiều cao → đúng khung, chọn ngay.
      if (node.scrollHeight > node.clientHeight + 1) return node;
      candidates.push(node);
    }
    node = node.parentElement;
  }
  if (candidates.length === 0) return null;
  // `candidates` xếp từ TRONG ra NGOÀI. Đi từ ngoài vào: giữ khung ngoài cùng
  // làm mốc, chỉ đi sâu hơn khi ứng viên bên trong CŨNG bị ép (cao xấp xỉ mốc).
  // Ứng viên thấp hơn hẳn là loại co-theo-nội-dung — bỏ qua, nếu không sẽ đo
  // trần theo chính chiều cao mà cái trần đó tạo ra.
  let port = candidates[candidates.length - 1];
  for (let i = candidates.length - 2; i >= 0; i -= 1) {
    const ungVien = candidates[i];
    if (ungVien.clientHeight <= 0) continue;
    if (ungVien.clientHeight >= port.clientHeight * SCROLLPORT_CONSTRAINED_RATIO) {
      port = ungVien;
    }
  }
  return port;
}

/**
 * Chiều cao CÒN LẠI cho một khối, đo THẬT theo vùng cuộn của host.
 *
 * Vì sao phải đo thay vì tính bằng `calc(100svh - Xrem)`: ngân sách quanh khối
 * đổi theo TỪNG CÂU — đề bài một dòng hay bốn dòng, có hàng nút hay không, câu
 * nằm trong ô nhóm hay chiếm cả màn. Số rem cứng đúng cho câu này thì sai cho
 * câu sau (Owner 8/8: "sau này content câu hỏi dài hơn thì diện tích cho grid
 * lại ít đi nữa").
 *
 * Công thức hội tụ sau MỘT lượt: `trên` (khoảng cách từ mép vùng cuộn tới khối)
 * và `dưới` (phần nội dung nằm sau khối) đều KHÔNG phụ thuộc chiều cao của
 * chính khối — khối cao lên bao nhiêu thì `scrollHeight` tăng đúng bấy nhiêu.
 * Nhờ vậy đặt lại cỡ khối theo kết quả đo không sinh vòng lặp vô tận.
 *
 * Trả `null` khi chưa đo được (lần render đầu, hoặc môi trường không có
 * ResizeObserver như jsdom) — caller giữ nguyên hành vi cũ.
 */
export function useAvailableHeight(
  ref: React.RefObject<HTMLElement | null>,
  minPx = 120,
): number | null {
  return useAvailableSpace(ref, minPx).available;
}

/**
 * Bản đầy đủ của {@link useAvailableHeight}: ngoài chỗ trống còn trả CHIỀU CAO
 * KHUNG CUỘN và PHẦN DƯỚI khối.
 *
 * Hai số đó cần cho luật nào muốn phát biểu theo *tỉ lệ màn* (trần 45% / sàn
 * 30% của khung) hoặc muốn biết "khối này có gì đứng sau nó không" — chỗ trống
 * đơn lẻ không phân biệt được "cả khung trống vì chẳng có gì phía dưới" với
 * "khung to nên phần còn lại vẫn nhiều".
 */
export function useAvailableSpace(
  ref: React.RefObject<HTMLElement | null>,
  minPx = 120,
): { available: number | null; port: number | null; below: number | null } {
  const [space, setSpace] = useState<{ available: number; port: number; below: number } | null>(
    null,
  );
  const lastMeasuredRef = useRef<number | null>(null);
  // useLayoutEffect (KHÔNG phải useEffect): lần đo đầu phải xong TRƯỚC khi trình
  // duyệt sơn khung hình. Với useEffect, khung đầu vẽ ảnh chưa có trần rồi khung
  // sau mới co lại — đo được bằng PerformanceObserver('layout-shift') trên ca
  // `95805075/bai5` câu 6: ảnh nhảy 664 → 362px mỗi lần vào câu, CLS 0,10 một
  // lần nhảy. Đó chính là hiện tượng "màn hình nháy" Owner báo 9/8, và nó xảy ra
  // cả khi ảnh đã nằm trong cache nên không phải do tải chậm.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Vùng cuộn phải được TÌM LẠI mỗi vòng đo, không chốt một lần lúc mount:
    // `findScrollport` ưu tiên node ĐANG tràn (scrollHeight > clientHeight), mà
    // lúc câu vừa mount ảnh chưa có trần nên node tràn là lớp NGOÀI của runner;
    // vài khung hình sau ảnh co lại, lớp đúng (khung làm bài) mới thành ứng
    // viên. Chốt cứng node đầu tiên = đo mãi theo khung sai → trần chốt theo
    // `port` lúc runner còn đang giãn (đo được 222px, ra ảnh 100px) rồi không
    // bao giờ sửa: đúng ca "lúc bé lúc to giữa các lần vào câu" (Owner 12/8,
    // 43556966/bai6 câu 6 — ảnh 40px lần đầu, 149px các lần sau).
    // Khung được chốt qua `stickyPort`: tìm lại mỗi vòng đo (khung đúng chỉ lộ
    // ra sau khi runner giãn xong) NHƯNG chỉ đi LÊN khung cao hơn — nếu không,
    // tiêu chí chọn khung tự dao động theo cỡ ảnh và màn bị NHÁY (xem
    // stickyPort, ca 43556966/bai15).
    let portDaChon: HTMLElement | null = null;
    const resolvePort = () => {
      portDaChon = stickyPort(portDaChon, findScrollport(el));
      return portDaChon;
    };
    const port = resolvePort();
    if (!port) return;
    // Đo theo KHỐI NỘI DUNG (con trực tiếp của vùng cuộn), KHÔNG theo
    // `scrollHeight`: khi nội dung đã vừa màn thì `scrollHeight` bị kẹp bằng
    // `clientHeight`, phần "dưới" tính ra thừa và ảnh co dần từng vòng đo cho
    // tới khi chạm sàn. Toạ độ so với khối nội dung thì không phụ thuộc việc
    // đang cuộn tới đâu, cũng không bị kẹp.
    const measure = () => {
      const port = resolvePort();
      if (!port) return;
      const content = port.firstElementChild;
      if (!(content instanceof HTMLElement)) return;
      const contentRect = content.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const above = elRect.top - contentRect.top;
      const below = contentRect.bottom - elRect.bottom;
      // `clientHeight` đã tính cả padding của vùng cuộn, mà `above`/`below` đo
      // từ mép KHỐI NỘI DUNG (nằm trong padding) — không trừ ra thì thừa đúng
      // bằng padding và nội dung nhỉnh hơn màn vài pixel.
      const portStyle = getComputedStyle(port);
      const portPadding =
        parseFloat(portStyle.paddingTop) + parseFloat(portStyle.paddingBottom);
      const next = Math.max(
        minPx,
        Math.round(port.clientHeight - portPadding - above - below),
      );
      lastMeasuredRef.current = next;
      const portHeight = Math.round(port.clientHeight - portPadding);
      const belowPx = Math.round(below);
      setSpace((prev) =>
        prev !== null &&
          Math.abs(prev.available - next) < 2 &&
          prev.port === portHeight &&
          Math.abs(prev.below - belowPx) < 2
          ? prev
          : { available: next, port: portHeight, below: belowPx },
      );
    };
    // ĐO LẠI THEO KHUNG HÌNH cho tới khi ổn định: lần đo đầu rơi vào lúc bố
    // cục CHƯA settle (ảnh còn cỡ cũ, phông chữ/ảnh chưa tải xong) nên ra số
    // sai; đặt cỡ theo số đó rồi bố cục đổi, phải đo lại. Dừng khi hai lần
    // liên tiếp lệch dưới 2px hoặc quá 6 vòng — KHÔNG dựa vào ResizeObserver
    // để tự sửa, vì có môi trường không phát sự kiện đó.
    let frame = 0;
    let settleTimer: number | null = null;
    const settle = () => {
      const before = lastMeasuredRef.current;
      measure();
      const after = lastMeasuredRef.current;
      frame += 1;
      if (frame < 6 && (before === null || Math.abs((after ?? 0) - (before ?? 0)) >= 2)) {
        settleTimer = requestAnimationFrame(settle);
      }
    };
    settle();
    // Đo LẠI muộn hơn, ngoài vòng khung hình. Vòng trên dừng khi hai lần đo
    // liền nhau BẰNG NHAU — mà "bằng nhau" không có nghĩa là "đã đúng": lúc mới
    // vào câu, phần dưới ảnh (đề con, ô nhập, thanh nút) có thể còn đang dựng
    // và cho ra một giá trị TẠM ỔN ĐỊNH qua vài khung hình. Đo trên ca thật
    // `67287717/bai8` câu 1: vào lần đầu chốt trần 410px trong khi chỗ trống
    // thật chỉ 183px, còn lần quay lại (bố cục đã xong sẵn) lại chốt khác —
    // cùng một câu, hai cỡ ảnh (Owner 10/8).
    //
    // Hai mốc 150ms/450ms đủ phủ nhịp dựng của runner mà không thành vòng lặp:
    // `measure` chỉ setState khi lệch ≥2px nên đo thừa là vô hại.
    // Mốc 900ms phủ nốt animation mở khung của runner (pop-in + h-[100svh]):
    // hai mốc cũ vẫn rơi vào lúc khung đang giãn ở ca 43556966/bai6.
    const lateTimers = [150, 450, 900].map((ms) => window.setTimeout(measure, ms));
    const observer = new ResizeObserver(measure);
    // Quan sát MỌI vùng cuộn tổ tiên, không chỉ cái đang được chọn: khung đúng
    // có thể là node khác ở vòng đo sau (xem resolvePort).
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") observer.observe(node);
    }
    observer.observe(el);
    // Cũng theo dõi KHỐI NỘI DUNG bọc ngoài: đề bài dài thêm một dòng chỉ ĐẨY
    // vị trí khối chứ không đổi kích thước nó, nên nếu chỉ quan sát `el` thì
    // không có sự kiện nào để đo lại (Owner 8/8).
    if (el.parentElement) observer.observe(el.parentElement);
    const content = port.firstElementChild;
    if (content instanceof HTMLElement) observer.observe(content);
    window.addEventListener("resize", measure);
    return () => {
      if (settleTimer !== null) cancelAnimationFrame(settleTimer);
      for (const id of lateTimers) window.clearTimeout(id);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, minPx]);
  return {
    available: space?.available ?? null,
    port: space?.port ?? null,
    below: space?.below ?? null,
  };
}

export function useInstantGrading({
  elementIds,
  expectedIds,
  expectedCount,
  instantFeedback,
  recordOnly,
  buildAnswer,
  report,
  onElementGraded,
  onProgress,
}: {
  /** Stable array of gradable element ids — pass a memoized/stable reference. */
  elementIds: string[];
  /**
   * Câu CHỌN MỘT TẬP (đánh dấu vài phương án đúng trong nhiều phương án): danh
   * sách id ĐÚNG. Có nó thì "làm xong" được tính bằng SO KHỚP TẬP thay vì đếm
   * số phần tử đã chấm.
   *
   * Vì sao cần (Owner 9/8, ca `67251341/bai20` câu 4 — chọn các tờ 1 000 đồng):
   * với câu chọn nhiều, **KHÔNG bấm vào phương án sai cũng là một câu trả lời**.
   * Mặc định `done = (số phần tử đã chấm === tổng)`, mà chỉ phần tử ĐƯỢC BẤM mới
   * sinh verdict — học sinh tick đúng 3/9 thẻ là đã xong bài nhưng mới chấm 3,
   * nên `done` mãi false và câu không bao giờ đạt `success`. Tệ hơn: bấm cả 9 cho
   * đủ thì `correct(3) !== total(9)` → hoá ra SAI. Tức `success` là bất khả thi
   * với mọi câu chọn-nhiều có ít nhất một phương án sai.
   *
   * Khi khai `expectedIds`, luật thành: đúng hết ⇔ đã tick đủ tập đúng và không
   * tick phần tử nào sai. Chưa đạt thì báo `incomplete` (không phải `incorrect`)
   * — phản hồi sai/đúng từng thẻ đã hiện ngay tại chỗ rồi.
   */
  expectedIds?: string[];
  /**
   * Câu ĐẾM SỐ LƯỢNG (hotspot `correctAnswer: {count}` — "Tô màu 2 bông hoa"):
   * đúng ⇔ đã chọn ĐỦ `expectedCount` phần tử, bất kể phần tử nào. Bị bỏ qua
   * khi `expectedIds` đã kích hoạt chế độ tập.
   */
  expectedCount?: number;
  instantFeedback: boolean;
  recordOnly: boolean;
  buildAnswer: () => unknown;
  report: (answer: unknown, verdict: Verdict) => void;
  onElementGraded?: (id: string, verdict: ElementVerdict, meta?: unknown) => void;
  onProgress?: (progress: InstantProgress) => void;
}) {
  const active = instantFeedback && !recordOnly;
  // Chấm kín: parent mode không được lộ verdict per-element khi đang làm.
  const { mode } = useGradeMode();
  const sealedReveal = mode === "parent";
  const [graded, setGraded] = useState<Map<string, ElementVerdict>>(() => new Map());
  // Latest map, so grade/clear can compute the next state and fire side effects
  // OUTSIDE the setGraded updater (updaters must stay pure — StrictMode double-
  // invokes them in dev, which would double-fire sounds/onComplete).
  const gradedRef = useRef(graded);
  gradedRef.current = graded;

  const emit = useCallback(
    (next: Map<string, ElementVerdict>) => {
      const total = elementIds.length;
      let correct = 0;
      for (const id of elementIds) if (next.get(id) === "correct") correct += 1;
      let answered = 0;
      for (const id of elementIds) if (next.has(id)) answered += 1;
      const wrong = answered - correct;
      // Câu chọn-một-tập: xem ghi chú ở `expectedIds`. "Xong" là TẬP ĐÃ TICK
      // KHỚP TẬP ĐÚNG, chứ không phải "đã bấm qua hết mọi phương án" — không
      // bấm vào phương án sai cũng là một câu trả lời.
      const setMode = Array.isArray(expectedIds) && expectedIds.length > 0;
      // Chế độ đếm: xem ghi chú ở `expectedCount` — "xong" là chọn ĐỦ SỐ LƯỢNG.
      const countMode = !setMode && expectedCount != null && expectedCount > 0;
      const builtAnswer = buildAnswer();
      // Đếm trên ĐÁP ÁN THẬT, không phải graded map: đáp án khôi phục từ phiên
      // trước không nằm trong map (vòng khôi phục cố ý không chấm lại), đếm số
      // lần chấm sẽ vừa kẹt "không bao giờ xong" vừa cho false-positive khi
      // tổng chọn đã lệch count (map khớp nhưng selected thì không).
      const selectedCount = countMode && Array.isArray(builtAnswer) ? builtAnswer.length : correct;
      // Hai khái niệm KHÁC NHAU, đừng gộp:
      //  - `done`  = đã trả lời xong (chế độ thường: chấm hết phần tử; chế độ
      //              tập: tập đã tick khớp tập đúng);
      //  - `allCorrect` = đúng hết.
      // Gộp hai cái này là chế độ thường báo "đúng" cho cả bài chấm hết mà sai.
      const done = setMode
        ? wrong === 0 && correct === expectedIds!.length
        : countMode
          ? wrong === 0 && selectedCount === expectedCount
          : answered === total && total > 0;
      const allCorrect = setMode || countMode ? done : done && correct === total;
      onProgress?.({
        correct: countMode ? Math.min(selectedCount, expectedCount) : correct,
        wrong,
        total: setMode ? expectedIds!.length : countMode ? expectedCount : total,
        done,
      });
      // LUÔN đồng bộ đáp án hiện tại lên cha (onAnswerChange qua report). Trước đây
      // chỉ emit khi `done` (đã chấm HẾT phần tử) → câu chọn-một-phần (vd "đánh dấu X
      // vào vài ảnh" có đáp án đúng) không bao giờ đẩy đáp án lên: cha chấm nhầm và
      // quay lại/tiếp tục bài mất đáp án. Verdict/âm thanh vẫn CHỈ khi `done`; lúc dở
      // báo "incomplete" (chế độ parent bỏ qua verdict, chỉ nhận đáp án).
      report(
        builtAnswer,
        // Chế độ tập: chưa khớp thì là ĐANG LÀM DỞ, không phải sai — thẻ tick
        // nhầm đã tự đỏ tại chỗ, kết luận "sai cả câu" lúc học sinh còn đang
        // chọn là báo động giả. Chế độ thường giữ nguyên: chấm hết mà có phần
        // tử sai thì cả câu sai.
        allCorrect ? "correct" : done ? "incorrect" : "incomplete",
      );
    },
    [elementIds, expectedIds, expectedCount, buildAnswer, report, onProgress],
  );

  const grade = useCallback(
    (id: string, verdict: ElementVerdict, meta?: unknown) => {
      if (!active) return;
      const next = new Map(gradedRef.current);
      next.set(id, verdict);
      gradedRef.current = next;
      setGraded(next);
      // Chấm kín: verdict per-element không được rời player qua BẤT KỲ kênh nào.
      // Host cắm mascot vào đây để khen/nhắc ngay từng thao tác — đúng thứ chế
      // độ chấm kín phải tắt. (web-delta, đã upstream: studio PR #1131)
      if (!sealedReveal) onElementGraded?.(id, verdict, meta);
      emit(next);
    },
    [active, sealedReveal, emit, onElementGraded],
  );

  const clear = useCallback(
    (id: string) => {
      if (!active) return;
      if (gradedRef.current.has(id)) {
        const next = new Map(gradedRef.current);
        next.delete(id);
        gradedRef.current = next;
        setGraded(next);
        emit(next);
        return;
      }
      // Bỏ chọn đáp án khôi phục (graded map rỗng) vẫn phải emit, nếu không cha
      // giữ đáp án cũ rồi hydrate lại → "không bỏ được". Caller cập nhật picked trước.
      emit(gradedRef.current);
    },
    [active, emit],
  );

  const reveal = useCallback(
    (id: string): ElementVerdict | undefined =>
      active && !sealedReveal ? graded.get(id) : undefined,
    [active, sealedReveal, graded],
  );

  return { grade, clear, reveal, graded, active };
}
