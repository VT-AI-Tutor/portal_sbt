import { describe, expect, it } from "vitest";

import { resolveCrosswordConfig } from "./crossword";

describe("crossword payload compatibility (§5.36)", () => {
  it("reads spec-shape entries with the answer key held apart", () => {
    const config = resolveCrosswordConfig({
      type: "crossword",
      size: { rows: 3, cols: 6 },
      entries: [{ id: "e1", startRow: 0, startCol: 0, direction: "across", length: 4, clue: "Con vật kêu meo meo" }],
      correctAnswer: { e1: "MEOO" },
    });
    expect(config.entries).toHaveLength(1);
    expect(config.entries[0]).toMatchObject({ id: "e1", row: 0, col: 0, dir: "across", answer: "MEOO" });
    expect(config.size).toEqual({ rows: 3, cols: 6 });
  });

  it("accepts the legacy row/col/dir spelling and the array answer key", () => {
    const config = resolveCrosswordConfig({
      type: "crossword",
      entries: [{ id: "e1", row: 1, col: 2, dir: "down", length: 3 }],
      correctAnswer: [{ entryId: "e1", answer: "ABC" }],
    });
    expect(config.entries[0]).toMatchObject({ row: 1, col: 2, dir: "down", answer: "ABC" });
  });

  it("widens a declared size that is narrower than the geometry", () => {
    const config = resolveCrosswordConfig({
      type: "crossword",
      size: { rows: 1, cols: 1 },
      entries: [{ id: "e1", startRow: 0, startCol: 0, direction: "across", length: 5 }],
    });
    expect(config.size).toEqual({ rows: 1, cols: 5 });
  });

  it("drops malformed entries instead of handing the player a null row", () => {
    const config = resolveCrosswordConfig({
      type: "crossword",
      entries: [null, "e2", 7, [], { id: "ok", startRow: 0, startCol: 0, direction: "across", length: 2 }],
    });
    expect(config.entries.map((entry) => entry.id)).toEqual(["ok"]);
  });

  it("returns an empty, 1x1 config for a payload with no usable entries", () => {
    // The size claim must NOT survive: a declared 10x8 with zero entries is
    // exactly the all-black grid issue #810 is about, and the diagnostic keys
    // off entries.length.
    const config = resolveCrosswordConfig({ type: "crossword", size: { rows: 10, cols: 8 }, entries: [] });
    expect(config.entries).toEqual([]);
    expect(config.size).toEqual({ rows: 10, cols: 8 });
  });

  it("never throws on garbage", () => {
    for (const garbage of [{}, { entries: "nope" }, { entries: {} }, { correctAnswer: 7 }, { size: "big" }]) {
      expect(() => resolveCrosswordConfig(garbage as Record<string, unknown>)).not.toThrow();
    }
  });
});
