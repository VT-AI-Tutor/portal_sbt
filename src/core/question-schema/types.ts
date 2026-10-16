export const SCHEMA_VERSION = 2;

import type { QuestionTypeV1 } from './question-types.generated';
export type { QuestionTypeV1 } from './question-types.generated';
export {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_FAMILY,
  QUESTION_TYPE_GRADING,
  isKnownQuestionType,
  questionTypeLabel,
} from './question-types.generated';

export type RichBlockType =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'audio'
  | 'video'
  | 'table'
  | 'math'
  | 'code'
  | 'diagram'
  | 'list'
  | 'quote'
  | 'divider'
  | 'layout';

/** Inline formatting carried by a text run. This is the persisted rich-text contract. */
export interface RichTextAnnotations {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  subscript?: boolean;
  superscript?: boolean;
  color?: string;
  link?: { href: string; target?: string; rel?: string };
}

export interface RichTextRun {
  text: string;
  annotations: RichTextAnnotations;
}

export interface RichContentBlock {
  type: RichBlockType | string;
  /** Canonical annotated text runs. Legacy readers may fall back to `text`. */
  content?: RichTextRun[];
  text?: string;
  /** Canonical LaTeX source for `type: "math"`; `text` remains legacy fallback. */
  latex?: string;
  url?: string;
  alt?: string;
  altText?: string;
  caption?: string;
  author?: string;
  label?: string;
  poster?: string;
  svg?: string;
  width?: string;
  language?: string;
  code?: string;
  ordered?: boolean;
  items?: string[];
  /** Canonical annotated runs per list item (mirrors `content`); `items` stays the
   *  legacy plain-text fallback. Added for #503 so inline marks survive round-trip. */
  itemsRuns?: RichTextRun[][];
  headers?: string[];
  rows?: string[][];
  level?: number;
  /** When type is `layout`: column groups of blocks. */
  columns?: RichContentBlock[][];
  /** When type is `layout`: preset id (image-left, two-column, …). */
  layout?: ContentLayout;
  /** Paragraph / heading text alignment. */
  align?: 'left' | 'center' | 'right' | 'justify';
}

export type ContentLayout =
  | 'stack'
  | 'image-left'
  | 'image-right'
  | 'image-top'
  | 'image-bottom'
  | 'two-column'
  | 'media-grid';

export interface RichContent {
  blocks: RichContentBlock[];
  layout?: ContentLayout;
}

export interface RichOption {
  id: string;
  content: RichContent;
  isCorrect?: boolean;
}

/**
 * Per-blank input rendering config (issue #444). Rendering-only hint — never
 * influences grading. `mode` defaults to single_line, `size` to medium;
 * `rows` applies to multiline only (default 2, clamped 1..10).
 */
export interface BlankInputSpec {
  mode?: 'single_line' | 'multiline';
  size?: 'short' | 'medium' | 'long' | 'full';
  rows?: number;
}

export interface BlankSpec {
  id: string;
  /** Optional per-blank prompt label (e.g. "a. …") shown next to the input. */
  label?: string;
  acceptedAnswers: string[];
  caseSensitive?: boolean;
  trimWhitespace?: boolean;
  /**
   * Optional input width as a CSS length (e.g. "7rem"). Rendering-only hint —
   * never influences grading. Players fall back to their defaults when absent.
   * Takes precedence over `input.size` when both are present (#437 + #444).
   */
  width?: string;
  /**
   * Optional input rendering config (mode/size/rows). Rendering-only hint —
   * never influences grading.
   */
  input?: BlankInputSpec;
  /**
   * Danh sách lựa chọn của RIÊNG ô trống này (II.7 "Điền khuyết bằng chọn đáp
   * án"). Có `options` → ô render thành dropdown; không có → ô nhập tự do như
   * cũ. Trộn được hai kiểu trong cùng một câu.
   *
   * Cố ý là CHUỖI THUẦN chứ không phải {id,text}: `correctAnswer[blankId]` vốn
   * đã là chuỗi/danh sách chuỗi chấp nhận, nên giá trị học sinh chọn CHÍNH LÀ
   * chuỗi đem so — không cần thêm luật chấm nào ở client lẫn server.
   *
   * Khác `cloze/word_bank`: kho từ ở đó DÙNG CHUNG và mỗi từ tiêu thụ một lần;
   * `options` ở đây độc lập theo ô, một giá trị lặp lại ở nhiều ô được.
   */
  options?: string[];
}

export interface StatementSpec {
  id: string;
  content: RichContent;
  /** Legacy fallback only — spec v2.0 keys the answer via the question-level
   * `correctAnswer: Record<statementId, boolean>` instead. */
  correctAnswer?: boolean;
}

export interface MatchingItem {
  id: string;
  content: RichContent;
  /** Legacy scene coordinates, expressed as percentages in the 0-100 range. */
  x?: number;
  y?: number;
}

/**
 * Canonical matching column (spec §5.9 `columns:[{id,title,items}]`). `title`
 * is omitted (not empty-string) when the author left it blank — renderers
 * must NOT auto-generate a label and must hide the header in that case.
 */
export interface MatchingColumn {
  id: 'left' | 'middle' | 'right';
  /** Plain-text compatibility fallback for consumers that do not read titleContent. */
  title?: string;
  /** Canonical independently styled title; textual blocks only. */
  titleContent?: RichContent;
  items: MatchingItem[];
}

export interface OrderingItem {
  id: string;
  content: RichContent;
}

export interface DragDropItem {
  id: string;
  content: RichContent;
}

export interface DragDropZone {
  id: string;
  label?: string;
  content?: RichContent;
}

export interface RubricCriterion {
  criterion: string;
  maxScore: number;
}

/** @deprecated Trục cột của bảng v1. Bảng v2 dùng `TableColumnSpec`. Vẫn là
 *  đường đọc hợp lệ: 734 câu hỏi trên đĩa còn ở dạng v1 (spec §5.16.6). */
export interface TableHeaderSpec {
  id: string;
  label: string;
}

/**
 * Trục cột của bảng v2 — thay `TableHeaderSpec`. Nhãn hiển thị của cột nằm ở
 * `headerRows`, `label` ở đây chỉ là bản sao phẳng để tra cứu nhanh và có thể
 * vắng khi tác giả bỏ trống (không bao giờ là chuỗi rỗng).
 */
export interface TableColumnSpec {
  id: string;
  label?: string;
  /** Độ dài CSS — "20%", "12rem", "8ch". Cấp cột, khác với `width` của ô. */
  width?: string;
  align?: 'left' | 'center' | 'right';
}

/** Loại ô (§5.16.3). `"text"` là alias cũ của `"static"` — giữ nguyên giá trị
 *  khi đọc/ghi nhưng hành vi hiển thị giống hệt `"static"`. Giá trị lạ hoặc
 *  thiếu cũng gấp về `"static"`. */
export type TableCellType = 'static' | 'text' | 'input' | 'essay' | 'tick' | 'cross';

export interface TableCellSpec {
  /** Cột NEO (ô trái nhất) của ô này. */
  columnId: string;
  /** Số cột ô chiếm ngang, mặc định 1. */
  colSpan?: number;
  /** Số hàng ô chiếm dọc, mặc định 1. */
  rowSpan?: number;
  /** Cố ý giữ `string` chứ không thu hẹp về `TableCellType`: dữ liệu v1 trên đĩa
   *  có thể mang giá trị ngoài danh sách. `resolveTableModel` mới là nơi gấp về
   *  `TableCellType`. */
  cellType?: string;
  text?: string;
  /** RichContent — nhãn/ảnh của ô có thể nằm hoàn toàn trong `content.blocks`. */
  content?: unknown;
  imageUrl?: string;
  rowLines?: number;
  /** Display-only input/essay width, normalized to 3–20rem. */
  width?: string;
  /** Display-only input/essay height, normalized to 3–20rem. */
  height?: string;
  /** Đáp án chấp nhận được — nguồn chuẩn vẫn là `correctAnswer["rowId__columnId"]`. */
  acceptedAnswers?: string[];
  /** Nợ dữ liệu, trình hiển thị bỏ qua (§5.16.5). */
  label?: string;
  /** Nợ dữ liệu, trình hiển thị bỏ qua (§5.16.5). */
  placeholder?: string;
}

/** Một tầng tiêu đề của bảng v2 (`<thead>`). Có thể có nhiều tầng. */
export interface TableHeaderRowSpec {
  id?: string;
  cells: TableCellSpec[];
}

export interface TableRowSpec {
  id: string;
  cells: TableCellSpec[];
  /** @deprecated Chỉ v1. Khi true, hàng là tiêu đề nhóm chiếm trọn chiều ngang
   * (một ô colspan) chứ không phải hàng dữ liệu theo cột. v2 diễn đạt điều này
   * bằng một ô có `colSpan = columns.length`. */
  isGroupHeader?: boolean;
}

export interface TableQuestionSpec {
  // --- v2 ---
  /** Có mặt (là mảng) ⇔ bảng ở mô hình v2. Đây là dấu hiệu phân biệt duy nhất. */
  columns?: TableColumnSpec[];
  headerRows?: TableHeaderRowSpec[];
  // --- v1 (chỉ đọc, không sinh mới) ---
  headers?: TableHeaderSpec[];
  /** Tiêu đề toàn bảng, hiển thị thành một hàng tiêu đề chiếm trọn chiều ngang
   * NẰM TRÊN hàng tên cột (kiểu tiêu đề 2 tầng của VBT). Chuỗi phẳng/inline-HTML. */
  caption?: string;
  // --- cả hai ---
  rows: TableRowSpec[];
  tickGroups?: string[][];
}

export interface QuestionSettings {
  shuffleOptions?: boolean;
  partialScoring?: boolean;
  caseSensitive?: boolean;
}

export interface QuestionAccessibility {
  altText?: string;
  transcript?: string;
  captions?: string;
}

/** Rendering-only hint (spec §10) — never influences grading. */
export interface QuestionDisplay {
  layout?: string;
  interactionType?: string;
}

/**
 * Unified answer key (spec §9.1). Shape depends on `type`:
 *  - single_choice/hotspot/dictation: string
 *  - hotspot "multiple": string[] | {count: number} (đúng khi chọn đủ SỐ vùng, bất kể vùng nào)
 *  - multiple_choice/ordering/highlight/path_connect/math_expression: string[]
 *  - true_false: boolean
 *  - numeric_answer/point_marking(x,y)/scale: number | {x,y} | null
 *  - matching/drag_drop/classification/labeling/fill_blank/cloze/multi_true_false(_table)/
 *    table_completion/card_sort/checkbox_table/diagram_fill/crossword: Record<string, unknown>
 *  - connect_points: Array<{ from: string; to: string }>
 *  - manual-graded / game-auto-complete types (essay, speaking, drawing, coloring, mind_map,
 *    memory_match, pikachu, jigsaw, word_search, hangman, spot_difference, wrappers): null/absent
 */
export type CorrectAnswer =
  | string
  | string[]
  | boolean
  | number
  | Record<string, unknown>
  | Array<{ from: string; to: string }>
  | Array<{ item: string; target: string }>
  | null;

export interface RenderableQuestion {
  id?: string;
  type: QuestionTypeV1;
  version?: number;
  difficulty?: string;
  score?: number;
  tags?: string[];
  language?: string;
  content: RichContent;
  explanation?: RichContent;
  hint?: RichContent;
  metadata?: Record<string, unknown>;
  settings?: QuestionSettings;
  accessibility?: QuestionAccessibility;
  display?: QuestionDisplay;
  selfAssessment?: boolean;
  options?: RichOption[];
  correctAnswer?: CorrectAnswer;
  blanks?: BlankSpec[];
  statements?: StatementSpec[];
  tolerance?: number;
  minWords?: number;
  maxWords?: number;
  manualGrading?: boolean;
  allowAttachments?: boolean;
  rubric?: RubricCriterion[];
  leftItems?: MatchingItem[];
  /** Third matching column used only by display.interactionType="chain". */
  middleItems?: MatchingItem[];
  rightItems?: MatchingItem[];
  /** Canonical matching columns (spec §5.9), resolved canonical-first with
   * legacy synthesis — mirrors leftItems/middleItems/rightItems above. */
  columns?: MatchingColumn[];
  /** Per-column matching titles, resolved canonical-first with legacy
   * synthesis (columns[].title, else columnALabel/B/C). Undefined/empty →
   * players must hide that column's header, never auto-generate a label. */
  leftTitle?: string;
  middleTitle?: string;
  rightTitle?: string;
  /** Canonical styled matching titles; corresponding string fields are fallbacks. */
  leftTitleContent?: RichContent;
  middleTitleContent?: RichContent;
  rightTitleContent?: RichContent;
  items?: OrderingItem[];
  mode?: string;
  draggables?: DragDropItem[];
  dropZones?: DragDropZone[];
  categories?: DragDropItem[];
  image?: RichContentBlock | Record<string, unknown>;
  imageUrl?: string;
  regions?: Array<Record<string, unknown>>;
  colors?: string[];
  hotspots?: Array<Record<string, unknown>>;
  labels?: DragDropItem[];
  targets?: DragDropItem[];
  points?: Array<Record<string, unknown>>;
  table?: TableQuestionSpec;
  maxDuration?: number;
  allowRetake?: boolean;
  allowedFileTypes?: string[];
  maxFileSizeMB?: number;
  gradingMode?: string;
  sharedContent?: RichContent;
  nestedQuestions?: RenderableQuestion[];
  legacyText?: string;
  legacySolution?: string;
  legacyAnswer?: string;
}

/** Minimal API shape shared across modules */
export interface QuestionLike {
  id?: string;
  question_text?: string;
  question_type?: string;
  options?: Array<{ label: string; text: string; is_correct?: boolean }>;
  answer?: string | null;
  solution?: string | null;
  difficulty?: string;
  skills?: string[];
  source_page?: number | null;
  image_url?: string | null;
  page_image_url?: string | null;
  schema_version?: number;
  payload?: Record<string, unknown> | null;
}
