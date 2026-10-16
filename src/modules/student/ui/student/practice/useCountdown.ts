/**
 * Countdown for timed practice sessions. Pure helpers first (TDD'd in
 * `useCountdown.test.ts`), then a ticking hook built on top of them.
 *
 * The remaining time is always recomputed from `started_at + limitSeconds`
 * vs `Date.now()` — never a naive per-tick decrement — so a page reload
 * mid-session resumes at the correct remaining time instead of resetting.
 */
import { useEffect, useRef, useState } from "react";

/** Format a whole number of seconds as "mm:ss", clamped to >= 0. */
export function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Seconds left until `startedAtIso + limitSeconds`, never negative. */
export function remainingSeconds(
  startedAtIso: string,
  limitSeconds: number,
  nowMs: number,
): number {
  const startedMs = new Date(startedAtIso).getTime();
  const elapsedSeconds = (nowMs - startedMs) / 1000;
  return Math.max(0, Math.round(limitSeconds - elapsedSeconds));
}

export interface CountdownState {
  secondsLeft: number;
  label: string;
  /** true when under 60s left — caller uses this to switch to a danger color. */
  isDanger: boolean;
  isExpired: boolean;
}

/**
 * Ticking countdown. `onExpire` fires exactly once when the countdown first
 * reaches 0 (guards against StrictMode double-invoke / multiple ticks at 0).
 * Pass `startedAtIso: null` to disable (untimed sessions).
 */
export function useCountdown(
  startedAtIso: string | null,
  limitSeconds: number | null,
  onExpire?: () => void,
): CountdownState {
  const enabled = !!startedAtIso && limitSeconds != null;
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    enabled ? remainingSeconds(startedAtIso as string, limitSeconds as number, Date.now()) : 0,
  );
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!enabled) return;
    firedRef.current = false;

    const tick = () => {
      const left = remainingSeconds(startedAtIso as string, limitSeconds as number, Date.now());
      setSecondsLeft(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled, startedAtIso, limitSeconds]);

  return {
    secondsLeft,
    label: formatCountdown(secondsLeft),
    isDanger: secondsLeft < 60,
    isExpired: enabled && secondsLeft <= 0,
  };
}
