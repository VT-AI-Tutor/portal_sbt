import { describe, expect, it } from 'vitest';
import {
  buildOccupancyGrid,
  detectTableModel,
  resolveTableModel,
  type ResolvedTableModel,
  type TableGridProblemCode,
} from './table-model';

/** Ba cột dùng lại cho hầu hết các ca kiểm thử v1. */
const HEADERS_3 = [
  { id: 'c1', label: 'Tên' },
  { id: 'c2', label: 'Số' },
  { id: 'c3', label: 'Ghi chú' },
];

const columnIds = (model: ResolvedTableModel, rowIndex = 0) =>
  model.bodyRows[rowIndex].cells.map((cell) => cell.columnId);

const codes = (problems: { code: TableGridProblemCode }[]) => problems.map((p) => p.code);

/** Mô hình chuẩn KHÔNG kể nguồn — dùng để so v1 với v2. */
const canonicalOf = (model: ResolvedTableModel) => ({
  columns: model.columns,
  headerRows: model.headerRows,
  bodyRows: model.bodyRows,
  tickGroups: model.tickGroups,
});

describe('detectTableModel', () => {
  it('nhận v2 chỉ khi `columns` là mảng', () => {
    expect(detectTableModel({ columns: [], rows: [] })).toBe('v2');
    expect(detectTableModel({ columns: [{ id: 'c1' }], rows: [] })).toBe('v2');
  });

  it('không dùng `headerRows` làm dấu hiệu — `headerRows: []` là hợp lệ ở cả hai mô hình', () => {
    expect(detectTableModel({ headerRows: [], headers: [], rows: [] })).toBe('v1');
    expect(detectTableModel({ headerRows: [{ cells: [] }], rows: [] })).toBe('v1');
  });

  it('mọi thứ khác là v1', () => {
    expect(detectTableModel({ headers: [], rows: [] })).toBe('v1');
    expect(detectTableModel({ columns: { c1: 1 } })).toBe('v1');
    expect(detectTableModel(undefined)).toBe('v1');
    expect(detectTableModel(null)).toBe('v1');
    expect(detectTableModel('bảng')).toBe('v1');
    expect(detectTableModel([])).toBe('v1');
  });
});

// ---------------------------------------------------------------------------
// v1 — bốn kiểu hàng thiếu ô. Ô bù phải rơi ĐÚNG chỗ.
// ---------------------------------------------------------------------------

describe('v1: bù ô cho hàng thiếu (đối chiếu columnId, không theo số lượng)', () => {
  it('kiểu A — hàng một ô (28 hàng): giữ ô, bù ba cột còn lại', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [{ id: 'r1', cells: [{ columnId: 'c1', cellType: 'static', text: 'Chỉ một ô' }] }],
    });
    expect(columnIds(model)).toEqual(['c1', 'c2', 'c3']);
    expect(model.bodyRows[0].cells[0].text).toBe('Chỉ một ô');
    expect(model.bodyRows[0].cells[1]).toMatchObject({ cellType: 'static', columnIndex: 1 });
    expect(model.bodyRows[0].cells[1].text).toBeUndefined();
    // Hàng một ô KHÔNG biến thành ô trải ngang — hôm nay nó hiện 1 ô + các ô rỗng.
    expect(model.bodyRows[0].cells[0].colSpan).toBe(1);
    expect(model.bodyRows[0].cells[0].isFullWidth).toBe(false);
  });

  it('kiểu B — thiếu ở ĐẦU hàng (68 hàng, đa số): ô bù phải nằm TRƯỚC', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [
        {
          id: 'r1',
          cells: [
            { columnId: 'c2', cellType: 'input' },
            { columnId: 'c3', cellType: 'static', text: 'cuối' },
          ],
        },
      ],
    });
    expect(columnIds(model)).toEqual(['c1', 'c2', 'c3']);
    // Ô bù ở chỉ số 0, dữ liệu thật KHÔNG bị đẩy sang trái.
    expect(model.bodyRows[0].cells[0]).toMatchObject({ columnId: 'c1', columnIndex: 0, cellType: 'static' });
    expect(model.bodyRows[0].cells[1]).toMatchObject({ columnId: 'c2', columnIndex: 1, cellType: 'input' });
    expect(model.bodyRows[0].cells[2]).toMatchObject({ columnId: 'c3', columnIndex: 2, text: 'cuối' });
  });

  it('kiểu C — thiếu ở CUỐI hàng (11 hàng): ô bù nằm sau', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [
        {
          id: 'r1',
          cells: [
            { columnId: 'c1', cellType: 'static', text: 'đầu' },
            { columnId: 'c2', cellType: 'input' },
          ],
        },
      ],
    });
    expect(columnIds(model)).toEqual(['c1', 'c2', 'c3']);
    expect(model.bodyRows[0].cells[2]).toMatchObject({ columnId: 'c3', columnIndex: 2, cellType: 'static' });
    expect(model.bodyRows[0].cells[2].text).toBeUndefined();
  });

  it('kiểu D — hổng ở GIỮA (18 hàng): ô bù nằm đúng khe trống', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [
        {
          id: 'r1',
          cells: [
            { columnId: 'c1', cellType: 'static', text: 'trái' },
            { columnId: 'c3', cellType: 'static', text: 'phải' },
          ],
        },
      ],
    });
    expect(model.bodyRows[0].cells.map((c) => [c.columnId, c.text])).toEqual([
      ['c1', 'trái'],
      ['c2', undefined],
      ['c3', 'phải'],
    ]);
  });

  it('hàng đủ ô đi qua nguyên vẹn, không sinh ô thừa', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [
        {
          id: 'r1',
          cells: [
            { columnId: 'c1', cellType: 'static', text: 'a' },
            { columnId: 'c2', cellType: 'static', text: 'b' },
            { columnId: 'c3', cellType: 'static', text: 'c' },
          ],
        },
      ],
    });
    expect(model.bodyRows[0].cells).toHaveLength(3);
    expect(model.bodyRows[0].cells.map((c) => c.text)).toEqual(['a', 'b', 'c']);
  });

  it('bỏ ô có `columnId` mồ côi và ô trùng cột, cột đó nhận ô bù/ô đầu tiên', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [
        {
          id: 'r1',
          cells: [
            { columnId: 'cX', cellType: 'static', text: 'mồ côi' },
            { columnId: 'c2', cellType: 'static', text: 'đầu' },
            { columnId: 'c2', cellType: 'static', text: 'trùng' },
          ],
        },
      ],
    });
    expect(columnIds(model)).toEqual(['c1', 'c2', 'c3']);
    expect(model.bodyRows[0].cells[1].text).toBe('đầu');
  });
});

// ---------------------------------------------------------------------------
// v1 — tầng tiêu đề
// ---------------------------------------------------------------------------

describe('v1: tầng tiêu đề', () => {
  it('toàn bộ nhãn rỗng/vắng → headerRows: [] chứ KHÔNG phải một hàng ô rỗng (186 bảng)', () => {
    const model = resolveTableModel({
      headers: [
        { id: 'c1', label: '' },
        { id: 'c2', label: '   ' },
        { id: 'c3' },
      ],
      rows: [{ id: 'r1', cells: [{ columnId: 'c1', cellType: 'static', text: 'x' }] }],
    });
    expect(model.headerRows).toEqual([]);
    expect(model.columns).toEqual([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]);
  });

  it('thiếu hẳn khoá `label` cũng tính là rỗng (b41_q1a có 5 cột như vậy)', () => {
    const model = resolveTableModel({
      headers: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }, { id: 'c5' }],
      rows: [],
    });
    expect(model.headerRows).toEqual([]);
    expect(model.columns.every((column) => column.label === undefined)).toBe(true);
  });

  it('còn một nhãn không rỗng → một tầng, các cột trống là ô rỗng', () => {
    const model = resolveTableModel({
      headers: [{ id: 'c1', label: 'Tên' }, { id: 'c2', label: '' }, { id: 'c3' }],
      rows: [],
    });
    expect(model.headerRows).toHaveLength(1);
    expect(model.headerRows[0].cells).toHaveLength(3);
    expect(model.headerRows[0].cells.map((c) => c.text)).toEqual(['Tên', undefined, undefined]);
    expect(model.headerRows[0].cells.every((c) => c.colSpan === 1 && c.cellType === 'static')).toBe(true);
  });

  it('`caption` không rỗng được CHÈN LÊN TRƯỚC thành headerRows[0], một ô trải hết cột', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      caption: 'Bảng thống kê',
      rows: [],
    });
    expect(model.headerRows).toHaveLength(2);
    expect(model.headerRows[0].cells).toHaveLength(1);
    expect(model.headerRows[0].cells[0]).toMatchObject({
      columnId: 'c1',
      columnIndex: 0,
      colSpan: 3,
      rowSpan: 1,
      cellType: 'static',
      text: 'Bảng thống kê',
      isFullWidth: true,
    });
    // Tầng tên cột vẫn ở NGAY DƯỚI.
    expect(model.headerRows[1].cells.map((c) => c.text)).toEqual(['Tên', 'Số', 'Ghi chú']);
  });

  it('`caption` rỗng/toàn khoảng trắng không sinh tầng nào', () => {
    expect(resolveTableModel({ headers: HEADERS_3, caption: '   ', rows: [] }).headerRows).toHaveLength(1);
    expect(resolveTableModel({ headers: HEADERS_3, caption: '', rows: [] }).headerRows).toHaveLength(1);
  });

  it('`caption` với toàn bộ nhãn rỗng → chỉ còn tầng caption', () => {
    const model = resolveTableModel({
      headers: [{ id: 'c1' }, { id: 'c2' }],
      caption: 'Chỉ có tiêu đề',
      rows: [],
    });
    expect(model.headerRows).toHaveLength(1);
    expect(model.headerRows[0].cells[0]).toMatchObject({ colSpan: 2, text: 'Chỉ có tiêu đề' });
  });
});

// ---------------------------------------------------------------------------
// v1 — isGroupHeader
// ---------------------------------------------------------------------------

describe('v1: isGroupHeader', () => {
  it('thành hàng thân bình thường với ô duy nhất trải hết chiều ngang', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [
        { id: 'g1', isGroupHeader: true, cells: [{ columnId: 'c1', cellType: 'static', text: 'Nhóm A' }] },
        { id: 'r1', cells: [{ columnId: 'c1', cellType: 'static', text: 'a' }] },
      ],
    });
    expect(model.bodyRows[0].cells).toHaveLength(1);
    expect(model.bodyRows[0].cells[0]).toMatchObject({
      rowId: 'g1',
      columnId: 'c1',
      columnIndex: 0,
      colSpan: 3,
      rowSpan: 1,
      cellType: 'static',
      text: 'Nhóm A',
      isFullWidth: true,
    });
    // Hàng tiêu đề nhóm KHÔNG được bù ô.
    expect(model.bodyRows[1].cells).toHaveLength(3);
  });

  it('mang `content` có khối ảnh → giải cả nhãn lẫn ảnh, `content` đi qua nguyên vẹn (6 hàng)', () => {
    const content = {
      blocks: [
        { type: 'image', url: 'assets/images/nhom-1.png' },
        { type: 'paragraph', text: 'Nhóm 1' },
      ],
    };
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [{ id: 'g1', isGroupHeader: true, cells: [{ columnId: 'c1', cellType: 'static', content }] }],
    });
    const cell = model.bodyRows[0].cells[0];
    expect(cell.text).toBe('Nhóm 1');
    expect(cell.imageUrl).toBe('assets/images/nhom-1.png');
    expect(cell.content).toBe(content);
    expect(cell.colSpan).toBe(3);
  });

  it('neo về cột đầu kể cả khi ô khai báo cột khác, và khi hàng rỗng ô', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [
        { id: 'g1', isGroupHeader: true, cells: [{ columnId: 'c2', cellType: 'static', text: 'lệch' }] },
        { id: 'g2', isGroupHeader: true, cells: [] },
      ],
    });
    expect(model.bodyRows[0].cells[0]).toMatchObject({ columnId: 'c1', columnIndex: 0, colSpan: 3 });
    expect(model.bodyRows[1].cells[0]).toMatchObject({ columnId: 'c1', colSpan: 3, cellType: 'static' });
  });
});

// ---------------------------------------------------------------------------
// Ô: loại, nhãn, đáp án
// ---------------------------------------------------------------------------

describe('giải ô', () => {
  const rowsWithTypes = [
    {
      id: 'r1',
      cells: [
        { columnId: 'c1', cellType: 'lung-tung', text: 'lạ' },
        { columnId: 'c2', text: 'thiếu loại' },
        { columnId: 'c3', cellType: 'text', text: 'alias cũ' },
      ],
    },
  ];

  it('loại lạ hoặc thiếu gấp về "static"; "text" giữ nguyên giá trị (§5.16.3)', () => {
    const model = resolveTableModel({ headers: HEADERS_3, rows: rowsWithTypes });
    expect(model.bodyRows[0].cells.map((c) => c.cellType)).toEqual(['static', 'static', 'text']);
  });

  it('ô "text" được xử lý như ô tĩnh: đọc nhãn/ảnh từ content.blocks', () => {
    const model = resolveTableModel({
      headers: [{ id: 'c1', label: 'A' }],
      rows: [
        {
          id: 'r1',
          cells: [{ columnId: 'c1', cellType: 'text', content: { blocks: [{ type: 'paragraph', text: 'từ khối' }] } }],
        },
      ],
    });
    expect(model.bodyRows[0].cells[0]).toMatchObject({ cellType: 'text', text: 'từ khối' });
  });

  it('ô tĩnh giải nhãn qua content.blocks và ảnh theo thứ tự imageUrl → image.url → khối ảnh', () => {
    const model = resolveTableModel({
      headers: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      rows: [
        {
          id: 'r1',
          cells: [
            { columnId: 'c1', cellType: 'static', imageUrl: '/phang.png' },
            { columnId: 'c2', cellType: 'static', image: { url: '/long.png' } },
            {
              columnId: 'c3',
              cellType: 'static',
              content: { blocks: [{ type: 'image', url: '/khoi.png' }, { type: 'paragraph', text: 'chú thích' }] },
            },
          ],
        },
      ],
    });
    expect(model.bodyRows[0].cells.map((c) => c.imageUrl)).toEqual(['/phang.png', '/long.png', '/khoi.png']);
    expect(model.bodyRows[0].cells[2].text).toBe('chú thích');
  });

  it('acceptedAnswers CHỈ đến từ correctAnswer["rowId__columnId"] và chỉ cho ô nhập được', () => {
    const model = resolveTableModel(
      {
        headers: HEADERS_3,
        rows: [
          {
            id: 'r1',
            cells: [
              { columnId: 'c1', cellType: 'static', acceptedAnswers: ['giữ nguyên'] },
              { columnId: 'c2', cellType: 'input', acceptedAnswers: ['sẽ bị ghi đè'] },
              { columnId: 'c3', cellType: 'essay' },
            ],
          },
        ],
      },
      { r1__c2: 'năm', r1__c1: 'không dùng cho ô tĩnh' },
    );
    const [tinh, nhap, tuLuan] = model.bodyRows[0].cells;
    expect(nhap.acceptedAnswers).toEqual(['năm']);
    // Ô nhập không có khoá đáp án → undefined, KHÔNG giữ acceptedAnswers thô.
    expect(tuLuan.acceptedAnswers).toBeUndefined();
    // Ô tĩnh không tra correctAnswer, chỉ chuyển tiếp giá trị thô.
    expect(tinh.acceptedAnswers).toEqual(['giữ nguyên']);
  });

  it('đáp án dạng mảng và dạng vô hướng đều chuẩn hoá về string[]', () => {
    const model = resolveTableModel(
      { headers: [{ id: 'c1' }, { id: 'c2' }], rows: [{ id: 'r1', cells: [{ columnId: 'c1', cellType: 'input' }, { columnId: 'c2', cellType: 'input' }] }] },
      { r1__c1: ['a', 'b'], r1__c2: 7 },
    );
    expect(model.bodyRows[0].cells[0].acceptedAnswers).toEqual(['a', 'b']);
    expect(model.bodyRows[0].cells[1].acceptedAnswers).toEqual(['7']);
  });

  it('chuyển tiếp `label`/`placeholder` (nợ dữ liệu §5.16.5) thay vì bỏ đi', () => {
    const model = resolveTableModel({
      headers: [{ id: 'c1' }, { id: 'c2' }],
      rows: [
        {
          id: 'r1',
          cells: [
            { columnId: 'c1', cellType: 'tick', label: 'Đã làm' },
            { columnId: 'c2', cellType: 'input', placeholder: 'nhập…', rowLines: 3, width: '8rem', height: '4rem' },
          ],
        },
      ],
    });
    expect(model.bodyRows[0].cells[0].label).toBe('Đã làm');
    expect(model.bodyRows[0].cells[1]).toMatchObject({
      placeholder: 'nhập…',
      rowLines: 3,
      width: '8rem',
      height: '4rem',
    });
  });

  it('chuẩn hoá tickGroups và bỏ nhóm rỗng', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [],
      tickGroups: [['c2', 'c3'], [], [''], 'không phải mảng'],
    });
    expect(model.tickGroups).toEqual([['c2', 'c3']]);
    expect(resolveTableModel({ headers: HEADERS_3, rows: [] }).tickGroups).toEqual([]);
  });

  it('giữ NGUYÊN nét kỳ quặc của dispatch.tsx: `null` trong tickGroups thành chuỗi "null"', () => {
    // `group.map(String).filter(Boolean)` — hành vi hôm nay, cố ý không "sửa"
    // vì kho dữ liệu không có ca này và mọi thay đổi đều là đổi hành vi.
    const model = resolveTableModel({ headers: HEADERS_3, rows: [], tickGroups: [[null]] });
    expect(model.tickGroups).toEqual([['null']]);
  });
});

// ---------------------------------------------------------------------------
// v2 — chuyển tiếp thẳng
// ---------------------------------------------------------------------------

describe('v2: chuyển tiếp thẳng, không bù, không sửa', () => {
  it('giữ nguyên trục cột kể cả width/align', () => {
    const model = resolveTableModel({
      columns: [
        { id: 'c1', label: 'Tên', width: '20%', align: 'left' },
        { id: 'c2', width: '12rem', align: 'center' },
        { id: 'c3', align: 'nghiêng' },
      ],
      rows: [],
    });
    expect(model.sourceModel).toBe('v2');
    expect(model.columns).toEqual([
      { id: 'c1', label: 'Tên', width: '20%', align: 'left' },
      { id: 'c2', width: '12rem', align: 'center' },
      { id: 'c3' },
    ]);
  });

  it('colSpan/rowSpan mặc định 1; giá trị không hợp lệ bị kẹp về 1', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      rows: [
        {
          id: 'r1',
          cells: [
            { columnId: 'c1', cellType: 'static' },
            { columnId: 'c2', cellType: 'static', colSpan: 0, rowSpan: -3 },
            { columnId: 'c3', cellType: 'static', colSpan: 1.5, rowSpan: 'hai' },
          ],
        },
      ],
    });
    expect(model.bodyRows[0].cells.map((c) => [c.colSpan, c.rowSpan])).toEqual([
      [1, 1],
      [1, 1],
      [1, 1],
    ]);
  });

  it('KHÔNG bù ô: hàng thiếu vẫn thiếu (v2 phải báo lỗi to, không sửa ngầm)', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      rows: [{ id: 'r1', cells: [{ columnId: 'c2', cellType: 'static', text: 'chỉ giữa' }] }],
    });
    expect(model.bodyRows[0].cells).toHaveLength(1);
    expect(model.bodyRows[0].cells[0]).toMatchObject({ columnId: 'c2', columnIndex: 1 });
  });

  it('KHÔNG xử lý `isGroupHeader` ở v2 — hàng đó sẽ lộ ra ở bộ kiểm tra', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }],
      rows: [{ id: 'g1', isGroupHeader: true, cells: [{ columnId: 'c1', cellType: 'static', text: 'Nhóm' }] }],
    });
    expect(model.bodyRows[0].cells[0].colSpan).toBe(1);
    expect(model.bodyRows[0].cells[0].isFullWidth).toBe(false);
  });

  it('giữ nguyên các tầng headerRows, kể cả tầng rỗng, và tự đặt id khi thiếu', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }],
      headerRows: [
        { cells: [{ columnId: 'c1', cellType: 'static', colSpan: 2, text: 'Tiêu đề' }] },
        { id: 'ten-cot', cells: [{ columnId: 'c1', text: 'A' }, { columnId: 'c2', text: 'B' }] },
      ],
      rows: [],
    });
    expect(model.headerRows[0].id).toBe('__header_1');
    expect(model.headerRows[0].cells[0]).toMatchObject({ colSpan: 2, isFullWidth: true });
    expect(model.headerRows[1].id).toBe('ten-cot');
  });

  it('ô trong tầng tiêu đề cũng nhận acceptedAnswers từ correctAnswer', () => {
    const model = resolveTableModel(
      {
        columns: [{ id: 'c1' }],
        headerRows: [{ id: 'h1', cells: [{ columnId: 'c1', cellType: 'input' }] }],
        rows: [],
      },
      { h1__c1: 'đáp' },
    );
    expect(model.headerRows[0].cells[0].acceptedAnswers).toEqual(['đáp']);
  });

  it('ô tiêu đề TRẦN thừa kế `columns[].label` — đúng ví dụ chuẩn của spec §5.16.6', () => {
    const model = resolveTableModel({
      columns: [
        { id: 'phan', label: 'Phần', width: '22%', align: 'center' },
        { id: 'noidung', label: 'Nội dung' },
      ],
      headerRows: [
        { cells: [{ columnId: 'phan', colSpan: 2, text: 'DÀN Ý BÀI VĂN' }] },
        { cells: [{ columnId: 'phan' }, { columnId: 'noidung' }] },
      ],
      rows: [{ id: 'r1', cells: [{ columnId: 'phan', cellType: 'static', text: 'Triển khai', rowSpan: 1 }, { columnId: 'noidung', cellType: 'static', text: 'x' }] }],
    });
    expect(model.headerRows[0].cells.map((c) => c.text)).toEqual(['DÀN Ý BÀI VĂN']);
    // Trước đây tầng này giải ra [undefined, undefined] → dải tiêu đề trống trơn.
    expect(model.headerRows[1].cells.map((c) => c.text)).toEqual(['Phần', 'Nội dung']);
  });

  it('nội dung tường minh của ô tiêu đề luôn thắng nhãn cột', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1', label: 'Nhãn cột' }, { id: 'c2', label: 'Bỏ qua' }],
      headerRows: [
        {
          cells: [
            { columnId: 'c1', text: 'Chữ riêng' },
            { columnId: 'c2', content: { blocks: [{ type: 'paragraph', text: 'Từ khối' }] } },
          ],
        },
      ],
      rows: [],
    });
    expect(model.headerRows[0].cells.map((c) => c.text)).toEqual(['Chữ riêng', 'Từ khối']);
  });

  it('ô tiêu đề chỉ có ảnh không bị nhãn cột ghi đè', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1', label: 'Nhãn cột' }],
      headerRows: [{ cells: [{ columnId: 'c1', imageUrl: '/tieu-de.png' }] }],
      rows: [],
    });
    expect(model.headerRows[0].cells[0].text).toBeUndefined();
    expect(model.headerRows[0].cells[0].imageUrl).toBe('/tieu-de.png');
  });

  it('cột không có nhãn thì ô tiêu đề trần vẫn trống — không bịa chữ', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2', label: 'Có nhãn' }],
      headerRows: [{ cells: [{ columnId: 'c1' }, { columnId: 'c2' }] }],
      rows: [],
    });
    expect(model.headerRows[0].cells.map((c) => c.text)).toEqual([undefined, 'Có nhãn']);
  });

  it('ô tiêu đề trải nhiều cột lấy nhãn cột NEO, không ghép nhãn', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1', label: 'Một' }, { id: 'c2', label: 'Hai' }, { id: 'c3', label: 'Ba' }],
      headerRows: [{ cells: [{ columnId: 'c1', colSpan: 3 }] }],
      rows: [],
    });
    expect(model.headerRows[0].cells[0].text).toBe('Một');
  });

  it('ô THÂN không bao giờ thừa kế nhãn cột — ô thân trống là ô trống', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1', label: 'Phần' }, { id: 'c2', label: 'Nội dung' }],
      rows: [{ id: 'r1', cells: [{ columnId: 'c1', cellType: 'static' }, { columnId: 'c2', cellType: 'input' }] }],
    });
    expect(model.bodyRows[0].cells.map((c) => c.text)).toEqual([undefined, undefined]);
  });

  it('cột lạ cho columnIndex -1 (bộ kiểm tra sẽ bắt), không ném lỗi', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }],
      rows: [{ id: 'r1', cells: [{ columnId: 'cX', cellType: 'static' }] }],
    });
    expect(model.bodyRows[0].cells[0].columnIndex).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// Lưới chiếm chỗ
// ---------------------------------------------------------------------------

describe('buildOccupancyGrid', () => {
  it('bảng khít: mỗi cột một ô neo, không vấn đề gì', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      caption: 'Tiêu đề',
      rows: [{ id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2' }, { columnId: 'c3' }] }],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.columnCount).toBe(3);
    expect(grid.problems).toEqual([]);
    expect(grid.headerRows).toHaveLength(2);
    expect(grid.headerRows[0].placements).toHaveLength(1);
    expect(grid.headerRows[0].slots.map((s) => s.kind)).toEqual(['anchor', 'covered', 'covered']);
    expect(grid.bodyRows[0].placements).toHaveLength(3);
    expect(grid.bodyRows[0].slots.every((s) => s.kind === 'anchor')).toBe(true);
    expect(grid.bodyRows[0]).toMatchObject({ id: 'r1', section: 'body', index: 0 });
  });

  it('colSpan tô ô kế bên là "covered" và trỏ về cùng một placement', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      rows: [{ id: 'r1', cells: [{ columnId: 'c1', colSpan: 2 }, { columnId: 'c3' }] }],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.problems).toEqual([]);
    const [s0, s1, s2] = grid.bodyRows[0].slots;
    expect([s0.kind, s1.kind, s2.kind]).toEqual(['anchor', 'covered', 'anchor']);
    expect(s0.kind === 'anchor' && s1.kind === 'covered' && s0.placement === s1.placement).toBe(true);
    expect(grid.bodyRows[0].placements.map((p) => p.columnIndex)).toEqual([0, 2]);
  });

  it('rowSpan trải qua nhiều hàng: hàng dưới bỏ ô, con trỏ tự nhảy qua vùng bị phủ', () => {
    // Hình mẫu thật: b18_i3_q1 — "Triển khai" phủ 3 hàng thân.
    const model = resolveTableModel({
      columns: [{ id: 'muc' }, { id: 'noidung' }],
      rows: [
        { id: 'trienkhai1', cells: [{ columnId: 'muc', rowSpan: 3, text: 'Triển khai' }, { columnId: 'noidung', cellType: 'input' }] },
        { id: 'trienkhai2', cells: [{ columnId: 'noidung', cellType: 'input' }] },
        { id: 'trienkhai3', cells: [{ columnId: 'noidung', cellType: 'input' }] },
      ],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.problems).toEqual([]);
    expect(grid.bodyRows.map((r) => r.slots.map((s) => s.kind))).toEqual([
      ['anchor', 'anchor'],
      ['covered', 'anchor'],
      ['covered', 'anchor'],
    ]);
    expect(grid.bodyRows.map((r) => r.placements.length)).toEqual([2, 1, 1]);
    // Hàng 2, 3 đặt ô "noidung" ở đúng cột 1 chứ không phải cột 0.
    expect(grid.bodyRows[1].placements[0].columnIndex).toBe(1);
    expect(grid.bodyRows[0].placements[0].rowSpan).toBe(3);
  });

  it('ô vừa rowSpan vừa colSpan > 1 phủ đúng hình chữ nhật', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      rows: [
        { id: 'r1', cells: [{ columnId: 'c1', colSpan: 2, rowSpan: 2 }, { columnId: 'c3' }] },
        { id: 'r2', cells: [{ columnId: 'c3' }] },
      ],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.problems).toEqual([]);
    expect(grid.bodyRows.map((r) => r.slots.map((s) => s.kind))).toEqual([
      ['anchor', 'covered', 'anchor'],
      ['covered', 'covered', 'anchor'],
    ]);
  });

  it('rowSpan = 2 dừng đúng sau một hàng kế tiếp (không phủ lố)', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }],
      rows: [
        { id: 'r1', cells: [{ columnId: 'c1', rowSpan: 2 }, { columnId: 'c2' }] },
        { id: 'r2', cells: [{ columnId: 'c2' }] },
        { id: 'r3', cells: [{ columnId: 'c1' }, { columnId: 'c2' }] },
      ],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.problems).toEqual([]);
    expect(grid.bodyRows[2].slots.map((s) => s.kind)).toEqual(['anchor', 'anchor']);
  });

  it('`headerRows` và `bodyRows` được duyệt ĐỘC LẬP — rowSpan không bắc cầu sang thân bảng', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }],
      headerRows: [{ id: 'h1', cells: [{ columnId: 'c1', rowSpan: 2 }, { columnId: 'c2' }] }],
      rows: [{ id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2' }] }],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.bodyRows[0].slots.map((s) => s.kind)).toEqual(['anchor', 'anchor']);
    expect(grid.problems).toEqual([
      expect.objectContaining({ code: 'ROWSPAN_OVERFLOW', section: 'header', rowId: 'h1', overflowRows: 1 }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// Dữ liệu hỏng — trả về mô hình + vấn đề TRA ĐƯỢC, tuyệt đối không ném
// ---------------------------------------------------------------------------

describe('dữ liệu hỏng: có vấn đề nhưng không ném lỗi', () => {
  it('hàng thiếu ô (v2) → ROW_WIDTH_MISMATCH kèm chỉ số cột trống', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      rows: [{ id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2' }] }],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.problems).toEqual([
      expect.objectContaining({
        code: 'ROW_WIDTH_MISMATCH',
        section: 'body',
        rowIndex: 0,
        rowId: 'r1',
        emptyColumnIndexes: [2],
      }),
    ]);
    expect(grid.problems[0].overflowColumns).toBeUndefined();
  });

  it('hàng thừa cột → ROW_WIDTH_MISMATCH kèm số cột tràn', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }],
      rows: [{ id: 'r1', cells: [{ columnId: 'c1', colSpan: 2 }, { columnId: 'c2' }] }],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.problems).toEqual([
      expect.objectContaining({ code: 'ROW_WIDTH_MISMATCH', rowId: 'r1', overflowColumns: 1 }),
    ]);
    expect(grid.problems[0].emptyColumnIndexes).toBeUndefined();
  });

  it('colSpan đè lên vùng rowSpan → CELL_OVERLAP kèm cột bị đè', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      rows: [
        { id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2', rowSpan: 2 }, { columnId: 'c3' }] },
        { id: 'r2', cells: [{ columnId: 'c1', colSpan: 3 }] },
      ],
    });
    const grid = buildOccupancyGrid(model);
    expect(codes(grid.problems)).toContain('CELL_OVERLAP');
    expect(grid.problems.find((p) => p.code === 'CELL_OVERLAP')).toMatchObject({
      section: 'body',
      rowIndex: 1,
      rowId: 'r2',
      columnId: 'c1',
      columnIndex: 0,
      overlapColumnIndexes: [1],
    });
  });

  it('rowSpan vượt quá hàng cuối → ROWSPAN_OVERFLOW kèm số hàng còn thiếu', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }],
      rows: [
        { id: 'r1', cells: [{ columnId: 'c1', rowSpan: 4 }] },
        { id: 'r2', cells: [] },
      ],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.problems).toEqual([
      expect.objectContaining({
        code: 'ROWSPAN_OVERFLOW',
        section: 'body',
        rowId: 'r1',
        columnId: 'c1',
        columnIndex: 0,
        overflowRows: 2,
      }),
    ]);
  });

  it('ô lệch cột so với vị trí lưới → ANCHOR_MISMATCH (chỉ v2)', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }],
      rows: [{ id: 'r1', cells: [{ columnId: 'c2' }, { columnId: 'c1' }] }],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.problems.filter((p) => p.code === 'ANCHOR_MISMATCH')).toEqual([
      expect.objectContaining({ rowId: 'r1', columnId: 'c2', columnIndex: 0, expectedColumnId: 'c1' }),
      expect.objectContaining({ rowId: 'r1', columnId: 'c1', columnIndex: 1, expectedColumnId: 'c2' }),
    ]);
  });

  it('columnId không có trong columns → UNKNOWN_COLUMN, ô bị bỏ khỏi lưới', () => {
    const model = resolveTableModel({
      columns: [{ id: 'c1' }, { id: 'c2' }],
      rows: [{ id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'cX' }] }],
    });
    const grid = buildOccupancyGrid(model);
    expect(codes(grid.problems)).toEqual(['UNKNOWN_COLUMN', 'ROW_WIDTH_MISMATCH']);
    expect(grid.bodyRows[0].placements).toHaveLength(1);
  });

  it('không ném với payload rác đủ kiểu', () => {
    const rubbish: unknown[] = [
      undefined,
      null,
      'bảng',
      42,
      [],
      { rows: 'không phải mảng' },
      { headers: 'x', rows: [null, 7, { cells: 'x' }] },
      { columns: [null, { id: 5 }], headerRows: 'x', rows: [{ id: '', cells: [{}] }] },
      { columns: [{ id: 'c1' }], rows: [{ id: 'r1', cells: [{ columnId: 'c1', colSpan: 99, rowSpan: 99 }] }] },
    ];
    for (const raw of rubbish) {
      expect(() => buildOccupancyGrid(resolveTableModel(raw))).not.toThrow();
    }
    const empty = resolveTableModel(undefined);
    expect(empty).toEqual({
      columns: [],
      headerRows: [],
      bodyRows: [],
      tickGroups: [],
      sourceModel: 'v1',
    });
    expect(buildOccupancyGrid(empty)).toEqual({
      columnCount: 0,
      headerRows: [],
      bodyRows: [],
      problems: [],
    });
  });

  it('bảng v1 không có `headers` vẫn dựng được trục cột từ chính các ô', () => {
    const model = resolveTableModel({
      rows: [
        { id: 'r1', cells: [{ columnId: 'a' }, { columnId: 'b' }] },
        { id: 'r2', cells: [{ columnId: 'b' }, { columnId: 'c' }] },
      ],
    });
    expect(model.columns.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(columnIds(model, 1)).toEqual(['a', 'b', 'c']);
    expect(buildOccupancyGrid(model).problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// v1 khoan dung: 47 câu hỏi đang chạy không được sinh ra vấn đề nào
// ---------------------------------------------------------------------------

describe('v1 khoan dung', () => {
  it('cả bốn kiểu hàng thiếu + tiêu đề nhóm + caption cho lưới KHÍT, zero vấn đề', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      caption: 'Bảng ôn tập',
      rows: [
        { id: 'g1', isGroupHeader: true, cells: [{ columnId: 'c1', cellType: 'static', text: 'Nhóm A' }] },
        { id: 'a', cells: [{ columnId: 'c1' }] },
        { id: 'b', cells: [{ columnId: 'c2' }, { columnId: 'c3' }] },
        { id: 'c', cells: [{ columnId: 'c1' }, { columnId: 'c2' }] },
        { id: 'd', cells: [{ columnId: 'c1' }, { columnId: 'c3' }] },
        { id: 'e', cells: [{ columnId: 'cX' }] },
      ],
    });
    const grid = buildOccupancyGrid(model);
    expect(grid.problems).toEqual([]);
    expect(grid.bodyRows.map((r) => r.placements.length)).toEqual([1, 3, 3, 3, 3, 3]);
    expect(grid.bodyRows.every((r) => r.slots.every((s) => s.kind !== 'empty'))).toBe(true);
  });

  it('v1 KHÔNG báo ANCHOR_MISMATCH — thứ tự ô trong hàng bị đảo vẫn về đúng cột', () => {
    const model = resolveTableModel({
      headers: HEADERS_3,
      rows: [{ id: 'r1', cells: [{ columnId: 'c3', text: 'ba' }, { columnId: 'c1', text: 'một' }] }],
    });
    expect(model.bodyRows[0].cells.map((c) => [c.columnId, c.text])).toEqual([
      ['c1', 'một'],
      ['c2', undefined],
      ['c3', 'ba'],
    ]);
    expect(buildOccupancyGrid(model).problems).toEqual([]);
  });

  it('rowSpan hiếm hoi ở v1 vẫn được tôn trọng: hàng dưới không bị chèn ô bù vào vùng phủ', () => {
    const model = resolveTableModel({
      headers: [{ id: 'c1', label: 'Mục' }, { id: 'c2', label: 'Nội dung' }],
      rows: [
        { id: 'r1', cells: [{ columnId: 'c1', rowSpan: 2, text: 'Gộp' }, { columnId: 'c2' }] },
        { id: 'r2', cells: [{ columnId: 'c2' }] },
      ],
    });
    expect(model.bodyRows[1].cells).toHaveLength(1);
    expect(model.bodyRows[1].cells[0].columnId).toBe('c2');
    expect(buildOccupancyGrid(model).problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Vòng tròn khép kín: v1 và bản v2 viết tay phải cho CÙNG một mô hình chuẩn
// ---------------------------------------------------------------------------

describe('v1 ↔ v2 cho cùng một mô hình chuẩn', () => {
  const correctAnswer = { r1__c2: ['5', 'năm'] };

  const v1 = {
    headers: HEADERS_3,
    caption: 'Bảng thống kê',
    tickGroups: [['c2', 'c3']],
    rows: [
      { id: 'g1', isGroupHeader: true, cells: [{ columnId: 'c1', cellType: 'static', text: 'Nhóm A' }] },
      {
        id: 'r1',
        cells: [
          { columnId: 'c2', cellType: 'input' },
          { columnId: 'c3', cellType: 'static', text: 'ghi chú' },
        ],
      },
    ],
  };

  const v2 = {
    columns: [
      { id: 'c1', label: 'Tên' },
      { id: 'c2', label: 'Số' },
      { id: 'c3', label: 'Ghi chú' },
    ],
    headerRows: [
      { id: '__caption', cells: [{ columnId: 'c1', colSpan: 3, cellType: 'static', text: 'Bảng thống kê' }] },
      {
        id: '__header',
        cells: [
          { columnId: 'c1', cellType: 'static', text: 'Tên' },
          { columnId: 'c2', cellType: 'static', text: 'Số' },
          { columnId: 'c3', cellType: 'static', text: 'Ghi chú' },
        ],
      },
    ],
    tickGroups: [['c2', 'c3']],
    rows: [
      { id: 'g1', cells: [{ columnId: 'c1', colSpan: 3, cellType: 'static', text: 'Nhóm A' }] },
      {
        id: 'r1',
        cells: [
          { columnId: 'c1', cellType: 'static' },
          { columnId: 'c2', cellType: 'input' },
          { columnId: 'c3', cellType: 'static', text: 'ghi chú' },
        ],
      },
    ],
  };

  /** Y hệt `v2`, nhưng tầng tên cột viết theo lối TRẦN của ví dụ chuẩn §5.16.6:
   *  nhãn nằm ở `columns[]`, ô tiêu đề chỉ định vị. Phải cho cùng một kết quả. */
  const v2Bare = {
    ...v2,
    headerRows: [
      v2.headerRows[0],
      { id: '__header', cells: [{ columnId: 'c1' }, { columnId: 'c2' }, { columnId: 'c3' }] },
    ],
  };

  it('hai mô hình nguồn cho ra mô hình chuẩn giống hệt nhau (trừ `sourceModel`)', () => {
    const fromV1 = resolveTableModel(v1, correctAnswer);
    const fromV2 = resolveTableModel(v2, correctAnswer);
    expect(fromV1.sourceModel).toBe('v1');
    expect(fromV2.sourceModel).toBe('v2');
    expect(canonicalOf(fromV1)).toEqual(canonicalOf(fromV2));
  });

  it('và cùng một lưới chiếm chỗ, cả hai đều khít', () => {
    const gridV1 = buildOccupancyGrid(resolveTableModel(v1, correctAnswer));
    const gridV2 = buildOccupancyGrid(resolveTableModel(v2, correctAnswer));
    expect(gridV1.problems).toEqual([]);
    expect(gridV2.problems).toEqual([]);
    expect(gridV1).toEqual(gridV2);
  });

  it('bản v2 viết tầng tên cột theo lối TRẦN cũng cho đúng mô hình chuẩn ấy', () => {
    // Ca này chính là lỗi "dải tiêu đề trống": trước khi có bước thừa kế nhãn
    // cột, tầng 2 giải ra toàn ô rỗng và phép so sánh này gãy.
    expect(canonicalOf(resolveTableModel(v2Bare, correctAnswer)))
      .toEqual(canonicalOf(resolveTableModel(v1, correctAnswer)));
    expect(resolveTableModel(v2Bare, correctAnswer).headerRows[1].cells.map((c) => c.text))
      .toEqual(['Tên', 'Số', 'Ghi chú']);
  });

  it('khoá chấm điểm vẫn là `rowId__columnId` trên cột NEO ở cả hai đường', () => {
    const cellV1 = resolveTableModel(v1, correctAnswer).bodyRows[1].cells[1];
    const cellV2 = resolveTableModel(v2, correctAnswer).bodyRows[1].cells[1];
    expect(cellV1.acceptedAnswers).toEqual(['5', 'năm']);
    expect(cellV2.acceptedAnswers).toEqual(['5', 'năm']);
    expect([cellV1.rowId, cellV1.columnId]).toEqual(['r1', 'c2']);
  });
});
