/**
 * Căn lề cho một mảnh KHÔNG chọn được trong đoạn văn của bài highlight (SBT-71).
 *
 * Dòng nguồn kiểu "(Theo Kao Sơn)" phải nằm riêng một dòng, sát lề phải như sách.
 * Trước bản vá này mảnh chỉ có `text`/`runs`/`selectable`, nên nội dung đẩy tên
 * tác giả sang phải bằng hơn 100 dấu cách — chỉ khớp một cỡ màn hình: màn hẹp
 * thì dấu cách tràn dòng, màn rộng thì không sát lề.
 *
 * Tác giả khai `align` TƯỜNG MINH chứ không đoán theo mẫu "(Theo …)": nguồn ghi
 * nhiều kiểu ("Theo …", "… tổng hợp", có khi không ngoặc), đoán là sót hoặc bắt
 * nhầm một câu văn bình thường.
 *
 * web-own: chưa upstream lên studio — xem mục J trong WEB-OWN PATCHES ở
 * apps/learner/scripts/detokenize-players.mjs.
 */
import type { RichTextRun } from "@/core/question-schema";

export const HIGHLIGHT_SEGMENT_ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export type HighlightSegmentAlign = keyof typeof HIGHLIGHT_SEGMENT_ALIGN_CLASS;

/**
 * `segments` đi thẳng từ kho schemaless — giá trị lạ (`"Right"`, `1`, `"end"`)
 * coi như không khai, để mảnh rơi về dạng nội dòng như cũ thay vì ăn một class
 * không tồn tại.
 */
export function highlightSegmentAlign(value: unknown): HighlightSegmentAlign | undefined {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(HIGHLIGHT_SEGMENT_ALIGN_CLASS, value)
    ? (value as HighlightSegmentAlign)
    : undefined;
}

type AlignedSegmentInput = { text?: unknown; runs?: unknown };

/** `text` / `run.text` đi thẳng từ kho schemaless — không phải chuỗi thì coi như rỗng. */
function normalizedRuns(segment: AlignedSegmentInput): RichTextRun[] {
  if (Array.isArray(segment.runs) && segment.runs.length > 0) {
    return segment.runs.map((run) => {
      const r = run && typeof run === "object" ? (run as RichTextRun) : ({} as RichTextRun);
      return { ...r, text: typeof r.text === "string" ? r.text : "" };
    });
  }
  return [{ text: typeof segment.text === "string" ? segment.text : "", annotations: {} } as RichTextRun];
}

const hasRuns = (segment: AlignedSegmentInput) => Array.isArray(segment.runs) && segment.runs.length > 0;

/** Cắt runs tại vị trí `at` (tính trên chuỗi ghép), giữ annotations của từng run. */
function sliceRunsAt(runs: RichTextRun[], at: number): [RichTextRun[], RichTextRun[]] {
  const head: RichTextRun[] = [];
  const tail: RichTextRun[] = [];
  let pos = 0;
  for (const run of runs) {
    const end = pos + run.text.length;
    if (end <= at) head.push(run);
    else if (pos >= at) tail.push(run);
    else {
      head.push({ ...run, text: run.text.slice(0, at - pos) });
      tail.push({ ...run, text: run.text.slice(at - pos) });
    }
    pos = end;
  }
  return [head, tail];
}

/**
 * Mảnh căn lề đã là một dòng riêng, nên khoảng trắng ở HAI ĐẦU chỉ còn là di
 * sản của cách cũ: "\n" mở đầu sinh ra một dòng trống phía trên, còn dãy dấu
 * cách đứng trước "(" đẩy chữ lệch khỏi lề phải đúng bấy nhiêu. Cắt đi để nội
 * dung cũ chỉ cần thêm `align` là hiển thị đúng.
 *
 * Cắt xuyên qua các run: run đầu chỉ toàn khoảng trắng ("\n   ") bị bỏ hẳn rồi
 * mới cắt tiếp run kế. Khoảng trắng GIỮA các run giữ nguyên ("(" + "Theo ").
 */
export function trimAlignedSegmentValue(segment: AlignedSegmentInput): string | RichTextRun[] {
  const runs = normalizedRuns(segment).map((run) => ({ ...run }));
  while (runs.length > 0) {
    runs[0].text = runs[0].text.trimStart();
    if (runs[0].text) break;
    runs.shift();
  }
  while (runs.length > 0) {
    const last = runs.length - 1;
    runs[last].text = runs[last].text.trimEnd();
    if (runs[last].text) break;
    runs.pop();
  }
  return hasRuns(segment) ? runs : runs.map((run) => run.text).join("");
}

/** Dấu câu đứng đầu mảnh (sau khoảng trắng, nếu có). */
const LEADING_PUNCTUATION = /^\s*([.,;:!?…]+)/;

/**
 * Tách mảnh căn lề làm hai phần:
 *  - `lead`: dấu câu dính ĐẦU mảnh — dữ liệu thật để dấu chấm cuối đoạn văn
 *    chung mảnh với nguồn (`".⟨113 dấu cách⟩(Theo Kao Sơn)"`). Phần này ở lại
 *    nội dòng, cuối đoạn văn phía trước, thay vì bị kéo sang dòng căn lề.
 *  - `body`: phần còn lại, đã cắt khoảng trắng hai đầu — nội dung dòng căn lề.
 * Phần nào rỗng thì là `null` (mảnh chỉ có "." không sinh dòng căn lề rỗng).
 */
export function splitAlignedSegment(segment: AlignedSegmentInput): {
  lead: string | RichTextRun[] | null;
  body: string | RichTextRun[] | null;
} {
  const runs = normalizedRuns(segment);
  const joined = runs.map((run) => run.text).join("");
  const match = LEADING_PUNCTUATION.exec(joined);
  const leadEnd = match ? match[0].length : 0;
  const [headRuns, tailRuns] = sliceRunsAt(runs, leadEnd);
  const leadRuns = headRuns
    .map((run) => ({ ...run, text: run.text.replace(/\s+/g, "") }))
    .filter((run) => run.text);
  const keepRuns = hasRuns(segment);
  const body = trimAlignedSegmentValue(keepRuns ? { runs: tailRuns } : { text: tailRuns.map((r) => r.text).join("") });
  const lead = leadRuns.length === 0 ? null : keepRuns ? leadRuns : leadRuns.map((r) => r.text).join("");
  return { lead, body: body.length === 0 ? null : body };
}
