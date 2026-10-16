import { useMemo } from "react";
import type { ActivityDay } from "@/modules/student/api/practiceApi";

/**
 * GitHub-style contribution heatmap of daily practice activity. Renders one
 * column per ISO week (Sunday-start) and one cell per day, coloured by the
 * number of questions attempted that day. Theme-safe: cell colour is
 * `--success` mixed against the card background at increasing opacity.
 */

const WEEKDAY_LABELS = ["", "T2", "", "T4", "", "T6", ""]; // Mon/Wed/Fri, Sunday-start rows offset
const MONTH_LABELS = [
  "Th1", "Th2", "Th3", "Th4", "Th5", "Th6",
  "Th7", "Th8", "Th9", "Th10", "Th11", "Th12",
];

const CELL = 13; // px including gap
const SIZE = 11; // px cell square

interface Cell {
  date: string;
  attempted: number;
  correct: number;
  level: number; // 0..4
}

function bucket(attempted: number, max: number): number {
  if (attempted <= 0) return 0;
  if (max <= 0) return 1;
  const ratio = attempted / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function levelColor(level: number): string {
  if (level === 0) return "var(--muted)";
  // 1..4 -> 30%..100% of the success colour mixed over the card background
  const pct = [0, 28, 50, 74, 100][level];
  return `color-mix(in oklab, var(--success) ${pct}%, var(--card))`;
}

function formatDay(date: string): string {
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

export function ContributionHeatmap({
  days,
  maxDayCount,
}: {
  days: ActivityDay[];
  maxDayCount: number;
}) {
  const { weeks, monthTicks } = useMemo(() => {
    const cells: Cell[] = days.map((d) => ({
      date: d.date,
      attempted: d.attempted,
      correct: d.correct,
      level: bucket(d.attempted, maxDayCount),
    }));

    // Pad the front so the first real day lands in its correct weekday row
    // (0 = Sunday). Padding cells are null and rendered empty.
    const first = cells[0];
    const lead = first ? new Date(`${first.date}T00:00:00`).getDay() : 0;
    const padded: (Cell | null)[] = [
      ...Array.from({ length: lead }, () => null),
      ...cells,
    ];

    const weeks: (Cell | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7));
    }

    // Month label ticks: first week column whose first real day is in a new month.
    const monthTicks: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      const firstReal = week.find((c): c is Cell => c !== null);
      if (!firstReal) return;
      const m = new Date(`${firstReal.date}T00:00:00`).getMonth();
      if (m !== lastMonth) {
        monthTicks.push({ col, label: MONTH_LABELS[m] });
        lastMonth = m;
      }
    });

    return { weeks, monthTicks };
  }, [days, maxDayCount]);

  const width = weeks.length * CELL + 30;
  const height = 7 * CELL + 20;

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Biểu đồ hoạt động luyện tập theo ngày"
        className="min-w-full"
      >
        {/* Month labels */}
        {monthTicks.map((t) => (
          <text
            key={`${t.col}-${t.label}`}
            x={30 + t.col * CELL}
            y={10}
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            {t.label}
          </text>
        ))}

        {/* Weekday labels */}
        {WEEKDAY_LABELS.map((label, row) =>
          label ? (
            <text
              key={row}
              x={0}
              y={20 + row * CELL + SIZE - 1}
              className="fill-muted-foreground"
              style={{ fontSize: 9 }}
            >
              {label}
            </text>
          ) : null,
        )}

        {/* Cells */}
        {weeks.map((week, col) =>
          week.map((cell, row) => {
            if (!cell) return null;
            return (
              <rect
                key={cell.date}
                x={30 + col * CELL}
                y={20 + row * CELL}
                width={SIZE}
                height={SIZE}
                rx={2.5}
                fill={levelColor(cell.level)}
                stroke="var(--border)"
                strokeWidth={cell.level === 0 ? 0.5 : 0}
              >
                <title>
                  {cell.attempted > 0
                    ? `${cell.attempted} câu (${cell.correct} đúng) · ${formatDay(cell.date)}`
                    : `Không luyện tập · ${formatDay(cell.date)}`}
                </title>
              </rect>
            );
          }),
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
        <span>Ít</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            className="inline-block rounded-[2.5px]"
            style={{
              width: SIZE,
              height: SIZE,
              backgroundColor: levelColor(lvl),
              border: lvl === 0 ? "0.5px solid var(--border)" : "none",
            }}
          />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  );
}
