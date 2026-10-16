/**
 * GAP-229 — bộ giải mô hình bảng `table_completion` (spec §5.16.6).
 *
 * Trình hiển thị KHÔNG bao giờ nhìn thấy v1 hay v2: cả hai chuẩn hoá về MỘT mô
 * hình duy nhất (`ResolvedTableModel`). Đây là toàn bộ ý tưởng thiết kế — một
 * bộ giải, một trình hiển thị, một bộ kiểm tra. Phép biến đổi v1 → chuẩn ở đây
 * cũng chính là phép mà đợt di trú nội dung sau này sẽ áp lên đĩa, nên nó được
 * viết một lần và kiểm thử một lần.
 *
 * NGUYÊN TẮC BẤT DI BẤT DỊCH: `resolveTableModel` KHÔNG BAO GIỜ ném lỗi và
 * không báo lỗi. 47 câu hỏi đang chạy (125 hàng) có hàng thiếu ô so với số cột;
 * chúng phải hiển thị y hệt hôm nay. Việc "báo lỗi to" thuộc về bộ kiểm tra
 * riêng và CHỈ áp cho v2.
 */

import { tableCellText } from './table';
import { itemImageWidth } from './item-image-width';
import type { TableCellType, TableColumnSpec } from './types';

export type TableSourceModel = 'v1' | 'v2';

/** Một ô đã đặt trên lưới, span đã quy về số nguyên cụ thể. */
export interface ResolvedTableCell {
  rowId: string;
  /** Cột neo (trái nhất) của ô. */
  columnId: string;
  /** Vị trí cột của ô neo; `-1` khi `columnId` không khớp cột nào (chỉ xảy ra ở v2). */
  columnIndex: number;
  /** >= 1 */
  colSpan: number;
  /** >= 1 */
  rowSpan: number;
  /** Giá trị lạ/thiếu đã gấp về `"static"`; `"text"` giữ nguyên (alias cũ). */
  cellType: TableCellType;
  /** Nhãn đã giải (đọc cả `content.blocks`); bỏ trống khi rỗng. */
  text?: string;
  content?: unknown;
  imageUrl?: string;
  /** `width` của KHỐI ẢNH đã giải (khác `width` bên dưới — đó là bề rộng Ô). #783 */
  imageWidth?: string;
  width?: string;
  height?: string;
  rowLines?: number;
  /** Chỉ lấy từ `correctAnswer["rowId__columnId"]`, không từ ô. */
  acceptedAnswers?: string[];
  /** Nợ dữ liệu §5.16.5 — chuyển tiếp nguyên vẹn, trình hiển thị bỏ qua. */
  label?: string;
  /** Nợ dữ liệu §5.16.5 — chuyển tiếp nguyên vẹn, trình hiển thị bỏ qua. */
  placeholder?: string;
  /** True khi ô phủ trọn chiều ngang bảng (`colSpan >= columns.length`). */
  isFullWidth: boolean;
}

export interface ResolvedTableRow {
  id: string;
  /** Chỉ các ô NEO, theo thứ tự cột. */
  cells: ResolvedTableCell[];
}

export interface ResolvedTableModel {
  columns: TableColumnSpec[];
  /** Có thể rỗng — hợp lệ, nghĩa là "bảng không có tầng tên cột". */
  headerRows: ResolvedTableRow[];
  bodyRows: ResolvedTableRow[];
  tickGroups: string[][];
  sourceModel: TableSourceModel;
}

// ---------------------------------------------------------------------------
// Lưới chiếm chỗ (occupancy grid)
// ---------------------------------------------------------------------------

/** Một ô đã được ĐẶT vào lưới. `columnIndex` là vị trí THỰC TẾ sau khi bỏ qua
 *  vùng bị `rowSpan` phía trên phủ — có thể lệch với `cell.columnIndex` khi dữ
 *  liệu hỏng (đó chính là `ANCHOR_MISMATCH`). */
export interface TableGridPlacement {
  cell: ResolvedTableCell;
  columnIndex: number;
  colSpan: number;
  rowSpan: number;
}

/** Trạng thái của một ô lưới (một cột trên một hàng). */
export type TableGridSlot =
  /** Ô neo — trình hiển thị phát ra đúng một `<td>`/`<th>` tại đây. */
  | { kind: 'anchor'; placement: TableGridPlacement }
  /** Bị `colSpan`/`rowSpan` của `placement` phủ — không phát ra thẻ nào. */
  | { kind: 'covered'; placement: TableGridPlacement }
  /** Trống — không ô nào chiếm. Ở v2 đây là lỗi `ROW_WIDTH_MISMATCH`. */
  | { kind: 'empty' };

export interface TableGridRow {
  id: string;
  section: 'header' | 'body';
  /** Chỉ số hàng TRONG phần của nó (header hoặc body), tính từ 0. */
  index: number;
  /** Đúng `columnCount` phần tử — góc nhìn theo cột, dùng cho viền/kẻ dọc. */
  slots: TableGridSlot[];
  /** Danh sách phát ra: mỗi phần tử là một thẻ ô, đã theo thứ tự trái → phải. */
  placements: TableGridPlacement[];
}

/**
 * Các vấn đề mà chỉ phép duyệt lưới mới phát hiện được. Đây là DỮ LIỆU để bộ
 * kiểm tra đọc, không phải ngoại lệ — `buildOccupancyGrid` không bao giờ ném.
 *
 * Chú ý: `TABLE_INVALID_SPAN`, `TABLE_MISSING_COLUMNS`, `TABLE_DUPLICATE_*` và
 * `TABLE_TICKGROUP_SPAN_AMBIGUOUS` KHÔNG xuất hiện ở đây — chúng phải được kiểm
 * trên payload THÔ hoặc trên `ResolvedTableModel`, vì bộ giải đã kẹp span sai về
 * 1 và không giữ lại giá trị gốc.
 */
export type TableGridProblemCode =
  /** Hàng không phủ đúng `columns.length` (thiếu ô hoặc tràn cột). */
  | 'ROW_WIDTH_MISMATCH'
  /** Ô đè lên vùng đã bị ô khác (thường là `rowSpan` phía trên) chiếm. */
  | 'CELL_OVERLAP'
  /** `rowSpan` kéo quá hàng cuối cùng. */
  | 'ROWSPAN_OVERFLOW'
  /** `columnId` của ô khác với cột tại vị trí lưới tính được (chỉ v2). */
  | 'ANCHOR_MISMATCH'
  /** `columnId` của ô không có trong `columns`. */
  | 'UNKNOWN_COLUMN';

export interface TableGridProblem {
  code: TableGridProblemCode;
  section: 'header' | 'body';
  /** Chỉ số hàng trong phần của nó. */
  rowIndex: number;
  rowId: string;
  /** `columnId` khai báo trên ô gây lỗi (nếu vấn đề gắn với một ô cụ thể). */
  columnId?: string;
  /** Vị trí cột thực tế liên quan tới vấn đề. */
  columnIndex?: number;
  /** ANCHOR_MISMATCH: id cột mà lưới mong đợi tại `columnIndex`. */
  expectedColumnId?: string;
  /** ROW_WIDTH_MISMATCH: các chỉ số cột còn trống (hàng thiếu ô). */
  emptyColumnIndexes?: number[];
  /** ROW_WIDTH_MISMATCH: số cột bị tràn ra ngoài mép phải (hàng thừa ô). */
  overflowColumns?: number;
  /** CELL_OVERLAP: các chỉ số cột bị đè. */
  overlapColumnIndexes?: number[];
  /** ROWSPAN_OVERFLOW: số hàng còn thiếu để `rowSpan` phủ hết. */
  overflowRows?: number;
}

export interface TableGrid {
  columnCount: number;
  headerRows: TableGridRow[];
  bodyRows: TableGridRow[];
  /** Rỗng ⇔ lưới khít hoàn hảo. v1 sau khi chèn ô bù luôn khít. */
  problems: TableGridProblem[];
}

// ---------------------------------------------------------------------------
// Tiện ích nội bộ
// ---------------------------------------------------------------------------

const CELL_TYPES = new Set<string>(['static', 'text', 'input', 'essay', 'tick', 'cross']);
const EDITABLE_CELL_TYPES = new Set<TableCellType>(['input', 'essay', 'tick', 'cross']);
const ALIGNMENTS = new Set<string>(['left', 'center', 'right']);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
}

/** Chuỗi không rỗng sau khi bỏ khoảng trắng, ngược lại `undefined`. */
function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** Span hợp lệ = số nguyên >= 1. Mọi giá trị khác kẹp về 1 (không sửa dữ liệu,
 *  chỉ để lưới còn dựng được). Bộ kiểm tra soi payload thô cho `TABLE_INVALID_SPAN`. */
function positiveInt(value: unknown): number {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(num) && num >= 1 ? num : 1;
}

function toCellType(value: unknown): TableCellType {
  return typeof value === 'string' && CELL_TYPES.has(value) ? (value as TableCellType) : 'static';
}

/** Cùng thứ tự ưu tiên với `dispatch.tsx#contentImageUrl`: `imageUrl` →
 *  `image.url` → khối `image` đầu tiên trong `content.blocks`. */
function cellImageUrl(raw: Record<string, unknown>): string | undefined {
  const flat = nonBlank(raw.imageUrl);
  if (flat) return flat;
  const image = asRecord(raw.image);
  const nested = nonBlank(image?.url);
  if (nested) return nested;
  const content = asRecord(raw.content);
  const blocks = Array.isArray(content?.blocks) ? content.blocks : [];
  for (const block of blocks) {
    const record = asRecord(block);
    if (record && record.type === 'image') {
      const url = nonBlank(record.url);
      if (url) return url;
    }
  }
  return undefined;
}

/** `width` tác giả đặt trên KHỐI ẢNH của ô — chỉ có nghĩa khi ảnh đến TỪ khối đó
 *  (alias phẳng `imageUrl` / `image.url` chỉ mang URL). Cùng luật với
 *  `dispatch.tsx#contentImageWidth` (#783). */
function cellImageWidth(raw: Record<string, unknown>): string | undefined {
  if (nonBlank(raw.imageUrl)) return undefined;
  const image = asRecord(raw.image);
  if (nonBlank(image?.url)) return undefined;
  const content = asRecord(raw.content);
  const blocks = Array.isArray(content?.blocks) ? content.blocks : [];
  for (const block of blocks) {
    const record = asRecord(block);
    if (record && record.type === 'image' && nonBlank(record.url)) return itemImageWidth(record.width);
  }
  return undefined;
}

function normalizeTickGroups(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((group): group is unknown[] => Array.isArray(group))
    .map((group) => group.map(String).filter(Boolean))
    .filter((group) => group.length > 0);
}

/** Khoá chấm điểm — KHÔNG ĐƯỢC ĐỔI (§7 của kế hoạch). Luôn theo cột NEO. */
function answerKey(rowId: string, columnId: string): string {
  return `${rowId}__${columnId}`;
}

function acceptedFor(
  answers: Record<string, unknown> | undefined,
  rowId: string,
  columnId: string,
): string[] | undefined {
  const value = answers?.[answerKey(rowId, columnId)];
  if (value == null) return undefined;
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

// ---------------------------------------------------------------------------
// Giải một ô
// ---------------------------------------------------------------------------

interface CellContext {
  rowId: string;
  columnIndex: number;
  columnCount: number;
  answers: Record<string, unknown> | undefined;
}

/**
 * Giữ NGUYÊN hành vi hiện tại của `dispatch.tsx`:
 *  - ô nhập được (input/essay/tick/cross) lấy `acceptedAnswers` DUY NHẤT từ
 *    `correctAnswer`, và giữ `text` thô (không đọc `content.blocks`);
 *  - ô tĩnh giải `text` qua `tableCellText` và `imageUrl` qua thứ tự ưu tiên
 *    của `contentImageUrl` — bỏ hai bước này là tái phát lỗi ảnh mất chú thích (#562).
 */
function resolveCell(raw: Record<string, unknown>, ctx: CellContext): ResolvedTableCell {
  const columnId = typeof raw.columnId === 'string' ? raw.columnId : String(raw.columnId ?? '');
  const cellType = toCellType(raw.cellType);
  const colSpan = positiveInt(raw.colSpan);
  const editable = EDITABLE_CELL_TYPES.has(cellType);
  const text = editable ? nonBlank(raw.text) : nonBlank(tableCellText(raw));
  const rawAccepted = Array.isArray(raw.acceptedAnswers)
    ? raw.acceptedAnswers.map(String)
    : undefined;

  return {
    rowId: ctx.rowId,
    columnId,
    columnIndex: ctx.columnIndex,
    colSpan,
    rowSpan: positiveInt(raw.rowSpan),
    cellType,
    text,
    content: raw.content ?? undefined,
    imageUrl: editable ? nonBlank(raw.imageUrl) : cellImageUrl(raw),
    imageWidth: editable ? undefined : cellImageWidth(raw),
    width: nonBlank(raw.width),
    height: nonBlank(raw.height),
    rowLines: typeof raw.rowLines === 'number' ? raw.rowLines : undefined,
    acceptedAnswers: editable ? acceptedFor(ctx.answers, ctx.rowId, columnId) : rawAccepted,
    label: nonBlank(raw.label),
    placeholder: nonBlank(raw.placeholder),
    isFullWidth: ctx.columnCount > 0 && colSpan >= ctx.columnCount,
  };
}

/** Ô bù cho hàng v1 thiếu ô: tĩnh, rỗng, chiếm đúng một cột. */
function padCell(rowId: string, column: TableColumnSpec, columnIndex: number): ResolvedTableCell {
  return {
    rowId,
    columnId: column.id,
    columnIndex,
    colSpan: 1,
    rowSpan: 1,
    cellType: 'static',
    isFullWidth: false,
  };
}

/** Ô chiếm trọn chiều ngang (tiêu đề bảng v1, hàng `isGroupHeader`). */
function fullWidthCell(
  rowId: string,
  columns: TableColumnSpec[],
  raw: Record<string, unknown> | undefined,
  answers: Record<string, unknown> | undefined,
): ResolvedTableCell {
  const columnCount = Math.max(columns.length, 1);
  const base = resolveCell(raw ?? {}, {
    rowId,
    columnIndex: 0,
    columnCount,
    answers,
  });
  return {
    ...base,
    // Neo về cột đầu bất kể ô khai báo gì: trong kho dữ liệu 182 hàng
    // `isGroupHeader` luôn neo ở `columns[0].id`, và ô phải phủ trọn hàng.
    columnId: columns[0]?.id ?? base.columnId,
    columnIndex: 0,
    colSpan: columnCount,
    rowSpan: 1,
    isFullWidth: true,
  };
}

// ---------------------------------------------------------------------------
// Phát hiện mô hình
// ---------------------------------------------------------------------------

/**
 * Phân biệt theo CẤU TRÚC: v2 ⇔ `Array.isArray(table.columns)`.
 * `headerRows` có thể hợp lệ là `[]` nên không dùng làm dấu hiệu được.
 */
export function detectTableModel(raw: unknown): TableSourceModel {
  return Array.isArray(asRecord(raw)?.columns) ? 'v2' : 'v1';
}

// ---------------------------------------------------------------------------
// Giải mô hình
// ---------------------------------------------------------------------------

/**
 * Chuẩn hoá cả hai mô hình về dạng chuẩn.
 *
 * KHÔNG BAO GIỜ ném lỗi. Dữ liệu hỏng vẫn cho ra một mô hình dùng được; muốn
 * chẩn đoán "báo lỗi to" thì dùng bộ kiểm tra (chỉ áp cho v2) trên payload thô
 * cộng với `buildOccupancyGrid`.
 *
 * @param raw đối tượng `table` của payload (không phải cả payload).
 * @param correctAnswer bản đồ `"rowId__columnId" → đáp án`, nguồn DUY NHẤT của
 *        `acceptedAnswers`.
 */
export function resolveTableModel(
  raw: unknown,
  correctAnswer?: Record<string, unknown>,
): ResolvedTableModel {
  const table = asRecord(raw) ?? {};
  const answers = asRecord(correctAnswer);
  const sourceModel = detectTableModel(table);
  return sourceModel === 'v2'
    ? resolveV2(table, answers)
    : resolveV1(table, answers);
}

// --- v2: chuyển tiếp thẳng, không bù, không sửa --------------------------------

function resolveV2(
  table: Record<string, unknown>,
  answers: Record<string, unknown> | undefined,
): ResolvedTableModel {
  const columns = asRecordArray(table.columns).map((column, index) => {
    const align = typeof column.align === 'string' && ALIGNMENTS.has(column.align)
      ? (column.align as TableColumnSpec['align'])
      : undefined;
    const spec: TableColumnSpec = { id: nonBlank(column.id) ?? `col_${index + 1}` };
    const label = nonBlank(column.label);
    if (label !== undefined) spec.label = label;
    const width = nonBlank(column.width);
    if (width !== undefined) spec.width = width;
    if (align !== undefined) spec.align = align;
    return spec;
  });
  const indexById = columnIndexMap(columns);

  const resolveRows = (
    rows: Record<string, unknown>[],
    prefix: string,
    inheritColumnLabel: boolean,
  ): ResolvedTableRow[] =>
    rows.map((row, rowIndex) => {
      const id = nonBlank(row.id) ?? `${prefix}${rowIndex + 1}`;
      return {
        id,
        cells: asRecordArray(row.cells).map((cell) => {
          const resolved = resolveCell(cell, {
            rowId: id,
            columnIndex: indexById.get(String(cell.columnId ?? '')) ?? -1,
            columnCount: columns.length,
            answers,
          });
          return inheritColumnLabel ? withColumnLabelFallback(resolved, columns) : resolved;
        }),
      };
    });

  return {
    columns,
    headerRows: resolveRows(asRecordArray(table.headerRows), '__header_', true),
    bodyRows: resolveRows(asRecordArray(table.rows), 'row_', false),
    tickGroups: normalizeTickGroups(table.tickGroups),
    sourceModel: 'v2',
  };
}

/**
 * Nhãn cột "rơi xuống" ô TIÊU ĐỀ trống — CHỈ ở v2, CHỈ trong `headerRows`.
 *
 * Ví dụ chuẩn của spec §5.16.6 khai báo tầng tên cột bằng các ô TRẦN
 * (`{ columnId }`): nhãn thật nằm ở `columns[].label`, tầng tiêu đề chỉ định vị.
 * Không có bước này thì mọi bảng viết đúng đặc tả đều hiện dải tiêu đề trống.
 * (Đường v1 tự dựng tầng này với `text: column.label` nên đã đúng sẵn.)
 *
 * Luật:
 *  - ô có `text`/`content`/ảnh riêng thì giữ nguyên — nội dung tường minh luôn thắng;
 *  - ô trải nhiều cột lấy nhãn của cột NEO, không ghép nhãn các cột bị phủ;
 *  - cột không có `label` thì ô vẫn trống — không bịa chữ;
 *  - ô THÂN không bao giờ thừa kế: ô thân trống là ô trống.
 */
function withColumnLabelFallback(
  cell: ResolvedTableCell,
  columns: TableColumnSpec[],
): ResolvedTableCell {
  if (cell.text !== undefined || cell.content !== undefined || cell.imageUrl !== undefined) {
    return cell;
  }
  const label = cell.columnIndex >= 0 ? columns[cell.columnIndex]?.label : undefined;
  return label === undefined ? cell : { ...cell, text: label };
}

// --- v1: khoan dung, 47 câu hỏi đang chạy phụ thuộc vào nhánh này -------------

function resolveV1(
  table: Record<string, unknown>,
  answers: Record<string, unknown> | undefined,
): ResolvedTableModel {
  const headers = asRecordArray(table.headers);
  const rawRows = asRecordArray(table.rows);
  const columns: TableColumnSpec[] = headers.length
    ? headers.map((header, index) => {
        const spec: TableColumnSpec = { id: nonBlank(header.id) ?? `col_${index + 1}` };
        const label = nonBlank(header.label);
        if (label !== undefined) spec.label = label;
        return spec;
      })
    : // Không có `headers` (0 câu trong kho, nhưng dữ liệu hỏng thì có): dựng
      // trục cột theo thứ tự `columnId` xuất hiện lần đầu, còn hơn bảng trắng.
      deriveColumnsFromRows(rawRows);

  const headerRows: ResolvedTableRow[] = [];

  // Tầng 1: `caption` (nếu có) trải hết chiều ngang, NẰM TRÊN hàng tên cột.
  const caption = typeof table.caption === 'string' ? table.caption.trim() : '';
  if (caption !== '' && columns.length > 0) {
    const rowId = '__caption';
    headerRows.push({
      id: rowId,
      cells: [fullWidthCell(rowId, columns, { cellType: 'static', text: caption }, answers)],
    });
  }

  // Tầng tên cột — CHỈ khi có ít nhất một nhãn không rỗng. 186 bảng có toàn bộ
  // nhãn rỗng/vắng: chúng phải cho `headerRows: []`, KHÔNG phải một hàng ô rỗng.
  if (columns.some((column) => column.label !== undefined)) {
    const rowId = '__header';
    headerRows.push({
      id: rowId,
      cells: columns.map((column, index) => ({
        rowId,
        columnId: column.id,
        columnIndex: index,
        colSpan: 1,
        rowSpan: 1,
        cellType: 'static' as const,
        text: column.label,
        isFullWidth: columns.length === 1,
      })),
    });
  }

  return {
    columns,
    headerRows,
    bodyRows: padV1Rows(columns, rawRows, answers),
    tickGroups: normalizeTickGroups(table.tickGroups),
    sourceModel: 'v1',
  };
}

function deriveColumnsFromRows(rows: Record<string, unknown>[]): TableColumnSpec[] {
  const seen: string[] = [];
  for (const row of rows) {
    for (const cell of asRecordArray(row.cells)) {
      const id = nonBlank(cell.columnId);
      if (id && !seen.includes(id)) seen.push(id);
    }
  }
  return seen.map((id) => ({ id }));
}

/**
 * Bù ô cho hàng v1 thiếu ô — ĐỐI CHIẾU `columnId` ĐÃ KHAI BÁO với `columns[]`,
 * TUYỆT ĐỐI KHÔNG theo số lượng: 76 trong 125 hàng thiếu cần ô bù ở ĐẦU hàng,
 * nên kiểu "thiếu đâu chèn cuối" sẽ đẩy lệch ba phần tư số hàng đó.
 *
 * Phép duyệt có mang theo `rowSpan` từ hàng trên xuống để không chèn ô bù vào
 * vùng đã bị phủ (kho dữ liệu chưa có `rowSpan` ở v1, nhưng kiểu dữ liệu cho phép).
 * Ô có `columnId` mồ côi bị bỏ, giống `normalizeTableQuestionData` hôm nay.
 */
function padV1Rows(
  columns: TableColumnSpec[],
  rawRows: Record<string, unknown>[],
  answers: Record<string, unknown> | undefined,
): ResolvedTableRow[] {
  const columnCount = columns.length;
  /** Số hàng còn lại mà cột thứ i bị `rowSpan` phía trên phủ. */
  const carry = new Array<number>(columnCount).fill(0);

  return rawRows.map((rawRow, rowIndex) => {
    const rowId = nonBlank(rawRow.id) ?? `row_${rowIndex + 1}`;
    const rawCells = asRecordArray(rawRow.cells);

    if (rawRow.isGroupHeader === true) {
      // Hàng tiêu đề nhóm: một ô duy nhất trải hết chiều ngang. Không bù ô.
      for (let i = 0; i < columnCount; i += 1) if (carry[i] > 0) carry[i] -= 1;
      return { id: rowId, cells: [fullWidthCell(rowId, columns, rawCells[0], answers)] };
    }

    const byColumnId = new Map<string, Record<string, unknown>>();
    for (const cell of rawCells) {
      const id = nonBlank(cell.columnId);
      if (id && !byColumnId.has(id)) byColumnId.set(id, cell);
    }

    const occupied = carry.map((remaining) => remaining > 0);
    const cells: ResolvedTableCell[] = [];
    for (let index = 0; index < columnCount; index += 1) {
      if (occupied[index]) continue;
      const raw = byColumnId.get(columns[index].id);
      if (!raw) {
        cells.push(padCell(rowId, columns[index], index));
        continue;
      }
      const cell = resolveCell(raw, { rowId, columnIndex: index, columnCount, answers });
      cells.push(cell);
      for (let k = 1; k < cell.colSpan && index + k < columnCount; k += 1) occupied[index + k] = true;
      if (cell.rowSpan > 1) {
        for (let k = 0; k < cell.colSpan && index + k < columnCount; k += 1) {
          carry[index + k] = cell.rowSpan;
        }
      }
    }

    for (let i = 0; i < columnCount; i += 1) if (carry[i] > 0) carry[i] -= 1;
    return { id: rowId, cells };
  });
}

function columnIndexMap(columns: TableColumnSpec[]): Map<string, number> {
  const map = new Map<string, number>();
  columns.forEach((column, index) => {
    if (!map.has(column.id)) map.set(column.id, index);
  });
  return map;
}

// ---------------------------------------------------------------------------
// Phép duyệt chiếm chỗ
// ---------------------------------------------------------------------------

/**
 * Dựng lưới `<td>` cho cả `headerRows` và `bodyRows`.
 *
 * Hai phần được duyệt ĐỘC LẬP: `rowSpan` không bắc cầu từ `<thead>` sang
 * `<tbody>` (HTML cũng kẹp span trong một nhóm hàng).
 *
 * Trình hiển thị dùng nó thế nào: duyệt `row.placements` theo thứ tự và phát ra
 * đúng một thẻ ô cho mỗi phần tử, kèm `colSpan`/`rowSpan` của nó. `row.slots`
 * là góc nhìn song song theo từng cột, dùng cho viền/kẻ dọc.
 *
 * KHÔNG ném lỗi: mọi bất thường đi vào `problems` dưới dạng dữ liệu tra được.
 */
export function buildOccupancyGrid(model: ResolvedTableModel): TableGrid {
  const columnCount = model.columns.length;
  const problems: TableGridProblem[] = [];
  const strictAnchor = model.sourceModel === 'v2';

  const walk = (rows: ResolvedTableRow[], section: 'header' | 'body'): TableGridRow[] => {
    if (columnCount === 0) {
      return rows.map((row, index) => ({
        id: row.id,
        section,
        index,
        slots: [],
        placements: [],
      }));
    }

    /** Vùng bị `rowSpan` phía trên phủ XUỐNG hàng đang xét: cột neo → ô + số
     *  hàng còn phải phủ tiếp (đã tính cả hàng đang xét). */
    type Pending = { placement: TableGridPlacement; rowsRemaining: number };
    let pending = new Map<number, Pending>();

    const gridRows = rows.map((row, rowIndex) => {
      const slots = Array.from({ length: columnCount }, (): TableGridSlot => ({ kind: 'empty' }));
      /** Ô có `rowSpan` phát sinh Ở hàng này — không bị trừ cho chính hàng này. */
      const opened = new Map<number, Pending>();

      // 1. tô vùng do các ô ở hàng trên trải xuống
      for (const [columnIndex, entry] of pending) {
        for (let k = 0; k < entry.placement.colSpan && columnIndex + k < columnCount; k += 1) {
          slots[columnIndex + k] = { kind: 'covered', placement: entry.placement };
        }
      }

      const placements: TableGridPlacement[] = [];
      let overflowColumns = 0;
      let cursor = 0;

      // 2. đặt các ô neo của hàng này từ trái sang phải
      for (const cell of row.cells) {
        while (cursor < columnCount && slots[cursor].kind !== 'empty') cursor += 1;

        if (cell.columnIndex < 0) {
          // `columnId` không thuộc `columns` — không thể đặt, bỏ qua ô.
          problems.push({
            code: 'UNKNOWN_COLUMN',
            section,
            rowIndex,
            rowId: row.id,
            columnId: cell.columnId,
          });
          continue;
        }

        if (cursor >= columnCount) {
          overflowColumns += cell.colSpan;
          continue;
        }

        if (strictAnchor) {
          if (model.columns[cursor].id !== cell.columnId) {
            problems.push({
              code: 'ANCHOR_MISMATCH',
              section,
              rowIndex,
              rowId: row.id,
              columnId: cell.columnId,
              columnIndex: cursor,
              expectedColumnId: model.columns[cursor].id,
            });
          }
        } else if (cell.columnIndex > cursor && slots[cell.columnIndex].kind === 'empty') {
          // v1: tin vào `columnId`, dịch con trỏ tới đúng cột của nó.
          cursor = cell.columnIndex;
        }

        const placement: TableGridPlacement = {
          cell,
          columnIndex: cursor,
          colSpan: cell.colSpan,
          rowSpan: cell.rowSpan,
        };

        const overlap: number[] = [];
        for (let k = 0; k < cell.colSpan; k += 1) {
          const at = cursor + k;
          if (at >= columnCount) {
            overflowColumns += 1;
            continue;
          }
          if (slots[at].kind !== 'empty') overlap.push(at);
          slots[at] = k === 0 ? { kind: 'anchor', placement } : { kind: 'covered', placement };
        }
        if (overlap.length > 0) {
          problems.push({
            code: 'CELL_OVERLAP',
            section,
            rowIndex,
            rowId: row.id,
            columnId: cell.columnId,
            columnIndex: cursor,
            overlapColumnIndexes: overlap,
          });
        }

        placements.push(placement);
        if (cell.rowSpan > 1) {
          opened.set(cursor, { placement, rowsRemaining: cell.rowSpan - 1 });
        }
        cursor += cell.colSpan;
      }

      // 3. mọi ô lưới phải được chiếm
      const emptyColumnIndexes = slots.reduce<number[]>((acc, slot, index) => {
        if (slot.kind === 'empty') acc.push(index);
        return acc;
      }, []);
      if (emptyColumnIndexes.length > 0 || overflowColumns > 0) {
        problems.push({
          code: 'ROW_WIDTH_MISMATCH',
          section,
          rowIndex,
          rowId: row.id,
          ...(emptyColumnIndexes.length > 0 ? { emptyColumnIndexes } : {}),
          ...(overflowColumns > 0 ? { overflowColumns } : {}),
        });
      }

      // 4. giảm bộ đếm phủ (chỉ với ô đến TỪ hàng trên), bỏ mục đã hết, rồi
      //    nạp các ô `rowSpan` vừa mở ở hàng này.
      const next = new Map<number, Pending>();
      for (const [columnIndex, entry] of pending) {
        if (entry.rowsRemaining > 1) {
          next.set(columnIndex, { placement: entry.placement, rowsRemaining: entry.rowsRemaining - 1 });
        }
      }
      for (const [columnIndex, entry] of opened) next.set(columnIndex, entry);
      pending = next;

      return { id: row.id, section, index: rowIndex, slots, placements };
    });

    // 5. còn sót vùng phủ sau hàng cuối ⇒ `rowSpan` tràn khỏi bảng
    for (const [columnIndex, entry] of pending) {
      problems.push({
        code: 'ROWSPAN_OVERFLOW',
        section,
        rowIndex: rows.length - 1,
        rowId: entry.placement.cell.rowId,
        columnId: entry.placement.cell.columnId,
        columnIndex,
        overflowRows: entry.rowsRemaining,
      });
    }

    return gridRows;
  };

  return {
    columnCount,
    headerRows: walk(model.headerRows, 'header'),
    bodyRows: walk(model.bodyRows, 'body'),
    problems,
  };
}
