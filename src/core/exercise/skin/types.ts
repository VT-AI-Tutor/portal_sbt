/**
 * QuestionPlayer skin system.
 *
 * A *skin* is a set of OPTIONAL style overrides consumed by the players via
 * React context (see ./context.tsx). The guiding rule:
 *
 *   • Every token is optional. When a token is `undefined`, the player keeps
 *     its own built-in (default) classes. So the DEFAULT skin is simply `{}` —
 *     it overrides nothing and the current look is preserved with zero risk.
 *
 *   • A custom skin (e.g. `studioSkin`) supplies override strings for the slots
 *     it wants to restyle. Adding a new skin is pure data — no player changes.
 *
 * Migrating a player to be skinnable is a one-time edit: wrap its hardcoded
 * className in `skin.<token> ?? "<existing classes>"`. After that the player is
 * fully themeable by any present or future skin.
 */

/** Visual state of a choice/option card. */
export type OptionState = "idle" | "selected" | "correct" | "wrong";
/** Visual state of a text/number input or a fill-in blank. */
export type InputState = "idle" | "focus" | "correct" | "wrong";
/** Visual state of a draggable / selectable chip (token, word, tile). */
export type ChipState = "idle" | "placed" | "selected" | "correct" | "wrong";
/** Visual state of a drop target / bucket / blank slot. */
export type ZoneState = "idle" | "active" | "filled" | "correct" | "wrong";
/** Inline feedback line kind. */
export type FeedbackKind = "success" | "error" | "neutral";

/**
 * Semantic tone a player asks for. Lets the *default-flavoured* skins vary hue
 * per player (e.g. single-choice = primary/blue, multi-choice = secondary/
 * purple) while flat skins can ignore it and return one unified look.
 *
 * A tone is a SEMANTIC ROLE, never a literal hue. A player that is "amber
 * themed" asks for its `primary` tone and keeps an amber literal as the
 * fallback; the skin decides the real colour. This is what lets a brand-new
 * skin (e.g. dark) restyle every player with zero player edits.
 */
export type SkinTone = "primary" | "secondary" | "success" | "danger" | "neutral";

/**
 * Bordered surface kinds. A `panel` token returns the decorative treatment
 * (radius + border + background + shadow) for a container; the player keeps its
 * own layout classes (padding/flex/sizing).
 */
export type PanelVariant =
  | "card" // a standalone content card
  | "tray" // a draggable-source tray / bank
  | "media" // an image / video / canvas frame
  | "table" // a bordered table wrapper
  | "clues" // web-own (SBT-69): khung danh sách gợi ý của ô chữ — tách khỏi "table"
  | "board" // a game board / grid surface
  | "inset"; // a recessed well inside another surface

/** Text emphasis weight for in-player labels / values. */
export type EmphasisLevel = "strong" | "medium" | "soft";

/**
 * Role of a decorative colour accent — used by the `accent` token for the long
 * tail of tints (waveform bars, axis dots, progress tracks, hover colours,
 * gradient fills) that don't fit a more specific token.
 */
export type AccentRole =
  | "fill" // a solid colour fill (e.g. an active waveform bar)
  | "softFill" // a muted colour fill (e.g. an inactive bar)
  | "stripe" // zebra stripe of a table body row
  | "band" // structural band of a table (header row, group-title row) — sits above `stripe`
  | "text" // a coloured text/icon tint
  | "ring" // a focus/selection ring colour
  | "track" // a slider / progress track fill
  | "shadow"; // a coloured drop shadow

/**
 * SHAPE presentation flags — hình dạng trình bày theo SURFACE, không phải màu.
 *
 * Một nhóm khác biệt studio↔web không thể diễn đạt bằng token className đơn lẻ:
 * chúng đổi CẤU TRÚC render của player (render toàn bộ content thành tiêu đề, đổi
 * nhánh chrome radio-row ↔ pill, đổi lưới/hàng mặc định, đổi cỡ ô blank).
 * Surface học sinh (playful) muốn look joyful của evo-books-web; surface QA
 * của studio phải render TRUNG THỰC theo sách (không phịa heading, không phóng
 * to blank). Player đọc các cờ này qua useSkin():
 *
 *   • `playfulSkin` bật TẤT CẢ — preview "Học sinh" khớp web cả hình dạng.
 *   • `studioSkin` KHÔNG khai (mọi cờ tắt) — QA render trung thực.
 *
 * Mỗi cờ là opt-in (`undefined` = tắt = giữ hành vi studio hiện tại), nên skin
 * mới không khai gì vẫn an toàn tuyệt đối.
 */
export interface SkinPresentation {
  /** shared.tsx RichContentBlocks: TOÀN BỘ Question.Content là "đề bài" — MỌI
   * block text (paragraph/heading, không compact) render typography heading to
   * đậm kiểu joyful + đúng MỘT thanh accent bar sau block text cuối cùng.
   * Ngoại lệ kỹ thuật: block chứa blank marker giữ prose + inline blank, đoạn
   * rỗng giữ spacer, heading tác giả giữ semantics level nhưng vẫn cỡ to.
   * (Owner 30/7 — thay cờ promoteLeadParagraph cũ chỉ thăng cấp block ĐẦU.)
   *
   * `"lead"` (web-own SBT): CHỈ block text ĐẦU TIÊN lên heading + thanh accent
   * ngay dưới nó, phần còn lại của content giữ prose. Dành cho đề bài mang cả
   * ngữ liệu (đoạn văn trích, nguồn dẫn) — để cả khối lên heading thì đoạn
   * trích cũng to đậm như câu lệnh và không còn phân biệt được đâu là yêu cầu.
   * Điều kiện thăng cấp giống hệt promoteLeadParagraph cũ: block đầu phải là
   * `paragraph` (heading tác giả giữ nguyên level), không rỗng, không thụt lề,
   * không chứa blank marker. */
  contentAsHeading?: boolean | "lead";
  /** SingleChoicePlayer: pill chrome `rounded-full border-4` ở MỌI layout
   * ("pill không phải layout") — tắt thì layout list giữ nhánh radio-row. */
  choicePill?: boolean;
  /** TrueFalse + YesNo: layout vắng mặt (không do tác giả khai) render 2 pill
   * gọn CẠNH NHAU căn giữa — tắt thì stack list dọc như studio. */
  pairedBinaryChoice?: boolean;
  /** TileSelect: layout vắng mặt render lưới tile TO 2 cột kiểu Kahoot,
   * không ép prefix hug-content — tắt thì theo layoutContainerClass. */
  bigTiles?: boolean;
  /** FillBlank + Cloze: ô blank không khai width/input.size render TO cố định
   * (7rem/10rem, không clamp 42cqi) — tắt thì giữ clamp co giãn của studio.
   * Width tác giả khai (#444) luôn thắng ở cả hai chế độ. */
  spaciousBlanks?: boolean;
  /** shared.tsx: TỰ ĐỘNG chỉnh cỡ ảnh khi câu có NHIỀU ảnh (Owner 31/7) —
   * gồm CẢ HAI việc, một công tắc:
   *   1. gom LƯỚI chuỗi ≥2 ảnh liền nhau trong ĐỀ BÀI (xem autoMediaRuns);
   *   2. CAP chiều cao ảnh trong item/đáp án/ô, trong ô lưới, và trong CỘT NỐI
   *      (MEDIA_ITEM_MAX_HEIGHT / MEDIA_GRID_MAX_HEIGHT /
   *      MEDIA_MATCH_ITEM_MAX_HEIGHT).
   * Tắt → ảnh về hành vi cũ 100%: kích thước gốc, chỉ chặn `max-w-full`, và
   * `width` tác giả khai vẫn thắng như mọi khi. Đây là ĐƯỜNG LÙI an toàn nếu
   * QA/khách hàng phản đối — không cần revert code. Từ 3/8 đường lùi này gánh
   * nặng hơn: lưới không còn né chuỗi ảnh có `width` tác giả (Owner: "cứ nhiều
   * ảnh là phải relayout"), nên tắt cờ là cách duy nhất lấy lại xếp dọc.
   * Ảnh ĐƠN và layout block tác giả khai không bị cờ này tác động ở chiều nào. */
  autoMediaSizing?: boolean;
  /** shared.tsx + players: ẨN các DÒNG phản hồi đúng/sai TỰ-HIỂN-THỊ nằm BÊN
   * TRONG nội dung câu hỏi ("🎉 Chính xác!", "Tuyệt vời! 🎉", "Chưa đúng, thử
   * lại nhé! 🤔"…). Owner 4/8: chúng chen vào giữa nội dung bài, gây rối; phản
   * hồi CHÍNH của surface học sinh là tô màu đúng/sai per-element + âm thanh,
   * cả hai đều GIỮ NGUYÊN khi cờ này bật.
   *
   * ĐÂY LÀ CỜ DUY NHẤT ĐẢO CHIỀU trong SkinPresentation: `undefined` = hiện
   * (giữ đúng hiện trạng cho studio/QA + mọi skin chưa khai), phải khai
   * `true` mới ẩn. Lý do giữ đúng bất biến "undefined = giữ hành vi studio
   * hiện tại" của file này — nếu đặt tên thuận (`inlineFeedback`) thì
   * `undefined` sẽ TẮT và mọi skin chưa khai (kể cả studioSkin của QA) im
   * lặng mất phản hồi.
   *
   * KHÔNG chạm tới: dòng "Đã ghi nhận…" (feedback kind `neutral` — biên nhận
   * đã lưu bài, không phải verdict), `answerReveal`, ResultBanner của host. */
  hideInlineFeedback?: boolean;

  /** ChainMatchPlayer: ẨN hai câu gợi ý thao tác dưới lưới nối chuỗi. Giữ câu
   * "Đã chọn 1 ô →…" — đó là phản hồi trạng thái, không phải hướng dẫn.
   *
   * Đảo chiều như `hideInlineFeedback`. Dòng này CÓ ở studio nên là khác biệt
   * CỐ Ý — xem WEB-OWN PATCHES trong apps/learner/scripts/detokenize-players.mjs.
   * Bật cho sách Đạo đức (NXB 09/2026). */
  hideChainMatchHint?: boolean;
}

export interface QuestionPlayerSkin {
  /** Human-readable id, for debugging / registry. */
  name?: string;

  /** Shape presentation flags — see SkinPresentation. Absent = all off. */
  presentation?: SkinPresentation;

  // ── Header chrome (PlayerHeader) ────────────────────────────────────────
  /** The small accent bar under the stem heading. */
  accentBar?: string;
  /** Stem heading text. */
  heading?: string;
  /** Stem body paragraphs (2nd+ text blocks). */
  body?: string;
  /**
   * Cùng vai với `body` nhưng ở ô CHẬT: chữ trong thẻ đáp án, cột của bài nối,
   * ô con của question_group — mọi chỗ `RichContentBlocks` chạy `compact`.
   * Không khai = dùng lại `body` y như trước (mọi skin ở repo này đều thế).
   *
   * Có mặt vì ĐỀ BÀI và CHỮ TRONG Ô là hai vai khác nhau: skin muốn đề bài nổi
   * (studioSkin bên evo-books-studio-web, Owner 21/08) mà chỉ có một token thì
   * thẻ đáp án cũng to đậm theo — đúng cái thứ bậc vừa dựng lại bị san phẳng.
   */
  bodyCompact?: string;
  /** Instruction line under the heading. */
  instruction?: string;

  // ── Result banner (parent grade mode) ───────────────────────────────────
  banner?: Partial<{ correct: string; wrong: string; neutral: string }>;

  // ── Choice / option cards ───────────────────────────────────────────────
  /**
   * Full className for an option card in a given state + tone. Return
   * `undefined` to let the player keep its own classes for that case.
   */
  optionCard?: (state: OptionState, tone: SkinTone) => string | undefined;
  /** The "A." / "B." index label inside an option. */
  optionLabel?: (tone: SkinTone) => string | undefined;

  // ── Generic interactive primitives (used across the other player families) ─
  /** Text / number input boxes and fill-in-the-blank fields. */
  input?: (state: InputState) => string | undefined;
  /** Draggable / selectable chips: tokens, word-bank words, tiles, pins. */
  chip?: (state: ChipState, tone: SkinTone) => string | undefined;
  /**
   * Inline selectable word inside running text (highlight-the-word players).
   * Unlike `chip`, this token MUST NOT change the passage's typography
   * (font-size / weight / line-height / baseline) or add box model that
   * detaches punctuation — it only paints the highlight/state background so an
   * idle segment reads as continuous prose, not a pill. The player keeps its
   * own cursor / rounding / transition classes. (slot port từ studio)
   */
  inlineToken?: (state: OptionState, tone: SkinTone) => string | undefined;
  /** Drop targets, buckets, blank slots, classification columns. */
  dropZone?: (state: ZoneState) => string | undefined;
  /** In-player primary action button (e.g. the per-player "Kiểm tra"). */
  actionButton?: (enabled: boolean, tone: SkinTone) => string | undefined;
  /** Inline feedback text line ("Tuyệt vời! 🎉" / "Chưa đúng 😅"). */
  feedback?: (kind: FeedbackKind) => string | undefined;

  // ── Total-theme primitives (cover the long tail so a skin = pure data) ───
  /**
   * Decorative treatment (radius + border + background + shadow) for a bordered
   * container. The player keeps its own layout classes. Optional `state` lets
   * trays / wells react to drag-over and grading.
   */
  panel?: (variant: PanelVariant, state?: ZoneState) => string | undefined;
  /**
   * Text emphasis (font-weight + colour) for in-player labels and values. The
   * player keeps its own text-size / layout classes. `tone` is the player's
   * semantic accent; flat skins ignore it and key off `level` only.
   */
  emphasis?: (tone: SkinTone, level?: EmphasisLevel) => string | undefined;
  /**
   * Small colour pill / number badge (rank #, step #, count chip). Returns
   * background + text + font; the player keeps the badge's shape and size.
   */
  badge?: (tone: SkinTone, state?: OptionState) => string | undefined;
  /**
   * Overlay marker on an image/diagram (hotspot dot, pin, anchor ring). Returns
   * the border + fill treatment; the player keeps position and size.
   */
  marker?: (state: ZoneState) => string | undefined;
  /**
   * Circular icon control (audio play/pause, stepper buttons). Returns the
   * background + border + text colour treatment.
   */
  iconButton?: (tone: SkinTone, active?: boolean) => string | undefined;
  /**
   * Escape hatch for the long tail of decorative tints (waveform bars, axis
   * dots, progress tracks, hover colours). `role` says what kind of tint.
   */
  accent?: (tone: SkinTone, role: AccentRole) => string | undefined;

  /**
   * Generic bordered panel / surface (trays, tables, group cards). Kept as a
   * value token for callers that want one fixed treatment; prefer `panel()`
   * for variant/state-aware containers.
   */
  surface?: string;
}

/** Built-in skin names resolvable by string (see ./skins.ts). */
export type SkinName = "default" | "studio" | "playful" | "dark" | "corporate";
