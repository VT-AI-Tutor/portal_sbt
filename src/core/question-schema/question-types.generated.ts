/**
 * GENERATED — do not edit by hand.
 *
 * Source of truth: evo-studio-docs/CONTENT_SCHEMA_SPECIFICATIONS.md §5.0
 * (Question Type Registry). Regenerate manually when the registry changes —
 * there is no automated sync script yet (see the workspace content-schema
 * audit, Phase 1, for the codegen follow-up).
 */

export type QuestionTypeV1 =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "multi_true_false"
  | "multi_true_false_table"
  | "fill_blank"
  | "cloze"
  | "numeric_answer"
  | "essay"
  | "matching"
  | "ordering"
  | "drag_drop"
  | "classification"
  | "hotspot"
  | "labeling"
  | "connect_points"
  | "mind_map_completion"
  | "table_completion"
  | "speaking"
  | "dictation"
  | "upload_answer"
  | "math_expression"
  | "math_cloze"
  | "point_marking"
  | "scale"
  | "highlight"
  | "drawing"
  | "media_anchored"
  | "coloring"
  | "mind_map"
  | "checkbox_table"
  | "diagram_fill"
  | "path_connect"
  | "memory_match"
  | "pikachu"
  | "card_sort"
  | "jigsaw"
  | "word_search"
  | "crossword"
  | "hangman"
  | "spot_difference"
  | "question_group"
  | "timed_quiz"
  | "lives_streak"
  | "board_game"
  | "path_trail";

/** Canonical order — mirrors the registry table row order (spec §5.0). */
export const QUESTION_TYPES: readonly QuestionTypeV1[] = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "multi_true_false",
  "multi_true_false_table",
  "fill_blank",
  "cloze",
  "numeric_answer",
  "essay",
  "matching",
  "ordering",
  "drag_drop",
  "classification",
  "hotspot",
  "labeling",
  "connect_points",
  "mind_map_completion",
  "table_completion",
  "speaking",
  "dictation",
  "upload_answer",
  "math_expression",
  "math_cloze",
  "point_marking",
  "scale",
  "highlight",
  "drawing",
  "media_anchored",
  "coloring",
  "mind_map",
  "checkbox_table",
  "diagram_fill",
  "path_connect",
  "memory_match",
  "pikachu",
  "card_sort",
  "jigsaw",
  "word_search",
  "crossword",
  "hangman",
  "spot_difference",
  "question_group",
  "timed_quiz",
  "lives_streak",
  "board_game",
  "path_trail",
] as const;

/** Vietnamese display label per type — for pickers, badges, and admin UI. */
export const QUESTION_TYPE_LABELS: Record<QuestionTypeV1, string> = {
  single_choice: "Trắc nghiệm 1 đáp án",
  multiple_choice: "Trắc nghiệm nhiều đáp án",
  true_false: "Đúng/Sai",
  multi_true_false: "Đúng/Sai nhiều ý",
  multi_true_false_table: "Đúng/Sai dạng bảng",
  fill_blank: "Điền vào chỗ trống",
  cloze: "Cloze",
  numeric_answer: "Trả lời số",
  essay: "Tự luận",
  matching: "Nối cột",
  ordering: "Sắp xếp thứ tự",
  drag_drop: "Kéo thả",
  classification: "Phân loại",
  hotspot: "Hotspot",
  labeling: "Gắn nhãn",
  connect_points: "Nối điểm",
  mind_map_completion: "Hoàn thành sơ đồ tư duy",
  table_completion: "Hoàn thành bảng",
  speaking: "Nói",
  dictation: "Chính tả",
  upload_answer: "Tải lên đáp án",
  math_expression: "Biểu thức toán",
  math_cloze: "Điền vào biểu thức",
  point_marking: "Đánh dấu điểm trên ảnh",
  scale: "Thang đo mức độ",
  highlight: "Tô đậm / chọn đoạn",
  drawing: "Vẽ tự do",
  media_anchored: "Câu hỏi neo theo media",
  coloring: "Tô màu",
  mind_map: "Sơ đồ tư duy",
  checkbox_table: "Bảng chọn ô",
  diagram_fill: "Điền vào sơ đồ",
  path_connect: "Nối đường theo thứ tự",
  memory_match: "Lật thẻ tìm cặp",
  pikachu: "Nối cặp giống nhau",
  card_sort: "Phân loại thẻ",
  jigsaw: "Ghép hình",
  word_search: "Tìm từ ẩn",
  crossword: "Ô chữ",
  hangman: "Đoán từ",
  spot_difference: "Tìm điểm khác nhau",
  question_group: "Nhóm câu hỏi",
  timed_quiz: "Trắc nghiệm tính giờ",
  lives_streak: "Trả lời theo lượt (sinh mạng)",
  board_game: "Trò chơi cờ bàn",
  path_trail: "Hành trình theo chặng",
};

/** Layout family per type (spec §5.0 "family" column) — useful for grouping in pickers. */
export const QUESTION_TYPE_FAMILY: Record<QuestionTypeV1, string> = {
  single_choice: "choice-grid",
  multiple_choice: "choice-grid",
  true_false: "choice-grid",
  multi_true_false: "choice-grid",
  multi_true_false_table: "table",
  fill_blank: "text-input",
  cloze: "text-input",
  numeric_answer: "text-input",
  essay: "text-input",
  matching: "match",
  ordering: "sortable-list",
  drag_drop: "dnd-canvas",
  classification: "match",
  hotspot: "image-hotspot",
  labeling: "dnd-canvas",
  connect_points: "match",
  mind_map_completion: "diagram",
  table_completion: "table",
  speaking: "skill",
  dictation: "skill",
  upload_answer: "skill",
  math_expression: "text-input",
  math_cloze: "text-input",
  point_marking: "image-hotspot",
  scale: "scale",
  highlight: "highlight",
  drawing: "highlight",
  media_anchored: "media-wrapper",
  coloring: "skill",
  mind_map: "skill",
  checkbox_table: "table",
  diagram_fill: "diagram",
  path_connect: "diagram",
  memory_match: "game",
  pikachu: "game",
  card_sort: "game",
  jigsaw: "game",
  word_search: "game",
  crossword: "game",
  hangman: "game",
  spot_difference: "game",
  question_group: "wrapper",
  timed_quiz: "wrapper",
  lives_streak: "wrapper",
  board_game: "wrapper",
  path_trail: "wrapper",
};

/** Whether the type is auto-gradable client-side, manual-only, or a non-graded wrapper (spec §5.0 "grading" column). */
export type GradingMode = "auto" | "manual" | "auto/manual" | "none";

export const QUESTION_TYPE_GRADING: Record<QuestionTypeV1, GradingMode> = {
  single_choice: "auto",
  multiple_choice: "auto",
  true_false: "auto",
  multi_true_false: "auto",
  multi_true_false_table: "auto",
  fill_blank: "auto",
  cloze: "auto",
  numeric_answer: "auto",
  essay: "manual",
  matching: "auto",
  ordering: "auto",
  drag_drop: "auto",
  classification: "auto",
  hotspot: "auto",
  labeling: "auto",
  connect_points: "auto",
  mind_map_completion: "manual",
  table_completion: "auto/manual",
  speaking: "manual",
  dictation: "auto",
  upload_answer: "manual",
  math_expression: "auto",
  math_cloze: "auto",
  point_marking: "auto",
  scale: "auto/manual",
  highlight: "auto",
  drawing: "manual",
  media_anchored: "none",
  coloring: "manual",
  mind_map: "manual",
  checkbox_table: "auto",
  diagram_fill: "auto",
  path_connect: "auto",
  memory_match: "auto",
  pikachu: "auto",
  card_sort: "auto",
  jigsaw: "auto",
  word_search: "auto",
  crossword: "auto",
  hangman: "auto",
  spot_difference: "auto",
  question_group: "none",
  timed_quiz: "none",
  lives_streak: "none",
  board_game: "none",
  path_trail: "none",
};

export function isKnownQuestionType(type: string): type is QuestionTypeV1 {
  return (QUESTION_TYPES as readonly string[]).includes(type);
}

export function questionTypeLabel(type: string): string {
  return isKnownQuestionType(type) ? QUESTION_TYPE_LABELS[type] : type;
}
