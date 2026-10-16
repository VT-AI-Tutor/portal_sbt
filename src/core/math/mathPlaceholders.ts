/**
 * Blanks that sit inside a mathematical formula.
 *
 * The carrier is MathLive's own syntax, `\placeholder[id]{}`. A math field in
 * `read-only` mode locks the whole formula and unlocks only these prompts, so a
 * blank can sit at any structural position — numerator, denominator, exponent,
 * under a radical — which a text-level blank marker cannot express.
 *
 * A `\placeholder{}` with no id is MathLive's authoring cue, not a graded blank;
 * only the id-bearing form counts here.
 */
const PLACEHOLDER_PATTERN = String.raw`\\placeholder\[([^\]]+)\]`;

export function hasMathPlaceholder(latex: string): boolean {
  return new RegExp(PLACEHOLDER_PATTERN).test(latex);
}

export function mathPlaceholderIds(latex: string): string[] {
  const ids: string[] = [];
  for (const match of latex.matchAll(new RegExp(PLACEHOLDER_PATTERN, "g"))) {
    if (!ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}

export function nextMathPlaceholderId(latex: string): string {
  const used = new Set(mathPlaceholderIds(latex));
  for (let index = 1; ; index += 1) {
    const candidate = `blank_${index}`;
    if (!used.has(candidate)) return candidate;
  }
}

export function insertMathPlaceholder(latex: string, id: string): string {
  return `${latex}\\placeholder[${id}]{}`;
}

/**
 * Span of one `\placeholder…{…}`, with its body located by balanced braces so a
 * nested answer such as `\frac{1}{2}` is not cut at the first closing brace.
 *
 * `id` is absent for MathLive's bare authoring cue `\placeholder{}`. Grading
 * ignores those (see {@link scanPlaceholderSpans}); display must not, because a
 * cue left in the saved TeX still reaches the screen — see
 * {@link latexWithoutPlaceholders}.
 */
interface PlaceholderSpan {
  id?: string;
  /** Index of the `\` opening the command. */
  start: number;
  /** Index just past the closing `}`. */
  end: number;
  bodyStart: number;
  bodyEnd: number;
}

/** `\placeholder` not followed by more letters, so `\placeholderFoo` is not a hit. */
const PLACEHOLDER_COMMAND_RE = /\\placeholder(?![a-zA-Z])/g;

/**
 * Every `\placeholder` form MathLive emits, id-bearing or not.
 *
 * The command takes up to TWO optional arguments before its body: the blank id,
 * and — once a blank has been graded — the verdict MathLive serialises next to
 * it (`\placeholder[blank_1][incorrect]{5}`). Both are optional and either may
 * be absent, so they are skipped in a loop rather than by a fixed pattern.
 */
function scanAllPlaceholderSpans(latex: string): PlaceholderSpan[] {
  const spans: PlaceholderSpan[] = [];
  for (const match of latex.matchAll(PLACEHOLDER_COMMAND_RE)) {
    const start = match.index ?? 0;
    let cursor = start + match[0].length;
    let id: string | undefined;
    for (let optional = 0; optional < 2 && latex[cursor] === "["; optional += 1) {
      const close = latex.indexOf("]", cursor);
      if (close === -1) break;
      // An empty `[]` is not an id — grading keys answers by it, and the empty
      // string would collide across blanks.
      if (optional === 0 && close > cursor + 1) id = latex.slice(cursor + 1, close);
      cursor = close + 1;
    }
    if (latex[cursor] !== "{") continue;
    const bodyStart = cursor + 1;
    let depth = 0;
    while (cursor < latex.length) {
      const char = latex[cursor];
      if (char === "\\") {
        cursor += 2;
        continue;
      }
      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
      cursor += 1;
    }
    if (depth !== 0) continue;
    spans.push({ id, start, end: cursor + 1, bodyStart, bodyEnd: cursor });
  }
  return spans;
}

/** Graded blanks only — the id is what keys a pupil's answer, so a cue without one is not a blank. */
function scanPlaceholderSpans(latex: string): Required<PlaceholderSpan>[] {
  return scanAllPlaceholderSpans(latex).filter(
    (span): span is Required<PlaceholderSpan> => span.id !== undefined,
  );
}

/**
 * Drop every `\placeholder…` wrapper so KaTeX can build the formula.
 *
 * `\placeholder` is MathLive's command, not KaTeX's. KaTeX renders an unknown
 * command as its own name in red, so a formula authored in a math field reaches
 * the reader with `\placeholder` mid-expression. A KaTeX macro alone cannot fix
 * it: the optional `[id]`/`[verdict]` arguments are not part of macro expansion
 * and leak out as literal `[blank_1]` text.
 *
 * A blank that already carries an answer shows that answer; an empty one shows
 * `empty` (an upright box by default) so the gap stays visible.
 *
 * Only the OUTERMOST blanks are rewritten here, each recursing into its own
 * answer: replacing an inner blank first would shift every index the outer span
 * was measured with, and the outer rewrite would then cut the formula in the
 * wrong place.
 */
export function latexWithoutPlaceholders(latex: string, empty = String.raw`\square`): string {
  const spans = scanAllPlaceholderSpans(latex);
  const outermost = spans.filter(
    (span) => !spans.some((other) => other.start < span.start && span.end <= other.end),
  );
  let out = latex;
  for (const span of outermost.reverse()) {
    const answer = latex.slice(span.bodyStart, span.bodyEnd);
    const body = latexWithoutPlaceholders(answer, empty).trim();
    out = out.slice(0, span.start) + (body || empty) + out.slice(span.end);
  }
  return out;
}

/** What the pupil has typed into each blank, keyed by blank id. */
export function readMathPlaceholderValues(latex: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const span of scanPlaceholderSpans(latex)) {
    values[span.id] = latex.slice(span.bodyStart, span.bodyEnd);
  }
  return values;
}

/**
 * Write saved answers back into the formula. A blank with no saved answer is
 * emptied rather than left as it was, so restoring a cleared answer really clears it.
 */
export function writeMathPlaceholderValues(
  latex: string,
  values: Record<string, string>,
): string {
  const spans = scanPlaceholderSpans(latex);
  let out = latex;
  for (const span of spans.reverse()) {
    out = out.slice(0, span.bodyStart) + (values[span.id] ?? "") + out.slice(span.bodyEnd);
  }
  return out;
}
