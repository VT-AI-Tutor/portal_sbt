/**
 * Chấm bài hình học trên lưới: đối chiếu hình học sinh vẽ với các ĐIỀU KIỆN tác
 * giả khai.
 *
 * Cách làm là tìm kiếm có lùi (backtracking) trên phép gán "điều kiện → hình học
 * sinh vẽ", với hai tính chất bắt buộc:
 *
 * 1. **Độc quyền.** Mỗi hình học sinh vẽ phục vụ nhiều nhất một điều kiện. Không
 *    có nó thì "Vẽ 2 hình bình hành và 2 hình thoi" sẽ được thoả bởi đúng 2 hình
 *    thoi — vì hình thoi cũng là hình bình hành nên cùng 2 hình đó khớp cả hai
 *    điều kiện. Độc quyền buộc học sinh phải vẽ đủ 4 hình.
 * 2. **Có lùi.** Phép gán tham lam sai. Với "một đoạn dài 5" và "một đoạn song
 *    song với CD", nếu đoạn đầu tiên thoả cả hai mà bị gán cho điều kiện sai thì
 *    kết quả là "sai" trong khi học sinh làm đúng. Chỉ cần MỘT phép gán thoả là
 *    bài đúng, nên phải thử hết.
 *
 * Quy mô bài thật rất nhỏ (≤6 điều kiện, ≤10 hình), nên tìm kiếm vét cạn là
 * chính xác và không cần tối ưu.
 */

import {
  angleKindAt,
  areCollinear,
  areParallel,
  arePerpendicular,
  circleRadius2,
  hasLength,
  isMidpoint,
  pointOnCircle,
  pointOnSegment,
  polygonKinds,
  samePoint,
  segmentLength2,
  type Segment,
} from './predicates';
import type {
  AngleConstraint,
  CircleConstraint,
  CollinearConstraint,
  DrawnFigure,
  GeometryConstraint,
  GivenFigure,
  GridPoint,
  PointConstraint,
  PointRef,
  PolygonConstraint,
  SegmentConstraint,
  SegmentRef,
} from './types';

export interface GeometryVerdict {
  isCorrect: boolean;
  /** false khi chưa vẽ gì, hoặc tác giả chưa khai điều kiện nào — chưa chấm được. */
  gradable: boolean;
}

/**
 * Phép gán bộ chấm tìm ra khi bài đúng: `[i]` là chỉ số các hình (trong danh
 * sách cùng loại của `DrawnFigure`) phục vụ điều kiện thứ `i`; `null` với điều
 * kiện không tiêu thụ hình (`subject`, `collinear`).
 */
export type GeometryAssignment = (readonly number[] | null)[];

interface ResolvedCircle {
  center: GridPoint;
  radius2: number;
}

/** Môi trường tên: hình cho trước cộng các nhãn `as` đã gán trong quá trình tìm. */
export interface Env {
  points: Map<string, GridPoint>;
  segments: Map<string, Segment>;
  circles: Map<string, ResolvedCircle>;
}

const cloneEnv = (env: Env): Env => ({
  points: new Map(env.points),
  segments: new Map(env.segments),
  circles: new Map(env.circles),
});

export function buildGivenEnv(given: GivenFigure | undefined): Env {
  const env: Env = { points: new Map(), segments: new Map(), circles: new Map() };
  for (const p of given?.points ?? []) env.points.set(p.id, { x: p.x, y: p.y });
  for (const s of given?.segments ?? []) {
    const from = env.points.get(s.from);
    const to = env.points.get(s.to);
    if (from && to) env.segments.set(s.id, [from, to]);
  }
  for (const c of given?.circles ?? []) {
    const center = env.points.get(c.center);
    if (center) env.circles.set(c.id, { center, radius2: c.radius * c.radius });
  }
  return env;
}

const resolvePoint = (ref: PointRef, env: Env): GridPoint | null =>
  typeof ref === 'string' ? env.points.get(ref) ?? null : ref;

export const resolveSegment = (ref: SegmentRef, env: Env): Segment | null => env.segments.get(ref) ?? null;

/** Đầu còn lại của đoạn, tính từ đỉnh `v`. `null` khi `v` không phải đầu nào của đoạn. */
function otherEnd(s: Segment, v: GridPoint): GridPoint | null {
  if (samePoint(s[0], v)) return s[1];
  if (samePoint(s[1], v)) return s[0];
  return null;
}

// ---------------------------------------------------------------------------
// Kiểm từng loại điều kiện
// ---------------------------------------------------------------------------

export function checkSegment(c: SegmentConstraint, s: Segment, env: Env): boolean {
  for (const ref of c.through ?? []) {
    const p = resolvePoint(ref, env);
    if (!p || !pointOnSegment(p, s)) return false;
  }
  if (c.parallelTo !== undefined) {
    const other = resolveSegment(c.parallelTo, env);
    if (!other || !areParallel(s, other)) return false;
  }
  if (c.perpendicularTo !== undefined) {
    const other = resolveSegment(c.perpendicularTo, env);
    if (!other || !arePerpendicular(s, other)) return false;
  }
  if (c.endpointOn !== undefined) {
    const other = resolveSegment(c.endpointOn, env);
    if (!other) return false;
    if (!pointOnSegment(s[0], other) && !pointOnSegment(s[1], other)) return false;
  }
  if (c.length !== undefined && !hasLength(s, c.length)) return false;
  return true;
}

export function checkPoint(c: PointConstraint, p: GridPoint, env: Env): boolean {
  if (c.midpointOf !== undefined) {
    const s = resolveSegment(c.midpointOf, env);
    if (!s || !isMidpoint(p, s)) return false;
  }
  if (c.on !== undefined) {
    const s = resolveSegment(c.on, env);
    if (!s || !pointOnSegment(p, s)) return false;
  }
  return true;
}

function checkCircle(c: CircleConstraint, circle: ResolvedCircle, env: Env): boolean {
  if (circle.radius2 === 0) return false;
  if (c.center !== undefined) {
    const center = resolvePoint(c.center, env);
    if (!center || !samePoint(center, circle.center)) return false;
  }
  if (c.radius !== undefined && circle.radius2 !== c.radius * c.radius) return false;
  // Nhân 4 thay vì chia 2: giữ mọi phép so trong số nguyên, nên đường kính lẻ
  // (5 ô) vẫn so được chính xác.
  if (c.diameter !== undefined && 4 * circle.radius2 !== c.diameter * c.diameter) return false;
  if (c.diameterOf !== undefined) {
    const s = resolveSegment(c.diameterOf, env);
    if (!s || 4 * circle.radius2 !== segmentLength2(s)) return false;
  }
  for (const ref of c.through ?? []) {
    const p = resolvePoint(ref, env);
    if (!p || !pointOnCircle(p, circle.center, circle.radius2)) return false;
  }
  return true;
}

function checkAngle(c: AngleConstraint, rays: readonly Segment[], env: Env): boolean {
  const vertex = resolvePoint(c.at, env);
  if (!vertex) return false;

  const sides: Segment[] = [...rays];
  if (c.with !== undefined) {
    const given = resolveSegment(c.with, env);
    if (!given) return false;
    sides.push(given);
  }
  if (sides.length !== 2) return false;

  const a = otherEnd(sides[0], vertex);
  const b = otherEnd(sides[1], vertex);
  if (!a || !b) return false;
  return angleKindAt(vertex, a, b) === c.is;
}

const checkPolygons = (c: PolygonConstraint, polygons: readonly GridPoint[][]): boolean =>
  polygons.every((vertices) => polygonKinds(vertices).has(c.is));

/**
 * Đếm số nhóm `size` điểm thẳng hàng trong TOÀN BỘ điểm (cho trước + học sinh vẽ).
 *
 * Nhóm được tính theo ĐƯỜNG THẲNG, không theo tổ hợp: 4 điểm thẳng hàng là MỘT
 * nhóm, không phải bốn nhóm 3 điểm. Đếm theo tổ hợp sẽ khiến "3 nhóm mỗi nhóm 3
 * điểm" được thoả bằng cách vẽ mọi điểm lên cùng một đường.
 */
function countCollinearGroups(points: readonly GridPoint[], size: number): number {
  const lines: GridPoint[][] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (samePoint(points[i], points[j])) continue;
      const members = points.filter((p) => areCollinear([points[i], points[j], p]));
      if (members.length < size) continue;
      const known = lines.some(
        (line) =>
          line.length === members.length &&
          members.every((m) => line.some((p) => samePoint(p, m))),
      );
      if (!known) lines.push(members);
    }
  }
  return lines.length;
}

function checkCollinear(c: CollinearConstraint, given: GivenFigure | undefined, drawn: DrawnFigure): boolean {
  const all: GridPoint[] = [
    ...(given?.points ?? []).map((p) => ({ x: p.x, y: p.y })),
    ...(drawn.points ?? []),
  ];
  return countCollinearGroups(all, c.size) >= c.groups;
}

// ---------------------------------------------------------------------------
// Tìm kiếm có lùi
// ---------------------------------------------------------------------------

type Pool = 'points' | 'segments' | 'polygons' | 'circles';

/** Số hình mỗi loại mà điều kiện tiêu thụ. `subject` thì không tiêu thụ gì. */
function arity(c: GeometryConstraint): { pool: Pool; n: number } | null {
  if (c.subject !== undefined) return null;
  switch (c.kind) {
    case 'segment':
      return { pool: 'segments', n: 1 };
    case 'point':
      return { pool: 'points', n: 1 };
    case 'circle':
      return { pool: 'circles', n: 1 };
    case 'angle':
      // Không có `with`: học sinh vẽ cả hai cạnh của góc.
      return { pool: 'segments', n: c.with === undefined ? 2 : 1 };
    case 'polygon':
      return { pool: 'polygons', n: c.count ?? 1 };
    case 'collinear':
      return null;
  }
}

/** Mọi tổ hợp `n` chỉ số chưa dùng, giữ thứ tự tăng. */
function combinations(available: readonly number[], n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  const walk = (start: number, acc: number[]) => {
    if (acc.length === n) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < available.length; i += 1) {
      acc.push(available[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

export function gradeGeometryGrid(
  constraints: readonly GeometryConstraint[],
  given: GivenFigure | undefined,
  drawn: DrawnFigure | undefined,
): GeometryVerdict {
  const { isCorrect, gradable } = solveGeometryGrid(constraints, given, drawn);
  return { isCorrect, gradable };
}

/**
 * Phép gán của một bài ĐÚNG, `null` khi chưa đúng hoặc chưa chấm được. Để hiển
 * thị theo đúng cách bộ chấm đã khớp — ví dụ đặt tên điểm (`labels.ts`).
 */
export function findGeometryAssignment(
  constraints: readonly GeometryConstraint[],
  given: GivenFigure | undefined,
  drawn: DrawnFigure | undefined,
): GeometryAssignment | null {
  return solveGeometryGrid(constraints, given, drawn).assignment;
}

function solveGeometryGrid(
  constraints: readonly GeometryConstraint[],
  given: GivenFigure | undefined,
  drawn: DrawnFigure | undefined,
): GeometryVerdict & { assignment: GeometryAssignment | null } {
  const figure: DrawnFigure = drawn ?? {};
  const segments: Segment[] = (figure.segments ?? []).map((s) => [s[0], s[1]] as Segment);
  const points = figure.points ?? [];
  const polygons = figure.polygons ?? [];
  const circles: ResolvedCircle[] = (figure.circles ?? []).map((c) => ({
    center: c.center,
    radius2: circleRadius2(c.center, c.through),
  }));

  const drewNothing =
    segments.length === 0 && points.length === 0 && polygons.length === 0 && circles.length === 0;
  if (constraints.length === 0 || drewNothing) return { isCorrect: false, gradable: false, assignment: null };

  const pools: Record<Pool, number> = {
    points: points.length,
    segments: segments.length,
    polygons: polygons.length,
    circles: circles.length,
  };

  /** Phép gán trên nhánh đang thử; mỗi tầng ghi đè ô của mình khi lùi. */
  const picks: GeometryAssignment = constraints.map(() => null);

  const search = (index: number, env: Env, used: Record<Pool, Set<number>>): boolean => {
    if (index === constraints.length) return true;
    const c = constraints[index];
    const need = arity(c);

    const advance = (nextEnv: Env, nextUsed: Record<Pool, Set<number>>): boolean =>
      search(index + 1, nextEnv, nextUsed);

    // Điều kiện có `subject` áp lên hình đã gán nhãn trước đó, không tiêu thụ gì.
    if (need === null) {
      if (!checkWithoutConsuming(c, env, given, figure)) return false;
      picks[index] = null;
      return advance(env, used);
    }

    const available: number[] = [];
    for (let i = 0; i < pools[need.pool]; i += 1) {
      if (!used[need.pool].has(i)) available.push(i);
    }

    for (const picked of combinations(available, need.n)) {
      if (!checkPicked(c, picked, need.pool, env, { segments, points, polygons, circles })) continue;

      const nextEnv = cloneEnv(env);
      bindLabel(c, picked, need.pool, nextEnv, { segments, points, circles });
      const nextUsed: Record<Pool, Set<number>> = {
        points: new Set(used.points),
        segments: new Set(used.segments),
        polygons: new Set(used.polygons),
        circles: new Set(used.circles),
      };
      for (const i of picked) nextUsed[need.pool].add(i);

      picks[index] = picked;
      if (advance(nextEnv, nextUsed)) return true;
    }
    return false;
  };

  interface Bag {
    segments: Segment[];
    points: GridPoint[];
    polygons: GridPoint[][];
    circles: ResolvedCircle[];
  }

  function checkPicked(
    c: GeometryConstraint,
    picked: readonly number[],
    pool: Pool,
    env: Env,
    bag: Bag,
  ): boolean {
    switch (c.kind) {
      case 'segment':
        return checkSegment(c, bag.segments[picked[0]], env);
      case 'point':
        return checkPoint(c, bag.points[picked[0]], env);
      case 'circle':
        return checkCircle(c, bag.circles[picked[0]], env);
      case 'angle':
        return checkAngle(c, picked.map((i) => bag.segments[i]), env);
      case 'polygon':
        return checkPolygons(c, picked.map((i) => bag.polygons[i]));
      case 'collinear':
        return true;
    }
    void pool;
    return false;
  }

  function checkWithoutConsuming(
    c: GeometryConstraint,
    env: Env,
    givenFigure: GivenFigure | undefined,
    drawnFigure: DrawnFigure,
  ): boolean {
    if (c.kind === 'collinear') return checkCollinear(c, givenFigure, drawnFigure);
    const label = c.subject;
    if (label === undefined) return false;

    switch (c.kind) {
      case 'segment': {
        const s = env.segments.get(label);
        return s ? checkSegment(c, s, env) : false;
      }
      case 'point': {
        const p = env.points.get(label);
        return p ? checkPoint(c, p, env) : false;
      }
      case 'circle': {
        const circle = env.circles.get(label);
        return circle ? checkCircle(c, circle, env) : false;
      }
      case 'angle': {
        const s = env.segments.get(label);
        return s ? checkAngle(c, [s], env) : false;
      }
      case 'polygon':
        return false;
    }
  }

  function bindLabel(
    c: GeometryConstraint,
    picked: readonly number[],
    pool: Pool,
    env: Env,
    bag: Pick<Bag, 'segments' | 'points' | 'circles'>,
  ): void {
    if (c.as === undefined || picked.length !== 1) return;
    if (pool === 'segments') env.segments.set(c.as, bag.segments[picked[0]]);
    else if (pool === 'points') env.points.set(c.as, bag.points[picked[0]]);
    else if (pool === 'circles') env.circles.set(c.as, bag.circles[picked[0]]);
  }

  const isCorrect = search(0, buildGivenEnv(given), {
    points: new Set(),
    segments: new Set(),
    polygons: new Set(),
    circles: new Set(),
  });
  return { isCorrect, gradable: true, assignment: isCorrect ? [...picks] : null };
}
