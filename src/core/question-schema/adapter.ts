import { isLayoutBlock } from '@/core/rich-text/content-layout';
import { canonicalizeRichContent, htmlToRichTextRuns, plainTextFromRuns } from '@/core/rich-text/html';
import { normalizeTableBlock, normalizeTableQuestionData } from './table';
import { QUESTION_TYPES } from './question-types.generated';
import { resolveMatchingPayload } from './matching';
import { resolveColoringConfig } from './coloring';
import { resolveNestedQuestions } from './nested-children';
import type {
  BlankInputSpec,
  BlankSpec,
  CorrectAnswer,
  MatchingColumn,
  MatchingItem,
  OrderingItem,
  QuestionLike,
  QuestionTypeV1,
  RenderableQuestion,
  RichContent,
  RichContentBlock,
  RichOption,
  StatementSpec,
} from './types';

function richFromText(text: string, blockType = 'paragraph'): RichContent {
  const trimmed = text.trim();
  return trimmed ? { blocks: [{ type: blockType, content: htmlToRichTextRuns(trimmed) }] } : { blocks: [] };
}

function textFromBlock(block: Record<string, unknown>): string {
  if (Array.isArray(block.content)) {
    return plainTextFromRuns(block.content as never).trim();
  }
  if (typeof block.text === 'string' && block.text.trim()) {
    return block.text.trim();
  }
  if (Array.isArray(block.children)) {
    return block.children
      .map((child) => {
        if (child && typeof child === 'object') {
          const nested = (child as Record<string, unknown>).text;
          return typeof nested === 'string' ? nested : '';
        }
        return typeof child === 'string' ? child : '';
      })
      .join('')
      .trim();
  }
  return '';
}

function normalizeRichBlocks(blocks: RichContentBlock[]): RichContentBlock[] {
  const canonical = canonicalizeRichContent({ blocks }).blocks;
  return canonical.map((block) => String(block.type ?? '') === 'table' ? normalizeTableBlock(block) : block);
}

function richBlockHasContent(block: RichContentBlock): boolean {
  if (isLayoutBlock(block)) {
    return (block.columns ?? []).some((column) =>
      column.some((nested) => richBlockHasContent(nested)),
    );
  }
  if (Array.isArray(block.content) && plainTextFromRuns(block.content).trim()) return true;
  if (block.text?.trim()) return true;
  const type = String(block.type ?? '');
  if (type === 'image' || type === 'audio' || type === 'video') {
    const record = block as RichContentBlock & Record<string, unknown>;
    const mediaUrl =
      (typeof block.url === 'string' && block.url.trim()) ||
      (typeof record.src === 'string' && record.src.trim()) ||
      '';
    return Boolean(mediaUrl);
  }
  if (type === 'list') return (block.items?.length ?? 0) > 0 || (block.itemsRuns?.length ?? 0) > 0;
  if (type === 'table') return (block.rows?.length ?? 0) > 0;
  if (type === 'math') return Boolean(block.latex?.trim() || block.text?.trim());
  if (type === 'code') return Boolean(block.code?.trim() || block.text?.trim());
  if (type === 'diagram') {
    return Boolean(block.url?.trim() || block.svg?.trim() || block.text?.trim());
  }
  return false;
}

export function richContentHasBlocks(content: RichContent): boolean {
  return (content.blocks ?? []).some(richBlockHasContent);
}

function imageBlockFromRecord(image: unknown): RichContentBlock | null {
  if (!image || typeof image !== 'object') return null;
  const record = image as Record<string, unknown>;
  const url =
    (typeof record.url === 'string' && record.url.trim()) ||
    (typeof record.src === 'string' && record.src.trim()) ||
    '';
  if (!url) return null;
  return {
    type: 'image',
    url,
    alt: typeof record.alt === 'string' ? record.alt : typeof record.altText === 'string' ? record.altText : undefined,
  };
}

/**
 * Suffix-tolerant media URL equality: extraction data stores relative asset
 * paths while uploads resolve to absolute `/uploads/...` URLs, so one side is
 * frequently a suffix of the other for the same file.
 */
function mediaUrlsMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

function appendMediaBlockToContent(content: RichContent, block: RichContentBlock | null): RichContent {
  if (!block?.url?.trim()) return content;
  const blocks = content.blocks ?? [];
  const exists = blocks.some(
    (existing) => existing.type === block.type && mediaUrlsMatch(existing.url, block.url),
  );
  if (exists) return content;
  return { blocks: [...blocks, block] };
}

const TEXT_DEDUPE_TYPES = new Set(['paragraph', 'heading', 'quote']);
const MEDIA_DEDUPE_TYPES = new Set(['image', 'audio', 'video', 'diagram']);
const STRUCTURED_DEDUPE_TYPES = new Set(['table', 'list', 'math', 'code']);

function collapsedBlockText(block: RichContentBlock): string {
  return textFromBlock(block as unknown as Record<string, unknown>).replace(/\s+/g, ' ').trim();
}

/** Stable key over the fields that make a structured block meaningful. */
function structuredBlockKey(block: RichContentBlock): string {
  const type = String(block.type ?? '');
  if (type === 'list') {
    // Include itemsRuns (#503) so inline-formatting changes register in the key.
    return JSON.stringify({ ordered: block.ordered ?? false, items: block.items ?? [], itemsRuns: block.itemsRuns ?? [] });
  }
  if (type === 'table') {
    return JSON.stringify({ headers: block.headers ?? [], rows: block.rows ?? [] });
  }
  if (type === 'math') {
    return JSON.stringify({ latex: (block.latex ?? block.text ?? '').trim() });
  }
  // code
  return JSON.stringify({ language: block.language ?? '', code: (block.code ?? block.text ?? '').trim() });
}

/**
 * Whether two blocks carry the same content for question_group dedupe
 * purposes. Symmetric. Unknown block types are never considered duplicates —
 * rendering twice is safer than dropping authored data.
 */
function blocksAreDuplicates(a: RichContentBlock, b: RichContentBlock): boolean {
  const type = String(a.type ?? '');
  if (type !== String(b.type ?? '')) return false;
  if (TEXT_DEDUPE_TYPES.has(type)) {
    const textA = collapsedBlockText(a);
    return textA.length > 0 && textA === collapsedBlockText(b);
  }
  if (MEDIA_DEDUPE_TYPES.has(type)) {
    return mediaUrlsMatch(a.url, b.url);
  }
  if (STRUCTURED_DEDUPE_TYPES.has(type)) {
    return structuredBlockKey(a) === structuredBlockKey(b);
  }
  return false;
}

/** Collapsed text of all text-like blocks joined with single spaces. */
function joinedCollapsedText(blocks: RichContentBlock[]): string {
  return blocks
    .filter((b) => TEXT_DEDUPE_TYPES.has(String(b.type ?? '')))
    .map(collapsedBlockText)
    .filter((text) => text.length > 0)
    .join(' ');
}

/**
 * Word-boundary substring check: `text` already appears verbatim inside
 * `joined`. Space-padding both sides keeps "6" from matching inside "65".
 */
function textCoveredByJoined(text: string, joined: string): boolean {
  if (!text || !joined) return false;
  return ` ${joined} `.includes(` ${text} `);
}

function mergeRichBlocks(shared: RichContent, content: RichContent): RichContent {
  const sharedBlocks = shared.blocks ?? [];
  const contentBlocks = content.blocks ?? [];
  // Backend-fabricated sharedContent may hold ONE paragraph whose text is the
  // CONCATENATION of several content paragraphs (the synced stem, newlines
  // included). Block-for-block equality misses that, so a text block also
  // counts as covered when its collapsed text already appears inside the
  // other side's joined text — otherwise the concatenated paragraph survives
  // the merge and the same text renders twice (once as the group heading).
  const contentJoinedText = joinedCollapsedText(contentBlocks);
  const sharedJoinedText = joinedCollapsedText(sharedBlocks);
  const sharedBlockCovered = (sb: RichContentBlock) =>
    contentBlocks.some((cb) => blocksAreDuplicates(sb, cb)) ||
    (TEXT_DEDUPE_TYPES.has(String(sb.type ?? '')) &&
      textCoveredByJoined(collapsedBlockText(sb), contentJoinedText));
  const contentBlockCovered = (cb: RichContentBlock) =>
    sharedBlocks.some((sb) => blocksAreDuplicates(cb, sb)) ||
    (TEXT_DEDUPE_TYPES.has(String(cb.type ?? '')) &&
      textCoveredByJoined(collapsedBlockText(cb), sharedJoinedText));
  const everySharedDuped = sharedBlocks.every(sharedBlockCovered);
  const everyContentDuped = contentBlocks.every(contentBlockCovered);
  // Fully identical duplicate (extraction copies the stem verbatim into both
  // fields): keep sharedContent as-is.
  if (everySharedDuped && everyContentDuped) return shared;
  // Content is a superset of shared (e.g. a fabricated sharedContent whose
  // text is already present in a fuller content with images): keep content's
  // blocks in content order so the duplicated text renders once and images
  // survive.
  if (everySharedDuped) return content;
  // Shared is a superset of content (content adds nothing new): keep shared
  // as-is.
  if (everyContentDuped) return shared;
  // Partial overlap: shared blocks first, then content blocks whose payload
  // is not already covered by the shared side, in content order.
  const blocks = [...sharedBlocks];
  for (const candidate of contentBlocks) {
    if (!contentBlockCovered(candidate)) {
      blocks.push(candidate);
    }
  }
  return { blocks };
}

/**
 * Block-level merge of a question_group's shared area (issue #442).
 *
 * Group payloads carry the shared passage in `sharedContent`, but extraction
 * data often also fills `content` — sometimes with MORE blocks than
 * sharedContent (e.g. an example image that only exists in content). Instead
 * of letting sharedContent win wholesale, merge the two at block level:
 *
 * - `shared` absent/empty → `undefined` (caller keeps its current
 *   content-only behavior).
 * - `shared` is a string → returned as-is unless `content` has meaningful
 *   blocks, in which case the string becomes a paragraph and is merged.
 * - Both have blocks → dedupe by block content; a full duplicate returns
 *   `shared` unchanged, a content-superset returns `content` (content order),
 *   otherwise shared blocks come first followed by content-only blocks.
 *   Text dedupe is concatenation-aware: a single fabricated paragraph whose
 *   text is the join of several content paragraphs (the synced stem) counts
 *   as covered by them, and vice versa.
 */
export function mergeGroupSharedContent(
  shared: RichContent | string | undefined,
  content: RichContent | undefined,
): RichContent | string | undefined {
  if (shared == null) return undefined;
  if (typeof shared === 'string') {
    if (!shared.trim()) return undefined;
    if (!content || !richContentHasBlocks(content)) return shared;
    return mergeRichBlocks(richFromText(shared), content);
  }
  const sharedBlocks = Array.isArray(shared.blocks) ? shared.blocks : [];
  if (sharedBlocks.length === 0) return undefined;
  if (!content || (content.blocks?.length ?? 0) === 0) return shared;
  return mergeRichBlocks(shared, content);
}

/** Image embedded in schema payload only — not extraction reference URLs on the question row. */
function resolvePayloadImageBlock(payload: Record<string, unknown>): RichContentBlock | null {
  return imageBlockFromRecord(payload.image);
}

function richFromUnknown(value: unknown, fallbackText = ''): RichContent {
  if (value && typeof value === 'object' && Array.isArray((value as RichContent).blocks)) {
    const blocks = normalizeRichBlocks((value as RichContent).blocks as RichContentBlock[]);
    if (richContentHasBlocks({ blocks })) {
      return { blocks };
    }
    return richFromText(fallbackText);
  }
  if (typeof value === 'string') return richFromText(value);
  return richFromText(fallbackText);
}

function plainText(content?: RichContent, fallback = ''): string {
  if (!content?.blocks?.length) return fallback;
  return content.blocks
    .map((block) => {
      const record = block as RichContentBlock & Record<string, unknown>;
      return (
        (Array.isArray(block.content) ? plainTextFromRuns(block.content) : undefined) ??
        block.text ??
        textFromBlock(record) ??
        block.caption ??
        block.alt ??
        block.altText ??
        ''
      );
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeCorrectAnswer(value: unknown): CorrectAnswer | undefined {
  if (value === null) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    typeof value === 'object'
  ) {
    return value as CorrectAnswer;
  }
  return undefined;
}

/**
 * Type aliases from v1.0 payloads. `dispatch.tsx` resolves `free_draw` to
 * `drawing` before picking a player; without the same alias here the adapter
 * fell through to the `essay` fallback, so the pill row and the type presenters
 * labelled a drawing question "Tự luận" while the player rendered a canvas.
 */
export const TYPE_ALIASES: Record<string, QuestionTypeV1> = {
  free_draw: 'drawing',
};

/**
 * Canonical type for label lookups: known types pass through, v1.0 aliases fold
 * to their canonical name, and anything else is returned UNCHANGED (unlike
 * `normalizeType`, which folds the unknown to `essay`). Consumers that only need
 * a label — e.g. the practice runner's type badge — must use this, otherwise a
 * type outside the registry (`short_answer`) would be mislabelled "Tự luận".
 */
export function canonicalQuestionType(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (QUESTION_TYPES.includes(raw as QuestionTypeV1)) return raw;
  return TYPE_ALIASES[raw] ?? raw;
}

export function normalizeType(value: unknown, fallback: QuestionTypeV1 = 'essay'): QuestionTypeV1 {
  const raw = String(value ?? fallback).trim();
  if (QUESTION_TYPES.includes(raw as QuestionTypeV1)) return raw as QuestionTypeV1;
  return TYPE_ALIASES[raw] ?? fallback;
}

function isValidOptionId(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s || s === '?') return false;
  if (/^option_\d+$/i.test(s)) return false;
  return true;
}

function defaultOptionId(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : `option_${index + 1}`;
}

function resolveOptionId(item: Record<string, unknown>, index: number): string {
  for (const field of ['id', 'label', 'key'] as const) {
    if (isValidOptionId(item[field])) return String(item[field]).trim();
  }
  return defaultOptionId(index);
}

function stripLeadingChoiceMarker(content: RichContent, label: string): RichContent {
  const blocks = content.blocks ?? [];
  if (!blocks.length || !label) return content;
  const first = blocks[0];
  const text = Array.isArray(first.content) ? plainTextFromRuns(first.content).trim() : first.text?.trim();
  if (!text) return content;
  const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.?\\s*`, 'i');
  if (!pattern.test(text)) return content;
  const removeCount = text.match(pattern)?.[0].length ?? 0;
  const sourceRuns = htmlToRichTextRuns(first.content ?? first.text ?? text);
  let remaining = removeCount;
  const strippedRuns = sourceRuns.flatMap((run) => {
    if (remaining <= 0) return [run];
    const remove = Math.min(remaining, run.text.length);
    remaining -= remove;
    return run.text.slice(remove) ? [{ ...run, text: run.text.slice(remove) }] : [];
  });
  const nextFirst = { ...first, content: strippedRuns.length ? strippedRuns : sourceRuns };
  delete nextFirst.text;
  return { blocks: [nextFirst, ...blocks.slice(1)] };
}

function normalizeOptions(rawOptions: unknown, correctAnswer?: unknown, correctAnswers?: string[]): RichOption[] {
  if (!Array.isArray(rawOptions)) return [];
  const correctSet = new Set((correctAnswers ?? []).map(String));
  const correctSingle = correctAnswer != null ? String(correctAnswer) : undefined;
  return rawOptions
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => {
      const id = resolveOptionId(item, index);
      let content = richFromUnknown(item.content, String(item.text ?? ''));
      if (/^[A-D]$/i.test(id)) {
        content = stripLeadingChoiceMarker(content, id);
      }
      const isCorrect = correctSingle ? id === correctSingle : correctSet.has(id) || item.is_correct === true;
      return { id, content, isCorrect };
    });
}

const BLANK_INPUT_MODES = new Set(['single_line', 'multiline']);
const BLANK_INPUT_SIZES = new Set(['short', 'medium', 'long', 'full']);

/**
 * Validate a blank's rendering-only `input` config (issue #444). Whitelists
 * the mode/size enums and keeps `rows` only as a positive integer (capped at
 * 10); invalid parts are dropped individually while valid ones are kept.
 * Returns undefined when nothing valid remains so payloads without a usable
 * `input` stay byte-identical after normalization.
 */
export function normalizeBlankInputSpec(raw: unknown): BlankInputSpec | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const spec: BlankInputSpec = {};
  if (typeof rec.mode === 'string' && BLANK_INPUT_MODES.has(rec.mode)) {
    spec.mode = rec.mode as BlankInputSpec['mode'];
  }
  if (typeof rec.size === 'string' && BLANK_INPUT_SIZES.has(rec.size)) {
    spec.size = rec.size as BlankInputSpec['size'];
  }
  if (typeof rec.rows === 'number' && Number.isInteger(rec.rows) && rec.rows >= 1) {
    spec.rows = Math.min(rec.rows, 10);
  }
  return Object.keys(spec).length > 0 ? spec : undefined;
}

function normalizeBlanks(raw: unknown): BlankSpec[] {
  if (!Array.isArray(raw)) return [];
  // Structural only — id/label/caseSensitive. Accepted answers are NOT read from
  // the blank; they are filled from `correctAnswer` by the caller (the single
  // source of truth for fill_blank/cloze answers).
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => {
      const input = normalizeBlankInputSpec(item.input);
      return {
        id: String(item.id ?? `blank_${index + 1}`),
        ...(typeof item.label === 'string' && item.label ? { label: item.label } : {}),
        ...(typeof item.width === 'string' && item.width ? { width: item.width } : {}),
        ...(input ? { input } : {}),
        acceptedAnswers: [],
        caseSensitive: Boolean(item.caseSensitive),
        trimWhitespace: item.trimWhitespace !== false,
      };
    });
}

/**
 * Accepted answers for fill_blank/cloze keyed by blankId — the shape most
 * generated payloads use (`correctAnswer: { blank_1: "…" | ["…", "…"] }`).
 * Mirrors the interactive player's own resolution (`parseCloze`'s `acceptedFor`)
 * so the studio "Đáp án" summary and the student player never disagree on the
 * key. A scalar value becomes a one-item list; an array is kept as-is.
 */
function acceptedAnswersByBlankId(correctAnswer: unknown): Record<string, string[]> {
  if (!correctAnswer || typeof correctAnswer !== 'object' || Array.isArray(correctAnswer)) return {};
  const map: Record<string, string[]> = {};
  for (const [blankId, value] of Object.entries(correctAnswer as Record<string, unknown>)) {
    if (value == null) continue;
    map[blankId] = Array.isArray(value) ? value.map(String) : [String(value)];
  }
  return map;
}

function normalizeStatements(raw: unknown): StatementSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => ({
      id: String(item.id ?? `s${index + 1}`),
      content: richFromUnknown(item.content, String(item.text ?? '')),
      correctAnswer: Boolean(item.correctAnswer),
    }));
}

function normalizeMatchingItems(raw: unknown): MatchingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => ({
      id: String(item.id ?? `item_${index + 1}`),
      content: richFromUnknown(item.content, String(item.text ?? item.label ?? '')),
      x: typeof item.x === 'number' ? item.x : undefined,
      y: typeof item.y === 'number' ? item.y : undefined,
    }));
}

function normalizeOrderingItems(raw: unknown): OrderingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => ({
      id: String(item.id ?? `item_${index + 1}`),
      content: richFromUnknown(item.content, String(item.text ?? '')),
    }));
}

/**
 * Unified `correctAnswer` (spec v2.0) as a `Record<key, value>` — a top-level object wins
 * as-is; otherwise falls back to folding a legacy array of `{keyFields[], valueFields[]}`
 * pairs (matching's `correctPairs`, drag_drop/classification/labeling's `correctMappings`).
 */
function normalizeAnswerRecord(
  raw: unknown,
  legacyArray: unknown,
  keyFields: string[],
  valueFields: string[]
): Record<string, string> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v)])
    );
  }
  if (!Array.isArray(legacyArray)) return {};
  const result: Record<string, string> = {};
  for (const item of legacyArray) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const key = keyFields.map((f) => record[f]).find((v) => v != null);
    const value = valueFields.map((f) => record[f]).find((v) => v != null);
    if (key != null && value != null) result[String(key)] = String(value);
  }
  return result;
}

function fromPayload(payload: Record<string, unknown>, legacy?: QuestionLike): RenderableQuestion {
  const type = normalizeType(payload.type, normalizeType(legacy?.question_type));
  const content = richFromUnknown(payload.content, String(payload.stem ?? legacy?.question_text ?? ''));
  const explanation = richFromUnknown(payload.explanation, legacy?.solution ?? '');

  const question: RenderableQuestion = {
    id: String(payload.id ?? legacy?.id ?? ''),
    type,
    version: Number(payload.version ?? legacy?.schema_version ?? 1),
    difficulty: String(payload.difficulty ?? legacy?.difficulty ?? 'medium'),
    score: Number(payload.score ?? 1),
    tags: Array.isArray(payload.tags) ? payload.tags.map(String) : legacy?.skills ?? [],
    language: String(payload.language ?? 'vi'),
    content: richContentHasBlocks(content) ? content : richFromText(legacy?.question_text ?? ''),
    explanation,
    hint: richFromUnknown(payload.hint),
    metadata: (payload.metadata as Record<string, unknown>) ?? {},
    settings: (payload.settings as RenderableQuestion['settings']) ?? {},
    accessibility: (payload.accessibility as RenderableQuestion['accessibility']) ?? {},
    display: (payload.display as RenderableQuestion['display']) ?? undefined,
    selfAssessment: payload.selfAssessment === true,
    legacyText: legacy?.question_text,
    legacySolution: legacy?.solution ?? undefined,
    legacyAnswer: legacy?.answer ?? undefined,
  };

  if (legacy?.source_page != null) {
    question.metadata = { ...question.metadata, sourcePage: legacy.source_page };
  }

  switch (type) {
    case 'single_choice':
      question.options = normalizeOptions(payload.options, payload.correctAnswer);
      question.correctAnswer = normalizeCorrectAnswer(payload.correctAnswer) ?? legacy?.answer ?? undefined;
      break;
    case 'multiple_choice': {
      const correctAnswerList = Array.isArray(payload.correctAnswer)
        ? payload.correctAnswer.map(String)
        : Array.isArray(payload.correctAnswers)
          ? payload.correctAnswers.map(String)
          : legacy?.answer?.split(',').map((v) => v.trim()).filter(Boolean) ?? [];
      question.options = normalizeOptions(payload.options, undefined, correctAnswerList);
      question.correctAnswer = correctAnswerList;
      break;
    }
    case 'true_false':
      question.correctAnswer =
        typeof payload.correctAnswer === 'boolean'
          ? payload.correctAnswer
          : legacy?.answer === 'A' || legacy?.answer?.toLowerCase() === 'true' || legacy?.answer === 'Đúng';
      break;
    case 'multi_true_false': {
      question.statements = normalizeStatements(payload.statements);
      // Spec v2.0 keys the answer via question-level `correctAnswer: Record<statementId, boolean>`;
      // prefer that when present, else fold it from each statement's legacy `correctAnswer` flag.
      const foldedFromStatements = question.statements.length
        ? Object.fromEntries(question.statements.map((s) => [s.id, Boolean(s.correctAnswer)]))
        : undefined;
      question.correctAnswer = normalizeCorrectAnswer(payload.correctAnswer) ?? foldedFromStatements;
      break;
    }
    case 'fill_blank':
    case 'cloze': {
      // Accepted answers live ONLY in `correctAnswer` keyed by blankId
      // (`{ blank_1: [...] }`) — the single source of truth the interactive player
      // reads (parseCloze). blanks[] supplies structure (id/label/caseSensitive)
      // only; each blank's answers are filled from the map for the studio summary.
      const caMap = acceptedAnswersByBlankId(payload.correctAnswer);
      question.blanks = normalizeBlanks(payload.blanks).map((blank) => ({
        ...blank,
        acceptedAnswers: caMap[blank.id] ?? [],
      }));
      // No blanks[] array at all: synthesize from the answer key. Prefer the
      // per-blank map (`{ blank_1: … }`); fall back to a scalar correctAnswer.
      if (!question.blanks.length) {
        const blankIds = Object.keys(caMap);
        if (blankIds.length) {
          question.blanks = blankIds.map((id) => ({
            id,
            acceptedAnswers: caMap[id],
            caseSensitive: false,
            trimWhitespace: true,
          }));
        } else if (payload.correctAnswer != null && typeof payload.correctAnswer !== 'object') {
          question.blanks = [{
            id: 'blank_1',
            acceptedAnswers: [String(payload.correctAnswer)],
            caseSensitive: false,
            trimWhitespace: true,
          }];
        }
      }
      break;
    }
    case 'numeric_answer':
      question.correctAnswer = normalizeCorrectAnswer(payload.correctAnswer);
      question.tolerance = payload.tolerance as number | undefined;
      break;
    case 'essay':
      question.minWords = payload.minWords as number | undefined;
      question.maxWords = payload.maxWords as number | undefined;
      question.manualGrading = payload.manualGrading as boolean | undefined;
      question.allowAttachments = payload.allowAttachments as boolean | undefined;
      question.rubric = payload.rubric as RenderableQuestion['rubric'];
      break;
    case 'matching': {
      const matching = resolveMatchingPayload(payload);
      question.leftItems = normalizeMatchingItems(matching.leftItems);
      question.middleItems = normalizeMatchingItems(matching.middleItems);
      question.rightItems = normalizeMatchingItems(matching.rightItems);
      question.correctAnswer = matching.correctEdges;
      question.columns = matching.columns.map(
        (column): MatchingColumn => ({
          id: column.id,
          title: column.title || undefined,
          titleContent: column.titleContent
            ? canonicalizeRichContent(column.titleContent)
            : undefined,
          items: normalizeMatchingItems(column.items),
        }),
      );
      question.leftTitle = matching.leftTitle || undefined;
      question.middleTitle = matching.middleTitle || undefined;
      question.rightTitle = matching.rightTitle || undefined;
      question.leftTitleContent = matching.leftTitleContent;
      question.middleTitleContent = matching.middleTitleContent;
      question.rightTitleContent = matching.rightTitleContent;
      break;
    }
    case 'ordering':
      question.items = normalizeOrderingItems(payload.items);
      question.correctAnswer = Array.isArray(payload.correctAnswer)
        ? payload.correctAnswer.map(String)
        : Array.isArray(payload.correctOrder)
          ? payload.correctOrder.map(String)
          : [];
      break;
    case 'drag_drop':
      question.mode = String(payload.mode ?? 'many_to_one');
      question.draggables = normalizeOrderingItems(payload.draggables).map(({ id, content }) => ({ id, content }));
      question.dropZones = Array.isArray(payload.dropZones)
        ? payload.dropZones.map((zone, index) => {
            const z = zone as Record<string, unknown>;
            return {
              id: String(z.id ?? `zone_${index + 1}`),
              label: z.label ? String(z.label) : undefined,
              content: richFromUnknown(z.content, String(z.label ?? '')),
            };
          })
        : [];
      question.correctAnswer = normalizeAnswerRecord(
        payload.correctAnswer,
        payload.correctMappings,
        ['draggableId', 'itemId'],
        ['dropZoneId', 'targetId']
      );
      break;
    case 'classification':
      question.categories = normalizeOrderingItems(payload.categories).map(({ id, content }) => ({ id, content }));
      question.items = normalizeOrderingItems(payload.items);
      // image_color variant (spec §5.12.1) — background image the regions overlay.
      question.image = payload.image as RenderableQuestion['image'];
      question.correctAnswer = normalizeAnswerRecord(
        payload.correctAnswer,
        payload.correctMappings,
        ['itemId'],
        ['categoryId', 'targetId']
      );
      break;
    case 'hotspot':
      question.image = payload.image as RenderableQuestion['image'];
      question.hotspots = Array.isArray(payload.hotspots) ? payload.hotspots : [];
      question.correctAnswer = normalizeCorrectAnswer(payload.correctAnswer);
      break;
    case 'labeling':
      question.image = payload.image as RenderableQuestion['image'];
      question.labels = normalizeOrderingItems(payload.labels).map(({ id, content }) => ({ id, content }));
      question.targets = normalizeOrderingItems(payload.targets).map(({ id, content }) => ({ id, content }));
      question.correctAnswer = normalizeAnswerRecord(
        payload.correctAnswer,
        payload.correctMappings,
        ['labelId', 'itemId'],
        ['targetId']
      );
      break;
    case 'connect_points':
      question.points = Array.isArray(payload.points) ? payload.points : [];
      question.correctAnswer = Array.isArray(payload.correctAnswer)
        ? payload.correctAnswer
        : Array.isArray(payload.correctConnections)
          ? payload.correctConnections
          : [];
      break;
    case 'table_completion': {
      // Cùng một bản đồ đáp án cho cả hai: `table` cần nó để gắn
      // `acceptedAnswers` vào ô nhập được, giống hệt trình hiển thị.
      const tableAnswers =
        payload.correctAnswer && typeof payload.correctAnswer === 'object'
          ? (payload.correctAnswer as Record<string, unknown>)
          : (payload.tableCorrectAnswers as Record<string, unknown> | undefined) ??
            (payload.correctAnswers as Record<string, unknown> | undefined) ??
            {};
      question.table = normalizeTableQuestionData(payload.table, tableAnswers);
      question.correctAnswer = tableAnswers;
      break;
    }
    case 'speaking':
      question.maxDuration = payload.maxDuration as number | undefined;
      question.allowRetake = payload.allowRetake as boolean | undefined;
      break;
    case 'dictation':
      question.correctAnswer = String(
        payload.correctAnswer ?? payload.acceptedTranscript ?? legacy?.answer ?? ''
      );
      break;
    case 'upload_answer':
      question.allowedFileTypes = Array.isArray(payload.allowedFileTypes) ? payload.allowedFileTypes.map(String) : [];
      question.maxFileSizeMB = payload.maxFileSizeMB as number | undefined;
      break;
    case 'coloring': {
      // Same resolver the player dispatcher uses, so the render model and the
      // rendered player can never disagree about which regions are fillable.
      const coloring = resolveColoringConfig(payload);
      question.image = payload.image as RenderableQuestion['image'];
      question.imageUrl = coloring.imageUrl;
      question.regions = coloring.regions;
      question.colors = coloring.colors ?? [];
      // coloring is manual-graded (CONTENT_SCHEMA §5.26/§6.2): correctAnswer is
      // intentionally not promoted into the render model.
      break;
    }
    case 'math_expression':
      question.correctAnswer = Array.isArray(payload.correctAnswer)
        ? payload.correctAnswer.map(String)
        : Array.isArray(payload.acceptedAnswers)
        ? payload.acceptedAnswers.map(String)
        : legacy?.answer
          ? [legacy.answer]
          : [];
      question.gradingMode = String(payload.gradingMode ?? 'symbolic');
      break;
    case 'question_group': {
      // Merge sharedContent and content at block level so blocks that only
      // exist in content (e.g. example images) survive while duplicated text
      // renders once (issue #442). No sharedContent → fall back to content.
      const mergedShared = mergeGroupSharedContent(
        payload.sharedContent as RichContent | string | undefined,
        payload.content as RichContent | undefined,
      );
      let shared = richFromUnknown(
        mergedShared ?? payload.content,
        String(payload.stem ?? legacy?.question_text ?? ''),
      );
      const imageBlock = resolvePayloadImageBlock(payload);
      if (imageBlock) {
        shared = appendMediaBlockToContent(shared, imageBlock);
      }
      question.sharedContent = shared;
      question.content = { blocks: [] };
      // Children are authored under three different keys in the wild; the shared
      // resolver keeps the priority order identical to the interactive dispatcher.
      const nested = resolveNestedQuestions(payload)?.list ?? [];
      question.nestedQuestions = nested.map((child, index) =>
        fromPayload({
          ...(child as Record<string, unknown>),
          id: (child as Record<string, unknown>).id ?? `${question.id}_${index + 1}`,
        })
      );
      break;
    }
    // Record/string-array/number-keyed types (spec §9.1) already store the
    // answer key at `payload.correctAnswer`; pass it through unchanged.
    case 'multi_true_false_table':
    case 'checkbox_table':
    case 'diagram_fill':
    case 'card_sort':
    case 'crossword':
    case 'highlight':
    case 'path_connect':
    case 'point_marking':
    case 'scale':
      question.correctAnswer = normalizeCorrectAnswer(payload.correctAnswer);
      break;
    case 'mind_map_completion': {
      // No question-level correctAnswer field in the spec for this type — derive a
      // Record<nodeId, acceptedAnswers> from each node's own `acceptedAnswers`.
      const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
      const derived: Record<string, unknown> = {};
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const record = node as Record<string, unknown>;
        if (record.id != null && record.acceptedAnswers != null) {
          derived[String(record.id)] = record.acceptedAnswers;
        }
      }
      question.correctAnswer = Object.keys(derived).length
        ? derived
        : normalizeCorrectAnswer(payload.correctAnswer);
      break;
    }
    default:
      break;
  }

  if (type === 'question_group') {
    if (!richContentHasBlocks(question.sharedContent ?? { blocks: [] }) && question.legacyText) {
      question.sharedContent = richFromText(question.legacyText);
    }
  } else if (!richContentHasBlocks(question.content ?? { blocks: [] }) && question.legacyText) {
    question.content = richFromText(question.legacyText);
  }

  return question;
}

function fromLegacyQuestion(input: QuestionLike): RenderableQuestion {
  const type = normalizeType(input.question_type);
  const content = richFromText(input.question_text ?? '');
  const explanation = richFromText(input.solution ?? '');

  const base: RenderableQuestion = {
    id: input.id,
    type,
    version: input.schema_version ?? 1,
    difficulty: input.difficulty,
    tags: input.skills ?? [],
    language: 'vi',
    content,
    explanation,
    legacyText: input.question_text,
    legacySolution: input.solution ?? undefined,
    legacyAnswer: input.answer ?? undefined,
    metadata: input.source_page != null ? { sourcePage: input.source_page } : {},
  };

  if (type === 'single_choice' || type === 'multiple_choice' || type === 'true_false') {
    base.options = normalizeOptions(
      (input.options ?? []).map((opt) => ({
        id: opt.label,
        text: opt.text,
        is_correct: opt.is_correct,
        content: richFromText(opt.text),
      })),
      type === 'single_choice' ? input.answer : undefined,
      type === 'multiple_choice' ? input.answer?.split(',').map((v) => v.trim()) : undefined
    );
    if (type === 'single_choice') base.correctAnswer = input.answer ?? undefined;
    if (type === 'multiple_choice') base.correctAnswer = input.answer?.split(',').map((v) => v.trim()).filter(Boolean);
    if (type === 'true_false') {
      base.correctAnswer = input.answer === 'A' || input.answer?.toLowerCase() === 'true';
    }
  }

  if (type === 'fill_blank' || type === 'cloze') {
    base.blanks = input.answer
      ? [{ id: 'blank_1', acceptedAnswers: input.answer.split(',').map((v) => v.trim()).filter(Boolean) }]
      : [];
  }

  if (type === 'essay') {
    base.manualGrading = true;
  }

  // Legacy flat `matching` rows never carried a machine-readable pair list, only free text —
  // nothing to synthesize a `correctAnswer` record from.

  if (type === 'numeric_answer' && input.answer) {
    base.correctAnswer = Number.isNaN(Number(input.answer)) ? input.answer : Number(input.answer);
  }

  if (type === 'math_expression' && input.answer) {
    base.correctAnswer = [input.answer];
  }

  if (type === 'dictation' && input.answer) {
    base.correctAnswer = input.answer;
  }

  if (type === 'question_group') {
    base.sharedContent = content;
    base.content = { blocks: [] };
  }

  return base;
}

export function toRenderableQuestion(input: QuestionLike): RenderableQuestion {
  if (input.payload && typeof input.payload === 'object') {
    return fromPayload(input.payload, input);
  }
  return fromLegacyQuestion(input);
}

export function legacyQuestionToPayload(input: QuestionLike): Record<string, unknown> {
  return fromLegacyQuestion({ ...input, payload: null }) as unknown as Record<string, unknown>;
}

export function getQuestionPreviewText(input: QuestionLike): string {
  const rendered = toRenderableQuestion(input);
  if (rendered.type === 'question_group') {
    return plainText(rendered.sharedContent, rendered.legacyText ?? '');
  }
  return plainText(rendered.content, rendered.legacyText ?? '');
}

/** Preview text for raw extraction questions (schema fields at top level, not in payload). */
export function getExtractedQuestionPreviewText(question: Record<string, unknown>): string {
  const metadata = question.metadata as Record<string, unknown> | undefined;
  const sourcePage = question.source_page ?? metadata?.sourcePage;
  const cachedStem = typeof question.stem === 'string' ? question.stem.trim() : '';
  if (cachedStem) return cachedStem;
  const preview = getQuestionPreviewText({
    payload: question,
    source_page: typeof sourcePage === 'number' ? sourcePage : undefined,
    question_text: typeof question.stem === 'string' ? question.stem : undefined,
  }).trim();
  return preview;
}
