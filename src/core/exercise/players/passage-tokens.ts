/**
 * passage-tokens.ts — one word-indexing rule for the `highlight` passage,
 * shared by the player (SelectWordsPlayer) and the authoring editor
 * (question-editor/honest/types/highlight.tsx).
 *
 * `highlight` + interactionType `tokens` grades by WORD INDEX, so the editor and
 * the player must split a passage into words identically or an answer key drifts
 * silently. Two copies of the regex is how that drift starts; this module is the
 * single copy.
 *
 * Three concerns stay on three separate layers, and that separation is the whole
 * point of the shape below:
 *
 *  - alignment lives on the BLOCK (`PassageBlock.align`) — applied once per
 *    paragraph at render time, so a source line can sit on the right;
 *  - inline formatting lives on the RUNS (`PassageBlock.runs`) — sliced per word
 *    via `sliceRuns` so a word straddling two runs still renders both marks;
 *  - grading reads only PLAIN TEXT (`PassageBlock.text` / `passagePlainText`) —
 *    which carries no markup at all, so changing alignment or turning a word bold
 *    can never move a word index.
 */
import type { RichContent, RichContentBlock, RichTextRun } from '@/core/question-schema';
import { htmlToRichTextRuns, plainTextFromRuns, type RichTextAlign } from '@/core/rich-text/html';
import { flattenNestedContentBlocks } from '@/core/rich-text/nested-blocks';

/** Words are runs of letters/digits (incl. Vietnamese diacritics & apostrophes). */
const WORD_SOURCE = "[\\p{L}\\p{N}]+(?:['’-][\\p{L}\\p{N}]+)*";

export interface PassageToken {
  text: string;
  /** Word index across the WHOLE passage, or null for whitespace/punctuation. */
  wordIndex: number | null;
  /** Char offsets inside the OWNING block's plain text — feed them to `sliceRuns`. */
  start: number;
  end: number;
}

export interface PassageBlock {
  /** Absent means left; mirrors how `rich-text/html` stores paragraph alignment. */
  align?: RichTextAlign;
  /** Plain text of this block — the string word indices are counted on. */
  text: string;
  runs: RichTextRun[];
  tokens: PassageToken[];
}

/** Block types that carry a line of passage text. Media blocks hold no words. */
const TEXT_BLOCK_TYPES = new Set(['paragraph', 'heading', 'quote']);

interface PassageLine {
  align?: RichTextAlign;
  runs: RichTextRun[];
}

/**
 * The lines a passage is made of, in reading order.
 *
 * A `list` becomes one line per item rather than being skipped: the passage
 * toolbar does not offer lists, but a paste from Word or the web can still carry
 * one, and dropping the block would delete those words from the plain text
 * grading reads — with the author still seeing them in the editor. Losing the
 * bullet glyph is a visible downgrade; losing the words is a silent one.
 */
function passageLines(blocks: RichContentBlock[]): PassageLine[] {
  const lines: PassageLine[] = [];
  for (const block of blocks) {
    if (TEXT_BLOCK_TYPES.has(block.type)) {
      const align = blockAlign(block);
      lines.push({ ...(align ? { align } : {}), runs: blockRuns(block) });
      continue;
    }
    if (block.type !== 'list') continue;
    const itemsRuns = Array.isArray(block.itemsRuns) ? block.itemsRuns : undefined;
    const items = Array.isArray(block.items) ? block.items : [];
    const count = itemsRuns?.length ?? items.length;
    for (let i = 0; i < count; i += 1) {
      lines.push({ runs: itemsRuns?.[i] ?? htmlToRichTextRuns(items[i] ?? '') });
    }
  }
  return lines;
}

function tokenizeFrom(text: string, firstWordIndex: number): PassageToken[] {
  const tokens: PassageToken[] = [];
  const re = new RegExp(WORD_SOURCE, 'gu');
  let last = 0;
  let wordIndex = firstWordIndex;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ text: text.slice(last, match.index), wordIndex: null, start: last, end: match.index });
    }
    const end = match.index + match[0].length;
    tokens.push({ text: match[0], wordIndex: wordIndex++, start: match.index, end });
    last = end;
  }
  if (last < text.length) {
    tokens.push({ text: text.slice(last), wordIndex: null, start: last, end: text.length });
  }
  return tokens;
}

/** Split one plain passage into word tokens + the gaps between them. */
export function tokenizePassage(passage: string): PassageToken[] {
  return tokenizeFrom(passage, 0);
}

function blockRuns(block: RichContentBlock): RichTextRun[] {
  // Canonical runs win; legacy blocks carry inline HTML in `text`, which must be
  // parsed rather than tokenized — otherwise `<strong>` counts as the word "strong".
  if (Array.isArray(block.content)) return block.content;
  return htmlToRichTextRuns(block.text ?? '');
}

function blockAlign(block: RichContentBlock): RichTextAlign | undefined {
  // `left` is the default and is never stored (see `parseTextAlign` in rich-text/html).
  const align = block.align;
  return align === 'center' || align === 'right' || align === 'justify' ? align : undefined;
}

/**
 * Read a passage as blocks, numbering words straight through block boundaries so
 * an answer key stays valid when the author splits or joins paragraphs.
 * `passage` is the legacy plain string: questions authored before rich passages
 * have no `content`, and they lift into a single unaligned block with the same
 * word indices they always had.
 */
export function passageBlocksFrom(
  content: RichContent | null | undefined,
  passage: string | null | undefined,
): PassageBlock[] {
  let lines = passageLines(flattenNestedContentBlocks(content?.blocks));

  if (lines.length === 0) {
    const text = passage ?? '';
    if (!text) return [{ text, runs: [], tokens: [] }];
    // A legacy passage keeps its line breaks as "\n" inside one string, and a
    // block renders its runs as HTML — where "\n" is not a line break. Lifting
    // the whole string into ONE block therefore welded the source line onto the
    // end of the body text. One line per block is the shape the rich path
    // already produces, and word numbering runs straight through the boundary,
    // so every existing answer key still points at the same word.
    lines = text.split('\n').map((line) => ({ runs: [{ text: line, annotations: {} }] }));
  }

  let nextWordIndex = 0;
  return lines.map((line) => {
    const text = plainTextFromRuns(line.runs);
    const tokens = tokenizeFrom(text, nextWordIndex);
    nextWordIndex += tokens.filter((token) => token.wordIndex !== null).length;
    return { ...(line.align ? { align: line.align } : {}), text, runs: line.runs, tokens };
  });
}

/**
 * Block types a passage carries but cannot turn into words — an image or table
 * pasted in from a book scan, say. The player draws a passage as a flow of
 * clickable words and has nowhere to put them, so they would sit in the editor
 * visible to the author and invisible to the learner. Naming them here, next to
 * the rule that decides what IS a line, keeps the editor's warning from drifting
 * away from what the player actually renders.
 */
export function unrenderablePassageBlocks(content: RichContent | null | undefined): string[] {
  return flattenNestedContentBlocks(content?.blocks)
    .filter((block) => !TEXT_BLOCK_TYPES.has(block.type) && block.type !== 'list')
    .map((block) => block.type);
}

/**
 * Project a rich passage down to the plain string grading indexes into.
 * Derived from `passageBlocksFrom`, not from a second walk of the blocks, so the
 * projection and the tokenization can never disagree about where a word starts.
 */
export function passagePlainText(
  content: RichContent | null | undefined,
  passage?: string | null,
): string {
  return passageBlocksFrom(content, passage)
    .map((block) => block.text)
    .join('\n');
}

/**
 * Cut `[start, end)` out of a block's runs, keeping each piece's own marks.
 * A word can straddle two runs (the author bolded half of it), and the caller
 * renders those pieces inside ONE clickable word — the split is visual only.
 */
export function sliceRuns(runs: RichTextRun[], start: number, end: number): RichTextRun[] {
  const pieces: RichTextRun[] = [];
  let position = 0;
  for (const run of runs) {
    const runStart = position;
    const runEnd = position + run.text.length;
    position = runEnd;
    if (runEnd <= start || runStart >= end) continue;
    const text = run.text.slice(Math.max(start, runStart) - runStart, Math.min(end, runEnd) - runStart);
    if (text) pieces.push({ text, annotations: run.annotations });
  }
  return pieces;
}
