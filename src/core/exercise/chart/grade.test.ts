/**
 * Luật chấm bài dựng biểu đồ, và các bẫy của nó.
 *
 * Bẫy nguy hiểm nhất là `Number(null) === 0`: một cột CHƯA đặt sẽ được đọc thành 0 và
 * câu có đáp án 0 thành đúng oan. Cùng lỗi mà `numeric_answer` đã phải chốt riêng.
 */
import { describe, expect, it } from 'vitest';
import { gradeChartBuild } from './grade';

const correct = { c1: 5, c2: 3, c3: 8 };
const OK = { isCorrect: true, gradable: true };
const WRONG = { isCorrect: false, gradable: true };
const PENDING = { isCorrect: false, gradable: false };

describe('gradeChartBuild', () => {
  it('khớp cả ba cột thì đúng', () => {
    expect(gradeChartBuild(correct, { c1: 5, c2: 3, c3: 8 })).toEqual(OK);
  });

  it('lệch một cột là sai', () => {
    expect(gradeChartBuild(correct, { c1: 5, c2: 4, c3: 8 })).toEqual(WRONG);
  });

  it('thiếu một cột là SAI, không phải chờ chấm', () => {
    // Đã đặt vài cột nghĩa là học sinh đang làm bài; bỏ trống một cột là làm chưa
    // xong chứ không phải chưa bắt đầu.
    expect(gradeChartBuild(correct, { c1: 5, c2: 3 })).toEqual(WRONG);
  });

  it('chưa đặt cột nào thì CHỜ chấm', () => {
    expect(gradeChartBuild(correct, {})).toEqual(PENDING);
    expect(gradeChartBuild(correct, undefined)).toEqual(PENDING);
  });

  it('cột bỏ trống KHÔNG được đọc thành 0', () => {
    // Nếu đọc null/'' thành 0 thì bài dưới đây được tính ĐÚNG dù học sinh chưa
    // đặt cột c2 — đúng bẫy Number(null) === 0.
    const zeroTarget = { c1: 1, c2: 0 };
    expect(gradeChartBuild(zeroTarget, { c1: 1, c2: null })).toEqual(WRONG);
    expect(gradeChartBuild(zeroTarget, { c1: 1, c2: '' })).toEqual(WRONG);
    expect(gradeChartBuild(zeroTarget, { c1: 1, c2: 0 })).toEqual(OK);
  });

  it('cột thừa ngoài đáp án không ảnh hưởng', () => {
    // Tác giả đổi bớt hạng mục sau khi học sinh đã làm — bài cũ vẫn chấm theo
    // đáp án hiện tại chứ không đỏ vì dữ liệu dư.
    expect(gradeChartBuild(correct, { c1: 5, c2: 3, c3: 8, cX: 99 })).toEqual(OK);
  });

  it('tôn trọng dung sai khi tác giả khai', () => {
    expect(gradeChartBuild(correct, { c1: 5.4, c2: 3, c3: 8 }, 0.5)).toEqual(OK);
    expect(gradeChartBuild(correct, { c1: 6, c2: 3, c3: 8 }, 0.5)).toEqual(WRONG);
  });

  it('tác giả chưa khai đáp án thì để giáo viên chấm', () => {
    expect(gradeChartBuild({}, { c1: 5 })).toEqual(PENDING);
    expect(gradeChartBuild(null, { c1: 5 })).toEqual(PENDING);
    expect(gradeChartBuild([1, 2, 3], { c1: 5 })).toEqual(PENDING);
  });

  it('giá trị không phải số bị coi là chưa đặt', () => {
    expect(gradeChartBuild(correct, { c1: 'năm', c2: 3, c3: 8 })).toEqual(WRONG);
  });
});
