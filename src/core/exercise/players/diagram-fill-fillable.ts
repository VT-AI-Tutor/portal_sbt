/**
 * Deterministic `fillable` derivation for `diagram_fill` payloads.
 *
 * A large slice of the imported corpus stores diagram_fill nodes without the
 * `fillable` flag that CONTENT_SCHEMA §5.29 requires, so the renderer flags
 * them (`DIAGRAM_FILL_NO_FILLABLE`) and they can't be saved. The flag is
 * deterministically derivable in the common cases — this mirrors the backend
 * backfill rule (`scripts/backfill_diagram_fillable.py` → `plan_nodes`) so the
 * editor can repair a question with one click instead of an unreliable LLM
 * round-trip (the AI is prompted from a registry that treats `fillable` as
 * optional, so it does not reliably add it).
 *
 * Rule (per §5.29): a node is a student-fill cell when either
 *   1. its `id` is a key of `correctAnswer` (question has a graded answer key), or
 *   2. the question is `selfAssessment` and the node has a `placeholder`
 *      (or no `label`) — a blank designed to be filled but not auto-graded.
 * When neither applies (no `correctAnswer` and not `selfAssessment`) the flag
 * cannot be derived — a human/AI must author the answer key first.
 */

export interface DiagramFillFillableResult {
  /** A NEW payload with `fillable: true` set on the derived nodes. Equal in
   *  content to the input when nothing was derived. Never mutates the input. */
  payload: Record<string, unknown>;
  /** True when at least one node gained `fillable: true`. */
  changed: boolean;
  /** Ids of the nodes that were flagged (for a human-readable summary). */
  flaggedNodeIds: string[];
  /** Why derivation produced nothing, when `changed` is false and the payload
   *  actually needed a fix — lets the caller explain instead of silently
   *  offering nothing. `null` when a fix was applied or none was needed. */
  skipReason: 'not_diagram_fill' | 'no_nodes' | 'already_fillable' | 'no_correct_answer' | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Derive the `fillable` flag for a `diagram_fill` payload. Returns a new
 * payload (the input is never mutated), a `changed` flag, the flagged node ids,
 * and a `skipReason` when nothing could be derived for a payload that needed it.
 */
export function deriveDiagramFillFillable(
  payload: Record<string, unknown>,
): DiagramFillFillableResult {
  const none = (skipReason: DiagramFillFillableResult['skipReason']): DiagramFillFillableResult => ({
    payload,
    changed: false,
    flaggedNodeIds: [],
    skipReason,
  });

  if (!isPlainObject(payload) || payload.type !== 'diagram_fill') return none('not_diagram_fill');

  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const nodes = rawNodes.filter(isPlainObject);
  if (nodes.length === 0) return none('no_nodes');

  // Already answerable — at least one fillable node — nothing to do.
  if (nodes.some((node) => node.fillable === true)) return none('already_fillable');

  const correctAnswer = payload.correctAnswer;
  const answerKeys = isPlainObject(correctAnswer) ? Object.keys(correctAnswer) : [];

  const shouldFlag = (node: Record<string, unknown>): boolean => {
    if (node.fillable === true) return false;
    if (answerKeys.length > 0) {
      // Rule 1: node id is a graded-answer key.
      return typeof node.id === 'string' && answerKeys.includes(node.id);
    }
    if (payload.selfAssessment) {
      // Rule 2: self-assessed blank — has a placeholder or no fixed label.
      const hasLabel = typeof node.label === 'string' && node.label.trim().length > 0;
      return 'placeholder' in node || !hasLabel;
    }
    return false;
  };

  const flaggedNodeIds: string[] = [];
  const nextNodes = rawNodes.map((node) => {
    if (isPlainObject(node) && shouldFlag(node)) {
      if (typeof node.id === 'string') flaggedNodeIds.push(node.id);
      return { ...node, fillable: true };
    }
    return node;
  });

  if (flaggedNodeIds.length === 0 && !nextNodes.some((n, i) => n !== rawNodes[i])) {
    // Nothing derivable: no answer key and not self-assessed (or self-assessed
    // with every node already carrying a real label and no placeholder).
    return none('no_correct_answer');
  }

  return {
    payload: { ...payload, nodes: nextNodes },
    changed: true,
    flaggedNodeIds,
    skipReason: null,
  };
}
