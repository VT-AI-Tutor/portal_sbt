/**
 * Vị từ hình học trên lưới ô vuông — số học SỐ NGUYÊN, không dung sai.
 *
 * Mọi hàm ở đây nhận toạ độ nguyên và trả về boolean chính xác. Không có `EPSILON`,
 * không có `Math.sqrt`, không có `Math.atan2`. Đó là lý do bản chấm phía PHP soi
 * gương được từng dòng: cùng phép toán nguyên thì cùng kết quả, không phụ thuộc
 * cách hai ngôn ngữ làm tròn dấu phẩy động.
 *
 * Quy ước: nơi nào cần "độ dài" thì so BÌNH PHƯƠNG độ dài. Nhờ vậy cạnh chéo
 * 3-4-5 được nhận đúng là dài 5 mà không cần khai căn.
 */

import type { AngleKind, GridPoint, PolygonKind } from './types';

export type Segment = readonly [GridPoint, GridPoint];

interface Vec {
  x: number;
  y: number;
}

const sub = (a: GridPoint, b: GridPoint): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (u: Vec, v: Vec): number => u.x * v.y - u.y * v.x;
const dot = (u: Vec, v: Vec): number => u.x * v.x + u.y * v.y;
const norm2 = (u: Vec): number => u.x * u.x + u.y * u.y;
const direction = (s: Segment): Vec => sub(s[1], s[0]);

export const samePoint = (a: GridPoint, b: GridPoint): boolean => a.x === b.x && a.y === b.y;

/** Đoạn suy biến — hai đầu trùng nhau. Không phải đoạn thẳng, mọi vị từ phải chối. */
export const isDegenerate = (s: Segment): boolean => samePoint(s[0], s[1]);

/** Bình phương độ dài. So với `n * n` thay vì khai căn. */
export const segmentLength2 = (s: Segment): number => norm2(direction(s));

export function hasLength(s: Segment, cells: number): boolean {
  if (isDegenerate(s)) return false;
  return segmentLength2(s) === cells * cells;
}

export function areParallel(a: Segment, b: Segment): boolean {
  if (isDegenerate(a) || isDegenerate(b)) return false;
  return cross(direction(a), direction(b)) === 0;
}

export function arePerpendicular(a: Segment, b: Segment): boolean {
  if (isDegenerate(a) || isDegenerate(b)) return false;
  return dot(direction(a), direction(b)) === 0;
}

/**
 * Điểm nằm TRÊN đoạn (kể cả hai đầu).
 *
 * Hai phần: thẳng hàng (tích chéo 0) và nằm trong khoảng (chiếu lên đoạn rơi vào
 * [0, |đoạn|²]). Thiếu phần thứ hai thì "đi qua điểm O" sẽ nhận cả những đoạn
 * nằm đúng đường thẳng nhưng cách O rất xa.
 */
export function pointOnSegment(p: GridPoint, s: Segment): boolean {
  if (isDegenerate(s)) return samePoint(p, s[0]);
  const u = direction(s);
  const w = sub(p, s[0]);
  if (cross(u, w) !== 0) return false;
  const t = dot(w, u);
  return t >= 0 && t <= norm2(u);
}

export function isMidpoint(p: GridPoint, s: Segment): boolean {
  if (isDegenerate(s)) return false;
  return 2 * p.x === s[0].x + s[1].x && 2 * p.y === s[0].y + s[1].y;
}

export function areCollinear(points: readonly GridPoint[]): boolean {
  if (points.length < 3) return true;
  const base = points[0];
  let ref: Vec | null = null;
  for (let i = 1; i < points.length; i += 1) {
    const v = sub(points[i], base);
    if (v.x === 0 && v.y === 0) continue;
    if (ref === null) ref = v;
    else if (cross(ref, v) !== 0) return false;
  }
  return true;
}

/**
 * Loại góc tại `vertex`, hai cạnh đi tới `a` và `b`.
 *
 * `null` khi không thành một góc: cạnh suy biến, hoặc hai cạnh cùng hướng (góc
 * 0° — học sinh vẽ trùng lên nhau, không phải câu trả lời).
 *
 * Góc bẹt là hai cạnh ngược hướng: thẳng hàng (tích chéo 0) VÀ tích vô hướng âm.
 * Cùng hướng cũng thẳng hàng nhưng tích vô hướng dương — đó là trường hợp `null`
 * nói trên, và là lý do không thể chỉ kiểm tích chéo.
 */
export function angleKindAt(vertex: GridPoint, a: GridPoint, b: GridPoint): AngleKind | null {
  const u = sub(a, vertex);
  const v = sub(b, vertex);
  if (norm2(u) === 0 || norm2(v) === 0) return null;

  const d = dot(u, v);
  if (d === 0) return 'right';
  if (cross(u, v) === 0) return d < 0 ? 'straight' : null;
  return d > 0 ? 'acute' : 'obtuse';
}

/** Hai lần diện tích có dấu (shoelace). Nguyên, và bằng 0 khi mọi đỉnh thẳng hàng. */
export function signedArea2(vertices: readonly GridPoint[]): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const p = vertices[i];
    const q = vertices[(i + 1) % vertices.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return sum;
}

/** Hai đoạn có điểm chung không (kể cả chạm đầu, kể cả chồng nhau). */
function segmentsIntersect(a: Segment, b: Segment): boolean {
  const d1 = cross(direction(a), sub(b[0], a[0]));
  const d2 = cross(direction(a), sub(b[1], a[0]));
  const d3 = cross(direction(b), sub(a[0], b[0]));
  const d4 = cross(direction(b), sub(a[1], b[0]));

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return (
    (d1 === 0 && pointOnSegment(b[0], a)) ||
    (d2 === 0 && pointOnSegment(b[1], a)) ||
    (d3 === 0 && pointOnSegment(a[0], b)) ||
    (d4 === 0 && pointOnSegment(a[1], b))
  );
}

/**
 * Đa giác ĐƠN: không có cạnh suy biến, không có đỉnh bẹt, không tự cắt.
 *
 * Cần cái này vì nếu không, một "hình thoi" tự cắt hình số 8 với 4 cạnh bằng nhau
 * sẽ được nhận là hình thoi.
 */
export function isSimplePolygon(vertices: readonly GridPoint[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  for (let i = 0; i < n; i += 1) {
    if (samePoint(vertices[i], vertices[(i + 1) % n])) return false;
    // Đỉnh bẹt: ba đỉnh liên tiếp thẳng hàng thì đó không thật là một đỉnh.
    const prev = vertices[(i + n - 1) % n];
    const cur = vertices[i];
    const next = vertices[(i + 1) % n];
    if (cross(sub(cur, prev), sub(next, cur)) === 0) return false;
  }
  if (signedArea2(vertices) === 0) return false;

  const edges: Segment[] = [];
  for (let i = 0; i < n; i += 1) edges.push([vertices[i], vertices[(i + 1) % n]]);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue; // cạnh kề nhau, chạm đầu là bình thường
      if (segmentsIntersect(edges[i], edges[j])) return false;
    }
  }
  return true;
}

/**
 * TẬP các loại mà một đa giác thoả, theo đúng quan hệ bao nhau của toán học.
 *
 * Hình vuông trả về `{square, rectangle, rhombus, parallelogram, trapezoid,
 * quadrilateral}`. Nhờ vậy điều kiện `is: 'rhombus'` chỉ là phép kiểm thuộc tập,
 * và học sinh vẽ hình vuông khi được yêu cầu vẽ hình thoi thì vẫn ĐÚNG — vì hình
 * vuông đúng là một hình thoi.
 *
 * `trapezoid` dùng nghĩa "có ÍT NHẤT một cặp cạnh đối song song", nên hình bình
 * hành cũng là hình thang. Đây là quy ước bao trùm; nếu sách nào cần nghĩa hẹp
 * (đúng một cặp) thì phải thêm loại riêng chứ đừng sửa nghĩa này.
 */
export function polygonKinds(vertices: readonly GridPoint[]): Set<PolygonKind> {
  const kinds = new Set<PolygonKind>();
  if (!isSimplePolygon(vertices)) return kinds;

  if (vertices.length === 3) {
    kinds.add('triangle');
    return kinds;
  }
  if (vertices.length !== 4) return kinds;

  kinds.add('quadrilateral');
  const [a, b, c, d] = vertices;
  const ab: Segment = [a, b];
  const bc: Segment = [b, c];
  const cd: Segment = [c, d];
  const da: Segment = [d, a];

  const abParallelCd = areParallel(ab, cd);
  const bcParallelDa = areParallel(bc, da);
  if (abParallelCd || bcParallelDa) {
    kinds.add('trapezoid');
    // Hình thang vuông: có ít nhất một góc trong vuông. Hình chữ nhật cũng thoả —
    // đúng theo nghĩa bao trùm đang dùng xuyên suốt hàm này.
    const sides: Segment[] = [ab, bc, cd, da];
    const hasRightCorner = sides.some((side, i) => arePerpendicular(side, sides[(i + 1) % 4]));
    if (hasRightCorner) kinds.add('right_trapezoid');
  }

  // Hình bình hành ⟺ hai đường chéo cắt nhau tại trung điểm ⟺ a + c = b + d.
  const isParallelogram = a.x + c.x === b.x + d.x && a.y + c.y === b.y + d.y;
  if (!isParallelogram) return kinds;
  kinds.add('parallelogram');

  const equalSides = segmentLength2(ab) === segmentLength2(bc);
  const rightCorner = arePerpendicular(ab, bc);
  if (equalSides) kinds.add('rhombus');
  if (rightCorner) kinds.add('rectangle');
  if (equalSides && rightCorner) kinds.add('square');

  return kinds;
}

/** Bình phương bán kính của đường tròn qua `through`, tâm `center`. */
export const circleRadius2 = (center: GridPoint, through: GridPoint): number =>
  norm2(sub(through, center));

export function pointOnCircle(p: GridPoint, center: GridPoint, radius2: number): boolean {
  return norm2(sub(p, center)) === radius2;
}
