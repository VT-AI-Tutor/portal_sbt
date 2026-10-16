/**
 * Canonical reader for `crossword` payloads (CONTENT_SCHEMA §5.36).
 *
 * One copy of the gates, two consumers: the player dispatcher (`dispatch.tsx`,
 * feeding `CrosswordPlayer`) and the capability diagnostic
 * (`capability-validation.ts`, deciding whether the payload is answerable at
 * all). The alias handling below used to live inline in the dispatcher, so a
 * diagnostic reading `payload.entries.length` would have counted entries the
 * renderer drops — the exact drift `_matching_answer_rules`-style shared gates
 * exist to prevent. Keep both callers on this function.
 *
 * Deliberately NOT normalized here: clue string→block migration. `content`
 * blocks are canonical per §5.36.1 and the conversion belongs at the import
 * boundary, not the read path (GAP-230).
 */
import type { RichContent } from './types';

export interface CrosswordEntry {
  id: string;
  row: number;
  col: number;
  dir: 'across' | 'down';
  length?: number;
  content?: RichContent;
  clue: string;
  answer: string;
  number?: number;
  /** Cells the book prints pre-filled, as indexes into this entry's own run (§5.36.3). */
  given: number[];
  /** The keyword run the book prints on a tinted background (§5.36.6). */
  keyword: boolean;
}

export interface CrosswordConfig {
  /** Entries the renderer can actually lay out; malformed rows are dropped. */
  entries: CrosswordEntry[];
  /** Declared size widened to fit the geometry, never narrower than 1×1. */
  size: { rows: number; cols: number };
  /** Answer letters keyed by entry id, from the top-level `correctAnswer`. */
  answers: Record<string, string>;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function positiveInteger(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

/**
 * §5.36 stores the letters apart from the geometry: entries carry
 * startRow/startCol/direction and NO answer, while `correctAnswer` maps entry id
 * → letters. Both the array-of-records and the plain-record spellings occur.
 */
function readAnswers(value: unknown): Record<string, string> {
  const answers: Record<string, string> = {};
  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const record = raw as Record<string, unknown>;
      const entryId = record.entryId ?? record.id;
      const answer = record.answer ?? record.value;
      if (entryId != null && answer != null) answers[String(entryId)] = String(answer);
    }
  } else if (value && typeof value === 'object') {
    for (const [entryId, answer] of Object.entries(value as Record<string, unknown>)) {
      if (answer != null) answers[entryId] = String(answer);
    }
  }
  return answers;
}

/**
 * An entry is renderable only when it is an object: the player keys its cell map
 * by entry id and reads row/col off it, so a `null` or primitive row would paint
 * nothing (or crash) rather than being "an empty crossword".
 */
function readEntries(value: unknown, answers: Record<string, string>): CrosswordEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: CrosswordEntry[] = [];
  value.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const e = raw as Record<string, unknown>;
    const fallbackId = `entry-${index + 1}`;
    const id = String(e.id ?? fallbackId).trim() || fallbackId;
    const content = e.content as { blocks?: unknown } | undefined;
    entries.push({
      id,
      row: nonNegativeInteger(e.startRow ?? e.row, 0),
      col: nonNegativeInteger(e.startCol ?? e.col, 0),
      dir: e.direction === 'down' || e.dir === 'down' ? 'down' : 'across',
      length: positiveInteger(e.length),
      content: Array.isArray(content?.blocks)
        ? ({ blocks: content.blocks } as RichContent)
        : undefined,
      clue: String(e.clue ?? ''),
      answer: answers[id] ?? String(e.answer ?? ''),
      number: positiveInteger(e.number),
      given: (Array.isArray(e.given) ? e.given : [])
        .map((i) => Number(i))
        .filter((i) => Number.isInteger(i) && i >= 0),
      keyword: (e.display as { role?: string } | undefined)?.role === 'keyword',
    });
  });
  return entries;
}

function resolveSize(
  entries: CrosswordEntry[],
  declared: unknown,
): { rows: number; cols: number } {
  const declaredSize = (declared ?? {}) as { rows?: unknown; cols?: unknown };
  const geometry = entries.reduce(
    (size, entry) => {
      const length = entry.length ?? entry.answer.replace(/\s+/g, '').length;
      const endRow = entry.row + (entry.dir === 'down' ? Math.max(length, 1) - 1 : 0);
      const endCol = entry.col + (entry.dir === 'across' ? Math.max(length, 1) - 1 : 0);
      return {
        rows: Math.max(size.rows, endRow + 1),
        cols: Math.max(size.cols, endCol + 1),
      };
    },
    { rows: 1, cols: 1 },
  );
  return {
    rows: Math.max(positiveInteger(declaredSize.rows) ?? 1, geometry.rows),
    cols: Math.max(positiveInteger(declaredSize.cols) ?? 1, geometry.cols),
  };
}

export function resolveCrosswordConfig(payload: Record<string, unknown>): CrosswordConfig {
  const answers = readAnswers(payload.correctAnswer);
  const entries = readEntries(payload.entries, answers);
  return { entries, size: resolveSize(entries, payload.size), answers };
}
