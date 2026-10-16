/**
 * diagram-fill-download.ts — vẽ bài làm của học sinh LÊN ảnh nền rồi xuất PNG.
 *
 * web-own (22/09/2026, CHƯA upstream lên studio) — xem checklist cuối
 * apps/learner/scripts/detokenize-players.mjs.
 *
 * Vẽ canvas chứ KHÔNG chụp DOM bằng `html-to-image` (repo có sẵn): đo
 * 22/09/2026 trên phiếu 2023×1349 thì html-to-image mất ~60s, ra đúng cỡ màn
 * hình nên in bị vỡ, và cắt cụt chữ dài y như ô nhập. Canvas xong tức thì, giữ
 * độ phân giải gốc, chữ tự xuống dòng cho vừa ô.
 */

/**
 * Chỉ phiếu NXB yêu cầu "tải về điền rồi nộp lên" (SBT-50) mới có nút "Tải ảnh
 * bài làm". Cờ `answerImageDownload` trong payload thắng nếu nội dung có khai —
 * TODO: thêm trường này ở Studio rồi bỏ danh sách cứng bên dưới.
 * Danh sách khoá mã câu + TÊN FILE ảnh, không theo thư mục UUID của sách, để
 * upload lại asset không làm nút biến mất im lặng.
 */
const ANSWER_IMAGE_DOWNLOADS: ReadonlyArray<{ id: string; imageFile: string }> = [
  // Đạo đức 2 · Bài 5 Quý trọng thời gian · câu 7 (thời gian biểu)
  { id: "b5_q7_a", imageFile: "bai5_q7.png" },
];

export function isAnswerImageDownloadable(
  payload: { id?: unknown; answerImageDownload?: unknown },
  backgroundImage: string | undefined,
): boolean {
  if (!backgroundImage) return false;
  if (typeof payload.answerImageDownload === "boolean") return payload.answerImageDownload;
  if (typeof payload.id !== "string") return false;
  const imageFile = backgroundImage.split(/[?#]/)[0].split("/").pop();
  return ANSWER_IMAGE_DOWNLOADS.some((entry) => entry.id === payload.id && entry.imageFile === imageFile);
}

/**
 * Hình dạng node mà module này cần. Khai TẠI ĐÂY chứ không import
 * `DiagramFillNode` từ DiagramFillPlayer: player import ngược lại module này,
 * và một kiểu cấu trúc rời giữ helper test được mà không kéo cả cây React vào.
 */
export interface DownloadableNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** Hộp chữ nhật trong hệ toạ độ PIXEL của ảnh gốc. */
export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bề rộng/cao mặc định khi node không khai — khớp `width: "20%"` của player. */
const DEFAULT_CELL_WIDTH = 0.2;
const DEFAULT_CELL_HEIGHT = 0.08;
/** Cùng sàn kẹp với nodeWidthPercent / nodeHeightPercent trong DiagramFillPlayer. */
const MIN_CELL_WIDTH = 0.03;
const MIN_CELL_HEIGHT = 0.02;

const fraction = (value: unknown, fallback: number, floor: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value <= 0 || value > 1) return fallback;
  return Math.max(value, floor);
};

/**
 * Toạ độ tâm về dạng tỉ lệ 0..1. Gương của `coordinatePercent` trong
 * DiagramFillPlayer: nội dung cũ khai x/y theo PHẦN TRĂM 0..100, và hai bên
 * lệch quy ước thì chữ rơi ra ngoài ảnh mà không ai báo lỗi.
 */
const centerFraction = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  return percent >= 0 && percent <= 100 ? percent / 100 : null;
};

/**
 * Hộp của một node, tính ra pixel ảnh gốc.
 *
 * `x`/`y` là TÂM hộp, không phải góc trên trái: player đặt node bằng
 * `left/top` phần trăm kèm `-translate-x-1/2 -translate-y-1/2`. Lấy nhầm thành
 * góc thì chữ trôi xuống dưới nửa ô — nhìn vẫn "gần đúng" ở hàng đầu nên rất
 * dễ bỏ qua, hàng cuối mới lòi ra ngoài bảng.
 */
export function diagramFillCellRect(
  node: DownloadableNode,
  imageWidth: number,
  imageHeight: number,
): CellRect | null {
  const cx = centerFraction(node.x);
  const cy = centerFraction(node.y);
  if (cx === null || cy === null) return null;

  const width = fraction(node.width, DEFAULT_CELL_WIDTH, MIN_CELL_WIDTH) * imageWidth;
  const height = fraction(node.height, DEFAULT_CELL_HEIGHT, MIN_CELL_HEIGHT) * imageHeight;
  return { x: cx * imageWidth - width / 2, y: cy * imageHeight - height / 2, width, height };
}

/** Đo bề rộng một chuỗi ở cỡ chữ đang đặt — canvas thật hoặc hàm giả khi test. */
export type MeasureText = (text: string, fontSize: number) => number;

export interface TextLayout {
  lines: string[];
  fontSize: number;
}

/** Cắt một từ dài hơn cả ô thành nhiều mẩu vừa bề rộng (tên riêng, URL…). */
function breakLongWord(word: string, maxWidth: number, fontSize: number, measure: MeasureText): string[] {
  const parts: string[] = [];
  let cur = "";
  for (const ch of word) {
    if (cur && measure(cur + ch, fontSize) > maxWidth) {
      parts.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

function wrap(text: string, maxWidth: number, fontSize: number, measure: MeasureText): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (measure(candidate, fontSize) <= maxWidth) {
      cur = candidate;
      continue;
    }
    if (cur) lines.push(cur);
    // Từ đơn vẫn quá rộng thì cắt nhỏ, giữ mẩu cuối làm dòng đang dựng.
    const parts = measure(word, fontSize) > maxWidth ? breakLongWord(word, maxWidth, fontSize, measure) : [word];
    lines.push(...parts.slice(0, -1));
    cur = parts[parts.length - 1] ?? "";
  }
  if (cur) lines.push(cur);
  return lines;
}

const MAX_FONT_RATIO = 0.3;
/** Cỡ chữ nhỏ nhất còn đọc được khi in — test khoá theo hằng này. */
export const MIN_FONT_SIZE = 9;
const LINE_HEIGHT_RATIO = 1.25;
/** Chừa lề trong ô để chữ không dính vạch kẻ của phiếu. */
const PAD_X_RATIO = 0.08;
const USABLE_HEIGHT_RATIO = 0.92;

/**
 * Xếp chữ vừa một ô: thử cỡ to nhất trước rồi hạ dần tới khi đủ chỗ.
 *
 * Luôn trả về kết quả — cỡ nhỏ nhất mà vẫn tràn thì thà chữ bé còn hơn bỏ
 * trắng ô, vì đây là bài làm của học sinh chứ không phải nhãn trang trí.
 */
export function layoutCellText(
  text: string,
  rect: CellRect,
  measure: MeasureText,
): TextLayout | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const maxWidth = rect.width * (1 - PAD_X_RATIO * 2);
  const maxHeight = rect.height * USABLE_HEIGHT_RATIO;
  const start = Math.max(Math.floor(rect.height * MAX_FONT_RATIO), MIN_FONT_SIZE);

  let last: TextLayout = { lines: [trimmed], fontSize: MIN_FONT_SIZE };
  for (let fontSize = start; fontSize >= MIN_FONT_SIZE; fontSize -= 1) {
    const lines = wrap(trimmed, maxWidth, fontSize, measure);
    last = { lines, fontSize };
    if (lines.length * fontSize * LINE_HEIGHT_RATIO <= maxHeight) return last;
  }
  return last;
}

/** Nét chữ bài làm — đậm vừa, màu slate-900 như ô nhập trên màn. */
export const ANSWER_FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const ANSWER_FONT_WEIGHT = 600;
export const ANSWER_COLOR = "#0f172a";

/**
 * Vẽ đáp án đã điền lên context của ảnh nền.
 *
 * `nodes` phải là các node ĐIỀN ĐƯỢC, không phải toàn bộ node: `values` nạp từ
 * bài đã lưu có thể còn khoá của một node nay đã đổi thành nhãn tĩnh, và vẽ nó
 * ra sẽ cho file tải về khác với màn hình.
 */
export function paintAnswers(
  ctx: CanvasRenderingContext2D,
  nodes: DownloadableNode[],
  values: Record<string, string>,
  imageWidth: number,
  imageHeight: number,
): void {
  const measure: MeasureText = (text, fontSize) => {
    ctx.font = `${ANSWER_FONT_WEIGHT} ${fontSize}px ${ANSWER_FONT_STACK}`;
    return ctx.measureText(text).width;
  };

  ctx.fillStyle = ANSWER_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const node of nodes) {
    const value = values[node.id];
    if (typeof value !== "string" || !value.trim()) continue;
    const rect = diagramFillCellRect(node, imageWidth, imageHeight);
    if (!rect) continue;
    const layout = layoutCellText(value, rect, measure);
    if (!layout) continue;

    ctx.font = `${ANSWER_FONT_WEIGHT} ${layout.fontSize}px ${ANSWER_FONT_STACK}`;
    const lineHeight = layout.fontSize * LINE_HEIGHT_RATIO;
    const centerX = rect.x + rect.width / 2;
    const firstY = rect.y + rect.height / 2 - ((layout.lines.length - 1) * lineHeight) / 2;
    layout.lines.forEach((line, i) => ctx.fillText(line, centerX, firstY + i * lineHeight));
  }
}

/**
 * Vì sao không xuất được file. Người gọi cần phân biệt, không chỉ để log:
 * "ảnh chưa tải xong" là trạng thái TẠM (đợi thêm là được) còn các lỗi kia là
 * hỏng thật — hai tình huống phải nói với học sinh bằng hai câu khác nhau.
 */
export type DiagramFillDownloadErrorCode = "image-not-ready" | "no-canvas" | "export-failed";

export class DiagramFillDownloadError extends Error {
  constructor(
    message: string,
    readonly code: DiagramFillDownloadErrorCode,
  ) {
    super(message);
    this.name = "DiagramFillDownloadError";
  }
}

/**
 * Ảnh nền + bài làm → PNG ở độ phân giải gốc.
 *
 * Nhận THẲNG thẻ <img> player đang hiện, không tự tải lại: máy chủ statics đo
 * được 4,9 KB/s ngày 22/09/2026, tải lần hai là bắt học sinh chờ thêm một lượt
 * y hệt. Đổi lại thẻ đó PHẢI khai `crossOrigin` từ đầu, không thì canvas nhiễm
 * và `toBlob` ném SecurityError.
 *
 * Vì thế KHÔNG dùng `loadImageViaBlob` (core/content/loadImage.ts) như
 * FreeDrawPlayer: nó nạp lại bằng `use-credentials`, khác mode nên không chung
 * cache — đúng cú tải lại cần tránh — và mode đó hỏng với host trả `ACAO: *`.
 *
 * Chưa điền ô nào vẫn xuất: ra tấm phiếu trắng để in ra viết tay.
 */
export async function renderDiagramFillAnswerImage(
  image: HTMLImageElement,
  nodes: DownloadableNode[],
  values: Record<string, string>,
): Promise<Blob> {
  if (!image.complete || !(image.naturalWidth > 0)) {
    throw new DiagramFillDownloadError("Ảnh nền chưa tải xong.", "image-not-ready");
  }
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new DiagramFillDownloadError("Ảnh nền không có kích thước.", "image-not-ready");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new DiagramFillDownloadError("Trình duyệt không hỗ trợ vẽ ảnh.", "no-canvas");

  ctx.drawImage(image, 0, 0, width, height);
  paintAnswers(ctx, nodes, values, width, height);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new DiagramFillDownloadError("Không tạo được file ảnh.", "export-failed")),
        "image/png",
      );
    } catch {
      // Ảnh nền thiếu CORS → canvas nhiễm, toBlob ném ngay tại đây.
      reject(new DiagramFillDownloadError("Không đọc được ảnh nền để tạo file.", "export-failed"));
    }
  });
}

/**
 * Tên file tải về — bỏ dấu và ký tự lạ để mọi hệ điều hành mở được.
 *
 * Trùng thuật toán với `core/reference/suggestCode.ts` và CỐ Ý không import nó:
 * `exercise/**` là vùng dùng chung với studio, chưa có một import nào sang
 * `core/reference`, nên nối vào đó sẽ vỡ ngay khi module này được upstream.
 */
export function answerImageFileName(title: string | undefined): string {
  const slug = (title ?? "bai-lam")
    .normalize("NFD")
    // Escape chứ KHÔNG gõ dấu tổ hợp thẳng vào nguồn: chúng vô hình, và file
    // này bị codemod sync đọc/ghi lại mỗi lần nên rất dễ hỏng lặng lẽ.
    .replace(/\p{Mn}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    // Cắt 60 ký tự có thể rơi vào giữa một từ và để lại gạch nối cuối tên.
    .replace(/-+$/, "");
  return `${slug || "bai-lam"}.png`;
}
