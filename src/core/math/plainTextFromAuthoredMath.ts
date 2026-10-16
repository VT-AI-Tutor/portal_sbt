/**
 * Lower authored TeX to readable plain text.
 *
 * `InlineMathText` (see `inlineMathTextTokens.ts`) is the rendering path: every
 * surface that goes through `RichTextValue` gets real KaTeX. This module is the
 * *other* path — the one-line summaries, rail labels, table cells and tooltips
 * that are deliberately plain strings and must stay plain strings:
 *
 * - they are clamped (`line-clamp-1`), and a KaTeX span does not clamp;
 * - the editing-engine queue rail renders up to 100 of them at once, so a
 *   renderer per label is the wrong cost;
 * - `title=` attributes and `<option>` labels cannot hold elements at all.
 *
 * Without this, such a label prints the delimiters verbatim
 * ("chiều dài \(\frac{51}{4}\) m"). With it, it reads "chiều dài 51/4 m".
 *
 * The output is a *legible approximation*, never a round-trippable formula — it
 * is display-only and must never be written back into a question payload.
 */

/** TeX commands with a single well-understood plain-text character. */
const COMMAND_SYMBOLS: Record<string, string> = {
  times: "×",
  div: "÷",
  cdot: "·",
  pm: "±",
  mp: "∓",
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  ne: "≠",
  neq: "≠",
  approx: "≈",
  equiv: "≡",
  sim: "∼",
  propto: "∝",
  lt: "<",
  gt: ">",
  ll: "≪",
  gg: "≫",
  circ: "°",
  degree: "°",
  ang: "∠",
  angle: "∠",
  perp: "⊥",
  parallel: "∥",
  triangle: "△",
  square: "□",
  sqrt: "√",
  infty: "∞",
  to: "→",
  rightarrow: "→",
  Rightarrow: "⇒",
  leftarrow: "←",
  Leftarrow: "⇐",
  leftrightarrow: "↔",
  Leftrightarrow: "⇔",
  mapsto: "↦",
  ldots: "…",
  cdots: "…",
  dots: "…",
  vdots: "⋮",
  in: "∈",
  notin: "∉",
  subset: "⊂",
  supset: "⊃",
  subseteq: "⊆",
  cup: "∪",
  cap: "∩",
  emptyset: "∅",
  varnothing: "∅",
  forall: "∀",
  exists: "∃",
  neg: "¬",
  sum: "∑",
  prod: "∏",
  int: "∫",
  partial: "∂",
  nabla: "∇",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  phi: "φ",
  varphi: "φ",
  omega: "ω",
  Delta: "Δ",
  Sigma: "Σ",
  Omega: "Ω",
  Pi: "Π",
  prime: "′",
};

/**
 * `\<punctuation>` — an escaped literal, not a command. `\\` is a TeX line break
 * and the spacing macros (`\,` `\;` `\:` `\ `) are horizontal glue: all of them
 * become a plain space, which the caller's whitespace collapse then absorbs.
 * `\!` is negative space and leaves nothing behind.
 */
const ESCAPED_LITERALS: Record<string, string> = {
  "\\": " ",
  " ": " ",
  ",": " ",
  ";": " ",
  ":": " ",
  "!": "",
  "%": "%",
  $: "$",
  "&": "&",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
};

const FRACTION_COMMANDS = new Set(["frac", "dfrac", "tfrac", "cfrac"]);

const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
};

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "(": "₍",
  ")": "₎",
};

/**
 * Authored TeX spans. Kept in sync with `LATEX_DELIMITED_RE` in
 * `inlineMathTextTokens.ts`: the four standard forms `\( … \)`, `\[ … \]`,
 * `$$ … $$` and `$ … $`. The single-`$` alternative uses the Pandoc rule so a
 * trailing-dollar price such as "giá 5$ và 10$" stays prose (see that file).
 */
const LATEX_DELIMITED_RE =
  /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|(?<![\\$])\$(?=\S)([^$]+?)(?<=[^\s\\])\$(?!\d)/g;

/**
 * Inside a delimited span every character is TeX: braces group, `^`/`_` script.
 * Outside one, only `\command` sequences are TeX — the surrounding Vietnamese
 * prose keeps its braces, carets and underscores verbatim.
 */
type ScanMode = "math" | "prose";

interface Scanned {
  text: string;
  next: number;
}

function isLetter(char: string | undefined): boolean {
  return char !== undefined && /[a-zA-Z]/.test(char);
}

/** Body of the `{ … }` starting at `open`, honouring nesting and `\{` escapes. */
function readGroup(source: string, open: number): Scanned {
  let depth = 0;
  let index = open;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return { text: source.slice(open + 1, index), next: index + 1 };
      }
    }
    index += 1;
  }
  // Unbalanced — treat the rest of the string as the body rather than dropping
  // it, so a truncated payload still yields the text it does carry.
  return { text: source.slice(open + 1), next: source.length };
}

/**
 * One argument of a command: `{ … }`, or the single token TeX allows without
 * braces (`\frac12`, `x^2`).
 */
function readArgument(source: string, from: number): Scanned {
  let index = from;
  while (source[index] === " ") index += 1;
  if (index >= source.length) return { text: "", next: index };
  if (source[index] === "{") return readGroup(source, index);
  if (source[index] === "\\") {
    let end = index + 1;
    if (isLetter(source[end])) {
      while (isLetter(source[end])) end += 1;
    } else {
      end += 1;
    }
    return { text: source.slice(index, end), next: end };
  }
  return { text: source[index], next: index + 1 };
}

/**
 * `51/4` reads fine, `a+b/2` does not. Parenthesise a numerator/denominator
 * that is not a single atom so the lowered fraction keeps its grouping.
 */
function wrapCompound(part: string): string {
  const trimmed = part.trim();
  if (!trimmed) return trimmed;
  if (/^[\p{L}\p{N}.,'′°]+$/u.test(trimmed)) return trimmed;
  if (/^\(.*\)$/.test(trimmed)) return trimmed;
  return `(${trimmed})`;
}

function toScript(value: string, table: Record<string, string>): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let out = "";
  for (const char of trimmed) {
    const mapped = table[char];
    if (mapped === undefined) return null;
    out += mapped;
  }
  return out;
}

function readCommand(source: string, from: number): Scanned {
  const marker = source[from + 1];
  if (marker === undefined) return { text: "", next: from + 1 };

  if (!isLetter(marker)) {
    return { text: ESCAPED_LITERALS[marker] ?? marker, next: from + 2 };
  }

  let end = from + 1;
  while (isLetter(source[end])) end += 1;
  const name = source.slice(from + 1, end);
  // The space that terminates a control word is deliberately NOT swallowed the
  // way TeX swallows it: `\times 4` must read "× 4", not "×4". Authored spacing
  // is the only spacing hint a plain-text label has. Where a command leaves
  // nothing behind the gap collapses again at the end of `plainTextFromAuthoredMath`.

  if (FRACTION_COMMANDS.has(name)) {
    const numerator = readArgument(source, end);
    const denominator = readArgument(source, numerator.next);
    const above = wrapCompound(scan(numerator.text, "math"));
    const below = wrapCompound(scan(denominator.text, "math"));
    // A truncated payload can leave `\frac{51` with no denominator; a dangling
    // "51/" would read as a fraction that is not there.
    const text = above && below ? `${above}/${below}` : above || below;
    return { text, next: denominator.next };
  }

  if (name === "placeholder") {
    // `\placeholder[id]{}` is a blank the pupil fills in. A label must show the
    // gap itself, never the machinery: the id and the braces are not prose, and
    // the generic "drop the name, keep the arguments" fallback below would print
    // the id verbatim.
    let cursor = end;
    if (source[cursor] === "[") {
      const close = source.indexOf("]", cursor);
      cursor = close === -1 ? source.length : close + 1;
    }
    while (source[cursor] === " ") cursor += 1;
    if (source[cursor] === "{") cursor = readGroup(source, cursor).next;
    return { text: "…", next: cursor };
  }

  const symbol = COMMAND_SYMBOLS[name];
  if (symbol !== undefined) return { text: symbol, next: end };

  // Any other command — `\overline`, `\left`, `\displaystyle`, a macro we have
  // never seen — drops its name and keeps its arguments, which `scan` picks up
  // as ordinary groups. Dropping the *content* would silently delete part of
  // the question text; dropping only the markup cannot.
  return { text: "", next: end };
}

function scan(source: string, mode: ScanMode): string {
  let out = "";
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      const command = readCommand(source, index);
      out += command.text;
      index = command.next;
      continue;
    }

    if (mode === "math") {
      if (char === "{") {
        const group = readGroup(source, index);
        out += scan(group.text, "math");
        index = group.next;
        continue;
      }
      if (char === "}" || char === "$") {
        index += 1;
        continue;
      }
      if (char === "~" || char === "&") {
        out += " ";
        index += 1;
        continue;
      }
      if (char === "^" || char === "_") {
        const argument = readArgument(source, index + 1);
        const rendered = scan(argument.text, "math");
        const scripted = toScript(rendered, char === "^" ? SUPERSCRIPTS : SUBSCRIPTS);
        // Unicode scripts only cover digits and a few signs; anything else keeps
        // the TeX operator so the reader can still tell it was a script.
        out += scripted ?? `${char}${rendered}`;
        index = argument.next;
        continue;
      }
    }

    out += char;
    index += 1;
  }

  return out;
}

/**
 * Strip authored TeX from a string that is displayed as plain text.
 *
 * `\( … \)` / `\[ … \]` spans are lowered wholesale; outside a span only
 * `\command` sequences are touched, so ordinary prose — including braces and
 * underscores — survives byte for byte.
 *
 * Display only. Never persist the result: the question payload keeps the TeX.
 */
export function plainTextFromAuthoredMath(value: unknown): string {
  // Queue/list projections are persisted data at the API boundary. A malformed
  // legacy value must not take down the whole screen merely because this
  // display-only helper is trying to lower its TeX.
  const source = typeof value === "string" ? value : "";
  // No backslash and no `$` means no TeX, and the overwhelming majority of
  // labels have neither — return the string untouched rather than re-scanning
  // it. A `$ … $` span can carry a formula (e.g. `$A$`) with no backslash, so a
  // bare `$` still warrants a scan; the Pandoc-guarded delimiter leaves prices
  // as prose.
  if (!source.includes("\\") && !source.includes("$")) return source;

  const withoutDelimiters = source.replace(
    LATEX_DELIMITED_RE,
    (_match, inlineBracket, displayBracket, displayDollar, inlineDollar) =>
      scan(
        inlineBracket ?? displayBracket ?? displayDollar ?? inlineDollar,
        "math",
      )
        .replace(/\s+/g, " ")
        .trim(),
  );

  return (
    scan(withoutDelimiters, "prose")
      // Commands lowered to nothing leave double spaces behind. Collapse runs of
      // horizontal whitespace only — newlines belong to the author's text.
      .replace(/[^\S\n]{2,}/g, " ")
      .trim()
  );
}
