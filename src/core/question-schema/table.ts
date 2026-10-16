import { inlineHtmlFromRichContent } from '@/core/rich-text/html';
// Vòng phụ thuộc có chủ đích: `table-model.ts` dùng `tableCellText` của file này,
// file này dùng bộ giải của nó. Cả hai chỉ gọi nhau TRONG thân hàm nên chu trình
// ESM này an toàn ở thời điểm nạp module.
import { resolveTableModel } from './table-model';
import type { ResolvedTableRow, ResolvedTableCell, TableSourceModel } from './table-model';
import type {
  RichContent,
  RichContentBlock,
  RichTextRun,
  TableCellSpec,
  TableColumnSpec,
  TableHeaderRowSpec,
  TableHeaderSpec,
  TableQuestionSpec,
  TableRowSpec,
} from './types';

/** A table cell as authored: its label may live in `text`, or entirely inside
 * `content.blocks` (paragraph runs), or both. `content` is typed structurally so
 * both the canonical `RichContent` and the looser editor payload shape
 * (`NxbgdContent`) fit without a cast at the call site. */
export interface TableCellContent {
  blocks?: unknown[];
}

export interface TableCellTextSource {
  text?: unknown;
  content?: TableCellContent | null;
}

/**
 * Canonical resolver for a table cell's label — use it everywhere a cell's text
 * is read (player, editor), never `cell.text` alone.
 *
 * 204 cells in the verified corpus (19 books) carry their label only inside
 * `content.blocks`, 94 of them next to an image block: reading `text` alone
 * renders an image with no caption (#562 class). Returns inline HTML for
 * `RichTextValue`, so authored marks survive.
 */
export function tableCellText(cell: TableCellTextSource | null | undefined): string {
  if (!cell) return '';
  if (typeof cell.text === 'string' && cell.text.trim() !== '') return cell.text;
  return inlineHtmlFromRichContent(asRichContent(cell.content));
}

/**
 * Canonical display value for one header/cell of a `content.blocks` TABLE BLOCK
 * — use it everywhere such a value reaches `PlayerTextValue` (WEB13).
 *
 * The block type declares `headers?: string[]`, but real payloads also carry the
 * question-schema column shape `{ id, label }` (`TableHeaderSpec`) — the same
 * objects `TableCompletionEditor` writes and `normalizeHeaderObjects` already
 * reads on the question path. `InlineMathText` coerces any non-string to `''`,
 * so those headers rendered as a row of EMPTY cells while the `<thead>` still
 * showed (`headers.length > 0`): the column names vanished, which made VBT Toán
 * 1 T2 Bài 17 Câu 6 unanswerable.
 *
 * Order: plain string → canonical runs (returned untouched so inline marks
 * survive) → object label (`label`/`title`/`name`) → `tableCellText`'s
 * `text`/`content.blocks` read. Anything unrecognised is `''`, never
 * `'[object Object]'`.
 */
export function contentTableCellText(value: unknown): string | RichTextRun[] {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value as RichTextRun[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const rawLabel = record.label ?? record.title ?? record.name;
    if (Array.isArray(rawLabel)) return rawLabel as RichTextRun[];
    const label = cellToString(rawLabel);
    if (label) return label;
    return tableCellText(record as TableCellTextSource);
  }
  return cellToString(value);
}

function asRichContent(content: TableCellContent | null | undefined): RichContent | undefined {
  if (!content || !Array.isArray(content.blocks)) return undefined;
  return { ...content, blocks: content.blocks as RichContentBlock[] };
}

/**
 * Patch that makes `text` the ONE source of a cell's label after an edit: the
 * paragraph-like blocks `tableCellText` may have read from are dropped, so the
 * cell can never end up with two competing texts. Media blocks (image, audio,
 * …) are kept — they are rendered separately from the label.
 */
export function tableCellTextPatch<C extends TableCellContent>(
  cell: { text?: unknown; content?: C | null } | null | undefined,
  text: string,
): { text: string; content?: C } {
  const content = cell?.content;
  const blocks = content?.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return { text };
  const kept = stripTextBlocks(blocks);
  if (kept.length === blocks.length && kept.every((block, i) => block === blocks[i])) return { text };
  return { text, content: kept.length ? ({ ...content, blocks: kept } as C) : undefined };
}

/** Drop the blocks `tableCellText` reads, including inside layout columns. */
function stripTextBlocks(blocks: unknown[]): unknown[] {
  return blocks.flatMap((raw) => {
    const block = raw as RichContentBlock;
    const type = String(block?.type ?? '');
    if (['paragraph', 'heading', 'quote'].includes(type)) return [];
    if (type === 'layout') {
      const columns = (block.columns ?? []).map((column) => stripTextBlocks(column) as RichContentBlock[]);
      if (columns.every((column) => column.length === 0)) return [];
      return [{ ...block, columns }];
    }
    return [raw];
  });
}

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Canonical display-only dimension for table input/essay cells (GAP-198). */
function normalizeTableCellDimension(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  const match = /^(\d+(?:\.\d+)?)rem$/.exec(normalized);
  if (!match) return undefined;
  const rem = Number(match[1]);
  return Number.isFinite(rem) && rem >= 3 && rem <= 20 ? normalized : undefined;
}

export const normalizeTableCellWidth = normalizeTableCellDimension;
export const normalizeTableCellHeight = normalizeTableCellDimension;

export function normalizeTableHeaders(headers: unknown): string[] {
  if (!Array.isArray(headers)) return [];
  return headers.map(cellToString);
}

export function normalizeTableRow(row: unknown, headers: string[] = []): string[] {
  if (Array.isArray(row)) {
    return row.map(cellToString);
  }
  if (row && typeof row === 'object') {
    const record = row as Record<string, unknown>;
    const cells = record.cells ?? record.values;
    if (Array.isArray(cells)) {
      return cells.map(cellToString);
    }
    if (headers.length) {
      return headers.map((header) => cellToString(record[header]));
    }
    return Object.values(record).map(cellToString);
  }
  if (typeof row === 'string') {
    if (row.includes('\t')) return row.split('\t').map((part) => part.trim());
    if (row.includes('|')) return row.split('|').map((part) => part.trim());
    return [row];
  }
  if (headers.length) {
    return headers.map(() => '');
  }
  return [];
}

export function normalizeTableData(table: unknown): { headers: string[]; rows: string[][] } {
  if (!table || typeof table !== 'object') {
    return { headers: [], rows: [] };
  }
  const record = table as Record<string, unknown>;
  const headers = normalizeTableHeaders(record.headers);
  const rawRows = record.rows;
  const rows = Array.isArray(rawRows)
    ? rawRows.map((row) => normalizeTableRow(row, headers))
    : [];
  return { headers, rows };
}

type NormalizedHeader = { id: string; label: string };

function normalizeHeaderObjects(headers: unknown): NormalizedHeader[] {
  if (!Array.isArray(headers)) return [];
  return headers
    .map((header, index) => {
      if (header && typeof header === 'object') {
        const record = header as Record<string, unknown>;
        const label = cellToString(record.label ?? record.title ?? record.name);
        if (!label) return null;
        const id = cellToString(record.id) || `col_${index + 1}`;
        return { id, label };
      }
      const label = cellToString(header);
      if (!label) return null;
      return { id: `col_${index + 1}`, label };
    })
    .filter((header): header is NormalizedHeader => Boolean(header));
}

/**
 * Ô bảng sau chuẩn hoá: đủ mọi trường của `TableCellSpec`, CỘNG mọi khoá lạ của
 * ô gốc (ví dụ `correct` do trình soạn ghi cho ô tick). Chuẩn hoá này không được
 * làm mất dữ liệu — thứ duy nhất bị bỏ là `width`/`height` ngoài dải 3–20rem
 * hoặc nằm trên ô không phải input/essay (GAP-198), và `acceptedAnswers` tự khai
 * trên ô nhập được (nguồn chuẩn là `correctAnswer["rowId__columnId"]`).
 */
export interface NormalizedTableCell extends TableCellSpec {
  [key: string]: unknown;
}

export interface NormalizedTableRow extends TableRowSpec {
  cells: NormalizedTableCell[];
  [key: string]: unknown;
}

export interface NormalizedTableHeaderRow extends TableHeaderRowSpec {
  /** Luôn có sau khi giải: bộ giải tự sinh id cho tầng tiêu đề thiếu id. */
  id: string;
  cells: NormalizedTableCell[];
  [key: string]: unknown;
}

/**
 * Bảng `table_completion` đã chuẩn hoá cho tầng hiển thị chỉ-đọc
 * (`toRenderableQuestion`). Vừa là mô hình v2 (`columns` + `headerRows` luôn có,
 * kể cả khi nguồn là v1), vừa giữ mặt tiền v1 (`headers`) cho mọi nơi còn đọc nó.
 */
export interface NormalizedTableQuestion extends TableQuestionSpec {
  /** Trục cột chuẩn — LUÔN có; bảng v1 dựng từ `headers`. */
  columns: TableColumnSpec[];
  /** Các tầng tiêu đề đã giải. v1: `caption` (nếu có) + hàng tên cột; rỗng khi
   *  mọi nhãn cột đều trống (186 bảng trong kho — KHÔNG dựng hàng ô rỗng). */
  headerRows: NormalizedTableHeaderRow[];
  /** Mặt tiền v1: cột có nhãn, `{id, label}`. Bảng v1 giữ nguyên kết quả cũ. */
  headers: TableHeaderSpec[];
  rows: NormalizedTableRow[];
  tickGroups?: string[][];
  /** Mô hình nguồn đã phát hiện — người dùng khỏi phải dò lại. */
  sourceModel: TableSourceModel;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  );
}

/**
 * Bản đồ `id hàng đã giải → hàng THÔ`, để lấy lại những khoá mà bộ giải không
 * mang theo. Quy tắc sinh id phải TRÙNG KHÍT với `table-model.ts`
 * (`nonBlank(row.id) ?? "<prefix><n>"`, n đếm trên các phần tử là object),
 * nếu không cặp thô/đã giải sẽ lệch nhau.
 */
function indexRawRows(rows: unknown, prefix: string): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  toRecordArray(rows).forEach((row, index) => {
    const id =
      typeof row.id === 'string' && row.id.trim() !== '' ? row.id : `${prefix}${index + 1}`;
    if (!map.has(id)) map.set(id, row);
  });
  return map;
}

function normalizeResolvedCell(
  cell: ResolvedTableCell,
  raw: Record<string, unknown> | undefined,
): NormalizedTableCell {
  const editable = cell.cellType === 'input' || cell.cellType === 'essay';
  return {
    // Giữ mọi khoá lạ của ô gốc trước, rồi ghi đè bằng giá trị đã giải.
    ...raw,
    columnId: cell.columnId,
    colSpan: cell.colSpan,
    rowSpan: cell.rowSpan,
    cellType: cell.cellType,
    text: cell.text,
    content: cell.content,
    imageUrl: cell.imageUrl,
    rowLines: cell.rowLines,
    acceptedAnswers: cell.acceptedAnswers,
    label: cell.label,
    placeholder: cell.placeholder,
    // GAP-198: kích thước chỉ là gợi ý hiển thị của ô input/essay, 3–20rem.
    width: editable ? normalizeTableCellWidth(cell.width) : undefined,
    height: editable ? normalizeTableCellHeight(cell.height) : undefined,
  };
}

function normalizeResolvedRow(
  row: ResolvedTableRow,
  raw: Record<string, unknown> | undefined,
): NormalizedTableRow {
  const rawCells = toRecordArray(raw?.cells);
  // Hàng `isGroupHeader` được bộ giải gộp thành MỘT ô neo về `columns[0]`, nên
  // không tra được theo `columnId`: lấy thẳng ô thô đầu tiên.
  const groupHeader = raw?.isGroupHeader === true;
  return {
    ...raw,
    id: row.id,
    cells: row.cells.map((cell, index) =>
      normalizeResolvedCell(
        cell,
        groupHeader
          ? rawCells[index]
          : rawCells.find((entry) => String(entry.columnId ?? '') === cell.columnId),
      ),
    ),
  };
}

/**
 * Chuẩn hoá `payload.table` của `table_completion` cho đường đọc chỉ-hiển thị.
 *
 * Nhận CẢ HAI mô hình (spec §5.16.6) qua `resolveTableModel`: bảng v2
 * (`columns`/`headerRows`/`colSpan`/`rowSpan`) và bảng v1 (`headers`/`caption`/
 * `isGroupHeader`) đều cho ra cùng một hình dạng. Bảng v1 luôn ra `sourceModel:
 * "v1"` và `headers` y hệt hợp đồng cũ, nên không có gì đang đọc `headers` bị vỡ.
 *
 * @param table đối tượng `table` của payload (không phải cả payload).
 * @param correctAnswer bản đồ `"rowId__columnId" → đáp án`. Truyền vào thì ô
 *        nhập được sẽ có `acceptedAnswers` giống hệt trình hiển thị.
 */
export function normalizeTableQuestionData(
  table: unknown,
  correctAnswer?: Record<string, unknown>,
): NormalizedTableQuestion {
  const record =
    table && typeof table === 'object' && !Array.isArray(table)
      ? (table as Record<string, unknown>)
      : undefined;
  const model = resolveTableModel(record, correctAnswer);
  const rawHeaderRows = indexRawRows(record?.headerRows, '__header_');
  const rawBodyRows = indexRawRows(record?.rows, 'row_');

  return {
    columns: model.columns,
    headerRows: model.headerRows.map((row) => normalizeResolvedRow(row, rawHeaderRows.get(row.id))),
    // v1: giữ nguyên hàm cũ (đọc cả alias `title`/`name`, tiêu đề dạng chuỗi).
    // v2: nhãn cột thật nằm ở `headerRows`, `columns[].label` chỉ là bản sao phẳng.
    headers:
      model.sourceModel === 'v2'
        ? model.columns
            .filter((column): column is TableColumnSpec & { label: string } => column.label !== undefined)
            .map((column) => ({ id: column.id, label: column.label }))
        : normalizeHeaderObjects(record?.headers),
    caption:
      typeof record?.caption === 'string' && record.caption.trim() !== '' ? record.caption : undefined,
    rows: model.bodyRows.map((row) => normalizeResolvedRow(row, rawBodyRows.get(row.id))),
    // Giữ đúng phân biệt cũ: vắng khoá `tickGroups` ⇒ `undefined`, không phải `[]`.
    tickGroups: Array.isArray(record?.tickGroups) ? model.tickGroups : undefined,
    sourceModel: model.sourceModel,
  };
}

export function normalizeTableBlock(block: RichContentBlock): RichContentBlock {
  if (String(block.type ?? '') !== 'table') return block;
  const { headers, rows } = normalizeTableData(block);
  return { ...block, headers, rows };
}
