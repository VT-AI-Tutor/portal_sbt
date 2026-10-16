/**
 * Các bẫy của vị từ hình học trên lưới. Mỗi test dưới đây tương ứng một cách sai
 * mà bản cài đặt "hiển nhiên" sẽ mắc, và mọi cách sai đó đều dẫn tới chấm oan
 * học sinh.
 */
import { describe, expect, it } from 'vitest';
import {
  angleKindAt,
  areParallel,
  arePerpendicular,
  hasLength,
  isMidpoint,
  isSimplePolygon,
  pointOnCircle,
  pointOnSegment,
  polygonKinds,
  segmentLength2,
  type Segment,
} from './predicates';

const p = (x: number, y: number) => ({ x, y });
const seg = (ax: number, ay: number, bx: number, by: number): Segment => [p(ax, ay), p(bx, by)];

describe('độ dài', () => {
  it('cạnh chéo 3-4-5 dài đúng 5 ô, không cần khai căn', () => {
    expect(hasLength(seg(0, 0, 3, 4), 5)).toBe(true);
    expect(hasLength(seg(0, 0, 5, 0), 5)).toBe(true);
  });

  it('cạnh chéo 1 ô KHÔNG dài 1 ô — đường chéo dài hơn cạnh', () => {
    expect(segmentLength2(seg(0, 0, 1, 1))).toBe(2);
    expect(hasLength(seg(0, 0, 1, 1), 1)).toBe(false);
  });

  it('đoạn suy biến không có độ dài nào', () => {
    expect(hasLength(seg(2, 2, 2, 2), 0)).toBe(false);
  });
});

describe('song song và vuông góc', () => {
  it('hai đoạn cùng phương là song song, kể cả ngược chiều', () => {
    expect(areParallel(seg(0, 0, 2, 1), seg(5, 5, 3, 4))).toBe(true);
  });

  it('đoạn suy biến không song song cũng không vuông góc với bất cứ gì', () => {
    // Không chốt thì tích chéo/tích vô hướng với vector 0 luôn bằng 0, và một
    // "đoạn" học sinh bấm hai lần cùng một ô sẽ thoả mọi điều kiện.
    expect(areParallel(seg(1, 1, 1, 1), seg(0, 0, 3, 0))).toBe(false);
    expect(arePerpendicular(seg(1, 1, 1, 1), seg(0, 0, 3, 0))).toBe(false);
  });

  it('vuông góc theo trục và vuông góc chéo đều nhận', () => {
    expect(arePerpendicular(seg(0, 0, 4, 0), seg(2, -1, 2, 3))).toBe(true);
    expect(arePerpendicular(seg(0, 0, 2, 1), seg(0, 0, -1, 2))).toBe(true);
  });
});

describe('điểm nằm trên đoạn', () => {
  it('nhận điểm trong lòng đoạn và hai đầu', () => {
    expect(pointOnSegment(p(2, 1), seg(0, 0, 4, 2))).toBe(true);
    expect(pointOnSegment(p(0, 0), seg(0, 0, 4, 2))).toBe(true);
  });

  it('CHỐI điểm thẳng hàng nhưng nằm ngoài đoạn', () => {
    // Chỉ kiểm tích chéo là dính bẫy này: "đường thẳng đi qua O" sẽ nhận cả đoạn
    // nằm đúng phương nhưng cách O nửa trang giấy.
    expect(pointOnSegment(p(8, 4), seg(0, 0, 4, 2))).toBe(false);
    expect(pointOnSegment(p(-2, -1), seg(0, 0, 4, 2))).toBe(false);
  });
});

describe('trung điểm', () => {
  it('so bằng 2M = A + B nên trung điểm ở nửa ô vẫn tính đúng', () => {
    expect(isMidpoint(p(2, 1), seg(1, 0, 3, 2))).toBe(true);
    // Trung điểm của (0,0)-(3,0) là (1,5; 0) — không nằm trên lưới, nên KHÔNG
    // điểm lưới nào là trung điểm. Học sinh không thể trả lời đúng câu này, và
    // đó là việc tác giả phải tránh khi soạn.
    expect(isMidpoint(p(1, 0), seg(0, 0, 3, 0))).toBe(false);
    expect(isMidpoint(p(2, 0), seg(0, 0, 3, 0))).toBe(false);
  });
});

describe('loại góc', () => {
  it('phân biệt vuông, nhọn, tù', () => {
    expect(angleKindAt(p(0, 0), p(1, 0), p(0, 1))).toBe('right');
    expect(angleKindAt(p(0, 0), p(3, 0), p(3, 1))).toBe('acute');
    expect(angleKindAt(p(0, 0), p(3, 0), p(-3, 1))).toBe('obtuse');
  });

  it('góc bẹt là hai cạnh NGƯỢC hướng', () => {
    expect(angleKindAt(p(2, 2), p(0, 2), p(5, 2))).toBe('straight');
  });

  it('hai cạnh CÙNG hướng không phải góc bẹt mà không phải góc nào cả', () => {
    // Cùng hướng cũng thẳng hàng, nên chỉ kiểm tích chéo sẽ gọi nó là góc bẹt và
    // học sinh vẽ trùng hai cạnh lên nhau vẫn được tính đúng.
    expect(angleKindAt(p(0, 0), p(1, 0), p(3, 0))).toBeNull();
  });

  it('cạnh suy biến không tạo góc', () => {
    expect(angleKindAt(p(0, 0), p(0, 0), p(1, 0))).toBeNull();
  });
});

describe('phân loại đa giác', () => {
  const square = [p(0, 0), p(2, 0), p(2, 2), p(0, 2)];
  const rhombus = [p(2, 0), p(4, 3), p(2, 6), p(0, 3)];
  const rectangle = [p(0, 0), p(4, 0), p(4, 2), p(0, 2)];
  const parallelogram = [p(0, 0), p(3, 0), p(4, 2), p(1, 2)];
  const trapezoid = [p(0, 0), p(5, 0), p(4, 2), p(1, 2)];

  it('hình vuông thoả TẤT CẢ các loại bao nó', () => {
    expect([...polygonKinds(square)].sort()).toEqual(
      [
        'parallelogram',
        'quadrilateral',
        'rectangle',
        'rhombus',
        'right_trapezoid',
        'square',
        'trapezoid',
      ].sort(),
    );
  });

  it('học sinh vẽ hình vuông khi được yêu cầu hình thoi thì ĐÚNG', () => {
    // Toán học: hình vuông là hình thoi có góc vuông. Chấm sai chỗ này là dạy sai.
    expect(polygonKinds(square).has('rhombus')).toBe(true);
  });

  it('hình thoi chéo (không cạnh nào theo trục) vẫn nhận đúng', () => {
    const kinds = polygonKinds(rhombus);
    expect(kinds.has('rhombus')).toBe(true);
    expect(kinds.has('square')).toBe(false);
  });

  it('hình chữ nhật không phải hình thoi, hình thoi không phải hình chữ nhật', () => {
    expect(polygonKinds(rectangle).has('rhombus')).toBe(false);
    expect(polygonKinds(rhombus).has('rectangle')).toBe(false);
  });

  it('hình bình hành cũng là hình thang (nghĩa bao trùm)', () => {
    expect(polygonKinds(parallelogram).has('trapezoid')).toBe(true);
  });

  it('hình thang thường KHÔNG phải hình bình hành', () => {
    const kinds = polygonKinds(trapezoid);
    expect(kinds.has('trapezoid')).toBe(true);
    expect(kinds.has('parallelogram')).toBe(false);
  });

  it('tam giác là tam giác, không phải tứ giác', () => {
    const kinds = polygonKinds([p(0, 0), p(4, 0), p(1, 3)]);
    expect(kinds.has('triangle')).toBe(true);
    expect(kinds.has('quadrilateral')).toBe(false);
  });
});

describe('đa giác đơn', () => {
  it('CHỐI hình số 8 tự cắt dù bốn cạnh bằng nhau', () => {
    // Đây là bẫy nguy hiểm nhất của phân loại đa giác: chỉ so độ dài cạnh thì một
    // hình tự cắt có 4 cạnh bằng nhau được gọi là hình thoi.
    const bowtie = [p(0, 0), p(2, 2), p(2, 0), p(0, 2)];
    expect(isSimplePolygon(bowtie)).toBe(false);
    expect(polygonKinds(bowtie).size).toBe(0);
  });

  it('CHỐI đỉnh bẹt — ba đỉnh liên tiếp thẳng hàng thì không thật là đỉnh', () => {
    expect(isSimplePolygon([p(0, 0), p(1, 0), p(2, 0), p(0, 2)])).toBe(false);
  });

  it('CHỐI đa giác có diện tích 0', () => {
    expect(isSimplePolygon([p(0, 0), p(1, 0), p(2, 0)])).toBe(false);
  });

  it('CHỐI đỉnh trùng nhau', () => {
    expect(isSimplePolygon([p(0, 0), p(0, 0), p(2, 0), p(0, 2)])).toBe(false);
  });
});

describe('đường tròn', () => {
  it('điểm trên đường tròn so bằng bình phương bán kính', () => {
    expect(pointOnCircle(p(3, 4), p(0, 0), 25)).toBe(true);
    expect(pointOnCircle(p(3, 3), p(0, 0), 25)).toBe(false);
  });
});
