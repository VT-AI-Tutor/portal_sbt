import { N, parse, simplify } from "@cortex-js/compute-engine";

export type MathGradingMode =
  | "numeric"
  | "symbolic"
  | "algebraic_equivalence";

export type MathGrade = "correct" | "incorrect";

/**
 * Vietnamese decimal commas, lowered to a decimal point before parsing.
 *
 * compute-engine does not understand `{,}` — the TeX idiom this content uses for
 * a decimal comma — and reads `0{,}6` as `6` and `54{,}7` as `547`. It reports no
 * error, so an unnormalised comma is a silently wrong number rather than a
 * rejected parse.
 *
 * Only a comma sitting BETWEEN two digits is rewritten. Vietnamese mathematical
 * notation writes a point as `(3; 5)` with a semicolon precisely because the
 * comma already means a decimal separator, so this narrowing cannot swallow a
 * list separator.
 */
const VIETNAMESE_DECIMAL_RE = /(\d)\s*(?:\{,\}|,)\s*(\d)/g;

/**
 * `\text{…}` spans, whose bodies are prose and never maths.
 *
 * A comma there is punctuation — `\text{có 3, 4 quả}` lists two counts. Rewriting
 * it to `3.4` silently changes the author's answer key into a different claim.
 *
 * Handles ONE level of nested braces (`\text{a {b} c}`); a second level would cut
 * early. Sibling prose commands (`\textit`, `\mathrm`, `\operatorname`) are not
 * covered — none has shown up in authored answer keys, and widening the pattern
 * without a case to point at is guesswork.
 */
const TEXT_SPAN_RE = /\\text\{(?:[^{}]|\{[^{}]*\})*\}/g;

function normalizeVietnameseDecimals(value: string): string {
  let out = "";
  let cursor = 0;
  for (const span of value.matchAll(TEXT_SPAN_RE)) {
    const start = span.index ?? 0;
    out += value.slice(cursor, start).replace(VIETNAMESE_DECIMAL_RE, "$1.$2");
    out += span[0];
    cursor = start + span[0].length;
  }
  return out + value.slice(cursor).replace(VIETNAMESE_DECIMAL_RE, "$1.$2");
}

function parseExpression(value: string) {
  const source = normalizeVietnameseDecimals(value.trim());
  if (!source) return null;
  try {
    const expression = parse(source, { form: "canonical" });
    return expression.isValid ? expression : null;
  } catch {
    return null;
  }
}

function numericValue(value: string): number | null {
  const expression = parseExpression(value);
  if (!expression) return null;
  try {
    const evaluated = N(expression);
    if (!evaluated.isNumber || !evaluated.isFinite) return null;
    const numeric = Number(
      (evaluated as unknown as { numericValue?: number }).numericValue ??
        evaluated.valueOf(),
    );
    return Number.isFinite(numeric) ? numeric : null;
  } catch {
    return null;
  }
}

function symbolicEquivalent(actual: string, expected: string): boolean {
  const actualExpression = parseExpression(actual);
  const expectedExpression = parseExpression(expected);
  return Boolean(actualExpression && expectedExpression && actualExpression.isSame(expectedExpression));
}

function algebraicallyEquivalent(actual: string, expected: string): boolean {
  const actualExpression = parseExpression(actual);
  const expectedExpression = parseExpression(expected);
  if (!actualExpression || !expectedExpression) return false;
  try {
    return simplify(actualExpression).is(expectedExpression);
  } catch {
    return false;
  }
}

/**
 * Safe client feedback for `math_expression`.
 *
 * This function never executes JavaScript generated from learner input. The
 * server remains the official grader; this is only used for immediate UX.
 */
export function gradeMathExpression(
  actual: string,
  acceptedAnswers: string[],
  mode: MathGradingMode = "symbolic",
  tolerance = 1e-9,
): MathGrade {
  if (!acceptedAnswers.length) return "incorrect";
  if (!Number.isFinite(tolerance) || tolerance < 0) return "incorrect";

  if (mode === "numeric") {
    const mine = numericValue(actual);
    if (mine === null) return "incorrect";
    return acceptedAnswers.some((answer) => {
      const target = numericValue(answer);
      return target !== null && Math.abs(target - mine) <= tolerance;
    })
      ? "correct"
      : "incorrect";
  }

  const equivalent = mode === "algebraic_equivalence"
    ? algebraicallyEquivalent
    : symbolicEquivalent;
  return acceptedAnswers.some((answer) => equivalent(actual, answer))
    ? "correct"
    : "incorrect";
}

