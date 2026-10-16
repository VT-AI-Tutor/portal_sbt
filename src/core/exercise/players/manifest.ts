import {
  ARRANGEMENT_LAYOUTS,
  DISPLAY_LAYOUTS,
  normalizeDisplayLayout,
  type DisplayLayout,
  type ResolvedLayout,
} from "../display-layout";
import { matchingInteractionFromLayoutAlias } from "@/core/question-schema/matching";

export type RendererFamily =
  | "choice-grid" | "image-hotspot" | "text-input" | "sortable-list"
  | "match" | "dnd-canvas" | "scale" | "highlight" | "media-wrapper"
  | "skill" | "table" | "diagram" | "game" | "wrapper";
export type ReportKind =
  | "choice" | "true-false" | "fill-in" | "long-fill-in" | "numeric"
  | "matching" | "sequencing" | "likert" | "performance" | "other" | "none";
export type ScoringKind = "auto" | "manual" | "none";
export type ResponseModel =
  | "single" | "multiple" | "boolean" | "text" | "numeric" | "mapping"
  | "sequence" | "performance" | "composite" | "none";
export type PlayerKey = string;

export interface InteractionCapability {
  id: string;
  label: string;
  player: PlayerKey;
  supportedLayouts: readonly DisplayLayout[];
  requiredFields?: readonly string[];
  aliases?: readonly string[];
  legacyOnly?: boolean;
  report?: ReportKind;
  scoring?: ScoringKind;
}
export interface QuestionCapability {
  responseModel: ResponseModel;
  family: RendererFamily;
  defaultInteraction: string;
  interactions: Record<string, InteractionCapability>;
}

/**
 * Layouts allowed by the schema for each collection-bearing question type.
 * `display.layout` describes the options/items/children region, not a new
 * interaction. Individual interactions may still narrow the set when their
 * player cannot render a layout (for example the dropdown player).
 */
export const QUESTION_LAYOUT_CAPABILITIES: Readonly<Record<string, readonly DisplayLayout[]>> = {
  single_choice: ARRANGEMENT_LAYOUTS,
  multiple_choice: ARRANGEMENT_LAYOUTS,
  true_false: ARRANGEMENT_LAYOUTS,
  ordering: ARRANGEMENT_LAYOUTS,
  classification: ARRANGEMENT_LAYOUTS,
  question_group: ["list", "grid_2", "grid_3", "grid_4"],
  // `list` đứng TRƯỚC là cố ý: phần tử đầu là giá trị mặc định khi tác giả không khai
  // display.layout, nên câu connect_points đang chạy thật giữ nguyên hình cũ.
  connect_points: ["list", "dots"],
};

const NONE: readonly DisplayLayout[] = [];
// Chú ý: ALL là 5 layout XẾP, KHÔNG phải toàn bộ DISPLAY_LAYOUTS. `dots` là layout
// giới hạn theo type (§10.1) và chỉ được cấp riêng cho connect_points bên dưới —
// gộp vào đây là 47 type đều chào "Chấm tròn" trong ô chọn bố cục.
const ALL: readonly DisplayLayout[] = ARRANGEMENT_LAYOUTS;
const GRID: readonly DisplayLayout[] = ["inline", "grid_2", "grid_3", "grid_4"];
const LIST_GRID: readonly DisplayLayout[] = ["list", "inline", "grid_2", "grid_3", "grid_4"];
const GROUP_LAYOUTS: readonly DisplayLayout[] = ["list", "grid_2", "grid_3", "grid_4"];

type InteractionDefinition = Omit<InteractionCapability, "supportedLayouts"> & {
  supportedLayouts?: readonly DisplayLayout[];
};

function interaction(
  id: string,
  label: string,
  player: PlayerKey,
  supportedLayouts?: readonly DisplayLayout[],
  extra: Omit<InteractionCapability, "id" | "label" | "player" | "supportedLayouts"> = {},
): InteractionDefinition {
  return { id, label, player, supportedLayouts, ...extra };
}

function question(
  responseModel: ResponseModel,
  family: RendererFamily,
  defaultInteraction: string,
  interactions: Record<string, InteractionDefinition>,
  supportedLayouts: readonly DisplayLayout[] = NONE,
): QuestionCapability {
  return {
    responseModel,
    family,
    defaultInteraction,
    interactions: Object.fromEntries(
      Object.entries(interactions).map(([interactionType, capability]) => [
        interactionType,
        { ...capability, supportedLayouts: capability.supportedLayouts ?? supportedLayouts },
      ]),
    ),
  };
}

/**
 * Canonical Content Schema contract. The 74 canonical pairs are derived from
 * this hierarchy; they are never maintained as a second flat source of truth.
 */
export const questionCapabilities: Record<string, QuestionCapability> = {
  single_choice: question("single", "choice-grid", "radio", {
    radio: interaction("P01", "Single choice / radio MCQ", "SingleChoicePlayer", ALL),
    button: interaction("P07", "Button select", "TileSelectPlayer", GRID, { aliases: ["tile"] }),
    image: interaction("P05", "Image choice, single", "ImageChoiceSinglePlayer", GRID),
    dropdown: interaction("P08", "Dropdown single-select", "DropdownSelectPlayer", ["list"]),
    circle: interaction("P67", "Circle choice, single", "SingleChoicePlayer", LIST_GRID),
    color_fill: interaction("P69", "Color-fill choice, single", "SingleChoicePlayer", LIST_GRID),
  }, QUESTION_LAYOUT_CAPABILITIES.single_choice),
  multiple_choice: question("multiple", "choice-grid", "checkbox", {
    checkbox: interaction("P02", "Multiple choice / checkbox", "MultiChoicePlayer", ALL),
    button: interaction("P71", "Button select, multiple", "TileSelectPlayer", GRID),
    image: interaction("P06", "Image choice, multiple", "ImageChoiceMultiPlayer", GRID),
    circle: interaction("P68", "Circle choice, multiple", "MultiChoicePlayer", LIST_GRID),
    color_fill: interaction("P70", "Color-fill choice, multiple", "MultiChoicePlayer", LIST_GRID),
  }, QUESTION_LAYOUT_CAPABILITIES.multiple_choice),
  true_false: question("boolean", "choice-grid", "boolean", {
    boolean: interaction("P03", "True–False", "TrueFalsePlayer", ALL),
    yes_no: interaction("P04", "Yes–No / binary", "YesNoPlayer", ALL),
  }, QUESTION_LAYOUT_CAPABILITIES.true_false),
  multi_true_false: question("mapping", "choice-grid", "radio", {
    radio: interaction("P63", "Nhiều nhận định Đúng/Sai", "TrueFalseTablePlayer", NONE, { aliases: ["list"], report: "true-false", scoring: "auto" }),
  }),
  multi_true_false_table: question("mapping", "table", "table", {
    table: interaction("P46", "Bảng Đúng / Sai theo hàng", "TrueFalseTablePlayer", NONE, { report: "true-false", scoring: "auto" }),
  }),
  fill_blank: question("text", "text-input", "text", {
    text: interaction("P12", "Fill-in-the-blank, single", "FillBlankPlayer"),
    short_text: interaction("P15", "Short answer", "ShortAnswerPlayer", NONE),
  }),
  cloze: question("mapping", "text-input", "inline", {
    inline: interaction("P13", "Cloze, multiple inline blanks", "ClozePlayer"),
    word_bank: interaction("P25", "Word bank → blank", "WordBankPlayer", NONE, { requiredFields: ["wordBank"] }),
    picture: interaction("P25b", "Picture cloze", "ClozePlayer", NONE),
    // II.7 — mỗi ô trống một danh sách chọn riêng (khác word_bank: kho dùng
    // chung, tiêu thụ một lần). Cùng ClozePlayer: ô nào có `blanks[].options`
    // thì thành dropdown, ô còn lại vẫn gõ tay.
    select: interaction("P77", "Chọn đáp án cho ô trống", "ClozePlayer", NONE, { requiredFields: ["blanks"] }),
  }),
  numeric_answer: question("numeric", "text-input", "numeric", { numeric: interaction("P14", "Numeric entry", "NumericEntryPlayer") }),
  essay: question("text", "text-input", "long_text", { long_text: interaction("P16", "Essay / long answer", "EssayPlayer") }),
  matching: question("mapping", "match", "columns", {
    columns: interaction("P22", "Two-column match", "TwoColumnMatchPlayer"),
    lines: interaction("P23", "Connect-the-lines", "ConnectLinesPlayer", NONE),
    rows: interaction("P64", "Nối 2 hàng trên/dưới", "MatchRowsPlayer", NONE),
    radial: interaction("P65", "Nối vòng tròn (radial)", "MatchRadialPlayer", NONE),
    chain: interaction("P66", "Nối chuỗi 3 cột (chain)", "ChainMatchPlayer", NONE, { requiredFields: ["middleItems"] }),
    // triad dùng lại renderer ba cột của chain; khác biệt duy nhất là cardinality
    // (cột giữa toả nhiều cạnh, không bắt buộc đủ hai phía) — spec §5.9.3.
    triad: interaction("P76", "Nối 3 cột lấy giữa làm trung tâm (triad)", "ChainMatchPlayer", NONE, { requiredFields: ["middleItems"] }),
    // `scene` is the only matching interaction that honours authored x/y, so it is
    // also the migration target for radial questions whose items overlap. It renders
    // through the modern `MatchingScenePlayer` (drag overlay) — `MatchScenePlayer` is
    // the legacy component and is no longer referenced here.
    scene: interaction("L01", "Nối theo cảnh (tự đặt vị trí)", "MatchingScenePlayer", NONE),
  }),
  ordering: question("sequence", "sortable-list", "list", {
    list: interaction("P18", "Reorder list", "ReorderListPlayer", undefined, { aliases: ["arrange"] }),
    rank: interaction("P19", "Rank / prioritize", "RankPlayer", undefined),
    process: interaction("P20", "Process / step sequence", "ProcessSequencePlayer", undefined),
    timeline: interaction("P21", "Timeline placement", "TimelinePlayer", undefined, { requiredFields: ["slots"] }),
  }, QUESTION_LAYOUT_CAPABILITIES.ordering),
  // `drag_drop` (§5.11): kéo thẻ vào VÙNG THẢ. Khác `classification` (kéo vào nhóm,
  // nhóm không có vị trí) và `labeling` (kéo nhãn lên toạ độ trên ảnh).
  drag_drop: question("mapping", "dnd-canvas", "zones", {
    zones: interaction("P80", "Kéo thả vào vùng thả", "DragToZonesPlayer", NONE, { scoring: "auto" }),
    grid: interaction("P81", "Kéo thả vào ô trên lưới", "DragToGridPlayer", NONE, { requiredFields: ["grid"], scoring: "auto" }),
  }),
  classification: question("mapping", "match", "buckets", {
    buckets: interaction("P24", "Categorize into buckets", "CategorizePlayer"),
    two_bucket: interaction("P28", "Sorting, two-bucket", "TwoBucketSortPlayer", undefined),
    image_color: interaction("P62", "Tô màu vùng ảnh", "ImageColorClassifyPlayer", NONE, { requiredFields: ["image"], report: "matching", scoring: "auto" }),
  }, QUESTION_LAYOUT_CAPABILITIES.classification),
  hotspot: question("mapping", "image-hotspot", "single", {
    single: interaction("P09", "Hotspot, single region", "HotspotSinglePlayer"),
    multiple: interaction("P10", "Hotspot, multiple regions", "HotspotMultiPlayer", NONE),
  }),
  labeling: question("mapping", "dnd-canvas", "image", { image: interaction("P27", "Drag onto image / label diagram", "LabelDiagramPlayer") }),
  connect_points: question("mapping", "diagram", "lines", { lines: interaction("P72", "Nối các điểm", "ConnectPointsPlayer", QUESTION_LAYOUT_CAPABILITIES.connect_points, { report: "matching", scoring: "auto" }) }, QUESTION_LAYOUT_CAPABILITIES.connect_points),
  mind_map_completion: question("mapping", "diagram", "fill", { fill: interaction("P73", "Hoàn thành sơ đồ tư duy", "MindMapCompletionPlayer", NONE, { report: "fill-in", scoring: "auto" }) }),
  table_completion: question("mapping", "table", "fill", { fill: interaction("P45", "Điền ô trong bảng", "TableFillPlayer", NONE, { report: "fill-in", scoring: "auto" }) }),
  speaking: question("performance", "skill", "record", { record: interaction("P40", "Ghi âm bài nói", "SpeakingPlayer", NONE, { report: "performance", scoring: "manual" }) }),
  dictation: question("text", "skill", "transcribe", { transcribe: interaction("P41", "Chính tả (nghe – viết)", "DictationPlayer", NONE, { report: "fill-in", scoring: "auto" }) }),
  upload_answer: question("performance", "skill", "upload", { upload: interaction("P74", "Nộp bài làm", "UploadAnswerPlayer", NONE, { report: "performance", scoring: "manual" }) }),
  math_expression: question("text", "text-input", "formula", {
    formula: interaction("P17", "Formula / equation entry", "FormulaEntryPlayer", NONE),
    text: interaction("P75", "Math expression as text", "FormulaEntryPlayer", NONE),
  }),
  math_cloze: question("mapping", "text-input", "formula", {
    formula: interaction("P82", "Điền vào biểu thức", "MathClozePlayer", NONE, { report: "fill-in", scoring: "auto" }),
  }),
  point_marking: question("mapping", "image-hotspot", "pin", { pin: interaction("P11", "Place-a-pin / point-on-image", "PlacePinPlayer", NONE) }),
  scale: question("single", "scale", "likert", {
    likert: interaction("P30", "Likert scale", "LikertPlayer"), slider: interaction("P31", "Numeric slider", "NumericSliderPlayer"),
    stars: interaction("P32", "Star / icon rating", "StarRatingPlayer"), confidence: interaction("P33", "Confidence slider", "ConfidenceSliderPlayer"),
    differential: interaction("P34", "Semantic differential", "SemanticDifferentialPlayer", NONE, { requiredFields: ["pairs"] }),
  }),
  highlight: question("multiple", "highlight", "text", { text: interaction("P35", "Highlight text", "HighlightTextPlayer"), tokens: interaction("P36", "Select words in passage", "SelectWordsPlayer", NONE, { requiredFields: ["passage"] }) }),
  drawing: question("performance", "highlight", "draw", { draw: interaction("P37", "Free draw / annotate", "FreeDrawPlayer") }),
  geometry_grid: question("performance", "diagram", "construct", { construct: interaction("P78", "Dựng hình trên lưới ô vuông", "GeometryGridPlayer", NONE, { scoring: "auto" }) }),
  chart_build: question("performance", "diagram", "plot", { plot: interaction("P79", "Dựng biểu đồ", "ChartBuildPlayer", NONE, { scoring: "auto" }) }),
  media_anchored: question("composite", "media-wrapper", "video", { video: interaction("P38", "Timed video question", "VideoAnchoredPlayer"), audio: interaction("P39", "Audio-anchored question", "AudioAnchoredPlayer", NONE, { requiredFields: ["audioUrl"] }) }),
  coloring: question("performance", "skill", "regions", { regions: interaction("P42", "Tô màu theo vùng", "ColoringPlayer", NONE, { report: "other", scoring: "manual" }) }),
  mind_map: question("performance", "skill", "build", { build: interaction("P43", "Tự dựng sơ đồ tư duy", "MindMapPlayer", NONE, { report: "other", scoring: "manual" }) }),
  checkbox_table: question("mapping", "table", "rows", { rows: interaction("P44", "Bảng tích chọn theo hàng", "CheckboxTablePlayer", NONE, { report: "choice", scoring: "auto" }) }),
  diagram_fill: question("mapping", "diagram", "fill", { fill: interaction("P47", "Điền nội dung vào sơ đồ", "DiagramFillPlayer", NONE, { report: "fill-in", scoring: "auto" }) }),
  path_connect: question("sequence", "diagram", "path", { path: interaction("P48", "Nối đường qua node đúng thứ tự", "PathConnectPlayer", NONE, { report: "sequencing", scoring: "auto" }) }),
  memory_match: question("mapping", "game", "flip", { flip: interaction("P49", "Lật thẻ tìm cặp (Memory)", "MemoryMatchPlayer", NONE, { report: "matching", scoring: "auto" }) }),
  pikachu: question("mapping", "game", "onet", { onet: interaction("P50", "Nối cặp Pikachu (Onet)", "PikachuPlayer", NONE, { report: "matching", scoring: "auto" }) }),
  card_sort: question("mapping", "game", "sort", { sort: interaction("P51", "Phân loại thẻ (game)", "CardSortPlayer", NONE, { report: "matching", scoring: "auto" }) }),
  jigsaw: question("performance", "game", "pieces", { pieces: interaction("P52", "Ghép hình (Jigsaw)", "JigsawPlayer", NONE, { report: "other", scoring: "auto" }) }),
  word_search: question("performance", "game", "grid", { grid: interaction("P53", "Tìm từ trong lưới", "WordSearchPlayer", NONE, { report: "other", scoring: "auto" }) }),
  crossword: question("text", "game", "grid", { grid: interaction("P54", "Ô chữ", "CrosswordPlayer", NONE, { report: "fill-in", scoring: "auto" }) }),
  hangman: question("text", "game", "guess", { guess: interaction("P55", "Đoán chữ (Hangman)", "HangmanPlayer", NONE, { report: "fill-in", scoring: "auto" }) }),
  spot_difference: question("multiple", "game", "spots", { spots: interaction("P56", "Tìm điểm khác nhau", "SpotDifferencePlayer", NONE, { report: "choice", scoring: "auto" }) }),
  question_group: question("composite", "wrapper", "group", { group: interaction("P57", "Nhóm câu hỏi", "QuestionGroupPlayer", GROUP_LAYOUTS, { report: "none", scoring: "none" }) }, QUESTION_LAYOUT_CAPABILITIES.question_group),
  timed_quiz: question("composite", "wrapper", "timed", { timed: interaction("P58", "Quiz tính giờ", "TimedQuizPlayer", NONE, { report: "none", scoring: "none" }) }),
  lives_streak: question("composite", "wrapper", "lives", { lives: interaction("P59", "Mạng / chuỗi đúng", "LivesStreakPlayer", NONE, { report: "none", scoring: "none" }) }),
  board_game: question("composite", "wrapper", "board", { board: interaction("P60", "Cờ đường đi", "BoardGamePlayer", NONE, { report: "none", scoring: "none" }) }),
  path_trail: question("composite", "wrapper", "trail", { trail: interaction("P61", "Lớp trình bày đường đi", "PathTrailPlayer", NONE, { report: "none", scoring: "none" }) }),
};

/**
 * Non-canonical read compatibility.
 *
 * Rỗng từ 2026-08-06: `drag_drop` đã trở lại registry chuẩn (§5.11, ULNL II.16).
 * Giữ lại chỗ nối này vì `PLAYER_MANIFEST` và `resolvePlayer` còn tham chiếu, và vì
 * loại chỉ-đọc trong tương lai sẽ vào đây.
 */
export const extensionCapabilities: Record<string, QuestionCapability> = {};

export interface PlayerEntry {
  id: string; label: string; family: RendererFamily; type: string;
  interactionType: string; component: string; default?: boolean;
  report?: ReportKind; scoring?: ScoringKind;
  supportedLayouts: readonly DisplayLayout[]; aliases?: readonly string[]; legacyOnly?: boolean;
  requiredFields?: readonly string[];
}

function flattenCapabilities(registry: Record<string, QuestionCapability>): PlayerEntry[] {
  return Object.entries(registry).flatMap(([type, capability]) =>
    Object.entries(capability.interactions).map(([interactionType, value]) => ({
      id: value.id, label: value.label, family: capability.family, type, interactionType,
      component: value.player, default: interactionType === capability.defaultInteraction,
      report: value.report, scoring: value.scoring,
      supportedLayouts: value.supportedLayouts, aliases: value.aliases, legacyOnly: value.legacyOnly,
      requiredFields: value.requiredFields,
    })),
  );
}

/** Compatibility view for existing editor consumers; derived, never authored. */
export const PLAYER_MANIFEST: PlayerEntry[] = [
  ...flattenCapabilities(questionCapabilities),
  ...flattenCapabilities(extensionCapabilities),
];

export const CANONICAL_INTERACTION_PAIRS = Object.entries(questionCapabilities).flatMap(
  ([type, capability]) => Object.entries(capability.interactions)
    .filter(([, value]) => !value.legacyOnly)
    .map(([interactionType]) => ({ type, interactionType })),
);

// `type` is declared `string` on NxbgdQuestion, but a typeless / empty payload
// (a "(trống)" question the QA still needs to open and fix) arrives with
// `type === undefined` at runtime. These lookups all treat an unknown type as
// "not found", so coerce a nullish type to '' at the boundary instead of
// crashing the whole editor on `.trim()`.
export function getQuestionCapability(type: string | undefined): QuestionCapability | undefined {
  const normalizedType = (type ?? '').trim();
  return questionCapabilities[normalizedType] ?? extensionCapabilities[normalizedType];
}

/** Canonical question types offered as retype targets (GAP-184 / QPROD-R45).
 * Every key of ``questionCapabilities`` is renderable by construction — orphan
 * *interactions* are filtered per-interaction (``legacyOnly``), never leaving a
 * whole type unrenderable — so the switcher never offers a dead type. */
export function manifestTypes(): string[] {
  return Object.keys(questionCapabilities);
}

export function interactionVariantsForType(type: string | undefined): PlayerEntry[] {
  const normalizedType = (type ?? '').trim();
  return PLAYER_MANIFEST.filter((entry) => entry.type === normalizedType && !entry.legacyOnly).sort(
    (a, b) => Number(Boolean(b.default)) - Number(Boolean(a.default)),
  );
}

interface PlayerSelectionPayload {
  display?: { interactionType?: unknown; layout?: unknown; [key: string]: unknown };
  layout?: unknown;
}

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

function isLegacyImageGrid(value: unknown): boolean {
  return normalizedString(value) === "image-grid";
}

export type DisplayResolution =
  | { ok: true; player: PlayerKey; entry: PlayerEntry; interactionType: string; layout: ResolvedLayout; source: "explicit" | "legacy" | "default" }
  | { ok: false; code: "UNKNOWN_TYPE" | "UNKNOWN_INTERACTION" | "UNSUPPORTED_LAYOUT"; type: string; interactionType?: string; layout?: unknown };

function resolveInteraction(
  type: string,
  capability: QuestionCapability,
  payload?: PlayerSelectionPayload,
): { interactionType: string; source: "explicit" | "legacy" | "default" } | { error: string } {
  const rawInteraction = payload?.display?.interactionType;
  if (rawInteraction != null && typeof rawInteraction !== "string") {
    return { error: String(rawInteraction) };
  }
  const value = normalizedString(rawInteraction);
  if (value) {
    if (capability.interactions[value]) return { interactionType: value, source: "explicit" };
    const alias = Object.entries(capability.interactions).find(([, item]) => item.aliases?.includes(value));
    return alias ? { interactionType: alias[0], source: "legacy" } : { error: value };
  }
  if (type === "matching") {
    const legacyDisplayInteraction = matchingInteractionFromLayoutAlias(payload?.display?.layout);
    if (legacyDisplayInteraction && capability.interactions[legacyDisplayInteraction]) {
      return { interactionType: legacyDisplayInteraction, source: "legacy" };
    }
    const legacyTopLevelInteraction = matchingInteractionFromLayoutAlias(payload?.layout);
    if (legacyTopLevelInteraction && capability.interactions[legacyTopLevelInteraction]) {
      return { interactionType: legacyTopLevelInteraction, source: "legacy" };
    }
  }
  if ((type === "single_choice" || type === "multiple_choice") &&
      (isLegacyImageGrid(payload?.layout) || isLegacyImageGrid(payload?.display?.layout))) {
    return { interactionType: "image", source: "legacy" };
  }
  return { interactionType: capability.defaultInteraction, source: "default" };
}

export function resolveDisplay(type: string | undefined, payload?: PlayerSelectionPayload): DisplayResolution {
  const normalizedType = (type ?? '').trim();
  const capability = getQuestionCapability(normalizedType);
  if (!capability) return { ok: false, code: "UNKNOWN_TYPE", type: normalizedType };
  const selected = resolveInteraction(normalizedType, capability, payload);
  if ("error" in selected) return { ok: false, code: "UNKNOWN_INTERACTION", type: normalizedType, interactionType: selected.error };
  const interactionCapability = capability.interactions[selected.interactionType];
  const entry = PLAYER_MANIFEST.find((item) => item.type === normalizedType && item.interactionType === selected.interactionType);
  if (!interactionCapability || !entry) return { ok: false, code: "UNKNOWN_INTERACTION", type: normalizedType, interactionType: selected.interactionType };

  const rawLayout = payload?.display?.layout;
  const matchingLayoutInteraction = normalizedType === "matching"
    ? matchingInteractionFromLayoutAlias(rawLayout)
    : undefined;
  let layoutValue: DisplayLayout | undefined;
  // `layout: "image-grid"` đời cũ chỉ còn là MẶC ĐỊNH. Tác giả khai
  // `display.layout` chuẩn (grid_4…) thì layout đó THẮNG — trước đây bị ghi đè
  // thành grid_2 nên sửa bố cục trong editor lưu được mà xem vẫn ra 2 cột.
  const authoredCanonicalLayout = (DISPLAY_LAYOUTS as readonly string[])
    .includes(normalizedString(rawLayout) ?? "");
  const legacyImageGrid = !authoredCanonicalLayout && selected.source === "legacy" &&
    (isLegacyImageGrid(payload?.layout) || isLegacyImageGrid(rawLayout));
  if (legacyImageGrid) {
    layoutValue = "grid_2";
  } else if (!matchingLayoutInteraction) {
    const normalizedLayout = normalizedString(rawLayout);
    if (rawLayout != null && typeof rawLayout !== "string") {
      return { ok: false, code: "UNSUPPORTED_LAYOUT", type: normalizedType, interactionType: selected.interactionType, layout: rawLayout };
    }
    if (normalizedLayout) {
      if (!DISPLAY_LAYOUTS.includes(normalizedLayout as DisplayLayout)) {
        return { ok: false, code: "UNSUPPORTED_LAYOUT", type: normalizedType, interactionType: selected.interactionType, layout: normalizedLayout };
      }
      // display.layout is a generic display hint (Content Schema §10): any canonical
      // layout is structurally valid on any type. supportedLayouts stays as the
      // editor's suggested set + the default fallback below, not a hard render gate.
      layoutValue = normalizedLayout as DisplayLayout;
    }
  }
  const fallback = interactionCapability.supportedLayouts[0] ?? "list";
  return {
    ok: true,
    player: interactionCapability.player,
    entry,
    interactionType: selected.interactionType,
    // Cờ `authored`: false nghĩa là layout chỉ là fallback mặc định của
    // manifest — player được phép dùng chrome mặc định riêng của nó.
    layout: { ...normalizeDisplayLayout(layoutValue ?? fallback), authored: layoutValue != null },
    source: selected.source,
  };
}

/** Compatibility helper. Explicit invalid values are preserved and fail in resolveDisplay. */
export function resolveInteractionType(type: string | undefined, payload?: PlayerSelectionPayload): string | undefined {
  const normalizedType = (type ?? '').trim();
  const capability = getQuestionCapability(normalizedType);
  if (!capability) return undefined;
  const selected = resolveInteraction(normalizedType, capability, payload);
  return "error" in selected ? selected.error : selected.interactionType;
}

/** Exact lookup; only a missing interaction uses the type default. */
export function resolvePlayer(type: string | undefined, interactionType?: string): PlayerEntry | undefined {
  const normalizedType = (type ?? '').trim();
  const capability = getQuestionCapability(normalizedType);
  if (!capability) return undefined;
  const requested = normalizedString(interactionType);
  let canonical = requested;
  if (requested && !capability.interactions[requested]) {
    canonical = Object.entries(capability.interactions).find(([, item]) => item.aliases?.includes(requested))?.[0];
    if (!canonical) return undefined;
  }
  canonical ??= capability.defaultInteraction;
  return PLAYER_MANIFEST.find((entry) => entry.type === normalizedType && entry.interactionType === canonical);
}
