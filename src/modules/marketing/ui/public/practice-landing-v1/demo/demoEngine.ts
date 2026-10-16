/** Pure state machine của widget demo hero — không DOM, không side effect. */
export interface DemoChoiceQuestion {
  kind: "choice";
  skill: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}
export interface DemoSortQuestion {
  kind: "sort";
  skill: string;
  prompt: string;
  groups: [string, string];
  items: { text: string; group: 0 | 1 }[];
}
export type DemoQuestion = DemoChoiceQuestion | DemoSortQuestion;

export interface DemoOutcome {
  skill: string;
  correct: boolean;
}
export interface DemoState {
  index: number;
  xp: number;
  outcomes: DemoOutcome[];
  finished: boolean;
}
export interface ResultRow {
  skill: string;
  percent: number;
  label: string;
}

export const XP_PER_CORRECT = 10;

export function createDemoState(): DemoState {
  return { index: 0, xp: 0, outcomes: [], finished: false };
}

export function gradeChoice(
  q: DemoChoiceQuestion,
  chosenIndex: number,
): boolean {
  return chosenIndex === q.correctIndex;
}

export function gradeSort(
  q: DemoSortQuestion,
  placement: ReadonlyArray<0 | 1>,
): boolean {
  return (
    q.items.length === placement.length &&
    q.items.every((it, i) => it.group === placement[i])
  );
}

export function advance(
  state: DemoState,
  question: DemoQuestion,
  correct: boolean,
  total: number,
): DemoState {
  const index = state.index + 1;
  return {
    index,
    xp: state.xp + (correct ? XP_PER_CORRECT : 0),
    outcomes: [...state.outcomes, { skill: question.skill, correct }],
    finished: index >= total,
  };
}

export function buildResultRows(outcomes: readonly DemoOutcome[]): ResultRow[] {
  return outcomes.map((o) => ({
    skill: o.skill,
    percent: o.correct ? 90 : 30,
    label: o.correct ? "Vững ✓" : "Cần luyện ←",
  }));
}
