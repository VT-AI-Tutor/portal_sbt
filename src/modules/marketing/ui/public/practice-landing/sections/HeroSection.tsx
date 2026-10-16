import {
  ArrowRight,
  BookOpen,
  Brain,
  CirclePlay,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { COPY } from "../copy";
import { DemoWidget } from "../demo/DemoWidget";
import type { DemoSet } from "../demo/demoSets";

/** GhÃ©p theo INDEX vá»›i COPY.heroChips â€” sá»­a má»™t bÃªn pháº£i sá»­a bÃªn kia. */
const HERO_CHIP_ICONS: LucideIcon[] = [BookOpen, Brain, Trophy, Sparkles];

interface HeroSectionProps {
  demoSet: DemoSet;
  onRegisterClick: () => void;
  onDemoStart: () => void;
  onDemoComplete: (correctCount: number) => void;
}

export function HeroSection(p: HeroSectionProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 pt-12 pb-12 w-full">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="text-center lg:text-left">
          {/* Trang tham kháº£o dÃ¹ng text-warning; ta dÃ¹ng text-foreground
              vÃ¬ theme corporate Ä‘áº·t --warning-foreground lÃ  tráº¯ng, chá»¯ tráº¯ng trÃªn
              ná»n warning/20 gáº§n nhÆ° vÃ´ hÃ¬nh. DÆ°á»›i theme warm nhÃ¬n khÃ´ng khÃ¡c. */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-warning/20 text-foreground font-bold text-xs mb-4">
            <Sparkles className="size-4" aria-hidden />
            {COPY.heroBadge}
          </div>

          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            {COPY.heroTitlePre}{" "}
            <span className="text-primary">{COPY.heroTitleAccent}</span>{" "}
            {COPY.heroTitlePost}
          </h1>

          <p className="mt-4 text-lg text-muted-foreground max-w-2xl lg:mx-0 mx-auto">
            {COPY.heroSubtitle}
          </p>

          <div className="mt-7 flex flex-wrap gap-3 justify-center lg:justify-start">
            <button
              type="button"
              onClick={p.onRegisterClick}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft transition hover:opacity-90 cursor-pointer"
            >
              <CirclePlay className="size-4" aria-hidden />
              {COPY.heroPrimaryCta}
            </button>
            <a
              href="#bai-tap"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary no-underline"
            >
              {COPY.heroSecondaryCta}
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>

          <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-3 text-sm">
            {COPY.heroChips.map((chip, i) => {
              const Icon = HERO_CHIP_ICONS[i] ?? Sparkles;
              return (
                <div
                  key={chip}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border-2 border-border"
                >
                  <Icon className="size-4 text-primary" aria-hidden />
                  {chip}
                </div>
              );
            })}
          </div>
        </div>

        <div id="demo-widget">
          <DemoWidget
            set={p.demoSet}
            onDemoStart={p.onDemoStart}
            onDemoComplete={p.onDemoComplete}
            onTrialClick={p.onRegisterClick}
            onRegisterClick={p.onRegisterClick}
          />
        </div>
      </div>
    </section>
  );
}
