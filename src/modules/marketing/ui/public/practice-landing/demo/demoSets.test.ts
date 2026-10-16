import { describe, expect, it } from "vitest";
import { DEMO_SETS, findDemoSet } from "./demoSets";

describe("DEMO_SETS (spec §5)", () => {
  it("có ít nhất 1 bộ; mỗi bộ đúng 5 câu, mở màn kéo thả, ≥2 câu kéo thả", () => {
    expect(DEMO_SETS.length).toBeGreaterThanOrEqual(1);
    for (const set of DEMO_SETS) {
      expect(set.questions).toHaveLength(5);
      expect(set.questions[0].kind).toBe("sort");
      expect(
        set.questions.filter((q) => q.kind === "sort").length,
      ).toBeGreaterThanOrEqual(2);
      for (const q of set.questions) expect(q.skill.length).toBeGreaterThan(0);
    }
  });
  it("câu trắc nghiệm có correctIndex hợp lệ; câu sort có ≥3 item", () => {
    for (const q of DEMO_SETS.flatMap((s) => s.questions)) {
      if (q.kind === "choice") {
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
      } else {
        expect(q.items.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it("findDemoSet khớp (level, subject) và fallback về bộ đầu tiên", () => {
    expect(findDemoSet("3", "toan")).toBe(DEMO_SETS[0]);
    expect(findDemoSet("9", "khong-ton-tai")).toBe(DEMO_SETS[0]);
  });
});
