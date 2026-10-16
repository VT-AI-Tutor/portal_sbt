/**
 * P — Timed quiz wrapper.
 * type: timed_quiz
 *
 * Hosts child question players via a render-prop. Starts an elapsed timer on
 * mount; if timeLimitMs is set it shows a countdown and stops at 0. It does NOT
 * grade — it aggregates child answers and reports verdict "incomplete" with
 * presentation meta { elapsedMs }.
 *
 * IMPORTANT: Date.now() is only referenced inside effects/handlers, never at
 * module scope.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { PlayerShell, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

interface ChildEntry {
  id: string;
  /** Renders the inner question player. Provided by the caller. */
  render: (ctx: {
    onAnswerChange: (a: unknown) => void;
    submitted?: boolean;
    onStatusChange?: (s: "idle" | "success" | "error") => void;
  }) => React.ReactNode;
}

export interface TimedQuizPlayerProps extends PlayerProps {
  children: ChildEntry[];
  /** Optional limit; when set the timer counts down and freezes at 0. */
  timeLimitMs?: number;
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const TimedQuizPlayer: React.FC<TimedQuizPlayerProps> = ({
  children,
  timeLimitMs,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  ...shell
}) => {
  const skin = useSkin();
  const { report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const [, setAnswers] = useState<Record<string, unknown>>({});
  // Gương của `answers` để report() ngoài updater setAnswers (tránh setState-in-render).
  const answersRef = useRef<Record<string, unknown>>({});
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => {
      const start = startRef.current;
      if (start == null) return;
      const e = Date.now() - start;
      if (timeLimitMs != null && e >= timeLimitMs) {
        elapsedRef.current = timeLimitMs;
        setElapsedMs(timeLimitMs);
        clearInterval(id);
        return;
      }
      elapsedRef.current = e;
      setElapsedMs(e);
    }, 250);
    return () => clearInterval(id);
  }, [timeLimitMs]);

  const recordAnswer = useCallback(
    (childId: string, value: unknown) => {
      const next = { ...answersRef.current, [childId]: value };
      answersRef.current = next;
      setAnswers(next);
      report({ answers: next, elapsedMs: elapsedRef.current }, "incomplete");
    },
    [report],
  );

  const remainingMs =
    timeLimitMs != null ? Math.max(0, timeLimitMs - elapsedMs) : null;
  const timeUp = timeLimitMs != null && remainingMs === 0;

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className="flex justify-end mb-4">
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-base md:text-lg ${
            timeUp
              ? skin.badge?.("danger") ??
                "border-4 border-red-400 bg-red-50  text-red-600 font-black"
              : skin.badge?.("primary") ??
                "border-4 border-amber-300  bg-amber-50  text-amber-700  font-black"
          }`}
        >
          <span aria-hidden="true">⏱</span>
          {remainingMs != null ? fmt(remainingMs) : fmt(elapsedMs)}
        </div>
      </div>

      <div className="flex flex-col gap-4 md:gap-6">
        {children.map((child, i) => {
          const label = String.fromCharCode(97 + i);
          return (
            <div
              key={child.id}
              className={`p-4 sm:p-5 shadow-sm ${skin.panel?.("card") ?? "rounded-3xl border-4 border-slate-200 bg-white/80"}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-base ${skin.badge?.("primary") ?? "bg-amber-400 text-white font-black"}`}>
                  {label}
                </span>
              </div>
              {child.render({
                submitted,
                onAnswerChange: (a) => recordAnswer(child.id, a),
                onStatusChange: () => {},
              })}
            </div>
          );
        })}
      </div>
    </PlayerShell>
  );
};
