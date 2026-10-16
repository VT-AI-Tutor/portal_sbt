import { describe, expect, it } from "vitest";
import {
  hasMathPlaceholder,
  insertMathPlaceholder,
  mathPlaceholderIds,
  nextMathPlaceholderId,
  readMathPlaceholderValues,
  writeMathPlaceholderValues,
} from "./mathPlaceholders";

describe("hasMathPlaceholder", () => {
  it("recognises a formula carrying a blank", () => {
    expect(hasMathPlaceholder("\\frac{3}{\\placeholder[blank_1]{}}")).toBe(true);
  });

  it("plain formulas carry none", () => {
    expect(hasMathPlaceholder("\\frac{3}{5}")).toBe(false);
  });

  it("an id-less \\placeholder{} is an authoring cue, not a blank", () => {
    expect(hasMathPlaceholder("\\frac{3}{\\placeholder{}}")).toBe(false);
  });
});

describe("mathPlaceholderIds", () => {
  it("lists ids in the order they appear", () => {
    expect(mathPlaceholderIds("\\placeholder[blank_2]{} + \\placeholder[blank_1]{}")).toEqual([
      "blank_2",
      "blank_1",
    ]);
  });

  it("de-duplicates a repeated id", () => {
    expect(mathPlaceholderIds("\\placeholder[blank_1]{} = \\placeholder[blank_1]{}")).toEqual([
      "blank_1",
    ]);
  });

  it("returns an empty list for a plain formula", () => {
    expect(mathPlaceholderIds("x^2")).toEqual([]);
  });
});

describe("nextMathPlaceholderId", () => {
  it("starts at blank_1", () => {
    expect(nextMathPlaceholderId("x^2")).toBe("blank_1");
  });

  it("skips an id already in use", () => {
    expect(nextMathPlaceholderId("\\placeholder[blank_1]{}")).toBe("blank_2");
  });

  it("fills a gap left in the middle of the run", () => {
    expect(nextMathPlaceholderId("\\placeholder[blank_2]{}")).toBe("blank_1");
  });
});

describe("insertMathPlaceholder", () => {
  it("appends a blank to the formula", () => {
    expect(insertMathPlaceholder("3 + 5 =", "blank_1")).toBe("3 + 5 =\\placeholder[blank_1]{}");
  });
});

describe("readMathPlaceholderValues", () => {
  it("reads what the pupil typed into each blank", () => {
    expect(readMathPlaceholderValues("\\frac{3}{\\placeholder[blank_1]{5}}")).toEqual({
      blank_1: "5",
    });
  });

  it("an untouched blank reads as empty", () => {
    expect(readMathPlaceholderValues("\\placeholder[blank_1]{}")).toEqual({ blank_1: "" });
  });

  it("keeps a nested-brace answer whole", () => {
    expect(readMathPlaceholderValues("\\placeholder[blank_1]{\\frac{1}{2}}")).toEqual({
      blank_1: "\\frac{1}{2}",
    });
  });

  it("reads several blanks at once", () => {
    expect(
      readMathPlaceholderValues("\\placeholder[blank_1]{2} + \\placeholder[blank_2]{3}"),
    ).toEqual({ blank_1: "2", blank_2: "3" });
  });
});

describe("writeMathPlaceholderValues", () => {
  it("writes a saved answer back into the blank", () => {
    expect(writeMathPlaceholderValues("\\frac{3}{\\placeholder[blank_1]{}}", { blank_1: "5" })).toBe(
      "\\frac{3}{\\placeholder[blank_1]{5}}",
    );
  });

  it("writes a nested-brace answer back whole", () => {
    expect(writeMathPlaceholderValues("\\placeholder[blank_1]{}", { blank_1: "\\frac{1}{2}" })).toBe(
      "\\placeholder[blank_1]{\\frac{1}{2}}",
    );
  });

  it("clears a blank with no saved answer", () => {
    expect(writeMathPlaceholderValues("\\placeholder[blank_1]{9}", {})).toBe(
      "\\placeholder[blank_1]{}",
    );
  });

  it("round-trips through read", () => {
    const written = writeMathPlaceholderValues(
      "\\frac{\\placeholder[a]{}}{\\placeholder[b]{}}",
      { a: "\\sqrt{9}", b: "2" },
    );
    expect(readMathPlaceholderValues(written)).toEqual({ a: "\\sqrt{9}", b: "2" });
  });

  it("leaves a formula with no blanks untouched", () => {
    expect(writeMathPlaceholderValues("x^2", { a: "1" })).toBe("x^2");
  });
});

describe("blanks that MathLive has stamped with a grading state", () => {
  // Sau khi chấm, MathLive tuần tự hoá trạng thái vào chính LaTeX như một cặp
  // ngoặc vuông thứ hai: `\placeholder[blank_1][incorrect]{5}`.
  it("is still recognised as a blank", () => {
    expect(hasMathPlaceholder("\\placeholder[blank_1][incorrect]{}")).toBe(true);
  });

  it("still yields its id", () => {
    expect(mathPlaceholderIds("\\placeholder[blank_1][incorrect]{}")).toEqual(["blank_1"]);
  });

  it("still yields the pupil's answer", () => {
    expect(readMathPlaceholderValues("\\placeholder[blank_1][incorrect]{5}")).toEqual({
      blank_1: "5",
    });
  });

  it("reads a state-stamped blank alongside a plain one", () => {
    expect(
      readMathPlaceholderValues(
        "\\frac{3}{\\placeholder[blank_1]{5}}=\\placeholder[blank_2][incorrect]{7}",
      ),
    ).toEqual({ blank_1: "5", blank_2: "7" });
  });

  it("still accepts a written-back answer", () => {
    expect(
      writeMathPlaceholderValues("\\placeholder[blank_1][correct]{}", { blank_1: "2" }),
    ).toBe("\\placeholder[blank_1][correct]{2}");
  });

  it("still reports the next free id", () => {
    expect(nextMathPlaceholderId("\\placeholder[blank_1][correct]{}")).toBe("blank_2");
  });
});
