import type { RichContent } from "./types";
import {
  canonicalizeRichContent,
  plainTextFromRichContent,
} from "@/core/rich-text/html";

/**
 * Historical nxbgd payloads sometimes wrote the matching renderer choice into
 * `display.layout` (notably `columns` and `lines`). These are interaction
 * aliases, not presentation layouts. Keep the mapping read-only so canonical
 * authoring can continue to emit `display.interactionType`.
 */
export const MATCHING_LAYOUT_INTERACTION_ALIASES = [
  "columns",
  "lines",
  "rows",
  "row",
  "radial",
  "chain",
  "scene",
] as const;

export function matchingInteractionFromLayoutAlias(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!(MATCHING_LAYOUT_INTERACTION_ALIASES as readonly string[]).includes(normalized)) {
    return undefined;
  }
  return normalized === "row" ? "rows" : normalized;
}

export interface MatchEdge {
  item: string;
  target: string;
}

export interface MatchingItemInput {
  id: string;
  content?: RichContent;
  text?: string;
  label?: string;
  imageUrl?: string;
  image?: { url?: string };
  x?: number;
  y?: number;
}

type MatchingPayload = Record<string, unknown> & {
  display?: { interactionType?: unknown; layout?: unknown };
};

const nonEmptyId = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const id = String(value).trim();
  return id ? id : null;
};

export const matchEdgeKey = ({ item, target }: MatchEdge): string => `${item}\u0000${target}`;

export function sameMatchEdgeSet(
  actual: unknown,
  expected: unknown,
  validItems?: ReadonlySet<string>,
  validTargets?: ReadonlySet<string>,
): boolean {
  const actualEdges = normalizeMatchEdges(actual);
  const expectedEdges = normalizeMatchEdges(expected, validItems, validTargets);
  if (actualEdges.length !== expectedEdges.length) return false;
  if (validItems && actualEdges.some((edge) => !validItems.has(edge.item))) return false;
  if (validTargets && actualEdges.some((edge) => !validTargets.has(edge.target))) return false;
  const expectedKeys = new Set(expectedEdges.map(matchEdgeKey));
  return actualEdges.every((edge) => expectedKeys.has(matchEdgeKey(edge)));
}

/**
 * How many links each end of an edge may carry. `Infinity` on a side means the
 * answer key says nothing about that side, so the player must not invent a
 * limit there.
 *
 * Both numbers are GLOBAL maxima over the key, applied uniformly to every
 * node — deliberately not per-node. A per-node ceiling would announce how many
 * links each item is supposed to have (half the solution), and would pin a
 * distractor — an item the key never mentions, which §5.9.2 explicitly allows —
 * at zero, making it unclickable and giving the distractor away.
 */
export interface MatchCardinality {
  /** Max links LEAVING one source node. */
  maxOutDegree: number;
  /** Max links ENTERING one target node. */
  maxInDegree: number;
}

const UNBOUNDED = Number.POSITIVE_INFINITY;

/** Highest number of times any single value appears under `pick`. */
function peakDegree(edges: MatchEdge[], pick: (edge: MatchEdge) => string): number {
  const counts = new Map<string, number>();
  let peak = 0;
  for (const edge of edges) {
    const next = (counts.get(pick(edge)) ?? 0) + 1;
    counts.set(pick(edge), next);
    if (next > peak) peak = next;
  }
  return peak;
}

/**
 * Read the link ceiling out of the answer key — the two-column contract.
 *
 * An empty key (record-only, `selfAssessment`, or a question with no
 * `correctAnswer` at all) keeps the historical one-link-per-source behaviour so
 * already-published self-assessment content does not change under learners, but
 * claims nothing about the target side: with no key there is no evidence for an
 * in-degree limit, and inventing one would block legitimate answers.
 */
export function matchCardinalityFromKey(correctEdges: MatchEdge[]): MatchCardinality {
  if (correctEdges.length === 0) return { maxOutDegree: 1, maxInDegree: UNBOUNDED };
  return {
    maxOutDegree: peakDegree(correctEdges, (edge) => edge.item),
    maxInDegree: peakDegree(correctEdges, (edge) => edge.target),
  };
}

export interface MatchColumnIds {
  leftIds: ReadonlySet<string>;
  middleIds: ReadonlySet<string>;
  rightIds: ReadonlySet<string>;
}

export interface MatchCardinalityByHopOptions {
  /**
   * Replace the middle→right OUT ceiling, and only that direction.
   *
   * `triad` (§5.9.3) is defined by a centre that fans out, but a legacy
   * `Record<fromId, toId>` answer key cannot express it: two entries under the
   * same key do not survive JSON, so the middle node always reads back with a
   * single target and the derived ceiling would lock the centre at one link.
   * The other three directions ARE expressible in a Record — several keys may
   * point at the same value — so they stay derived.
   *
   * Pass `triadCentreFanOutCeiling` here: the centre still gets a ceiling, it
   * is just counted off the answer ITEMS instead of the collapsed edges.
   */
  centreFanOutCeiling?: number;
}

/**
 * Trần toả của tâm `triad` khi khoá đáp án là `Record`.
 *
 * Record đã đánh rơi quan hệ một-nhiều nên không đếm được số cạnh thật; thay
 * vào đó đếm theo SỐ LƯỢNG ĐÁP: mỗi ô giữa khác đang có mặt trong khoá vẫn phải
 * giữ cho mình ít nhất một ô phải, phần cột phải còn lại là trần của một tâm.
 *
 * Trần này KHÍT — không hụt so với đáp án thật — đúng khi các tâm nối vào những
 * ô phải RỜI NHAU: lúc đó tổng số nét không vượt quá số ô phải, nên phép trừ
 * không cắt mất nét nào của đáp án hợp lệ.
 *
 * Có dùng chung ô phải thì giả định đổ, và guard bên dưới chỉ thấy được phần
 * dùng chung mà Record CÒN GHI LẠI. Quan hệ dùng chung nằm đúng vào những entry
 * bị collapse nuốt thì guard im, và trần có thể ghim tâm ở một nét
 * (`M1→{R1,R2}, M2→{R1}, M3→{R3}` ghi thành `{M1:"R2", M2:"R1", M3:"R3"}` → trần
 * 1). Chấp nhận: khoá kiểu đó không diễn đạt nổi chính đáp án của nó, và trần
 * VÀO — suy từ cùng một khoá — đã chặn đáp án đầy đủ từ trước khi có hàm này.
 * Cái mất là học sinh không còn vẽ dở được hai nét của một tâm. Ca này khoá
 * bằng test trong `matching.test.ts`; muốn hết hẳn thì phải sửa dữ liệu sang
 * khoá dạng mảng cạnh, không sửa được ở đây.
 */
export function triadCentreFanOutCeiling(
  keyEdges: MatchEdge[],
  { middleIds, rightIds }: Pick<MatchColumnIds, "middleIds" | "rightIds">,
): number {
  const centreEdges = keyEdges.filter(
    ({ item, target }) => middleIds.has(item) && rightIds.has(target),
  );
  // Khoá có một ô phải nhận nét từ HAI tâm → các tập đích không rời nhau, phép
  // trừ bên dưới sẽ cắt mất nét của một đáp án hợp lệ. Không còn cận nào đếm
  // theo ô mà chắc chắn không hụt, nên trả về cả cột phải.
  if (peakDegree(centreEdges, (edge) => edge.target) > 1) return rightIds.size;
  const centres = new Set(centreEdges.map(({ item }) => item));
  // Sàn 1: cột phải ít ô hơn số tâm thì trần vẫn phải cho tâm vẽ nổi một nét,
  // nếu không cả biến thể "toả ra từ tâm" thành bấm không ăn.
  return Math.max(1, rightIds.size - Math.max(0, centres.size - 1));
}

/**
 * Three-column ceiling, computed per HOP.
 *
 * `chain` and `triad` differ only in cardinality (§5.9.3), and a triad may be
 * many-to-one on left→middle while being one-to-many on middle→right. A single
 * question-wide flag cannot say that, which is why the flag has to be replaced
 * rather than tuned. Edges that do not join two ADJACENT columns are ignored —
 * they are invalid for both variants and must not shift a ceiling.
 */
export function matchCardinalityByHop(
  correctEdges: MatchEdge[],
  { leftIds, middleIds, rightIds }: MatchColumnIds,
  options?: MatchCardinalityByHopOptions,
): { leftToMiddle: MatchCardinality; middleToRight: MatchCardinality } {
  const leftToMiddle = correctEdges.filter(
    ({ item, target }) => leftIds.has(item) && middleIds.has(target),
  );
  const middleToRight = correctEdges.filter(
    ({ item, target }) => middleIds.has(item) && rightIds.has(target),
  );
  // A hop with no edges in the key carries no evidence — leave it unconstrained
  // instead of falling back to the two-column default of 1.
  const forHop = (edges: MatchEdge[]): MatchCardinality =>
    edges.length === 0
      ? { maxOutDegree: UNBOUNDED, maxInDegree: UNBOUNDED }
      : matchCardinalityFromKey(edges);
  const second = forHop(middleToRight);
  const ceiling = options?.centreFanOutCeiling;
  return {
    leftToMiddle: forHop(leftToMiddle),
    // Trần đếm theo ô không được phép SIẾT hơn trần đọc thẳng từ khoá: khoá nói
    // rõ hai nét thì hai nét vẫn phải vẽ được.
    middleToRight: ceiling === undefined
      ? second
      : {
          ...second,
          maxOutDegree: Number.isFinite(second.maxOutDegree)
            ? Math.max(ceiling, second.maxOutDegree)
            : ceiling,
        },
  };
}

export interface ToggleMatchEdgeOptions {
  /**
   * Legacy alias for `maxOutDegree: 1`. Kept so call sites that have not moved
   * to the cardinality contract keep their exact behaviour.
   */
  singleTargetPerItem?: boolean;
  /** Max links leaving the source. Default: unlimited. */
  maxOutDegree?: number;
  /** Max links entering the target. Default: unlimited. */
  maxInDegree?: number;
  /**
   * Edge keys that may never be removed — the locked sample pairs. They still
   * COUNT toward both degrees; they just cannot be evicted to make room. When a
   * ceiling is reached and every candidate is protected, the click is a no-op.
   */
  protectedKeys?: ReadonlySet<string>;
}

/**
 * Add or remove one link, keeping both ends within their ceiling.
 *
 * Reaching a ceiling evicts the OLDEST link on that end (edges are stored in
 * the order the learner drew them) rather than clearing the node, so a ceiling
 * above 1 keeps the links the learner still has room for.
 */
export function toggleMatchEdge(
  edges: MatchEdge[],
  item: string,
  target: string,
  options?: ToggleMatchEdgeOptions,
): MatchEdge[] {
  const candidate = { item, target };
  const key = matchEdgeKey(candidate);
  const isProtected = (edge: MatchEdge) => options?.protectedKeys?.has(matchEdgeKey(edge)) === true;
  if (edges.some((edge) => matchEdgeKey(edge) === key)) {
    // Re-clicking the exact same pair removes it (toggle off) — unless it is a
    // locked sample, which is immutable from either end.
    if (isProtected(candidate)) return edges;
    return edges.filter((edge) => matchEdgeKey(edge) !== key);
  }

  const maxOut = options?.singleTargetPerItem ? 1 : options?.maxOutDegree ?? UNBOUNDED;
  const maxIn = options?.maxInDegree ?? UNBOUNDED;
  let next = edges;
  // Two passes, one per end. `while` rather than `if`: a hydrated answer can
  // already sit above the ceiling, and one eviction would not be enough.
  const evictUntilRoom = (
    limit: number,
    touches: (edge: MatchEdge) => boolean,
  ): boolean => {
    while (next.filter(touches).length >= limit) {
      const victim = next.find((edge) => touches(edge) && !isProtected(edge));
      if (!victim) return false;
      next = next.filter((edge) => edge !== victim);
    }
    return true;
  };
  if (!evictUntilRoom(maxOut, (edge) => edge.item === item)) return edges;
  if (!evictUntilRoom(maxIn, (edge) => edge.target === target)) return edges;
  return [...next, candidate];
}

/**
 * Bring a stored answer back within the ceiling.
 *
 * The ceiling used to live only in the click handler, so an answer saved before
 * it existed — or saved against a key that has since been edited — rendered
 * unchanged and only got trimmed once the learner touched it again. Run this on
 * the hydrated edge list so every player starts from a legal state.
 *
 * Locked sample edges are placed first regardless of where they sit in the
 * stored answer; the rest are accepted in stored order, which is the order the
 * learner drew them.
 */
export function clampMatchEdges(
  edges: MatchEdge[],
  { maxOutDegree, maxInDegree }: MatchCardinality,
  protectedKeys?: ReadonlySet<string>,
): MatchEdge[] {
  const out = new Map<string, number>();
  const into = new Map<string, number>();
  const bump = (counts: Map<string, number>, id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  const isProtected = (edge: MatchEdge) => protectedKeys?.has(matchEdgeKey(edge)) === true;
  const kept = new Set<MatchEdge>();
  for (const edge of edges) {
    if (!isProtected(edge)) continue;
    kept.add(edge);
    bump(out, edge.item);
    bump(into, edge.target);
  }
  for (const edge of edges) {
    if (kept.has(edge)) continue;
    if ((out.get(edge.item) ?? 0) >= maxOutDegree) continue;
    if ((into.get(edge.target) ?? 0) >= maxInDegree) continue;
    kept.add(edge);
    bump(out, edge.item);
    bump(into, edge.target);
  }
  return edges.filter((edge) => kept.has(edge));
}

/**
 * True when the answer key maps any single left item to more than one target —
 * a genuine one-to-many matching question. The interactive players use this to
 * decide whether to allow multi-connect (one-to-many) or enforce one target per
 * left item (`singleTargetPerItem`). Edges are already de-duplicated by
 * `(item, target)`, so a repeated `item` means distinct targets.
 */
export function isOneToManyMatch(correctEdges: MatchEdge[]): boolean {
  const seenItems = new Set<string>();
  for (const { item } of correctEdges) {
    if (seenItems.has(item)) return true;
    seenItems.add(item);
  }
  return false;
}

export function matchTargets(edges: MatchEdge[], item: string): string[] {
  return edges.filter((edge) => edge.item === item).map((edge) => edge.target);
}

/** Normalize canonical and legacy edge shapes without collapsing one-to-many edges. */
export function normalizeMatchEdges(
  value: unknown,
  validItems?: ReadonlySet<string>,
  validTargets?: ReadonlySet<string>,
): MatchEdge[] {
  const candidates: MatchEdge[] = [];
  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const edge = raw as Record<string, unknown>;
      const item = nonEmptyId(edge.item ?? edge.left ?? edge.leftId ?? edge.from);
      const target = nonEmptyId(edge.target ?? edge.right ?? edge.rightId ?? edge.to);
      if (item && target) candidates.push({ item, target });
    }
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const singleItem = nonEmptyId(record.item ?? record.left ?? record.leftId ?? record.from);
    const singleTarget = nonEmptyId(record.target ?? record.right ?? record.rightId ?? record.to);
    if (singleItem && singleTarget) candidates.push({ item: singleItem, target: singleTarget });
    else for (const [rawItem, rawTarget] of Object.entries(record)) {
      const item = nonEmptyId(rawItem);
      const target = nonEmptyId(rawTarget);
      if (item && target) candidates.push({ item, target });
    }
  }

  const seen = new Set<string>();
  return candidates.filter(({ item, target }) => {
    if (validItems && !validItems.has(item)) return false;
    if (validTargets && !validTargets.has(target)) return false;
    const key = `${item}\u0000${target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function matchEdgesToRecord(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  for (const edge of normalizeMatchEdges(value)) {
    if (!(edge.item in result)) result[edge.item] = edge.target;
  }
  return result;
}

export function matchRecordToEdges(value: Record<string, string>): MatchEdge[] {
  return Object.entries(value).map(([item, target]) => ({ item, target }));
}

/**
 * Canonical arrays win whenever they carry content. An EMPTY canonical array
 * only wins when the legacy alias is empty/absent too: the backend importer
 * (`_build_type_payload`, matching branch) scaffolds `leftItems: []` /
 * `rightItems: []` onto legacy `items`/`targets` payloads, and per the nxbgd
 * contract an empty-mirror-plus-populated-alias payload is broken data to
 * migrate — no valid payload means "intentionally blank" that way. Falling
 * back to the populated alias renders the real content instead of nothing.
 */
/**
 * Three-column counterpart of `clampMatchEdges`: each hop is trimmed against
 * its own ceiling, then the survivors are returned in their stored order. Edges
 * that join no adjacent pair of columns are dropped — the structural filter the
 * chain players already apply elsewhere.
 */
export function clampMatchEdgesByHop(
  edges: MatchEdge[],
  byHop: { leftToMiddle: MatchCardinality; middleToRight: MatchCardinality },
  { leftIds, middleIds, rightIds }: MatchColumnIds,
  protectedKeys?: ReadonlySet<string>,
): MatchEdge[] {
  const first = edges.filter(({ item, target }) => leftIds.has(item) && middleIds.has(target));
  const second = edges.filter(({ item, target }) => middleIds.has(item) && rightIds.has(target));
  const kept = new Set<MatchEdge>([
    ...clampMatchEdges(first, byHop.leftToMiddle, protectedKeys),
    ...clampMatchEdges(second, byHop.middleToRight, protectedKeys),
  ]);
  return edges.filter((edge) => kept.has(edge));
}

export function resolveMatchingItems(payload: MatchingPayload, side: "left" | "middle" | "right"): MatchingItemInput[] {
  const canonical = side === "left"
    ? payload.leftItems
    : side === "middle"
      ? payload.middleItems
      : payload.rightItems;
  const alias = side === "left" ? payload.items : side === "right" ? payload.targets : undefined;
  const canonicalItems = Array.isArray(canonical) ? filterMatchingItems(canonical) : null;
  if (canonicalItems === null) return filterMatchingItems(alias);
  if (canonicalItems.length === 0) {
    const aliasItems = filterMatchingItems(alias);
    if (aliasItems.length > 0) return aliasItems;
  }
  return canonicalItems;
}

function filterMatchingItems(value: unknown): MatchingItemInput[] {
  return Array.isArray(value)
    ? value.filter((item): item is MatchingItemInput => Boolean(item && typeof item === "object" && nonEmptyId((item as MatchingItemInput).id)))
    : [];
}

/** Canonical display.interactionType wins over the legacy top-level layout alias. */
export function resolveMatchingInteraction(payload: MatchingPayload): string | undefined {
  const canonical = payload.display?.interactionType;
  if (typeof canonical === "string" && canonical.trim()) return canonical;
  return matchingInteractionFromLayoutAlias(payload.display?.layout)
    ?? matchingInteractionFromLayoutAlias(payload.layout);
}

const readColumnTitle = (value: unknown): string => (typeof value === "string" ? value : "");
const MATCHING_TITLE_BLOCK_TYPES = new Set(["paragraph", "heading", "quote"]);

/**
 * Matching column titles are textual RichContent only. Treat malformed, empty,
 * or media/layout content as absent so the synchronized plain `title` fallback
 * remains visible instead of being shadowed by unusable rich data.
 */
function readColumnTitleContent(value: unknown): RichContent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const blocks = (value as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return undefined;
  if (blocks.some((block) => (
    !block ||
    typeof block !== "object" ||
    !MATCHING_TITLE_BLOCK_TYPES.has(String((block as { type?: unknown }).type ?? ""))
  ))) return undefined;
  const content = canonicalizeRichContent(value as RichContent);
  return plainTextFromRichContent(content).trim() ? content : undefined;
}

/** Ba cột: `chain` (chuỗi một-một) và `triad` (giữa là trung tâm, toả nhiều cạnh). */
export const THREE_COLUMN_MATCHING_INTERACTIONS = ["chain", "triad"] as const;

/**
 * Three-column detection for LEGACY-synthesis purposes only (mirrors nxbgd's
 * `isTripleMatching`): explicit `display.interactionType` of `chain`/`triad`, or —
 * when no canonical `columns` array is present — a non-empty `middleItems`
 * mirror. Canonical `columns` payloads never hit this path (columns already
 * declares its own column count/order).
 */
function isThreeColumnMatchingLegacy(payload: MatchingPayload): boolean {
  const interaction = resolveMatchingInteraction(payload);
  if (interaction === "chain" || interaction === "triad") return true;
  if (Object.prototype.hasOwnProperty.call(payload, "columns")) return false;
  const middleItems = (payload as Record<string, unknown>).middleItems;
  return Array.isArray(middleItems) && middleItems.length > 0;
}

export interface MatchingColumnResolved {
  id: "left" | "middle" | "right";
  /** String-or-empty (never undefined) — render a header only when non-empty. */
  title: string;
  /** Canonical styled title. Valid non-empty rich content wins over `title`. */
  titleContent?: RichContent;
  items: MatchingItemInput[];
}

/**
 * Port of nxbgd-sbt-digital's `mColumns` reference algorithm (origin/main
 * index.html:484, CONTENT_SCHEMA_SPECIFICATIONS.md §5.9). Canonical `columns`
 * wins whenever the key is present (even an empty/malformed array). Otherwise
 * synthesize `[{id,title,items}]` from the compat mirrors + legacy
 * `columnALabel/B/C` labels so pre-migration payloads keep rendering
 * per-column titles with NO re-import.
 *
 * Deviation from the literal nxbgd mapping: evo's own MatchingEditor has
 * always written the chain middle-column title to `columnMiddleLabel` (not
 * the contract's `columnBLabel`), and reused `columnBLabel` — not
 * `columnCLabel` — for the chain right-column title. Both evo field names are
 * read as a fallback (after the contract's own field names) so evo's own
 * already-authored chain titles keep rendering too.
 */
export function resolveMatchingColumns(payload: MatchingPayload): MatchingColumnResolved[] {
  const record = payload as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, "columns")) {
    const raw = record.columns;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((col): col is Record<string, unknown> => Boolean(col && typeof col === "object"))
      .map((col) => {
        const titleContent = readColumnTitleContent(col.titleContent);
        return {
          id: (col.id === "left" || col.id === "middle" || col.id === "right" ? col.id : "left") as
            "left" | "middle" | "right",
          title: readColumnTitle(col.title),
          ...(titleContent ? { titleContent } : {}),
          items: filterMatchingItems(col.items),
        };
      });
  }

  const leftTitle = readColumnTitle(record.columnALabel);
  const rightTitleContractName = readColumnTitle(record.columnCLabel);
  const rightTitleEvoLegacyName = readColumnTitle(record.columnBLabel);

  if (isThreeColumnMatchingLegacy(payload)) {
    const middleTitle = readColumnTitle(record.columnMiddleLabel) || readColumnTitle(record.columnBLabel);
    return [
      { id: "left", title: leftTitle, items: resolveMatchingItems(payload, "left") },
      { id: "middle", title: middleTitle, items: resolveMatchingItems(payload, "middle") },
      {
        id: "right",
        title: rightTitleContractName || rightTitleEvoLegacyName,
        items: resolveMatchingItems(payload, "right"),
      },
    ];
  }

  return [
    { id: "left", title: leftTitle, items: resolveMatchingItems(payload, "left") },
    { id: "right", title: rightTitleEvoLegacyName, items: resolveMatchingItems(payload, "right") },
  ];
}

export function resolveMatchingPayload(payload: MatchingPayload) {
  const columns = resolveMatchingColumns(payload);
  const byId = (id: "left" | "middle" | "right") => columns.find((column) => column.id === id);
  const leftItems = byId("left")?.items ?? [];
  const middleItems = byId("middle")?.items ?? [];
  const rightItems = byId("right")?.items ?? [];
  const leftTitle = byId("left")?.title ?? "";
  const middleTitle = byId("middle")?.title ?? "";
  const rightTitle = byId("right")?.title ?? "";
  const leftTitleContent = byId("left")?.titleContent;
  const middleTitleContent = byId("middle")?.titleContent;
  const rightTitleContent = byId("right")?.titleContent;
  const interactionType = resolveMatchingInteraction(payload);
  const leftIds = new Set(leftItems.map((item) => String(item.id)));
  const middleIds = new Set(middleItems.map((item) => String(item.id)));
  const rightIds = new Set(rightItems.map((item) => String(item.id)));
  // Cùng một luật hợp lệ cho cả đáp án lẫn cặp nối mẫu: ba cột (chain/triad) cho phép
  // (trái→giữa) hoặc (giữa→phải), các biến thể còn lại chỉ (trái→phải). Triad dùng chung
  // luật kề cột với chain — chỉ khác cardinality, mà luật kề cột không đụng tới.
  const isThreeColumn = interactionType === "chain" || interactionType === "triad";
  const keepValidEdges = (value: unknown): MatchEdge[] => normalizeMatchEdges(value).filter(
    ({ item, target }) => isThreeColumn
      ? (leftIds.has(item) && middleIds.has(target)) ||
        (middleIds.has(item) && rightIds.has(target))
      : leftIds.has(item) && rightIds.has(target),
  );
  const correctEdges = keepValidEdges(payload.correctAnswer);
  // Trần đọc từ khoá THÔ, trước khi `keepValidEdges` lọc: một cạnh trỏ vào id
  // không tồn tại sẽ làm ô nguồn tụt từ hai đích xuống một, và trần theo đó siết
  // luôn ô đó xuống một nét — học sinh không nối nổi nét thứ hai mà đề in sẵn.
  // Thà nới trần vì dữ liệu hỏng còn hơn chặn một đáp án hợp lệ; dữ liệu hỏng
  // được báo riêng ở `capability-validation`.
  const rawKeyEdges = normalizeMatchEdges(payload.correctAnswer);
  // `Record<fromId, toId>` không giữ nổi một-nhiều (hai entry cùng khoá không
  // sống sót qua JSON). Chỉ dạng object mới có vấn đề này; mảng cạnh thì không.
  const keyIsRecord = Boolean(
    payload.correctAnswer &&
    typeof payload.correctAnswer === "object" &&
    !Array.isArray(payload.correctAnswer),
  );
  const cardinality = matchCardinalityFromKey(rawKeyEdges);
  const cardinalityByHop = matchCardinalityByHop(
    rawKeyEdges,
    { leftIds, middleIds, rightIds },
    interactionType === "triad" && keyIsRecord
      ? {
          centreFanOutCeiling: triadCentreFanOutCeiling(rawKeyEdges, { middleIds, rightIds }),
        }
      : undefined,
  );
  // web#706 — `example`: cặp nối vẽ sẵn cho học sinh bắt chước. Nhận CẢ hai
  // dạng: một object `{item,target,locked?}` và MẢNG cạnh (chain cần 2 cạnh,
  // ví dụ `24 → Gấp 2 lần → 48`).
  const rawExample = payload.example;
  const exampleEdges = keepValidEdges(
    Array.isArray(rawExample) || rawExample == null ? rawExample : [rawExample],
  );
  // `locked` phải đọc từ payload THÔ: normalizeMatchEdges bỏ hẳn key này
  // (matching.test.ts:91-93), không thể khôi phục từ cạnh đã chuẩn hoá. Chỉ
  // dạng object mới mang `locked`; dạng mảng mặc định là khoá.
  const exampleLocked = !(
    rawExample &&
    !Array.isArray(rawExample) &&
    typeof rawExample === "object" &&
    (rawExample as Record<string, unknown>).locked === false
  );
  return {
    interactionType,
    columns,
    leftItems,
    middleItems,
    rightItems,
    leftTitle,
    middleTitle,
    rightTitle,
    leftTitleContent,
    middleTitleContent,
    rightTitleContent,
    // Đáp án lấy DUY NHẤT từ correctAnswer (model single correctAnswer, không
    // có correctPairs fallback). correctAnswer rỗng ({}/[]) → không cặp nào →
    // câu record-only (không key), đúng bản chất.
    correctEdges,
    /** Trần nối suy từ khoá — hai cột dùng `cardinality`, ba cột dùng bản theo chặng. */
    cardinality,
    cardinalityByHop,
    exampleEdges,
    exampleLocked,
  };
}
