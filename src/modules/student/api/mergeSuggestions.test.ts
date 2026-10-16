import { describe, expect, it } from "vitest";
import { mergeSuggestions } from "./mergeSuggestions";
import type { PracticeSuggestion } from "./practiceApi";

function makeSuggestion(overrides: Partial<PracticeSuggestion>): PracticeSuggestion {
  return {
    key: "k1",
    subject_code: "toan",
    title: "Title",
    mastery_percent: 50,
    trend: "flat",
    priority: "should",
    question_count: 5,
    reason_text: "reason",
    ref: {},
    ...overrides,
  };
}

describe("mergeSuggestions", () => {
  it("merges multiple subject lists sorted by mastery_percent ascending", () => {
    const a = [makeSuggestion({ key: "a", mastery_percent: 70 })];
    const b = [makeSuggestion({ key: "b", mastery_percent: 20 })];
    const c = [makeSuggestion({ key: "c", mastery_percent: 40 })];

    const result = mergeSuggestions([a, b, c]);

    expect(result.map((s) => s.key)).toEqual(["b", "c", "a"]);
  });

  it("caps the merged list at the given size", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      makeSuggestion({ key: `s${i}`, mastery_percent: i }),
    );

    const result = mergeSuggestions([many], 9);

    expect(result).toHaveLength(9);
    expect(result.map((s) => s.mastery_percent)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
