/**
 * Player accent — màu BẢN SẮC của từng loại câu hỏi ("cầu vồng" joyful).
 *
 * Vấn đề thiết kế mà file này giải (Owner 30/7): `SkinTone` là VAI TRÒ ngữ
 * nghĩa (primary/danger…), không phải hue — nên một skin trước đây không thể
 * cho essay màu hồng còn fill-blank màu amber; màu bản sắc bị đẩy xuống
 * fallback className của từng player và không "đi theo" skin được. Accent đưa
 * bản sắc đó thành đầu vào THỨ BA của skin:
 *
 *   look = skin(slot, state, tone) ⊕ PLAYER_ACCENTS[accent của player]
 *
 * - `PLAYER_ACCENTS`: 13 hue → bộ class literal (Tailwind v3 lẫn v4 đều scan
 *   được vì toàn chuỗi literal, không template).
 * - `PLAYER_ACCENT_OF`: component player → tên accent. MỘT nguồn duy nhất —
 *   dispatch đọc bảng này để bọc AccentProvider quanh player; PlayerShell lấy
 *   thanh accent bar từ context (player KHÔNG còn tự khai `accent="bg-x-400"`).
 * - Skin thường (studioSkin, corporateSkin…) không quan tâm accent → không đổi
 *   hành vi. Skin accent-aware (playfulSkin) nhận accent qua factory, xem
 *   `accent-context.tsx`.
 *
 * Chi tiết per-element không slot nào diễn đạt được (bục vàng/bạc/đồng của
 * Rank, tim của Hangman…) CỐ Ý ở lại fallback của player — skin không với tới.
 */

export type PlayerAccentName =
  | "blue"
  | "teal"
  | "amber"
  | "rose"
  | "violet"
  | "indigo"
  | "orange"
  | "emerald"
  | "sky"
  | "fuchsia"
  | "purple"
  | "yellow"
  | "cyan";

/** Bộ class literal cho một hue. Mọi giá trị là chuỗi Tailwind tĩnh. */
export interface PlayerAccentSet {
  /** Tên hue — cho debug/data-attribute. */
  name: PlayerAccentName;
  /** Thanh accent bar dưới tiêu đề (PlayerShell/PlayerHeader). */
  bar: string;
  /** Nền dịu (thẻ/khay/panel nhấn nhá): bg-x-50. */
  soft: string;
  /** Nền dịu đậm hơn một nấc (hover, khay active): bg-x-100. */
  softStrong: string;
  /** Dải nền của tầng CẤU TRÚC bảng (tiêu đề cột, hàng tiêu đề nhóm): bg-x-200
   *  — đậm hơn `softStrong` để đứng trên sọc chẵn/lẻ của thân bảng. */
  band: string;
  /** Viền bản sắc: border-x-400. */
  ring: string;
  /** Viền dịu: border-x-300. */
  ringSoft: string;
  /** Hover viền: hover:border-x-300. */
  ringHover: string;
  /** Hover nền dịu: hover:bg-x-50. */
  softHover: string;
  /** Chữ bản sắc: text-x-600. */
  text: string;
  /** Chữ bản sắc đậm: text-x-700. */
  textStrong: string;
  /** Nút hành động đầy màu: bg + hover + text trắng. */
  button: string;
  /** Focus ring cho bàn phím: focus-visible:ring-x-400. */
  focus: string;
}

function accent(
  name: PlayerAccentName,
  cls: Omit<PlayerAccentSet, "name">,
): PlayerAccentSet {
  return { name, ...cls };
}

// Không có accent "pink": pink-400 gần như trùng red-400 (màu đánh dấu câu
// SAI) — bản sắc magenta dùng fuchsia thay thế.
export const PLAYER_ACCENTS: Record<PlayerAccentName, PlayerAccentSet> = {
  blue: accent("blue", {
    bar: "bg-blue-400",
    soft: "bg-blue-50",
    softStrong: "bg-blue-100",
    band: "bg-blue-200",
    ring: "border-blue-400",
    ringSoft: "border-blue-300",
    ringHover: "hover:border-blue-300",
    softHover: "hover:bg-blue-50",
    text: "text-blue-600",
    textStrong: "text-blue-700",
    button: "bg-blue-500 hover:bg-blue-600 text-white",
    focus: "focus-visible:ring-blue-400",
  }),
  teal: accent("teal", {
    bar: "bg-teal-400",
    soft: "bg-teal-50",
    softStrong: "bg-teal-100",
    band: "bg-teal-200",
    ring: "border-teal-400",
    ringSoft: "border-teal-300",
    ringHover: "hover:border-teal-300",
    softHover: "hover:bg-teal-50",
    text: "text-teal-600",
    textStrong: "text-teal-700",
    button: "bg-teal-500 hover:bg-teal-600 text-white",
    focus: "focus-visible:ring-teal-400",
  }),
  amber: accent("amber", {
    bar: "bg-amber-400",
    soft: "bg-amber-50",
    softStrong: "bg-amber-100",
    band: "bg-amber-200",
    ring: "border-amber-400",
    ringSoft: "border-amber-300",
    ringHover: "hover:border-amber-300",
    softHover: "hover:bg-amber-50",
    text: "text-amber-600",
    textStrong: "text-amber-700",
    button: "bg-amber-500 hover:bg-amber-600 text-white",
    focus: "focus-visible:ring-amber-400",
  }),
  rose: accent("rose", {
    bar: "bg-rose-400",
    soft: "bg-rose-50",
    softStrong: "bg-rose-100",
    band: "bg-rose-200",
    ring: "border-rose-400",
    ringSoft: "border-rose-300",
    ringHover: "hover:border-rose-300",
    softHover: "hover:bg-rose-50",
    text: "text-rose-600",
    textStrong: "text-rose-700",
    button: "bg-rose-500 hover:bg-rose-600 text-white",
    focus: "focus-visible:ring-rose-400",
  }),
  violet: accent("violet", {
    bar: "bg-violet-400",
    soft: "bg-violet-50",
    softStrong: "bg-violet-100",
    band: "bg-violet-200",
    ring: "border-violet-400",
    ringSoft: "border-violet-300",
    ringHover: "hover:border-violet-300",
    softHover: "hover:bg-violet-50",
    text: "text-violet-600",
    textStrong: "text-violet-700",
    button: "bg-violet-500 hover:bg-violet-600 text-white",
    focus: "focus-visible:ring-violet-400",
  }),
  indigo: accent("indigo", {
    bar: "bg-indigo-400",
    soft: "bg-indigo-50",
    softStrong: "bg-indigo-100",
    band: "bg-indigo-200",
    ring: "border-indigo-400",
    ringSoft: "border-indigo-300",
    ringHover: "hover:border-indigo-300",
    softHover: "hover:bg-indigo-50",
    text: "text-indigo-600",
    textStrong: "text-indigo-700",
    button: "bg-indigo-500 hover:bg-indigo-600 text-white",
    focus: "focus-visible:ring-indigo-400",
  }),
  orange: accent("orange", {
    bar: "bg-orange-400",
    soft: "bg-orange-50",
    softStrong: "bg-orange-100",
    band: "bg-orange-200",
    ring: "border-orange-400",
    ringSoft: "border-orange-300",
    ringHover: "hover:border-orange-300",
    softHover: "hover:bg-orange-50",
    text: "text-orange-600",
    textStrong: "text-orange-700",
    button: "bg-orange-500 hover:bg-orange-600 text-white",
    focus: "focus-visible:ring-orange-400",
  }),
  emerald: accent("emerald", {
    bar: "bg-emerald-400",
    soft: "bg-emerald-50",
    softStrong: "bg-emerald-100",
    band: "bg-emerald-200",
    ring: "border-emerald-400",
    ringSoft: "border-emerald-300",
    ringHover: "hover:border-emerald-300",
    softHover: "hover:bg-emerald-50",
    text: "text-emerald-600",
    textStrong: "text-emerald-700",
    button: "bg-emerald-500 hover:bg-emerald-600 text-white",
    focus: "focus-visible:ring-emerald-400",
  }),
  sky: accent("sky", {
    bar: "bg-sky-400",
    soft: "bg-sky-50",
    softStrong: "bg-sky-100",
    band: "bg-sky-200",
    ring: "border-sky-400",
    ringSoft: "border-sky-300",
    ringHover: "hover:border-sky-300",
    softHover: "hover:bg-sky-50",
    text: "text-sky-600",
    textStrong: "text-sky-700",
    button: "bg-sky-500 hover:bg-sky-600 text-white",
    focus: "focus-visible:ring-sky-400",
  }),
  fuchsia: accent("fuchsia", {
    bar: "bg-fuchsia-400",
    soft: "bg-fuchsia-50",
    softStrong: "bg-fuchsia-100",
    band: "bg-fuchsia-200",
    ring: "border-fuchsia-400",
    ringSoft: "border-fuchsia-300",
    ringHover: "hover:border-fuchsia-300",
    softHover: "hover:bg-fuchsia-50",
    text: "text-fuchsia-600",
    textStrong: "text-fuchsia-700",
    button: "bg-fuchsia-500 hover:bg-fuchsia-600 text-white",
    focus: "focus-visible:ring-fuchsia-400",
  }),
  purple: accent("purple", {
    bar: "bg-purple-400",
    soft: "bg-purple-50",
    softStrong: "bg-purple-100",
    band: "bg-purple-200",
    ring: "border-purple-400",
    ringSoft: "border-purple-300",
    ringHover: "hover:border-purple-300",
    softHover: "hover:bg-purple-50",
    text: "text-purple-600",
    textStrong: "text-purple-700",
    button: "bg-purple-500 hover:bg-purple-600 text-white",
    focus: "focus-visible:ring-purple-400",
  }),
  yellow: accent("yellow", {
    bar: "bg-yellow-400",
    soft: "bg-yellow-50",
    softStrong: "bg-yellow-100",
    band: "bg-yellow-200",
    ring: "border-yellow-400",
    ringSoft: "border-yellow-300",
    ringHover: "hover:border-yellow-300",
    softHover: "hover:bg-yellow-50",
    text: "text-yellow-600",
    textStrong: "text-yellow-700",
    button: "bg-yellow-500 hover:bg-yellow-600 text-white",
    focus: "focus-visible:ring-yellow-400",
  }),
  cyan: accent("cyan", {
    bar: "bg-cyan-400",
    soft: "bg-cyan-50",
    softStrong: "bg-cyan-100",
    band: "bg-cyan-200",
    ring: "border-cyan-400",
    ringSoft: "border-cyan-300",
    ringHover: "hover:border-cyan-300",
    softHover: "hover:bg-cyan-50",
    text: "text-cyan-600",
    textStrong: "text-cyan-700",
    button: "bg-cyan-500 hover:bg-cyan-600 text-white",
    focus: "focus-visible:ring-cyan-400",
  }),
};

/** Accent khi không có khai báo (câu con nested, player mới chưa vào bảng). */
export const DEFAULT_ACCENT: PlayerAccentName = "blue";

/**
 * MỘT nguồn duy nhất: component player → accent. Chuyển từ 67 prop
 * `accent="bg-x-400"` rải trong player (giá trị giữ nguyên hue cũ — đây là
 * cầu vồng đã có, chỉ đổi chỗ khai). Dispatch đọc bảng này để bọc
 * AccentProvider; player nào chưa có trong bảng dùng DEFAULT_ACCENT.
 *
 * Key là `entry.component` của manifest (players/manifest.ts) — guard test
 * skin/accent.test.tsx bắt buộc bảng phủ đủ mọi component trong manifest,
 * player mới PHẢI khai accent ở đây.
 */
export const PLAYER_ACCENT_OF: Record<string, PlayerAccentName> = {
  // ── Selection · choice-grid ───────────────────────────────────────────────
  SingleChoicePlayer: "blue",
  MultiChoicePlayer: "purple",
  TrueFalsePlayer: "teal",
  YesNoPlayer: "cyan",
  ImageChoiceSinglePlayer: "fuchsia",
  ImageChoiceMultiPlayer: "fuchsia",
  TileSelectPlayer: "indigo",
  DropdownSelectPlayer: "orange",

  // ── Hotspot · image-hotspot ───────────────────────────────────────────────
  HotspotSinglePlayer: "orange",
  HotspotMultiPlayer: "orange",
  PlacePinPlayer: "fuchsia",
  ImageColorClassifyPlayer: "fuchsia",

  // ── Text entry · text-input ───────────────────────────────────────────────
  GeometryGridPlayer: "emerald",
  ChartBuildPlayer: "sky",
  FillBlankPlayer: "amber",
  ClozePlayer: "teal",
  NumericEntryPlayer: "indigo",
  ShortAnswerPlayer: "sky",
  EssayPlayer: "rose",
  FormulaEntryPlayer: "violet",
  MathClozePlayer: "violet",

  // ── Ordering · sortable-list ──────────────────────────────────────────────
  ReorderListPlayer: "purple",
  RankPlayer: "amber",
  ProcessSequencePlayer: "teal",
  TimelinePlayer: "rose",

  // ── Matching · match ──────────────────────────────────────────────────────
  TwoColumnMatchPlayer: "fuchsia",
  ConnectLinesPlayer: "fuchsia",
  MatchRowsPlayer: "fuchsia",
  MatchRadialPlayer: "fuchsia",
  ChainMatchPlayer: "fuchsia",
  MatchingScenePlayer: "fuchsia",
  CategorizePlayer: "sky",
  WordBankPlayer: "violet",

  // ── Drag-and-drop · dnd-canvas ────────────────────────────────────────────
  DragToZonesPlayer: "indigo",
  LabelDiagramPlayer: "teal",
  TwoBucketSortPlayer: "orange",
  DragToGridPlayer: "rose",

  // ── Scale / rating · scale ────────────────────────────────────────────────
  LikertPlayer: "violet",
  NumericSliderPlayer: "sky",
  StarRatingPlayer: "amber",
  ConfidenceSliderPlayer: "emerald",
  SemanticDifferentialPlayer: "fuchsia",

  // ── Region / mark · highlight ─────────────────────────────────────────────
  HighlightTextPlayer: "yellow",
  SelectWordsPlayer: "yellow",
  FreeDrawPlayer: "fuchsia",

  // ── Media-anchored · media-wrapper ────────────────────────────────────────
  VideoAnchoredPlayer: "rose",
  AudioAnchoredPlayer: "violet",

  // ── Skill · skill ─────────────────────────────────────────────────────────
  SpeakingPlayer: "rose",
  DictationPlayer: "amber",
  ColoringPlayer: "fuchsia",
  MindMapPlayer: "emerald",
  UploadAnswerPlayer: "violet",

  // ── Table · table ─────────────────────────────────────────────────────────
  CheckboxTablePlayer: "emerald",
  TableFillPlayer: "orange",
  TrueFalseTablePlayer: "indigo",

  // ── Diagram · diagram ─────────────────────────────────────────────────────
  DiagramFillPlayer: "teal",
  PathConnectPlayer: "indigo",
  ConnectPointsPlayer: "fuchsia",
  MindMapCompletionPlayer: "emerald",

  // ── Game · game ───────────────────────────────────────────────────────────
  MemoryMatchPlayer: "fuchsia",
  PikachuPlayer: "amber",
  CardSortPlayer: "indigo",
  JigsawPlayer: "emerald",
  WordSearchPlayer: "purple",
  CrosswordPlayer: "teal",
  HangmanPlayer: "fuchsia",
  SpotDifferencePlayer: "amber",

  // ── Wrapper · wrapper ─────────────────────────────────────────────────────
  QuestionGroupPlayer: "blue",
  TimedQuizPlayer: "amber",
  LivesStreakPlayer: "rose",
  BoardGamePlayer: "emerald",
  PathTrailPlayer: "violet",
};
