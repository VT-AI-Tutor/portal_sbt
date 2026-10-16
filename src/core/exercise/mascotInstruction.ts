/**
 * Lời nhắc của mascot (BusyBee) ở chân màn làm bài.
 *
 * Câu chữ phải khớp THAO TÁC THẬT trên màn hình, tức là theo cặp
 * (question type × interaction type) của manifest — KHÔNG chỉ theo type.
 * Ví dụ single_choice có 6 interaction: `radio` là chạm chọn, chỉ riêng
 * `circle` mới thật sự "khoanh tròn", `color_fill` là tô màu ô.
 * Lời nhắc cũng phải là thao tác trên máy (chạm/kéo/nhập), không phải thao tác
 * trên vở giấy ("ghi Đ/S vào ô trống", "viết vào chỗ chấm").
 *
 * Module này CỐ Ý không import players/manifest: chuỗi import của manifest kéo
 * theo rich-text/html → DOMPurify, làm chậm mọi test có mock QuestionPlayer.
 * Bù lại, `mascotInstruction.test.ts` đối chiếu bảng dưới đây với manifest nên
 * cặp mới hoặc alias mới không thể lọt qua mà không có lời nhắc.
 */
// Chỉ import KIỂU — không kéo chuỗi rich-text/html → DOMPurify vào lúc chạy.
import type { RichTextRun } from "@/core/question-schema";

/**
 * Lời mascot nói: chuỗi trơn, hoặc các run giữ định dạng khi gợi ý của người
 * soạn có in nghiêng/đậm… (SBT-73). Lời nhắc theo interaction và lời phản hồi
 * sau khi chấm luôn là chuỗi.
 */
export type MascotMessage = string | RichTextRun[];

/** Chỉ phần payload dùng để suy ra lời nhắc. */
interface DisplayPayload {
  display?: { interactionType?: unknown; layout?: unknown; [key: string]: unknown };
  layout?: unknown;
  hint?: unknown;
}

/** Type cũ trong dữ liệu seed/legacy, không có trong manifest. */
const LEGACY_TYPES: Record<string, { type: string; interactionType: string }> = {
  short_answer: { type: "fill_blank", interactionType: "short_text" },
  free_draw: { type: "drawing", interactionType: "draw" },
};

/**
 * `type` → `interactionType` → lời nhắc.
 *
 * KHOÁ ĐẦU TIÊN của mỗi type phải là `defaultInteraction` của manifest — nó là
 * lời nhắc dùng khi payload không nói rõ interaction (guard test kiểm tra).
 * Alias cũ (`tile`, `arrange`, `list`) nằm cùng bảng với lời nhắc y hệt bản
 * canonical để payload cũ không rơi về lời nhắc chung.
 */
const INSTRUCTIONS: Record<string, Record<string, string>> = {
  single_choice: {
    radio: "Chọn đáp án đúng nhé!",
    button: "Chạm vào ô có đáp án đúng nhé!",
    tile: "Chạm vào ô có đáp án đúng nhé!",
    image: "Chọn hình đúng nhé!",
    dropdown: "Chọn đáp án trong danh sách nhé!",
    circle: "Khoanh tròn vào đáp án đúng nhé!",
    color_fill: "Tô màu ô có đáp án đúng nhé!",
  },
  multiple_choice: {
    checkbox: "Chọn tất cả đáp án đúng nhé!",
    button: "Chạm vào tất cả ô có đáp án đúng nhé!",
    image: "Chọn tất cả hình đúng nhé!",
    circle: "Khoanh tròn vào tất cả đáp án đúng nhé!",
    color_fill: "Tô màu tất cả ô có đáp án đúng nhé!",
  },
  true_false: {
    boolean: "Chọn Đúng hoặc Sai nhé!",
    yes_no: "Chọn Có hoặc Không nhé!",
  },
  multi_true_false: {
    radio: "Chọn Đúng hoặc Sai cho từng ý nhé!",
    list: "Chọn Đúng hoặc Sai cho từng ý nhé!",
  },
  multi_true_false_table: { table: "Chọn Đúng hoặc Sai cho từng hàng trong bảng nhé!" },
  fill_blank: {
    text: "Điền từ thích hợp vào chỗ trống nhé!",
    short_text: "Viết câu trả lời ngắn của em nhé!",
  },
  cloze: {
    inline: "Điền vào các chỗ trống trong đoạn nhé!",
    word_bank: "Kéo từ trong hộp từ vào chỗ trống nhé!",
    picture: "Nhìn tranh rồi điền vào chỗ trống nhé!",
  },
  numeric_answer: { numeric: "Nhập kết quả bằng số nhé!" },
  essay: { long_text: "Viết câu trả lời của em nhé!" },
  matching: {
    columns: "Chọn một ý bên trái rồi chọn ý phù hợp bên phải để nối nhé!",
    lines: "Em chọn để nối các ý phù hợp với nhau nhé.",
    rows: "Nối ý ở hàng trên với ý phù hợp ở hàng dưới nhé!",
    radial: "Nối các ý xung quanh với ý ở giữa nhé!",
    chain: "Nối lần lượt 3 cột thành chuỗi đúng nhé!",
    scene: "Nối các ý phù hợp trong hình nhé!",
  },
  ordering: {
    list: "Sắp xếp các ý theo đúng thứ tự nhé!",
    arrange: "Sắp xếp các ý theo đúng thứ tự nhé!",
    rank: "Xếp hạng các ý theo thứ tự phù hợp nhé!",
    process: "Sắp xếp các bước theo đúng trình tự nhé!",
    timeline: "Đặt các sự kiện vào đúng mốc thời gian nhé!",
  },
  classification: {
    buckets: "Kéo mỗi thẻ vào đúng nhóm nhé!",
    two_bucket: "Chia các thẻ vào 2 nhóm cho đúng nhé!",
    image_color: "Tô màu các vùng theo đúng nhóm nhé!",
  },
  hotspot: {
    single: "Nhấn vào đúng vị trí trên hình nhé!",
    multiple: "Nhấn vào tất cả vị trí đúng trên hình nhé!",
  },
  labeling: { image: "Kéo nhãn vào đúng vị trí trên hình nhé!" },
  connect_points: { lines: "Nối các điểm theo yêu cầu nhé!" },
  mind_map_completion: { fill: "Điền vào các ô trống của sơ đồ tư duy nhé!" },
  table_completion: { fill: "Điền vào các ô trống trong bảng nhé!" },
  speaking: { record: "Nhấn nút ghi âm rồi nói bài của em nhé!" },
  dictation: { transcribe: "Nghe rồi viết lại nội dung nhé!" },
  upload_answer: { upload: "Tải file bài làm của em lên nhé!" },
  math_expression: {
    formula: "Nhập biểu thức vào ô nhé!",
    text: "Nhập biểu thức vào ô nhé!",
  },
  math_cloze: { formula: "Điền vào ô trống trong biểu thức nhé!" },
  point_marking: { pin: "Nhấn để đánh dấu đúng vị trí trên hình nhé!" },
  scale: {
    likert: "Chọn mức phù hợp nhé!",
    slider: "Kéo thanh trượt tới mức phù hợp nhé!",
    stars: "Chọn số sao phù hợp nhé!",
    confidence: "Kéo thanh để chọn mức tự tin của em nhé!",
    differential: "Chọn vị trí phù hợp giữa hai ý nhé!",
  },
  highlight: {
    text: "Tô phần đúng trong đoạn văn nhé!",
    tokens: "Chọn những từ đúng trong đoạn nhé!",
  },
  drawing: { draw: "Vẽ bài của em nào!" },
  geometry_grid: { construct: "Bấm vào các điểm trên lưới để dựng hình nhé!" },
  chart_build: { plot: "Bấm vào vạch để dựng biểu đồ nhé!" },
  media_anchored: {
    video: "Xem video rồi trả lời câu hỏi nhé!",
    audio: "Nghe rồi trả lời câu hỏi nhé!",
  },
  coloring: { regions: "Chọn màu rồi tô vào đúng vùng nhé!" },
  mind_map: { build: "Dựng sơ đồ tư duy của em nào!" },
  checkbox_table: { rows: "Tích chọn ô đúng trên mỗi hàng nhé!" },
  diagram_fill: { fill: "Điền nội dung vào các ô của sơ đồ nhé!" },
  path_connect: { path: "Nối đường đi qua các điểm theo đúng thứ tự nhé!" },
  memory_match: { flip: "Lật thẻ để tìm các cặp giống nhau nhé!" },
  pikachu: { onet: "Nối hai thẻ giống nhau để ăn điểm nhé!" },
  card_sort: { sort: "Phân loại các thẻ vào đúng nhóm nhé!" },
  jigsaw: { pieces: "Chọn mảnh rồi đặt vào đúng ô để ghép hình nhé!" },
  word_search: { grid: "Kéo chọn các từ ẩn trong lưới nhé!" },
  crossword: { grid: "Điền các chữ vào ô chữ nhé!" },
  hangman: { guess: "Đoán từng chữ cái để tìm ra từ nhé!" },
  spot_difference: { spots: "Nhấn vào những điểm khác nhau giữa 2 hình nhé!" },
  question_group: { group: "Trả lời lần lượt các câu hỏi nhé!" },
  timed_quiz: { timed: "Trả lời nhanh trước khi hết giờ nhé!" },
  lives_streak: { lives: "Trả lời đúng để giữ mạng nhé!" },
  board_game: { board: "Trả lời đúng để đi tiếp trên bàn cờ nhé!" },
  path_trail: { trail: "Trả lời đúng để đi tiếp trên chặng đường nhé!" },
  // §5.11 — canonical từ 2026-08-06 (trước đó là mở rộng chỉ-đọc).
  drag_drop: {
    zones: "Kéo thả vào đúng vùng nhé!",
    grid: "Kéo thả vào đúng ô trên lưới nhé!",
  },
};

export const MASCOT_FALLBACK_INSTRUCTION = "Làm bài nhé!";

/**
 * Lời khen/nhắc khi CHẤM NGAY (instant marking).
 *
 * `element-*` là phản hồi cho TỪNG thao tác (mỗi phần tử vừa được chấm),
 * `question-*` là phản hồi khi cả câu đã chấm xong. Mỗi nhóm xoay vòng theo số
 * lần đã nói để mascot không lặp một câu suốt bài.
 */
const FEEDBACK_MESSAGES = {
  "element-correct": ["Đúng rồi!", "Chuẩn luôn!", "Giỏi quá!"],
  "element-wrong": [
    "Chưa đúng, thử lại nhé!",
    "Suýt đúng rồi, thử lại nào!",
    "Chưa đúng đâu, xem lại nhé!",
  ],
  "question-correct": [
    "Cả câu đúng hết rồi, giỏi quá!",
    "Xong câu này rồi, tuyệt lắm!",
    "Hoàn thành câu này, cừ ghê!",
  ],
  "question-wrong": ["Còn ý chưa đúng, thử lại nhé!"],
} as const;

export type MascotFeedbackKind = keyof typeof FEEDBACK_MESSAGES;

/** `seq` là số lần mascot đã nói (dùng để xoay vòng, không phải ngẫu nhiên). */
export function mascotFeedbackMessage(kind: MascotFeedbackKind, seq = 0): string {
  const pool = FEEDBACK_MESSAGES[kind];
  return pool[Math.abs(seq) % pool.length];
}

/** `display.layout` cũ của matching thật ra là tên interaction (xem question-schema/matching). */
const MATCHING_LAYOUT_ALIASES: Record<string, string> = {
  columns: "columns",
  lines: "lines",
  rows: "rows",
  row: "rows",
  radial: "radial",
  chain: "chain",
  scene: "scene",
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

/** Interaction ghi trong payload; suy từ layout cũ khi payload chưa canonical. */
function interactionFromPayload(type: string, payload?: DisplayPayload): string | undefined {
  const explicit = readString(payload?.display?.interactionType);
  if (explicit) return explicit;

  const layout = readString(payload?.display?.layout) ?? readString(payload?.layout);
  if (!layout) return undefined;
  if (type === "matching") return MATCHING_LAYOUT_ALIASES[layout];
  if ((type === "single_choice" || type === "multiple_choice") && layout === "image-grid") {
    return "image";
  }
  return undefined;
}

/** Bản sao `SAFE_COLOR_RE` của rich-text/html — không import được vì kéo theo DOMPurify. */
const SAFE_COLOR_RE = /^(?:#[0-9a-f]{3}(?:[0-9a-f]{3})?|rgb\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}\s*\)|rgba\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)|(?:black|white|red|green|blue|gray|grey|orange|purple|pink|yellow|teal|navy|maroon))$/i;

const BUBBLE_FLAGS = ["bold", "italic", "underline", "strike", "subscript", "superscript"] as const;

/**
 * Định dạng mà bong bóng mascot vẽ được. `annotations` đi thẳng từ kho schemaless:
 * cờ chỉ nhận đúng `true` (chuỗi "false" không tính), màu phải là màu an toàn
 * ("default" hay rỗng bỏ qua). `code`/`link` bị bỏ vì BusyBee không vẽ chúng —
 * giữ lại sẽ biến gợi ý chữ trơn thành run mà không hiện gì khác.
 */
function bubbleMarks(annotations: unknown): RichTextRun["annotations"] {
  if (!annotations || typeof annotations !== "object" || Array.isArray(annotations)) return {};
  const source = annotations as Record<string, unknown>;
  const marks: RichTextRun["annotations"] = {};
  for (const key of BUBBLE_FLAGS) if (source[key] === true) marks[key] = true;
  const color = typeof source.color === "string" ? source.color.trim() : "";
  if (SAFE_COLOR_RE.test(color)) marks.color = color;
  return marks;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return HTML_ENTITIES[name.toLowerCase()] ?? match;
  });
}

const HTML_MARK_TAGS: Record<string, (typeof BUBBLE_FLAGS)[number]> = {
  b: "bold",
  strong: "bold",
  i: "italic",
  em: "italic",
  u: "underline",
  s: "strike",
  strike: "strike",
  del: "strike",
  sub: "subscript",
  sup: "superscript",
};

/**
 * Gợi ý HTML cũ (block chỉ có `text`) → các run, giữ nghiêng/đậm/gạch chân…
 * Thẻ khác bị bỏ; `<br>` và ranh giới khối thành một dấu cách. React tự thoát
 * ký tự khi vẽ nên không cần làm sạch HTML ở đây.
 */
function legacyHtmlRuns(html: string): RichTextRun[] {
  const depth: Partial<Record<(typeof BUBBLE_FLAGS)[number], number>> = {};
  const runs: RichTextRun[] = [];
  const push = (raw: string) => {
    const text = decodeEntities(raw);
    if (!text) return;
    const annotations: RichTextRun["annotations"] = {};
    for (const key of BUBBLE_FLAGS) if ((depth[key] ?? 0) > 0) annotations[key] = true;
    runs.push({ text, annotations });
  };
  const tagRe = /<\s*(\/?)\s*([a-z0-9]+)[^>]*>/gi;
  let last = 0;
  for (let match = tagRe.exec(html); match; match = tagRe.exec(html)) {
    push(html.slice(last, match.index));
    last = tagRe.lastIndex;
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const mark = HTML_MARK_TAGS[tag];
    if (mark) depth[mark] = Math.max(0, (depth[mark] ?? 0) + (closing ? -1 : 1));
    else if (tag === "br" || /^(?:p|div|li|h[1-6])$/.test(tag)) push(" ");
  }
  push(html.slice(last));
  return runs;
}

/** Cắt khoảng trắng ở đầu run đầu và cuối run cuối — tương đương `line.trim()`. */
function trimRunLine(runs: RichTextRun[]): RichTextRun[] {
  const out = runs.map((run) => ({ ...run }));
  while (out.length > 0) {
    out[0].text = out[0].text.trimStart();
    if (out[0].text) break;
    out.shift();
  }
  while (out.length > 0) {
    const last = out.length - 1;
    out[last].text = out[last].text.trimEnd();
    if (out[last].text) break;
    out.pop();
  }
  return out;
}

/**
 * Gợi ý do người soạn viết trong payload, GIỮ định dạng của từng run.
 * Mỗi block thành một "dòng", các dòng nối bằng một dấu cách.
 *
 * CHỈ nhận `hint` dạng rich content: `hint` chuỗi là gợi ý của trò chơi hangman
 * (dispatch → HangmanPlayer), đã in sẵn giữa màn nên mascot không nói lại.
 * Không dùng `plainTextFromRichContent` vì chuỗi import của nó kéo theo
 * DOMPurify — cùng lý do đã ghi ở đầu file. Cùng lý do đó, block chỉ có `text`
 * (HTML cũ) được đọc bằng `legacyHtmlRuns` gọn bên dưới thay vì rich-text/html.
 */
function hintRuns(payload?: DisplayPayload): RichTextRun[] | undefined {
  const blocks = (payload?.hint as { blocks?: unknown } | undefined)?.blocks;
  if (!Array.isArray(blocks)) return undefined;
  const lines = blocks
    .map((block): RichTextRun[] => {
      const { content, text } = (block ?? {}) as { content?: unknown; text?: unknown };
      if (Array.isArray(content)) {
        return content.flatMap((run) => {
          const { text: runText, annotations } = (run ?? {}) as { text?: unknown; annotations?: unknown };
          if (typeof runText !== "string" || !runText) return [];
          return [{ text: runText, annotations: bubbleMarks(annotations) }];
        });
      }
      return typeof text === "string" ? legacyHtmlRuns(text) : [];
    })
    .map(trimRunLine)
    .filter((line) => line.length > 0);
  if (lines.length === 0) return undefined;
  return lines.flatMap((line, i) => (i === 0 ? line : [{ text: " ", annotations: {} }, ...line]));
}

/** Gợi ý của người soạn dạng văn bản trơn. */
function hintText(payload?: DisplayPayload): string | undefined {
  return hintRuns(payload)?.map((run) => run.text).join("") || undefined;
}

/** Run có ít nhất một định dạng thật (nghiêng, đậm, màu…). */
function hasMarks(run: RichTextRun): boolean {
  return Object.values(run.annotations).some(Boolean);
}

/** Lời nhắc idle của mascot cho câu đang làm. */
export function mascotInstruction(
  questionType: string | undefined,
  payload?: unknown,
): string {
  const display =
    payload && typeof payload === "object" ? (payload as DisplayPayload) : undefined;
  // Gợi ý của người soạn bám sát câu hỏi hơn lời nhắc suy ra từ interaction.
  return hintText(display) ?? interactionInstruction(questionType, display);
}

/** Lời nhắc suy ra từ (type × interaction), khi người soạn không viết gợi ý. */
function interactionInstruction(questionType: string | undefined, display?: DisplayPayload): string {
  const raw = (questionType ?? "").trim();
  const legacy = LEGACY_TYPES[raw];
  const type = legacy?.type ?? raw;
  const byInteraction = INSTRUCTIONS[type];
  if (!byInteraction) return MASCOT_FALLBACK_INSTRUCTION;

  const interactionType =
    legacy?.interactionType ?? interactionFromPayload(type, display);

  // Khoá đầu bảng = defaultInteraction của manifest.
  const fallbackKey = Object.keys(byInteraction)[0];
  return (
    (interactionType ? byInteraction[interactionType] : undefined) ??
    byInteraction[fallbackKey] ??
    MASCOT_FALLBACK_INSTRUCTION
  );
}

/**
 * Lời nhắc idle cho bong bóng mascot, giữ định dạng của gợi ý người soạn
 * (SBT-73) — ví dụ vần *ăc, âc* in nghiêng trong `hint`.
 *
 * Trả các run CHỈ khi gợi ý có định dạng thật; gợi ý chữ trơn vẫn là chuỗi y
 * như `mascotInstruction`, nên câu không định dạng hiển thị không đổi một ký tự.
 */
export function mascotIdleMessage(questionType: string | undefined, payload?: unknown): MascotMessage {
  const display =
    payload && typeof payload === "object" ? (payload as DisplayPayload) : undefined;
  // Phân tích gợi ý MỘT lần: chuỗi trơn dựng lại từ chính các run này.
  const runs = hintRuns(display);
  if (runs?.some(hasMarks)) return runs;
  return runs?.map((run) => run.text).join("") || interactionInstruction(questionType, display);
}
