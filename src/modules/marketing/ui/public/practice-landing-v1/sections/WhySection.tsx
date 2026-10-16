import { COPY } from "../copy";

const PREVIEW = [
  { skill: "Phép nhân", percent: 75 },
  { skill: "Phép chia", percent: 45 },
  { skill: "Hình học", percent: 20 },
];

export function WhySection() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-16 w-full grid md:grid-cols-2 gap-10 items-center">
      <div className="space-y-5">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
          {COPY.whyTitle}
        </h2>
        <ol className="space-y-3">
          {COPY.whySteps.map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="flex-shrink-0 inline-flex items-center justify-center size-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
                {i + 1}
              </span>
              <span className="text-sm md:text-base text-foreground/80 pt-0.5">
                {s}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div
        className="rounded-3xl border-2 border-border/80 bg-card p-6 shadow-soft"
        aria-hidden
      >
        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-4">
          BẢN ĐỒ NĂNG LỰC · TOÁN 3
        </p>
        {PREVIEW.map((r) => (
          <div
            key={r.skill}
            className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0 text-sm"
          >
            <span className="font-medium text-foreground/80">{r.skill}</span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-24 rounded-full bg-muted overflow-hidden align-middle">
                <i
                  style={{ width: `${r.percent}%` }}
                  className={`block h-full rounded-full ${
                    r.percent >= 90 ? "bg-success" : "bg-warning"
                  }`}
                />
              </span>
              <span className="font-bold text-foreground">{r.percent}%</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
