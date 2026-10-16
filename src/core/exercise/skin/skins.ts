/**
 * Skin registry.
 *
 * To add a new skin: define a `QuestionPlayerSkin` object below and register it
 * in `SKINS`. No player code needs to change — players already read whatever
 * tokens a skin provides and fall back to their built-in classes otherwise.
 */
import type { QuestionPlayerSkin, SkinName, SkinPresentation } from "./types";
import type { AccentAwareSkin, AnySkin } from "./accent-context";
import type { PlayerAccentSet } from "./accents";

/**
 * "Playful" skin — the STUDENT look, as an ACCENT-AWARE skin (single-source
 * với evo-books-studio-web — khối playfulTokens/PLAYFUL_PRESENTATION chép
 * nguyên từ studio skins.ts, xem đó là bản gốc khi sync).
 *
 * Historically `playfulSkin` was `{ name: "playful" }`: the joyful chrome lived
 * only in each player's `?? "<fallback>"` string. This version extracts that
 * chrome into ONE factory and re-injects each player's identity hue through the
 * accent channel (see ./accents.ts and ./accent-context.tsx): `forAccent(a)` is
 * called with the accent of the player being rendered, so ONE skin yields the
 * per-player colourways.
 *
 * DELIBERATELY NOT OVERRIDDEN — `optionCard`: that one token is shared by four
 * different option FAMILIES which all pass tone "primary" (pill / image tile /
 * Likert dot / TileSelect); any single answer squashes the other three. Option
 * cards keep their per-player fallback, which IS the correct joyful look.
 *
 * NHẸ ĐI MỘT NẤC (Owner 04/08/2026) — chữ playful trước đây gần như chỉ có hai
 * mức 900/700, đọc rất nặng. Bảng hạ đều: black→bold, bold→semibold,
 * semibold→medium, medium giữ nguyên. Áp Ở ĐÂY (slot) chứ không ở fallback của
 * player, vì `studioSkin`/`darkSkin` khai ĐỦ mọi token mà skin này khai, nên sửa
 * slot playful KHÔNG THỂ rò sang QA/dark. `corporateSkin` từ 20/08/2026 là bản
 * fork độc lập của playful nên cũng khai đủ như playful — chỉ bỏ trống đúng
 * `optionCard` và `bodyCompact`, y hệt playful, và ăn fallback của player ở hai
 * token đó. Đó là lý do chỉ hạ fallback ở nhóm optionCard (token CẢ HAI skin cố
 * ý bỏ trống), không đụng các fallback khác.
 *
 * Thang chữ sau khi hạ (kèm phân cấp phải giữ):
 *   heading 700 (+ font-display, text-xl/2xl)  >  body / instruction 600
 *   emphasis strong 700 (đầu bảng)             >  emphasis medium|soft 600 (ô)
 * Ngoại lệ GIỮ 900 vì chức năng nhận biết: `optionLabel` (nhãn A./B.),
 * `actionButton` (nút chính), `badge` (số nhỏ, chữ trắng trên nền màu).
 */
/**
 * Shape flags của surface học sinh — phần KHÔNG phụ thuộc accent của factory:
 * mọi accent dùng chung một object (identity ổn định cho memo). Bật TẤT CẢ để
 * mọi surface học sinh giữ look joyful cả hình dạng (xem SkinPresentation).
 */
const PLAYFUL_PRESENTATION: SkinPresentation = {
  // web-own: SBT chỉ thăng cấp block text ĐẦU (xem SkinPresentation.contentAsHeading).
  contentAsHeading: "lead",
  choicePill: true,
  pairedBinaryChoice: true,
  bigTiles: true,
  spaciousBlanks: true,
  autoMediaSizing: true,
  // Owner 4/8: surface học sinh KHÔNG hiện dòng "🎉 Chính xác!" / "Chưa đúng…"
  // chen giữa nội dung; giữ tô màu per-element + âm thanh làm phản hồi chính.
  hideInlineFeedback: true,
};

function playfulTokens(a: PlayerAccentSet): QuestionPlayerSkin {
  return {
    name: "playful",
    presentation: PLAYFUL_PRESENTATION,

    // ── Header chrome (PlayerHeader / RichContentBlocks) ────────────────────
    accentBar: `w-24 h-1.5 rounded-full ${a.bar}`,
    heading:
      "text-xl md:text-2xl font-bold text-question-title tracking-tight font-player-display leading-tight whitespace-pre-wrap",
    body: "mt-1 text-slate-800 font-semibold text-base leading-snug whitespace-pre-wrap",
    instruction: "text-slate-500 font-semibold italic text-sm sm:text-base md:text-lg mt-2",

    banner: {
      correct:
        "mt-4 rounded-2xl border-4 border-green-400 bg-green-50 p-3 text-center font-bold text-green-700",
      wrong:
        "mt-4 rounded-2xl border-4 border-red-400 bg-red-50 p-3 text-center font-bold text-red-600",
      neutral:
        "mt-4 rounded-2xl border-4 border-slate-200 bg-slate-50 p-3 text-center font-semibold text-slate-500",
    },

    // `optionCard` intentionally absent — see the header comment.
    // NGOẠI LỆ font-weight (xem "NHẸ ĐI MỘT NẤC" ở header): nhãn "A." / "B." GIỮ
    // `font-black`. Nó là mỏ neo quét mắt của học sinh, chỉ dài 2 ký tự và phải
    // tách khỏi phần chữ đáp án bên cạnh (nay font-semibold).
    optionLabel: (tone) => {
      switch (tone) {
        case "secondary":
          return "font-black mr-1 text-purple-500 shrink-0";
        case "success":
          return "font-black mr-1 text-green-500 shrink-0";
        case "danger":
          return "font-black mr-1 text-red-500 shrink-0";
        case "neutral":
          return "font-black mr-1 text-slate-400 shrink-0";
        default:
          return `font-black mr-0.5 ${a.text} shrink-0`;
      }
    },

    // Thick-bordered rounded field. The web fallbacks come in two sizes — the
    // inline prose blank (`px-2 py-1 rounded-xl`, FillBlank/Cloze) and the big
    // box (`px-4 py-3 rounded-2xl`, ShortAnswer/Essay/Numeric) — and one token
    // has to serve both, so this sits between them. Idle hue follows the
    // player's accent (amber FillBlank / teal Cloze / sky ShortAnswer…), like
    // the web fallbacks did. `focus-visible:ring-2` is the literal width the
    // accent's colour-only `focus` class needs to be visible.
    input: (state) => {
      const base =
        "px-3 py-2 rounded-xl border-4 font-semibold text-base outline-none transition-all";
      switch (state) {
        case "correct":
          return `${base} bg-green-50 border-green-400 text-green-700`;
        case "wrong":
          return `${base} bg-red-50 border-red-400 text-red-600`;
        case "focus":
          return `${base} bg-white ${a.ring} text-slate-800`;
        default:
          return `${base} bg-white ${a.ringSoft} text-slate-800 focus-visible:ring-2 ${a.focus}`;
      }
    },

    chip: (state) => {
      const base =
        "px-4 py-2 rounded-full border-4 font-semibold text-sm sm:text-base shadow-md transition-all select-none";
      switch (state) {
        case "correct":
          return `${base} bg-green-50 border-green-400 text-green-700`;
        case "wrong":
          return `${base} bg-red-50 border-red-400 text-red-600`;
        case "selected":
          // The joyful "picked me up" state is the amber highlight used by every
          // drag player (DragToZones, Categorize, CardSort).
          return `${base} bg-yellow-100 border-yellow-400 text-yellow-800 scale-105`;
        case "placed":
          return `${base} ${a.soft} ${a.ring} ${a.textStrong}`;
        default:
          return `${base} bg-white ${a.ringSoft} text-slate-800 ${a.softHover}`;
      }
    },

    // Inline selectable word inside prose: background only, no box model that
    // would detach punctuation or shift the baseline (px-0.5 cancelled by -mx-0.5).
    inlineToken: (state) => {
      const base = "px-0.5 -mx-0.5 rounded";
      switch (state) {
        case "correct":
          return `${base} bg-green-200 text-green-800`;
        case "wrong":
          return `${base} bg-red-200 text-red-700 line-through`;
        case "selected":
          return `${base} bg-yellow-200 text-slate-800`;
        default:
          return `${base} hover:bg-yellow-100`;
      }
    },

    dropZone: (state) => {
      const base = "rounded-3xl border-4 p-4 transition-all shadow-lg";
      switch (state) {
        case "active":
          return `${base} border-dashed ${a.ring} ${a.soft} scale-[1.02]`;
        case "correct":
          return `${base} border-green-400 bg-green-50`;
        case "wrong":
          return `${base} border-red-400 bg-red-50`;
        case "filled":
          return `${base} ${a.ringSoft} bg-white/70`;
        default:
          // Idle trays carry the identity tint (web's Categorize buckets are
          // coloured; the per-bucket ROTATION is a fallback-only decoration the
          // one-token skin cannot express, so every tray wears the player's hue).
          return `${base} border-dashed ${a.ringSoft} ${a.soft}`;
      }
    },

    // NGOẠI LỆ font-weight: nút hành động chính ("Kiểm tra" / "Lưu câu trả lời")
    // GIỮ `font-black` — chữ trắng trên nền màu đặc, và là đích bấm chính.
    actionButton: (enabled, tone) => {
      const base =
        "px-8 py-3 rounded-full border-4 font-black text-base sm:text-lg shadow-md transition-colors";
      if (!enabled) return `${base} border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed`;
      switch (tone) {
        case "secondary":
          return `${base} border-purple-500 bg-purple-400 text-white hover:bg-purple-500`;
        case "success":
          return `${base} border-emerald-500 bg-emerald-400 text-white hover:bg-emerald-500`;
        case "danger":
          return `${base} border-rose-500 bg-rose-400 text-white hover:bg-rose-500`;
        case "neutral":
          return `${base} border-slate-400 bg-slate-300 text-slate-800 hover:bg-slate-400`;
        default:
          // "Kiểm tra" wears the player's identity colour (nút nộp hồng ở
          // essay, amber ở fill-blank…) — the joyful web look.
          return `${base} ${a.ring} ${a.button}`;
      }
    },

    feedback: (kind) => {
      const base = "mt-4 text-center font-bold text-lg md:text-xl";
      switch (kind) {
        case "success":
          return `${base} text-green-600`;
        case "error":
          return `${base} text-red-500`;
        default:
          return `${base} text-slate-500`;
      }
    },

    // ── Total-theme primitives — chunky / white-bordered / soft-shadowed ────
    panel: (variant, state) => {
      if (state) {
        switch (state) {
          case "active":
            return `rounded-3xl border-4 border-dashed ${a.ring} ${a.soft}`;
          case "correct":
            return "rounded-3xl border-4 border-green-400 bg-green-50";
          case "wrong":
            return "rounded-3xl border-4 border-red-400 bg-red-50";
          case "filled":
            return "rounded-3xl border-4 border-white bg-white/70 shadow-md";
        }
      }
      switch (variant) {
        case "media":
          return "rounded-2xl border-4 border-white shadow-md";
        case "table":
          // web-own (SBT-69): viền ngoài slate-300 cùng màu nét kẻ ô — viền
          // trắng trên nền trắng khiến bảng chỉ còn bóng đổ làm ranh giới.
          return "rounded-[24px] border-2 border-slate-300 bg-white shadow-2xl overflow-hidden";
        case "clues":
          // web-own (SBT-69): khung gợi ý ô chữ giữ viền cũ — chỉ bảng dữ liệu
          // đổi viền sang slate-300.
          return "rounded-[24px] border-4 border-white bg-white shadow-2xl overflow-hidden";
        case "tray":
          return "rounded-3xl border-4 border-white bg-white/60 shadow-md";
        case "board":
          return "rounded-2xl border-4 border-white bg-white/60 shadow-lg";
        case "inset":
          // The accent-tinted well: essay rubric (bg-rose-50 border-rose-200 on
          // web), context boxes… — the strongest single carrier of the player's
          // identity colour on the card.
          return `rounded-2xl border-4 ${a.ringSoft} ${a.soft}`;
        default:
          return "rounded-3xl border-4 border-white bg-white/70 shadow-md";
      }
    },

    emphasis: (tone, level = "strong") => {
      const hue =
        tone === "primary"
          ? { strong: a.textStrong, medium: a.text, soft: a.text }
          : tone === "secondary"
            ? { strong: "text-purple-600", medium: "text-purple-600", soft: "text-purple-500" }
            : tone === "success"
              ? { strong: "text-green-700", medium: "text-green-600", soft: "text-green-500" }
              : tone === "danger"
                ? // web's danger emphasis fallback is red-500 at every level.
                  { strong: "text-red-500", medium: "text-red-500", soft: "text-red-400" }
                : { strong: "text-slate-800", medium: "text-slate-800", soft: "text-slate-500" };
      switch (level) {
        case "soft":
          return `font-semibold ${hue.soft}`;
        case "medium":
          return `font-semibold ${hue.medium}`;
        default:
          return `font-bold ${hue.strong}`;
      }
    },

    // NGOẠI LỆ font-weight: badge GIỮ `font-black`. Con SỐ nhỏ (thứ hạng, số bước,
    // điểm) chữ trắng trên nền màu bão hoà trong vòng tròn ~w-7 — hạ nấc là mờ hẳn.
    badge: (tone, state) => {
      switch (state) {
        case "correct":
          return "bg-green-500 text-white font-black";
        case "wrong":
          return "bg-red-500 text-white font-black";
      }
      switch (tone) {
        case "secondary":
          return "bg-purple-500 text-white font-black";
        case "success":
          return "bg-emerald-500 text-white font-black";
        case "danger":
          return "bg-rose-500 text-white font-black";
        case "neutral":
          return "bg-slate-400 text-white font-black";
        default:
          return `${a.bar} text-white font-black`;
      }
    },

    marker: (state) => {
      switch (state) {
        case "correct":
          return "border-4 border-green-500 bg-green-400/70";
        case "wrong":
          return "border-4 border-red-400 bg-red-300/60";
        case "active":
          return "border-4 border-amber-400 bg-amber-300/60";
        case "filled":
          return `border-4 ${a.ring} ${a.bar}`;
        default:
          // A visible outline is load-bearing: this token also draws the
          // MultiChoice / ImageChoiceMulti checkbox, whose idle tick is white —
          // a white border on a white fill made the box disappear entirely.
          return "border-4 border-slate-200 bg-white";
      }
    },

    iconButton: (tone, active) => {
      const base = "shadow-lg transition-colors text-white";
      switch (tone) {
        case "secondary":
          return `${base} bg-purple-500 hover:bg-purple-600`;
        case "success":
          return `${base} bg-emerald-500 hover:bg-emerald-600`;
        case "danger":
          return `${base} bg-rose-500 hover:bg-rose-600`;
        case "neutral":
          return active
            ? `${base} bg-slate-500 hover:bg-slate-600`
            : "shadow transition-colors bg-slate-200 hover:bg-slate-300 text-slate-600";
        default:
          return `shadow-lg transition-colors ${a.button}`;
      }
    },

    accent: (tone, role) => {
      const pick = (
        brand: string | undefined,
        neutral: string,
        green: string,
        red: string,
        purple: string | undefined,
      ) =>
        tone === "success"
          ? green
          : tone === "danger"
            ? red
            : tone === "neutral"
              ? neutral
              : tone === "secondary"
                ? purple
                : brand;
      switch (role) {
        case "fill":
          return pick(a.bar, "bg-slate-500", "bg-green-500", "bg-red-500", "bg-purple-400");
        case "softFill":
          return pick(a.soft, "bg-slate-200", "bg-green-100", "bg-red-100", "bg-purple-100");
        case "stripe":
          // Sọc thân bảng: tint bản sắc ở nấc đậm — surface học sinh giữ ngôn
          // ngữ màu joyful thay vì xám công sở, vẫn đủ tương phản để dò theo
          // hàng ở bảng dài.
          return pick(a.softStrong, "bg-slate-200", "bg-green-100", "bg-red-100", "bg-purple-100");
        case "band":
          // Tầng cấu trúc của bảng đậm hơn sọc một nấc, giữ thứ bậc đọc:
          // tiêu đề / hàng nhóm → sọc → hàng trần.
          return pick(a.band, "bg-slate-300", "bg-green-200", "bg-red-200", "bg-purple-200");
        case "text":
          return pick(a.text, "text-slate-500", "text-green-600", "text-red-500", "text-purple-600");
        case "ring":
          // Brand tones defer to the player fallback — the accent set has no
          // ring-* literals for Tailwind to scan.
          return pick(undefined, "ring-slate-300", "ring-green-400", "ring-red-400", undefined);
        case "track":
          return "bg-slate-200";
        case "shadow":
          return "shadow-lg";
      }
    },

    surface: "rounded-3xl border-4 border-white bg-white/70 shadow-md",
  };
}

/** One token object per accent, cached: same accent → same object identity, so
 * memo/useMemo consumers don't re-render across players sharing a hue. */
const playfulTokenCache = new Map<string, QuestionPlayerSkin>();

/**
 * Bản accent-aware CHÉP TỪ STUDIO (single-source, xem header playfulTokens).
 * Là skin playful MẶC ĐỊNH của web từ 31/07/2026 (quyết định Owner): màu bản
 * sắc đi qua kênh accent của skin thay vì fallback literal trong từng player.
 * Extraction hợp nhất một số hue theo token — "known accepted losses" đã
 * duyệt: dropdown idle slate→accent (P08), rubric essay rose-50→card trắng
 * (P16, panel("card")), mất xoay màu per-bucket ở khay Categorize (P24, mọi
 * khay/dropzone idle mang tint bản sắc), podium Rank…
 */
export const playfulAccentSkin: AccentAwareSkin = {
  name: "playful",
  forAccent: (a) => {
    let tokens = playfulTokenCache.get(a.name);
    if (!tokens) {
      tokens = playfulTokens(a);
      playfulTokenCache.set(a.name, tokens);
    }
    return tokens;
  },
};

/**
 * Bản CHỈ-CỜ (presentation flags, KHÔNG token màu) — TỪNG là skin mặc định
 * của web trước 31/07/2026; nay `playfulAccentSkin` thay thế. Giữ lại làm:
 * (1) context default tĩnh của SkinProvider (component render ngoài provider,
 * ví dụ test cô lập, giữ nguyên fallback literal của player); (2) đường lùi
 * nhanh nếu cần pixel-parity với look fallback cũ.
 */
export const playfulSkin: QuestionPlayerSkin = {
  name: "playful",
  presentation: PLAYFUL_PRESENTATION,
};

/**
 * "Studio" skin — light, thin-lined, flat. Matches the editor/preview look:
 * gray hairline borders, small radius, muted typography, no chunky pills.
 */
export const studioSkin: QuestionPlayerSkin = {
  name: "studio",

  accentBar: "w-12 h-0.5 rounded-full bg-gray-300",
  heading: "text-base md:text-lg font-semibold text-gray-800 leading-snug",
  body: "mt-1 text-gray-600 text-sm leading-snug",
  instruction: "text-gray-500 text-sm mt-1",

  banner: {
    correct: "mt-4 rounded-lg border border-green-200 bg-green-50 p-2.5 text-center text-sm font-medium text-green-700",
    wrong: "mt-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-center text-sm font-medium text-red-600",
    neutral: "mt-4 rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-center text-sm font-medium text-gray-600",
  },

  optionCard: (state) => {
    const base =
      "relative flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors text-left";
    switch (state) {
      case "correct":
        return `${base} bg-green-50 border-green-300 text-green-700`;
      case "wrong":
        return `${base} bg-red-50 border-red-300 text-red-600`;
      case "selected":
        return `${base} bg-blue-50 border-blue-300 text-blue-700`;
      default:
        return `${base} bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50/40`;
    }
  },

  optionLabel: () => "font-semibold mr-1 text-gray-400 shrink-0",

  input: (state) => {
    const base =
      "px-3 py-1.5 rounded-lg border text-sm font-medium text-center outline-none transition-colors";
    switch (state) {
      case "correct":
        return `${base} bg-green-50 border-green-300 text-green-700`;
      case "wrong":
        return `${base} bg-red-50 border-red-300 text-red-600`;
      case "focus":
        return `${base} bg-white border-blue-400 text-gray-800`;
      default:
        return `${base} bg-white border-gray-300 text-gray-800 focus:border-blue-400`;
    }
  },

  chip: (state) => {
    const base =
      "px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors select-none";
    switch (state) {
      case "correct":
        return `${base} bg-green-50 border-green-300 text-green-700`;
      case "wrong":
        return `${base} bg-red-50 border-red-300 text-red-600`;
      case "selected":
      case "placed":
        return `${base} bg-blue-50 border-blue-300 text-blue-700`;
      default:
        return `${base} bg-white border-gray-200 text-gray-700 hover:border-blue-300`;
    }
  },

  dropZone: (state) => {
    const base = "rounded-xl border p-3 transition-colors";
    switch (state) {
      case "active":
        return `${base} border-blue-400 border-dashed bg-blue-50/50`;
      case "correct":
        return `${base} border-green-300 bg-green-50`;
      case "wrong":
        return `${base} border-red-300 bg-red-50`;
      case "filled":
        return `${base} border-gray-300 bg-white`;
      default:
        return `${base} border-gray-200 border-dashed bg-gray-50/60`;
    }
  },

  actionButton: (enabled) =>
    enabled
      ? "px-4 py-2 rounded-lg border border-blue-500 bg-blue-500 text-white text-sm font-semibold transition-colors hover:bg-blue-600"
      : "px-4 py-2 rounded-lg border border-gray-200 bg-gray-100 text-gray-400 text-sm font-semibold",

  feedback: (kind) => {
    const base = "mt-3 text-center text-sm font-medium";
    switch (kind) {
      case "success":
        return `${base} text-green-600`;
      case "error":
        return `${base} text-red-500`;
      default:
        return `${base} text-gray-500`;
    }
  },

  // ── Total-theme primitives — flat / hairline / muted ──────────────────────
  panel: (variant, state) => {
    if (state) {
      switch (state) {
        case "active":
          return "rounded-xl border border-blue-300 bg-blue-50/40";
        case "correct":
          return "rounded-xl border border-green-300 bg-green-50";
        case "wrong":
          return "rounded-xl border border-red-300 bg-red-50";
        case "filled":
          return "rounded-xl border border-gray-300 bg-white";
      }
    }
    switch (variant) {
      case "media":
        return "rounded-xl border border-gray-200";
      case "table":
      case "clues":
        return "rounded-xl border border-gray-200 bg-white overflow-hidden";
      case "tray":
      case "board":
        return "rounded-xl border border-gray-200 bg-gray-50/40";
      case "inset":
        return "rounded-xl border border-gray-200 bg-gray-50/60";
      default:
        return "rounded-xl border border-gray-200 bg-white";
    }
  },

  emphasis: (_tone, level = "strong") => {
    switch (level) {
      case "soft":
        return "font-medium text-gray-400";
      case "medium":
        return "font-medium text-gray-600";
      default:
        // Studio đọc phẳng, không nặng như playful — stem dùng font-medium,
        // phân biệt với "medium" bằng màu (gray-700 đậm) chứ không bằng weight.
        return "font-medium text-gray-700";
    }
  },

  badge: (_tone, state) => {
    switch (state) {
      case "correct":
        return "bg-green-100 text-green-700 font-semibold";
      case "wrong":
        return "bg-red-100 text-red-600 font-semibold";
      default:
        return "bg-gray-100 text-gray-600 font-semibold";
    }
  },

  marker: (state) => {
    switch (state) {
      case "correct":
        return "border bg-green-400 border-green-200";
      case "wrong":
        return "border bg-red-400 border-red-200";
      case "active":
        return "border bg-amber-300 border-amber-200";
      case "filled":
        return "border bg-gray-300 border-gray-200";
      default:
        return "border bg-white border-gray-300";
    }
  },

  iconButton: () =>
    "border border-gray-200 bg-white text-gray-600 hover:border-blue-300",

  // Semantic tones (success/danger) keep meaning; brand tones use studio blue;
  // neutral stays gray.
  accent: (tone, role) => {
    const pick = (brand: string, neutral: string, green: string, red: string) =>
      tone === "success"
        ? green
        : tone === "danger"
          ? red
          : tone === "neutral"
            ? neutral
            : brand;
    switch (role) {
      case "fill":
        // Point accents (dots, thumbs, waveform bars) — visible but flat.
        return pick("bg-blue-400", "bg-gray-400", "bg-green-400", "bg-red-400");
      case "softFill":
        // Large surface tints (table headers) — stay near-white so studio reads
        // flat, not a bold colour band.
        return pick("bg-gray-100", "bg-gray-100", "bg-green-50", "bg-red-50");
      case "stripe":
        // Sọc thân bảng: xám trung tính đậm, mức banding tương phản cao của
        // Excel/Word — xám thuần nên không tranh với xanh/đỏ chấm đúng/sai.
        return "bg-neutral-300";
      case "band":
        // Đậm hơn `stripe` một nấc để hàng tiêu đề nhóm giữa bảng không đọc ra
        // như một khe trống.
        return "bg-neutral-400/60";
      case "text":
        return pick("text-blue-600", "text-gray-500", "text-green-600", "text-red-500");
      case "ring":
        return pick("ring-blue-300", "ring-gray-300", "ring-green-300", "ring-red-300");
      case "track":
        return "bg-gray-200";
      case "shadow":
        return ""; // studio is flat — no coloured shadow
    }
  },

  surface: "rounded-xl border border-gray-200 bg-white",
};

/**
 * "Dark" skin — a fully dark theme. It exists primarily to PROVE the system is
 * total-skinnable: it restyles every player end-to-end purely as data, with
 * zero player edits. If any player element stays light under this skin, that
 * element still has an un-tokenised hardcoded colour and needs migrating.
 */
export const darkSkin: QuestionPlayerSkin = {
  name: "dark",

  // Surface học sinh của web — giữ NGUYÊN hình dạng joyful hiện tại (heading
  // promotion / pill / blank to…); skin này chỉ đổi MÀU.
  presentation: PLAYFUL_PRESENTATION,

  accentBar: "w-12 h-1 rounded-full bg-indigo-400",
  heading: "text-base md:text-lg font-bold text-gray-100 leading-snug",
  body: "mt-1 text-gray-300 text-sm leading-snug",
  instruction: "text-gray-400 text-sm mt-1",

  banner: {
    correct: "mt-4 rounded-lg border border-green-700 bg-green-900/40 p-2.5 text-center text-sm font-medium text-green-300",
    wrong: "mt-4 rounded-lg border border-red-700 bg-red-900/40 p-2.5 text-center text-sm font-medium text-red-300",
    neutral: "mt-4 rounded-lg border border-gray-700 bg-gray-800 p-2.5 text-center text-sm font-medium text-gray-300",
  },

  optionCard: (state) => {
    const base =
      "relative flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors text-left";
    switch (state) {
      case "correct":
        return `${base} bg-green-900/40 border-green-600 text-green-300`;
      case "wrong":
        return `${base} bg-red-900/40 border-red-600 text-red-300`;
      case "selected":
        return `${base} bg-indigo-900/50 border-indigo-500 text-indigo-200`;
      default:
        return `${base} bg-gray-800 border-gray-700 text-gray-200 hover:border-indigo-500 hover:bg-gray-700/60`;
    }
  },

  optionLabel: () => "font-bold mr-1 text-gray-500 shrink-0",

  input: (state) => {
    const base =
      "px-3 py-1.5 rounded-lg border text-sm font-medium text-center outline-none transition-colors";
    switch (state) {
      case "correct":
        return `${base} bg-green-900/40 border-green-600 text-green-300`;
      case "wrong":
        return `${base} bg-red-900/40 border-red-600 text-red-300`;
      case "focus":
        return `${base} bg-gray-800 border-indigo-400 text-gray-100`;
      default:
        return `${base} bg-gray-800 border-gray-600 text-gray-100 focus:border-indigo-400`;
    }
  },

  chip: (state) => {
    const base =
      "px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors select-none";
    switch (state) {
      case "correct":
        return `${base} bg-green-900/40 border-green-600 text-green-300`;
      case "wrong":
        return `${base} bg-red-900/40 border-red-600 text-red-300`;
      case "selected":
      case "placed":
        return `${base} bg-indigo-900/50 border-indigo-500 text-indigo-200`;
      default:
        return `${base} bg-gray-800 border-gray-700 text-gray-200 hover:border-indigo-500`;
    }
  },

  dropZone: (state) => {
    const base = "rounded-xl border p-3 transition-colors";
    switch (state) {
      case "active":
        return `${base} border-indigo-400 border-dashed bg-indigo-900/30`;
      case "correct":
        return `${base} border-green-600 bg-green-900/40`;
      case "wrong":
        return `${base} border-red-600 bg-red-900/40`;
      case "filled":
        return `${base} border-gray-600 bg-gray-800`;
      default:
        return `${base} border-gray-700 border-dashed bg-gray-800/60`;
    }
  },

  actionButton: (enabled) =>
    enabled
      ? "px-4 py-2 rounded-lg border border-indigo-500 bg-indigo-500 text-white text-sm font-semibold transition-colors hover:bg-indigo-600"
      : "px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-500 text-sm font-semibold",

  feedback: (kind) => {
    const base = "mt-3 text-center text-sm font-medium";
    switch (kind) {
      case "success":
        return `${base} text-green-400`;
      case "error":
        return `${base} text-red-400`;
      default:
        return `${base} text-gray-400`;
    }
  },

  panel: (variant, state) => {
    if (state) {
      switch (state) {
        case "active":
          return "rounded-xl border border-indigo-500 bg-indigo-900/30";
        case "correct":
          return "rounded-xl border border-green-600 bg-green-900/30";
        case "wrong":
          return "rounded-xl border border-red-600 bg-red-900/30";
        case "filled":
          return "rounded-xl border border-gray-600 bg-gray-800";
      }
    }
    switch (variant) {
      case "media":
        return "rounded-xl border border-gray-700";
      case "table":
      case "clues":
        return "rounded-xl border border-gray-700 bg-gray-800 overflow-hidden";
      case "tray":
      case "board":
        return "rounded-xl border border-gray-700 bg-gray-800/60";
      case "inset":
        return "rounded-xl border border-gray-700 bg-gray-900/60";
      default:
        return "rounded-xl border border-gray-700 bg-gray-800";
    }
  },

  emphasis: (_tone, level = "strong") => {
    switch (level) {
      case "soft":
        return "font-semibold text-gray-500";
      case "medium":
        return "font-semibold text-gray-300";
      default:
        return "font-bold text-gray-100";
    }
  },

  badge: (_tone, state) => {
    switch (state) {
      case "correct":
        return "bg-green-800 text-green-200 font-bold";
      case "wrong":
        return "bg-red-800 text-red-200 font-bold";
      default:
        return "bg-indigo-600 text-white font-bold";
    }
  },

  marker: (state) => {
    switch (state) {
      case "correct":
        return "border-2 bg-green-500 border-green-300";
      case "wrong":
        return "border-2 bg-red-500 border-red-300";
      case "active":
        return "border-2 bg-amber-400 border-amber-200";
      case "filled":
        return "border-2 bg-gray-500 border-gray-400";
      default:
        return "border-2 bg-gray-700 border-indigo-400";
    }
  },

  iconButton: (_tone, active) =>
    active
      ? "border border-indigo-400 bg-indigo-500 text-white"
      : "border border-gray-700 bg-gray-800 text-gray-200 hover:border-indigo-500",

  accent: (tone, role) => {
    const pick = (indigo: string, gray: string, green: string, red: string) =>
      tone === "success"
        ? green
        : tone === "danger"
          ? red
          : tone === "neutral"
            ? gray
            : indigo;
    switch (role) {
      case "fill":
        return pick("bg-indigo-500", "bg-gray-700", "bg-green-500", "bg-red-500");
      case "softFill":
        return pick("bg-indigo-800", "bg-gray-800", "bg-green-800", "bg-red-800");
      case "stripe":
        // Trên nền tối, sọc là nấc SÁNG hơn nền — cùng vai trò, đảo chiều.
        // gray-800 quá sát nền card nên sọc gần như biến mất; gray-700 mới đọc
        // được theo hàng.
        return "bg-gray-700";
      case "band":
        return "bg-gray-600";
      case "text":
        return pick("text-indigo-300", "text-gray-400", "text-green-300", "text-red-300");
      case "ring":
        return pick("ring-indigo-500", "ring-gray-600", "ring-green-500", "ring-red-500");
      case "track":
        return "bg-gray-700";
      case "shadow":
        return "shadow-lg shadow-black/40";
    }
  },

  surface: "rounded-xl border border-gray-700 bg-gray-800",
};

/**
 * "Corporate" skin — BẢN FORK ĐỘC LẬP của `playfulAccentSkin`, chốt 20/08/2026.
 *
 * VÌ SAO TỒN TẠI: NXBGD cần sửa look của Question mà KHÔNG được đụng tới
 * "Để học tốt" (đang dùng `playfulAccentSkin`). Trước bản này `corporateSkin`
 * chỉ khai 7/22 token và dùng chung object `PLAYFUL_PRESENTATION` với playful
 * → mọi sửa đổi đều rò sang nhau. Nay hai skin tách hẳn: CHÉP NGUYÊN playful
 * tại thời điểm fork, nên ngày đầu render GIỐNG HỆT playful — không đổi pixel
 * nào — nhưng từ đây sửa corporate KHÔNG THỂ ảnh hưởng playful.
 *
 * ⚠️ CỐ Ý TRÙNG LẶP — ĐỪNG GỘP LẠI. `CORPORATE_PRESENTATION` /
 * `corporateTokens` / `corporateTokenCache` là bản sao y hệt của
 * `PLAYFUL_PRESENTATION` / `playfulTokens` / `playfulTokenCache`. Refactor
 * "DRY" gộp chúng lại sẽ ÂM THẦM huỷ toàn bộ mục đích của fork này.
 *
 * CACHE RIÊNG LÀ BẮT BUỘC (không phải cho đẹp): `playfulTokenCache` key theo
 * TÊN HUE của accent, không có skin trong key. Hai skin accent-aware dùng
 * chung một Map sẽ phát nhầm token object của nhau — skin nào render hue đó
 * trước thì "chiếm" hue ấy suốt vòng đời process.
 *
 * BẢN CŨ (UI_04.3, token CSS-var --primary/--primary-light/--input) đã được
 * thay bằng bản chép playful theo yêu cầu Owner 20/08/2026. Cần tra lại thì
 * xem git history của file này trước commit fork.
 *
 * `optionCard` VẪN dùng chung fallback của player: bản chép thừa hưởng chủ ý
 * bỏ trống của playful (một token phục vụ năm HỌ option — pill / ảnh / likert
 * / tile / semantic; override sẽ ép ảnh và thang đo thành pill). Đây là điểm
 * duy nhất còn dính giữa hai skin sau fork — xem header playfulTokens.
 */
const CORPORATE_PRESENTATION: SkinPresentation = {
  // web-own: SBT chỉ thăng cấp block text ĐẦU (xem SkinPresentation.contentAsHeading).
  contentAsHeading: "lead",
  choicePill: true,
  pairedBinaryChoice: true,
  bigTiles: true,
  spaciousBlanks: true,
  autoMediaSizing: true,
  // Owner 4/8: surface học sinh KHÔNG hiện dòng "🎉 Chính xác!" / "Chưa đúng…"
  // chen giữa nội dung; giữ tô màu per-element + âm thanh làm phản hồi chính.
  hideInlineFeedback: true,
};

function corporateTokens(a: PlayerAccentSet): QuestionPlayerSkin {
  return {
    name: "corporate",
    presentation: CORPORATE_PRESENTATION,

    // ── Header chrome (PlayerHeader / RichContentBlocks) ────────────────────
    accentBar: `w-24 h-1.5 rounded-full ${a.bar}`,
    heading:
      "text-xl md:text-2xl font-bold text-question-title tracking-tight font-player-display leading-tight whitespace-pre-wrap",
    body: "mt-1 text-slate-800 font-semibold text-base leading-snug whitespace-pre-wrap",
    instruction: "text-slate-500 font-semibold italic text-sm sm:text-base md:text-lg mt-2",

    banner: {
      correct:
        "mt-4 rounded-2xl border-4 border-green-400 bg-green-50 p-3 text-center font-bold text-green-700",
      wrong:
        "mt-4 rounded-2xl border-4 border-red-400 bg-red-50 p-3 text-center font-bold text-red-600",
      neutral:
        "mt-4 rounded-2xl border-4 border-slate-200 bg-slate-50 p-3 text-center font-semibold text-slate-500",
    },

    // `optionCard` intentionally absent — see the header comment.
    // NGOẠI LỆ font-weight (xem "NHẸ ĐI MỘT NẤC" ở header): nhãn "A." / "B." GIỮ
    // `font-black`. Nó là mỏ neo quét mắt của học sinh, chỉ dài 2 ký tự và phải
    // tách khỏi phần chữ đáp án bên cạnh (nay font-semibold).
    optionLabel: (tone) => {
      switch (tone) {
        case "secondary":
          return "font-black mr-1 text-purple-500 shrink-0";
        case "success":
          return "font-black mr-1 text-green-500 shrink-0";
        case "danger":
          return "font-black mr-1 text-red-500 shrink-0";
        case "neutral":
          return "font-black mr-1 text-slate-400 shrink-0";
        default:
          return `font-black mr-0.5 ${a.text} shrink-0`;
      }
    },

    // Thick-bordered rounded field. The web fallbacks come in two sizes — the
    // inline prose blank (`px-2 py-1 rounded-xl`, FillBlank/Cloze) and the big
    // box (`px-4 py-3 rounded-2xl`, ShortAnswer/Essay/Numeric) — and one token
    // has to serve both, so this sits between them. Idle hue follows the
    // player's accent (amber FillBlank / teal Cloze / sky ShortAnswer…), like
    // the web fallbacks did. `focus-visible:ring-2` is the literal width the
    // accent's colour-only `focus` class needs to be visible.
    input: (state) => {
      const base =
        "px-3 py-2 rounded-xl border-4 font-semibold text-base outline-none transition-all";
      switch (state) {
        case "correct":
          return `${base} bg-green-50 border-green-400 text-green-700`;
        case "wrong":
          return `${base} bg-red-50 border-red-400 text-red-600`;
        case "focus":
          return `${base} bg-white ${a.ring} text-slate-800`;
        default:
          return `${base} bg-white ${a.ringSoft} text-slate-800 focus-visible:ring-2 ${a.focus}`;
      }
    },

    chip: (state) => {
      const base =
        "px-4 py-2 rounded-full border-4 font-semibold text-sm sm:text-base shadow-md transition-all select-none";
      switch (state) {
        case "correct":
          return `${base} bg-green-50 border-green-400 text-green-700`;
        case "wrong":
          return `${base} bg-red-50 border-red-400 text-red-600`;
        case "selected":
          // The joyful "picked me up" state is the amber highlight used by every
          // drag player (DragToZones, Categorize, CardSort).
          return `${base} bg-yellow-100 border-yellow-400 text-yellow-800 scale-105`;
        case "placed":
          return `${base} ${a.soft} ${a.ring} ${a.textStrong}`;
        default:
          return `${base} bg-white ${a.ringSoft} text-slate-800 ${a.softHover}`;
      }
    },

    // Inline selectable word inside prose: background only, no box model that
    // would detach punctuation or shift the baseline (px-0.5 cancelled by -mx-0.5).
    inlineToken: (state) => {
      const base = "px-0.5 -mx-0.5 rounded";
      switch (state) {
        case "correct":
          return `${base} bg-green-200 text-green-800`;
        case "wrong":
          return `${base} bg-red-200 text-red-700 line-through`;
        case "selected":
          return `${base} bg-yellow-200 text-slate-800`;
        default:
          return `${base} hover:bg-yellow-100`;
      }
    },

    dropZone: (state) => {
      const base = "rounded-3xl border-4 p-4 transition-all shadow-lg";
      switch (state) {
        case "active":
          return `${base} border-dashed ${a.ring} ${a.soft} scale-[1.02]`;
        case "correct":
          return `${base} border-green-400 bg-green-50`;
        case "wrong":
          return `${base} border-red-400 bg-red-50`;
        case "filled":
          return `${base} ${a.ringSoft} bg-white/70`;
        default:
          // Idle trays carry the identity tint (web's Categorize buckets are
          // coloured; the per-bucket ROTATION is a fallback-only decoration the
          // one-token skin cannot express, so every tray wears the player's hue).
          return `${base} border-dashed ${a.ringSoft} ${a.soft}`;
      }
    },

    // NGOẠI LỆ font-weight: nút hành động chính ("Kiểm tra" / "Lưu câu trả lời")
    // GIỮ `font-black` — chữ trắng trên nền màu đặc, và là đích bấm chính.
    actionButton: (enabled, tone) => {
      const base =
        "px-8 py-3 rounded-full border-4 font-black text-base sm:text-lg shadow-md transition-colors";
      if (!enabled) return `${base} border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed`;
      switch (tone) {
        case "secondary":
          return `${base} border-purple-500 bg-purple-400 text-white hover:bg-purple-500`;
        case "success":
          return `${base} border-emerald-500 bg-emerald-400 text-white hover:bg-emerald-500`;
        case "danger":
          return `${base} border-rose-500 bg-rose-400 text-white hover:bg-rose-500`;
        case "neutral":
          return `${base} border-slate-400 bg-slate-300 text-slate-800 hover:bg-slate-400`;
        default:
          // "Kiểm tra" wears the player's identity colour (nút nộp hồng ở
          // essay, amber ở fill-blank…) — the joyful web look.
          return `${base} ${a.ring} ${a.button}`;
      }
    },

    feedback: (kind) => {
      const base = "mt-4 text-center font-bold text-lg md:text-xl";
      switch (kind) {
        case "success":
          return `${base} text-green-600`;
        case "error":
          return `${base} text-red-500`;
        default:
          return `${base} text-slate-500`;
      }
    },

    // ── Total-theme primitives — chunky / white-bordered / soft-shadowed ────
    panel: (variant, state) => {
      if (state) {
        switch (state) {
          case "active":
            return `rounded-3xl border-4 border-dashed ${a.ring} ${a.soft}`;
          case "correct":
            return "rounded-3xl border-4 border-green-400 bg-green-50";
          case "wrong":
            return "rounded-3xl border-4 border-red-400 bg-red-50";
          case "filled":
            return "rounded-3xl border-4 border-white bg-white/70 shadow-md";
        }
      }
      switch (variant) {
        case "media":
          return "rounded-2xl border-4 border-white shadow-md";
        case "table":
          // web-own (SBT-69): viền ngoài slate-300 cùng màu nét kẻ ô — viền
          // trắng trên nền trắng khiến bảng chỉ còn bóng đổ làm ranh giới.
          return "rounded-[24px] border-2 border-slate-300 bg-white shadow-2xl overflow-hidden";
        case "clues":
          // web-own (SBT-69): khung gợi ý ô chữ giữ viền cũ — chỉ bảng dữ liệu
          // đổi viền sang slate-300.
          return "rounded-[24px] border-4 border-white bg-white shadow-2xl overflow-hidden";
        case "tray":
          return "rounded-3xl border-4 border-white bg-white/60 shadow-md";
        case "board":
          return "rounded-2xl border-4 border-white bg-white/60 shadow-lg";
        case "inset":
          // The accent-tinted well: essay rubric (bg-rose-50 border-rose-200 on
          // web), context boxes… — the strongest single carrier of the player's
          // identity colour on the card.
          return `rounded-2xl border-4 ${a.ringSoft} ${a.soft}`;
        default:
          return "rounded-3xl border-4 border-white bg-white/70 shadow-md";
      }
    },

    emphasis: (tone, level = "strong") => {
      const hue =
        tone === "primary"
          ? { strong: a.textStrong, medium: a.text, soft: a.text }
          : tone === "secondary"
            ? { strong: "text-purple-600", medium: "text-purple-600", soft: "text-purple-500" }
            : tone === "success"
              ? { strong: "text-green-700", medium: "text-green-600", soft: "text-green-500" }
              : tone === "danger"
                ? // web's danger emphasis fallback is red-500 at every level.
                  { strong: "text-red-500", medium: "text-red-500", soft: "text-red-400" }
                : { strong: "text-slate-800", medium: "text-slate-800", soft: "text-slate-500" };
      switch (level) {
        case "soft":
          return `font-semibold ${hue.soft}`;
        case "medium":
          return `font-semibold ${hue.medium}`;
        default:
          return `font-bold ${hue.strong}`;
      }
    },

    // NGOẠI LỆ font-weight: badge GIỮ `font-black`. Con SỐ nhỏ (thứ hạng, số bước,
    // điểm) chữ trắng trên nền màu bão hoà trong vòng tròn ~w-7 — hạ nấc là mờ hẳn.
    badge: (tone, state) => {
      switch (state) {
        case "correct":
          return "bg-green-500 text-white font-black";
        case "wrong":
          return "bg-red-500 text-white font-black";
      }
      switch (tone) {
        case "secondary":
          return "bg-purple-500 text-white font-black";
        case "success":
          return "bg-emerald-500 text-white font-black";
        case "danger":
          return "bg-rose-500 text-white font-black";
        case "neutral":
          return "bg-slate-400 text-white font-black";
        default:
          return `${a.bar} text-white font-black`;
      }
    },

    marker: (state) => {
      switch (state) {
        case "correct":
          return "border-4 border-green-500 bg-green-400/70";
        case "wrong":
          return "border-4 border-red-400 bg-red-300/60";
        case "active":
          return "border-4 border-amber-400 bg-amber-300/60";
        case "filled":
          return `border-4 ${a.ring} ${a.bar}`;
        default:
          // A visible outline is load-bearing: this token also draws the
          // MultiChoice / ImageChoiceMulti checkbox, whose idle tick is white —
          // a white border on a white fill made the box disappear entirely.
          return "border-4 border-slate-200 bg-white";
      }
    },

    iconButton: (tone, active) => {
      const base = "shadow-lg transition-colors text-white";
      switch (tone) {
        case "secondary":
          return `${base} bg-purple-500 hover:bg-purple-600`;
        case "success":
          return `${base} bg-emerald-500 hover:bg-emerald-600`;
        case "danger":
          return `${base} bg-rose-500 hover:bg-rose-600`;
        case "neutral":
          return active
            ? `${base} bg-slate-500 hover:bg-slate-600`
            : "shadow transition-colors bg-slate-200 hover:bg-slate-300 text-slate-600";
        default:
          return `shadow-lg transition-colors ${a.button}`;
      }
    },

    accent: (tone, role) => {
      const pick = (
        brand: string | undefined,
        neutral: string,
        green: string,
        red: string,
        purple: string | undefined,
      ) =>
        tone === "success"
          ? green
          : tone === "danger"
            ? red
            : tone === "neutral"
              ? neutral
              : tone === "secondary"
                ? purple
                : brand;
      switch (role) {
        case "fill":
          return pick(a.bar, "bg-slate-500", "bg-green-500", "bg-red-500", "bg-purple-400");
        case "softFill":
          return pick(a.soft, "bg-slate-200", "bg-green-100", "bg-red-100", "bg-purple-100");
        case "stripe":
          // Sọc thân bảng: tint bản sắc ở nấc đậm — surface học sinh giữ ngôn
          // ngữ màu joyful thay vì xám công sở, vẫn đủ tương phản để dò theo
          // hàng ở bảng dài.
          return pick(a.softStrong, "bg-slate-200", "bg-green-100", "bg-red-100", "bg-purple-100");
        case "band":
          // Tầng cấu trúc của bảng đậm hơn sọc một nấc, giữ thứ bậc đọc:
          // tiêu đề / hàng nhóm → sọc → hàng trần.
          return pick(a.band, "bg-slate-300", "bg-green-200", "bg-red-200", "bg-purple-200");
        case "text":
          return pick(a.text, "text-slate-500", "text-green-600", "text-red-500", "text-purple-600");
        case "ring":
          // Brand tones defer to the player fallback — the accent set has no
          // ring-* literals for Tailwind to scan.
          return pick(undefined, "ring-slate-300", "ring-green-400", "ring-red-400", undefined);
        case "track":
          return "bg-slate-200";
        case "shadow":
          return "shadow-lg";
      }
    },

    surface: "rounded-3xl border-4 border-white bg-white/70 shadow-md",
  };
}

/** Cache RIÊNG của corporate — xem cảnh báo ở header. Dùng chung
 * `playfulTokenCache` sẽ khiến hai skin phát nhầm token cho nhau. */
const corporateTokenCache = new Map<string, QuestionPlayerSkin>();

export const corporateSkin: AccentAwareSkin = {
  name: "corporate",
  forAccent: (a) => {
    let tokens = corporateTokenCache.get(a.name);
    if (!tokens) {
      tokens = corporateTokens(a);
      corporateTokenCache.set(a.name, tokens);
    }
    return tokens;
  },
};

/**
 * The DEFAULT skin: `playfulAccentSkin` cho MỌI theme (factory accent-aware,
 * useSkin() bind với accent của player đang render — xem accent-context.tsx).
 *
 * Trước 11/8 theme `corporate` (deploy NXBGD) map sang `corporateSkin`;
 * Owner 11/8 quyết cho NXBGD dùng chung look playful accent với các brand
 * khác — `corporateSkin` giữ lại trong SKINS cho ai truyền đích danh
 * skin="corporate" (PlayersDemoPage…).
 *
 * Gọi MỘT LẦN ở app root (AppProviders → <SkinProvider skin={getDefaultSkin()}>)
 * rồi cung cấp qua context, nên không cần memoize ở đây — useSkin() chỉ là
 * useContext thuần. (Config đã load trước bundle nên gọi lúc render root là an toàn.)
 */
export function getDefaultSkin(): AnySkin {
  return playfulAccentSkin;
}

export const SKINS: Record<SkinName, AnySkin> = {
  default: playfulAccentSkin,
  studio: studioSkin,
  playful: playfulAccentSkin,
  dark: darkSkin,
  corporate: corporateSkin,
};

/**
 * Resolve a skin prop (name or object). Trả AnySkin: skin accent-aware
 * (playfulSkin) được useSkin() bind với accent của player lúc render —
 * xem accent-context.tsx.
 */
export function resolveSkin(
  skin: AnySkin | SkinName | undefined,
): AnySkin {
  // `undefined` AND the literal "default" both mean "the theme default" —
  // route both through getDefaultSkin() so "default" stays theme-aware instead
  // of pinning to the static SKINS.default (= playfulSkin).
  if (!skin || skin === "default") return getDefaultSkin();
  if (typeof skin === "string") return SKINS[skin] ?? getDefaultSkin();
  return skin;
}
