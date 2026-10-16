/**
 * field-scope.ts — WHICH sub-question a field id belongs to.
 *
 * A field id (`f1`, `it_f9`, …) is only unique INSIDE one question payload.
 * Real `question_group` corpus data reuses the very same ids across
 * sub-questions — every sub-question of a hotspot group carries `f1`, `f2`,
 * `f3`. The edit-mode geometry controller lives at the GROUP level, so a bare
 * id reaching it is ambiguous: the writer used to take the first sub-question
 * that owned that id, which meant dragging a box on row 2 moved row 1's box
 * instead (issue web#1113).
 *
 * The scope closes that hole. Every surface that renders a nested sub-question
 * — the preview dispatcher and the structured form — declares its position
 * (`subQuestions[1]`), drag handles report `subQuestions[1]::f1`, and the
 * mapper walks straight to that child instead of guessing. Groups inside
 * groups compose: `subQuestions[0]::children[2]::f1`.
 *
 * Unscoped ids (standalone questions, or any surface that has not opted in)
 * keep the old behaviour exactly — nothing is prefixed, nothing is parsed.
 *
 * This module is deliberately React-free so the payload mappers can import it
 * without pulling in a component file. The React side (context, provider,
 * hooks) lives in `field-resize-context.tsx`.
 */

/** Separator between scope segments, and between the scope and the field id. */
export const FIELD_SCOPE_SEPARATOR = '::';

/** A scope segment is exactly `<nestedKey>[<index>]` — nothing else parses. */
const SCOPE_SEGMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*\[\d+\]$/;

/** Build the segment for the `index`-th child stored under `key`. */
export function nestedFieldScopeSegment(key: string, index: number): string {
  return `${key}[${index}]`;
}

/** Append a segment to an existing scope (empty parent → the segment alone). */
export function extendFieldScope(parent: string, segment: string): string {
  return parent ? `${parent}${FIELD_SCOPE_SEPARATOR}${segment}` : segment;
}

/** Prefix a raw field id with its scope. Empty scope → the id unchanged. */
export function scopeFieldId(scope: string, fieldId: string): string {
  return scope ? `${scope}${FIELD_SCOPE_SEPARATOR}${fieldId}` : fieldId;
}

export interface ParsedScopedFieldId {
  /** Nested path from the root payload down to the field's owner. */
  path: Array<{ key: string; index: number }>;
  /** The id as the owning payload stores it. */
  fieldId: string;
}

/**
 * Split a scoped id back into path + raw id.
 *
 * Deliberately conservative: a leading chunk counts as scope ONLY when it
 * matches `<key>[<n>]` exactly. An id that merely contains `::` therefore comes
 * back whole, never mangled into a bogus path.
 */
export function parseScopedFieldId(scoped: string): ParsedScopedFieldId {
  const parts = scoped.split(FIELD_SCOPE_SEPARATOR);
  const path: Array<{ key: string; index: number }> = [];
  let i = 0;
  for (; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!SCOPE_SEGMENT_RE.test(part)) break;
    const open = part.indexOf('[');
    path.push({
      key: part.slice(0, open),
      index: Number(part.slice(open + 1, -1)),
    });
  }
  return { path, fieldId: parts.slice(i).join(FIELD_SCOPE_SEPARATOR) };
}

/* ────────────────────────────────────────────────────────────────────────────
 * OCCURRENCE — WHICH ENTRY of one array a field id means.
 *
 * The scope above answers "which sub-question owns this field". One level down
 * the same ambiguity exists INSIDE a single payload array: `hotspots[]` may
 * legitimately carry two entries with the very same `id` — two rects covering
 * the two segments of one road, both grading as that one answer (the hit-test
 * scans geometry and never counts entries, so either segment reports the same
 * id). A bare id reaching the geometry mapper is then ambiguous exactly as a
 * bare id was inside a group: the writer took the first entry that owned it, so
 * dragging the second rect moved the first one instead — the box jumped away
 * from the cursor by the distance between the twins.
 *
 * An occurrence pins the entry: `f1#3` = "the entry at index 3, which carries
 * id `f1`". Handles only add it when the id is actually ambiguous, so every
 * unique-id surface keeps reporting the bare id it always did.
 *
 * Parsing is as conservative as the scope parser: an id that merely ends in
 * `#<digits>` is not mangled, because resolution tries the LITERAL id first and
 * only then the occurrence (see `findById` in
 * `modules/questions/ui/app/apply-field-geometry.ts`).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Separator between a field id and its array-occurrence index. */
export const FIELD_OCCURRENCE_SEPARATOR = '#';

/** Trailing `#<index>` — the only form that parses as an occurrence. */
const FIELD_OCCURRENCE_RE = /^(.*)#(\d+)$/;

/** Tag a field id with the array index of the entry it refers to. */
export function withFieldOccurrence(fieldId: string, index: number): string {
  return `${fieldId}${FIELD_OCCURRENCE_SEPARATOR}${index}`;
}

export interface ParsedFieldOccurrence {
  /** The id as the owning payload stores it. */
  fieldId: string;
  /** Array index the handle reported, or null when the id carries none. */
  occurrence: number | null;
}

/**
 * Split a field id into `{ fieldId, occurrence }`. No trailing `#<digits>` →
 * the id comes back whole with `occurrence: null`.
 */
export function parseFieldOccurrence(fieldId: string): ParsedFieldOccurrence {
  const match = FIELD_OCCURRENCE_RE.exec(fieldId);
  if (!match || !match[1]) return { fieldId, occurrence: null };
  return { fieldId: match[1], occurrence: Number(match[2]) };
}
