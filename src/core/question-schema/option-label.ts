/**
 * The letter shown for a choice option — one copy of the rule, shared by the
 * players (which render it) and the editing engine (which lets a human correct
 * it). Issue #660.
 *
 * The printed workbook is the source of truth for these letters, and Vietnamese
 * textbooks skip letters — A, B, C, D, E, **G** (no F), then H, I, **K** (no J)
 * — and some print lowercase a) b) c). A letter derived from the option's index
 * therefore renders "F" where the data (and the question's own explanation) say
 * "G", so the option disagrees with both the book and the answer key.
 *
 * **The letter lives in `options[].id`, and nowhere else.** That is the shape
 * `CONTENT_SCHEMA_SPECIFICATIONS` §5.1/§5.2 documents, and `correctAnswer`
 * references those same ids — so reading the letter off the id is what keeps
 * what the pupil sees and what is graded the same string, permanently. No
 * display-only override field is consulted: a second place to put the letter is
 * a second thing that can disagree with the answer key.
 *
 * Only a **marker-shaped** id counts as a letter (one letter, optionally
 * followed by "." / ")"). Opaque ids ("o1", "h2") and numeric ids ("1", "2")
 * fall back to the option's position, exactly as before this issue — a numeric
 * id may be a positional key rather than something printed in the book, so
 * rendering it needs the book checked first.
 *
 * Case is preserved: a book printing "a)" must not render "A".
 */

const OPTION_MARKER_RE = /^([A-Za-z])[.)]?$/;

export interface OptionLabelSource {
  id?: string;
}

/** The bare letter carried by a marker-shaped value, or null. "G)" → "G". */
export function optionMarkerLetter(value: string | undefined | null): string | null {
  return OPTION_MARKER_RE.exec(value?.trim() ?? '')?.[1] ?? null;
}

/** The positional fallback letter for the option at `index`. */
export function positionalOptionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** The letter to show for this option — its marker id, else its position. */
export function optionDisplayLabel(
  option: OptionLabelSource | undefined,
  index: number,
): string {
  return optionMarkerLetter(option?.id) ?? positionalOptionLetter(index);
}

/** The payload fields that reference option ids and must follow a rename. */
const ANSWER_FIELDS = ['correctAnswer', 'correctAnswers', 'answer'] as const;

function remapAnswerIds(value: unknown, from: string, to: string): unknown {
  if (typeof value === 'string') return value === from ? to : value;
  if (Array.isArray(value)) return value.map((item) => remapAnswerIds(item, from, to));
  return value;
}

export type OptionLetterRename =
  | { ok: true }
  /** The value is not one letter — nothing was written. */
  | { ok: false; reason: 'not-a-letter' }
  /** Another option already answers to that letter — renaming would make two
   * options share an id, which silently merges them for grading. */
  | { ok: false; reason: 'duplicate' };

/**
 * Set the letter of option `index` to `letter`, in place.
 *
 * The letter IS the id (see the module comment), so this renames
 * `options[index].id` and rewrites every answer-key reference to the old id in
 * the same pass — `correctAnswer` plus the legacy `correctAnswers`/`answer`
 * fields the editor still reads. Nothing else in a choice payload references an
 * option id (verified across the canonical book corpus), so those are the whole
 * cascade.
 *
 * Rejects a duplicate rather than writing it: two options sharing an id would
 * be indistinguishable to grading.
 */
export function setOptionLetter(
  question: Record<string, unknown>,
  index: number,
  letter: string,
): OptionLetterRename {
  const wanted = optionMarkerLetter(letter);
  if (!wanted) return { ok: false, reason: 'not-a-letter' };

  const options = question.options as { id?: string }[] | undefined;
  const option = options?.[index];
  if (!option) return { ok: false, reason: 'not-a-letter' };

  const previous = option.id;
  if (previous === wanted) return { ok: true };
  if (options?.some((other, i) => i !== index && other?.id === wanted)) {
    return { ok: false, reason: 'duplicate' };
  }

  option.id = wanted;
  if (typeof previous === 'string') {
    for (const field of ANSWER_FIELDS) {
      if (field in question) {
        question[field] = remapAnswerIds(question[field], previous, wanted);
      }
    }
  }
  return { ok: true };
}
