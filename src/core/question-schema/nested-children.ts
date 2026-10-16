/**
 * nested-children.ts — the single resolver for the three keys a wrapper question
 * (`question_group` and friends) may store its children under.
 *
 * `children` is the canonical v2.0 key, `subQuestions` is what essentially all real
 * book data carries, and `questions` is the legacy alias. Every surface that walks a
 * wrapper's children must accept all three in the same order, otherwise a group is
 * treated as empty — it renders with no children, or its answer-key notice silently
 * reports nothing to check.
 *
 * Call sites: `players/dispatch.tsx` (adaptChildren), `question-schema/adapter.ts`
 * (fromPayload), `question-renderer/honest/interactive/grade.ts`
 * (gradingNoticeInputFromPayload).
 */

/** Keys a wrapper question may store its children under, highest priority first. */
export const NESTED_QUESTION_KEYS = ["children", "subQuestions", "questions"] as const;

export type NestedQuestionKey = (typeof NESTED_QUESTION_KEYS)[number];

export interface NestedQuestionSource {
  /** Which key the children were actually read from (useful for diagnostics). */
  key: NestedQuestionKey;
  list: unknown[];
}

/**
 * Returns the first child list present on `payload`, or `undefined` when the payload
 * carries none of the three keys as an array. Callers that need an always-present list
 * should use `?.list ?? []`; callers that must distinguish "absent" from "empty"
 * (the grading notice does) can test the result itself.
 */
export function resolveNestedQuestions(
  payload: Record<string, unknown> | null | undefined
): NestedQuestionSource | undefined {
  if (!payload) return undefined;
  for (const key of NESTED_QUESTION_KEYS) {
    const value = payload[key];
    if (Array.isArray(value)) return { key, list: value };
  }
  return undefined;
}
