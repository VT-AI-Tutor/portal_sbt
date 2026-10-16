/**
 * Pxx — Table completion (fill in the editable cells).
 * schema: table_completion
 *
 * Renders a table. `text`/`static` cells are static; `input`/`essay`/`tick`/`cross`
 * cells are editable. AUTO-graded: every editable cell that carries
 * `acceptedAnswers` must match one of them (trim + lowercase). Editable cells
 * without `acceptedAnswers` are ignored for grading.
 *
 * Emit = Record<cellKey, string> where cellKey = `${rowId}__${columnId}`.
 *
 * GAP-229 — trình hiển thị KHÔNG còn biết bảng là v1 hay v2. Cả hai đi qua
 * `resolveTableModel` để thành MỘT mô hình chuẩn, rồi `buildOccupancyGrid` biến
 * mô hình đó thành lưới chiếm chỗ. Vòng lặp hiển thị chỉ duyệt `row.placements`:
 * mỗi phần tử phát ra ĐÚNG một `<th>`/`<td>` kèm `colSpan`/`rowSpan` của nó.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  AutoGrowInput,
  AutoGrowTextarea,
  PlayerShell,
  ContentImage,
  RichContentBlocks,
  tableStripeClass,
  useGrading,
  useInstantGrading,
  type ContentBlock,
  type PlayerProps,
} from "./shared";
import { useSkin } from "@/core/exercise/skin";
import { ResizeHandle } from "@/core/exercise/field-resize-context";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { getBlockMediaUrl } from "@/core/rich-text/media-blocks";
import { Check, X } from "lucide-react";
import {
  normalizeTableCellHeight,
  normalizeTableCellWidth,
} from "@/core/question-schema/table";
import {
  buildOccupancyGrid,
  resolveTableModel,
  type ResolvedTableCell,
  type ResolvedTableModel,
  type ResolvedTableRow,
  type TableGridPlacement,
  type TableGridRow,
} from "@/core/question-schema/table-model";
import type {
  TableCellType,
  TableColumnSpec,
  TableHeaderRowSpec,
} from "@/core/question-schema/types";

export interface TableFillHeader {
  id: string;
  label: string;
}

/** Spec §5.16.3. `cross` is `tick` with a different glyph — same stored value,
 *  same answer key, same grading; only the mark drawn in the box differs. */
export type TableFillCellType = TableCellType;

/** Cell types the student can type/tap into — everything else (including any
 * unrecognized future type) renders as plain static text, never a blank input. */
const EDITABLE_CELL_TYPES = new Set<TableFillCellType>(["input", "essay", "tick", "cross"]);

/** Ô nhị phân dạng hộp tích: `tick` (✓) và `cross` (✗) chỉ khác dấu hiển thị. */
const TICK_LIKE = new Set<TableFillCellType>(["tick", "cross"]);
const isTickLike = (t: TableFillCellType | undefined) =>
  TICK_LIKE.has(t as TableFillCellType);

/** Đáp án ô tick/cross lưu là chuỗi "true"/"false" — hiện cho người đọc. */
const tickAnswerLabel = (raw: string) => {
  const v = raw.trim().toLowerCase();
  if (v === "true") return "Đúng";
  if (v === "false") return "Sai";
  return raw;
};

/** web-own (SBT-63): khối đáp án vẽ ô tick như bản in: `true` = có dấu, `false` = để trống.
 *  `null` khi khoá lẫn cả hai hoặc lạ — để rơi về nhãn chữ. */
const tickRevealChecked = (answers: string[]): boolean | null => {
  const values = new Set(answers.map((a) => a.trim().toLowerCase()));
  if (values.size !== 1) return null;
  if (values.has("true")) return true;
  if (values.has("false")) return false;
  return null;
};

export interface TableFillCell {
  columnId: string;
  cellType: TableFillCellType;
  text?: string;
  /** Static/text cells may display an image (authored as a content image block). */
  imageUrl?: string;
  /** Authored `width` of that image block, when the author sized it (issue #783). */
  imageWidth?: string;
  /** RichContent — nhãn có thể nằm trong `content.blocks` thay vì `text` (#562). */
  content?: unknown;
  acceptedAnswers?: string[];
  rowLines?: number;
  /** Display-only width for input/essay cells, canonical range 3–20rem. */
  width?: string;
  /** Display-only height for input/essay cells, canonical range 3–20rem. */
  height?: string;
  /** v2 — số cột/hàng ô này gộp. Mặc định 1. */
  colSpan?: number;
  rowSpan?: number;
}

export interface TableFillRow {
  id: string;
  cells: TableFillCell[];
  /** @deprecated v1. Full-width section title spanning every column (one colspan
   * cell) rather than a per-column data row. v2 diễn đạt bằng một ô có
   * `colSpan = columns.length`. */
  isGroupHeader?: boolean;
}

/**
 * Dạng THÔ của bảng (v1, và v2 khi gọi trực tiếp bằng props). Đường đi qua
 * `dispatch` KHÔNG dùng kiểu này — nó truyền thẳng `ResolvedTableModel`.
 */
export interface TableFillTableData {
  /** v1 — trục cột. */
  headers?: TableFillHeader[];
  /** v2 — trục cột, có thêm `width`/`align` mức cột. */
  columns?: TableColumnSpec[];
  /** v2 — các tầng tiêu đề (0..n), thay cho `caption` + hàng tên cột của v1. */
  headerRows?: TableHeaderRowSpec[];
  rows: TableFillRow[];
  /** Column-id groups whose tick cells are mutually exclusive per row. */
  tickGroups?: string[][];
  /** @deprecated v1. Table-wide title rendered as a spanning header row ABOVE the
   * column-name row (2-tier VBT header). Static text/inline-HTML; never editable. */
  caption?: string;
}

export interface TableFillPlayerProps extends PlayerProps {
  /**
   * Mô hình bảng đã giải (`dispatch` truyền vào), hoặc dạng thô v1/v2 khi người
   * gọi dựng props bằng tay.
   */
  table: ResolvedTableModel | TableFillTableData;
  /** Read-only mode without implying submission or grading. */
  disabled?: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();
const cellKey = (rowId: string, columnId: string) => `${rowId}__${columnId}`;
const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** `colSpan`/`rowSpan` = 1 KHÔNG được ghi ra DOM: một thuộc tính `colspan="1"`
 *  thừa sẽ làm mọi bộ chọn `th[colspan]` hiểu nhầm là ô gộp. */
const spanAttr = (value: number) => (value > 1 ? value : undefined);

function isResolvedModel(
  table: ResolvedTableModel | TableFillTableData,
): table is ResolvedTableModel {
  const candidate = table as ResolvedTableModel;
  return Array.isArray(candidate.bodyRows) && Array.isArray(candidate.columns);
}

/**
 * Đường gọi TRỰC TIẾP bằng props: đáp án nằm ngay trên ô (`cell.acceptedAnswers`),
 * còn bộ giải chỉ đọc đáp án từ `correctAnswer["rowId__columnId"]`. Gom đáp án
 * trên ô về đúng bản đồ đó trước khi giải, nếu không mọi lời gọi trực tiếp mất
 * khả năng chấm. Đường qua `dispatch` không đi qua đây (đã có mô hình đã giải).
 */
function acceptedAnswersFromCells(table: TableFillTableData): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const row of table.rows ?? []) {
    for (const cell of row.cells ?? []) {
      if (Array.isArray(cell.acceptedAnswers) && cell.acceptedAnswers.length > 0) {
        answers[cellKey(row.id, cell.columnId)] = cell.acceptedAnswers;
      }
    }
  }
  return answers;
}

function toResolvedModel(table: ResolvedTableModel | TableFillTableData): ResolvedTableModel {
  return isResolvedModel(table)
    ? table
    : resolveTableModel(table, acceptedAnswersFromCells(table));
}

function initialAnswer(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (answer, [key, entry]) => {
      if (typeof entry === "string" || typeof entry === "boolean") {
        answer[key] = String(entry);
      }
      return answer;
    },
    {},
  );
}

function answersEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
}

interface TableTextCellProps {
  cell: ResolvedTableCell;
  fieldId: string;
  ariaLabel: string;
  value: string;
  locked: boolean;
  className: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

/**
 * Ô `essay` trong bảng LUÔN khởi đầu MỘT dòng — kể cả khi tác giả khai
 * `rowLines` (Owner 9/8: "không giữ rowLines tác giả khai, ghi đè thành 1").
 *
 * Vì sao được phép đè ý tác giả ở đây, khác với ảnh/bố cục: ô nay TỰ GIÃN, nên
 * `rowLines` không còn quyết định học sinh viết được bao nhiêu — nó chỉ còn
 * quyết định ô trông cao bao nhiêu LÚC TRỐNG. Không có nội dung nào bị mất,
 * không có thao tác nào bị chặn; đúng ranh giới "smart đổi CỠ, không đổi CÓ GÌ".
 *
 * Cái được: đo kho thật (nxbgd-books-2) có 135 ô essay, **127 ô khai rowLines**
 * với giá trị tới 8 — bảng 5 hàng × ô 8 dòng là hơn 1.500px chỉ để chờ chữ.
 * Khởi đầu một dòng thì bảng gọn, gõ tới đâu nở tới đó.
 */
const TABLE_ESSAY_ROWS = 1;

/**
 * Bề rộng TỐI THIỂU của ô essay khi tác giả không khai `width`.
 *
 * Đo trên `32069345/bai2` câu 5: cột "Lí do" tự co còn **168px** (ô nhập 135px,
 * ~15 ký tự một dòng) vì cột "Việc làm" chữ dài chiếm 395px. Thử từng mức trên
 * chính bảng đó: 28% → ô nhập 181px · 32% → 211px · 36% → 242px · 40% → 273px,
 * cột "Việc làm" tụt tương ứng 355 → 329 → 302 → 276px.
 *
 * KHÔNG dùng phần trăm vì kho có bảng nhiều cột essay: 30 bảng một cột, 5 bảng
 * hai cột, **3 bảng ba cột** — 32% × 3 = 96%, vỡ bố cục. Bề rộng tối thiểu thì
 * tự cộng dồn: một cột được rộng, ba cột thì bảng nới ra và khung đã có sẵn
 * cuộn ngang.
 *
 * 14rem = 224px cho ô (ô nhập ~191px, hơn hôm nay 41%) — quanh mức 32% đo được
 * mà không bóp cột chữ xuống dưới 330px.
 */
const TABLE_ESSAY_MIN_WIDTH = "14rem";

/**
 * Ô có NỞ NGANG theo chữ học sinh gõ hay không. Ô (`TableTextCell`) và sàn cột
 * chữ cạnh nó (`staticCellFloorClass`) phải luôn đồng ý — lệch nhau không vỡ
 * gì, chỉ sai bố cục âm thầm; đừng viết lại luật này ở chỗ thứ ba.
 */
const cellGrowsWide = (
  cell: Pick<ResolvedTableCell, "cellType">,
  spaciousBlanks: boolean,
): boolean => cell.cellType === "input" && spaciousBlanks;

function TableTextCell({
  cell,
  fieldId,
  ariaLabel,
  value,
  locked,
  className,
  onChange,
  onBlur,
}: TableTextCellProps): React.JSX.Element {
  const skin = useSkin();
  const targetRef = useRef<HTMLDivElement>(null);
  const width = normalizeTableCellWidth(cell.width);
  const height = normalizeTableCellHeight(cell.height);
  // Ô tự luận không khai bề rộng thì nhận sàn TABLE_ESSAY_MIN_WIDTH — cột chữ
  // dài bên cạnh nếu không sẽ bóp nó còn ~15 ký tự một dòng.
  const minWidth =
    cell.cellType === "essay" && !width ? TABLE_ESSAY_MIN_WIDTH : undefined;
  // Ô nở ngang thì bề rộng tác giả khai là SÀN, không phải hộp khoá — giữ làm
  // trần thì học sinh gõ dài là nuốt chữ (ca 1 của `blankBoxStyle`). Trình soạn
  // (ca 2) giữ hộp khoá để người soạn thấy đúng con số mình đặt.
  const growsWide = cellGrowsWide(cell, skin.presentation?.spaciousBlanks === true);
  const boxWidth = growsWide ? undefined : width;
  const boxMinWidth = growsWide && width ? width : minWidth;
  const boxClassName = `group relative ${boxWidth ? "" : "w-full"}`;
  const boxStyle =
    boxWidth || height || boxMinWidth
      ? { width: boxWidth, height, minWidth: boxMinWidth }
      : undefined;

  return (
    <div
      ref={targetRef}
      data-table-field-width={width ?? ""}
      data-table-field-height={height ?? ""}
      className={boxClassName}
      style={boxStyle}
    >
      {cell.cellType === "essay" ? (
        <AutoGrowTextarea
          className={className}
          rows={TABLE_ESSAY_ROWS}
          /* Tác giả khai chiều cao ô = khoá hộp; tự giãn sẽ đá nhau với con số
             đó nên nhường tác giả (xem AutoGrowTextarea). */
          fixedHeight={Boolean(height)}
          placeholder="..."
          value={value}
          disabled={locked}
          onChange={onChange}
          onBlur={onBlur}
          aria-label={ariaLabel}
          data-answer-key={fieldId}
        />
      ) : growsWide ? (
        /* Ô nở → cột nở → mọi ô cùng cột nở theo (đều `w-full`), nên bảng thẳng
           hàng thay vì mỗi ô một cỡ. Vẫn là `<input>`: Enter không đẻ ra `\n`,
           chuỗi đáp án emit ra không đổi.

           Không đặt trần — quá trần là `<input>` cuộn ngang và giấu chữ, đúng
           lỗi đang sửa. Bảng vượt khung thì `data-table-scroll-container` nhận.
           Đáp án dài hàng dòng thuộc về ô `essay`. */
        <AutoGrowInput
          className={className}
          wrapperClassName="inline-grid w-max min-w-full align-middle"
          placeholder="..."
          value={value}
          disabled={locked}
          onBlur={onBlur}
          onChange={onChange}
          aria-label={ariaLabel}
          data-answer-key={fieldId}
        />
      ) : (
        <input
          className={className}
          placeholder="..."
          value={value}
          disabled={locked}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          aria-label={ariaLabel}
          data-answer-key={fieldId}
        />
      )}
      <ResizeHandle
        fieldId={fieldId}
        unit="rem"
        axis="xy"
        targetRef={targetRef}
        min={3}
        max={20}
      />
    </div>
  );
}

const TableFillContent: React.FC<TableFillPlayerProps> = ({
  table,
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  disabled = false,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  ...shell
}) => {
  const skin = useSkin();
  const model = useMemo(() => toResolvedModel(table), [table]);
  const grid = useMemo(() => buildOccupancyGrid(model), [model]);
  /** Header + body: một ô nhập được có thể sống trong tầng tiêu đề v2. */
  const allRows = useMemo<ResolvedTableRow[]>(
    () => [...model.headerRows, ...model.bodyRows],
    [model],
  );
  const rowsById = useMemo(() => {
    const map = new Map<string, ResolvedTableRow>();
    for (const row of allRows) if (!map.has(row.id)) map.set(row.id, row);
    return map;
  }, [allRows]);

  const valuesRef = useRef<Record<string, string>>(initialAnswer(answer));
  const [values, setValues] = useState<Record<string, string>>(() => initialAnswer(answer));
  useEffect(() => {
    const next = initialAnswer(answer);
    valuesRef.current = next;
    // Controlled answer snapshots are an external input; keep local UI state in sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues((current) => answersEqual(current, next) ? current : next);
  }, [answer]);
  const { status, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  // Editable cells that carry an answer key.
  const gradableCells = useMemo(
    () =>
      allRows.flatMap((row) =>
        row.cells
          .filter(
            (c) =>
              EDITABLE_CELL_TYPES.has(c.cellType) &&
              Array.isArray(c.acceptedAnswers) &&
              c.acceptedAnswers.length > 0,
          )
          .map((c) => ({ rowId: row.id, cell: c })),
      ),
    [allRows],
  );

  const hasKey = gradableCells.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  const instant = useInstantGrading({
    elementIds: useMemo(
      () => gradableCells.map(({ rowId, cell }) => cellKey(rowId, cell.columnId)),
      [gradableCells],
    ),
    instantFeedback,
    recordOnly,
    buildAnswer: () => ({ ...valuesRef.current }),
    report,
    onElementGraded,
    onProgress,
  });
  const locked = disabled || submitted || (!instant.active && status === "success");

  const setCell = (rowId: string, columnId: string, val: string) => {
    if (locked) return undefined;
    const key = cellKey(rowId, columnId);
    // Spread từ ref (luôn mới nhất), không từ closure `values`: 2 thao tác liền
    // tay trước khi re-render kịp sẽ nuốt thao tác trước (lost update — cùng
    // pattern TrueFalseTablePlayer/CheckboxTablePlayer).
    const next = { ...valuesRef.current, [key]: val };
    if (val === "true") {
      for (const group of model.tickGroups) {
        if (!group.includes(columnId)) continue;
        for (const peer of rowsById.get(rowId)?.cells ?? []) {
          if (isTickLike(peer.cellType) && peer.columnId !== columnId && group.includes(peer.columnId)) {
            next[cellKey(rowId, peer.columnId)] = "false";
          }
        }
      }
    }
    valuesRef.current = next;
    setValues(next);
    if (recordOnly) report(next, "incomplete");
    else onAnswerChange?.(next);
    return next;
  };

  const anyFilled = Object.values(values).some((value) => value.trim().length > 0);

  const cellIsCorrect = (
    rowId: string,
    cell: ResolvedTableCell,
    sourceValues: Record<string, string> = valuesRef.current,
  ) => {
    const accepted = cell.acceptedAnswers ?? [];
    const given = sourceValues[cellKey(rowId, cell.columnId)] ?? "";
    return accepted.map(norm).includes(norm(given));
  };

  const gradeCell = (
    rowId: string,
    cell: ResolvedTableCell,
    sourceValues: Record<string, string> = valuesRef.current,
  ) => {
    const gradable =
      Array.isArray(cell.acceptedAnswers) && cell.acceptedAnswers.length > 0;
    if (!gradable) return;
    const key = cellKey(rowId, cell.columnId);
    const v = (sourceValues[key] ?? "").trim();
    if (v === "") {
      instant.clear(key);
      return;
    }
    instant.grade(key, cellIsCorrect(rowId, cell, sourceValues) ? "correct" : "incorrect");
  };

  const gradeTickChange = (
    rowId: string,
    columnId: string,
    sourceValues: Record<string, string>,
  ) => {
    const row = rowsById.get(rowId);
    if (!row) return;
    const affectedColumns = new Set([columnId]);
    if (sourceValues[cellKey(rowId, columnId)] === "true") {
      for (const group of model.tickGroups) {
        if (!group.includes(columnId)) continue;
        for (const cell of row.cells) {
          if (isTickLike(cell.cellType) && group.includes(cell.columnId)) {
            affectedColumns.add(cell.columnId);
          }
        }
      }
    }
    for (const cell of row.cells) {
      if (isTickLike(cell.cellType) && affectedColumns.has(cell.columnId)) {
        gradeCell(rowId, cell, sourceValues);
      }
    }
  };

  const check = () => {
    if (locked || !anyFilled) return;
    if (recordOnly) {
      report(values, "incomplete");
      return;
    }
    const allCorrect = gradableCells.every(({ rowId, cell }) =>
      cellIsCorrect(rowId, cell, valuesRef.current),
    );
    report(values, allCorrect ? "correct" : "incorrect");
  };

  const showResults = !recordOnly && (submitted || status === "success");

  const inputBase =
    "h-full w-full text-base md:text-lg outline-none px-3 py-2 md:px-4 md:py-3 rounded-2xl border-4 transition-all";
  const inputPlayfulFont = "font-bold placeholder:text-orange-200";
  // Vertical separators between columns so adjacent cells don't read as one
  // merged block. `divide-x` borders every child of the row except the first —
  // which is exactly right per EMITTED cell, kể cả khi ô gộp nhiều cột. Chỗ duy
  // nhất nó hụt là hàng bị `rowSpan` từ trên phủ mất mấy cột đầu: ô đầu tiên
  // phát ra không nằm ở cột 0 nhưng vẫn là "con đầu", nên `leadingDivider` dưới
  // đây kẻ bù viền trái cho nó.
  const columnDivider = "divide-x-2 divide-slate-300 ";
  const dividerBorder = "border-l-2 border-slate-300 ";
  const leadingDivider = (placement: TableGridPlacement, position: number) =>
    position === 0 && placement.columnIndex > 0 ? dividerBorder : "";
  // issue #670: chỉ khi bảng CÓ khai báo dấu theo cột mới đổi sang ô tick tự vẽ
  // (để cột "chưa thực hiện được" hiện dấu ×). Bảng không khai báo gì giữ nguyên
  // checkbox gốc của trình duyệt — không đổi hình thức của mọi câu đã có.
  // Bảng có ô `cross` → vẽ hộp tích thủ công cho MỌI ô tick-like để hai cột
  // trông đồng bộ. Bảng chỉ có `tick` giữ nguyên checkbox gốc của trình duyệt,
  // nên toàn bộ nội dung hiện có không đổi hình thức.
  const tableHasCross = allRows.some((r) => r.cells.some((c) => c.cellType === "cross"));
  /**
   * Sàn cho cột chữ khi bảng có ô nở ngang. Bảng `table-auto` rộng bằng khung
   * nên cột nhập nở ra là lấy chỗ của cột bên cạnh, và trình duyệt bóp cột chữ
   * tới min-content (một từ) TRƯỚC khi chịu cho bảng vượt khung: đo `/dev/players`
   * P45, gõ 59 ký tự thì cột "Quốc gia" tụt 270px còn 76px, "Việt Nam" gãy hai
   * dòng. Có sàn thì hết chỗ là bảng vượt khung và khung cuộn của nó nhận.
   *
   * 7.5rem = 120px: "Việt Nam" ở `text-lg` cần 112px kể cả padding, cộng nét kẻ
   * dọc là 114px — 7rem hụt đúng chỗ đó. Sàn chỉ chặn đáy, không đặt trần.
   *
   * Con số PHẢI nằm nguyên văn trong chuỗi class: Tailwind v4 quét
   * `packages/core/src` tìm class có thật, nên `min-w-[${X}]` không sinh ra CSS
   * nào và sàn biến mất không một tiếng động.
   */
  const staticCellFloorClass = allRows.some((r) =>
    r.cells.some((c) => cellGrowsWide(c, skin.presentation?.spaciousBlanks === true)),
  )
    ? "min-w-[7.5rem]"
    : "";

  /** Căn lề mức CỘT (v2) phải thắng class căn lề mặc định của từng loại ô. */
  const alignClass = (placement: TableGridPlacement, fallback: string): string => {
    const align = model.columns[placement.columnIndex]?.align;
    if (align === "left") return "text-left";
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return fallback;
  };

  /**
   * Hàng "băng ngang": đúng MỘT ô, trải nhiều cột, và không nhập được — tức
   * tiêu đề bảng v1 (`caption`) ở `<thead>` và hàng tiêu đề nhóm
   * (v1 `isGroupHeader`, v2 `colSpan = columns.length`) ở `<tbody>`.
   * Ô trải ngang NHƯNG nhập được vẫn là ô nhập bình thường — spec rule 1 cho
   * phép (b21_q2 hàng `r_input2` là ô nhập full-width và có đáp án thật).
   */
  const isBannerRow = (gridRow: TableGridRow): boolean =>
    gridRow.placements.length === 1 &&
    gridRow.placements[0].colSpan > 1 &&
    !EDITABLE_CELL_TYPES.has(gridRow.placements[0].cell.cellType);

  /**
   * Thứ tự sọc của từng hàng thân bảng, theo vị trí trong `grid.bodyRows`.
   * Hàng banner có nền riêng nên không nhận số: đếm cả banner thì hai hàng dữ
   * liệu kề nhau ngay sau nó rơi vào cùng màu, sọc gãy nhịp giữa bảng.
   */
  const stripeIndexOfRow = new Map<number, number>();
  grid.bodyRows.forEach((gridRow, rowIndex) => {
    if (!isBannerRow(gridRow)) stripeIndexOfRow.set(rowIndex, stripeIndexOfRow.size);
  });

  const renderStaticContent = (cell: ResolvedTableCell, imageClassName?: string) => {
    const rawBlocks =
      cell.content &&
      typeof cell.content === "object" &&
      Array.isArray((cell.content as { blocks?: unknown }).blocks)
        ? (cell.content as { blocks: unknown[] }).blocks.filter(
            (block): block is ContentBlock =>
              Boolean(block) &&
              typeof block === "object" &&
              typeof (block as { type?: unknown }).type === "string",
          )
        : [];
    const blocks =
      model.sourceModel === "v2" && cell.imageUrl
        ? rawBlocks.filter(
            (block) => !(block.type === "image" && getBlockMediaUrl(block) === cell.imageUrl),
          )
        : model.sourceModel === "v2"
          ? rawBlocks
          : [];
    const hasCanonicalText = blocks.some((block) => {
      if (["paragraph", "heading", "quote", "list"].includes(block.type)) return true;
      if (block.type !== "layout") return false;
      const columns = Array.isArray(block.columns) ? block.columns : [];
      return columns.some(
        (column) =>
          Array.isArray(column) &&
          column.some(
            (child) =>
              child &&
              typeof child === "object" &&
              ["paragraph", "heading", "quote", "list"].includes(String(child.type ?? "")),
          ),
      );
    });

    return (
      <>
        {cell.imageUrl && (
          <ContentImage
            src={cell.imageUrl}
            alt={cell.text ?? ""}
            width={cell.imageWidth}
            draggable={false}
            className={imageClassName}
          />
        )}
        {/* `compact` đã tắt thanh accent trong ô bảng — accent nay lấy từ
            AccentContext (#786), không còn là prop. */}
        {blocks.length > 0 && <RichContentBlocks blocks={blocks} compact capImages />}
        {!hasCanonicalText && <RichTextValue value={cell.text} />}
      </>
    );
  };

  const renderBodyCell = (
    rowId: string,
    placement: TableGridPlacement,
    position: number,
  ): React.JSX.Element => {
    const cell = placement.cell;
    const key = cellKey(rowId, cell.columnId);
    const spans = {
      colSpan: spanAttr(placement.colSpan),
      rowSpan: spanAttr(placement.rowSpan),
    };

    if (!EDITABLE_CELL_TYPES.has(cell.cellType)) {
      return (
        <td
          key={placement.columnIndex}
          {...spans}
          className={cx(
            "p-3 md:p-4 text-sm md:text-lg",
            staticCellFloorClass,
            alignClass(placement, ""),
            leadingDivider(placement, position),
            skin.emphasis?.("neutral", "medium") ?? "font-bold text-slate-800",
          )}
        >
          {renderStaticContent(cell)}
        </td>
      );
    }

    const gradable =
      Array.isArray(cell.acceptedAnswers) && cell.acceptedAnswers.length > 0;
    // Instant reveal wins over the post-submit derived state.
    // Fallback (reveal undefined) mirrors FillBlank's blankState:
    // a blank cell is "idle" even when showResults is true — so a
    // cell that was graded then cleared shows idle, not stale red
    // (its trimmed value is empty and cellIsCorrect("") is false).
    const rv = gradable ? instant.reveal(key) : undefined;
    const hasValue = (values[key] ?? "").trim() !== "";
    const correct = rv
      ? rv === "correct"
      : showResults && gradable && hasValue && cellIsCorrect(rowId, cell);
    const wrong = rv
      ? rv === "incorrect"
      : showResults && gradable && hasValue && !cellIsCorrect(rowId, cell);
    const stateCls = correct
      ? "bg-green-50  border-green-400 text-green-700 "
      : wrong
        ? "bg-red-50  border-red-400 text-red-600"
        : "bg-orange-50/50 border-transparent focus:border-orange-200  text-slate-800";
    const inputState = correct ? "correct" : wrong ? "wrong" : "idle";
    const skinned = skin.input?.(inputState);
    const tickStateCls = correct
      ? "ring-2 ring-green-400"
      : wrong
        ? "ring-2 ring-red-400"
        : "ring-1 ring-orange-300 ";
    // Ô tick-like LUÔN là <input type="checkbox"> thật — trạng thái,
    // bàn phím, trình đọc màn hình và đáp án emit không đổi. Khi bảng
    // có ô `cross`, input được ẩn đi và một hộp tự vẽ hiện dấu theo
    // CHÍNH cellType của ô (spec §5.16.3).
    const isCross = cell.cellType === "cross";
    const MarkIcon = isCross ? X : Check;
    const markAria = isCross ? "dấu nhân" : "dấu tích";

    return (
      <td
        key={placement.columnIndex}
        {...spans}
        className={cx(
          "p-3 md:p-4 align-top",
          alignClass(placement, ""),
          leadingDivider(placement, position),
        )}
      >
        {isTickLike(cell.cellType) ? (
          <label className="flex min-h-10 items-center justify-center">
            <input
              type="checkbox"
              checked={values[key] === "true"}
              disabled={locked}
              onChange={(e) => {
                const next = setCell(rowId, cell.columnId, e.target.checked ? "true" : "false");
                if (next && !recordOnly) {
                  gradeTickChange(rowId, cell.columnId, next);
                }
              }}
              aria-label={
                tableHasCross
                  ? `${markAria} — ${rowId} ${cell.columnId}`
                  : `${rowId} ${cell.columnId}`
              }
              data-answer-key={key}
              className={
                tableHasCross
                  ? `peer sr-only ${tickStateCls}`
                  : `h-6 w-6 shrink-0 rounded border-2 border-orange-300 bg-white accent-orange-500 disabled:cursor-not-allowed disabled:opacity-100 ${tickStateCls}`
              }
            />
            {tableHasCross && (
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-orange-300 bg-white text-transparent peer-checked:text-orange-500 peer-disabled:cursor-not-allowed ${tickStateCls}`}
              >
                <MarkIcon size={16} strokeWidth={3.5} />
              </span>
            )}
          </label>
        ) : (
          <TableTextCell
            cell={cell}
            fieldId={key}
            ariaLabel={`${rowId} ${cell.columnId}`}
            value={values[key] ?? ""}
            locked={locked}
            className={`${inputBase} ${
              cell.cellType === "essay" ? "resize-none " : ""
            }${skinned ?? `${inputPlayfulFont} ${stateCls}`}`}
            onChange={(value) => setCell(rowId, cell.columnId, value)}
            onBlur={() => gradeCell(rowId, cell)}
          />
        )}
      </td>
    );
  };

  /**
   * Đáp án của ô: các phương án chấp nhận được, gộp bằng " / ". Ô tick/cross
   * đổi chuỗi lưu trữ "true"/"false" thành Đúng/Sai. `null` = ô này không phải
   * ô có đáp án (ô tĩnh, hoặc ô nhập không khai đáp án).
   */
  const revealAnswerText = (cell: ResolvedTableCell): string | null => {
    const answers = cell.acceptedAnswers ?? [];
    if (!EDITABLE_CELL_TYPES.has(cell.cellType) || answers.length === 0) return null;
    return answers
      .map((a) => (isTickLike(cell.cellType) ? tickAnswerLabel(a) : a))
      .join(" / ");
  };

  /**
   * Khối "Đáp án đúng" dựng lại ĐÚNG lưới của đề — cùng `grid` nên số ô, span
   * và thứ tự cột trùng khít bảng phía trên, đối chiếu được ô nào là đáp án của
   * hàng/cột nào. Ô tĩnh chỉ lấy nhãn chữ (và ảnh đã hạ trần): đây là bản tóm
   * tắt, không dựng lại kích thước ô gốc.
   */
  const revealCell = (placement: TableGridPlacement, header: boolean) => {
    const cell = placement.cell;
    const answer = revealAnswerText(cell);
    // web-own (SBT-63): ô tick in dấu thay vì chữ; nhãn Đúng/Sai lui về aria-label cho trình đọc màn hình.
    const tickChecked =
      answer !== null && isTickLike(cell.cellType)
        ? tickRevealChecked(cell.acceptedAnswers ?? [])
        : null;
    const markProps = { "aria-hidden": true, size: 20, strokeWidth: 3.5 } as const;
    const cellProps = {
      colSpan: spanAttr(placement.colSpan),
      rowSpan: spanAttr(placement.rowSpan),
      className: cx(
        "border border-emerald-200 px-2 py-1 align-middle",
        alignClass(placement, header ? "text-center" : "text-left"),
        answer !== null
          ? "font-bold text-emerald-800"
          : header
            ? "font-semibold text-emerald-700"
            : "text-emerald-900/70",
      ),
    };
    const body =
      tickChecked !== null ? (
        <span
          role="img"
          aria-label={tickChecked ? "Đúng" : "Sai"}
          title={tickChecked ? "Đúng" : "Sai"}
          className="flex min-h-6 items-center justify-center"
        >
          {tickChecked &&
            (cell.cellType === "cross" ? <X {...markProps} /> : <Check {...markProps} />)}
        </span>
      ) : answer !== null ? (
        answer
      ) : (
        <>
          {cell.imageUrl && (
            <ContentImage
              src={cell.imageUrl}
              alt={cell.text ?? ""}
              maxHeight="3rem"
              draggable={false}
              className="mx-auto"
            />
          )}
          <RichTextValue value={cell.text} />
        </>
      );
    return header ? (
      <th key={placement.columnIndex} {...cellProps}>
        {body}
      </th>
    ) : (
      <td key={placement.columnIndex} {...cellProps}>
        {body}
      </td>
    );
  };

  const reveal = !recordOnly ? (
    <div className="max-w-full overflow-x-auto">
      <table className="border-collapse text-sm md:text-base">
        {grid.headerRows.length > 0 && (
          <thead>
            {grid.headerRows.map((gridRow, rowIndex) => (
              <tr key={gridRow.id ?? `hrow-${rowIndex}`}>
                {gridRow.placements.map((placement) => revealCell(placement, true))}
              </tr>
            ))}
          </thead>
        )}
        <tbody>
          {grid.bodyRows.map((gridRow, rowIndex) => (
            <tr key={gridRow.id ?? `brow-${rowIndex}`}>
              {gridRow.placements.map((placement) => revealCell(placement, false))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : undefined;

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div className={`min-w-0 max-w-full overflow-hidden ${skin.panel?.("table") ?? "bg-white rounded-[24px] border-2 border-slate-300 shadow-2xl"}`}>
        <div
          role="region"
          aria-label="Bảng điền câu trả lời"
          tabIndex={0}
          data-table-scroll-container
          className="max-w-full overflow-x-auto overscroll-x-contain touch-pan-x"
        >
          <table className="w-full min-w-[36rem] border-collapse">
            {/* Chiều rộng + căn lề mức CỘT của v2. `<col>` chỉ mang được width,
                nên căn lề còn được áp lại trên từng ô (`alignClass`). */}
            {model.columns.length > 0 && (
              <colgroup>
                {/* key phòng thủ: dữ liệu gọi trực tiếp có thể thiếu id (demo/legacy)
                    — fallback index để React không cảnh báo missing key. */}
                {model.columns.map((column, columnIndex) => (
                  <col
                    key={column.id ?? `col-${columnIndex}`}
                    data-column-id={column.id}
                    data-column-align={column.align ?? ""}
                    style={column.width ? { width: column.width } : undefined}
                  />
                ))}
              </colgroup>
            )}
            {/* Tầng tiêu đề: 0 tầng là HỢP LỆ (186 bảng trong kho không có nhãn
                cột nào) — không dựng hàng ô rỗng để lấp chỗ. */}
            {grid.headerRows.length > 0 && (
              <thead className={skin.accent?.("primary", "band") ?? "bg-orange-100"}>
                {grid.headerRows.map((gridRow, rowIndex) => {
                  const banner = isBannerRow(gridRow);
                  return (
                    <tr key={gridRow.id ?? `hrow-${rowIndex}`} className={banner ? undefined : columnDivider}>
                      {gridRow.placements.map((placement, position) => (
                        <th
                          key={placement.columnIndex}
                          colSpan={spanAttr(placement.colSpan)}
                          rowSpan={spanAttr(placement.rowSpan)}
                          className={cx(
                            "p-3 md:p-4 border-b-2 border-slate-300",
                            // Không ép `uppercase`: tiêu đề là nội dung tác giả nhập
                            // (biến toán học `a × b`, nhãn chữ thường…) nên player
                            // phải hiển thị nguyên văn hoa/thường — xem issue #820.
                            banner ? "text-sm md:text-base" : "text-sm md:text-base tracking-wide",
                            alignClass(placement, "text-center"),
                            leadingDivider(placement, position),
                            skin.emphasis?.("primary", "strong") ??
                              (banner
                                ? "border-slate-300 text-orange-500 font-black"
                                : "border-slate-300 text-orange-400 font-black"),
                          )}
                        >
                          {renderStaticContent(placement.cell, banner ? "mx-auto" : undefined)}
                        </th>
                      ))}
                    </tr>
                  );
                })}
              </thead>
            )}
            <tbody className="divide-y-2 divide-slate-300 ">
              {grid.bodyRows.map((gridRow, rowIndex) => {
                if (isBannerRow(gridRow)) {
                  // Section title spanning the whole table (kẻ ngang cả bảng).
                  // Ô được giải theo cột NEO — không còn đọc `row.cells[0]`.
                  const placement = gridRow.placements[0];
                  return (
                    <tr key={gridRow.id ?? `brow-${rowIndex}`}>
                      <td
                        colSpan={spanAttr(placement.colSpan)}
                        rowSpan={spanAttr(placement.rowSpan)}
                        className={cx(
                          "p-3 md:p-4 text-sm md:text-lg",
                          alignClass(placement, "text-center"),
                          skin.accent?.("primary", "band") ?? "bg-orange-100",
                          skin.emphasis?.("primary", "strong") ?? "font-black text-orange-500",
                        )}
                      >
                        {renderStaticContent(placement.cell, "mx-auto")}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr
                    key={gridRow.id ?? `brow-${rowIndex}`}
                    className={`transition-colors ${tableStripeClass(
                      skin,
                      stripeIndexOfRow.get(rowIndex) ?? rowIndex,
                      "bg-orange-50/60",
                    )} hover:bg-orange-200/60 ${columnDivider}`}
                  >
                    {gridRow.placements.map((placement, position) =>
                      renderBodyCell(gridRow.id, placement, position),
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* mode "parent": ẩn nút tự-chấm — cha chấm; đáp án đã emit từng ô. */}
      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={check}
          disabled={!anyFilled}
          className={`mt-5 ${
            skin.actionButton?.(anyFilled, "primary") ??
            `px-8 py-3 rounded-full border-4 font-black text-base sm:text-lg transition-all
            ${
              !anyFilled
                ? "bg-slate-100 border-slate-200 text-slate-500"
                : "bg-orange-400 border-orange-500 text-white hover:bg-orange-500"
            }`
          }`}
        >
          Kiểm tra
        </motion.button>
      )}
    </PlayerShell>
  );
};

export const TableFillPlayer: React.FC<TableFillPlayerProps> = (props) => (
  <TableFillContent {...props} />
);
