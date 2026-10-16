/**
 * P78 — Geometry grid / "construct". Bài hình học vẽ trên lưới ô vuông (II.38).
 *
 * Học sinh bấm vào ĐIỂM LƯỚI để dựng hình: đặt điểm, nối đoạn, khép đa giác,
 * hoặc vẽ đường tròn (tâm rồi một điểm trên đường tròn). Việc snap vào lưới là
 * cả thiết kế: mọi toạ độ là số nguyên nên hạt nhân chấm điểm ở
 * `@/core/exercise/geometry` so được bằng số học nguyên, không dung sai.
 *
 * Khác `FreeDrawPlayer` (canvas vẽ tay, không chấm được) ở đúng chỗ đó.
 *
 * Đáp án báo lên cha là `DrawnFigure` — xem `geometry/types.ts`. Tác giả khai
 * ĐIỀU KIỆN chứ không khai đáp án, nên khối "Đáp án đúng" liệt kê lại các điều
 * kiện bằng tiếng Việt thay vì vẽ một hình mẫu (phần lớn câu có vô hạn hình đúng).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PlayerShell, useGrading, type PlayerProps } from './shared';
import { gradeGeometryGrid } from '@/core/exercise/geometry/grade';
import { placePointNames } from '@/core/exercise/geometry/labels';
import {
  ANGLE_KIND_LABELS,
  POLYGON_KIND_LABELS,
  type DrawnFigure,
  type GeometryConstraint,
  type GeometryGrid,
  type GeometryTool,
  type GivenFigure,
  type GridPoint,
  type PointRef,
} from '@/core/exercise/geometry/types';
import { cn } from '@/core/utils';

export interface GeometryGridPlayerProps extends PlayerProps {
  grid?: GeometryGrid;
  /** Công cụ mở cho học sinh. Mặc định chỉ đoạn thẳng — đủ cho phần lớn bài. */
  tools?: GeometryTool[];
  given?: GivenFigure;
  constraints?: GeometryConstraint[];
}

const CELL = 34;
const PAD = 26;
const HIT_RADIUS = 15;

const TOOL_LABELS: Record<GeometryTool, string> = {
  point: 'Điểm',
  segment: 'Đoạn thẳng',
  polygon: 'Đa giác',
  circle: 'Đường tròn',
};

const samePoint = (a: GridPoint, b: GridPoint) => a.x === b.x && a.y === b.y;

/** Diễn giải điều kiện thành tiếng Việt cho khối "Đáp án đúng". */
function describeConstraint(c: GeometryConstraint): string {
  const pointName = (ref: PointRef) => (typeof ref === 'string' ? ref : `(${ref.x}; ${ref.y})`);
  switch (c.kind) {
    case 'segment': {
      const parts: string[] = [];
      if (c.through?.length) parts.push(`đi qua ${c.through.map(pointName).join(', ')}`);
      if (c.parallelTo) parts.push(`song song với ${c.parallelTo}`);
      if (c.perpendicularTo) parts.push(`vuông góc với ${c.perpendicularTo}`);
      if (c.endpointOn) {
        parts.push(
          c.pointName ? `một đầu là điểm ${c.pointName} nằm trên ${c.endpointOn}` : `một đầu nằm trên ${c.endpointOn}`,
        );
      }
      if (c.length !== undefined) parts.push(`dài ${c.length} ô`);
      return `Một đoạn thẳng ${parts.join(', ') || 'bất kỳ'}`;
    }
    case 'point': {
      const subject = c.pointName ? `Điểm ${c.pointName}` : 'Một điểm';
      if (c.midpointOf) return `${subject} nằm chính giữa đoạn thẳng ${c.midpointOf}`;
      if (c.on) return `${subject} nằm trên ${c.on}`;
      return subject;
    }
    case 'circle': {
      const parts: string[] = [];
      if (c.center) parts.push(`tâm ${pointName(c.center)}`);
      if (c.radius !== undefined) parts.push(`bán kính ${c.radius} ô`);
      if (c.diameter !== undefined) parts.push(`đường kính ${c.diameter} ô`);
      if (c.diameterOf) parts.push(`đường kính bằng ${c.diameterOf}`);
      if (c.through?.length) parts.push(`đi qua ${c.through.map(pointName).join(', ')}`);
      return `Một đường tròn ${parts.join(', ') || 'bất kỳ'}`;
    }
    case 'angle': {
      const withPart = c.with ? ` với ${c.with}` : '';
      return `${ANGLE_KIND_LABELS[c.is]} đỉnh ${pointName(c.at)}${withPart}`;
    }
    case 'polygon': {
      const n = c.count ?? 1;
      return `${n} ${POLYGON_KIND_LABELS[c.is]}`;
    }
    case 'collinear':
      return `${c.groups} nhóm, mỗi nhóm ${c.size} điểm thẳng hàng`;
  }
}

export const GeometryGridPlayer: React.FC<GeometryGridPlayerProps> = ({
  grid = { rows: 8, cols: 10 },
  tools = ['segment'],
  given,
  constraints = [],
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted,
  selfAssessment,
  ...shell
}) => {
  // Uncontrolled sau khi mount — đúng quy ước của mọi player tương tác trong
  // repo này: hydrate một lần từ `answer`, reset bằng remount (key nonce).
  const [figure, setFigure] = useState<DrawnFigure>(() =>
    answer && typeof answer === 'object' ? (answer as DrawnFigure) : {},
  );
  const [tool, setTool] = useState<GeometryTool>(tools[0] ?? 'segment');
  /** Các đỉnh đã bấm nhưng chưa thành hình (đang vẽ dở). */
  const [pending, setPending] = useState<GridPoint[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const { report } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  const givenPoints = useMemo(() => {
    const map = new Map<string, GridPoint>();
    for (const p of given?.points ?? []) map.set(p.id, { x: p.x, y: p.y });
    return map;
  }, [given]);

  const pointLabels = useMemo(() => placePointNames(constraints, given, figure), [constraints, given, figure]);

  const toX = (x: number) => PAD + x * CELL;
  const toY = (y: number) => PAD + y * CELL;
  const width = PAD * 2 + (grid.cols - 1) * CELL;
  const height = PAD * 2 + (grid.rows - 1) * CELL;

  /**
   * Báo hình mới lên cha KÈM verdict.
   *
   * `report` không được gọi trong hàm cập nhật của setState (đã là nợ kỹ thuật
   * sẵn ở các player khác), nên `commit` nhận thẳng hình đã tính xong.
   */
  const commit = useCallback(
    (next: DrawnFigure) => {
      setFigure(next);
      if (selfAssessment) {
        report(next, 'incomplete');
        return;
      }
      const verdict = gradeGeometryGrid(constraints, given, next);
      report(next, !verdict.gradable ? 'incomplete' : verdict.isCorrect ? 'correct' : 'incorrect');
    },
    [constraints, given, report, selfAssessment],
  );

  const handleGridClick = (p: GridPoint) => {
    if (submitted) return;

    if (tool === 'point') {
      const exists = (figure.points ?? []).some((q) => samePoint(q, p));
      commit({
        ...figure,
        points: exists
          ? (figure.points ?? []).filter((q) => !samePoint(q, p))
          : [...(figure.points ?? []), p],
      });
      return;
    }

    if (tool === 'segment') {
      if (pending.length === 0) {
        setPending([p]);
        return;
      }
      const from = pending[0];
      setPending([]);
      if (samePoint(from, p)) return; // đoạn suy biến — bỏ qua, không tạo rác
      commit({ ...figure, segments: [...(figure.segments ?? []), [from, p]] });
      return;
    }

    if (tool === 'circle') {
      if (pending.length === 0) {
        setPending([p]);
        return;
      }
      const center = pending[0];
      setPending([]);
      if (samePoint(center, p)) return; // bán kính 0
      commit({ ...figure, circles: [...(figure.circles ?? []), { center, through: p }] });
      return;
    }

    // polygon: bấm lại đúng đỉnh đầu để khép hình.
    if (pending.length >= 3 && samePoint(pending[0], p)) {
      setPending([]);
      commit({ ...figure, polygons: [...(figure.polygons ?? []), pending] });
      return;
    }
    if (pending.some((q) => samePoint(q, p))) return; // đỉnh trùng
    setPending([...pending, p]);
  };

  const undo = () => {
    if (pending.length) {
      setPending(pending.slice(0, -1));
      return;
    }
    // Bỏ hình vừa vẽ của CÔNG CỤ đang chọn — trực giác hơn là bỏ hình cuối
    // cùng bất kể loại, vì học sinh đang nghĩ theo công cụ trước mắt.
    const key = (
      { point: 'points', segment: 'segments', polygon: 'polygons', circle: 'circles' } as const
    )[tool];
    const list = figure[key] ?? [];
    if (!list.length) return;
    commit({ ...figure, [key]: list.slice(0, -1) });
  };

  const clearAll = () => {
    setPending([]);
    commit({});
  };

  const drewSomething =
    (figure.points?.length ?? 0) +
      (figure.segments?.length ?? 0) +
      (figure.polygons?.length ?? 0) +
      (figure.circles?.length ?? 0) >
    0;

  const answerReveal = constraints.length ? (
    <div className="text-left">
      <p className="mb-1 font-bold">Hình vẽ phải thoả mãn:</p>
      <ul className="list-disc pl-5">
        {constraints.map((c, i) => (
          <li key={i}>{describeConstraint(c)}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm italic opacity-80">
        Mọi hình thoả mãn đủ các điều kiện trên đều được tính là đúng.
      </p>
    </div>
  ) : null;

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      <div className="flex flex-col gap-3">
        {tools.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {tools.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTool(t);
                  setPending([]);
                }}
                className={cn(
                  'rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition',
                  t === tool
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700  '
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400   ',
                )}
              >
                {TOOL_LABELS[t]}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="max-w-full rounded-2xl border-2 border-slate-200 bg-white "
            role="img"
            aria-label="Lưới ô vuông để vẽ hình"
          >
            {/* Lưới ô vuông mờ */}
            {Array.from({ length: grid.cols }).map((_, x) => (
              <line
                key={`v${x}`}
                x1={toX(x)}
                y1={toY(0)}
                x2={toX(x)}
                y2={toY(grid.rows - 1)}
                className="stroke-slate-200 "
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: grid.rows }).map((_, y) => (
              <line
                key={`h${y}`}
                x1={toX(0)}
                y1={toY(y)}
                x2={toX(grid.cols - 1)}
                y2={toY(y)}
                className="stroke-slate-200 "
                strokeWidth={1}
              />
            ))}

            {/* ── Hình CHO TRƯỚC — xám, để phân biệt rõ với hình học sinh vẽ ── */}
            {(given?.circles ?? []).map((c) => {
              const center = givenPoints.get(c.center);
              if (!center) return null;
              return (
                <circle
                  key={`gc${c.id}`}
                  cx={toX(center.x)}
                  cy={toY(center.y)}
                  r={c.radius * CELL}
                  fill="none"
                  className="stroke-slate-400 "
                  strokeWidth={2.5}
                />
              );
            })}
            {(given?.segments ?? []).map((s) => {
              const a = givenPoints.get(s.from);
              const b = givenPoints.get(s.to);
              if (!a || !b) return null;
              return (
                <line
                  key={`gs${s.id}`}
                  x1={toX(a.x)}
                  y1={toY(a.y)}
                  x2={toX(b.x)}
                  y2={toY(b.y)}
                  className="stroke-slate-500 "
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
            {(given?.points ?? []).map((p) => (
              <g key={`gp${p.id}`}>
                <circle cx={toX(p.x)} cy={toY(p.y)} r={4.5} className="fill-slate-600 " />
                <text
                  x={toX(p.x) + 8}
                  y={toY(p.y) - 8}
                  fontSize={14}
                  fontWeight={700}
                  className="fill-slate-700 "
                >
                  {p.id}
                </text>
              </g>
            ))}

            {/* ── Hình HỌC SINH vẽ — xanh ngọc ── */}
            {(figure.circles ?? []).map((c, i) => {
              const r = Math.hypot(c.through.x - c.center.x, c.through.y - c.center.y) * CELL;
              return (
                <g key={`dc${i}`}>
                  <circle
                    cx={toX(c.center.x)}
                    cy={toY(c.center.y)}
                    r={r}
                    fill="none"
                    stroke="#0d9488"
                    strokeWidth={3}
                  />
                  <circle cx={toX(c.center.x)} cy={toY(c.center.y)} r={4} fill="#0d9488" />
                </g>
              );
            })}
            {(figure.polygons ?? []).map((poly, i) => (
              <polygon
                key={`dg${i}`}
                points={poly.map((p) => `${toX(p.x)},${toY(p.y)}`).join(' ')}
                fill="#0d948820"
                stroke="#0d9488"
                strokeWidth={3}
                strokeLinejoin="round"
              />
            ))}
            {(figure.segments ?? []).map((s, i) => (
              <line
                key={`ds${i}`}
                x1={toX(s[0].x)}
                y1={toY(s[0].y)}
                x2={toX(s[1].x)}
                y2={toY(s[1].y)}
                stroke="#0d9488"
                strokeWidth={3.5}
                strokeLinecap="round"
              />
            ))}
            {(figure.points ?? []).map((p, i) => (
              <circle key={`dp${i}`} cx={toX(p.x)} cy={toY(p.y)} r={6} fill="#0d9488" />
            ))}

            {/* Tên đề đặt cho điểm học sinh tạo ra (`pointName` của điều kiện) —
                cùng kiểu chữ với nhãn điểm cho trước để đọc như một phần của hình. */}
            {pointLabels.map((l, i) => (
              <g key={`dl${i}`}>
                <circle cx={toX(l.x)} cy={toY(l.y)} r={4.5} fill="#0d9488" />
                <text
                  x={toX(l.x) + 8}
                  y={toY(l.y) - 8}
                  fontSize={14}
                  fontWeight={700}
                  className="fill-slate-700"
                >
                  {l.name}
                </text>
              </g>
            ))}

            {/* Đang vẽ dở — nét đứt để học sinh thấy mình đã bấm những đâu */}
            {pending.length > 1 && (
              <polyline
                points={pending.map((p) => `${toX(p.x)},${toY(p.y)}`).join(' ')}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={3}
                strokeDasharray="6 5"
              />
            )}
            {pending.map((p, i) => (
              <circle
                key={`pd${i}`}
                cx={toX(p.x)}
                cy={toY(p.y)}
                r={6}
                fill="#fff"
                stroke="#f59e0b"
                strokeWidth={3}
              />
            ))}

            {/* Vùng bấm — vẽ sau cùng để luôn nằm trên, bán kính rộng hơn điểm
                vẽ nên ngón tay trên máy tính bảng vẫn bắt đúng ô. */}
            {Array.from({ length: grid.rows }).flatMap((_, y) =>
              Array.from({ length: grid.cols }).map((_, x) => (
                <circle
                  key={`hit${x}-${y}`}
                  cx={toX(x)}
                  cy={toY(y)}
                  r={HIT_RADIUS}
                  fill="transparent"
                  className={submitted ? undefined : 'cursor-pointer'}
                  onClick={() => handleGridClick({ x, y })}
                />
              )),
            )}
            {/* Chấm điểm lưới, không nhận chuột để không chắn vùng bấm */}
            {Array.from({ length: grid.rows }).flatMap((_, y) =>
              Array.from({ length: grid.cols }).map((_, x) => (
                <circle
                  key={`dot${x}-${y}`}
                  cx={toX(x)}
                  cy={toY(y)}
                  r={2}
                  className="fill-slate-300 "
                  pointerEvents="none"
                />
              )),
            )}
          </svg>
        </div>

        {!submitted && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={!drewSomething && !pending.length}
              className="rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 disabled:opacity-40 "
            >
              Hoàn tác
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={!drewSomething && !pending.length}
              className="rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 disabled:opacity-40 "
            >
              Làm lại
            </button>
            {tool === 'polygon' && pending.length >= 3 && (
              <span className="text-sm text-amber-700 ">
                Bấm lại đỉnh đầu tiên để khép hình.
              </span>
            )}
            {(tool === 'segment' || tool === 'circle') && pending.length === 1 && (
              <span className="text-sm text-amber-700 ">
                {tool === 'segment' ? 'Bấm điểm thứ hai.' : 'Bấm một điểm trên đường tròn.'}
              </span>
            )}
          </div>
        )}
      </div>
    </PlayerShell>
  );
};
