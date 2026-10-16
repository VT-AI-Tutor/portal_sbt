/**
 * Resolve a question's player type from the top-level `type`/`question_type`
 * field, falling back to the v2 schema's own `payload.type`.
 *
 * The legacy catalog lesson endpoint (public, no auth) can omit the top-level
 * `type` even though the schema in `payload` carries it — the authenticated
 * student-exercises endpoint always includes it. Every wire→PlayerQuestion
 * mapping should go through this fallback so both paths render alike.
 */
export function resolveQuestionType(
  type: string | null | undefined,
  payload: unknown,
): string {
  if (type) return type;
  const fromPayload = (payload as Record<string, unknown> | null | undefined)
    ?.type;
  return typeof fromPayload === "string" ? fromPayload : "";
}
