import { describe, expect, it } from 'vitest';
import { placePointNames } from './labels';
import type { DrawnFigure, GeometryConstraint, GivenFigure } from './types';

/** Toán 4 · b30_t1q3 — "Vẽ đoạn NK song song với MQ, điểm K nằm trên PQ". */
const given: GivenFigure = {
  points: [
    { id: 'M', x: 1, y: 1 },
    { id: 'N', x: 4, y: 1 },
    { id: 'P', x: 8, y: 5 },
    { id: 'Q', x: 1, y: 5 },
  ],
  segments: [
    { id: 'MQ', from: 'M', to: 'Q' },
    { id: 'PQ', from: 'P', to: 'Q' },
  ],
};

const NK: GeometryConstraint = {
  kind: 'segment',
  through: ['N'],
  parallelTo: 'MQ',
  endpointOn: 'PQ',
  pointName: 'K',
};

const seg = (x1: number, y1: number, x2: number, y2: number): [{ x: number; y: number }, { x: number; y: number }] => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

const place = (constraints: GeometryConstraint[], drawn: DrawnFigure) => placePointNames(constraints, given, drawn);

describe('placePointNames · điều kiện đoạn thẳng', () => {
  it('đặt tên vào đầu mút chạm endpointOn', () => {
    expect(place([NK], { segments: [seg(4, 1, 4, 5)] })).toEqual([{ name: 'K', x: 4, y: 5 }]);
  });

  it('hiện theo VỊ TRÍ, không chờ đúng: đoạn chéo (không song song MQ) vẫn có K', () => {
    expect(place([NK], { segments: [seg(4, 1, 6, 5)] })).toEqual([{ name: 'K', x: 6, y: 5 }]);
  });

  it('nhiều đoạn cùng chạm PQ: chỉ MỘT K, ưu tiên đoạn thoả đủ điều kiện dù vẽ sau', () => {
    const labels = place([NK], { segments: [seg(4, 1, 6, 5), seg(4, 1, 4, 5)] });
    expect(labels).toEqual([{ name: 'K', x: 4, y: 5 }]);
  });

  it('không đoạn nào đủ điều kiện thì K theo đoạn vẽ trước', () => {
    const labels = place([NK], { segments: [seg(4, 1, 6, 5), seg(3, 2, 7, 5)] });
    expect(labels).toEqual([{ name: 'K', x: 6, y: 5 }]);
  });

  it('hai điều kiện cùng chạm PQ thì hai đoạn khác nhau mang hai tên', () => {
    const labels = place(
      [
        { kind: 'segment', endpointOn: 'PQ', pointName: 'K' },
        { kind: 'segment', endpointOn: 'PQ', pointName: 'H' },
      ],
      { segments: [seg(4, 1, 4, 5), seg(4, 1, 6, 5)] },
    );
    expect(labels).toEqual([
      { name: 'K', x: 4, y: 5 },
      { name: 'H', x: 6, y: 5 },
    ]);
  });

  it('bài ĐÚNG: tên theo phép gán của bộ chấm, kể cả khi điều kiện lỏng khai trước', () => {
    // Đặt tên tham lam thì H (chỉ cần chạm PQ) chiếm mất NK vì NK cũng thoả H,
    // và K rơi sang đoạn (6;3)–(6;5) — sai, dù bộ chấm gán NK cho K và chấm đúng.
    const loose: GeometryConstraint = { kind: 'segment', endpointOn: 'PQ', pointName: 'H' };
    const labels = place([loose, NK], { segments: [seg(4, 1, 4, 5), seg(6, 3, 6, 5)] });
    expect(labels).toEqual([
      { name: 'H', x: 6, y: 5 },
      { name: 'K', x: 4, y: 5 },
    ]);
  });

  it('bài CHƯA đúng: vẫn đặt tên theo vị trí, không chờ chấm', () => {
    const loose: GeometryConstraint = { kind: 'segment', endpointOn: 'PQ', pointName: 'H' };
    // Không đoạn nào qua N song song MQ → bộ chấm không có phép gán.
    const labels = place([loose, NK], { segments: [seg(3, 2, 3, 5), seg(6, 3, 6, 5)] });
    expect(labels.map((l) => l.name).sort()).toEqual(['H', 'K']);
  });

  it('đoạn cắt XUYÊN qua PQ thì tên nằm ở giao điểm', () => {
    expect(place([NK], { segments: [seg(3, 3, 3, 7)] })).toEqual([{ name: 'K', x: 3, y: 5 }]);
  });

  it('giao điểm không trùng điểm lưới vẫn đặt được tên', () => {
    const labels = place([{ kind: 'segment', endpointOn: 'MQ', pointName: 'H' }], { segments: [seg(0, 2, 3, 3)] });
    expect(labels).toHaveLength(1);
    expect(labels[0].x).toBe(1);
    expect(labels[0].y).toBeCloseTo(2 + 1 / 3);
  });

  it('không có endpointOn thì không có điểm nào để đặt tên', () => {
    expect(place([{ kind: 'segment', through: ['N'], pointName: 'K' }], { segments: [seg(4, 1, 4, 5)] })).toEqual([]);
  });

  it('bỏ qua điểm trùng điểm cho trước, và đoạn vẽ chồng lên PQ', () => {
    expect(place([NK], { segments: [seg(4, 1, 1, 5)] })).toEqual([]);
    expect(place([NK], { segments: [seg(2, 5, 5, 5)] })).toEqual([]);
  });

  it('không chạm PQ thì chưa có tên', () => {
    expect(place([NK], { segments: [seg(4, 1, 4, 3)] })).toEqual([]);
  });
});

describe('placePointNames · điều kiện điểm', () => {
  const E: GeometryConstraint = { kind: 'point', midpointOf: 'PQ', pointName: 'E' };

  it('điểm nằm trên đoạn khai thì có tên, ưu tiên điểm thoả đủ (trung điểm MQ là (1;3))', () => {
    const mid: GeometryConstraint = { kind: 'point', midpointOf: 'MQ', pointName: 'E' };
    expect(place([mid], { points: [{ x: 1, y: 2 }, { x: 1, y: 3 }] })).toEqual([{ name: 'E', x: 1, y: 3 }]);
  });

  it('điểm ngoài đoạn khai thì không có tên', () => {
    expect(place([E], { points: [{ x: 5, y: 4 }] })).toEqual([]);
  });

  it('điểm không khai vị trí thì tên theo điểm đặt đầu tiên', () => {
    const O: GeometryConstraint = { kind: 'point', pointName: 'O' };
    expect(place([O], { points: [{ x: 5, y: 4 }, { x: 6, y: 4 }] })).toEqual([{ name: 'O', x: 5, y: 4 }]);
  });
});

describe('placePointNames · bỏ qua', () => {
  it('điều kiện không có pointName, tên rỗng, hoặc dùng subject', () => {
    const drawn = { segments: [seg(4, 1, 4, 5)] };
    expect(place([{ ...NK, pointName: undefined }], drawn)).toEqual([]);
    expect(place([{ ...NK, pointName: '  ' }], drawn)).toEqual([]);
    expect(place([{ ...NK, subject: 'NK' }], drawn)).toEqual([]);
  });

  it('endpointOn trỏ tới đoạn không có thì không ném lỗi', () => {
    expect(place([{ ...NK, endpointOn: 'XY' }], { segments: [seg(4, 1, 4, 5)] })).toEqual([]);
  });
});
