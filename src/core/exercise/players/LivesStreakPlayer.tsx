/**
 * P — Lives & streak wrapper.
 * type: lives_streak
 *
 * Hosts child question players via a render-prop. It does NOT grade itself;
 * instead it observes each child's onStatusChange: "success" bumps the streak,
 * "error" costs a life (clamped ≥ 0). It aggregates child answers and reports
 * verdict "incomplete" with presentation meta { lives, streak }.
 */
import React, { useCallback, useRef, useState } from "react";
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

export interface LivesStreakPlayerProps extends PlayerProps {
  children: ChildEntry[];
  /** Starting number of lives. */
  lives?: number;
}

export const LivesStreakPlayer: React.FC<LivesStreakPlayerProps> = ({
  children,
  lives: initialLives = 3,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  ...shell
}) => {
  const skin = useSkin();
  const { report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const [, setAnswers] = useState<Record<string, unknown>>({});
  const [lives, setLives] = useState(initialLives);
  const [streak, setStreak] = useState(0);
  const livesRef = useRef(initialLives);
  const streakRef = useRef(0);
  const answersRef = useRef<Record<string, unknown>>({});

  const pushReport = useCallback(() => {
    report(
      {
        answers: answersRef.current,
        lives: livesRef.current,
        streak: streakRef.current,
      },
      "incomplete",
    );
  }, [report]);

  const recordAnswer = useCallback(
    (childId: string, value: unknown) => {
      setAnswers((prev) => {
        const next = { ...prev, [childId]: value };
        answersRef.current = next;
        return next;
      });
      pushReport();
    },
    [pushReport],
  );

  const handleStatus = useCallback(
    (s: "idle" | "success" | "error") => {
      if (s === "success") {
        streakRef.current += 1;
        setStreak(streakRef.current);
      } else if (s === "error") {
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
        streakRef.current = 0;
        setStreak(0);
      } else {
        return;
      }
      pushReport();
    },
    [pushReport],
  );

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div
          className={`inline-flex items-center gap-1 px-3 py-2 ${
            skin.badge?.("primary") ?? "rounded-full border-4 border-rose-200  bg-rose-50 "
          }`}
        >
          {Array.from({ length: initialLives }).map((_, i) => (
            <span
              key={i}
              className={`text-xl leading-none ${i < lives ? "" : "opacity-25 grayscale"}`}
              aria-hidden="true"
            >
              ❤️
            </span>
          ))}
        </div>
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 text-base md:text-lg ${
            skin.badge?.("secondary") ??
            "rounded-full border-4 border-orange-200  bg-orange-50  text-orange-600 font-black"
          }`}
        >
          <span aria-hidden="true">🔥</span>
          {streak}
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
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-base ${skin.badge?.("primary") ?? "font-black bg-rose-400 text-white"}`}>
                  {label}
                </span>
              </div>
              {child.render({
                submitted,
                onAnswerChange: (a) => recordAnswer(child.id, a),
                onStatusChange: handleStatus,
              })}
            </div>
          );
        })}
      </div>
    </PlayerShell>
  );
};
