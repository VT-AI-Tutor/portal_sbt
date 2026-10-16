/**
 * P79 — Chart build / "plot". Bài DỰNG biểu đồ (II.39).
 *
 * Học sinh bấm vào vạch trục để đặt giá trị cho từng hạng mục: cột cao tới đó, hoặc
 * điểm nằm ở đó rồi nối thành đường.
 *
 * Phân biệt với biểu đồ dạng ĐỀ BÀI: 5 câu biểu đồ đang chạy trong kho sách đều đưa
 * biểu đồ vào như một ảnh và học sinh trả lời bằng `cloze`/`table_completion` — cách
 * đó vẫn dùng tiếp, không cần loại câu này. Loại này là chiều ngược lại: học sinh tự
 * dựng biểu đồ từ số liệu.
 *
 * Giá trị snap vào vạch nên đáp án là số rời rạc, và luật chấm nằm ở
 * `@/core/exercise/chart/grade` — dùng chung với `grading.ts` và bản PHP.
 */
import React, { useCallback, useState } from 'react';
import { PlayerShell, useGrading, type PlayerProps } from './shared';
import { gradeChartBuild } from '@/core/exercise/chart/grade';
import type { ChartAnswer, ChartSpec } from '@/core/exercise/chart/types';
import { cn } from '@/core/utils';

export interface ChartBuildPlayerProps extends PlayerProps {
  chart?: ChartSpec;
  correctValues?: ChartAnswer;
  /** Dung sai theo đơn vị trục dọc. Mặc định 0. */
  tolerance?: number;
}

const COL_W = 58;
const ROW_H = 26;
const PAD_LEFT = 44;
const PAD_TOP = 18;
const PAD_BOTTOM = 34;

const DEFAULT_CHART: ChartSpec = {
  kind: 'bar',
  categories: [
    { id: 'c1', label: 'A' },
    { id: 'c2', label: 'B' },
  ],
  yMax: 10,
};

/** Bỏ số 0 thừa ở cuối: 2.50 → 2,5 · 3.00 → 3. Dấu phẩy thập phân theo tiếng Việt. */
const fmt = (n: number) => String(Number(n.toFixed(2))).replace('.', ',');

export const ChartBuildPlayer: React.FC<ChartBuildPlayerProps> = ({
  chart = DEFAULT_CHART,
  correctValues,
  tolerance = 0,
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted,
  selfAssessment,
  ...shell
}) => {
  // Uncontrolled sau khi mount — quy ước chung của mọi player tương tác ở repo này.
  const [values, setValues] = useState<ChartAnswer>(() =>
    answer && typeof answer === 'object' ? ({ ...(answer as ChartAnswer) }) : {},
  );
  const { report } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  const step = chart.yStep && chart.yStep > 0 ? chart.yStep : 1;
  const levels = Math.max(1, Math.round(chart.yMax / step));
  const categories = chart.categories?.length ? chart.categories : DEFAULT_CHART.categories;

  const plotW = categories.length * COL_W;
  const plotH = levels * ROW_H;
  const width = PAD_LEFT + plotW + 16;
  const height = PAD_TOP + plotH + PAD_BOTTOM;

  const xOf = (i: number) => PAD_LEFT + i * COL_W;
  const cxOf = (i: number) => xOf(i) + COL_W / 2;
  const yOf = (value: number) => PAD_TOP + plotH - (value / step) * ROW_H;

  const commit = useCallback(
    (next: ChartAnswer) => {
      setValues(next);
      if (selfAssessment) {
        report(next, 'incomplete');
        return;
      }
      const verdict = gradeChartBuild(correctValues, next, tolerance);
      report(next, !verdict.gradable ? 'incomplete' : verdict.isCorrect ? 'correct' : 'incorrect');
    },
    [correctValues, report, selfAssessment, tolerance],
  );

  const setOne = (id: string, value: number) => {
    if (submitted) return;
    // Bấm lại đúng mức đang có = bỏ đặt. Không có nó thì học sinh đặt sai một cột
    // là mắc kẹt, vì mọi mức đều là một giá trị hợp lệ nên không thể "xoá".
    const next = { ...values };
    if (next[id] === value) delete next[id];
    else next[id] = value;
    commit(next);
  };

  const placed = categories.filter((c) => values[c.id] !== undefined);

  const answerReveal = correctValues
    ? (
      <div className="text-left">
        <p className="mb-1 font-bold">Giá trị đúng:</p>
        <ul className="list-disc pl-5">
          {categories.map((c) => (
            <li key={c.id}>
              {c.label}: <b>{correctValues[c.id] !== undefined ? fmt(correctValues[c.id]) : '—'}</b>
              {chart.yLabel ? ` ${chart.yLabel.toLowerCase()}` : ''}
            </li>
          ))}
        </ul>
      </div>
    )
    : null;

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      <div className="flex flex-col gap-3">
        {chart.yLabel && (
          <div className="text-xs font-bold text-slate-600 ">{chart.yLabel}</div>
        )}

        <div className="overflow-x-auto">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="max-w-full rounded-2xl border-2 border-slate-200 bg-white "
            role="img"
            aria-label={`Biểu đồ để dựng — ${categories.length} hạng mục`}
          >
            {/* Vạch ngang + số trục dọc */}
            {Array.from({ length: levels + 1 }).map((_, k) => {
              const value = k * step;
              return (
                <g key={`lv${k}`}>
                  <line
                    x1={PAD_LEFT}
                    y1={yOf(value)}
                    x2={PAD_LEFT + plotW}
                    y2={yOf(value)}
                    className="stroke-slate-200 "
                    strokeWidth={1}
                  />
                  <text
                    x={PAD_LEFT - 8}
                    y={yOf(value) + 4}
                    fontSize={11}
                    textAnchor="end"
                    className="fill-slate-500 "
                  >
                    {fmt(value)}
                  </text>
                </g>
              );
            })}

            {/* Trục */}
            <line
              x1={PAD_LEFT}
              y1={PAD_TOP}
              x2={PAD_LEFT}
              y2={PAD_TOP + plotH}
              className="stroke-slate-400 "
              strokeWidth={2}
            />
            <line
              x1={PAD_LEFT}
              y1={PAD_TOP + plotH}
              x2={PAD_LEFT + plotW}
              y2={PAD_TOP + plotH}
              className="stroke-slate-400 "
              strokeWidth={2}
            />

            {/* Cột đã đặt */}
            {chart.kind === 'bar' &&
              categories.map((c, i) => {
                const v = values[c.id];
                if (v === undefined) return null;
                const top = yOf(v);
                return (
                  <g key={`bar${c.id}`}>
                    <rect
                      x={xOf(i) + 10}
                      y={top}
                      width={COL_W - 20}
                      height={PAD_TOP + plotH - top}
                      rx={3}
                      className="fill-sky-500/80"
                    />
                    <text
                      x={cxOf(i)}
                      y={top - 5}
                      fontSize={11}
                      fontWeight={700}
                      textAnchor="middle"
                      className="fill-sky-700 "
                    >
                      {fmt(v)}
                    </text>
                  </g>
                );
              })}

            {/* Đường nối các điểm đã đặt — chỉ nối những hạng mục LIỀN NHAU đã có
                giá trị, để đường không nhảy qua chỗ học sinh chưa làm. */}
            {chart.kind === 'line' &&
              (() => {
                const runs: { i: number; v: number }[][] = [];
                let run: { i: number; v: number }[] = [];
                categories.forEach((c, i) => {
                  const v = values[c.id];
                  if (v === undefined) {
                    if (run.length) runs.push(run);
                    run = [];
                  } else run.push({ i, v });
                });
                if (run.length) runs.push(run);
                return runs
                  .filter((r) => r.length > 1)
                  .map((r, k) => (
                    <polyline
                      key={`run${k}`}
                      points={r.map((p) => `${cxOf(p.i)},${yOf(p.v)}`).join(' ')}
                      fill="none"
                      className="stroke-sky-500"
                      strokeWidth={3}
                      strokeLinejoin="round"
                    />
                  ));
              })()}

            {chart.kind === 'line' &&
              categories.map((c, i) => {
                const v = values[c.id];
                if (v === undefined) return null;
                return (
                  <g key={`pt${c.id}`}>
                    <circle cx={cxOf(i)} cy={yOf(v)} r={5} className="fill-sky-500" />
                    <text
                      x={cxOf(i)}
                      y={yOf(v) - 10}
                      fontSize={11}
                      fontWeight={700}
                      textAnchor="middle"
                      className="fill-sky-700 "
                    >
                      {fmt(v)}
                    </text>
                  </g>
                );
              })}

            {/* Nhãn trục ngang */}
            {categories.map((c, i) => (
              <text
                key={`lbl${c.id}`}
                x={cxOf(i)}
                y={PAD_TOP + plotH + 18}
                fontSize={12}
                fontWeight={600}
                textAnchor="middle"
                className="fill-slate-700 "
              >
                {c.label}
              </text>
            ))}

            {/* Vùng bấm — vẽ sau cùng để nằm trên, một ô cho mỗi (hạng mục × mức) */}
            {!submitted &&
              categories.flatMap((c, i) =>
                Array.from({ length: levels + 1 }).map((_, k) => {
                  const value = k * step;
                  return (
                    <rect
                      key={`hit${c.id}-${k}`}
                      x={xOf(i)}
                      y={yOf(value) - ROW_H / 2}
                      width={COL_W}
                      height={ROW_H}
                      fill="transparent"
                      className="cursor-pointer"
                      onClick={() => setOne(c.id, value)}
                    >
                      <title>{`${c.label} = ${fmt(value)}`}</title>
                    </rect>
                  );
                }),
              )}
          </svg>
        </div>

        {chart.xLabel && (
          <div className="text-center text-xs font-bold text-slate-600 ">
            {chart.xLabel}
          </div>
        )}

        {!submitted && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => commit({})}
              disabled={placed.length === 0}
              className="rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 disabled:opacity-40 "
            >
              Làm lại
            </button>
            <span className={cn('text-sm', placed.length === categories.length
              ? 'text-emerald-700 '
              : 'text-amber-700 ')}>
              {placed.length === categories.length
                ? 'Đã đặt đủ các cột.'
                : `Đã đặt ${placed.length}/${categories.length} — bấm vào vạch để đặt giá trị.`}
            </span>
          </div>
        )}
      </div>
    </PlayerShell>
  );
};
