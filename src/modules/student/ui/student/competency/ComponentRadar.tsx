import type { CompetencySubjectDetail } from "@/modules/student/api/practiceApi";
import { isScored, remainingToScore } from "./insights";
import { masteryColor } from "./masteryColor";

type ComponentRow = CompetencySubjectDetail["components"][number];

/* Nhãn trục hiện ĐẦY ĐỦ tên thành tố (Owner 2026-08-15) — không cắt chữ, không
 * thay bằng tên rút gọn. Tên chương trình dài ("Tìm hiểu tự nhiên, tìm hiểu xã
 * hội") được NGẮT DÒNG theo ranh giới từ, và khung tự giãn để chứa: viewBox
 * KHÔNG còn là hằng số mà tính từ chính nhãn dài nhất / nhiều dòng nhất.
 * R giữ nguyên — chart phải giữ kích cỡ đọc được, chỉ phần lề nở ra. */
const R = 96;
/** Bán kính đặt nhãn, tính theo R. */
const LABEL_R = R * 1.28;
/** Ký tự tối đa mỗi dòng nhãn TRƯỚC khi ngắt sang dòng mới. Chỉ là ngưỡng
 * ngắt dòng — KHÔNG cắt chữ: từ dài hơn ngưỡng vẫn đứng trọn một dòng. */
const LABEL_WRAP_CHARS = 16;
const LINE_H = 11;
/** Bề rộng xấp xỉ một ký tự ở fontSize 10 (đo trên trình duyệt thật, font
 * Quicksand/Inter): dùng để ước lượng lề ngang cần chừa cho nhãn. */
const CHAR_W = 5.6;
const PAD = 12;

/** Ngắt nhãn theo RANH GIỚI TỪ, không bao giờ bỏ chữ nào. Từ dài hơn ngưỡng
 * đứng trọn một dòng (thà dòng đó rộng hơn còn hơn cắt mất chữ). */
export function wrapLabel(label: string, maxChars = LABEL_WRAP_CHARS): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line === "" ? w : `${line} ${w}`;
    if (next.length <= maxChars || line === "") {
      line = next;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

/** Khung vừa đủ cho biểu đồ + nhãn: đo nhãn dài nhất (ngang) và nhiều dòng
 * nhất (dọc) rồi cộng lề. Nhãn nào cũng hiện đủ nên khung phải chạy theo
 * nhãn, không thể là hằng số như trước. */
function frameFor(labels: string[][], hasSubLabel: boolean): {
  width: number;
  height: number;
  cx: number;
  cy: number;
} {
  const maxLineChars = Math.max(1, ...labels.flat().map((l) => l.length));
  const maxLines =
    Math.max(1, ...labels.map((ls) => ls.length)) + (hasSubLabel ? 1 : 0);
  const sideRoom = maxLineChars * CHAR_W + PAD;
  const vertRoom = maxLines * LINE_H + PAD;
  const width = 2 * (LABEL_R + sideRoom);
  const height = 2 * (LABEL_R + vertRoom);
  return { width, height, cx: width / 2, cy: height / 2 };
}

/** Dòng ĐẦU của nhãn đặt ở đâu: nhãn nửa TRÊN phải mọc NGƯỢC LÊN — để nó mọc
 * xuống thì các dòng sau đâm thẳng vào biểu đồ. Nhãn nửa dưới mọc xuống như
 * thường, nhãn ngang tầm tâm căn giữa cả khối dòng. */
function labelBaseline(y: number, cy: number, lineCount: number): number {
  const block = (lineCount - 1) * LINE_H;
  if (y < cy - R * 0.35) return y - block;
  if (y > cy + R * 0.35) return y;
  return y - block / 2;
}

/** Hình học lưới/trục dùng chung giữa radar thường và chế độ ghost — tránh
 * hai bản toán lượng giác trôi nhau khi một bên sửa mà bên kia quên. */
function radarGeometry(n: number, cx: number, cy: number) {
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number): [number, number] => [
    cx + R * (v / 100) * Math.cos(angle(i)),
    cy + R * (v / 100) * Math.sin(angle(i)),
  ];
  const ring = (v: number, count: number) =>
    Array.from({ length: count }, (_, i) => pt(i, v).join(",")).join(" ");
  const anchorFor = (i: number): "start" | "middle" | "end" => {
    const c = Math.cos(angle(i));
    if (Math.abs(c) < 0.3) return "middle";
    return c > 0 ? "start" : "end";
  };
  return { angle, pt, ring, anchorFor };
}

/** Lưới đồng tâm + trục (spokes) — nền dùng chung cho radar thường và ghost. */
function RadarGrid({
  n,
  pt,
  ring,
  cx,
  cy,
}: {
  n: number;
  pt: (i: number, v: number) => [number, number];
  ring: (v: number, count: number) => string;
  cx: number;
  cy: number;
}) {
  return (
    <>
      {[25, 50, 100].map((v) => (
        <polygon
          key={v}
          points={ring(v, n)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.12}
        />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = pt(i, 100);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeOpacity={0.12}
          />
        );
      })}
    </>
  );
}

/**
 * Khối C — Chân dung năng lực theo thành tố (spec §4). Radar TỰ VẼ (SVG) vì
 * cần: vùng tô NGẮT tại trục chưa luyện (recharts nối liền — lỗi trung tâm
 * của bản cũ), chấm rỗng "Chưa luyện", <3 trục có điểm thì bỏ radar, 0 trục
 * có điểm thì "ghost" (chỉ khung, mời làm bài).
 */
export function ComponentRadar({
  components,
  targetPercent,
}: {
  components: ComponentRow[];
  targetPercent: number;
}) {
  if (components.length === 0) return null;

  // Điều kiện vẽ radar là SỐ TRỤC (đa giác cần >= 3 đỉnh), KHÔNG phải số trục đã
  // có điểm: năng lực chưa luyện vẫn là một trục hợp lệ (chấm rỗng, không tô).
  // Trước đây chặn theo `scoredCount < 3` nên màn hình rơi về thanh ngang khi mới
  // luyện 1–2 năng lực — trong khi 0 năng lực lại vẽ radar ghost, một hình chữ U
  // vô lý. Vùng tô đã xử lý an toàn cụm ngắn (run 1 trục không sinh path).
  if (components.length < 3) return <ComponentBars components={components} />;

  const scoredCount = components.filter((c) => isScored(c.attempted)).length;
  if (scoredCount === 0)
    return (
      <ComponentRadarGhost
        components={components}
        targetPercent={targetPercent}
      />
    );

  const n = components.length;
  const labelLines = components.map((c) => wrapLabel(c.label));
  const hasUnscored = components.some((c) => !isScored(c.attempted));
  const { width, height, cx, cy } = frameFor(labelLines, hasUnscored);
  const { angle, pt, ring, anchorFor } = radarGeometry(n, cx, cy);

  // Vùng tô: các "quạt" qua tâm cho từng cụm trục-có-điểm LIỀN KỀ (vòng tròn),
  // để lại khoảng hở tại trục chưa luyện.
  const scored = components.map((c) => isScored(c.attempted));
  const runs: number[][] = [];
  if (scored.every(Boolean)) {
    runs.push(components.map((_, i) => i));
  } else {
    let run: number[] = [];
    // duyệt vòng bắt đầu từ sau một trục chưa-điểm để nối run vắt qua điểm 0
    const start = scored.findIndex((s) => !s);
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n;
      if (scored[i]) {
        run.push(i);
      } else if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length > 0) runs.push(run);
  }

  return (
    <div>
      <svg
        data-testid="radar-svg"
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto w-full max-w-[420px]"
      >
        <RadarGrid n={n} pt={pt} ring={ring} cx={cx} cy={cy} />
        {/* mục tiêu — nét đứt */}
        <polygon
          points={ring(targetPercent, n)}
          fill="none"
          stroke="var(--success, #10b981)"
          strokeDasharray="4 4"
        />
        {/* vùng tô ngắt theo run */}
        {runs.map((run, idx) => {
          const d =
            run.length === 1
              ? null
              : `M ${cx} ${cy} L ${run.map((i) => pt(i, Math.max(components[i].percent, 2)).join(" ")).join(" L ")} Z`;
          return d ? (
            <path
              key={idx}
              data-testid={`radar-fill-${idx}`}
              data-axes={run.join(",")}
              d={d}
              fill="var(--primary)"
              fillOpacity={0.35}
              stroke="var(--primary)"
            />
          ) : null;
        })}
        {/* chấm dữ liệu + chấm rỗng */}
        {components.map((c, i) => {
          if (isScored(c.attempted)) {
            const [x, y] = pt(i, Math.max(c.percent, 2));
            return (
              <circle
                key={c.code}
                cx={x}
                cy={y}
                r={3.5}
                fill={masteryColor(c.percent).hex}
              >
                <title>{`${c.label}: ${Math.round(c.percent)}% (${c.attempted} câu)`}</title>
              </circle>
            );
          }
          const [x, y] = pt(i, 100);
          return (
            <circle
              key={c.code}
              data-testid="radar-hollow-dot"
              cx={x}
              cy={y}
              r={4}
              fill="var(--card, #fff)"
              stroke="#9ca3af"
              strokeWidth={1.5}
            >
              <title>{`${c.label}: chưa luyện — còn ${remainingToScore(c.attempted)} câu để đánh giá`}</title>
            </circle>
          );
        })}
        {/* nhãn trục — tên ĐẦY ĐỦ, ngắt dòng theo từ */}
        {components.map((c, i) => {
          const [x, y] = pt(i, 128);
          const unscored = !isScored(c.attempted);
          const anchor = anchorFor(i);
          const lines = labelLines[i];
          return (
            <text
              key={c.code}
              x={x}
              y={labelBaseline(y, cy, lines.length)}
              textAnchor={anchor}
              fontSize={10}
              fill={unscored ? "#9ca3af" : "currentColor"}
            >
              <title>{c.label}</title>
              {lines.map((line, li) => (
                <tspan key={li} x={x} dy={li === 0 ? 0 : LINE_H}>
                  {line}
                </tspan>
              ))}
              {unscored && (
                <tspan x={x} dy={LINE_H} fontSize={9} fill="#9ca3af">
                  {"Chưa luyện"}
                </tspan>
              )}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Chế độ "ghost": 0 thành tố có điểm — chưa có gì để tô. Chỉ vẽ khung (lưới +
 * trục + đa giác mục tiêu mờ + chấm rỗng ở MỌI trục + nhãn xám) để học sinh
 * biết trước "bức tranh" sẽ trông ra sao, mời làm bài để tô kín. KHÔNG vùng
 * tô, không chấm màu, không %, và KHÔNG lặp "Chưa luyện" ở từng trục (sẽ
 * thành nhiễu vì trục nào cũng vậy) — dùng một caption chung bên dưới.
 */
function ComponentRadarGhost({
  components,
  targetPercent,
}: {
  components: ComponentRow[];
  targetPercent: number;
}) {
  const n = components.length;
  const labelLines = components.map((c) => wrapLabel(c.label));
  const { width, height, cx, cy } = frameFor(labelLines, false);
  const { pt, ring, anchorFor } = radarGeometry(n, cx, cy);

  return (
    <div>
      <svg
        data-testid="radar-svg"
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto w-full max-w-[420px]"
      >
        <RadarGrid n={n} pt={pt} ring={ring} cx={cx} cy={cy} />
        {/* mục tiêu — nét đứt, mờ hơn radar thường vì chưa có dữ liệu để so */}
        <polygon
          points={ring(targetPercent, n)}
          fill="none"
          stroke="var(--success, #10b981)"
          strokeOpacity={0.4}
          strokeDasharray="4 4"
        />
        {/* chấm rỗng ở MỌI trục — chưa thành tố nào có điểm */}
        {components.map((c, i) => {
          const [x, y] = pt(i, 100);
          return (
            <circle
              key={c.code}
              data-testid="radar-hollow-dot"
              cx={x}
              cy={y}
              r={4}
              fill="var(--card, #fff)"
              stroke="#9ca3af"
              strokeWidth={1.5}
            >
              <title>{`${c.label}: chưa luyện`}</title>
            </circle>
          );
        })}
        {/* nhãn trục — xám, không sub-label để tránh lặp "Chưa luyện" trên mọi trục */}
        {components.map((c, i) => {
          const [x, y] = pt(i, 128);
          const anchor = anchorFor(i);
          const lines = labelLines[i];
          return (
            <text
              key={c.code}
              x={x}
              y={labelBaseline(y, cy, lines.length)}
              textAnchor={anchor}
              fontSize={10}
              fill="#9ca3af"
            >
              <title>{c.label}</title>
              {lines.map((line, li) => (
                <tspan key={li} x={x} dy={li === 0 ? 0 : LINE_H}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
      <p className="text-xs text-muted-foreground text-center mt-1">
        {
          "Đây là các thành tố năng lực em sẽ được đo. Làm bài để tô kín biểu đồ này nhé!"
        }
      </p>
    </div>
  );
}

/** Fallback khi <3 trục có điểm: thanh ngang, radar 2 trục chỉ là một đường thẳng. */
function ComponentBars({ components }: { components: ComponentRow[] }) {
  return (
    <div className="space-y-2">
      {components.map((c) => {
        const scored = isScored(c.attempted);
        const color = masteryColor(scored ? c.percent : null);
        return (
          <div
            key={c.code}
            data-testid="component-bar-row"
            /* Mobile: 2 cột × 2 hàng — nhãn+giá trị ở hàng trên (nhãn được cả
               phần rộng còn lại, không phải cột hẹp cố định), track xuống
               hàng dưới chiếm trọn bề ngang. Desktop: về lại 3 cột 1 hàng như
               cũ bằng col/row-start tường minh (không đổi thứ tự DOM, mỗi
               data-testid vẫn đúng một phần tử). */
            className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-x-2 gap-y-1 sm:gap-2"
          >
            {/* Tên ĐẦY ĐỦ (Owner 2026-08-15): xuống dòng trong cột thay vì cắt
                bằng `truncate` — hàng tự cao lên, không mất chữ nào. */}
            <div
              className="col-start-1 row-start-1 sm:col-start-1 min-w-0 text-xs leading-snug break-words"
              title={c.label}
            >
              {c.label}
            </div>
            <div
              className="col-start-2 row-start-1 sm:col-start-3 text-right text-xs font-bold whitespace-nowrap"
              style={{ color: color.hex }}
            >
              {scored ? `${Math.round(c.percent)}%` : ""}
            </div>
            <div className="col-start-1 col-span-2 row-start-2 sm:col-start-2 sm:col-span-1 sm:row-start-1 relative h-4 rounded bg-muted/60 overflow-hidden">
              {scored ? (
                <div
                  className="absolute inset-y-0 left-0 rounded"
                  style={{ width: `${c.percent}%`, backgroundColor: color.hex }}
                />
              ) : c.attempted === 0 ? (
                <span className="absolute inset-0 flex items-center px-2 text-[10px] leading-none whitespace-nowrap text-muted-foreground">
                  {"Chưa luyện"}
                </span>
              ) : (
                <>
                  {/* Mobile: bản rút gọn tránh xuống dòng khi track hẹp; desktop: câu đầy đủ. */}
                  <span className="sm:hidden absolute inset-0 flex items-center px-1.5 text-[9px] leading-none whitespace-nowrap text-muted-foreground">
                    {`Còn ${remainingToScore(c.attempted)} câu nữa`}
                  </span>
                  <span className="hidden sm:flex absolute inset-0 items-center px-2 text-[10px] leading-none whitespace-nowrap text-muted-foreground">
                    {`Còn ${remainingToScore(c.attempted)} câu nữa để đánh giá`}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground mt-1">
        {
          "Luyện thêm để mở biểu đồ chân dung năng lực (cần 3 thành tố có kết quả)."
        }
      </p>
    </div>
  );
}
