/**
 * Đặt tên đề bài (`pointName` của điều kiện) lên điểm học sinh tạo ra.
 *
 * Chỉ để HIỂN THỊ: học sinh vẽ xong thì thấy chữ K ngay chỗ đoạn mình vẽ chạm PQ,
 * đối chiếu được với đề "điểm K nằm trên PQ". Không tham gia chấm.
 *
 * Hai chế độ:
 * - Bài ĐÚNG: tên theo đúng phép gán bộ chấm đã tìm ra. Nếu đặt tên theo cách
 *   riêng thì có thể lệch với cách chấm: điều kiện lỏng "một đầu trên PQ" khai
 *   trước sẽ chiếm mất đoạn NK đúng, và K rơi sang đoạn khác dù bài được chấm đúng.
 * - Bài CHƯA ĐÚNG: tên theo VỊ TRÍ — hình nào rơi đúng chỗ (chạm `endpointOn`,
 *   nằm trên `on`…) là có tên, không chờ cả bài đúng. Nhiều hình cùng rơi đúng chỗ
 *   thì hình thoả ĐỦ điều kiện được ưu tiên, rồi mới đến thứ tự vẽ. Tên vì thế
 *   hiện như nhau dù hình đúng hay sai, không tiết lộ phần còn lại của đáp án.
 *
 * Ở cả hai chế độ, mỗi điều kiện đặt đúng MỘT tên và mỗi hình mang nhiều nhất một
 * tên — cùng tính độc quyền với bộ chấm.
 */

import {
  buildGivenEnv,
  checkPoint,
  checkSegment,
  findGeometryAssignment,
  resolveSegment,
  type Env,
  type GeometryAssignment,
} from './grade';
import { pointOnSegment, type Segment } from './predicates';
import type {
  DrawnFigure,
  GeometryConstraint,
  GivenFigure,
  GridPoint,
  PointConstraint,
  SegmentConstraint,
} from './types';

/** Toạ độ theo ô lưới; giao điểm có thể rơi giữa hai điểm lưới nên không nguyên. */
export interface PlacedPointLabel {
  name: string;
  x: number;
  y: number;
}

/** Hình học sinh vẽ cùng môi trường tên của hình cho trước. */
interface Scene {
  env: Env;
  segments: Segment[];
  points: GridPoint[];
}

const cross = (ux: number, uy: number, vx: number, vy: number): number => ux * vy - uy * vx;

/**
 * Điểm chung DUY NHẤT của đoạn học sinh vẽ với đoạn đích, gồm cả trường hợp chạm
 * ở đầu mút. Hai đoạn cùng phương thì `null`: học sinh vẽ chồng lên PQ thì không
 * có một điểm nào đáng gọi là K.
 */
function crossingPoint(s: Segment, target: Segment): { x: number; y: number } | null {
  const [a, b] = s;
  const [c, d] = target;
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const qx = d.x - c.x;
  const qy = d.y - c.y;
  let denom = cross(rx, ry, qx, qy);
  if (denom === 0) return null;
  let tNum = cross(c.x - a.x, c.y - a.y, qx, qy);
  let uNum = cross(c.x - a.x, c.y - a.y, rx, ry);
  if (denom < 0) {
    denom = -denom;
    tNum = -tNum;
    uNum = -uNum;
  }
  // So trên tử số nguyên, không chia trước — giữ phép kiểm "có cắt không" chính xác.
  if (tNum < 0 || tNum > denom || uNum < 0 || uNum > denom) return null;
  return { x: a.x + (rx * tNum) / denom, y: a.y + (ry * tNum) / denom };
}

/** Điểm P, Q đã có tên của đề — đè thêm K lên đó chỉ làm rối. */
const takenByGiven = (scene: Scene, x: number, y: number): boolean =>
  [...scene.env.points.values()].some((p) => p.x === x && p.y === y);

/** Tên đặt được cho điều kiện này, hoặc `undefined` khi điều kiện không đặt tên. */
function nameOf(c: GeometryConstraint): string | undefined {
  if (c.kind !== 'segment' && c.kind !== 'point') return undefined;
  // `subject` áp lên hình đã có — điều kiện gốc của hình đó mới là chỗ đặt tên.
  if (c.subject !== undefined) return undefined;
  return c.pointName?.trim() || undefined;
}

/** Chỗ đoạn `s` chạm `endpointOn` của điều kiện, nếu đặt tên được ở đó. */
function segmentHit(c: SegmentConstraint, s: Segment, scene: Scene): { x: number; y: number } | null {
  // Chỉ hình cho trước: nhãn `as` của hình học sinh vẽ không có trong `env`.
  const target = c.endpointOn !== undefined ? resolveSegment(c.endpointOn, scene.env) : null;
  const hit = target ? crossingPoint(s, target) : null;
  return hit && !takenByGiven(scene, hit.x, hit.y) ? hit : null;
}

/** Điểm `p` có nằm đúng chỗ điều kiện khai (trên `on` / `midpointOf`) không. */
function pointFits(c: PointConstraint, p: GridPoint, scene: Scene): boolean {
  if (takenByGiven(scene, p.x, p.y)) return false;
  const ref = c.on ?? c.midpointOf;
  if (ref === undefined) return true;
  const target = resolveSegment(ref, scene.env);
  return target !== null && pointOnSegment(p, target);
}

function namesFromAssignment(
  constraints: readonly GeometryConstraint[],
  assignment: GeometryAssignment,
  scene: Scene,
): PlacedPointLabel[] {
  const out: PlacedPointLabel[] = [];
  constraints.forEach((c, i) => {
    const name = nameOf(c);
    const picked = assignment[i];
    if (!name || !picked?.length) return;
    if (c.kind === 'segment') {
      const hit = segmentHit(c, scene.segments[picked[0]], scene);
      if (hit) out.push({ name, ...hit });
    } else if (c.kind === 'point') {
      const p = scene.points[picked[0]];
      if (pointFits(c, p, scene)) out.push({ name, x: p.x, y: p.y });
    }
  });
  return out;
}

function namesByPosition(constraints: readonly GeometryConstraint[], scene: Scene): PlacedPointLabel[] {
  const usedSegments = new Set<number>();
  const usedPoints = new Set<number>();
  const out: PlacedPointLabel[] = [];

  for (const c of constraints) {
    const name = nameOf(c);
    if (!name) continue;

    if (c.kind === 'segment') {
      const candidates = scene.segments.flatMap((s, i) => {
        const hit = usedSegments.has(i) ? null : segmentHit(c, s, scene);
        return hit ? [{ i, hit }] : [];
      });
      const pick = candidates.find(({ i }) => checkSegment(c, scene.segments[i], scene.env)) ?? candidates[0];
      if (!pick) continue;
      usedSegments.add(pick.i);
      out.push({ name, ...pick.hit });
    } else if (c.kind === 'point') {
      const candidates = scene.points.flatMap((p, i) => (!usedPoints.has(i) && pointFits(c, p, scene) ? [i] : []));
      const pick = candidates.find((i) => checkPoint(c, scene.points[i], scene.env)) ?? candidates[0];
      if (pick === undefined) continue;
      usedPoints.add(pick);
      out.push({ name, x: scene.points[pick].x, y: scene.points[pick].y });
    }
  }
  return out;
}

export function placePointNames(
  constraints: readonly GeometryConstraint[],
  given: GivenFigure | undefined,
  drawn: DrawnFigure | undefined,
): PlacedPointLabel[] {
  if (!drawn || !constraints.some((c) => nameOf(c))) return [];
  const scene: Scene = {
    env: buildGivenEnv(given),
    segments: (drawn.segments ?? []).map((s) => [s[0], s[1]]),
    points: drawn.points ?? [],
  };
  const assignment = findGeometryAssignment(constraints, given, drawn);
  return assignment ? namesFromAssignment(constraints, assignment, scene) : namesByPosition(constraints, scene);
}
