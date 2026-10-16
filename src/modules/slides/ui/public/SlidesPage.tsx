import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Grid3x3,
  Moon,
  Sun,
  X,
} from "lucide-react";
import mascot from "@/core/assets/mascot-bee.png";
import owl from "@/assets/mascot-owl.png";
import { SLIDES } from "@/modules/slides/ui/shared/slides-content";

type SlideFn = () => ReactNode;

export function SlidesPage() {
  const [idx, setIdx] = useState(0);
  const [grid, setGrid] = useState(false);
  const [dark, setDark] = useState(true);
  const [full, setFull] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Compute scale to fit viewport
  useEffect(() => {
    const compute = () => {
      const el = stageRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      setScale(Math.min(w / 1920, h / 1080));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [grid, full]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, SLIDES.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
        setGrid(false);
      } else if (e.key.toLowerCase() === "g") setGrid((g) => !g);
      else if (e.key === "F5") {
        e.preventDefault();
        enterFull();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const enterFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen?.();
  };

  const Slide = SLIDES[idx];

  return (
    <div
      ref={wrapRef}
      className={
        dark
          ? "dark min-h-screen bg-slate-950 text-slate-100"
          : "min-h-screen bg-slate-100 text-slate-900"
      }
    >
      {/* Toolbar */}
      {!full && (
        <header className="h-14 border-b border-white/10 flex items-center px-4 gap-3 bg-black/40 backdrop-blur sticky top-0 z-30">
          <img src={mascot} alt="" className="size-8" />
          <div className="font-display font-bold">
            SBT số NXBGDVN · Slide giới thiệu
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs opacity-70">
              {idx + 1} / {SLIDES.length}
            </span>
            <button
              onClick={() => setGrid((g) => !g)}
              className="size-9 rounded-lg hover:bg-white/10 flex items-center justify-center"
              title="Lưới (G)"
            >
              <Grid3x3 className="size-4" />
            </button>
            <button
              onClick={() => setDark((d) => !d)}
              className="size-9 rounded-lg hover:bg-white/10 flex items-center justify-center"
              title="Chế độ"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              onClick={enterFull}
              className="size-9 rounded-lg hover:bg-white/10 flex items-center justify-center"
              title="Trình chiếu (F5)"
            >
              {full ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </button>
          </div>
        </header>
      )}

      {grid ? (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl font-bold">
              Hành trình SBT số của NXBGDVN
            </h2>
            <button
              onClick={() => setGrid(false)}
              className="size-9 rounded-lg hover:bg-white/10 flex items-center justify-center"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(SLIDES as SlideFn[]).map((S: SlideFn, i: number) => (
              <button
                key={i}
                onClick={() => {
                  setIdx(i);
                  setGrid(false);
                }}
                className="group relative rounded-xl overflow-hidden border-2 border-white/10 hover:border-amber-400 bg-black/40"
              >
                <div className="aspect-video relative overflow-hidden">
                  <div
                    className="absolute inset-0"
                    style={{
                      transform: "scale(0.18)",
                      transformOrigin: "top left",
                      width: 1920,
                      height: 1080,
                    }}
                  >
                    <S />
                  </div>
                </div>
                <div className="p-2 text-xs flex justify-between">
                  <span className="opacity-60">Slide {i + 1}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          ref={stageRef}
          className="relative"
          style={{ height: full ? "100vh" : "calc(100vh - 56px)" }}
        >
          {/* scaled slide */}
          <div
            className="absolute"
            style={{
              width: 1920,
              height: 1080,
              left: "50%",
              top: "50%",
              marginLeft: -960,
              marginTop: -540,
              transform: `scale(${scale})`,
              transformOrigin: "center center",
            }}
          >
            <Slide />
          </div>

          {/* nav pills */}
          <button
            onClick={() => setIdx((i) => Math.max(i - 1, 0))}
            disabled={idx === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center disabled:opacity-30 z-20"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => setIdx((i) => Math.min(i + 1, SLIDES.length - 1))}
            disabled={idx === SLIDES.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center disabled:opacity-30 z-20"
          >
            <ChevronRight />
          </button>

          {/* progress */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${((idx + 1) / SLIDES.length) * 100}%` }}
            />
          </div>

          {full && (
            <div className="absolute bottom-4 right-4 text-xs opacity-50 bg-black/40 px-2 py-1 rounded">
              {idx + 1} / {SLIDES.length} · ESC để thoát
            </div>
          )}
        </div>
      )}

      {/* hidden image preload so og share + assets resolve */}
      <img src={owl} alt="" className="hidden" />
    </div>
  );
}

export type SlideComp = () => ReactNode;
