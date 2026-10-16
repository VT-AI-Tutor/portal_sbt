import { describe, expect, it } from "vitest";
import { toCanonical, toLabel } from "@/modules/teacher/lib/questionDifficulty";

describe("questionDifficulty.toCanonical", () => {
  it("Dễ → easy", () => {
    expect(toCanonical("Dễ")).toBe("easy");
  });

  it("TB → medium", () => {
    expect(toCanonical("TB")).toBe("medium");
  });

  it("Trung bình → medium", () => {
    expect(toCanonical("Trung bình")).toBe("medium");
  });

  it("Khó → hard", () => {
    expect(toCanonical("Khó")).toBe("hard");
  });

  it("easy/medium/hard giữ nguyên", () => {
    expect(toCanonical("easy")).toBe("easy");
    expect(toCanonical("medium")).toBe("medium");
    expect(toCanonical("hard")).toBe("hard");
  });

  it("giá trị lạ → medium", () => {
    expect(toCanonical("???")).toBe("medium");
  });
});

describe("questionDifficulty.toLabel", () => {
  it("easy → Dễ", () => {
    expect(toLabel("easy")).toBe("Dễ");
  });

  it("medium → TB", () => {
    expect(toLabel("medium")).toBe("TB");
  });

  it("hard → Khó", () => {
    expect(toLabel("hard")).toBe("Khó");
  });

  it("giá trị lạ → TB", () => {
    expect(toLabel("???")).toBe("TB");
  });
});
