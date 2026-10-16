import { describe, expect, it } from 'vitest';
import { normalizeTableQuestionData, tableCellText, tableCellTextPatch } from './table';

describe('tableCellText', () => {
  it('prefers a flat text over any block text', () => {
    expect(tableCellText({
      text: 'Nhãn phẳng',
      content: { blocks: [{ type: 'paragraph', text: 'Nhãn khối' }] },
    })).toBe('Nhãn phẳng');
  });

  it('reads the label from content.blocks when text is absent or blank', () => {
    const content = { blocks: [{ type: 'paragraph', text: '1. Giữ gìn vệ sinh cảnh quan' }] };
    expect(tableCellText({ content })).toBe('1. Giữ gìn vệ sinh cảnh quan');
    expect(tableCellText({ text: '   ', content })).toBe('1. Giữ gìn vệ sinh cảnh quan');
  });

  it('keeps authored marks and skips media blocks', () => {
    expect(tableCellText({
      content: {
        blocks: [
          { type: 'image', url: 'assets/images/ve-sinh.png' },
          { type: 'paragraph', content: [{ text: 'Nhóm 1', annotations: { bold: true } }] },
        ],
      },
    })).toBe('<strong>Nhóm 1</strong>');
  });

  it('joins several text blocks, including inside a layout, with line breaks', () => {
    expect(tableCellText({
      content: {
        blocks: [
          { type: 'heading', text: 'Tiêu đề' },
          { type: 'layout', columns: [[{ type: 'paragraph', text: 'Cột trái' }]] },
        ],
      },
    })).toBe('Tiêu đề<br>Cột trái');
  });

  it('returns an empty string for an image-only or missing cell', () => {
    expect(tableCellText({ content: { blocks: [{ type: 'image', url: '/a.png' }] } })).toBe('');
    expect(tableCellText(undefined)).toBe('');
  });
});

describe('tableCellTextPatch', () => {
  it('drops only the blocks the label was read from', () => {
    expect(tableCellTextPatch({
      content: {
        blocks: [
          { type: 'image', url: 'assets/images/ve-sinh.png' },
          { type: 'paragraph', text: 'cũ' },
        ],
      },
    }, 'mới')).toEqual({
      text: 'mới',
      content: { blocks: [{ type: 'image', url: 'assets/images/ve-sinh.png' }] },
    });
  });

  it('clears content entirely when nothing but text blocks remain', () => {
    expect(tableCellTextPatch({
      content: { blocks: [{ type: 'paragraph', text: 'cũ' }] },
    }, 'mới')).toEqual({ text: 'mới', content: undefined });
  });

  it('leaves a cell without block text untouched apart from the new text', () => {
    expect(tableCellTextPatch({ text: 'cũ' }, 'mới')).toEqual({ text: 'mới' });
    expect(tableCellTextPatch({
      content: { blocks: [{ type: 'image', url: '/a.png' }] },
    }, 'mới')).toEqual({ text: 'mới' });
  });

  it('strips text blocks nested in a layout column, keeping the media beside them', () => {
    expect(tableCellTextPatch({
      content: {
        blocks: [{
          type: 'layout',
          columns: [
            [{ type: 'paragraph', text: 'cũ' }],
            [{ type: 'image', url: '/a.png' }],
          ],
        }],
      },
    }, 'mới')).toEqual({
      text: 'mới',
      content: { blocks: [{ type: 'layout', columns: [[], [{ type: 'image', url: '/a.png' }]] }] },
    });
  });
});

// GAP-229 — `normalizeTableQuestionData` nhận cả bảng v1 lẫn v2 (spec §5.16.6).
describe('normalizeTableQuestionData — bảng v1 (734 câu hỏi trên đĩa)', () => {
  const v1 = {
    headers: [
      { id: 'answer', label: 'Trả lời' },
      { id: 'note', label: 'Ghi chú' },
      { id: 'mark' },
    ],
    rows: [
      {
        id: 'r1',
        cells: [
          { columnId: 'answer', cellType: 'input', width: ' 8rem ', height: '21rem' },
          { columnId: 'note', cellType: 'essay', rowLines: 3 },
          { columnId: 'mark', cellType: 'tick', width: '9rem' },
        ],
      },
    ],
    tickGroups: [['mark'], []],
  };

  it('giữ nguyên mặt tiền cũ: headers, tickGroups và phép kiểm 3–20rem', () => {
    const table = normalizeTableQuestionData(v1);

    expect(table.sourceModel).toBe('v1');
    // Cột không có nhãn vẫn bị loại khỏi `headers` y như hàm cũ…
    expect(table.headers).toEqual([
      { id: 'answer', label: 'Trả lời' },
      { id: 'note', label: 'Ghi chú' },
    ]);
    // …nhưng trục cột chuẩn thì giữ đủ ba cột.
    expect(table.columns.map((column) => column.id)).toEqual(['answer', 'note', 'mark']);
    expect(table.tickGroups).toEqual([['mark']]);
    expect(table.rows[0].cells).toEqual([
      expect.objectContaining({ columnId: 'answer', cellType: 'input', width: '8rem', height: undefined }),
      expect.objectContaining({ columnId: 'note', cellType: 'essay', rowLines: 3 }),
      // Ô tick không phải input/essay ⇒ kích thước bị bỏ, như trước.
      expect.objectContaining({ columnId: 'mark', cellType: 'tick', width: undefined }),
    ]);
  });

  it('vắng khoá tickGroups vẫn cho undefined chứ không phải mảng rỗng', () => {
    expect(normalizeTableQuestionData({ headers: [], rows: [] }).tickGroups).toBeUndefined();
    expect(normalizeTableQuestionData(null).tickGroups).toBeUndefined();
    expect(normalizeTableQuestionData(null).rows).toEqual([]);
  });

  it('không dựng tầng tên cột khi mọi nhãn đều vắng (186 bảng trong kho)', () => {
    const table = normalizeTableQuestionData({
      headers: [{ id: 'c1' }, { id: 'c2' }],
      rows: [{ id: 'r1', cells: [{ columnId: 'c1', cellType: 'input' }] }],
    });

    // KHÔNG được dựng một hàng toàn ô rỗng thay cho tầng tên cột.
    expect(table.headerRows).toEqual([]);
    expect(table.headers).toEqual([]);
    expect(table.columns.map((column) => column.id)).toEqual(['c1', 'c2']);
  });

  it('không còn lọc mất ô của cột thiếu nhãn (50 bảng nhãn nửa vời)', () => {
    const table = normalizeTableQuestionData({
      headers: [{ id: 'c1' }, { id: 'c2', label: 'Đánh giá' }],
      rows: [{
        id: 'r1',
        cells: [
          { columnId: 'c1', cellType: 'static', text: 'Việc' },
          { columnId: 'c2', cellType: 'input' },
        ],
      }],
    });

    // Mặt tiền `headers` vẫn chỉ liệt kê cột có nhãn, y như hàm cũ…
    expect(table.headers).toEqual([{ id: 'c2', label: 'Đánh giá' }]);
    // …nhưng ô của cột không nhãn không còn bị bộ lọc theo `headers` xoá đi.
    expect(table.rows[0].cells.map((cell) => cell.columnId)).toEqual(['c1', 'c2']);
  });

  it('giữ caption, isGroupHeader và bù ô thiếu ở ĐẦU hàng', () => {
    const table = normalizeTableQuestionData({
      caption: 'Bảng theo dõi',
      headers: [{ id: 'c1', label: 'Việc' }, { id: 'c2', label: 'Đánh giá' }],
      rows: [
        { id: 'g1', isGroupHeader: true, cells: [{ columnId: 'c1', cellType: 'static', text: 'Tuần 1' }] },
        { id: 'r1', cells: [{ columnId: 'c2', cellType: 'input' }] },
      ],
    });

    expect(table.caption).toBe('Bảng theo dõi');
    expect(table.headerRows.map((row) => row.id)).toEqual(['__caption', '__header']);
    expect(table.headerRows[0].cells[0]).toMatchObject({ colSpan: 2, text: 'Bảng theo dõi' });
    expect(table.headerRows[1].cells.map((cell) => cell.text)).toEqual(['Việc', 'Đánh giá']);

    expect(table.rows[0].isGroupHeader).toBe(true);
    expect(table.rows[0].cells).toHaveLength(1);
    expect(table.rows[0].cells[0]).toMatchObject({ columnId: 'c1', colSpan: 2, text: 'Tuần 1' });

    // Ô thiếu được bù ở ĐẦU hàng, không phải cuối.
    expect(table.rows[1].cells.map((cell) => [cell.columnId, cell.cellType])).toEqual([
      ['c1', 'static'],
      ['c2', 'input'],
    ]);
  });

  it('giải nhãn/ảnh nằm trong content.blocks của ô tĩnh (#562)', () => {
    const table = normalizeTableQuestionData({
      headers: [{ id: 'c1', label: 'Ảnh' }],
      rows: [{
        id: 'r1',
        cells: [{
          columnId: 'c1',
          cellType: 'static',
          content: { blocks: [{ type: 'image', url: '/a.png' }, { type: 'paragraph', text: 'Chú thích' }] },
        }],
      }],
    });

    expect(table.rows[0].cells[0]).toMatchObject({ text: 'Chú thích', imageUrl: '/a.png' });
    // `content` gốc vẫn còn nguyên — chuẩn hoá không được làm mất dữ liệu.
    expect(table.rows[0].cells[0].content).toEqual({
      blocks: [{ type: 'image', url: '/a.png' }, { type: 'paragraph', text: 'Chú thích' }],
    });
  });
});

describe('normalizeTableQuestionData — bảng v2', () => {
  const v2 = {
    columns: [
      { id: 'c1', label: 'Nhóm', width: '20%', align: 'left' },
      { id: 'c2', label: 'An toàn' },
      { id: 'c3' },
    ],
    headerRows: [
      { id: 'h1', cells: [{ columnId: 'c1', cellType: 'static', text: 'Bảng 1', colSpan: 3 }] },
      {
        cells: [
          { columnId: 'c1', cellType: 'static', text: 'Nhóm' },
          { columnId: 'c2', cellType: 'input', width: '6rem' },
          { columnId: 'c3', cellType: 'static', text: 'Ghi chú' },
        ],
      },
    ],
    rows: [
      {
        id: 'r1',
        cells: [
          { columnId: 'c1', cellType: 'static', text: 'Việc tốt', rowSpan: 2 },
          { columnId: 'c2', cellType: 'tick', correct: true },
          { columnId: 'c3', cellType: 'input', width: '9rem', acceptedAnswers: ['tự khai'] },
        ],
      },
      {
        id: 'r2',
        cells: [
          { columnId: 'c2', cellType: 'static', text: 'Việc chưa tốt' },
          { columnId: 'c3', cellType: 'essay', rowLines: 3 },
        ],
      },
    ],
    tickGroups: [['c2']],
  };

  it('nhận diện v2 và giữ trọn trục cột lẫn các tầng tiêu đề', () => {
    const table = normalizeTableQuestionData(v2);

    expect(table.sourceModel).toBe('v2');
    expect(table.columns).toEqual([
      { id: 'c1', label: 'Nhóm', width: '20%', align: 'left' },
      { id: 'c2', label: 'An toàn' },
      { id: 'c3' },
    ]);
    // Tầng tiêu đề thiếu id vẫn được đặt id sinh tự động (khớp table-model).
    expect(table.headerRows.map((row) => row.id)).toEqual(['h1', '__header_2']);
    expect(table.headerRows[0].cells[0]).toMatchObject({ colSpan: 3, text: 'Bảng 1' });
    expect(table.headerRows[1].cells[1]).toMatchObject({ columnId: 'c2', cellType: 'input', width: '6rem' });
    // Mặt tiền v1 vẫn trả lời được: chỉ những cột có nhãn phẳng.
    expect(table.headers).toEqual([
      { id: 'c1', label: 'Nhóm' },
      { id: 'c2', label: 'An toàn' },
    ]);
    expect(table.tickGroups).toEqual([['c2']]);
  });

  it('giữ colSpan/rowSpan, khoá lạ của ô và KHÔNG bù ô cho hàng v2', () => {
    const table = normalizeTableQuestionData(v2);

    expect(table.rows[0].cells[0]).toMatchObject({ rowSpan: 2, colSpan: 1 });
    // `correct` do trình soạn ghi cho ô tick — không được rơi mất.
    expect(table.rows[0].cells[1].correct).toBe(true);
    // v2 nghiêm ngặt: hàng r2 chỉ có 2 ô (ô c1 do rowSpan phía trên phủ xuống).
    expect(table.rows[1].cells.map((cell) => cell.columnId)).toEqual(['c2', 'c3']);
    expect(table.rows[1].cells[1]).toMatchObject({ cellType: 'essay', rowLines: 3 });
  });

  it('lấy acceptedAnswers từ correctAnswer, đúng như trình hiển thị', () => {
    const withAnswers = normalizeTableQuestionData(v2, { r1__c3: ['Đúng', 'đúng rồi'] });
    expect(withAnswers.rows[0].cells[2].acceptedAnswers).toEqual(['Đúng', 'đúng rồi']);

    // Không truyền bản đồ đáp án ⇒ ô nhập được không có đáp án tự khai,
    // giống hệt dispatch.tsx (ghi đè kể cả bằng undefined).
    const without = normalizeTableQuestionData(v2);
    expect(without.rows[0].cells[2].acceptedAnswers).toBeUndefined();
  });
});
