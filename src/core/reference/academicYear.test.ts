import { describe, expect, it } from "vitest";
import { academicYearOptions, currentAcademicYear } from "./academicYear";

describe("năm học hiện hành", () => {
  it("lật sang năm học mới từ tháng 8", () => {
    expect(currentAcademicYear(new Date(2026, 8, 15))).toBe("2026-2027"); // tháng 9
    expect(currentAcademicYear(new Date(2026, 7, 1))).toBe("2026-2027");  // tháng 8
    expect(currentAcademicYear(new Date(2026, 6, 31))).toBe("2025-2026"); // tháng 7
  });

  it("liệt kê năm hiện hành trước, lùi dần", () => {
    expect(academicYearOptions(3, new Date(2026, 8, 1))).toEqual(["2026-2027", "2025-2026", "2024-2025"]);
  });
});
