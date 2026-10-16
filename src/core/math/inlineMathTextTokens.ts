interface VulgarFraction {
  numerator: number;
  denominator: number;
}

const VULGAR_FRACTIONS: Record<string, VulgarFraction> = {
  "¼": { numerator: 1, denominator: 4 },
  "½": { numerator: 1, denominator: 2 },
  "¾": { numerator: 3, denominator: 4 },
  "⅐": { numerator: 1, denominator: 7 },
  "⅑": { numerator: 1, denominator: 9 },
  "⅒": { numerator: 1, denominator: 10 },
  "⅓": { numerator: 1, denominator: 3 },
  "⅔": { numerator: 2, denominator: 3 },
  "⅕": { numerator: 1, denominator: 5 },
  "⅖": { numerator: 2, denominator: 5 },
  "⅗": { numerator: 3, denominator: 5 },
  "⅘": { numerator: 4, denominator: 5 },
  "⅙": { numerator: 1, denominator: 6 },
  "⅚": { numerator: 5, denominator: 6 },
  "⅛": { numerator: 1, denominator: 8 },
  "⅜": { numerator: 3, denominator: 8 },
  "⅝": { numerator: 5, denominator: 8 },
  "⅞": { numerator: 7, denominator: 8 },
};

const VULGAR_FRACTION_RE = /[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g;

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

const SUBSCRIPT_DIGITS: Record<string, string> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
};

const ASCII_TO_SUPERSCRIPT: Record<string, string> = Object.fromEntries(
  Object.entries(SUPERSCRIPT_DIGITS).map(([unicode, ascii]) => [ascii, unicode]),
);

const ASCII_TO_SUBSCRIPT: Record<string, string> = Object.fromEntries(
  Object.entries(SUBSCRIPT_DIGITS).map(([unicode, ascii]) => [ascii, unicode]),
);

const COMPOSED_FRACTION_RE =
  /[⁰¹²³⁴⁵⁶⁷⁸⁹]+\s*[⁄/]\s*[₀₁₂₃₄₅₆₇₈₉]+/g;

const ASCII_FRACTION_RE = /\d+\s*\/\s*\d+/g;

const FRACTION_ENTITY_NAMES: Record<string, string> = {
  frac14: "¼",
  frac12: "½",
  frac34: "¾",
  frac17: "⅐",
  frac19: "⅑",
  frac110: "⅒",
  frac13: "⅓",
  frac23: "⅔",
  frac15: "⅕",
  frac25: "⅖",
  frac35: "⅗",
  frac45: "⅘",
  frac16: "⅙",
  frac56: "⅚",
  frac18: "⅛",
  frac38: "⅜",
  frac58: "⅝",
  frac78: "⅞",
};

const FRACTION_ENTITY_RE = /&(?:frac\d+|#(?:x[0-9a-f]+|\d+));/gi;

/**
 * Authored TeX delimiters, in the four standard forms that MathJax, KaTeX,
 * Pandoc and Jupyter all recognise:
 *
 *   group 1 — `\( … \)` inline        group 3 — `$$ … $$` display
 *   group 2 — `\[ … \]` display       group 4 — `$ … $`  inline
 *
 * `$ … $` is the delimiter LLMs and textbooks reach for by default, so authored
 * maths carried that way must render. To keep it apart from currency prose such
 * as "giá 5$ và 10$", the single-`$` alternative uses the Pandoc rule: the
 * opening `$` needs a non-space char to its right, the closing `$` a non-space
 * char to its left and no digit to its right, and neither may be escaped (`\$`)
 * — so a trailing-dollar price never opens a span. `$$` is matched before `$`
 * so a display pair is never split into two inline ones.
 *
 * Every body is lazy and non-empty, so `\(\)` / `$$` stay literal text and two
 * formulas on one line do not merge into a single span. Both display forms are
 * still rendered inline by the token consumer (a block <div> cannot nest in the
 * surrounding <p>).
 */
const LATEX_DELIMITED_RE =
  /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|(?<![\\$])\$(?=\S)([^$]+?)(?<=[^\s\\])\$(?!\d)/g;

export type InlineMathTextToken =
  | { kind: "text"; value: string }
  | { kind: "latex"; latex: string }
  | ({ kind: "fraction" } & VulgarFraction);

function unicodeDigitsToAscii(
  value: string,
  digitMap: Record<string, string>,
): string {
  return Array.from(value, (digit) => digitMap[digit] ?? "").join("");
}

function decodeFractionEntity(entity: string): string {
  const body = entity.slice(1, -1).toLowerCase();
  const named = FRACTION_ENTITY_NAMES[body];
  if (named) return named;

  if (!body.startsWith("#")) return entity;
  const hexadecimal = body.startsWith("#x");
  const digits = body.slice(hexadecimal ? 2 : 1);
  const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
  if (!Number.isFinite(codePoint)) return entity;

  const character = String.fromCodePoint(codePoint);
  return VULGAR_FRACTIONS[character] ? character : entity;
}

function normalizeFractionEntities(value: string): string {
  return value.replace(FRACTION_ENTITY_RE, decodeFractionEntity);
}

/** Convert an authored `<sup>n</sup>/<sub>d</sub>` pair to plain Unicode text. */
export function composeUnicodeFraction(
  numerator: string,
  denominator: string,
): string {
  const superscript = Array.from(
    numerator,
    (digit) => ASCII_TO_SUPERSCRIPT[digit] ?? digit,
  ).join("");
  const subscript = Array.from(
    denominator,
    (digit) => ASCII_TO_SUBSCRIPT[digit] ?? digit,
  ).join("");
  return `${superscript}⁄${subscript}`;
}

/**
 * Convert fractions only when the author explicitly formats the selection.
 * This avoids guessing that dates, paths, versions, or ratios are maths while
 * still giving every rich-text field a canonical upright representation.
 */
export function convertAsciiFractionsToUnicode(value: string): string {
  return value.replace(ASCII_FRACTION_RE, (match, offset: number, source: string) => {
    const before = source[offset - 1] ?? "";
    const after = source[offset + match.length] ?? "";
    if (/[\d/.]/.test(before) || /[\d/.]/.test(after)) return match;

    const [numerator, denominator] = match.split("/").map((part) => part.trim());
    if (!numerator || !denominator || Number(denominator) === 0) return match;
    return composeUnicodeFraction(numerator, denominator);
  });
}

/**
 * Convert only unambiguous Unicode vulgar-fraction code points and explicitly
 * delimited TeX. Plain slash text such as `1/5/2026` deliberately remains text
 * instead of being guessed as mathematics.
 */
export function tokenizeInlineMathText(value: string): InlineMathTextToken[] {
  const normalizedValue = normalizeFractionEntities(value);
  const tokens: InlineMathTextToken[] = [];
  let lastIndex = 0;

  const matches = [
    ...normalizedValue.matchAll(LATEX_DELIMITED_RE),
    ...normalizedValue.matchAll(VULGAR_FRACTION_RE),
    ...normalizedValue.matchAll(COMPOSED_FRACTION_RE),
  ].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));

  for (const match of matches) {
    const index = match.index ?? 0;
    // A TeX span owns everything between its delimiters: a `½` or `¹⁄₂` sitting
    // inside `\( … \)` matched independently above, and re-emitting it would
    // split the formula. Because the list is sorted by start offset the
    // enclosing span is always consumed first, so any match that starts before
    // the cursor is already covered.
    if (index < lastIndex) continue;
    if (index > lastIndex) {
      tokens.push({
        kind: "text",
        value: normalizedValue.slice(lastIndex, index),
      });
    }

    // `\[ … \]` renders inline like `\( … \)` rather than in KaTeX display
    // mode: these spans live inside an authored paragraph run, and a display
    // formula emits a block-level <div> that cannot legally nest inside the
    // surrounding <p>. Upright inline maths is the honest rendering here.
    const latex = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (latex !== undefined) {
      tokens.push({ kind: "latex", latex });
      lastIndex = index + match[0].length;
      continue;
    }

    const vulgarFraction = VULGAR_FRACTIONS[match[0]];
    const [superscript = "", subscript = ""] = match[0].split(/[⁄/]/);
    const fraction = vulgarFraction ?? {
      numerator: Number(
        unicodeDigitsToAscii(superscript.trim(), SUPERSCRIPT_DIGITS),
      ),
      denominator: Number(
        unicodeDigitsToAscii(subscript.trim(), SUBSCRIPT_DIGITS),
      ),
    };
    tokens.push({ kind: "fraction", ...fraction });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < normalizedValue.length) {
    tokens.push({ kind: "text", value: normalizedValue.slice(lastIndex) });
  }

  return tokens.length > 0
    ? tokens
    : [{ kind: "text", value: normalizedValue }];
}
