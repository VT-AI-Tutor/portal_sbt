/**
 * Chuẩn bị đề để IN RA GIẤY (PAPER-R16).
 *
 * Ba việc: lọc bỏ câu không in được, tách phần trắc nghiệm khỏi phần tự luận
 * theo đúng khuôn đề kiểm tra Việt Nam, và dựng lại BẢNG MA TRẬN từ chính các
 * câu đang nằm trong đề.
 */
import type {
  PaperQuestion,
  TeacherPaper,
} from "@/modules/teacher/api/teacherPaperApi";

/**
 * Dạng câu in ra giấy được — PHẢI khớp `PrintableQuestionTypes::LIST` phía máy
 * chủ. Hai bên lệch nhau thì công tắc "in được ra giấy" lọc một đằng còn bản in
 * bỏ một nẻo, và giáo viên chỉ phát hiện khi đã cầm tờ giấy thiếu câu.
 */
export const PRINTABLE_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "multi_true_false",
  "fill_blank",
  "short_answer",
  "essay",
] as const;

/** Dạng khoanh/tô — vào phần trắc nghiệm và vào phiếu trả lời. */
const CHOICE_TYPES = ["single_choice", "multiple_choice", "true_false"];

export interface PrintQuestion extends PaperQuestion {
  /** Số thứ tự trong phần của nó, đánh lại từ 1 cho mỗi phần. */
  number: number;
}

export interface PrintablePaper {
  choice: PrintQuestion[];
  written: PrintQuestion[];
  /** Số câu bị bỏ vì không in ra giấy được — phải báo cho giáo viên biết. */
  droppedCount: number;
  totalPoints: number;
}

export function preparePrintablePaper(paper: TeacherPaper): PrintablePaper {
  const printable = paper.questions.filter((q) =>
    (PRINTABLE_TYPES as readonly string[]).includes(q.type),
  );

  const choice: PrintQuestion[] = [];
  const written: PrintQuestion[] = [];
  for (const q of printable) {
    const bucket = CHOICE_TYPES.includes(q.type) ? choice : written;
    bucket.push({ ...q, number: bucket.length + 1 });
  }

  return {
    choice,
    written,
    // Im lặng bỏ câu là cách chắc chắn nhất để giáo viên in ra mới phát hiện
    // đề thiếu — đếm và bày ra.
    droppedCount: paper.questions.length - printable.length,
    totalPoints: round2(
      printable.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
    ),
  };
}

/** Nhãn phương án A · B · C · D… */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Nội dung phương án, chịu được cả chuỗi thuần lẫn `{id,content}`. */
export function optionText(option: unknown): unknown {
  if (option !== null && typeof option === "object") {
    return (option as { content?: unknown }).content ?? "";
  }
  return option ?? "";
}

/**
 * Đáp án đúng của một câu, ở dạng chữ cái để in bảng đáp án.
 *
 * Chấp nhận cả `correct_answer` (chỉ số hoặc mảng chỉ số) lẫn `payload.answer`
 * — hai phương ngữ cùng tồn tại trong kho, và trang đáp án in ra mà thiếu một
 * nửa số câu thì vô dụng.
 */
export function answerLabel(q: PaperQuestion): string {
  const payload = (q.payload ?? {}) as Record<string, unknown>;
  const raw = q.correct_answer ?? payload.answer ?? payload.correctAnswer;

  if (raw === null || raw === undefined || raw === "") return "—";

  if (Array.isArray(raw)) {
    return raw.map((v) => indexToLabel(v, q)).join(", ") || "—";
  }
  if (typeof raw === "boolean") return raw ? "Đúng" : "Sai";
  return indexToLabel(raw, q);
}

function indexToLabel(value: unknown, q: PaperQuestion): string {
  const isIndex =
    typeof value === "number" ||
    (typeof value === "string" && /^\d+$/.test(value));
  if (isIndex && CHOICE_TYPES.includes(q.type)) {
    const index = Number(value);
    if (index >= 0 && index < q.options.length) return optionLetter(index);
  }
  return String(value);
}

/** Lời giải của câu, nếu tác giả hoặc trợ lý AI có ghi. */
export function explanationOf(q: PaperQuestion): string {
  const payload = (q.payload ?? {}) as Record<string, unknown>;
  const value = payload.explanation ?? payload.solution ?? "";
  return typeof value === "string" ? value : "";
}

export interface MatrixRow {
  contentCode: string;
  /** Nhãn đông cứng lúc ra đề; rơi về mã nếu đề cũ chưa có nhãn. */
  label: string;
  counts: Record<string, number>;
  points: Record<string, number>;
  total: number;
  totalPoints: number;
}

/**
 * Dựng lại bảng ma trận TỪ CHÍNH CÁC CÂU đang nằm trong đề, không đọc ảnh chụp
 * ma trận lưu trên đề.
 *
 * Lý do: giáo viên sửa đề sau khi sinh (bớt câu, chèn tay) thì ảnh chụp nói
 * dối, còn ô ghi trên từng câu thì luôn khớp tờ đề đang cầm trên tay — mà đây
 * là bảng nộp kèm cho nhà trường.
 */
export function buildMatrixFromQuestions(
  questions: PaperQuestion[],
  levelCodes: string[],
): MatrixRow[] {
  const rows = new Map<string, MatrixRow>();

  for (const q of questions) {
    const cell = q.blueprint_cell;
    if (!cell?.content_code) continue;

    let row = rows.get(cell.content_code);
    if (!row) {
      row = {
        contentCode: cell.content_code,
        label: cell.label?.trim() || cell.content_code,
        counts: Object.fromEntries(levelCodes.map((c) => [c, 0])),
        points: Object.fromEntries(levelCodes.map((c) => [c, 0])),
        total: 0,
        totalPoints: 0,
      };
      rows.set(cell.content_code, row);
    }

    const levelCode = cell.level_code;
    if (levelCode in row.counts) {
      row.counts[levelCode] += 1;
      row.points[levelCode] = round2(
        row.points[levelCode] + (Number(q.points) || 0),
      );
    }
    row.total += 1;
    row.totalPoints = round2(row.totalPoints + (Number(q.points) || 0));
  }

  return [...rows.values()];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
