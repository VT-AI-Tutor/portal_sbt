import { COPY } from "../copy";
import { DemoWidget } from "../demo/DemoWidget";
import type { DemoSet } from "../demo/demoSets";

interface HeroSectionProps {
  demoSet: DemoSet;
  levelPicker: React.ReactNode; // select Lớp (Task 6 cung cấp)
  subjectPicker: React.ReactNode; // select Môn (Task 6 cung cấp)
  onTrialClick: () => void;
  onRegisterClick: () => void;
  onDemoStart: () => void;
  onDemoComplete: (correctCount: number) => void;
}

export function HeroSection(p: HeroSectionProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 pt-10 pb-16 w-full grid md:grid-cols-2 gap-10 items-center">
      <div className="space-y-5">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
          {COPY.heroBadge}
        </span>
        <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
          {COPY.heroTitle}
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          {COPY.heroSubtitle}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {p.levelPicker}
          {p.subjectPicker}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft transition hover:opacity-90 cursor-pointer"
            onClick={() =>
              document
                .getElementById("demo-widget")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            {COPY.heroCta}
          </button>
        </div>
        <p className="text-xs font-bold text-muted-foreground">
          {COPY.heroCtaNote}
        </p>
        <div className="flex flex-wrap gap-2">
          {COPY.heroChips.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full border-2 border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
      <div id="demo-widget">
        <DemoWidget
          set={p.demoSet}
          onDemoStart={p.onDemoStart}
          onDemoComplete={p.onDemoComplete}
          onTrialClick={p.onTrialClick}
          onRegisterClick={p.onRegisterClick}
        />
      </div>
    </section>
  );
}
