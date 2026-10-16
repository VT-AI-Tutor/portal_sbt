/**
 * Manifest-driven dispatch for every registered interaction player.
 *
 * `renderInteractionPlayer(type, payload, handlers)` resolves the right player
 * via the manifest (schema `type` + `display.interactionType`, with legacy
 * matching `layout` fallback), adapts the raw question payload into that
 * player's exact prop shape, and returns the JSX element. Resolution failures
 * render the same explicit diagnostic at top level and inside wrappers.
 *
 * The payload field conventions mirror QuestionPlayer.tsx (options[{id,content}],
 * correctAnswer/correctAnswers, leftItems/rightItems/correctPairs, …) plus the
 * new fields documented in the players' payload contract.
 */
import React from "react";
import type { AnswerElementMedia, BlankInputSpec, RichContent, RichTextRun, WordBankEntry } from "@/core/question-schema";
import { blankMedia, mergeGroupSharedContent, normalizeBlankInputSpec, normalizeWordBank } from "@/core/question-schema";
import { MEDIA_URL_KEYS } from "@/core/question-schema/media-keys";
import { hotspotAnswerCount } from "@/core/question-schema/hotspot";
import { itemImageWidth } from "@/core/question-schema/item-image-width";
import { positionalOptionLetter } from "@/core/question-schema/option-label";
import { plainTextFromRichContent, plainTextFromRuns } from "@/core/rich-text/html";
import { flattenNestedContentBlocks } from "@/core/rich-text/nested-blocks";
import {
  BLANK_MARKER_RE,
  BLANK_MARKER_GLOBAL_RE,
  BLANK_MARKER_TOKEN_RE,
  blankIdFromMarker,
  splitRichRunsAroundBlankMarkers,
  type RichClozeText,
} from "./blank-markers";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import { resolveDisplay, type DisplayResolution } from "./manifest";
import { AccentProvider } from "../skin/accent-context";
import { PLAYER_ACCENT_OF } from "../skin/accents";
import { resolveMatchingPayload } from "@/core/question-schema/matching";
import { resolveColoringConfig } from "@/core/question-schema/coloring";
import { resolveCrosswordConfig } from "@/core/question-schema/crossword";
import { resolveTableModel } from "@/core/question-schema/table-model";
import { resolveNestedQuestions } from "@/core/question-schema/nested-children";
// web-own: `blockRendersAsStem` ở chung nhà với RichContentBlocks (shared.tsx) —
// cắt header cloze và thăng cấp đề bài phải đi chung MỘT vị từ.
import { GradeModeContext, blockRendersAsStem, contentIsPictureLed, type ContentBlock, type GradeMode, type TaskStatus, type Verdict } from "./shared";

import { SingleChoicePlayer } from "./SingleChoicePlayer";
import { MultiChoicePlayer } from "./MultiChoicePlayer";
import { TrueFalsePlayer } from "./TrueFalsePlayer";
import { YesNoPlayer } from "./YesNoPlayer";
import { ImageChoiceSinglePlayer } from "./ImageChoiceSinglePlayer";
import { ImageChoiceMultiPlayer } from "./ImageChoiceMultiPlayer";
import { TileSelectPlayer } from "./TileSelectPlayer";
import { DropdownSelectPlayer } from "./DropdownSelectPlayer";
import { HotspotSinglePlayer } from "./HotspotSinglePlayer";
import { HotspotMultiPlayer } from "./HotspotMultiPlayer";
import { hotspotMarkKind } from "./hotspot-check-mark";
import { PlacePinPlayer } from "./PlacePinPlayer";
import { ImageColorClassifyPlayer } from "./ImageColorClassifyPlayer";
import { FillBlankPlayer, type FillSegment } from "./FillBlankPlayer";
import { ClozePlayer, type ClozeLine, type ClozeSegment } from "./ClozePlayer";
import { NumericEntryPlayer } from "./NumericEntryPlayer";
import { ShortAnswerPlayer } from "./ShortAnswerPlayer";
import { EssayPlayer, type EssayImagePrompt } from "./EssayPlayer";
import { FormulaEntryPlayer } from "./FormulaEntryPlayer";
import { MathClozePlayer } from "./MathClozePlayer";
import { mathClozeFormulas, stripMathClozeBlocks, type MathClozeBlank } from "./math-cloze";
import { ReorderListPlayer } from "./ReorderListPlayer";
import { RankPlayer } from "./RankPlayer";
import { ProcessSequencePlayer } from "./ProcessSequencePlayer";
import { TimelinePlayer } from "./TimelinePlayer";
import { TwoColumnMatchPlayer } from "./TwoColumnMatchPlayer";
import { ConnectLinesPlayer } from "./ConnectLinesPlayer";
import { GeometryGridPlayer, type GeometryGridPlayerProps } from "./GeometryGridPlayer";
import { ChartBuildPlayer, type ChartBuildPlayerProps } from "./ChartBuildPlayer";
import { MatchRowsPlayer } from "./MatchRowsPlayer";
import { MatchRadialPlayer } from "./MatchRadialPlayer";
import { ChainMatchPlayer } from "./ChainMatchPlayer";
import { CategorizePlayer } from "./CategorizePlayer";
import { WordBankPlayer } from "./WordBankPlayer";
import { DragToZonesPlayer } from "./DragToZonesPlayer";
import { LabelDiagramPlayer } from "./LabelDiagramPlayer";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";
import { DragToGridPlayer } from "./DragToGridPlayer";
import { LikertPlayer } from "./LikertPlayer";
import { NumericSliderPlayer } from "./NumericSliderPlayer";
import { StarRatingPlayer } from "./StarRatingPlayer";
import { ConfidenceSliderPlayer } from "./ConfidenceSliderPlayer";
import { SemanticDifferentialPlayer } from "./SemanticDifferentialPlayer";
import { HighlightTextPlayer, type HighlightTextPlayerProps } from "./HighlightTextPlayer";
import { SelectWordsPlayer, type SelectWordsPlayerProps } from "./SelectWordsPlayer";
import { FreeDrawPlayer, type FreeDrawTextField } from "./FreeDrawPlayer";
import { VideoAnchoredPlayer } from "./VideoAnchoredPlayer";
import { AudioAnchoredPlayer } from "./AudioAnchoredPlayer";
import { SpeakingPlayer } from "./SpeakingPlayer";
import { DictationPlayer } from "./DictationPlayer";
import { ColoringPlayer } from "./ColoringPlayer";
import { MindMapPlayer } from "./MindMapPlayer";
import { CheckboxTablePlayer } from "./CheckboxTablePlayer";
import { TableFillPlayer } from "./TableFillPlayer";
import { TrueFalseTablePlayer } from "./TrueFalseTablePlayer";
import { DiagramFillPlayer } from "./DiagramFillPlayer";
// web-own: chưa upstream lên studio — xem WEB-OWN PATCHES trong apps/learner/scripts/detokenize-players.mjs
import { isAnswerImageDownloadable } from "./diagram-fill-download";
import { PathConnectPlayer } from "./PathConnectPlayer";
import { MemoryMatchPlayer } from "./MemoryMatchPlayer";
import { PikachuPlayer } from "./PikachuPlayer";
import { CardSortPlayer } from "./CardSortPlayer";
import { JigsawPlayer } from "./JigsawPlayer";
import { WordSearchPlayer } from "./WordSearchPlayer";
import { CrosswordPlayer } from "./CrosswordPlayer";
import { HangmanPlayer } from "./HangmanPlayer";
import { SpotDifferencePlayer } from "./SpotDifferencePlayer";
import { QuestionGroupPlayer } from "./QuestionGroupPlayer";
import { TimedQuizPlayer } from "./TimedQuizPlayer";
import { LivesStreakPlayer } from "./LivesStreakPlayer";
import { BoardGamePlayer } from "./BoardGamePlayer";
import { PathTrailPlayer } from "./PathTrailPlayer";
import {
  MatchingScenePlayer,
  type MatchingSceneBackground,
  type MatchingSceneEdge,
  type MatchingSceneNode,
} from "./MatchingScenePlayer";
import { RendererCapabilityDiagnostic } from "./RendererCapabilityDiagnostic";
import { ConnectPointsTask } from "../tasks/ConnectPointsTask";
import { MindMapTask } from "../tasks/MindMapTask";
import { UploadTask } from "../tasks/UploadTask";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = Record<string, any>;

// ---------------------------------------------------------------------------
// correctAnswer adapters — the data model is moving to a SINGLE `correctAnswer`
// field whose shape is decided by the question type. These coerce that one
// field into whatever prop shape each player expects. No legacy fallbacks.
// ---------------------------------------------------------------------------
const caStr = (p: Payload) => (p.correctAnswer == null ? "" : String(p.correctAnswer));
const caArr = (p: Payload): string[] => (Array.isArray(p.correctAnswer) ? p.correctAnswer.map(String) : []);
const caNum = (p: Payload): number | undefined => (p.correctAnswer == null ? undefined : Number(p.correctAnswer));
const caList = (p: Payload): string[] => (p.correctAnswer == null ? [] : Array.isArray(p.correctAnswer) ? p.correctAnswer.map(String) : [String(p.correctAnswer)]);
// Coerce Record OR array-of-pairs into Record<string,string>.
function caRecord(p: Payload, keyA?: string, keyB?: string): Record<string, string> {
  const v = p.correctAnswer;
  const out: Record<string, string> = {};
  if (Array.isArray(v)) {
    for (const candidate of v as unknown[]) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
      const pair = candidate as Record<string, unknown>;
      const key = keyA ? pair[keyA] : undefined;
      const value = keyB ? pair[keyB] : undefined;
      if (key != null) out[String(key)] = String(value ?? "");
    }
  } else if (v && typeof v === "object") {
    for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
      out[key] = String(value ?? "");
    }
  }
  return out;
}
/** Canonical matching edges. Arrays preserve 1-to-many; legacy Records stay readable. */
function matchingEdges(value: unknown): MatchingSceneEdge[] {
  const edges: MatchingSceneEdge[] = [];
  const seen = new Set<string>();
  const append = (item: unknown, target: unknown) => {
    if (item == null || target == null) return;
    const edge = { item: String(item), target: String(target) };
    if (!edge.item || !edge.target) return;
    const key = JSON.stringify([edge.item, edge.target]);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(edge);
  };

  if (Array.isArray(value)) {
    for (const candidate of value) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
      const edge = candidate as Record<string, unknown>;
      append(edge.item ?? edge.left ?? edge.from, edge.target ?? edge.right ?? edge.to);
    }
  } else if (value && typeof value === "object") {
    for (const [item, rawTarget] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(rawTarget)) rawTarget.forEach((target) => append(item, target));
      else append(item, rawTarget);
    }
  }
  return edges;
}

export type PlayerResult = "correct" | "incorrect" | "incomplete";

export interface PlayerHandlers {
  /** Stable identity used to reset player-local state when the question changes. */
  questionId?: string;
  /** Parent-owned answer used to hydrate/remount an interaction. */
  answer?: unknown;
  onAnswerChange?: (a: unknown) => void;
  onComplete?: () => void;
  onStatusChange?: (s: TaskStatus) => void;
  submitted?: boolean;
  compact?: boolean;
  /**
   * "self" (default): player self-grades. "parent": player emits only; the
   * parent (client gradeByType OR the server) decides the verdict and feeds it
   * back via `result`.
   */
  gradeMode?: GradeMode;
  /** Parent-supplied verdict shown in "parent" mode. */
  result?: PlayerResult | Record<string, PlayerResult> | { results: Record<string, PlayerResult> };
  /** Host renders its own verdict UI — suppress the shell ResultBanner. (web-delta) */
  hideResultBanner?: boolean;
  /** Kênh verdict CÂM của chế độ chấm kín — xem GradeModeValue. (web-delta) */
  onSilentVerdict?: (verdict: Verdict) => void;
  /**
   * false → wrong submission never highlights unpicked correct options
   * (learner surfaces, web BUG-03). Default true = reveal after submit.
   */
  revealCorrect?: boolean;
  /** Read-only mode without implying that grading/submission has happened. */
  disabled?: boolean;
  /** QA location used by diagnostics emitted from recursive dispatch. */
  path?: string;
  scope?: "top-level" | "nested";
  /**
   * Grade each element the moment it is committed and reveal per-element
   * correctness inline. Default true when forwarded to players — see
   * `PlayerProps.instantFeedback` in shared.tsx.
   */
  instantFeedback?: boolean;
  /** Fired each time one element is graded in instant mode. */
  onElementGraded?: (elementId: string, verdict: "correct" | "incorrect", meta?: unknown) => void;
  /** Fired when instant-mode progress changes. */
  onProgress?: (progress: { correct: number; wrong: number; total: number; done: boolean }) => void;
  /**
   * web-own: upload file bài làm lên server cho câu upload_answer — host
   * (SubmissionRunner) bơm xuống; answer khi đó là {files:[{fileUrl,fileId,…}]}
   * đúng wire format PUT answer / POST submit của LCMS. Chưa upstream studio.
   */
  onUploadFile?: (file: File) => Promise<{ fileId: string; fileUrl: string }>;
}

interface Item {
  id: string;
  content?: RichContent;
  text?: string;
  /** Some editors (e.g. DragDropEditor) write plain text here instead of `text`. */
  label?: string;
  /**
   * Màu nhóm tác giả khai (`categories[].color`, spec §5.12) — CSS color string.
   * Chỉ classification đọc; xem `authoredGroupColor`.
   */
  color?: string;
}

// ---------------------------------------------------------------------------
// Helpers (copied from QuestionPlayer.tsx conventions)
// ---------------------------------------------------------------------------

/** Extract plain text from RichContent blocks. */
function richToText(content: RichContent | undefined): string {
  return plainTextFromRichContent(content);
}

/**
 * Extract plain text from an Item's content (rich), then `text`, then `label`.
 * Không khai tên thì gọi theo vị trí ("Nhóm 2"), phần tử chỉ có ảnh thì "Ảnh 2"
 * — id là định danh máy, không phải chữ hiển thị. Mặt bài và khối "Đáp án đúng"
 * cùng đọc tên này nên luôn khớp.
 */
function itemText(item: Item, index: number, noun: string): string {
  const authored = richToText(item.content) || item.text || item.label;
  if (authored) return authored;
  return `${contentImageUrl(item) ? "Ảnh" : noun} ${index + 1}`;
}

/** Authored title from payload.content (first non-empty line). */
function payloadTitle(p: Payload): string {
  return richToText(p.content as RichContent | undefined).split("\n")[0] || "";
}

/** Full instruction text — everything after the first line of content. */
function payloadInstruction(p: Payload): string | undefined {
  if (typeof p.instruction === "string") return p.instruction;
  const lines = richToText(p.content as RichContent | undefined).split("\n");
  return lines.length > 1 ? lines.slice(1).join("\n") : undefined;
}

/** The image block an item's picture comes from — `content.blocks` only, since
 * the flat `imageUrl` / `image.url` aliases carry a URL and nothing else. */
function contentImageBlock(item: Item): { url?: string; width?: string } | undefined {
  // Gỡ khối lồng nhầm trước khi tìm: ảnh của ô bảng có thể đang nằm bên trong
  // `content` của một đoạn văn thay vì ở tầng `blocks` (xem `nested-blocks.ts`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (flattenNestedContentBlocks(item.content?.blocks) as any[]).find((b) => b.type === "image");
}

/** Extract image URL from an item's content blocks (fallback). */
function contentImageUrl(item: Item & { imageUrl?: string; image?: { url?: string } }): string | undefined {
  if (item.imageUrl) return item.imageUrl;
  if (item.image?.url) return item.image.url;
  return contentImageBlock(item)?.url;
}

/**
 * Authored `width` of the image block an item's picture came from (issue #783).
 * Item pictures render at natural size by default, so a large source used as a
 * small inline icon takes the whole column and squeezes the label to one
 * character per line; `width` is how the author says "this one is an icon".
 * Only defined when the picture actually IS that block — a flat `imageUrl` /
 * `image.url` alias wins the URL and carries no width of its own.
 */
function contentImageWidth(item: Item & { imageUrl?: string; image?: { url?: string } }): string | undefined {
  if (item.imageUrl || item.image?.url) return undefined;
  return itemImageWidth(contentImageBlock(item)?.width);
}

/**
 * `id` dùng được của phương án, hoặc chữ cái theo vị trí.
 *
 * "Không có" gồm cả CHUỖI RỖNG, không chỉ null/undefined: `payload` là dữ liệu
 * tác giả nhập và có đường nhập đặt `""` khi nguồn thiếu định danh (QTI không
 * khai `identifier`). `??` bỏ lọt `""`, mà `""` hỏng nặng hơn `undefined`: mọi
 * phương án cùng mang `key=""` nên React coi là một, và `select("")` không khớp
 * `correctAnswer` nào — bấm gì cũng sai.
 *
 * Chữ cái theo vị trí giữ đúng luật của option-label.ts: thứ học sinh THẤY và
 * thứ được CHẤM là một chuỗi.
 */
function optionIdAt(id: unknown, index: number): string {
  return typeof id === "string" && id.trim() !== "" ? id : positionalOptionLetter(index);
}

/** Map options[{id,content|text,imageUrl|image}] → {id,text,imageUrl}.
 * `id` carries the letter printed in the book (issue #660) — players resolve it
 * through optionDisplayLabel, so it must reach them unchanged.
 *
 * Phương án KHÔNG CÓ `id` dùng được rơi về CHÍNH chữ cái theo vị trí mà
 * optionDisplayLabel sẽ in ra (A, B, C…) — xem {@link optionIdAt}. */
function adaptOptions(
  p: Payload,
): { id: string; text?: string; imageUrl?: string; imageWidth?: string; content?: RichContent }[] {
  const options = (p.options as Array<Item & { imageUrl?: string; image?: { url?: string } }>) ?? [];
  return options.map((o, i) => ({
    id: optionIdAt(o.id, i),
    text: richToText(o.content) || o.text,
    imageUrl: contentImageUrl(o),
    imageWidth: contentImageWidth(o),
    content: o.content,
  }));
}

/** options for image-choice players. `imageUrl` stays UNDEFINED when the option
 * has no picture — the players render a fail-loud "chưa có ảnh" placeholder.
 * Never coerce to `""`: `<img src="">` makes React log an error per option and
 * the browser re-request the page (issue #953). */
function adaptImageOptions(
  p: Payload,
): { id: string; imageUrl?: string; text?: string }[] {
  const options = (p.options as Array<Item & { imageUrl?: string; image?: { url?: string } }>) ?? [];
  return options.map((o, i) => ({
    id: optionIdAt(o.id, i),
    imageUrl: contentImageUrl(o),
    text: richToText(o.content) || o.text,
  }));
}

/** Map items[{id,content|text}] → {id,text,imageUrl?,content?}. Falls back to the id
 * as text only when there's neither text nor an image to show. `content` is carried
 * through so players can preserve rich-text alignment/formatting (plain `text` stays
 * populated as the legacy fallback and for answer-reveal/alt strings). */
function textItems(
  arr: Item[] | undefined,
  noun: string,
): { id: string; text: string; imageUrl?: string; imageWidth?: string; content?: RichContent }[] {
  return (arr ?? []).map((i, index) => {
    const imageUrl = contentImageUrl(i);
    // Thẻ chỉ có ảnh để chữ trống; không có cả chữ lẫn ảnh thì gọi theo vị trí.
    const text = richToText(i.content) || i.text || i.label || (imageUrl ? "" : `${noun} ${index + 1}`);
    return { id: i.id, text, imageUrl, imageWidth: contentImageWidth(i), content: i.content };
  });
}

/**
 * Matching has two schema generations in the wild. Prefer populated
 * canonical fields, then fall back to their legacy aliases. An empty
 * canonical array is treated as absent so older exports with both fields do
 * not render blank columns.
 */
function matchingItems(p: Payload, side: "left" | "right"): Item[] {
  const canonical = side === "left" ? p.leftItems : p.rightItems;
  const legacy = side === "left" ? p.items : p.targets;
  if (Array.isArray(canonical) && canonical.length > 0) return canonical as Item[];
  if (Array.isArray(legacy)) return legacy as Item[];
  return Array.isArray(canonical) ? (canonical as Item[]) : [];
}

/** True when any block (recursing layout columns) carries a `{blank_*}` marker. */
function contentHasBlankMarker(content: RichContent | undefined): boolean {
  return !!content?.blocks?.some(blockHasBlankMarker);
}

function blockHasBlankMarker(block: RichContent["blocks"][number]): boolean {
  if (block.type === "layout" && Array.isArray(block.columns)) {
    return block.columns.some((column) => column.some(blockHasBlankMarker));
  }
  const text = Array.isArray(block.content)
    ? plainTextFromRuns(block.content)
    : block.text ?? "";
  return BLANK_MARKER_RE.test(text);
}

/**
 * Split cloze content for the header. The header reaches the FIRST stem line and
 * stops there; every block after it stays in the body, even when it holds no
 * marker yet — a passage whose opening line has no blank (`b17_i3_q3`) would
 * otherwise be promoted to heading size and cut off from its own dialogue by the
 * accent bar. A leading spacer paragraph or image must not swallow that slot, so
 * the cut is the first stem line, not `blocks[0]`; with no stem line at all there
 * is nothing to promote and every pre-blank block stays in the header as before.
 * Layouts are inspected recursively but never split internally.
 */
export function splitClozeContentAtFirstBlank(
  content: RichContent | undefined,
): {
  headerContent?: RichContent;
  interactionContent?: RichContent;
} {
  if (!content?.blocks?.length) return {};
  const firstInteractive = content.blocks.findIndex(blockHasBlankMarker);
  if (firstInteractive < 0) return {};
  const firstStem = content.blocks.findIndex(blockRendersAsStem);
  const headerEnd =
    firstStem >= 0 && firstStem < firstInteractive ? firstStem + 1 : firstInteractive;
  const headerBlocks = content.blocks.slice(0, headerEnd);
  return {
    ...(headerBlocks.length > 0
      ? { headerContent: { ...content, blocks: headerBlocks } }
      : {}),
    interactionContent: {
      ...content,
      blocks: content.blocks.slice(headerBlocks.length),
    },
  };
}

/** Blank ids in document order (recursing layout columns) — the grading key order. */
function orderedBlankIds(content: RichContent | undefined): string[] {
  const ids: string[] = [];
  const walk = (blocks: RichContent["blocks"]): void => {
    for (const b of blocks) {
      if (b.type === "layout" && Array.isArray(b.columns)) {
        b.columns.forEach(walk);
        continue;
      }
      const text = Array.isArray(b.content) ? plainTextFromRuns(b.content) : b.text ?? "";
      const re = new RegExp(BLANK_MARKER_GLOBAL_RE.source, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const id = blankIdFromMarker(m[0]);
        if (id) ids.push(id);
      }
    }
  };
  if (content?.blocks?.length) walk(content.blocks);
  return ids;
}

/**
 * web-own: nhãn ô trống theo blankId cho khối "Đáp án đúng" của word_bank.
 * `parseCloze` không chạy ở đường in-place nên map này dựng thẳng từ
 * `blanks[]`. Giữ cả chuỗi rỗng — xem players/blank-label.ts.
 */
function blankLabelsById(p: Payload): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const b of (p.blanks as Array<{ id?: unknown; label?: unknown }> | undefined) ?? []) {
    if (!b || typeof b !== "object" || b.id == null) continue;
    if (typeof b.label === "string") out[String(b.id)] = b.label;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Strip paragraphs containing a blank marker from a content block list — those
 * render as the interactive fill-in in the player body, so showing them again
 * raw (with the literal `{blank_1}` syntax) in the header would duplicate them. */
function stripBlankMarkerBlocks(content: RichContent | undefined): RichContent | undefined {
  if (!content?.blocks?.length) return content;
  const strip = (blocks: RichContent["blocks"]): RichContent["blocks"] => blocks.flatMap((block) => {
    if (block.type === "layout" && Array.isArray(block.columns)) {
      const columns = block.columns.map(strip).filter((column) => column.length > 0);
      return columns.length > 0 ? [{ ...block, columns }] : [];
    }
    const text = Array.isArray(block.content) ? plainTextFromRuns(block.content) : block.text ?? "";
    return block.type !== "layout" && BLANK_MARKER_RE.test(text) ? [] : [block];
  });
  return { ...content, blocks: strip(content.blocks) };
}

function clozeBlocks(blocks: RichContent["blocks"]): RichContent["blocks"] {
  return blocks.flatMap((block) => {
    if (block.type === "layout" && Array.isArray(block.columns)) {
      return block.columns.flatMap(clozeBlocks);
    }
    const text = Array.isArray(block.content) ? plainTextFromRuns(block.content) : block.text ?? "";
    return BLANK_MARKER_RE.test(text) ? [block] : [];
  });
}

/**
 * Safe width presets for `blanks[].input.size` (#444) — arbitrary CSS never
 * flows in from the payload; only these four values (or the separately
 * validated `width` string) reach the style attribute.
 */
const SIZE_WIDTH: Record<NonNullable<BlankInputSpec["size"]>, string> = {
  short: "4rem",
  medium: "7rem",
  long: "14rem",
  full: "100%",
};

/** Map an `input.size` preset to its CSS width; undefined for absent/unknown sizes. */
export function sizeToWidth(size: BlankInputSpec["size"] | undefined): string | undefined {
  return size ? SIZE_WIDTH[size] : undefined;
}

/**
 * Parse fill_blank / cloze content markers into segments.
 * Markers: `{blank_1}` or `___[blank_1]___`. Accepted answers come solely from
 * `correctAnswer` keyed by blankId (`{ blank_1: "…" | ["…"] }`).
 * Returns one flat list of segments AND the per-paragraph cloze lines.
 */
/**
 * `blanks[].options` (II.7) — danh sách lựa chọn cho một ô điền. Trả về undefined
 * khi không rút được lựa chọn dùng được nào, tức ô đó về lại ô nhập tự do thay vì
 * render dropdown rỗng.
 *
 * Dạng chuẩn là mảng CHUỖI (`["ai","ay","ây"]`). Phần tử dạng OBJECT — tác giả
 * nhập theo thói quen của phương án trắc nghiệm, `{text}` hoặc `{content:{blocks}}`
 * — trước đây bị lọc sạch, và ô im lặng tụt về gõ tay dù câu có khai lựa chọn.
 * Nay rút CHỮ hiển thị của nó ra.
 *
 * Rút CHỮ chứ không lấy `id`: đáp án của ô nằm ở `correctAnswer[blankId]` dưới
 * dạng chữ học sinh gõ/chọn, nên chữ mới là thứ so được. Lấy `id` sẽ ra dropdown
 * đầy "A/B/C" và không câu nào chấm đúng.
 */
function normalizeBlankOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .map((v) => {
      if (typeof v === "string") return v.trim();
      if (v && typeof v === "object") {
        const o = v as Item;
        return (richToText(o.content) || o.text || o.label || "").trim();
      }
      return "";
    })
    .filter((v) => v !== "");
  return out.length > 0 ? out : undefined;
}

function parseCloze(p: Payload): { segments: FillSegment[]; lines: ClozeLine[] } {
  // acceptedAnswers per blank come from `p.correctAnswer` keyed by blankId:
  // a string → [string]; an array → as-is.
  const caMap = (p.correctAnswer && typeof p.correctAnswer === "object" && !Array.isArray(p.correctAnswer)
    ? (p.correctAnswer as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const acceptedFor = (blankId: string): string[] => {
    const v = caMap[blankId];
    if (v == null) return [];
    return Array.isArray(v) ? v.map(String) : [String(v)];
  };

  // Derive from the shared source instead of re-declaring the pattern: this used to
  // be a hand-copied duplicate, which is exactly how a marker fix lands in
  // blank-markers.ts and silently misses the plain-text cloze path (WEB14).
  const splitRe = new RegExp(BLANK_MARKER_GLOBAL_RE.source, "g");
  const hasMarker = BLANK_MARKER_RE;

  // Per-blank display config (rendering-only hints) from `blanks[]` — the marker
  // loop below only sees blank ids, so index the specs up front. `input` is
  // whitelisted (mode/size enums, rows positive int) exactly like the adapter.
  // `options` cấp PAYLOAD: một danh sách dùng chung cho mọi ô — đã có trong spec
  // §5.6.2 (biến thể `picture`, kiểu "Điền ai, ay hay ây?") nhưng trước đây chưa
  // ai cài, nên câu khai nó vẫn ra ô gõ tay. `blanks[].options` (riêng từng ô,
  // II.7) đè lên nó khi cả hai cùng có.
  const sharedOptions = normalizeBlankOptions(p.options);

  const blankById = new Map<
    string,
    {
      label?: string;
      width?: string;
      input?: BlankInputSpec;
      options?: string[];
      media?: AnswerElementMedia;
    }
  >();
  for (const b of (p.blanks as
    | Array<{ id?: unknown; label?: unknown; width?: unknown; input?: unknown; options?: unknown; media?: unknown; image?: unknown }>
    | undefined) ?? []) {
    if (!b || typeof b !== "object" || b.id == null) continue;
    const input = normalizeBlankInputSpec(b.input);
    const options = normalizeBlankOptions(b.options) ?? sharedOptions;
    // Ảnh đề bài của Ô TRỐNG (§5.6): canonical `media`, alias chuỗi `image`
    // (21 câu Tiếng Việt production) — xem `question-schema/word-bank.ts`.
    const media = blankMedia(b);
    blankById.set(String(b.id), {
      // web-own: chưa upstream lên studio. Nhãn ô trống cho khối "Đáp án đúng"
      // (players/blank-label.ts). Giữ CẢ chuỗi rỗng — "" nghĩa là bỏ hẳn tiền
      // tố, khác hẳn không khai (rơi về "Số N"), nên không lọc truthiness.
      ...(typeof b.label === "string" ? { label: b.label } : {}),
      ...(typeof b.width === "string" && b.width ? { width: b.width } : {}),
      ...(input ? { input } : {}),
      ...(options ? { options } : {}),
      ...(media ? { media } : {}),
    });
  }

  // Only paragraphs that actually contain a blank marker become the fill body.
  // Plain instruction paragraphs (e.g. "Điền vào chỗ trống:") are kept out so
  // they don't get duplicated below the header.
  const blocks = clozeBlocks((p.content as RichContent | undefined)?.blocks ?? []).filter((b) => {
    const text = Array.isArray(b.content) ? plainTextFromRuns(b.content) : b.text ?? "";
    return hasMarker.test(text);
  });
  const allSegments: FillSegment[] = [];
  const lines: ClozeLine[] = blocks.map((b, bi) => {
    const parts: RichClozeText[] = Array.isArray(b.content)
      ? splitRichRunsAroundBlankMarkers(b.content)
      : (b.text ?? "").split(splitRe).filter((part) => part !== undefined && part !== "");
    const segs: ClozeSegment[] = parts.map((part) => {
      const marker = typeof part === "string" ? part.match(BLANK_MARKER_TOKEN_RE) : null;
      const blankId = marker?.[1] ?? marker?.[2];
      if (blankId) {
        const spec = blankById.get(blankId);
        // Legacy explicit `width` wins over the `input.size` preset (#437 + #444).
        return {
          blankId,
          acceptedAnswers: acceptedFor(blankId),
          // web-own: nhãn chỉ đi vào khối "Đáp án đúng", KHÔNG in cạnh ô — ở
          // đường có marker nhãn đã nằm sẵn trong câu văn ("…nhiều (1) ___…"),
          // in thêm là ra "(1) (1)".
          ...(spec?.label != null ? { label: spec.label } : {}),
          width: spec?.width ?? sizeToWidth(spec?.input?.size) ?? "7rem",
          // Đánh dấu width có do tác giả khai không — surface học sinh
          // (skin.presentation.spaciousBlanks) render blank default TO như web,
          // không clamp 42cqi; studio QA giữ clamp ở cả hai.
          widthAuthored: (spec?.width ?? sizeToWidth(spec?.input?.size)) != null,
          ...(spec?.input ? { input: spec.input } : {}),
          ...(spec?.media ? { media: spec.media } : {}),
          ...(spec?.options ?? sharedOptions
            ? { options: spec?.options ?? sharedOptions }
            : {}),
        };
      }
      return { text: part };
    });
    allSegments.push(...segs);
    return { id: `cloze-${bi}`, segments: segs };
  });

  // Fallback: no paragraph carries a blank marker (e.g. picture-word questions
  // where the stem is just an image and the blank stands alone). Synthesize one
  // input line per blank from `blanks[]` (or correctAnswer keys) so the player
  // still renders something to type into.
  if (!allSegments.some((s) => (s as { blankId?: string }).blankId)) {
    const blanksArr =
      (p.blanks as Array<{ id: string; before?: string; after?: string }> | undefined) ??
      [];
    const blankDefs = blanksArr.length > 0 ? blanksArr : Object.keys(caMap).map((id) => ({ id }) as { id: string });
    for (const b of blankDefs) {
      // Answers come only from correctAnswer (keyed by blankId); blanks[] supplies
      // structure (label/before/after), not answers.
      const accepted = acceptedFor(b.id);
      const spec = blankById.get(b.id);
      const input = spec?.input;
      const rawWidth = (b as { width?: unknown }).width;
      // Legacy explicit `width` wins over the `input.size` preset (#437 + #444).
      const width =
        typeof rawWidth === "string" && rawWidth ? rawWidth : sizeToWidth(input?.size) ?? "10rem";
      const label = (b as { label?: string }).label;
      const before = (b as { before?: string }).before;
      const after = (b as { after?: string }).after;
      const segs: ClozeSegment[] = [];
      // The blank's label (e.g. "a. Ăn vóc học hay:") renders as leading text so the
      // learner sees which prompt each input belongs to. It was previously dropped.
      if (label) segs.push({ text: `${label.replace(/\s+$/, "")} ` });
      if (before) segs.push({ text: before });
      segs.push({
        blankId: b.id,
        acceptedAnswers: accepted,
        // web-own: nhãn cũng vào khối "Đáp án đúng". Ở nhánh này nó ĐỒNG THỜI
        // in làm leading text (dòng trên) — giống ShortAnswerPlayer, và đúng ý
        // vì câu văn ở đây không có sẵn nhãn để trùng.
        ...(typeof label === "string" ? { label } : {}),
        width,
        // Đánh dấu width có do tác giả khai không — xem nhánh marker ở trên.
        widthAuthored: ((typeof rawWidth === "string" && rawWidth) || sizeToWidth(input?.size)) != null,
        ...(input ? { input } : {}),
        ...(spec?.media ? { media: spec.media } : {}),
        ...(spec?.options ? { options: spec.options } : {}),
      });
      if (after) segs.push({ text: after });
      // With labels, each labeled blank gets its own line (a/b/…); bare blanks with
      // no label keep the previous inline layout (picture-word questions).
      if (label && allSegments.length > 0) allSegments.push({ break: true });
      allSegments.push(...segs);
      lines.push({ id: `cloze-blank-${b.id}`, segments: segs });
    }
  }

  return { segments: allSegments, lines };
}

type WordBankSegment = { text: RichClozeText } | { blankId: string };

/**
 * Adapt both generations of the word-bank payload into the strict P25
 * contract. Older extracted questions store the sentence in content.blocks
 * and the bank as string[], while newer payloads already contain segments and
 * {id,text} objects. IDs are deterministic so answer mappings remain stable
 * across renders and retries.
 */
/** Ngân hàng từ đã chuẩn hoá — richToText giải nghĩa entry legacy {id, content}. */
function payloadWordBank(p: Payload): WordBankEntry[] {
  return normalizeWordBank(p.wordBank, (content) =>
    richToText(content as RichContent | undefined),
  );
}

function parseWordBank(p: Payload): {
  segments: WordBankSegment[];
  wordBank: WordBankEntry[];
  correctMappings: Record<string, string>;
} {
  const wordBank = payloadWordBank(p);

  const rawSegments = Array.isArray(p.segments) && p.segments.length > 0
    ? p.segments
    : parseCloze(p).segments;
  const segments = rawSegments.flatMap((segment: unknown): WordBankSegment[] => {
    if (!segment || typeof segment !== "object") return [];
    const candidate = segment as { text?: unknown; blankId?: unknown };
    if (candidate.blankId != null) {
      const blankId = String(candidate.blankId).trim();
      return blankId ? [{ blankId }] : [];
    }
    // The prose between blanks can arrive as a plain string (legacy `block.text`
    // payloads and the newer `p.segments` format) or as canonical rich runs
    // (`block.content`, which parseCloze splits via splitRichRunsAroundBlankMarkers).
    // Both must survive here — dropping the rich-run case is what left word_bank
    // essays rendering as bare blanks with the passage text missing.
    const { text } = candidate;
    if (typeof text === "string") return [{ text }];
    if (Array.isArray(text) && text.length > 0) return [{ text: text as RichTextRun[] }];
    return [];
  });

  const arrayMappings = caRecord(p, "blankId", "wordId");
  const rawMappings = Object.keys(arrayMappings).length > 0 ? arrayMappings : caRecord(p);
  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  const wordIdsByNormalizedText = new Map<string, string[]>();
  for (const word of wordBank) {
    const key = normalize(word.text);
    // Phần tử chỉ-media không có chữ để đối chiếu; gộp chúng vào khoá rỗng sẽ
    // khiến một khoá đáp án rỗng bắt trúng phần tử đầu tiên không liên quan.
    if (!key) continue;
    const ids = wordIdsByNormalizedText.get(key) ?? [];
    ids.push(word.id);
    wordIdsByNormalizedText.set(key, ids);
  }
  const consumedTextOccurrences = new Map<string, number>();
  const correctMappings: Record<string, string> = {};
  for (const [blankId, rawValue] of Object.entries(rawMappings)) {
    if (!blankId || !rawValue) continue;
    const direct = wordBank.find((word) => word.id === rawValue);
    if (direct) {
      correctMappings[blankId] = direct.id;
      continue;
    }

    // Legacy answer keys store visible text instead of word IDs. Resolve equal
    // text by occurrence so two identical chips remain two usable answers
    // rather than both blanks pointing at the first chip.
    const textKey = normalize(rawValue);
    const occurrence = consumedTextOccurrences.get(textKey) ?? 0;
    const matchingWordId = wordIdsByNormalizedText.get(textKey)?.[occurrence];
    if (matchingWordId) consumedTextOccurrences.set(textKey, occurrence + 1);
    correctMappings[blankId] = matchingWordId ?? rawValue;
  }
  return { segments, wordBank, correctMappings };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

// Media url keys that hold a stored `/uploads/...` path (or external url). Players
// render these raw into <img>/<audio> src, so they must be resolved to the API
// origin first — in prod web and API are separate domains with no /uploads proxy,
// so a bare same-origin path 404s to index.html. resolveAssetUrl no-ops http(s),
// data:, blob:, and non-slash relative values.
//
// The list lives in core/question-schema/media-keys so the editor's
// destructive-action warning counts exactly the media this resolver would load.

/** Deep-copy a payload, resolving every whitelisted media url to a loadable src. */
export function resolvePayloadMediaUrls<T>(node: T): T {
  if (Array.isArray(node)) return node.map(resolvePayloadMediaUrls) as unknown as T;
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] =
        typeof v === "string" && MEDIA_URL_KEYS.has(k) ? resolveAssetUrl(v) : resolvePayloadMediaUrls(v);
    }
    return out as T;
  }
  return node;
}

/**
 * Read a media url written either as a plain string or as an image record
 * (`{ url, altText }`). Both shapes are real payload data: `diagram_fill` and the
 * extraction pipeline author the record form, while most players' props take the
 * string. `resolvePayloadMediaUrls` already resolved BOTH (`backgroundImage` and
 * the nested `url` are whitelisted keys), so either branch yields a loadable src.
 */
function mediaUrlOf(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (value && typeof value === "object") {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string" && url.trim()) return url;
  }
  return undefined;
}

/**
 * The background image behind a canvas-style player. `backgroundImage` is the
 * canonical key in either shape; `image.url` is the fallback the drawing editor
 * writes (outline mode). Reading only `p.backgroundImage` as a string silently
 * blanked the canvas whenever extraction had written the record form (issue
 * #822) — the url was present and valid the whole time.
 */
function backgroundImageUrl(p: Payload): string | undefined {
  return mediaUrlOf(p.backgroundImage) ?? mediaUrlOf(p.image);
}

/**
 * Resolve + render the player element (no grade-mode wrapper). Internal — use
 * `renderInteractionPlayer`, which wraps this in the GradeModeContext provider.
 *
 * ONE accent boundary for every player: the resolved manifest component is the
 * key into PLAYER_ACCENT_OF, and the whole element is wrapped in
 * <AccentProvider> here — players no longer declare `accent="bg-x-400"`
 * themselves. Nested children re-enter through renderInteractionPlayer →
 * renderPlayerElement, so a sub-question gets ITS OWN accent (not the group's).
 */
function renderPlayerElement(
  type: string,
  payload: Payload,
  handlers: PlayerHandlers,
): React.ReactNode {
  // v1.0 used free_draw as a type alias. Keep it on the canonical drawing
  // resolver path so top-level and nested rendering cannot diverge.
  const requestedType = type.trim();
  const resolvedType = requestedType === "free_draw" ? "drawing" : requestedType;
  const resolution = resolveDisplay(resolvedType, payload);
  const el = renderPlayerBody(requestedType, resolvedType, payload, handlers, resolution);
  // Diagnostics render without an accent boundary (they carry no identity hue).
  if (!resolution.ok) return el;
  return (
    <AccentProvider accent={PLAYER_ACCENT_OF[resolution.entry.component]}>
      {el}
    </AccentProvider>
  );
}

/** The big per-component switch. Only ever called via renderPlayerElement. */
function renderPlayerBody(
  requestedType: string,
  resolvedType: string,
  payload: Payload,
  handlers: PlayerHandlers,
  resolution: DisplayResolution,
): React.ReactNode {
  if (!resolution.ok) {
    return (
      <RendererCapabilityDiagnostic
        {...resolution}
        type={requestedType}
        path={handlers.path}
        scope={handlers.scope ?? "top-level"}
      />
    );
  }
  const entry = resolution.entry;

  const p = resolvePayloadMediaUrls(payload ?? {}) as Payload;
  const base = {
    answer: handlers.answer,
    onAnswerChange: handlers.onAnswerChange,
    onComplete: handlers.onComplete,
    onStatusChange: handlers.onStatusChange,
    submitted: handlers.submitted,
    compact: handlers.compact,
    // Câu con trong wrapper (question_group, audio anchor…) — PlayerShell bỏ
    // padding màn, ô bao ngoài đã có padding riêng (xem PlayerProps.nested).
    nested: handlers.scope === "nested",
    // Survey / self-assessment questions have no right answer — graded players
    // render record-only. Players also infer this when no correct answer exists.
    selfAssessment: p.selfAssessment === true,
    instantFeedback: handlers.instantFeedback ?? true,
    onElementGraded: handlers.onElementGraded,
    onProgress: handlers.onProgress,
  };
  // Capability labels describe renderer implementations for editors and
  // diagnostics. They are never learner-facing fallback content.
  const title = payloadTitle(p);
  // richContent passes the full content block array so PlayerHeader can render
  // images and multi-paragraph stems inline. When richContent is present the
  // header owns all content rendering; don't also extract instruction from it.
  const richContent = p.content as RichContent | undefined;
  const hasRichBlocks = (richContent?.blocks?.length ?? 0) > 0;
  const instruction = typeof p.instruction === "string"
    ? p.instruction
    : hasRichBlocks ? undefined : payloadInstruction(p);
  const inputMode: "text" | "formula" = entry.interactionType === "text" ? "text" : "formula";
  const head = {
    ...base,
    title,
    instruction,
    richContent,
    inputMode,
    layout: resolution.layout,
    interactionType: resolution.interactionType,
  };

  switch (entry.component) {
    // ── Selection · choice-grid ──────────────────────────────────────────
    case "SingleChoicePlayer":
      return (
        <SingleChoicePlayer
          {...head}
          options={adaptOptions(p)}
          correctId={caStr(p)}
          variant={entry.interactionType === "circle" || entry.interactionType === "color_fill" ? entry.interactionType : "radio"}
          // web-own: khoá sổ nhớ màu color_fill — xem color-fill-memory.
          colorFillKey={handlers.questionId}
        />
      );
    case "MultiChoicePlayer":
      return (
        <MultiChoicePlayer
          {...head}
          options={adaptOptions(p)}
          correctIds={caArr(p)}
          variant={entry.interactionType === "circle" || entry.interactionType === "color_fill" ? entry.interactionType : "checkbox"}
          // web-own: khoá sổ nhớ màu color_fill — xem color-fill-memory.
          colorFillKey={handlers.questionId}
        />
      );
    case "TrueFalsePlayer":
      return <TrueFalsePlayer {...head} correct={Boolean(p.correctAnswer)} />;
    case "YesNoPlayer":
      return (
        <YesNoPlayer
          {...head}
          correct={Boolean(p.correctAnswer)}
          trueLabel={p.trueLabel as string | undefined}
          falseLabel={p.falseLabel as string | undefined}
        />
      );
    case "ImageChoiceSinglePlayer":
      return (
        <ImageChoiceSinglePlayer
          {...head}
          options={adaptImageOptions(p)}
          correctId={caStr(p)}
        />
      );
    case "ImageChoiceMultiPlayer":
      return (
        <ImageChoiceMultiPlayer
          {...head}
          options={adaptImageOptions(p)}
          correctIds={caArr(p)}
        />
      );
    case "TileSelectPlayer":
      return (
        <TileSelectPlayer
          {...head}
          options={adaptOptions(p)}
          correctId={caStr(p)}
          multiple={resolvedType === "multiple_choice" || (p.multiple as boolean | undefined)}
          correctIds={caArr(p)}
        />
      );
    case "DropdownSelectPlayer":
      return (
        <DropdownSelectPlayer
          {...head}
          options={adaptOptions(p).map((o) => ({ id: o.id, text: o.text }))}
          correctId={caStr(p)}
        />
      );

    // ── Hotspot · image-hotspot ──────────────────────────────────────────
    case "HotspotSinglePlayer": {
      const hotspots = (p.hotspots as Array<{ id: string; label?: string; shape?: "circle" | "rect" | "polygon"; x?: number; y?: number; radius?: number; width?: number; height?: number; points?: Array<{ x: number; y: number }> }>) ?? [];
      return (
        <HotspotSinglePlayer
          {...head}
          imageUrl={(p.image?.url as string) ?? ""}
          imageAlt={p.image?.altText as string | undefined}
          hotspots={hotspots}
          // Đáp án object ({count} soạn nhầm cho biến thể single) không phải id —
          // caStr sẽ ra "[object Object]" và mọi click đều bị chấm sai; thả về
          // rỗng để player ghi nhận không chấm (record-only).
          correctId={typeof p.correctAnswer === "object" && p.correctAnswer != null ? "" : caStr(p)}
        />
      );
    }
    case "HotspotMultiPlayer": {
      const hotspots = (p.hotspots as Array<{ id: string; label?: string; shape?: "circle" | "rect" | "polygon"; x?: number; y?: number; radius?: number; width?: number; height?: number; points?: Array<{ x: number; y: number }> }>) ?? [];
      return (
        <HotspotMultiPlayer
          {...head}
          imageUrl={(p.image?.url as string) ?? ""}
          imageAlt={p.image?.altText as string | undefined}
          hotspots={hotspots}
          correctIds={caArr(p)}
          // correctAnswer {count}: chấm theo SỐ LƯỢNG vùng đã chọn, không theo tập id.
          correctCount={hotspotAnswerCount(p.correctAnswer)}
          // `display.mark` ("✓" / "✗", spec §5.13.3) bật dấu trong ô in — LỌC
          // KIỂU, không ép: khai lạ thì về null và câu vẫn vẽ vòng như cũ.
          mark={hotspotMarkKind((p.display as { mark?: unknown } | undefined)?.mark)}
        />
      );
    }
    case "PlacePinPlayer":
      return (
        <PlacePinPlayer
          {...head}
          imageUrl={(p.image?.url as string) ?? ""}
          imageAlt={p.image?.altText as string | undefined}
          target={p.correctAnswer as { x: number; y: number }}
          tolerance={p.tolerance as number | undefined}
        />
      );
    case "ImageColorClassifyPlayer": {
      const categories = ((p.categories as Array<{ id: string; label: string; color?: string; mark?: string }>) ?? []).map((c) => ({
        id: c.id,
        label: c.label ?? "",
        color: c.color as string | undefined,
        // web-own: khai `mark` thì vùng hiện dấu thay vì tô màu (P62 "ô đánh
        // dấu") — xem WEB-OWN PATCHES trong detokenize-players.mjs. Lọc kiểu
        // chứ không ép: payload gõ tay ra `"mark": 1` thì `.trim()` sẽ ném.
        mark: typeof c.mark === "string" ? c.mark : undefined,
      }));
      const items = (p.items as Array<{ id: string; label?: string; shape: "circle" | "rect" | "polygon"; x?: number; y?: number; radius?: number; width?: number; height?: number; points?: Array<[number, number]> }>) ?? [];
      return (
        <ImageColorClassifyPlayer
          {...head}
          imageUrl={(p.image?.url as string) ?? ""}
          imageAlt={p.image?.altText as string | undefined}
          categories={categories}
          items={items}
          correctMappings={caRecord(p)}
        />
      );
    }

    // ── Text entry · text-input ──────────────────────────────────────────
    case "FillBlankPlayer": {
      const { segments } = parseCloze(p);
      // In-place when markers live in content → render the FULL content so paragraph
      // order + ContentLayout survive (#399). Fallback (no marker, e.g. labeled
      // blanks synthesized from blanks[]) keeps the stripped header + flat segments.
      const inPlace = contentHasBlankMarker(head.richContent);
      return (
        <FillBlankPlayer
          {...head}
          title=""
          instruction={undefined}
          richContent={inPlace ? undefined : stripBlankMarkerBlocks(head.richContent)}
          content={inPlace ? head.richContent : undefined}
          segments={segments}
          wordBank={payloadWordBank(p)}
        />
      );
    }
    case "ClozePlayer": {
      const { lines } = parseCloze(p);
      const inPlace = contentHasBlankMarker(head.richContent);
      const splitContent = inPlace
        ? splitClozeContentAtFirstBlank(head.richContent)
        : undefined;
      const leadingContent = inPlace
        ? undefined
        : stripBlankMarkerBlocks(head.richContent);
      return (
        <ClozePlayer
          {...head}
          title=""
          instruction={undefined}
          richContent={
            inPlace
              ? splitContent?.headerContent
              : undefined
          }
          content={inPlace ? splitContent?.interactionContent : undefined}
          leadingContent={leadingContent}
          lines={lines}
          wordBank={payloadWordBank(p)}
        />
      );
    }
    case "NumericEntryPlayer":
      return (
        <NumericEntryPlayer
          {...head}
          correctAnswer={Number(p.correctAnswer)}
          tolerance={p.tolerance as number | undefined}
          unit={p.unit as string | undefined}
        />
      );
    case "ShortAnswerPlayer": {
      // fill_blank's correctAnswer is always Record<blankId, string|string[]> (never a
      // scalar/array), so caList(p) would String()-ify the whole object into
      // "[object Object]" — flatten every blank's accepted values instead.
      const ca = p.correctAnswer;
      const caMap =
        ca && typeof ca === "object" && !Array.isArray(ca)
          ? (ca as Record<string, unknown>)
          : undefined;
      const acceptedForBlank = (id: string): string[] => {
        const v = caMap?.[id];
        if (v == null) return [];
        return Array.isArray(v) ? v.map(String) : [String(v)];
      };
      const shortAnswerAccepted = caMap
        ? Object.values(caMap).flatMap((v) => (Array.isArray(v) ? v.map(String) : [String(v)]))
        : caList(p);
      // Multi-blank short_text (#509): each declared blank gets its own labeled
      // answer box. Only engage when the payload carries ≥2 blanks or a labeled
      // blank — single unlabeled short_text (no blanks[]) keeps its one textarea.
      const rawBlanks = Array.isArray(p.blanks)
        ? (p.blanks as Array<{ id?: unknown; label?: unknown }>)
        : [];
      const shortAnswerBlanks = rawBlanks
        .filter((b): b is { id: unknown; label?: unknown } => Boolean(b) && typeof b === "object" && b.id != null)
        .map((b) => ({
          id: String(b.id),
          label: typeof b.label === "string" ? b.label : undefined,
          acceptedAnswers: acceptedForBlank(String(b.id)),
        }));
      const useLabeledBlanks =
        shortAnswerBlanks.length >= 2 || shortAnswerBlanks.some((b) => b.label && b.label.trim() !== "");
      return (
        <ShortAnswerPlayer
          {...head}
          acceptedAnswers={shortAnswerAccepted}
          keywords={p.keywords as string[] | undefined}
          minChars={p.minChars as number | undefined}
          blanks={useLabeledBlanks ? shortAnswerBlanks : undefined}
        />
      );
    }
    case "EssayPlayer":
      return (
        <EssayPlayer
          {...head}
          minWords={p.minWords as number | undefined}
          maxWords={p.maxWords as number | undefined}
          rubric={p.rubric as Array<{ criterion: string; maxScore: number }> | undefined}
          prompts={Array.isArray(p.prompts) ? (p.prompts as string[]) : undefined}
          imagePrompts={
            Array.isArray(p.imagePrompts) ? (p.imagePrompts as EssayImagePrompt[]) : undefined
          }
          readOnly={p.readOnly === true}
          placeholder={typeof p.placeholder === "string" ? p.placeholder : undefined}
        />
      );
    case "FormulaEntryPlayer":
      return (
        <FormulaEntryPlayer
          {...head}
          acceptedAnswers={caList(p)}
          gradingMode={p.gradingMode as "numeric" | "symbolic" | "algebraic_equivalence" | undefined}
          tolerance={p.tolerance as number | undefined}
        />
      );

    case "MathClozePlayer": {
      // Công thức tương tác bị gỡ khỏi phần đầu đề: để nguyên thì PlayerShell vẽ
      // nó lần nữa bằng KaTeX tĩnh, chồng lên ô nhập mà player đang giữ.
      return (
        <MathClozePlayer
          {...head}
          richContent={stripMathClozeBlocks(head.richContent)}
          formulas={mathClozeFormulas(head.richContent)}
          blanks={(p.blanks as MathClozeBlank[] | undefined) ?? []}
          gradingMode={p.gradingMode as "numeric" | "symbolic" | "algebraic_equivalence" | undefined}
          tolerance={p.tolerance as number | undefined}
        />
      );
    }

    case "ConnectPointsPlayer": {
      const points = ((p.points as Array<Item & { x: number; y: number; imageUrl?: string; image?: { url?: string } }>) ?? []).map(
        (pt) => ({ id: pt.id, label: pt.label ?? richToText(pt.content) ?? "", x: pt.x, y: pt.y, imageUrl: contentImageUrl(pt) }),
      );
      const correctConnections =
        (p.correctAnswer as Array<{ from: string; to: string }> | undefined) ??
        (p.correctConnections as Array<{ from: string; to: string }> | undefined) ?? [];
      return (
        <ConnectPointsTask
          title={title}
          richContent={richContent}
          instruction={hasRichBlocks ? instruction : instruction ?? "Nhấn hai điểm liên tiếp để nối chúng"}
          backgroundImage={mediaUrlOf(p.backgroundImage)}
          points={points}
          correctConnections={correctConnections}
          // `example` của connect_points mang hình dạng `{from,to}` của chính
          // `correctAnswer` loại này — task tự kiểm hình dạng (payload là dict tự do).
          example={p.example}
          onComplete={handlers.onComplete ?? (() => {})}
          onAnswerChange={handlers.onAnswerChange}
          submitted={handlers.submitted}
          onStatusChange={handlers.onStatusChange}
          answer={base.answer}
          selfAssessment={base.selfAssessment}
          instantFeedback={base.instantFeedback}
          onElementGraded={base.onElementGraded}
          onProgress={base.onProgress}
          layout={resolution.layout}
        />
      );
    }
    case "MindMapCompletionPlayer": {
      const nodes = (p.nodes as Array<{ id: string; label?: string; prefix?: string; nodeType: "static" | "input" | "essay"; rowLines?: number; acceptedAnswers?: string[] }>) ?? [];
      const edges = (p.edges as Array<{ from: string; to: string }>) ?? [];
      return (
        <MindMapTask
          title={title}
          richContent={richContent}
          instruction={hasRichBlocks ? instruction : instruction ?? "Điền vào các ô trống trong sơ đồ"}
          nodes={nodes}
          edges={edges}
          onComplete={handlers.onComplete ?? (() => {})}
          onAnswerChange={handlers.onAnswerChange}
          // web-own: kênh khôi phục answer — chưa upstream lên studio, copy đè
          // sẽ làm mất bài làm mind_map_completion khi chuyển câu / xem lại.
          answer={handlers.answer}
          submitted={handlers.submitted}
        />
      );
    }
    case "UploadAnswerPlayer":
      return (
        <UploadTask
          title={title}
          richContent={richContent}
          instruction={hasRichBlocks ? instruction : instruction ?? "Chụp và tải lên bài làm của em"}
          allowedFileTypes={p.allowedFileTypes as string[] | undefined}
          maxFileSizeMB={p.maxFileSizeMB as number | undefined}
          onComplete={handlers.onComplete ?? (() => {})}
          onAnswerChange={handlers.onAnswerChange}
          // web-own: kênh khôi phục answer + upload thật lên server — chưa
          // upstream lên studio, copy đè sẽ làm mất tích hợp nộp file LCMS.
          answer={handlers.answer}
          onUploadFile={handlers.onUploadFile}
          submitted={handlers.submitted}
        />
      );
    case "MatchingScenePlayer":
    case "MatchScenePlayer": {
      type RawSceneNode = Item & Omit<MatchingSceneNode, "kind" | "id" | "x" | "y"> & {
        x?: number;
        y?: number;
      };
      const toNodes = (kind: "item" | "target"): MatchingSceneNode[] => {
        const source = matchingItems(p, kind === "item" ? "left" : "right") as RawSceneNode[];
        // Một cột dọc chỉ đủ chỗ cho ~5 nút; đông hơn thì so le hai làn theo trục x
        // để các nút cạnh nhau không che nhau khi câu hỏi vừa chuyển sang scene và
        // chưa có toạ độ tác giả. Chỉ áp dụng cho nút THIẾU x/y — không đè toạ độ đã lưu.
        const baseX = kind === "item" ? 18 : 82;
        const stagger = source.length > 5 ? 7 : 0;
        return source.map((node, index) => ({
          ...node,
          kind,
          x: typeof node.x === "number" ? node.x : baseX + (index % 2 === 0 ? -stagger : stagger),
          y: typeof node.y === "number" ? node.y : ((index + 1) / (source.length + 1)) * 100,
        }));
      };
      const rawBackground = p.background;
      const background: MatchingSceneBackground | undefined =
        rawBackground && typeof rawBackground === "object" && typeof rawBackground.url === "string"
          ? (rawBackground as MatchingSceneBackground)
          : mediaUrlOf(p.backgroundImage)
            ? { url: mediaUrlOf(p.backgroundImage) as string }
            : undefined;
      const exampleEdges = Array.isArray(p.example)
        ? matchingEdges(p.example)
        : matchingEdges(p.example == null ? undefined : [p.example]);
      // web#706 — luật `locked` giờ sống DUY NHẤT ở resolveMatchingPayload
      // (đọc từ payload thô, vì normalizeMatchEdges bỏ key này) và dùng chung
      // cho cả sáu biến thể matching. Scene vẫn tự dựng danh sách cạnh mẫu vì
      // node của nó đến từ matchingItems — đường phân giải khác với cột schema.
      const exampleIsLocked = resolveMatchingPayload(p).exampleLocked;
      const hydratedAnswer = matchingEdges([...exampleEdges, ...matchingEdges(handlers.answer)]);
      return (
        <MatchingScenePlayer
          key={handlers.questionId}
          {...head}
          answer={hydratedAnswer}
          nodes={[...toNodes("item"), ...toNodes("target")]}
          correctEdges={matchingEdges(p.correctAnswer)}
          cardinality={resolveMatchingPayload(p).cardinality}
          background={background}
          aspect={p.aspect as number | string | undefined}
          maxWidth={p.maxWidth as React.CSSProperties["maxWidth"]}
          lockedExampleEdge={exampleIsLocked ? exampleEdges[0] : undefined}
          lockExampleItem={exampleIsLocked}
          disabled={handlers.disabled}
        />
      );
    }

    // ── Ordering · sortable-list ─────────────────────────────────────────
    case "ReorderListPlayer":
      return (
        <ReorderListPlayer
          {...head}
          items={textItems(p.items as Item[], "Mục")}
          correctOrder={caArr(p)}
          displayOrder={Array.isArray(p.displayOrder) ? p.displayOrder.map(String) : undefined}
        />
      );
    case "RankPlayer":
      return (
        <RankPlayer
          {...head}
          items={textItems(p.items as Item[], "Mục")}
          correctOrder={caArr(p)}
          topLabel={p.topLabel as string | undefined}
          bottomLabel={p.bottomLabel as string | undefined}
        />
      );
    case "ProcessSequencePlayer":
      return (
        <ProcessSequencePlayer
          {...head}
          items={textItems(p.items as Item[], "Mục")}
          correctOrder={caArr(p)}
        />
      );
    case "TimelinePlayer":
      return (
        <TimelinePlayer
          {...head}
          items={textItems(p.items as Item[], "Mục")}
          slots={(p.slots as Array<{ id: string; label: string }>) ?? []}
          correctOrder={caArr(p)}
        />
      );

    // ── Matching · match ─────────────────────────────────────────────────
    case "TwoColumnMatchPlayer": {
      const match = resolveMatchingPayload(p);
      return (
        <TwoColumnMatchPlayer
          key={handlers.questionId}
          {...head}
          leftItems={textItems(match.leftItems, "Mục")}
          rightItems={textItems(match.rightItems, "Mục")}
          leftTitle={match.leftTitle || undefined}
          rightTitle={match.rightTitle || undefined}
          leftTitleContent={match.leftTitleContent}
          rightTitleContent={match.rightTitleContent}
          correctEdges={match.correctEdges}
          cardinality={match.cardinality}
          exampleEdges={match.exampleEdges}
          exampleLocked={match.exampleLocked}
        />
      );
    }
    case "ConnectLinesPlayer": {
      const match = resolveMatchingPayload(p);
      return (
        <ConnectLinesPlayer
          key={handlers.questionId}
          {...head}
          leftItems={textItems(match.leftItems, "Mục")}
          rightItems={textItems(match.rightItems, "Mục")}
          leftTitle={match.leftTitle || undefined}
          rightTitle={match.rightTitle || undefined}
          leftTitleContent={match.leftTitleContent}
          rightTitleContent={match.rightTitleContent}
          correctEdges={match.correctEdges}
          cardinality={match.cardinality}
          exampleEdges={match.exampleEdges}
          exampleLocked={match.exampleLocked}
        />
      );
    }
    case "MatchRowsPlayer": {
      const match = resolveMatchingPayload(p);
      return (
        <MatchRowsPlayer
          key={handlers.questionId}
          {...head}
          leftItems={textItems(match.leftItems, "Mục")}
          rightItems={textItems(match.rightItems, "Mục")}
          leftTitle={match.leftTitle || undefined}
          rightTitle={match.rightTitle || undefined}
          leftTitleContent={match.leftTitleContent}
          rightTitleContent={match.rightTitleContent}
          correctEdges={match.correctEdges}
          cardinality={match.cardinality}
          exampleEdges={match.exampleEdges}
          exampleLocked={match.exampleLocked}
        />
      );
    }
    case "MatchRadialPlayer": {
      const match = resolveMatchingPayload(p);
      return (
        <MatchRadialPlayer
          key={handlers.questionId}
          {...head}
          leftItems={textItems(match.leftItems, "Mục")}
          rightItems={textItems(match.rightItems, "Mục")}
          leftTitle={match.leftTitle || undefined}
          rightTitle={match.rightTitle || undefined}
          leftTitleContent={match.leftTitleContent}
          rightTitleContent={match.rightTitleContent}
          correctEdges={match.correctEdges}
          cardinality={match.cardinality}
          exampleEdges={match.exampleEdges}
          exampleLocked={match.exampleLocked}
        />
      );
    }
    case "ChainMatchPlayer": {
      const match = resolveMatchingPayload(p);
      return (
        <ChainMatchPlayer
          key={handlers.questionId}
          {...head}
          leftItems={textItems(match.leftItems, "Mục")}
          middleItems={textItems(match.middleItems, "Mục")}
          rightItems={textItems(match.rightItems, "Mục")}
          leftTitle={match.leftTitle || undefined}
          middleTitle={match.middleTitle || undefined}
          rightTitle={match.rightTitle || undefined}
          leftTitleContent={match.leftTitleContent}
          middleTitleContent={match.middleTitleContent}
          rightTitleContent={match.rightTitleContent}
          correctEdges={match.correctEdges}
          // Ba cột: trần tính RIÊNG cho chặng trái→giữa và chặng giữa→phải.
          cardinality={match.cardinalityByHop}
          // Chain là ca thực của web#706: cặp mẫu `24 → Gấp 2 lần → 48` là HAI
          // cạnh, nên truyền nguyên mảng (không cắt còn [0] như scene).
          exampleEdges={match.exampleEdges}
          exampleLocked={match.exampleLocked}
          // §5.9.3 — chain và triad dùng chung player này; cờ chỉ đổi phần
          // trình bày (nhấn mạnh cột giữa + gợi ý), không đụng cột/cạnh/chấm.
          triad={match.interactionType === "triad"}
        />
      );
    }
    case "CategorizePlayer": {
      // web-own: `color` — màu nhóm tác giả khai (spec §5.12). CHƯA upstream lên
      // studio; studio đang bốc thiếu trường này y như đây trước bản vá. Copy đè
      // dispatch.tsx từ studio sẽ cắt lại kênh màu TRONG IM LẶNG (không lỗi biên
      // dịch), hai nhóm về lại cùng một màu. Test khoá:
      // players/classificationAuthoredColor.test.tsx.
      const categories = ((p.categories as Item[]) ?? []).map((c, i) => ({
        id: c.id,
        label: itemText(c, i, "Nhóm"),
        imageUrl: contentImageUrl(c),
        imageWidth: contentImageWidth(c),
        color: c.color,
      }));
      const items = textItems((p.items as Item[]) ?? [], "Thẻ");
      return (
        <CategorizePlayer
          {...head}
          categories={categories}
          items={items}
          correctMappings={caRecord(p, "itemId", "categoryId")}
        />
      );
    }
    case "WordBankPlayer": {
      const { segments, wordBank, correctMappings } = parseWordBank(p);
      // In-place: markers live in content → render the FULL content in the body so
      // paragraph order + ContentLayout survive (#398/#399). The header shows nothing
      // extra (body owns the authored question stem); the capability registry label is
      // internal metadata, not a learner-facing title. Fallback: no marker → keep the
      // stripped header + flat segments (e.g. picture-word / segment-only payloads).
      const inPlace = contentHasBlankMarker(head.richContent);
      return (
        <WordBankPlayer
          {...head}
          title=""
          instruction={undefined}
          richContent={inPlace ? undefined : stripBlankMarkerBlocks(head.richContent)}
          content={inPlace ? head.richContent : undefined}
          blankIds={inPlace ? orderedBlankIds(head.richContent) : undefined}
          blankLabels={blankLabelsById(p)}
          segments={inPlace ? undefined : segments}
          wordBank={wordBank}
          correctMappings={correctMappings}
        />
      );
    }

    // ── Drag-and-drop · dnd-canvas ───────────────────────────────────────
    case "DragToZonesPlayer": {
      const draggables = textItems(p.draggables as Item[], "Thẻ");
      const dropZones = ((p.dropZones as Array<{ id: string; label?: string }>) ?? []).map((z, i) => ({
        id: z.id,
        label: z.label ?? `Vùng ${i + 1}`,
      }));
      return (
        <DragToZonesPlayer
          {...head}
          draggables={draggables}
          dropZones={dropZones}
          correctMappings={caRecord(p, "draggableId", "dropZoneId")}
          mode={p.mode as "one_to_one" | "many_to_one" | undefined}
        />
      );
    }
    case "LabelDiagramPlayer": {
      const labels = ((p.labels as Array<Item & { imageUrl?: string; image?: { url?: string } }>) ?? []).map(
        (l) => ({
          id: l.id,
          text: l.text ?? richToText(l.content),
          imageUrl: contentImageUrl(l),
          imageWidth: contentImageWidth(l),
        }),
      );
      const targets = (p.targets as Array<{ id: string; x: number; y: number }>) ?? [];
      return (
        <LabelDiagramPlayer
          {...head}
          imageUrl={(p.image?.url as string) ?? ""}
          imageAlt={p.image?.altText as string | undefined}
          labels={labels}
          targets={targets}
          correctMappings={caRecord(p, "labelId", "targetId")}
        />
      );
    }
    case "TwoBucketSortPlayer": {
      // Backend/spec only ever produce `categories` for classification (never a
      // dedicated `buckets` field) — derive the two buckets from it.
      // web-own: `color` — xem ghi chú ở case "CategorizePlayer" phía trên.
      const bk = ((p.buckets as Item[] | undefined) ?? (p.categories as Item[] | undefined) ?? []).map(
        (c, i) => ({ id: c.id, label: itemText(c, i, "Nhóm"), imageUrl: contentImageUrl(c), imageWidth: contentImageWidth(c), color: c.color }),
      );
      type Bucket = { id: string; label: string; imageUrl?: string; imageWidth?: string; color?: string };
      const buckets: [Bucket, Bucket] = [
        bk[0] ?? { id: "b1", label: "" },
        bk[1] ?? { id: "b2", label: "" },
      ];
      const items = textItems(p.items as Item[], "Thẻ");
      return (
        <TwoBucketSortPlayer
          {...head}
          buckets={buckets}
          items={items}
          correctMappings={caRecord(p, "itemId", "bucketId")}
        />
      );
    }
    case "DragToGridPlayer": {
      const grid = (p.grid as { rows: number; cols: number } | undefined) ?? { rows: 2, cols: 2 };
      const tokens = textItems(p.tokens as Item[], "Thẻ");
      return (
        <DragToGridPlayer
          {...head}
          rows={grid.rows}
          cols={grid.cols}
          tokens={tokens}
          correctCells={(p.correctAnswer as Record<string, string>) ?? {}}
        />
      );
    }

    // ── Scale / rating · scale ───────────────────────────────────────────
    case "LikertPlayer":
      return (
        <LikertPlayer
          {...head}
          points={(p.points as Array<{ value: number; label: string }>) ?? []}
          correctValue={caNum(p)}
        />
      );
    case "NumericSliderPlayer":
      return (
        <NumericSliderPlayer
          {...head}
          min={Number(p.min ?? 0)}
          max={Number(p.max ?? 100)}
          step={p.step as number | undefined}
          minLabel={p.minLabel as string | undefined}
          maxLabel={p.maxLabel as string | undefined}
          correctValue={caNum(p)}
          tolerance={p.tolerance as number | undefined}
        />
      );
    case "StarRatingPlayer":
      return (
        <StarRatingPlayer
          {...head}
          max={p.max as number | undefined}
          icon={p.icon as "star" | "heart" | undefined}
          correctValue={caNum(p)}
        />
      );
    case "ConfidenceSliderPlayer":
      return <ConfidenceSliderPlayer {...head} correctValue={caNum(p)} />;
    case "SemanticDifferentialPlayer":
      return (
        <SemanticDifferentialPlayer
          {...head}
          pairs={(p.pairs as Array<{ id: string; leftLabel: string; rightLabel: string; points?: number }>) ?? []}
          correctValues={p.correctAnswer as Record<string, number> | undefined}
        />
      );

    // ── Region / mark · highlight ────────────────────────────────────────
    case "HighlightTextPlayer":
      return (
        <HighlightTextPlayer
          {...head}
          segments={(p.segments as HighlightTextPlayerProps["segments"]) ?? []}
          correctIds={caArr(p)}
        />
      );
    case "SelectWordsPlayer":
      return (
        <SelectWordsPlayer
          {...head}
          passage={(p.passage as string) ?? ""}
          passageContent={p.passageContent as SelectWordsPlayerProps["passageContent"]}
          correctWords={Array.isArray(p.correctAnswer) ? p.correctAnswer.map(Number) : []}
          instructionHint={p.instructionHint as string | undefined}
        />
      );
    case "ChartBuildPlayer":
      return (
        <ChartBuildPlayer
          {...head}
          chart={p.chart as ChartBuildPlayerProps["chart"]}
          // correctAnswer = Record<mã hạng mục, số>. Đường strip đáp án phía
          // server che đúng khoá này nên không cần lệ ngoại.
          correctValues={p.correctAnswer as ChartBuildPlayerProps["correctValues"]}
          tolerance={p.tolerance as number | undefined}
        />
      );

    case "GeometryGridPlayer":
      return (
        <GeometryGridPlayer
          {...head}
          grid={p.grid as GeometryGridPlayerProps["grid"]}
          tools={p.tools as GeometryGridPlayerProps["tools"]}
          given={p.given as GeometryGridPlayerProps["given"]}
          // Điều kiện là ĐÁP ÁN của loại câu này nên nằm trong correctAnswer —
          // đường strip đáp án phía server che đúng khoá đó, không cần lệ ngoại.
          constraints={
            (p.correctAnswer as { constraints?: GeometryGridPlayerProps["constraints"] } | undefined)
              ?.constraints
          }
        />
      );

    case "FreeDrawPlayer":
      return (
        <FreeDrawPlayer
          {...head}
          backgroundImage={backgroundImageUrl(p)}
          colors={(p.colors ?? p.palette) as string[] | undefined}
          aspectRatio={p.aspectRatio as number | string | undefined}
          canvasHeight={p.canvasHeight as number | string | undefined}
          canvasLabel={p.canvasLabel as string | undefined}
          textFields={p.textFields as FreeDrawTextField[] | undefined}
          prompt={(p.prompt as string | undefined) ?? instruction}
        />
      );

    // ── Media-anchored · media-wrapper ───────────────────────────────────
    case "VideoAnchoredPlayer": {
      const anchors = adaptAnchors(p, handlers);
      return (
        <VideoAnchoredPlayer
          {...head}
          videoUrl={(p.videoUrl as string) ?? ""}
          poster={p.poster as string | undefined}
          anchors={anchors}
          pauseOnAnchor={p.pauseOnAnchor as boolean | undefined}
        />
      );
    }
    case "AudioAnchoredPlayer": {
      const anchors = adaptAnchors(p, handlers);
      return (
        <AudioAnchoredPlayer
          {...head}
          audioUrl={(p.audioUrl as string) ?? ""}
          anchors={anchors}
          pauseOnAnchor={p.pauseOnAnchor as boolean | undefined}
        />
      );
    }

    // ── Skill · skill ────────────────────────────────────────────────────
    case "SpeakingPlayer":
      return (
        <SpeakingPlayer
          {...head}
          maxDuration={p.maxDuration as number | undefined}
          allowRetake={p.allowRetake as boolean | undefined}
        />
      );
    case "DictationPlayer": {
      const audioBlock = (p.content as RichContent | undefined)?.blocks?.find(
        (b) => b.type === "audio",
      );
      return (
        <DictationPlayer
          {...head}
          audioUrl={(p.audioUrl as string | undefined) ?? (audioBlock?.url as string | undefined)}
          acceptedTranscript={Array.isArray(p.correctAnswer) ? String(p.correctAnswer[0] ?? "") : caStr(p)}
          acceptedAnswers={caList(p)}
          caseSensitive={p.caseSensitive === true}
        />
      );
    }
    case "ColoringPlayer": {
      // Read through the canonical resolver, not the raw payload: a region with
      // no usable `id` is unclickable, and a non-string palette entry lands in
      // `style.backgroundColor` as garbage. Same gates as the adapter.
      const coloring = resolveColoringConfig(p);
      // Zero regions = a palette with nothing to paint: the learner cannot
      // answer and nothing on screen says so. Fail loudly (issue #810).
      if (coloring.regions.length === 0) {
        return (
          <RendererCapabilityDiagnostic
            code="COLORING_NO_REGIONS"
            type={requestedType}
            interactionType={resolution.interactionType}
            path={handlers.path}
            scope={handlers.scope ?? "top-level"}
          />
        );
      }
      return (
        <ColoringPlayer
          {...head}
          imageUrl={coloring.imageUrl}
          regions={coloring.regions}
          colors={coloring.colors}
        />
      );
    }
    case "MindMapPlayer":
      return (
        <MindMapPlayer
          {...head}
          rootLabel={p.rootLabel as string | undefined}
          seedNodes={p.seedNodes as Array<{ id: string; label: string }> | undefined}
        />
      );

    // ── Table · table ────────────────────────────────────────────────────
    case "CheckboxTablePlayer": {
      // Tiêu đề cột nhãn hàng (ô góc trên bên trái). `rowsLabel` là khoá chuẩn của
      // `checkbox_table`; `statementLabel` được nhận thêm để payload chuyển sang từ
      // `multi_true_false` không phải viết lại (issue #843). Nhãn có thể là chuỗi
      // hoặc RichContent — cả hai đều quy về chuỗi cho `RichTextValue`.
      const rowsLabelRaw = p.rowsLabel ?? p.statementLabel;
      const rowsLabel =
        typeof rowsLabelRaw === "string"
          ? rowsLabelRaw
          : richToText(rowsLabelRaw as RichContent | undefined);
      return (
        <CheckboxTablePlayer
          {...head}
          rowsLabel={rowsLabel || undefined}
          columns={(p.columns as Array<{ id: string; label: string }>) ?? []}
          // A row header may be authored as an image (content image block) — surface
          // `imageUrl` so the player renders it instead of dropping to the raw id.
          rows={((p.rows as Array<Item & { label?: string; imageUrl?: string; image?: { url?: string } }>) ?? []).map((r) => ({
            id: r.id,
            label: richToText(r.content) || r.label || "",
            imageUrl: contentImageUrl(r),
            imageWidth: contentImageWidth(r),
            // Ô nhãn hàng render theo `content` khi nhãn vừa có chữ vừa có ảnh
            // (issue #837) — `label`/`imageUrl` chỉ còn là fallback phẳng.
            content: r.content,
          }))}
          correctCells={(p.correctAnswer as Record<string, string[]>) ?? {}}
        />
      );
    }
    case "TableFillPlayer": {
      // GAP-229 — TUYỆT ĐỐI không dựng lại `table` từ một danh sách khoá cố định
      // như trước: làm thế là xoá sạch `columns`/`headerRows` của bảng v2 mà
      // không báo lỗi gì (span trên từng ô vẫn còn nhờ `...cell`, nhưng cái lưới
      // mà chúng mô tả thì biến mất → bảng trắng). `resolveTableModel` chuẩn hoá
      // cả v1 lẫn v2 về một mô hình, và đã bao gồm hai hành vi cũ:
      //   • `acceptedAnswers` lấy DUY NHẤT từ `correctAnswer["rowId__columnId"]`
      //     (đáp án ghi thẳng trên ô trong JSON bị bỏ qua);
      //   • ô tĩnh giải nhãn qua `tableCellText` và ảnh theo thứ tự
      //     `imageUrl → image.url → khối image đầu tiên trong content.blocks`
      //     — bỏ bước này là tái phát lỗi ảnh mất chú thích (#562).
      const correctAnswer =
        p.correctAnswer && typeof p.correctAnswer === "object" && !Array.isArray(p.correctAnswer)
          ? (p.correctAnswer as Record<string, unknown>)
          : undefined;
      const table = resolveTableModel(p.table, correctAnswer);
      return <TableFillPlayer {...head} table={table} disabled={handlers.disabled} />;
    }
    case "TrueFalseTablePlayer": {
      const cols = p.columns as
        | { situation?: string; statement?: string; trueLabel?: string; falseLabel?: string }
        | undefined;
      // `multi_true_false_table` carries the header labels under `columns` (spec §5.4b),
      // while flat `multi_true_false` payloads author them at the top level (the honest
      // editor writes `q.trueLabel` / `q.falseLabel` there). Accept both, columns first.
      const trueLabel = cols?.trueLabel ?? (p.trueLabel as string | undefined);
      const falseLabel = cols?.falseLabel ?? (p.falseLabel as string | undefined);
      const statementLabel = cols?.statement ?? (p.statementLabel as string | undefined);
      const situationLabel = cols?.situation as string | undefined;
      const caStmt = (p.correctAnswer && typeof p.correctAnswer === "object" && !Array.isArray(p.correctAnswer)
        ? (p.correctAnswer as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      const statements = ((p.statements as Array<Item & { label?: string; situation?: RichContent; imageUrl?: string; image?: { url?: string } }>) ?? []).map((s) => {
        // Phần THÂN của ô — chữ mà `MatchItemBody` sẽ render. Không dùng
        // `itemText`: hàm đó rơi về `s.id` khi nhận định chỉ có ảnh, và ô nhận
        // định giờ hiện CẢ chữ lẫn ảnh (#837) nên chuỗi id sẽ lộ ra thành nhãn
        // rác cạnh tấm ảnh. Cũng KHÔNG rơi về `s.label`: nhãn đã có ô riêng
        // (span tiền tố) — rơi về nó là in nhãn hai lần.
        const bodyText = richToText(s.content) || s.text || "";
        // `label` là tiền tố in trước thân ô ("a)", "b)"…). Ở một số câu nó lại
        // chép NGUYÊN câu nhận định, trùng đúng chữ mà thân ô sắp in (đo trên
        // prod: 4/1198 nhận định). Trước #837 chuyện đó vô hại ở hàng có ảnh vì
        // thân ô chỉ hiện ảnh; nay thân ô hiện chữ, nên giữ nguyên nhãn sẽ in
        // câu đó HAI lần. Bỏ nhãn đúng khi thân ô đã mở đầu bằng chính nó —
        // phủ cả ca trùng-toàn-bộ lẫn ca trùng-mỗi-tiền-tố.
        const labelText = s.label?.trim();
        const dropLabel = !!labelText && bodyText.trim().startsWith(labelText);
        return {
          id: s.id,
          label: dropLabel ? undefined : s.label,
          // Optional 4th column — kept separate from the statement text, not concatenated.
          situation: richToText(s.situation) || undefined,
          situationImageUrl: contentImageUrl({ id: s.id, content: s.situation }),
          situationImageWidth: contentImageWidth({ id: s.id, content: s.situation }),
          situationContent: s.situation,
          text: bodyText || (contentImageUrl(s) || s.label ? "" : s.id),
          imageUrl: contentImageUrl(s),
          imageWidth: contentImageWidth(s),
          // Ô nhận định render theo `content` khi nhận định vừa có chữ vừa có ảnh
          // (issue #837) — `text`/`imageUrl` chỉ còn là fallback phẳng.
          content: s.content,
          correct: Boolean(caStmt[s.id]),
        };
      });
      return (
        <TrueFalseTablePlayer
          {...head}
          statements={statements}
          trueLabel={trueLabel}
          falseLabel={falseLabel}
          statementLabel={statementLabel}
          situationLabel={situationLabel}
        />
      );
    }

    // ── Diagram · diagram ────────────────────────────────────────────────
    case "DiagramFillPlayer": {
      const caNodes = (p.correctAnswer && typeof p.correctAnswer === "object" && !Array.isArray(p.correctAnswer)
        ? (p.correctAnswer as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      const acceptedForNode = (nodeId: string): string[] | undefined => {
        const v = caNodes[nodeId];
        if (v == null) return undefined;
        return Array.isArray(v) ? v.map(String) : [String(v)];
      };
      const acceptedAnswerSets = Array.isArray(p.correctAnswerAlternatives)
        ? (p.correctAnswerAlternatives as unknown[])
            .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate)))
            .map((candidate) => Object.fromEntries(Object.entries(candidate).map(([key, value]) => [key, String(value)])))
        : [];
      const nodes = ((p.nodes as Array<{
        id: string;
        label?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        fillable?: boolean;
        acceptedAnswers?: string[];
      }>) ?? []).map((n) => ({ ...n, acceptedAnswers: acceptedForNode(n.id) }));
      const backgroundImage = mediaUrlOf(p.backgroundImage);
      return (
        <DiagramFillPlayer
          {...head}
          nodes={nodes}
          acceptedAnswerSets={acceptedAnswerSets}
          edges={(p.edges as Array<{ from: string; to: string }>) ?? []}
          backgroundImage={backgroundImage}
          disabled={handlers.disabled}
          // web-own: nút "Tải ảnh bài làm" theo cờ payload, lùi về danh sách (SBT-50).
          answerImageDownload={isAnswerImageDownloadable(p, backgroundImage)}
        />
      );
    }
    case "PathConnectPlayer":
      return (
        <PathConnectPlayer
          {...head}
          nodes={(p.nodes as Array<{ id: string; label: string; x: number; y: number }>) ?? []}
          correctPath={caArr(p)}
        />
      );

    // ── Game · game ──────────────────────────────────────────────────────
    case "MemoryMatchPlayer":
      return (
        <MemoryMatchPlayer
          {...head}
          pairs={
            (p.pairs as Array<{
              id: string;
              a: { text?: string; imageUrl?: string };
              b: { text?: string; imageUrl?: string };
            }>) ?? []
          }
        />
      );
    case "PikachuPlayer":
      return (
        <PikachuPlayer
          {...head}
          tiles={(p.tiles as Array<{ id: string; symbol: string }>) ?? []}
          grid={p.grid as { rows?: number; cols?: number } | undefined}
        />
      );
    case "CardSortPlayer":
      return (
        <CardSortPlayer
          {...head}
          categories={((p.categories as Item[]) ?? []).map((c, i) => ({
            id: c.id,
            label: itemText(c, i, "Nhóm"),
            imageUrl: contentImageUrl(c),
            imageWidth: contentImageWidth(c),
          }))}
          cards={(p.cards as Array<{ id: string; text?: string; imageUrl?: string }>) ?? []}
          correctMappings={caRecord(p, "cardId", "categoryId")}
        />
      );
    case "JigsawPlayer": {
      const grid = p.grid as { rows?: number; cols?: number } | undefined;
      return (
        <JigsawPlayer
          {...head}
          imageUrl={(p.image?.url as string | undefined) ?? (p.imageUrl as string | undefined)}
          rows={Number(grid?.rows ?? p.rows ?? 2)}
          cols={Number(grid?.cols ?? p.cols ?? 2)}
        />
      );
    }
    case "WordSearchPlayer":
      return (
        <WordSearchPlayer
          {...head}
          grid={(p.grid as string[][] | undefined) ?? []}
          words={(p.words as string[] | undefined) ?? []}
        />
      );
    case "CrosswordPlayer": {
      // Alias handling + geometry live in the canonical resolver so the
      // capability diagnostic below counts exactly the entries this player
      // lays out (spec §5.36).
      const crossword = resolveCrosswordConfig(p);
      // Zero entries = every cell paints black and there is no input to type
      // into: the learner sees a "crossword" they cannot answer. Fail loudly
      // instead of rendering the empty grid (issue #810).
      if (crossword.entries.length === 0) {
        return (
          <RendererCapabilityDiagnostic
            code="CROSSWORD_NO_ENTRIES"
            type={requestedType}
            interactionType={resolution.interactionType}
            path={handlers.path}
            scope={handlers.scope ?? "top-level"}
          />
        );
      }
      return <CrosswordPlayer {...head} size={crossword.size} entries={crossword.entries} />;
    }
    case "HangmanPlayer":
      return (
        <HangmanPlayer
          {...head}
          word={(p.answer as string | undefined) ?? ""}
          maxWrong={p.maxWrong as number | undefined}
          hint={p.hint as string | undefined}
        />
      );
    case "SpotDifferencePlayer":
      return (
        <SpotDifferencePlayer
          {...head}
          imageA={(p.imageA as string | undefined) ?? ""}
          imageB={(p.imageB as string | undefined) ?? ""}
          differences={
            (p.differences as Array<{ id: string; x: number; y: number; radius?: number }>) ?? []
          }
        />
      );

    // ── Wrapper · wrapper (host child players) ───────────────────────────
    case "QuestionGroupPlayer": {
      const shared = p.sharedContent as RichContent | string | undefined;
      // Canonical group payloads keep the stem ONLY in sharedContent (content
      // must stay empty — see question-payload.ts / adapter.ts). Extraction
      // data often duplicates the stem into content — and content may hold
      // blocks missing from sharedContent (e.g. an example image). Merge the
      // two at block level so the stem renders once WITHOUT dropping
      // content-only blocks (issue #442). No sharedContent → merge yields
      // undefined and content stays the sole stem source.
      const mergedShared = mergeGroupSharedContent(shared, head.richContent);
      return (
        <QuestionGroupPlayer
          {...head}
          richContent={mergedShared !== undefined ? undefined : head.richContent}
          sharedContent={mergedShared}
          pictureChildren={groupPictureLedChildren(p)}
          children={adaptChildren(p, handlers)}
        />
      );
    }
    case "TimedQuizPlayer":
      return (
        <TimedQuizPlayer
          {...head}
          timeLimitMs={p.timeLimitMs as number | undefined}
          children={adaptChildren(p, handlers)}
        />
      );
    case "LivesStreakPlayer":
      return (
        <LivesStreakPlayer
          {...head}
          lives={p.lives as number | undefined}
          children={adaptChildren(p, handlers)}
        />
      );
    case "BoardGamePlayer":
      return (
        <BoardGamePlayer
          {...head}
          boardLength={p.boardLength as number | undefined}
          children={adaptChildren(p, handlers)}
        />
      );
    case "PathTrailPlayer": {
      const childQ = (p.child ?? p.question) as (Payload & { type: string }) | undefined;
      if (!childQ) {
        return (
          <RendererCapabilityDiagnostic
            code="UNSUPPORTED_LEGACY_CAPABILITY"
            type={requestedType}
            legacyCapability="missing-child"
            path={handlers.path}
            scope={handlers.scope ?? "top-level"}
          />
        );
      }
      return (
        <PathTrailPlayer
          {...head}
          totalSteps={p.totalSteps as number | undefined}
          child={adaptChild(
            childQ,
            childQ.id ?? "trail-child",
            handlers,
            appendDiagnosticPath(handlers.path, "child"),
            true,
          )}
        />
      );
    }

    default:
      return (
        <RendererCapabilityDiagnostic
          code="UNSUPPORTED_LEGACY_CAPABILITY"
          type={requestedType}
          interactionType={resolution.interactionType}
          legacyCapability={entry.component}
          path={handlers.path}
          scope={handlers.scope ?? "top-level"}
        />
      );
  }
}

/**
 * Render a question via the right interaction player, keyed by (type +
 * display.interactionType, with legacy matching layout fallback). Wraps the
 * element in GradeModeContext so the player knows whether to self-grade
 * ("self", default) or only emit and let the parent grade ("parent" — also
 * used for server grading, where `result` comes from the server response).
 */
export function renderInteractionPlayer(
  type: string,
  payload: Payload,
  handlers: PlayerHandlers,
): React.ReactNode {
  const el = renderPlayerElement(type, payload, handlers);
  const content = handlers.disabled ? (
    <fieldset
      disabled
      aria-disabled="true"
      data-player-disabled="true"
      className="contents"
    >
      {el}
    </fieldset>
  ) : el;
  // Chỉ "silent" mới cần lớp bọc có state (giữ verdict để vẽ banner sau khi
  // nộp). Hai chế độ cũ giữ nguyên hình dạng element — dispatch.recursive.test
  // soi thẳng `props.value` của Provider.
  if (handlers.gradeMode === "silent") {
    return <GradeModeScope handlers={handlers}>{content}</GradeModeScope>;
  }
  return (
    <GradeModeContext.Provider
      value={{
        mode: handlers.gradeMode ?? "self",
        result: currentResult(handlers.result),
        hideBanner: handlers.hideResultBanner,
        onSilentVerdict: handlers.onSilentVerdict,
        revealCorrect: handlers.revealCorrect,
      }}
    >
      {content}
    </GradeModeContext.Provider>
  );
}

/**
 * Cấp GradeModeContext, và với chế độ "silent" thì GIỮ verdict player tự chấm
 * để PlayerShell vẽ ResultBanner sau khi nộp.
 *
 * Ánh xạ `silent → parent` ở đây là chủ ý: 41 player đã neo chrome tự chấm vào
 * `mode !== "parent"` và 59 player khoá câu theo `status`, nên đi qua nhánh
 * parent là "silent" hưởng trọn hành vi câm (không nút Kiểm tra, status ở idle
 * nên KHÔNG khoá câu) mà không phải sửa file player nào.
 */
function GradeModeScope({
  handlers,
  children,
}: {
  handlers: PlayerHandlers;
  children: React.ReactNode;
}) {
  const silent = handlers.gradeMode === "silent";
  const [silentVerdict, setSilentVerdict] = React.useState<Verdict | undefined>(
    undefined,
  );
  // Ref: callback của host đổi định danh mỗi lần render, không nên làm
  // `onSilentVerdict` đổi theo rồi kéo cả context memo vỡ.
  const hostVerdict = React.useRef(handlers.onSilentVerdict);
  hostVerdict.current = handlers.onSilentVerdict;

  const onSilentVerdict = React.useCallback((verdict: Verdict) => {
    setSilentVerdict(verdict);
    hostVerdict.current?.(verdict);
  }, []);

  const { gradeMode, result, hideResultBanner, revealCorrect } = handlers;
  const value = React.useMemo(
    () => ({
      mode: gradeMode === "parent" || silent ? ("parent" as const) : ("self" as const),
      result: currentResult(result),
      hideBanner: hideResultBanner,
      onSilentVerdict,
      silent,
      silentVerdict,
      revealCorrect,
    }),
    [
      gradeMode,
      result,
      hideResultBanner,
      revealCorrect,
      onSilentVerdict,
      silent,
      silentVerdict,
    ],
  );

  return (
    <GradeModeContext.Provider value={value}>
      {children}
    </GradeModeContext.Provider>
  );
}

function currentResult(value: PlayerHandlers["result"]): PlayerResult | undefined {
  return value === "correct" || value === "incorrect" || value === "incomplete" ? value : undefined;
}

function nestedValue(value: unknown, id: string, envelope: "answers" | "results"): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const nested = record[envelope];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return (nested as Record<string, unknown>)[id];
  }
  if (id in record) return record[id];
  return undefined;
}

function nestedResult(value: PlayerHandlers["result"], id: string): PlayerResult | undefined {
  return currentResult(nestedValue(value, id, "results") as PlayerHandlers["result"]);
}

function appendDiagnosticPath(parent: string | undefined, child: string): string {
  return parent ? `${parent}.${child}` : child;
}

/** A single child question rendered via the recursive dispatcher. */
function adaptChild(
  q: Payload & { type?: string; question_type?: string },
  id: string,
  handlers: PlayerHandlers,
  path: string,
  singleChild = false,
): {
  id: string;
  type: string;
  render: (ctx: {
    onAnswerChange: (a: unknown) => void;
    submitted?: boolean;
    onStatusChange?: (s: TaskStatus) => void;
  }) => React.ReactNode;
} {
  const type = q.type ?? q.question_type ?? "";
  return {
    id,
    type,
    render: (ctx) =>
      renderInteractionPlayer(type, q, {
        // web-own: câu con cần khoá riêng cho sổ nhớ màu color_fill, không thì
        // hai câu tô màu cùng nhóm ghi đè màu nhau.
        questionId: handlers.questionId !== undefined ? `${handlers.questionId}/${id}` : undefined,
        answer: singleChild
          ? nestedValue(handlers.answer, "answer", "answers")
          : nestedValue(handlers.answer, id, "answers"),
        onAnswerChange: ctx.onAnswerChange,
        submitted: ctx.submitted ?? handlers.submitted,
        disabled: handlers.disabled,
        onStatusChange: ctx.onStatusChange ?? handlers.onStatusChange,
        compact: true,
        gradeMode: handlers.gradeMode,
        hideResultBanner: handlers.hideResultBanner,
        revealCorrect: handlers.revealCorrect,
        result: singleChild
          ? nestedResult(handlers.result, "answer") ?? nestedResult(handlers.result, id)
          : nestedResult(handlers.result, id),
        path,
        scope: "nested",
        instantFeedback: handlers.instantFeedback,
        onElementGraded: handlers.onElementGraded,
        onProgress: handlers.onProgress,
      }),
  };
}

/**
 * Câu con NÀO của nhóm là Ô TRANH (ảnh + nhãn ngắn)? Tính TẠI ĐÂY vì
 * QuestionGroupPlayer nhận con qua render-prop nên không nhìn thấy nội dung.
 *
 * Trả cờ TỪNG CON, không phải một boolean gộp. Bản cũ dùng `.every()` nên MỘT
 * ô chữ phủ quyết cả lưới: ca thật 67251341/bai1 câu 1 có 3 ô tranh (phần a)
 * + 1 ô chữ (phần b) và rơi hết về xếp dọc. Mirror từ studio-web PR #1105.
 */
function groupPictureLedChildren(p: Payload): boolean[] {
  const selected = resolveNestedQuestions(p);
  const list = (selected?.list ?? []) as Array<Payload>;
  if (list.length < 2) return [];
  return list.map((child) =>
    contentIsPictureLed(child.content as { blocks?: ContentBlock[] } | undefined),
  );
}

/** Build child entries for wrapper players from children / subQuestions / questions. */
function adaptChildren(
  p: Payload,
  handlers: PlayerHandlers,
): Array<ReturnType<typeof adaptChild>> {
  const selected = resolveNestedQuestions(p);
  const source = selected?.key ?? "children";
  const list = (selected?.list ?? []) as Array<Payload & { id?: string; type?: string }>;
  return list.map((q, i) => {
    const id = q.id ?? `child-${i}`;
    return adaptChild(q, id, handlers, appendDiagnosticPath(handlers.path, `${source}[${i}]`));
  });
}

/** Adapt payload.anchors[] into the players' MediaAnchor[] (recursive render). */
function adaptAnchors(p: Payload, handlers: PlayerHandlers): Array<{
  id: string;
  time: number;
  render: (ctx: {
    onAnswerChange: (a: unknown) => void;
    submitted?: boolean;
    onStatusChange?: (s: TaskStatus) => void;
  }) => React.ReactNode;
}> {
  const anchors =
    (p.anchors as Array<{ id: string; time: number; question: Payload & { type: string } }>) ?? [];
  return anchors.map((a, index) => ({
    id: a.id,
    time: a.time,
    render: (ctx) =>
      renderInteractionPlayer(a.question.type, a.question, {
        answer: nestedValue(handlers.answer, a.id, "answers"),
        onAnswerChange: ctx.onAnswerChange,
        submitted: ctx.submitted ?? handlers.submitted,
        disabled: handlers.disabled,
        onStatusChange: ctx.onStatusChange ?? handlers.onStatusChange,
        compact: true,
        gradeMode: handlers.gradeMode,
        hideResultBanner: handlers.hideResultBanner,
        revealCorrect: handlers.revealCorrect,
        result: nestedResult(handlers.result, a.id),
        path: appendDiagnosticPath(handlers.path, `anchors[${index}].question`),
        scope: "nested",
        instantFeedback: handlers.instantFeedback,
        onElementGraded: handlers.onElementGraded,
        onProgress: handlers.onProgress,
      }),
  }));
}
