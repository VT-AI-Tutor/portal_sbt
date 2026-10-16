/**
 * web#706 — "cặp nối mẫu" (`example`) dùng chung cho MỌI biến thể matching.
 *
 * Năm player columns/lines/rows/radial/chain là bản fork copy-paste của cùng
 * ~120 dòng logic cạnh nối; nếu dán thêm bản sao thứ sáu của logic `example`
 * vào từng file thì mỗi landmine phải sửa năm lần. Hook này gom toàn bộ phần
 * "vẽ sẵn cặp mẫu" lại một chỗ, giữ đúng ngữ nghĩa của bản canon
 * `MatchScenePlayer.tsx:64-90`.
 *
 * Ba cái bẫy đã được mã hoá trực tiếp trong đây:
 *  1. `hasInvalidEdges` PHẢI tính từ bài làm của học sinh TRƯỚC khi ghép cặp
 *     mẫu vào — nếu chỉ prepend vào một trong hai mảng thì cờ này lật và
 *     `grade()` báo "incorrect" cho mọi câu.
 *  2. `hydrationKey` PHẢI tính từ mảng ĐÃ GỘP; prepend ở thời điểm render sẽ
 *     làm `setDraft({ hydrationKey })` ghi một key không khớp key dẫn xuất và
 *     cặp mẫu nhấp nháy biến mất.
 *  3. `locked` KHÔNG bao giờ đi qua `normalizeMatchEdges` (hàm đó bỏ key này);
 *     nó được đọc từ payload thô ở `resolveMatchingPayload` rồi truyền xuống
 *     đây dưới dạng `exampleLocked`.
 */
import { useCallback, useMemo, useRef } from "react";
import {
  matchEdgeKey,
  normalizeMatchEdges,
  type MatchEdge,
} from "@/core/question-schema/matching";

export interface UseMatchingExampleOptions {
  /** The parent's `answer` prop, raw. */
  answer: unknown;
  /** Sample edges from the payload, already parsed by dispatch. May be empty. */
  exampleEdges?: MatchEdge[];
  /** False only when the payload said `locked: false`. Defaults to true. */
  exampleLocked?: boolean;
  validItems: ReadonlySet<string>;
  validTargets: ReadonlySet<string>;
  correctEdges: MatchEdge[];
  /**
   * Optional extra structural filter applied to every edge set. ChainMatchPlayer
   * passes its (left→middle)|(middle→right) validator here. Default: identity.
   */
  filterEdges?: (edges: MatchEdge[]) => MatchEdge[];
  /**
   * Bring a stored answer back within the link ceiling. Runs on the hydrated
   * list, so a saved answer that predates the ceiling — or was saved against a
   * key that has since been edited — cannot render above it. Receives the locked
   * sample keys so those survive the trim. Default: identity.
   */
  clampEdges?: (edges: MatchEdge[], protectedKeys: ReadonlySet<string>) => MatchEdge[];
}

export interface UseMatchingExampleResult {
  /** Sample edges after validation against validItems/validTargets + filterEdges. */
  exampleEdges: MatchEdge[];
  /** Student's answer with the sample edges prepended and de-duped. Use as the hydration source. */
  hydratedEdges: MatchEdge[];
  /** JSON key of hydratedEdges — the MERGED array. Use for the draft/hydrationKey pattern. */
  hydrationKey: string;
  /** Computed from the PRE-prepend arrays. Never let the sample flip this. */
  hasInvalidEdges: boolean;
  /** correctEdges with the sample prepended if absent. Use for EVERY grading comparison. */
  effectiveCorrectEdges: MatchEdge[];
  /** True when `id` is the source side of a LOCKED sample edge. */
  isLockedSource: (id: string) => boolean;
  /** True when a locked sample source has another correct target to connect. */
  canSelectSource: (id: string) => boolean;
  /** True for a sample edge — use for grey/dashed styling + data-edge-locked. */
  isExampleEdge: (edge: MatchEdge) => boolean;
  /** True when an edge is a locked sample edge and must not be removed. */
  isLockedExampleEdge: (edge: MatchEdge) => boolean;
  /** Re-prepend the sample after a toggleMatchEdge call, so it can never be dropped. */
  withExample: (edges: MatchEdge[]) => MatchEdge[];
  /** Drop fully satisfied locked sample source ids from useInstantGrading lists. */
  excludeLockedSources: (ids: string[]) => string[];
  /** Keys of the LOCKED sample edges — pass to toggleMatchEdge as `protectedKeys`. */
  protectedKeys: ReadonlySet<string>;
}

/** Prepend `extra` in front of `edges`, bỏ qua cạnh mà `edges` đã có (so bằng key). */
function prependMissing(extra: MatchEdge[], edges: MatchEdge[]): MatchEdge[] {
  if (extra.length === 0) return edges;
  const present = new Set(edges.map(matchEdgeKey));
  const missing = extra.filter((edge) => !present.has(matchEdgeKey(edge)));
  return missing.length === 0 ? edges : [...missing, ...edges];
}

export function useMatchingExample(
  options: UseMatchingExampleOptions,
): UseMatchingExampleResult {
  const {
    answer,
    exampleEdges: exampleEdgesProp,
    exampleLocked = true,
    validItems,
    validTargets,
    correctEdges,
    filterEdges,
    clampEdges,
  } = options;

  // `filterEdges` thường là một closure mới mỗi lần render (chain dựng nó từ
  // các Set id). Giữ qua ref để không phá memo hoá; các memo bên dưới vẫn phụ
  // thuộc validItems/validTargets — đúng những thứ mà bộ lọc của chain phụ
  // thuộc — nên khi cấu trúc câu hỏi đổi thì mọi thứ tính lại.
  const filterRef = useRef(filterEdges);
  filterRef.current = filterEdges;
  const applyFilter = useCallback(
    (edges: MatchEdge[]): MatchEdge[] => (filterRef.current ? filterRef.current(edges) : edges),
    [],
  );
  // Cùng lý do giữ qua ref như `filterEdges`: bộ siết trần cũng là closure mới
  // mỗi lần render (dựng từ trần suy ra từ khoá).
  const clampRef = useRef(clampEdges);
  clampRef.current = clampEdges;
  const applyClamp = useCallback(
    (edges: MatchEdge[], keys: ReadonlySet<string>): MatchEdge[] => (
      clampRef.current ? clampRef.current(edges, keys) : edges
    ),
    [],
  );

  const sampleEdges = useMemo(
    () => applyFilter(normalizeMatchEdges(exampleEdgesProp ?? [], validItems, validTargets)),
    [applyFilter, exampleEdgesProp, validItems, validTargets],
  );
  const sampleKeys = useMemo(() => new Set(sampleEdges.map(matchEdgeKey)), [sampleEdges]);
  // Chỉ khoá khi payload không nói `locked: false`; lúc mở khoá học sinh được
  // phép xoá/nối lại cặp mẫu như cạnh bình thường.
  const lockedSources = useMemo(
    () => new Set(exampleLocked ? sampleEdges.map((edge) => edge.item) : []),
    [exampleLocked, sampleEdges],
  );
  // Cạnh mẫu ĐÃ KHOÁ: được đếm vào bậc nhưng không bao giờ bị trần đẩy ra.
  // Mẫu mở khoá (`locked: false`) là cạnh thường, nên tập này rỗng.
  const protectedKeys = useMemo(
    () => new Set(exampleLocked ? sampleEdges.map(matchEdgeKey) : []),
    [exampleLocked, sampleEdges],
  );
  // A locked sample only pre-fills one edge. If the answer key has another
  // target for that same source, the source still needs to be selectable and
  // graded for the remaining edge(s). Keep one-to-one samples fully locked.
  const sourcesWithAdditionalAnswers = useMemo(() => {
    const sampleTargetsBySource = new Map<string, Set<string>>();
    for (const edge of sampleEdges) {
      const targets = sampleTargetsBySource.get(edge.item) ?? new Set<string>();
      targets.add(edge.target);
      sampleTargetsBySource.set(edge.item, targets);
    }
    return new Set(
      correctEdges
        .filter((edge) => sampleTargetsBySource.get(edge.item)?.has(edge.target) !== true)
        .map((edge) => edge.item),
    );
  }, [correctEdges, sampleEdges]);
  const fullyLockedSources = useMemo(
    () => new Set(
      Array.from(lockedSources).filter((id) => !sourcesWithAdditionalAnswers.has(id)),
    ),
    [lockedSources, sourcesWithAdditionalAnswers],
  );

  // Landmine 2: hai mảng dưới đây là bài làm của HỌC SINH, chưa có cặp mẫu.
  const rawAnswerEdges = useMemo(() => normalizeMatchEdges(answer), [answer]);
  const answerEdges = useMemo(
    () => applyFilter(normalizeMatchEdges(rawAnswerEdges, validItems, validTargets)),
    [applyFilter, rawAnswerEdges, validItems, validTargets],
  );
  const hasInvalidEdges = rawAnswerEdges.length !== answerEdges.length;

  const hydratedEdges = useMemo(
    () => applyClamp(prependMissing(sampleEdges, answerEdges), protectedKeys),
    [answerEdges, applyClamp, protectedKeys, sampleEdges],
  );
  // Landmine 3: key phải là của mảng ĐÃ GỘP.
  const hydrationKey = JSON.stringify(hydratedEdges);

  const effectiveCorrectEdges = useMemo(
    () => prependMissing(sampleEdges, applyFilter(correctEdges)),
    [applyFilter, correctEdges, sampleEdges],
  );

  const isLockedSource = useCallback(
    (id: string) => lockedSources.has(id),
    [lockedSources],
  );
  const canSelectSource = useCallback(
    (id: string) => !fullyLockedSources.has(id),
    [fullyLockedSources],
  );
  const isExampleEdge = useCallback(
    (edge: MatchEdge) => sampleKeys.has(matchEdgeKey(edge)),
    [sampleKeys],
  );
  const isLockedExampleEdge = useCallback(
    (edge: MatchEdge) => exampleLocked && sampleKeys.has(matchEdgeKey(edge)),
    [exampleLocked, sampleKeys],
  );
  const withExample = useCallback(
    // Khi mở khoá, hàm này là identity — học sinh xoá được cặp mẫu.
    (edges: MatchEdge[]) => (exampleLocked ? prependMissing(sampleEdges, edges) : edges),
    [exampleLocked, sampleEdges],
  );
  const excludeLockedSources = useCallback(
    (ids: string[]) => (fullyLockedSources.size === 0 ? ids : ids.filter((id) => !fullyLockedSources.has(id))),
    [fullyLockedSources],
  );

  return {
    exampleEdges: sampleEdges,
    hydratedEdges,
    hydrationKey,
    hasInvalidEdges,
    effectiveCorrectEdges,
    isLockedSource,
    canSelectSource,
    isExampleEdge,
    isLockedExampleEdge,
    withExample,
    excludeLockedSources,
    protectedKeys,
  };
}
