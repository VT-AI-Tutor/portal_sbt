/**
 * Hạt nhân chấm hình học, đối chiếu với BÀI THẬT trong sách bài tập Toán 1–5.
 *
 * Mỗi khối `describe` dưới đây là một câu có thật, ghi kèm mã câu để tra lại
 * (`books/<sách>/data/<bài>.json`). Đây là điều làm bộ test này khác một bộ test
 * tự bịa dữ liệu: nếu bộ vị từ diễn đạt không nổi một câu trong sách thì test
 * không viết được, và đó là tín hiệu phải sửa hợp đồng chứ không phải sửa test.
 *
 * Toạ độ là ô lưới, 1 ô = 1 cm.
 */
import { describe, expect, it } from 'vitest';
import { gradeGeometryGrid } from './grade';
import type { DrawnFigure, GeometryConstraint, GivenFigure } from './types';

const p = (x: number, y: number) => ({ x, y });

/** Học sinh làm đúng chưa? Rút gọn cho gọn mặt test. */
const grade = (
  constraints: GeometryConstraint[],
  given: GivenFigure | undefined,
  drawn: DrawnFigure,
) => gradeGeometryGrid(constraints, given, drawn);

const correct = { isCorrect: true, gradable: true };
const wrong = { isCorrect: false, gradable: true };

describe('Toán 2 · b34_q6 — "Vẽ đoạn thẳng AB dài 5 cm"', () => {
  const constraints: GeometryConstraint[] = [{ kind: 'segment', length: 5 }];

  it('vẽ ở ĐÂU trên lưới cũng đúng, miễn đủ 5 ô', () => {
    expect(grade(constraints, undefined, { segments: [[p(1, 1), p(6, 1)]] })).toEqual(correct);
    expect(grade(constraints, undefined, { segments: [[p(4, 7), p(4, 2)]] })).toEqual(correct);
  });

  it('cạnh chéo 3-4-5 cũng dài đúng 5 cm', () => {
    expect(grade(constraints, undefined, { segments: [[p(0, 0), p(3, 4)]] })).toEqual(correct);
  });

  it('dài 4 ô là sai', () => {
    expect(grade(constraints, undefined, { segments: [[p(1, 1), p(5, 1)]] })).toEqual(wrong);
  });
});

describe('Toán 5 · b8_q7 / b8_q4 — "Vẽ đường thẳng đi qua M và song song / vuông góc với AB"', () => {
  const given: GivenFigure = {
    points: [
      { id: 'A', x: 1, y: 4 },
      { id: 'B', x: 6, y: 4 },
      { id: 'M', x: 3, y: 1 },
    ],
    segments: [{ id: 'AB', from: 'A', to: 'B' }],
  };

  it('song song: qua M và cùng phương AB', () => {
    const c: GeometryConstraint[] = [{ kind: 'segment', through: ['M'], parallelTo: 'AB' }];
    expect(grade(c, given, { segments: [[p(1, 1), p(6, 1)]] })).toEqual(correct);
    // Đúng phương nhưng KHÔNG qua M.
    expect(grade(c, given, { segments: [[p(1, 2), p(6, 2)]] })).toEqual(wrong);
    // Qua M nhưng lệch phương.
    expect(grade(c, given, { segments: [[p(3, 1), p(5, 3)]] })).toEqual(wrong);
  });

  it('vuông góc: qua M và thẳng góc với AB', () => {
    const c: GeometryConstraint[] = [{ kind: 'segment', through: ['M'], perpendicularTo: 'AB' }];
    expect(grade(c, given, { segments: [[p(3, 0), p(3, 5)]] })).toEqual(correct);
    expect(grade(c, given, { segments: [[p(1, 1), p(6, 1)]] })).toEqual(wrong);
  });
});

describe('Toán 3 · b16_q4 — "Vẽ điểm E là trung điểm của đoạn thẳng AB"', () => {
  const given: GivenFigure = {
    points: [
      { id: 'A', x: 2, y: 2 },
      { id: 'B', x: 8, y: 2 },
    ],
    segments: [{ id: 'AB', from: 'A', to: 'B' }],
  };
  const constraints: GeometryConstraint[] = [{ kind: 'point', midpointOf: 'AB' }];

  it('đúng ô giữa thì đúng', () => {
    expect(grade(constraints, given, { points: [p(5, 2)] })).toEqual(correct);
  });

  it('lệch một ô là sai — không có dung sai', () => {
    expect(grade(constraints, given, { points: [p(4, 2)] })).toEqual(wrong);
  });
});

describe('Toán 5 · b25_q5 — "Vẽ đường cao ứng với đáy BC"', () => {
  /**
   * Đường cao KHÔNG cần vị từ riêng: nó là "đoạn đi qua đỉnh A và vuông góc với
   * đáy BC". Test này là bằng chứng cho phép phân rã đó, nhờ vậy bộ vị từ bớt
   * được một loại mà vẫn phủ 3 câu đường cao trong Toán 5.
   */
  const given: GivenFigure = {
    points: [
      { id: 'A', x: 2, y: 1 },
      { id: 'B', x: 1, y: 5 },
      { id: 'C', x: 7, y: 5 },
    ],
    segments: [{ id: 'BC', from: 'B', to: 'C' }],
  };
  const constraints: GeometryConstraint[] = [
    { kind: 'segment', through: ['A'], perpendicularTo: 'BC' },
  ];

  it('hạ vuông góc từ A xuống BC là đúng', () => {
    expect(grade(constraints, given, { segments: [[p(2, 1), p(2, 5)]] })).toEqual(correct);
  });

  it('nối A tới một điểm bất kỳ trên BC là sai', () => {
    expect(grade(constraints, given, { segments: [[p(2, 1), p(5, 5)]] })).toEqual(wrong);
  });
});

describe('Toán 4 · b30_t1q3 — "Vẽ đoạn NK song song với MQ, điểm K nằm trên PQ"', () => {
  const given: GivenFigure = {
    points: [
      { id: 'M', x: 1, y: 1 },
      { id: 'Q', x: 1, y: 6 },
      { id: 'P', x: 7, y: 6 },
      { id: 'N', x: 5, y: 2 },
    ],
    segments: [
      { id: 'MQ', from: 'M', to: 'Q' },
      { id: 'PQ', from: 'P', to: 'Q' },
    ],
  };
  const constraints: GeometryConstraint[] = [
    { kind: 'segment', through: ['N'], parallelTo: 'MQ', endpointOn: 'PQ' },
  ];

  it('từ N kẻ dọc xuống, chạm PQ là đúng', () => {
    // MQ dọc (x=1); PQ ngang (y=6). Đoạn N(5,2)→(5,6) cùng phương MQ, mút rơi lên PQ.
    expect(grade(constraints, given, { segments: [[p(5, 2), p(5, 6)]] })).toEqual(correct);
  });

  it('cùng phương nhưng chưa chạm PQ là sai', () => {
    expect(grade(constraints, given, { segments: [[p(5, 2), p(5, 5)]] })).toEqual(wrong);
  });
});

describe('Toán 3 · b20_q1a — "Vẽ góc vuông đỉnh M; cạnh MN, ME"', () => {
  const given: GivenFigure = { points: [{ id: 'M', x: 3, y: 3 }] };
  const constraints: GeometryConstraint[] = [{ kind: 'angle', at: 'M', is: 'right' }];

  it('học sinh vẽ CẢ HAI cạnh, vuông nhau tại M', () => {
    expect(
      grade(constraints, given, {
        segments: [
          [p(3, 3), p(6, 3)],
          [p(3, 3), p(3, 6)],
        ],
      }),
    ).toEqual(correct);
  });

  it('hai cạnh tạo góc 45° là sai', () => {
    expect(
      grade(constraints, given, {
        segments: [
          [p(3, 3), p(6, 3)],
          [p(3, 3), p(6, 6)],
        ],
      }),
    ).toEqual(wrong);
  });

  it('hai cạnh vuông nhau nhưng KHÔNG chung đỉnh M là sai', () => {
    expect(
      grade(constraints, given, {
        segments: [
          [p(5, 5), p(8, 5)],
          [p(5, 5), p(5, 8)],
        ],
      }),
    ).toEqual(wrong);
  });
});

describe('Toán 4 · b8_t1q4 — "Vẽ thêm đoạn BC để tạo với AB một góc bẹt"', () => {
  const given: GivenFigure = {
    points: [
      { id: 'A', x: 1, y: 3 },
      { id: 'B', x: 4, y: 3 },
    ],
    segments: [{ id: 'AB', from: 'A', to: 'B' }],
  };
  const constraints: GeometryConstraint[] = [
    { kind: 'angle', at: 'B', is: 'straight', with: 'AB' },
  ];

  it('kéo tiếp qua B về phía đối diện A là góc bẹt', () => {
    expect(grade(constraints, given, { segments: [[p(4, 3), p(7, 3)]] })).toEqual(correct);
  });

  it('vẽ chồng lên phía A KHÔNG phải góc bẹt', () => {
    // Cùng phương nhưng cùng hướng — đây là bẫy chỉ-kiểm-tích-chéo.
    expect(grade(constraints, given, { segments: [[p(4, 3), p(2, 3)]] })).toEqual(wrong);
  });

  it('vuông góc là sai', () => {
    expect(grade(constraints, given, { segments: [[p(4, 3), p(4, 6)]] })).toEqual(wrong);
  });
});

describe('Toán 4 · b8_t3q4 — ba điều kiện xâu chuỗi trên hình học sinh tự vẽ', () => {
  /**
   * "Vẽ OA tạo với OM một góc tù. Sau đó vẽ OB tạo với OA một góc vuông và tạo
   * với OM một góc nhọn."
   *
   * Câu này là lý do có `as` và `subject`: OA và OB đều do học sinh vẽ, nên điều
   * kiện phải dẫn chiếu tới chúng chứ không tới hình cho trước. Mệnh đề thứ ba
   * đặt thêm điều kiện lên CHÍNH OB, không đòi vẽ thêm đoạn thứ ba.
   */
  const given: GivenFigure = {
    points: [
      { id: 'O', x: 5, y: 5 },
      { id: 'M', x: 9, y: 5 },
    ],
    segments: [{ id: 'OM', from: 'O', to: 'M' }],
  };
  const constraints: GeometryConstraint[] = [
    { kind: 'angle', at: 'O', is: 'obtuse', with: 'OM', as: 'OA' },
    { kind: 'angle', at: 'O', is: 'right', with: 'OA', as: 'OB' },
    { kind: 'angle', at: 'O', is: 'acute', with: 'OM', subject: 'OB' },
  ];

  it('thoả cả ba mệnh đề bằng đúng HAI đoạn', () => {
    expect(
      grade(constraints, given, {
        segments: [
          [p(5, 5), p(2, 2)], // OA: tù với OM
          [p(5, 5), p(8, 2)], // OB: vuông với OA, nhọn với OM
        ],
      }),
    ).toEqual(correct);
  });

  it('OB vuông với OA nhưng TÙ với OM thì sai', () => {
    expect(
      grade(constraints, given, {
        segments: [
          [p(5, 5), p(2, 2)],
          [p(5, 5), p(2, 8)],
        ],
      }),
    ).toEqual(wrong);
  });
});

describe('Toán 5 · b27_q1 / Toán 3 · b22_q6 — đường tròn theo bán kính và theo đường kính', () => {
  it('"Vẽ đường tròn tâm O đường kính 6 cm"', () => {
    const given: GivenFigure = { points: [{ id: 'O', x: 5, y: 5 }] };
    const c: GeometryConstraint[] = [{ kind: 'circle', center: 'O', diameter: 6 }];
    expect(grade(c, given, { circles: [{ center: p(5, 5), through: p(8, 5) }] })).toEqual(correct);
    expect(grade(c, given, { circles: [{ center: p(5, 5), through: p(7, 5) }] })).toEqual(wrong);
    // Đúng bán kính nhưng đặt sai tâm.
    expect(grade(c, given, { circles: [{ center: p(4, 5), through: p(7, 5) }] })).toEqual(wrong);
  });

  it('"Vẽ đường tròn tâm A đường kính BC" — đường kính bằng độ dài một đoạn cho trước', () => {
    const given: GivenFigure = {
      points: [
        { id: 'A', x: 5, y: 5 },
        { id: 'B', x: 1, y: 1 },
        { id: 'C', x: 5, y: 1 },
      ],
      segments: [{ id: 'BC', from: 'B', to: 'C' }],
    };
    const c: GeometryConstraint[] = [{ kind: 'circle', center: 'A', diameterOf: 'BC' }];
    // |BC| = 4 ô → bán kính 2 ô.
    expect(grade(c, given, { circles: [{ center: p(5, 5), through: p(7, 5) }] })).toEqual(correct);
    expect(grade(c, given, { circles: [{ center: p(5, 5), through: p(8, 5) }] })).toEqual(wrong);
  });

  it('"Vẽ đường tròn tâm O và đường kính AB" — hai điểm cho trước phải nằm trên đường tròn', () => {
    const given: GivenFigure = {
      points: [
        { id: 'O', x: 5, y: 5 },
        { id: 'A', x: 2, y: 5 },
        { id: 'B', x: 8, y: 5 },
      ],
    };
    const c: GeometryConstraint[] = [{ kind: 'circle', center: 'O', through: ['A', 'B'] }];
    expect(grade(c, given, { circles: [{ center: p(5, 5), through: p(5, 2) }] })).toEqual(correct);
    expect(grade(c, given, { circles: [{ center: p(5, 5), through: p(5, 3) }] })).toEqual(wrong);
  });

  it('đường tròn bán kính 0 không phải đường tròn', () => {
    const given: GivenFigure = { points: [{ id: 'O', x: 5, y: 5 }] };
    const c: GeometryConstraint[] = [{ kind: 'circle', center: 'O' }];
    expect(grade(c, given, { circles: [{ center: p(5, 5), through: p(5, 5) }] })).toEqual(wrong);
  });
});

describe('Toán 5 · b32_q3 — "Vẽ 2 hình bình hành và 2 hình thoi vào lưới ô vuông"', () => {
  /** Đây là câu buộc phép gán phải ĐỘC QUYỀN. */
  const constraints: GeometryConstraint[] = [
    { kind: 'polygon', is: 'parallelogram', count: 2 },
    { kind: 'polygon', is: 'rhombus', count: 2 },
  ];

  const rhombus = (dx: number, dy: number) =>
    [p(2 + dx, 0 + dy), p(4 + dx, 3 + dy), p(2 + dx, 6 + dy), p(0 + dx, 3 + dy)];
  // Cạnh 3 và √5 khác nhau → hình bình hành mà KHÔNG phải hình thoi.
  const plainParallelogram = (dx: number, dy: number) =>
    [p(0 + dx, 0 + dy), p(3 + dx, 0 + dy), p(4 + dx, 2 + dy), p(1 + dx, 2 + dy)];

  it('vẽ đủ 2 + 2 là đúng', () => {
    expect(
      grade(constraints, undefined, {
        polygons: [plainParallelogram(0, 8), plainParallelogram(6, 8), rhombus(0, 0), rhombus(6, 0)],
      }),
    ).toEqual(correct);
  });

  it('chỉ vẽ 2 hình thoi là SAI, dù hình thoi cũng là hình bình hành', () => {
    // Không có độc quyền thì cùng 2 hình này khớp cả hai điều kiện và học sinh
    // được tính đúng khi mới làm nửa bài.
    expect(grade(constraints, undefined, { polygons: [rhombus(0, 0), rhombus(6, 0)] })).toEqual(
      wrong,
    );
  });

  it('chỉ vẽ 2 hình bình hành thường là sai — thiếu hẳn hình thoi', () => {
    expect(
      grade(constraints, undefined, {
        polygons: [plainParallelogram(0, 0), plainParallelogram(6, 0)],
      }),
    ).toEqual(wrong);
  });

  it('vẽ 4 hình thoi thì ĐÚNG', () => {
    // Quyết định có chủ đích: hình thoi là hình bình hành, nên 4 hình thoi thoả
    // "2 hình bình hành + 2 hình thoi". Muốn đòi 2 hình bình hành KHÔNG phải hình
    // thoi thì phải có loại riêng, chứ không phải sửa nghĩa của `parallelogram`.
    expect(
      grade(constraints, undefined, {
        polygons: [rhombus(0, 0), rhombus(6, 0), rhombus(0, 8), rhombus(6, 8)],
      }),
    ).toEqual(correct);
  });
});

describe('Toán 5 · b26_q5 — "Vẽ hình thang vuông ABCD ... trên giấy kẻ ô vuông"', () => {
  const constraints: GeometryConstraint[] = [{ kind: 'polygon', is: 'right_trapezoid' }];

  it('hình thang có một góc vuông là đúng', () => {
    // AB ∥ CD (đều ngang), BC dọc nên vuông với cả hai đáy.
    expect(
      grade(constraints, undefined, { polygons: [[p(1, 1), p(5, 1), p(5, 5), p(1, 5)]] }),
    ).toEqual(correct);
    expect(
      grade(constraints, undefined, { polygons: [[p(1, 1), p(4, 1), p(6, 5), p(1, 5)]] }),
    ).toEqual(correct);
  });

  it('hình thang không có góc vuông nào là sai', () => {
    expect(
      grade(constraints, undefined, { polygons: [[p(1, 1), p(5, 1), p(6, 4), p(0, 4)]] }),
    ).toEqual(wrong);
  });
});

describe('Toán 2 · b28_q4b — "Vẽ thêm một điểm O để được 3 nhóm, mỗi nhóm 3 điểm thẳng hàng"', () => {
  /** Sáu điểm cho trước, TỰ CHÚNG không tạo nhóm 3 điểm thẳng hàng nào. */
  const given: GivenFigure = {
    points: [
      { id: 'P1', x: 1, y: 1 },
      { id: 'P2', x: 5, y: 5 },
      { id: 'P3', x: 0, y: 3 },
      { id: 'P4', x: 6, y: 3 },
      { id: 'P5', x: 2, y: 6 },
      { id: 'P6', x: 4, y: 0 },
    ],
  };
  const constraints: GeometryConstraint[] = [{ kind: 'collinear', groups: 3, size: 3 }];

  it('đặt O vào giao điểm ba đường thì đủ 3 nhóm', () => {
    expect(grade(constraints, given, { points: [p(3, 3)] })).toEqual(correct);
  });

  it('đặt O chỗ khác chỉ được 1 nhóm — sai', () => {
    expect(grade(constraints, given, { points: [p(0, 0)] })).toEqual(wrong);
  });
});

describe('phép gán phải có LÙI, không được tham lam', () => {
  /**
   * Hai điều kiện, hai đoạn. Đoạn thứ nhất thoả CẢ HAI điều kiện, đoạn thứ hai
   * chỉ thoả điều kiện độ dài.
   *
   * Gán tham lam: điều kiện "dài 5" lấy đoạn đầu tiên khớp (đoạn 0), còn lại đoạn
   * 1 cho điều kiện "song song" — không song song → kết luận SAI, oan học sinh.
   * Có lùi: thử lại, gán đoạn 1 cho "dài 5" và đoạn 0 cho "song song" → ĐÚNG.
   */
  const given: GivenFigure = {
    points: [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 4, y: 0 },
    ],
    segments: [{ id: 'AB', from: 'A', to: 'B' }],
  };
  const constraints: GeometryConstraint[] = [
    { kind: 'segment', length: 5 },
    { kind: 'segment', parallelTo: 'AB' },
  ];

  it('tìm ra phép gán thoả dù thứ tự thử ban đầu dẫn vào ngõ cụt', () => {
    expect(
      grade(constraints, given, {
        segments: [
          [p(0, 2), p(5, 2)], // dài 5 VÀ song song AB
          [p(0, 4), p(3, 8)], // dài 5 nhưng không song song
        ],
      }),
    ).toEqual(correct);
  });

  it('vẫn kết luận sai khi thật sự không có phép gán nào thoả', () => {
    expect(
      grade(constraints, given, {
        segments: [
          [p(0, 2), p(3, 6)], // dài 5, không song song
          [p(0, 4), p(3, 8)], // dài 5, không song song
        ],
      }),
    ).toEqual(wrong);
  });
});

describe('chưa chấm được', () => {
  it('chưa vẽ gì thì CHỜ chấm, không phải sai', () => {
    // Khác biệt quan trọng với UX: "sai" hiện dấu đỏ, "chưa chấm được" thì không.
    expect(gradeGeometryGrid([{ kind: 'segment', length: 5 }], undefined, {})).toEqual({
      isCorrect: false,
      gradable: false,
    });
    expect(gradeGeometryGrid([{ kind: 'segment', length: 5 }], undefined, undefined)).toEqual({
      isCorrect: false,
      gradable: false,
    });
  });

  it('tác giả chưa khai điều kiện nào thì để giáo viên chấm', () => {
    expect(gradeGeometryGrid([], undefined, { segments: [[p(0, 0), p(5, 0)]] })).toEqual({
      isCorrect: false,
      gradable: false,
    });
  });
});
