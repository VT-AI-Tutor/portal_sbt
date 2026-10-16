import { describe, expect, it } from "vitest";
import {
  XP_PER_CORRECT,
  advance,
  buildResultRows,
  createDemoState,
  gradeChoice,
  gradeSort,
  type DemoChoiceQuestion,
  type DemoSortQuestion,
} from "./demoEngine";

const choiceQ: DemoChoiceQuestion = {
  kind: "choice",
  skill: "Phép nhân trong bảng",
  prompt: "7 × 8 = ?",
  options: ["54", "56", "63"],
  correctIndex: 1,
};
const sortQ: DemoSortQuestion = {
  kind: "sort",
  skill: "Số chẵn, số lẻ",
  prompt: "Kéo mỗi số vào đúng nhóm.",
  groups: ["Nhóm CHẴN", "Nhóm LẺ"],
  items: [
    { text: "12", group: 0 },
    { text: "7", group: 1 },
    { text: "25", group: 1 },
  ],
};

describe("grade", () => {
  it("chấm trắc nghiệm theo correctIndex", () => {
    expect(gradeChoice(choiceQ, 1)).toBe(true);
    expect(gradeChoice(choiceQ, 0)).toBe(false);
  });
  it("chấm kéo thả: đúng khi mọi item vào đúng nhóm", () => {
    expect(gradeSort(sortQ, [0, 1, 1])).toBe(true);
    expect(gradeSort(sortQ, [0, 1, 0])).toBe(false);
  });
});

describe("advance", () => {
  it("cộng XP khi đúng, ghi outcome, sang câu kế", () => {
    const s1 = advance(createDemoState(), choiceQ, true, 5);
    expect(s1).toMatchObject({ index: 1, xp: XP_PER_CORRECT, finished: false });
    expect(s1.outcomes).toEqual([
      { skill: "Phép nhân trong bảng", correct: true },
    ]);
  });
  it("không cộng XP khi sai; finished khi hết câu", () => {
    let s = createDemoState();
    s = advance(s, choiceQ, false, 2);
    s = advance(s, sortQ, true, 2);
    expect(s).toMatchObject({ index: 2, xp: XP_PER_CORRECT, finished: true });
  });
});

describe("buildResultRows", () => {
  it('đúng → 90% "Vững ✓"; sai → 30% "Cần luyện ←"', () => {
    expect(
      buildResultRows([
        { skill: "A", correct: true },
        { skill: "B", correct: false },
      ]),
    ).toEqual([
      { skill: "A", percent: 90, label: "Vững ✓" },
      { skill: "B", percent: 30, label: "Cần luyện ←" },
    ]);
  });
});
