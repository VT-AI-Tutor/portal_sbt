/**
 * Blank-marker helpers shared by the dispatch adapter and the in-place inline-blank
 * renderer (RichContentBlocks). A "blank marker" is the placeholder text that stands
 * in for an interactive input inside cloze / fill_blank / word_bank prose:
 *   `{blank_1}`  or  `___[blank_1]___`
 */
import type { RichTextRun } from "@/core/question-schema";

/**
 * Marker grammar, as one source shared by all three regexes below (and by
 * `dispatch.parseCloze`) so the split rules and the token rule can never drift.
 *
 * The bracket form is written by hand and by content-generation pipelines, so a
 * miscounted underscore run is a recurring authoring slip — WEB14 shipped
 * `__[blank_12]___` (two leading instead of three), which the old fixed-length
 * `___` matched nowhere, so the raw marker text leaked to the student instead of
 * rendering an input. We therefore accept two-or-more underscores on each side.
 *
 * The canonical three-underscore alternative is listed FIRST on purpose. Regex
 * alternation is ordered, so well-formed prose keeps its exact previous parse; a
 * bare `_{2,}` alone would greedily eat the underscores shared by two adjacent
 * markers (`___[b1]______[b2]___` → one match, second blank lost).
 */
const MARKER_SOURCE = String.raw`\{blank_\w+\}|___\[\w+\]___|_{2,}\[\w+\]_{2,}`;

/** Matches (and captures) a single blank marker anywhere in a string. */
export const BLANK_MARKER_RE = new RegExp(`(${MARKER_SOURCE})`);
/** Global variant for splitting a string into text/marker parts. */
export const BLANK_MARKER_GLOBAL_RE = new RegExp(`(${MARKER_SOURCE})`, "g");
/**
 * Matches a string that is EXACTLY one marker, capturing the blank id. Anchored,
 * so the tolerant underscore run needs no canonical-first alternative here — there
 * is only ever one marker to consume.
 */
export const BLANK_MARKER_TOKEN_RE = /^(?:\{(blank_\w+)\}|_{2,}\[(\w+)\]_{2,})$/;

/** A prose fragment: either a plain string or a list of rich-text runs. */
export type RichClozeText = string | RichTextRun[];

/** If `token` is exactly one blank marker, return its blank id; else undefined. */
export function blankIdFromMarker(token: string): string | undefined {
  const m = token.match(BLANK_MARKER_TOKEN_RE);
  return m?.[1] ?? m?.[2];
}

/** Split a plain string into alternating text / marker parts (empties dropped). */
export function splitTextAroundBlankMarkers(text: string): string[] {
  return text.split(BLANK_MARKER_GLOBAL_RE).filter((part) => part !== undefined && part !== "");
}

/**
 * Split rich runs around blank markers, preserving each run's annotations on the
 * surrounding text. Marker tokens come back as plain strings; prose comes back as
 * single-run arrays so bold/italic/etc. survive.
 */
export function splitRichRunsAroundBlankMarkers(runs: RichTextRun[]): RichClozeText[] {
  const output: RichClozeText[] = [];
  for (const run of runs) {
    const matcher = new RegExp(BLANK_MARKER_GLOBAL_RE.source, "g");
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(run.text)) !== null) {
      const before = run.text.slice(cursor, match.index);
      if (before) output.push([{ ...run, text: before }]);
      output.push(match[0]);
      cursor = match.index + match[0].length;
    }
    const after = run.text.slice(cursor);
    if (after) output.push([{ ...run, text: after }]);
  }
  return output;
}
