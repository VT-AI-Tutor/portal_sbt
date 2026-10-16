/**
 * One-character text fields and Vietnamese input.
 *
 * A "single character" field cannot be expressed as `maxLength={1}` +
 * `value.slice(-1)` in a Vietnamese app, for two independent reasons:
 *
 * 1. **A Vietnamese letter takes several keystrokes.** With Telex, `Á` is typed
 *    `a` then `s`; with VNI it is `a` then `1`. Between those keystrokes the
 *    field legitimately holds an intermediate value (`as`), and the operating
 *    system's input method needs to see it there to fold it into `á`.
 *    `maxLength={1}` refuses that second keystroke, and a code-unit
 *    `slice(-1)` on the intermediate value keeps the *tone key* (`S`) instead
 *    of the letter. On-screen keyboards on iPad/phone compose the same way.
 * 2. **A letter is not always one code unit.** `Ắ` may be stored decomposed
 *    (NFD: `Ă` + U+0301). `slice(-1)` on that keeps the bare combining accent
 *    and throws the letter away, and a decomposed answer never string-equals
 *    the composed one in the answer key.
 *
 * So one-character fields keep the **last grapheme**, normalized to NFC, and
 * compare answers through {@link normalizeText}.
 */

/**
 * `Intl.Segmenter` is the only correct grapheme splitter, but it is optional in
 * older engines (and in some test environments), so resolve it lazily and fall
 * back to a code-point + combining-marks scan.
 */
const graphemeSegmenter: Intl.Segmenter | undefined = (() => {
  try {
    return typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('vi', { granularity: 'grapheme' })
      : undefined;
  } catch {
    return undefined;
  }
})();

/** Combining diacritical marks — the accents Vietnamese NFD text trails a letter with. */
const COMBINING_MARKS = /\p{Mn}/u;

/**
 * The last grapheme (user-perceived character) of `value`, normalized to NFC.
 * `''` for empty input. Never returns a bare combining mark: a trailing accent
 * always stays attached to the letter it belongs to.
 */
export function lastGrapheme(value: string): string {
  if (!value) return '';
  const text = value.normalize('NFC');
  if (!text) return '';

  if (graphemeSegmenter) {
    let last = '';
    for (const { segment } of graphemeSegmenter.segment(text)) last = segment;
    return last.normalize('NFC');
  }

  // Fallback: walk back over any trailing combining marks, then take the code
  // point they attach to. (NFC already folded most of these, but Vietnamese has
  // sequences with no precomposed form, and `normalize` is a no-op on those.)
  const codePoints = Array.from(text);
  let start = codePoints.length - 1;
  while (start > 0 && COMBINING_MARKS.test(codePoints[start]!)) start -= 1;
  return codePoints.slice(start).join('').normalize('NFC');
}

/**
 * Canonical form for comparing typed text against an answer key: NFC so that a
 * composed and a decomposed `Ắ` compare equal, upper-cased so the compare is
 * case-insensitive, trimmed of surrounding whitespace.
 *
 * Grading that string-compares Vietnamese text must go through this — a raw
 * `toUpperCase()` marks a correct decomposed answer wrong.
 */
export function normalizeText(value: string): string {
  return value.normalize('NFC').trim().toUpperCase().normalize('NFC');
}
