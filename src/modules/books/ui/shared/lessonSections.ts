/**
 * Các phần (lesson_item) của một bài học — CHỈ là dữ liệu hiển thị lấy từ API
 * công khai `/book-excercise/public/detail`. Bài tập, lượt làm và chấm điểm vẫn
 * đi theo `exerciseId` của API danh sách bài tập, không tách theo phần.
 */
export interface LessonSection {
  key: string;
  title: string;
  questionIds: string[];
}

/** Nhãn của một câu: thuộc mạch nào, và là bài tập số mấy TRONG mạch đó. */
export interface QuestionLabel {
  /** Mạch bài tập: "ĐỌC", "VIẾT", "LUYỆN TỪ VÀ CÂU"… hoặc "TIẾT 1 – 2". */
  line: string;
  /** Chữ hiện trên đầu câu hỏi: phần sau tên mạch của bản thảo. */
  sectionLabel: string;
  /** Số bài tập trong mạch, đếm từ 1 — đúng số in trong VBT. */
  ordinal: number;
  /** Tổng số bài tập của mạch. */
  lineTotal: number;
}

/** Một chấm của dải nhảy nhanh: số hiện trên chấm + mạch để vẽ vạch ngăn. */
export interface QuestionNavMark {
  label: string;
  group: string;
}

interface RawLessonItem {
  title: string | null;
  questions: Array<{ id: string }>;
}

/** Phần không tên hoặc không có câu hỏi thì bỏ — hiện lên chỉ là mục rỗng. */
export function toLessonSections(items: RawLessonItem[]): LessonSection[] {
  return items
    .map((item, index) => ({
      key: String(index),
      title: item.title?.trim() ?? "",
      questionIds: item.questions.map((question) => question.id),
    }))
    .filter(
      (section) => section.title !== "" && section.questionIds.length > 0,
    );
}

/** Mạch có ghi âm bài đọc kèm theo (góp ý 21/8). */
export const READING_LINE = "ĐỌC";

/**
 * Dấu ngăn giữa tên mạch và tên phần trong `lesson_items[].title`. Gạch ASCII
 * chỉ tính khi có khoảng trắng hai bên, để "ĐỌC-HIỂU" không bị cắt làm đôi.
 */
// `g`: splitTitle duyệt mọi dấu ngăn bằng matchAll (không có `g` là ném TypeError).
const LINE_SEPARATOR = /\s*[–—:]\s*|\s+-\s+/g;

/** NFC: nội dung LCMS có thể về dạng NFD, khi đó "ĐỌC" tổ hợp không bằng
 *  "ĐỌC" dựng sẵn — mất nút nghe và mạch bị tách làm đôi. */
const chuanHoa = (title: string) => title.normalize("NFC");

/**
 * Tách "mạch – phần" ở dấu ngăn đầu tiên. Dấu ngăn có chữ số ở CẢ HAI bên
 * nằm trong một khoảng số ("Tiết 1 – 2"), không phải sau tên mạch — bỏ qua
 * nó và xét dấu ngăn kế tiếp ("Tiết 1 – 2: Luyện tập" → "Tiết 1 – 2"). Xét chữ số thay vì liệt kê tên mạch: danh sách sẽ hỏng ngầm
 * khi sách mới thêm mạch lạ.
 */
function splitTitle(title: string): { line: string; label: string } {
  const t = chuanHoa(title);

  const matches = [...t.matchAll(LINE_SEPARATOR)];
  if (matches.length === 0) {
    return { line: t.trim(), label: "" };
  }

  for (const match of matches) {
    const index = match.index ?? 0;
    const separator = match[0];

    const before = t.slice(0, index);
    const after = t.slice(index + separator.length);

    // Bỏ qua dấu "–" nếu nó tạo thành khoảng số, ví dụ "1 – 2".
    if (/\d\s*$/.test(before) && /^\s*\d/.test(after)) {
      continue;
    }

    return {
      line: before.trim(),
      label: after.trim(),
    };
  }

  return { line: t.trim(), label: "" };
}

/** Mạch bài tập của một phần = chữ đứng trước dấu ngăn đầu tiên. */
export function lineOf(title: string): string {
  return splitTitle(title).line.toUpperCase();
}

/**
 * Chữ hiện trên đầu câu hỏi = phần SAU dấu ngăn ("ĐỌC – BÀI ĐỌC" → "BÀI ĐỌC").
 *
 * Bản thảo phải giữ tiền tố mạch trong `title` vì đó là nguồn DUY NHẤT để đánh
 * số theo mạch và để biết câu có thuộc mạch ĐỌC hay không; đổi chữ hiển thị là
 * đổi phần sau dấu ngăn, không đụng tiền tố.
 */
export function sectionLabel(title: string): string {
  return splitTitle(title).label;
}

/**
 * Số thứ tự bài tập của từng câu, đếm lại từ 1 mỗi khi ĐỔI MẠCH — hai phần
 * "ĐỌC – Trả lời câu hỏi" và "ĐỌC – Luyện tập theo văn bản đọc" cùng mạch ĐỌC
 * nên đánh số nối tiếp, hết ĐỌC sang VIẾT mới quay về 1.
 */
export function toQuestionLabels(
  sections: LessonSection[],
): Record<string, QuestionLabel> {
  const labels: Record<string, QuestionLabel> = {};
  const countByLine: Record<string, number> = {};

  for (const section of sections) {
    const line = lineOf(section.title);
    for (const questionId of section.questionIds) {
      countByLine[line] = (countByLine[line] ?? 0) + 1;
      labels[questionId] = {
        line,
        sectionLabel: sectionLabel(section.title),
        ordinal: countByLine[line],
        lineTotal: 0,
      };
    }
  }
  for (const label of Object.values(labels)) {
    label.lineTotal = countByLine[label.line];
  }
  return labels;
}

/**
 * Mạch của câu đang mở đã làm xong hết chưa — lời giải mở theo NHÓM, không bắt
 * xong cả bài. Câu không tra được mạch thì xét cả bài: thà chặt hơn là lộ lời
 * giải của một mạch chưa làm.
 */
export function isLineAnswered(
  questionId: string,
  questionIds: string[],
  labels: Record<string, QuestionLabel>,
  isAnswered: (questionId: string) => boolean,
): boolean {
  const line = labels[questionId]?.line;
  const sameLine = line
    ? questionIds.filter((id) => labels[id]?.line === line)
    : questionIds;
  return sameLine.length > 0 && sameLine.every(isAnswered);
}

/**
 * Nhãn từng chấm của dải nhảy nhanh, theo THỨ TỰ CÂU CỦA RUNNER (API bài tập
 * có thể trả khác thứ tự lesson_items). Trả `undefined` khi còn câu chưa tra
 * được nhãn: dải phải đánh số toàn bài, thay vì nửa theo mạch nửa theo bài.
 */
export function toNavMarks(
  questionIds: string[],
  labels: Record<string, QuestionLabel>,
): QuestionNavMark[] | undefined {
  if (questionIds.length === 0) return undefined;
  const marks: QuestionNavMark[] = [];
  for (const questionId of questionIds) {
    const label = labels[questionId];
    if (!label) return undefined;
    marks.push({ label: String(label.ordinal), group: label.line });
  }
  return marks;
}
