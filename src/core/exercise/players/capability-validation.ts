import {
  getQuestionCapability,
  resolveDisplay,
  type DisplayResolution,
} from './manifest';
import {
  normalizeMatchEdges,
  resolveMatchingColumns,
  resolveMatchingInteraction,
} from '@/core/question-schema/matching';
import {
  buildOccupancyGrid,
  detectTableModel,
  resolveTableModel,
  type TableGridProblem,
  type TableGridProblemCode,
} from '@/core/question-schema/table-model';
import type { TableColumnSpec } from '@/core/question-schema/types';
import { resolveColoringConfig } from '@/core/question-schema/coloring';
import { resolveCrosswordConfig } from '@/core/question-schema/crossword';
import { BLANK_MARKER_GLOBAL_RE, blankIdFromMarker } from './blank-markers';

export type RendererCapabilityIssueCode =
  | Extract<DisplayResolution, { ok: false }>['code']
  | 'MISSING_REQUIRED_FIELD'
  | 'DUPLICATE_MATCHING_ID'
  | 'INVALID_CHAIN_EDGE'
  | 'INCOMPLETE_CHAIN_ANSWER_KEY'
  | 'DANGLING_MATCHING_EDGE'
  | 'DIAGRAM_FILL_NO_FILLABLE'
  // --- payload rỗng: hiển thị được nhưng KHÔNG trả lời được (issue #810) ---
  | 'BLANK_ANSWER_KEY_UNREACHABLE'
  | 'COLORING_NO_REGIONS'
  | 'CROSSWORD_NO_ENTRIES'
  // --- bảng v2 (GAP-229, spec §5.16.6) — CHỈ áp cho `sourceModel === "v2"` ---
  | 'TABLE_MISSING_COLUMNS'
  | 'TABLE_DUPLICATE_COLUMN_ID'
  | 'TABLE_DUPLICATE_ROW_ID'
  | 'TABLE_UNKNOWN_COLUMN'
  | 'TABLE_ANCHOR_MISMATCH'
  | 'TABLE_ROW_WIDTH_MISMATCH'
  | 'TABLE_CELL_OVERLAP'
  | 'TABLE_ROWSPAN_OVERFLOW'
  | 'TABLE_INVALID_SPAN'
  | 'TABLE_TICKGROUP_SPAN_AMBIGUOUS';

/**
 * `error` chặn lưu/nhập; `warning` chỉ hiển thị.
 *
 * Chính sách fail-loud cứng (chặn lưu/chặn import khi payload rỗng) đang chờ
 * PROP-072 / GAP-190, nên nhóm chẩn đoán "payload không trả lời được" của issue
 * #810 vào ở mức `warning`: QA thấy ngay trong trình soạn và trong preview,
 * nhưng chưa khoá thao tác trên dữ liệu prod hiện có. Khi quyết định chốt, đổi
 * severity của detector là đủ — mọi cổng đã đọc chung qua
 * `blockingCapabilityIssues`.
 */
export type RendererCapabilityIssueSeverity = 'error' | 'warning';

export interface RendererCapabilityIssue {
  code: RendererCapabilityIssueCode;
  /** Mặc định `error` khi detector không khai báo — cổng chặn giữ nguyên hành vi cũ. */
  severity: RendererCapabilityIssueSeverity;
  path: string;
  type: string;
  interactionType?: string;
  layout?: unknown;
  field?: string;
  message: string;
}

/**
 * Cổng chung cho MỌI nơi chặn thao tác (lưu, trả về QA, hoàn tất sửa, nhập
 * sách, JSON editor). Đừng lọc `severity` tại chỗ: một bản sao thứ hai của luật
 * là cách một cảnh báo lặng lẽ trở thành cổng chặn ở đúng một màn hình.
 */
export function blockingCapabilityIssues(
  issues: RendererCapabilityIssue[],
): RendererCapabilityIssue[] {
  return issues.filter((issue) => issue.severity === 'error');
}

/**
 * Hình dạng detector trả về. Bỏ trống `severity` nghĩa là `error` — mặc định
 * chặn, để một detector mới không vô tình lọt qua cổng vì quên khai báo.
 */
type CapabilityIssueDraft = Omit<RendererCapabilityIssue, 'severity'> & {
  severity?: RendererCapabilityIssueSeverity;
};

function withSeverity(issues: CapabilityIssueDraft[]): RendererCapabilityIssue[] {
  return issues.map((issue) => ({ ...issue, severity: issue.severity ?? 'error' }));
}

function printable(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function resolutionIssue(
  resolution: Extract<DisplayResolution, { ok: false }>,
  path: string,
): CapabilityIssueDraft {
  const detail = resolution.code === 'UNKNOWN_TYPE'
    ? `Loại câu hỏi "${resolution.type || '(trống)'}" không có renderer.`
    : resolution.code === 'UNKNOWN_INTERACTION'
      ? `Kiểu tương tác "${resolution.interactionType || '(trống)'}" không được hỗ trợ cho loại "${resolution.type}".`
      : `Bố cục "${printable(resolution.layout)}" không được hỗ trợ cho ${resolution.type}/${resolution.interactionType}.`;
  return { ...resolution, path, message: `${detail} Vị trí: ${path}.` };
}

function hasRequiredValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value != null;
}

function matchingThreeColumnIssues(
  payload: Record<string, unknown>,
  path: string,
): CapabilityIssueDraft[] {
  // `chain` và `triad` chung mọi luật cấu trúc (đủ ba cột, id duy nhất, cạnh chỉ nối
  // hai cột kề). Khác duy nhất ở cardinality: triad lấy cột giữa làm trung tâm nên một
  // ô giữa toả được nhiều cạnh và KHÔNG bắt buộc đủ hai phía (spec §5.9.3) — vì vậy
  // luật "phải nối được cả hai chặng" ở cuối hàm chỉ áp cho chain.
  const interaction = resolveMatchingInteraction(payload);
  if (interaction !== 'chain' && interaction !== 'triad') return [];
  const variant = interaction;

  // Read the SAME resolved columns as the renderer (canonical `columns` first,
  // legacy mirror/alias fallback lives inside the resolver).
  const columns = resolveMatchingColumns(payload);
  const itemsFor = (id: 'left' | 'middle' | 'right') =>
    columns.find((column) => column.id === id)?.items ?? [];
  const leftItems = itemsFor('left');
  const middleItems = itemsFor('middle');
  const rightItems = itemsFor('right');
  const issues: CapabilityIssueDraft[] = [];
  for (const [field, items] of [
    ['leftItems', leftItems],
    ['middleItems', middleItems],
    ['rightItems', rightItems],
  ] as const) {
    if (items.length > 0) continue;
    issues.push({
      code: 'MISSING_REQUIRED_FIELD',
      path,
      type: 'matching',
      interactionType: variant,
      field,
      message: `Kiểu matching/${variant} yêu cầu trường "${field}" có dữ liệu để tạo đủ ba cột. Vị trí: ${path}.`,
    });
  }
  const allIds = [...leftItems, ...middleItems, ...rightItems].map(({ id }) => String(id));
  const duplicateIds = [...new Set(allIds.filter((id, index) => allIds.indexOf(id) !== index))];
  if (duplicateIds.length > 0) {
    issues.push({
      code: 'DUPLICATE_MATCHING_ID',
      path,
      type: 'matching',
      interactionType: variant,
      field: 'leftItems/middleItems/rightItems',
      message: `Matching ${variant} yêu cầu id duy nhất trên cả ba cột; id trùng: ${duplicateIds.join(', ')}. Vị trí: ${path}.`,
    });
  }

  const leftIds = new Set(leftItems.map(({ id }) => String(id)));
  const middleIds = new Set(middleItems.map(({ id }) => String(id)));
  const rightIds = new Set(rightItems.map(({ id }) => String(id)));
  const hasAnswerKey = payload.correctAnswer != null || payload.correctPairs != null;
  if (!hasAnswerKey) return issues;
  const answerEdges = normalizeMatchEdges(payload.correctAnswer ?? payload.correctPairs);
  const isAdjacentEdge = ({ item, target }: { item: string; target: string }) =>
    (leftIds.has(item) && middleIds.has(target)) ||
    (middleIds.has(item) && rightIds.has(target));
  const adjacentEdges = answerEdges.filter(isAdjacentEdge);
  const invalidEdges = answerEdges.filter((edge) => !isAdjacentEdge(edge));
  if (invalidEdges.length > 0) {
    issues.push({
      code: 'INVALID_CHAIN_EDGE',
      path,
      type: 'matching',
      interactionType: variant,
      field: 'correctAnswer',
      message: `Matching ${variant} chỉ chấp nhận cạnh trái→giữa hoặc giữa→phải; cạnh không hợp lệ: ${invalidEdges.map(({ item, target }) => `${item}→${target}`).join(', ')}. Vị trí: ${path}.`,
    });
  }

  const leftToMiddle = adjacentEdges.filter(
    ({ item, target }) => leftIds.has(item) && middleIds.has(target),
  );
  const middleToRight = adjacentEdges.filter(
    ({ item, target }) => middleIds.has(item) && rightIds.has(target),
  );
  // Ý nhiễu là nội dung hợp lệ: sách giấy vẫn in phương án ở cột trái/giữa/phải
  // mà đáp án không dùng đến (issue #800 — b26_q3 có 7 ý cột phải, đáp án chỉ
  // dùng 6). Spec §5.9.2 không hề yêu cầu đáp án phủ hết mọi ô, và trình hiển
  // thị vẫn vẽ đúng, nên KHÔNG chặn theo độ phủ từng ô nữa.
  //
  // Chỉ còn chặn ca thật sự không chấm được: một chặng của chuỗi hoàn toàn
  // trống, tức mọi ô của cột đó đều thành ý nhiễu và học sinh không có gì để
  // nối đúng.
  if (variant !== 'chain') return issues;

  const missingHops = [
    leftToMiddle.length === 0 ? 'không có cạnh nào trái→giữa' : '',
    middleToRight.length === 0 ? 'không có cạnh nào giữa→phải' : '',
  ].filter(Boolean);
  if (missingHops.length > 0) {
    issues.push({
      code: 'INCOMPLETE_CHAIN_ANSWER_KEY',
      path,
      type: 'matching',
      interactionType: variant,
      field: 'correctAnswer',
      message: `Đáp án matching/chain phải nối được cả hai chặng trái→giữa và giữa→phải; ${missingHops.join('; ')}. Vị trí: ${path}.`,
    });
  }
  return issues;
}

/**
 * Cạnh đáp án trỏ tới một id không có trong cột nào.
 *
 * Trước đây cạnh này chỉ bị lọc âm thầm khi render. Từ khi trần nối đọc từ đáp
 * án, nó còn kéo theo hậu quả thứ hai: một ô lẽ ra có hai đích nay chỉ còn một,
 * trần theo đó siết ô đó xuống một nét và học sinh không nối nổi nét thứ hai mà
 * đề in sẵn. Player chọn nới trần trong ca này, nên chỗ duy nhất còn báo được
 * dữ liệu hỏng là đây.
 */
function matchingDanglingEdgeIssues(
  payload: Record<string, unknown>,
  path: string,
): CapabilityIssueDraft[] {
  if (payload.type !== 'matching') return [];
  const key = payload.correctAnswer ?? payload.correctPairs;
  if (key == null) return [];
  const known = new Set(
    resolveMatchingColumns(payload).flatMap((column) => column.items.map(({ id }) => String(id))),
  );
  if (known.size === 0) return [];
  const dangling = normalizeMatchEdges(key).filter(
    ({ item, target }) => !known.has(item) || !known.has(target),
  );
  if (dangling.length === 0) return [];
  return [{
    code: 'DANGLING_MATCHING_EDGE',
    path,
    type: 'matching',
    interactionType: resolveMatchingInteraction(payload),
    field: 'correctAnswer',
    message: `Đáp án matching có cạnh trỏ tới ô không tồn tại: ${dangling
      .map(({ item, target }) => `${item}→${target}`)
      .join(', ')}. Vị trí: ${path}.`,
  }];
}

function diagramFillIssues(
  payload: Record<string, unknown>,
  path: string,
): CapabilityIssueDraft[] {
  if (payload.type !== 'diagram_fill') return [];
  const nodes = Array.isArray(payload.nodes)
    ? payload.nodes.filter(
        (node): node is Record<string, unknown> =>
          Boolean(node) && typeof node === 'object' && !Array.isArray(node),
      )
    : [];
  if (nodes.length === 0) return [];
  if (nodes.some((node) => node.fillable)) return [];

  // Zero fillable nodes = the diagram renders as static labels only and the
  // learner cannot answer. Fail loudly instead of deriving fillability —
  // the stored data must carry the flag (CONTENT_SCHEMA spec §5.29).
  const answerKeys =
    payload.correctAnswer && typeof payload.correctAnswer === 'object' && !Array.isArray(payload.correctAnswer)
      ? Object.keys(payload.correctAnswer as Record<string, unknown>)
      : [];
  const detail = answerKeys.length > 0
    ? `correctAnswer có ${answerKeys.length} key (${answerKeys.slice(0, 5).join(', ')}${answerKeys.length > 5 ? ', …' : ''}) nhưng các node tương ứng thiếu cờ "fillable": true.`
    : 'Câu hỏi cũng chưa có correctAnswer để suy ra node cần điền.';
  return [{
    code: 'DIAGRAM_FILL_NO_FILLABLE',
    path,
    type: 'diagram_fill',
    interactionType: 'fill',
    field: 'nodes',
    message: `diagram_fill không có node "fillable" nào — học sinh không thể trả lời. ${detail} Vị trí: ${path}.`,
  }];
}

// ---------------------------------------------------------------------------
// Payload rỗng — hiển thị được nhưng KHÔNG trả lời được (issue #810)
// ---------------------------------------------------------------------------

/**
 * Cả hai detector dưới đây đọc qua ĐÚNG resolver mà trình hiển thị dùng, không
 * đọc thẳng `payload.regions.length` / `payload.entries.length`: một mảng
 * `[null, {}]` là "có dữ liệu" với phép đếm thô nhưng ra 0 vùng/0 ô sau khi
 * resolver lọc — và học sinh nhìn thấy đúng cái màn hình trống ấy.
 *
 * Cả hai ở mức `warning`: chưa chặn lưu/nhập khi PROP-072 / GAP-190 còn mở.
 */
/** Blank ids the renderer can actually reach, parsed out of `content` prose. */
function blankIdsInContent(content: unknown): Set<string> {
  const ids = new Set<string>();
  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      // Fresh regex per string: the shared global constant carries `lastIndex`.
      const re = new RegExp(BLANK_MARKER_GLOBAL_RE.source, 'g');
      for (const match of node.matchAll(re)) {
        const id = blankIdFromMarker(match[0]);
        if (id) ids.add(id);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      Object.values(node as Record<string, unknown>).forEach(visit);
    }
  };
  visit(content);
  return ids;
}

/**
 * `correctAnswer` khai báo một ô trống mà `content` KHÔNG hề có marker tương ứng.
 *
 * Đây chính là dạng lỗi WEB14: chấm điểm duyệt theo khoá của `correctAnswer`
 * (`grading.ts` → `recordEvery`), nên một khoá không bao giờ hiện thành ô nhập
 * khiến câu hỏi KHÔNG THỂ đúng — trong khi trình chơi chỉ đếm các ô đã hiện nên
 * vẫn báo "đúng" cho học sinh. Hiển thị được nhưng không trả lời được: đúng nhóm
 * chẩn đoán của issue #810, nên cùng mức `warning`.
 *
 * CHỈ soi một chiều. Chiều ngược lại (marker trong `content` không có khoá chấm)
 * là hợp lệ và rất phổ biến: các bài "Đặt tính rồi tính" cố ý chừa ô nháp không
 * chấm — cảnh báo chiều đó sẽ tạo nhiễu và khiến người soạn bỏ qua cảnh báo thật.
 */
function blankAnswerKeyIssues(
  payload: Record<string, unknown>,
  path: string,
): CapabilityIssueDraft[] {
  const correctAnswer = payload.correctAnswer;
  if (!correctAnswer || typeof correctAnswer !== 'object' || Array.isArray(correctAnswer)) return [];
  const keys = Object.keys(correctAnswer as Record<string, unknown>);
  if (keys.length === 0) return [];

  // Chỉ các kiểu lấy ô trống từ marker trong prose. `diagram_fill` / `crossword`
  // định vị ô bằng `nodes[]` / `entries[]` nên không nằm trong phạm vi này.
  const type = typeof payload.type === 'string' ? payload.type : '';
  if (type !== 'cloze' && type !== 'fill_blank') return [];

  const reachable = blankIdsInContent(payload.content);
  // Không có marker nào: parseCloze tự dựng ô từ khoá chấm (nhánh dự phòng),
  // nên mọi khoá vẫn tới được học sinh — không phải lỗi.
  if (reachable.size === 0) return [];

  const unreachable = keys.filter((key) => !reachable.has(key));
  if (unreachable.length === 0) return [];

  return [{
    code: 'BLANK_ANSWER_KEY_UNREACHABLE',
    severity: 'warning',
    path,
    type,
    interactionType: 'inline',
    field: 'correctAnswer',
    message:
      `${type}: khoá chấm ${unreachable.map((k) => `"${k}"`).join(', ')} không có marker `
      + `tương ứng trong "content" nên không bao giờ hiện thành ô nhập — học sinh không thể `
      + `làm đúng câu này, dù trình chơi vẫn báo "đúng" khi điền hết các ô đang hiện. `
      + `Marker đọc được: ${[...reachable].map((k) => `"${k}"`).join(', ') || '(không có)'}. `
      + `Vị trí: ${path}.`,
  }];
}

function coloringIssues(
  payload: Record<string, unknown>,
  path: string,
): CapabilityIssueDraft[] {
  if (payload.type !== 'coloring') return [];
  if (resolveColoringConfig(payload).regions.length > 0) return [];
  const rawCount = Array.isArray(payload.regions) ? payload.regions.length : 0;
  const detail = rawCount > 0
    ? `Có ${rawCount} phần tử trong "regions" nhưng không phần tử nào có "id" dạng chuỗi khác rỗng nên trình hiển thị bỏ hết.`
    : 'Payload chưa có trường "regions" hoặc mảng rỗng.';
  return [{
    code: 'COLORING_NO_REGIONS',
    severity: 'warning',
    path,
    type: 'coloring',
    interactionType: 'regions',
    field: 'regions',
    message: `coloring không có vùng tô nào — học sinh chỉ thấy bảng màu và không thể trả lời. ${detail} Vị trí: ${path}.`,
  }];
}

function crosswordIssues(
  payload: Record<string, unknown>,
  path: string,
): CapabilityIssueDraft[] {
  if (payload.type !== 'crossword') return [];
  if (resolveCrosswordConfig(payload).entries.length > 0) return [];
  const rawCount = Array.isArray(payload.entries) ? payload.entries.length : 0;
  const detail = rawCount > 0
    ? `Có ${rawCount} phần tử trong "entries" nhưng không phần tử nào là object hợp lệ nên trình hiển thị bỏ hết.`
    : 'Payload chưa có trường "entries" hoặc mảng rỗng.';
  return [{
    code: 'CROSSWORD_NO_ENTRIES',
    severity: 'warning',
    path,
    type: 'crossword',
    interactionType: 'grid',
    field: 'entries',
    message: `crossword không có mục nào — lưới ô chữ tô đen toàn bộ và không có ô nhập. ${detail} Vị trí: ${path}.`,
  }];
}

// ---------------------------------------------------------------------------
// Bảng v2 — chẩn đoán "báo lỗi to" (GAP-229, spec §5.16.6)
// ---------------------------------------------------------------------------

/**
 * LUẬT QUAN TRỌNG NHẤT: mọi chẩn đoán dưới đây CHỈ chạy khi bảng là v2
 * (`Array.isArray(table.columns)` — cùng một phép phát hiện mà trình hiển thị
 * dùng, `detectTableModel`). Bảng v1 vĩnh viễn khoan dung: 47 câu hỏi đang chạy
 * (125 hàng) có hàng ít ô hơn số cột và phải tiếp tục hiển thị y hệt hôm nay.
 */

type TableSection = 'header' | 'body';

const TABLE_TYPE = 'table_completion';
const TABLE_INTERACTION = 'fill';
/** Số trường hợp liệt kê chi tiết trước khi rút gọn. */
const TABLE_DETAIL_LIMIT = 3;

const TABLE_SECTION_LABEL: Record<TableSection, string> = {
  header: 'hàng tiêu đề',
  body: 'thân bảng',
};

const TABLE_SECTION_FIELD: Record<TableSection, string> = {
  header: 'table.headerRows',
  body: 'table.rows',
};

/** Ánh xạ 1:1 theo tên giữa mã của phép duyệt lưới và mã chẩn đoán. */
const TABLE_GRID_ISSUE_CODE: Record<TableGridProblemCode, RendererCapabilityIssueCode> = {
  ROW_WIDTH_MISMATCH: 'TABLE_ROW_WIDTH_MISMATCH',
  CELL_OVERLAP: 'TABLE_CELL_OVERLAP',
  ROWSPAN_OVERFLOW: 'TABLE_ROWSPAN_OVERFLOW',
  ANCHOR_MISMATCH: 'TABLE_ANCHOR_MISMATCH',
  UNKNOWN_COLUMN: 'TABLE_UNKNOWN_COLUMN',
};

const TABLE_GRID_HEADLINE: Record<TableGridProblemCode, (count: number, columnCount: number) => string> = {
  ROW_WIDTH_MISMATCH: (count, columnCount) =>
    `Bảng v2 yêu cầu mỗi hàng phủ đúng ${columnCount} cột; ${count} hàng không khít`,
  CELL_OVERLAP: (count) => `Bảng v2 có ${count} ô đè lên vùng đã bị ô khác (colSpan/rowSpan) chiếm`,
  ROWSPAN_OVERFLOW: (count) => `Bảng v2 có ${count} ô dùng rowSpan kéo quá hàng cuối`,
  ANCHOR_MISMATCH: (count) =>
    `Bảng v2 yêu cầu columnId của ô khớp đúng vị trí trên lưới; ${count} ô bị lệch`,
  UNKNOWN_COLUMN: (count) => `Bảng v2 có ${count} ô tham chiếu cột không khai báo trong "columns"`,
};

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function nonBlankString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** `cột 3 ("c3")` — chỉ số 1-based cho người đọc, kèm id để tra trong JSON. */
function tableColumnLabel(columns: TableColumnSpec[], index: number | undefined): string {
  if (index == null || index < 0) return 'cột không xác định';
  const id = columns[index]?.id;
  return id ? `cột ${index + 1} ("${id}")` : `cột ${index + 1}`;
}

/** Liệt kê tối đa `TABLE_DETAIL_LIMIT` trường hợp, phần còn lại rút gọn thành số đếm. */
function tableDetailList(parts: string[]): string {
  if (parts.length === 0) return '';
  const head = parts.slice(0, TABLE_DETAIL_LIMIT).join('; ');
  const rest = parts.length - TABLE_DETAIL_LIMIT;
  return rest > 0 ? `${head}; … (+${rest} trường hợp nữa)` : head;
}

function tableFieldFor(sections: Set<TableSection>): string {
  if (sections.size === 1) return TABLE_SECTION_FIELD[[...sections][0]];
  return 'table.rows/table.headerRows';
}

function tableIssue(
  code: RendererCapabilityIssueCode,
  path: string,
  field: string,
  detail: string,
): CapabilityIssueDraft {
  return {
    code,
    path,
    type: TABLE_TYPE,
    interactionType: TABLE_INTERACTION,
    field,
    message: `${detail} Vị trí: ${path}.`,
  };
}

/** Một câu mô tả đủ để mở JSON và sửa: hàng nào, ô nào, lệch bao nhiêu ô. */
function tableGridProblemDetail(problem: TableGridProblem, columns: TableColumnSpec[]): string {
  const section = TABLE_SECTION_LABEL[problem.section];
  const row = `hàng "${problem.rowId}" (${section}, thứ ${problem.rowIndex + 1})`;
  switch (problem.code) {
    case 'ROW_WIDTH_MISMATCH': {
      const empties = problem.emptyColumnIndexes ?? [];
      const parts: string[] = [];
      if (empties.length > 0) {
        parts.push(
          `thiếu ${empties.length} ô tại ${empties.map((index) => tableColumnLabel(columns, index)).join(', ')}`,
        );
      }
      if (problem.overflowColumns) {
        parts.push(`thừa ${problem.overflowColumns} ô tràn khỏi mép phải`);
      }
      return `${row} ${parts.length > 0 ? parts.join(' và ') : 'không phủ đúng số cột'}`;
    }
    case 'CELL_OVERLAP': {
      const overlaps = problem.overlapColumnIndexes ?? [];
      const where = overlaps.length > 0
        ? overlaps.map((index) => tableColumnLabel(columns, index)).join(', ')
        : tableColumnLabel(columns, problem.columnIndex);
      return `${row}: ô "${problem.columnId}" đè lên ${where} đã bị ô khác chiếm`;
    }
    case 'ROWSPAN_OVERFLOW':
      return `ô "${problem.rowId}/${problem.columnId}" (${section}) có rowSpan vượt quá hàng cuối ${problem.overflowRows ?? 1} hàng`;
    case 'ANCHOR_MISMATCH':
      return `${row}: ô khai columnId="${problem.columnId}" nhưng rơi vào ${tableColumnLabel(columns, problem.columnIndex)}`;
    case 'UNKNOWN_COLUMN':
      return `${row}: ô tham chiếu cột "${problem.columnId}" không có trong "columns"`;
    default:
      return row;
  }
}

/** Các id lặp lại, kèm số lần xuất hiện: `"c1" (2 lần)`. */
function duplicateIdParts(ids: string[]): string[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => `"${id}" (${count} lần)`);
}

/** Span hợp lệ = số nguyên >= 1. Bộ giải kẹp giá trị sai về 1 và KHÔNG giữ lại
 *  giá trị gốc, nên phải soi payload thô mới thấy được. */
function isInvalidSpan(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return !(typeof value === 'number' && Number.isInteger(value) && value >= 1);
}

interface RawTableCellRef {
  section: TableSection;
  rowId: string;
  cell: Record<string, unknown>;
}

function rawTableCells(table: Record<string, unknown>): RawTableCellRef[] {
  const refs: RawTableCellRef[] = [];
  for (const [section, key] of [['header', 'headerRows'], ['body', 'rows']] as const) {
    recordArray(table[key]).forEach((row, rowIndex) => {
      const rowId = nonBlankString(row.id) ?? `#${rowIndex + 1}`;
      for (const cell of recordArray(row.cells)) refs.push({ section, rowId, cell });
    });
  }
  return refs;
}

/**
 * Chẩn đoán bảng v2. Không bao giờ ném lỗi: mọi nhánh dữ liệu lạ đều thoát sớm
 * bằng `return []`, giống `diagramFillIssues`.
 *
 * Năm mã (`ROW_WIDTH_MISMATCH`, `CELL_OVERLAP`, `ROWSPAN_OVERFLOW`,
 * `ANCHOR_MISMATCH`, `UNKNOWN_COLUMN`) đến từ `buildOccupancyGrid`. Năm mã còn
 * lại phải tự suy ra từ payload THÔ, vì bộ giải đã chuẩn hoá chúng đi mất.
 */
function tableCompletionIssues(
  payload: Record<string, unknown>,
  path: string,
): CapabilityIssueDraft[] {
  if (payload.type !== TABLE_TYPE) return [];
  const table = isRecord(payload.table) ? payload.table : undefined;
  if (!table) return [];

  // Phát hiện y hệt trình hiển thị: v2 ⇔ `Array.isArray(table.columns)`.
  const isV2 = detectTableModel(table) === 'v2';
  // Trường hợp duy nhất được nới: bảng khai `headerRows` (chỉ v2 mới có trường
  // này — kho 734 câu hỏi v1 không câu nào có) nhưng thiếu hẳn `columns`. Bộ giải
  // sẽ đọc nhầm thành v1 và im lặng đánh rơi cả tầng tiêu đề, nên phải báo.
  const declaresV2HeaderRows = !isV2 && Array.isArray(table.headerRows);
  if (!isV2 && !declaresV2HeaderRows) return [];

  const columnsRaw = recordArray(table.columns);
  if (columnsRaw.length === 0) {
    const cause = declaresV2HeaderRows
      ? `bảng khai báo "headerRows" (${recordArray(table.headerRows).length} tầng) theo kiểu v2 nhưng không có "columns" nào`
      : '"columns" là mảng rỗng';
    return [tableIssue(
      'TABLE_MISSING_COLUMNS',
      path,
      'table.columns',
      `Bảng v2 phải khai báo "columns" với ít nhất một cột — ${cause}; không có trục cột thì không dựng được lưới ô.`,
    )];
  }

  const issues: CapabilityIssueDraft[] = [];
  const model = resolveTableModel(table, isRecord(payload.correctAnswer) ? payload.correctAnswer : undefined);
  const { columns } = model;

  // --- 1. id cột trùng (quét thô) -------------------------------------------
  const duplicateColumnIds = duplicateIdParts(
    columnsRaw.map((column, index) => nonBlankString(column.id) ?? `col_${index + 1}`),
  );
  if (duplicateColumnIds.length > 0) {
    issues.push(tableIssue(
      'TABLE_DUPLICATE_COLUMN_ID',
      path,
      'table.columns',
      `Bảng v2 yêu cầu id cột duy nhất; id trùng: ${duplicateColumnIds.join(', ')} trên tổng ${columnsRaw.length} cột — ô neo vào id trùng sẽ luôn rơi về cột đầu tiên trùng tên.`,
    ));
  }

  // --- 2. id hàng trùng (quét thô, gồm cả tầng tiêu đề) ----------------------
  // Khoá chấm điểm là `rowId__columnId`, nên id hàng trùng làm hai ô khác nhau
  // dùng chung một đáp án.
  const declaredRowIds = [
    ...recordArray(table.headerRows),
    ...recordArray(table.rows),
  ].map((row) => nonBlankString(row.id)).filter((id): id is string => id !== undefined);
  const duplicateRowIds = duplicateIdParts(declaredRowIds);
  if (duplicateRowIds.length > 0) {
    issues.push(tableIssue(
      'TABLE_DUPLICATE_ROW_ID',
      path,
      'table.rows',
      `Bảng v2 yêu cầu id hàng duy nhất; id trùng: ${duplicateRowIds.join(', ')} — khoá đáp án "rowId__columnId" sẽ đụng nhau giữa các hàng này.`,
    ));
  }

  // --- 3. colSpan/rowSpan không phải số nguyên >= 1 (quét thô) ---------------
  // Bộ giải kẹp về 1 và không giữ giá trị gốc, nên chỉ payload thô mới thấy.
  const invalidSpanSections = new Set<TableSection>();
  const invalidSpanParts: string[] = [];
  for (const { section, rowId, cell } of rawTableCells(table)) {
    const offenders = (['colSpan', 'rowSpan'] as const)
      .filter((key) => isInvalidSpan(cell[key]))
      .map((key) => `${key}=${printable(cell[key])}`);
    if (offenders.length === 0) continue;
    invalidSpanSections.add(section);
    invalidSpanParts.push(
      `hàng "${rowId}" (${TABLE_SECTION_LABEL[section]}) ô "${nonBlankString(cell.columnId) ?? '(thiếu columnId)'}": ${offenders.join(', ')}`,
    );
  }
  if (invalidSpanParts.length > 0) {
    issues.push(tableIssue(
      'TABLE_INVALID_SPAN',
      path,
      tableFieldFor(invalidSpanSections),
      `Bảng v2 yêu cầu colSpan/rowSpan là số nguyên >= 1; ${invalidSpanParts.length} ô sai: ${tableDetailList(invalidSpanParts)}. Trình hiển thị đang phải kẹp các giá trị này về 1.`,
    ));
  }

  // --- 4. ô gộp neo bên trong một nhóm tickGroups ----------------------------
  // `tickGroups` là quan hệ loại trừ giữa các cột tích; một ô gộp neo trong nhóm
  // làm nhóm mất đúng một lựa chọn nên không còn xác định được đáp án.
  const groupByColumnId = new Map<string, string[]>();
  for (const group of model.tickGroups) {
    for (const columnId of group) if (!groupByColumnId.has(columnId)) groupByColumnId.set(columnId, group);
  }
  if (groupByColumnId.size > 0) {
    const ambiguousSections = new Set<TableSection>();
    const ambiguousParts: string[] = [];
    for (const [section, rows] of [['header', model.headerRows], ['body', model.bodyRows]] as const) {
      for (const row of rows) {
        for (const cell of row.cells) {
          if (cell.colSpan <= 1 && cell.rowSpan <= 1) continue;
          const group = groupByColumnId.get(cell.columnId);
          if (!group) continue;
          ambiguousSections.add(section);
          ambiguousParts.push(
            `hàng "${row.id}" (${TABLE_SECTION_LABEL[section]}) ô "${cell.columnId}" colSpan=${cell.colSpan}, rowSpan=${cell.rowSpan} nằm trong nhóm [${group.join(', ')}]`,
          );
        }
      }
    }
    if (ambiguousParts.length > 0) {
      issues.push(tableIssue(
        'TABLE_TICKGROUP_SPAN_AMBIGUOUS',
        path,
        tableFieldFor(ambiguousSections),
        `Bảng v2 không cho phép ô gộp neo bên trong một nhóm "tickGroups"; ${ambiguousParts.length} ô: ${tableDetailList(ambiguousParts)}. Ô gộp nuốt mất lựa chọn của nhóm nên quan hệ loại trừ không còn xác định.`,
      ));
    }
  }

  // --- 5. năm mã còn lại đến từ phép duyệt lưới ------------------------------
  const grid = buildOccupancyGrid(model);
  const grouped = new Map<string, { code: TableGridProblemCode; section: TableSection; parts: string[] }>();
  for (const problem of grid.problems) {
    const key = `${problem.code}|${problem.section}`;
    const bucket = grouped.get(key)
      ?? { code: problem.code, section: problem.section, parts: [] };
    bucket.parts.push(tableGridProblemDetail(problem, columns));
    grouped.set(key, bucket);
  }
  for (const { code, section, parts } of grouped.values()) {
    issues.push(tableIssue(
      TABLE_GRID_ISSUE_CODE[code],
      path,
      TABLE_SECTION_FIELD[section],
      `${TABLE_GRID_HEADLINE[code](parts.length, grid.columnCount)}: ${tableDetailList(parts)}.`,
    ));
  }

  return issues;
}

function childQuestionEntries(
  payload: Record<string, unknown>,
  path: string,
): Array<{ payload: Record<string, unknown>; path: string }> {
  const entries: Array<{ payload: Record<string, unknown>; path: string }> = [];
  for (const key of ['children', 'subQuestions', 'questions'] as const) {
    const value = payload[key];
    if (!Array.isArray(value)) continue;
    value.forEach((candidate, index) => {
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        entries.push({
          payload: candidate as Record<string, unknown>,
          path: `${path}.${key}[${index}]`,
        });
      }
    });
  }
  for (const key of ['child', 'question'] as const) {
    const candidate = payload[key];
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      entries.push({
        payload: candidate as Record<string, unknown>,
        path: `${path}.${key}`,
      });
    }
  }
  if (Array.isArray(payload.anchors)) {
    payload.anchors.forEach((anchor, index) => {
      if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) return;
      const question = (anchor as Record<string, unknown>).question;
      if (question && typeof question === 'object' && !Array.isArray(question)) {
        entries.push({
          payload: question as Record<string, unknown>,
          path: `${path}.anchors[${index}].question`,
        });
      }
    });
  }
  return entries;
}

/** Validate renderer support for one canonical payload and all hosted child questions. */
export function validateQuestionPayloadCapabilities(
  payload: Record<string, unknown>,
  path = '$',
): RendererCapabilityIssue[] {
  const type = typeof payload.type === 'string' ? payload.type : String(payload.type ?? '');
  const resolution = resolveDisplay(type, payload);
  const drafts: CapabilityIssueDraft[] = [];
  if (!resolution.ok) {
    drafts.push(resolutionIssue(resolution, path));
  } else {
    // matching/chain column presence is validated by matchingChainIssues on the
    // resolved columns (canonical `columns` included) — the raw payload[field]
    // check would false-positive on canonical payloads without mirrors.
    // Ba cột (chain/triad) đã được matchingThreeColumnIssues kiểm theo cột đã resolve,
    // nên bỏ qua kiểm tra requiredFields thô để không báo trùng.
    const isThreeColumnMatching = resolution.entry.type === 'matching'
      && (resolution.interactionType === 'chain' || resolution.interactionType === 'triad');
    for (const field of isThreeColumnMatching ? [] : resolution.entry.requiredFields ?? []) {
      if (hasRequiredValue(payload[field])) continue;
      drafts.push({
        code: 'MISSING_REQUIRED_FIELD',
        path,
        type: resolution.entry.type,
        interactionType: resolution.interactionType,
        field,
        message: `Kiểu ${resolution.entry.type}/${resolution.interactionType} yêu cầu trường "${field}" có dữ liệu. Vị trí: ${path}.`,
      });
    }
    drafts.push(...matchingThreeColumnIssues(payload, path));
    drafts.push(...matchingDanglingEdgeIssues(payload, path));
    drafts.push(...blankAnswerKeyIssues(payload, path));
    drafts.push(...diagramFillIssues(payload, path));
    drafts.push(...coloringIssues(payload, path));
    drafts.push(...crosswordIssues(payload, path));
    drafts.push(...tableCompletionIssues(payload, path));
  }

  const issues = withSeverity(drafts);
  for (const child of childQuestionEntries(payload, path)) {
    issues.push(...validateQuestionPayloadCapabilities(child.payload, child.path));
  }
  return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Discover question payloads inside a book-import JSON document. Valid canonical
 * questions are recognized anywhere; unknown types are also caught when they
 * occur in a known question-bearing field.
 */
export function validateImportedQuestionCapabilities(root: unknown): RendererCapabilityIssue[] {
  const issues: RendererCapabilityIssue[] = [];

  function visit(node: unknown, path: string, questionPosition = false) {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`, questionPosition));
      return;
    }
    if (!isRecord(node)) return;

    if (isRecord(node.payload) && (typeof node.question_type === 'string' || typeof node.payload.type === 'string')) {
      issues.push(...validateQuestionPayloadCapabilities(node.payload, `${path}.payload`));
      return;
    }

    const nodeType = typeof node.type === 'string' ? node.type : undefined;
    if (nodeType && (questionPosition || getQuestionCapability(nodeType))) {
      issues.push(...validateQuestionPayloadCapabilities(node, path));
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      const childIsQuestion = key === 'questions' || key === 'subQuestions' || key === 'children';
      visit(value, `${path}.${key}`, childIsQuestion);
    }
  }

  visit(root, '$');
  return issues;
}
