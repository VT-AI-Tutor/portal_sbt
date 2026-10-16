/**
 * Pure combo-streak logic for game mode. Kept side-effect free so it can be
 * unit-tested without React — `GameModeChrome` / `PracticeRunner` just call
 * `nextCombo` on each per-question check result and render the returned
 * state.
 */

export interface ComboState {
  /** Current consecutive-correct streak. Resets to 0 on a wrong answer. */
  streak: number;
  /** Best streak reached this session — never decreases. */
  best: number;
}

export interface ComboResult extends ComboState {
  /**
   * Set only on the tick where `streak` LANDS exactly on a milestone value
   * (3, 5, or 10) — not on every tick above it, and not again if the streak
   * is later reset and re-passes the same value on a different tick count.
   */
  milestone: 3 | 5 | 10 | null;
}

const MILESTONES = [3, 5, 10] as const;

export const INITIAL_COMBO_STATE: ComboState = { streak: 0, best: 0 };

/** Advance combo state by one question's check result. */
export function nextCombo(state: ComboState, isCorrect: boolean): ComboResult {
  if (!isCorrect) {
    return { streak: 0, best: state.best, milestone: null };
  }

  const streak = state.streak + 1;
  const best = Math.max(state.best, streak);
  const milestone = MILESTONES.includes(streak as (typeof MILESTONES)[number])
    ? (streak as 3 | 5 | 10)
    : null;

  return { streak, best, milestone };
}

/**
 * Decides whether a per-question check result should affect combo/XP state.
 *
 * A question is only ever allowed to score once. On its FIRST correct check
 * it scores and is added to `scored`; a later retry of that same question
 * (correct or incorrect) must not touch the streak — in particular an
 * incorrect retry must NOT reset a streak that was already banked. A
 * question whose first check is incorrect is not added to `scored`, so a
 * later correct check on it still scores exactly once.
 */
export function shouldScore(
  scored: ReadonlySet<string>,
  questionId: string,
  isCorrect: boolean,
): { score: boolean; addToScored: boolean } {
  if (scored.has(questionId)) {
    return { score: false, addToScored: false };
  }
  return { score: true, addToScored: isCorrect };
}
