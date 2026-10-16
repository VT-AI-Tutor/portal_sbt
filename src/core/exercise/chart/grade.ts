/**
 * Chấm bài dựng biểu đồ (II.39, `chart_build`).
 *
 * Một module riêng dù luật rất ngắn, vì có BA nơi cần đúng cùng một luật: player tự
 * chấm khi học sinh kéo cột, `grading.ts` chấm lúc bấm "Kiểm tra", và bản PHP chấm
 * lại để ghi điểm. Ba bản cài đặt song song sẽ lệch nhau; một hàm dùng chung thì
 * không.
 */

import type { ChartAnswer } from './types';

export interface ChartVerdict {
  isCorrect: boolean;
  /** false khi tác giả chưa khai đáp án, hoặc học sinh chưa đặt đủ hạng mục. */
  gradable: boolean;
}

/**
 * Giá trị học sinh đặt cho một hạng mục — `null` khi chưa đặt.
 *
 * Tách hàm này ra vì đây là cái bẫy: `Number(null) === 0` và `Number('') === 0`, nên
 * một cột CHƯA đặt sẽ được chấm là 0 và câu có đáp án 0 thành đúng oan. Cùng lỗi mà
 * `numeric_answer` đã phải chốt bằng comment riêng.
 */
function readValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function gradeChartBuild(
  correct: unknown,
  answer: unknown,
  /** Dung sai theo đơn vị trục dọc. Mặc định 0 — giá trị snap vào vạch nên khớp tuyệt đối. */
  tolerance = 0,
): ChartVerdict {
  if (correct === null || typeof correct !== 'object' || Array.isArray(correct)) {
    return { isCorrect: false, gradable: false };
  }
  const want = correct as ChartAnswer;
  const keys = Object.keys(want);
  if (keys.length === 0) return { isCorrect: false, gradable: false };

  const got = (answer && typeof answer === 'object' ? answer : {}) as Record<string, unknown>;

  // Chưa đặt hạng mục nào thì là CHƯA LÀM, không phải làm sai — khác biệt này quyết
  // định việc màn hình hiện dấu đỏ hay chỉ "đã lưu".
  const placed = keys.filter((k) => readValue(got[k]) !== null);
  if (placed.length === 0) return { isCorrect: false, gradable: false };

  const allMatch = keys.every((k) => {
    const value = readValue(got[k]);
    const target = readValue(want[k]);
    if (value === null || target === null) return false;
    return Math.abs(value - target) <= tolerance;
  });
  return { isCorrect: allMatch, gradable: true };
}
