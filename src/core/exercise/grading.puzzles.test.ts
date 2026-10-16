/**
 * Chấm sáu loại câu đố — nơi ĐỊNH NGHĨA câu đố chính là đáp án.
 *
 * Sáu loại này không có `correctAnswer`: `words`, `pairs`, `tiles`, `differences`,
 * `answer`, `grid` vừa là đề vừa là đáp án. Trước bản này cả sáu rơi vào
 * `default: UNGRADABLE` nên học sinh chơi xong **không có điểm**, dù studio-be đã khai
 * chúng là `auto`.
 *
 * Mỗi kỳ vọng dưới đây soi gương ĐÚNG điều kiện thắng ghi ở đầu file player tương ứng
 * — player đã tự chấm khi học sinh chơi xong, nên hai bên phải nói cùng một câu.
 */
import { describe, expect, it } from 'vitest';
import { gradeByType } from './grading';

const OK = { isCorrect: true, gradable: true };
const WRONG = { isCorrect: false, gradable: true };
const PENDING = { isCorrect: false, gradable: false };

const grade = (type: string, schema: Record<string, unknown>, answer: unknown) =>
  gradeByType(type, schema, undefined, answer);

describe('word_search — tìm đủ mọi từ', () => {
  const schema = { words: ['MEO', 'CHIM', 'CA'] };
  const found = (...w: string[]) => w.map((word) => ({ word, cells: [] }));

  it('tìm đủ ba từ là đúng', () => {
    expect(grade('word_search', schema, found('MEO', 'CHIM', 'CA'))).toEqual(OK);
  });

  it('thiếu một từ là sai', () => {
    expect(grade('word_search', schema, found('MEO', 'CHIM'))).toEqual(WRONG);
  });

  it('không phân biệt hoa thường', () => {
    expect(grade('word_search', schema, found('meo', 'Chim', 'ca'))).toEqual(OK);
  });

  it('đề không có từ nào thì để giáo viên chấm', () => {
    expect(grade('word_search', { words: [] }, found('MEO'))).toEqual(PENDING);
  });
});

describe('memory_match — ghép hết cặp', () => {
  const schema = { pairs: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] };

  it('ghép đủ ba cặp là đúng', () => {
    expect(grade('memory_match', schema, ['p1', 'p2', 'p3'])).toEqual(OK);
  });

  it('thứ tự không quan trọng', () => {
    expect(grade('memory_match', schema, ['p3', 'p1', 'p2'])).toEqual(OK);
  });

  it('lặp lại một cặp KHÔNG bù cho cặp còn thiếu', () => {
    // Không lọc trùng thì ['p1','p1','p2'] có 3 phần tử và sẽ khớp số lượng — đúng oan.
    expect(grade('memory_match', schema, ['p1', 'p1', 'p2'])).toEqual(WRONG);
  });

  it('còn cặp chưa ghép là sai', () => {
    expect(grade('memory_match', schema, ['p1', 'p2'])).toEqual(WRONG);
  });
});

describe('pikachu — ăn hết bàn', () => {
  // 6 ô = 3 cặp.
  const schema = { tiles: [1, 2, 3, 4, 5, 6] };

  it('ăn đủ 3 cặp là đúng', () => {
    expect(grade('pikachu', schema, 3)).toEqual(OK);
  });

  it('ăn thiếu là sai', () => {
    expect(grade('pikachu', schema, 2)).toEqual(WRONG);
  });

  it('chưa trả lời là sai, không phải chờ chấm', () => {
    expect(grade('pikachu', schema, null)).toEqual(WRONG);
  });
});

describe('spot_difference — tìm hết điểm khác biệt', () => {
  const schema = { differences: [{ id: 'd1' }, { id: 'd2' }] };

  it('tìm đủ là đúng', () => {
    expect(grade('spot_difference', schema, ['d1', 'd2'])).toEqual(OK);
  });

  it('thiếu một điểm là sai', () => {
    expect(grade('spot_difference', schema, ['d1'])).toEqual(WRONG);
  });

  it('bấm trùng một điểm không bù cho điểm còn thiếu', () => {
    expect(grade('spot_difference', schema, ['d1', 'd1'])).toEqual(WRONG);
  });
});

describe('hangman — mở đúng từ', () => {
  const schema = { answer: 'CON MÈO' };

  it('mở đúng từ là đúng', () => {
    expect(grade('hangman', schema, 'CON MÈO')).toEqual(OK);
  });

  it('không phân biệt hoa thường và khoảng trắng đầu cuối', () => {
    expect(grade('hangman', schema, '  con mèo ')).toEqual(OK);
  });

  it('mở dở dang là sai — player báo chuỗi còn gạch khi thua', () => {
    expect(grade('hangman', schema, 'CON M__')).toEqual(WRONG);
  });

  it('đề không khai đáp án thì để giáo viên chấm', () => {
    expect(grade('hangman', {}, 'gì cũng được')).toEqual(PENDING);
  });
});

describe('jigsaw — mọi mảnh đúng ô', () => {
  const schema = { grid: { rows: 2, cols: 2 } };
  const place = (pairs: [string, string][]) =>
    pairs.map(([pieceId, slotId]) => ({ pieceId, slotId }));

  it('đặt đúng cả 4 mảnh là đúng', () => {
    expect(
      grade('jigsaw', schema, place([['0-0', '0-0'], ['0-1', '0-1'], ['1-0', '1-0'], ['1-1', '1-1']])),
    ).toEqual(OK);
  });

  it('đặt đúng nhưng THIẾU mảnh là sai', () => {
    // Chỉ kiểm "mảnh nào đã đặt thì đặt đúng" sẽ chấm bài mới đặt 1 mảnh thành đúng.
    expect(grade('jigsaw', schema, place([['0-0', '0-0']]))).toEqual(WRONG);
  });

  it('đủ số mảnh nhưng có mảnh sai ô là sai', () => {
    expect(
      grade('jigsaw', schema, place([['0-0', '0-0'], ['0-1', '1-0'], ['1-0', '0-1'], ['1-1', '1-1']])),
    ).toEqual(WRONG);
  });

  it('đề không khai lưới thì để giáo viên chấm', () => {
    expect(grade('jigsaw', {}, place([['0-0', '0-0']]))).toEqual(PENDING);
  });
});
