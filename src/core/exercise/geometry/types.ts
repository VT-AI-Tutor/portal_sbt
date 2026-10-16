/**
 * Hợp đồng dữ liệu cho bài hình học trên lưới ô vuông (II.38).
 *
 * Điểm cốt lõi của thiết kế: tác giả khai **điều kiện**, không khai đáp án.
 *
 * Lý do đến từ chính sách bài tập. Khảo sát 42 câu hình học trong Toán 1–5 cho
 * thấy phần lớn KHÔNG có đáp án duy nhất: "Vẽ hình thoi ABCD" thì vẽ ở đâu trên
 * lưới cũng đúng, "Vẽ đoạn thẳng AB dài 5 cm" có hàng trăm vị trí đúng. So khớp
 * toạ độ sẽ buộc tác giả liệt kê một tập vô hạn — nên thay vào đó ta kiểm TÍNH
 * CHẤT của hình học sinh vẽ.
 *
 * Việc snap vào lưới là thứ làm cách này rẻ: mọi toạ độ là số nguyên, nên mọi
 * điều kiện dưới đây đều là số học nguyên — song song là tích chéo bằng 0, vuông
 * góc là tích vô hướng bằng 0, trung điểm là `2M = A + B`. Không có dung sai,
 * không có dấu phẩy động, nên client và server chấm ra cùng kết quả.
 */

/** Ô lưới. Gốc ở góc trên-trái, x sang phải, y xuống dưới. */
export interface GridPoint {
  x: number;
  y: number;
}

/** Điểm CÓ TÊN. Chỉ hình cho trước mới đặt tên (A, B, O…). */
export interface NamedPoint extends GridPoint {
  id: string;
}

/** Đoạn cho trước, hai đầu trỏ tới `id` của điểm cho trước. */
export interface GivenSegment {
  /** Tên tác giả dùng để dẫn chiếu, ví dụ "CD". */
  id: string;
  from: string;
  to: string;
}

export interface GivenCircle {
  id: string;
  /** `id` của điểm tâm. */
  center: string;
  /** Bán kính tính theo ô lưới. */
  radius: number;
}

/**
 * Hình CHO TRƯỚC, khai bằng toạ độ lưới.
 *
 * 14/42 câu thật vẽ đè lên một hình cho trước ("đi qua điểm O và song song với
 * đường thẳng CD cho trước"). Ảnh scan không đủ: hệ phải biết O và CD nằm ở ô
 * nào mới chấm được, nên tác giả phải khai lại hình cho trước ở đây.
 */
export interface GivenFigure {
  points?: NamedPoint[];
  segments?: GivenSegment[];
  circles?: GivenCircle[];
}

/** Đường tròn học sinh vẽ: chọn tâm rồi chọn một điểm trên đường tròn. */
export interface DrawnCircle {
  center: GridPoint;
  through: GridPoint;
}

/**
 * Những gì học sinh vẽ. Toàn bộ đều VÔ DANH — học sinh không đặt tên điểm, nên
 * điều kiện dẫn chiếu tới chúng theo vai trò chứ không theo tên. Tên hiện trên
 * hình (nếu đề có đặt) đến từ `pointName` của điều kiện, không lưu ở đây.
 */
export interface DrawnFigure {
  /** Điểm rời (trung điểm, giao điểm…). */
  points?: GridPoint[];
  segments?: [GridPoint, GridPoint][];
  /** Đa giác kín, đỉnh theo thứ tự vòng. */
  polygons?: GridPoint[][];
  circles?: DrawnCircle[];
}

/**
 * Cách dẫn chiếu một điểm: tên điểm cho trước, hoặc toạ độ tuyệt đối, hoặc
 * nhãn `as` của một điều kiện khai trước đó.
 */
export type PointRef = string | GridPoint;

/** Tên đoạn cho trước ("CD"), hoặc nhãn `as` của một điều kiện khai trước đó. */
export type SegmentRef = string;

export const ANGLE_KINDS = ['right', 'acute', 'obtuse', 'straight'] as const;
export type AngleKind = (typeof ANGLE_KINDS)[number];

export const ANGLE_KIND_LABELS: Record<AngleKind, string> = {
  right: 'góc vuông',
  acute: 'góc nhọn',
  obtuse: 'góc tù',
  straight: 'góc bẹt',
};

/**
 * Phân loại đa giác. Cố ý xếp theo QUAN HỆ BAO NHAU thật của toán học: hình
 * vuông vừa là hình thoi vừa là hình chữ nhật, cả hai đều là hình bình hành, và
 * hình bình hành là một hình thang. `polygonKinds()` trả về TẬP các loại mà một
 * hình thoả, nên điều kiện `is: 'rhombus'` chỉ là phép kiểm tra thuộc tập.
 */
export const POLYGON_KINDS = [
  'triangle',
  'quadrilateral',
  'trapezoid',
  'right_trapezoid',
  'parallelogram',
  'rhombus',
  'rectangle',
  'square',
] as const;
export type PolygonKind = (typeof POLYGON_KINDS)[number];

export const POLYGON_KIND_LABELS: Record<PolygonKind, string> = {
  triangle: 'hình tam giác',
  quadrilateral: 'hình tứ giác',
  trapezoid: 'hình thang',
  right_trapezoid: 'hình thang vuông',
  parallelogram: 'hình bình hành',
  rhombus: 'hình thoi',
  rectangle: 'hình chữ nhật',
  square: 'hình vuông',
};

interface BaseConstraint {
  /**
   * Nhãn để điều kiện SAU dẫn chiếu tới hình mà điều kiện này đã khớp.
   *
   * Cần cho các bài xâu chuỗi, ví dụ Toán 4 bài 8: "vẽ OA tạo với OM một góc
   * tù, rồi vẽ OB tạo với OA một góc vuông" — OA là hình học sinh vẽ, không
   * phải hình cho trước.
   */
  as?: string;
  /**
   * Áp điều kiện này lên hình ĐÃ gán nhãn trước đó, thay vì đòi thêm một hình mới.
   *
   * Cần cho các bài đặt nhiều điều kiện lên cùng một hình: Toán 4 bài 8 yêu cầu OB
   * vừa tạo góc vuông với OA vừa tạo góc nhọn với OM — đó là hai điều kiện trên
   * MỘT đoạn, không phải hai đoạn.
   */
  subject?: string;
}

/** Một đoạn thẳng học sinh vẽ, thoả các tính chất được khai. */
export interface SegmentConstraint extends BaseConstraint {
  kind: 'segment';
  /** Đoạn phải đi qua tất cả các điểm này. */
  through?: PointRef[];
  parallelTo?: SegmentRef;
  perpendicularTo?: SegmentRef;
  /**
   * Ít nhất một ĐẦU của đoạn phải nằm trên đoạn cho trước này.
   *
   * Khác `through`: `through` đòi đoạn đi qua một điểm (đầu hay giữa đều được),
   * còn đây đòi chính điểm mút rơi lên một đoạn khác — "Vẽ đoạn NK song song với
   * MQ, điểm K nằm trên PQ", "cắt cạnh DC tại điểm G".
   */
  endpointOn?: SegmentRef;
  /** Độ dài theo ô lưới. So bằng bình phương nên cạnh chéo 3-4-5 vẫn dài đúng 5. */
  length?: number;
  /**
   * Tên đề đặt cho điểm mà đầu mút chạm `endpointOn` — "điểm K nằm trên PQ" →
   * `pointName: 'K'`. Chỉ có nghĩa khi có `endpointOn`.
   */
  pointName?: string;
}

/** Một điểm rời học sinh đặt. */
export interface PointConstraint extends BaseConstraint {
  kind: 'point';
  midpointOf?: SegmentRef;
  /** Nằm trên đoạn này. */
  on?: SegmentRef;
  /** Tên đề đặt cho điểm này — "Vẽ điểm E là trung điểm của AB" → `pointName: 'E'`. */
  pointName?: string;
}

export interface CircleConstraint extends BaseConstraint {
  kind: 'circle';
  center?: PointRef;
  /** Theo ô lưới. Tác giả quy đổi sẵn: "bán kính 20 mm" với ô 1 cm là `2`. */
  radius?: number;
  /** Tiện lợi cho "đường kính 6 cm"; tương đương `radius: 3`. */
  diameter?: number;
  /**
   * Đường kính bằng độ dài một đoạn cho trước — "Vẽ đường tròn tâm A đường kính BC".
   *
   * Phải có field riêng chứ không quy về `radius`: |BC|² = 25 thì bán kính là 2,5 ô,
   * không biểu diễn được bằng số nguyên. Phép so `4·r² = |BC|²` thì vẫn nguyên.
   */
  diameterOf?: SegmentRef;
  through?: PointRef[];
}

/**
 * Góc tại một đỉnh.
 *
 * Không có `with`: học sinh vẽ CẢ HAI cạnh của góc, nên điều kiện dùng hai đoạn
 * ("Vẽ góc vuông đỉnh M; cạnh MN, ME"). Có `with`: một cạnh là đoạn cho trước,
 * học sinh chỉ vẽ cạnh còn lại ("Vẽ thêm đoạn BC để tạo với AB một góc bẹt").
 */
export interface AngleConstraint extends BaseConstraint {
  kind: 'angle';
  at: PointRef;
  is: AngleKind;
  with?: SegmentRef;
}

export interface PolygonConstraint extends BaseConstraint {
  kind: 'polygon';
  is: PolygonKind;
  /** Số hình phải vẽ. "Vẽ 2 hình bình hành và 2 hình thoi" → hai điều kiện, mỗi cái count 2. */
  count?: number;
}

/**
 * Thẳng hàng — tính trên TOÀN BỘ điểm (cho trước + học sinh vẽ).
 *
 * Toán 2 bài 28: "Vẽ thêm một điểm O vào vị trí thích hợp để được 3 nhóm, mỗi
 * nhóm gồm 3 điểm thẳng hàng."
 */
export interface CollinearConstraint extends BaseConstraint {
  kind: 'collinear';
  /** Số nhóm thẳng hàng phải có. */
  groups: number;
  /** Số điểm mỗi nhóm. */
  size: number;
}

export type GeometryConstraint =
  | SegmentConstraint
  | PointConstraint
  | CircleConstraint
  | AngleConstraint
  | PolygonConstraint
  | CollinearConstraint;

export interface GeometryGrid {
  rows: number;
  cols: number;
}

/** Công cụ vẽ mà player mở cho học sinh. */
export const GEOMETRY_TOOLS = ['point', 'segment', 'polygon', 'circle'] as const;
export type GeometryTool = (typeof GEOMETRY_TOOLS)[number];
