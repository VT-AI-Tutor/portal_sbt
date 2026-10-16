import { describe, expect, it } from "vitest";
import { INITIAL_COMBO_STATE, nextCombo, shouldScore, type ComboState } from "./comboLogic";

function run(sequence: boolean[]) {
  let state: ComboState = INITIAL_COMBO_STATE;
  const milestones: (number | null)[] = [];
  for (const isCorrect of sequence) {
    const result = nextCombo(state, isCorrect);
    milestones.push(result.milestone);
    state = { streak: result.streak, best: result.best };
  }
  return { state, milestones };
}

describe("nextCombo", () => {
  it("đúng liên tiếp tăng streak từng bước", () => {
    let state: ComboState = INITIAL_COMBO_STATE;
    state = { streak: nextCombo(state, true).streak, best: nextCombo(state, true).best };
    expect(state.streak).toBe(1);
  });

  it("[T,T,T] → milestone 3 chỉ ở câu thứ ba", () => {
    const { milestones, state } = run([true, true, true]);
    expect(milestones).toEqual([null, null, 3]);
    expect(state.streak).toBe(3);
    expect(state.best).toBe(3);
  });

  it("năm câu đúng liên tiếp → milestone 5 xuất hiện đúng một lần ở câu thứ năm", () => {
    const { milestones } = run([true, true, true, true, true]);
    expect(milestones).toEqual([null, null, 3, null, 5]);
    expect(milestones.filter((m) => m === 5)).toHaveLength(1);
  });

  it("mười câu đúng liên tiếp → milestone 10 ở câu thứ mười", () => {
    const { milestones } = run(Array(10).fill(true));
    expect(milestones[9]).toBe(10);
    expect(milestones.filter((m) => m === 10)).toHaveLength(1);
  });

  it("một câu sai reset streak về 0, không có milestone", () => {
    const afterTwo = run([true, true]).state;
    const result = nextCombo(afterTwo, false);
    expect(result.streak).toBe(0);
    expect(result.milestone).toBeNull();
  });

  it("best giữ giá trị lớn nhất kể cả sau khi reset", () => {
    // 3 đúng (best=3), 1 sai (reset), 1 đúng (streak=1, best vẫn 3)
    const { state } = run([true, true, true, false, true]);
    expect(state.streak).toBe(1);
    expect(state.best).toBe(3);
  });

  it("streak vượt qua mốc mà không dừng đúng tại đó thì không có milestone (mốc chỉ báo khi CHẠM đúng)", () => {
    // reset ngay sau mốc 3, rồi đi lại chỉ 2 bước — không chạm mốc nào
    const { milestones } = run([true, true, true, false, true, true]);
    expect(milestones).toEqual([null, null, 3, null, null, null]);
  });
});

describe("shouldScore", () => {
  it("câu chưa từng đúng lần nào + đúng lần này → tính điểm và đánh dấu đã ghi điểm", () => {
    const scored = new Set<string>();
    expect(shouldScore(scored, "q1", true)).toEqual({ score: true, addToScored: true });
  });

  it("câu chưa từng ghi điểm + sai lần này → vẫn tính (reset streak) nhưng KHÔNG đánh dấu, để lần đúng sau còn tính", () => {
    const scored = new Set<string>();
    expect(shouldScore(scored, "q1", false)).toEqual({ score: true, addToScored: false });
  });

  it("câu đã ghi điểm rồi + làm lại và đúng → không tính điểm nữa (tránh cày combo)", () => {
    const scored = new Set<string>(["q1"]);
    expect(shouldScore(scored, "q1", true)).toEqual({ score: false, addToScored: false });
  });

  it("câu đã ghi điểm rồi + làm lại và sai → không tính điểm, KHÔNG reset streak vì câu đã được ghi nhận trước đó", () => {
    const scored = new Set<string>(["q1"]);
    expect(shouldScore(scored, "q1", false)).toEqual({ score: false, addToScored: false });
  });
});
