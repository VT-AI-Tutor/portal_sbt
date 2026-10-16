import { describe, expect, it } from "vitest";
import { buildStudentSubtitle } from "./buildStudentSubtitle";

describe("buildStudentSubtitle", () => {
  it("ưu tiên class_name kèm trường", () => {
    expect(
      buildStudentSubtitle({ class_name: "4A", level: "4", school_name: "TH Lê Quý Đôn" }),
    ).toBe("4A · TH Lê Quý Đôn");
  });

  it("không có class_name → fallback Lớp {level}", () => {
    expect(buildStudentSubtitle({ level: "4", school_name: "TH Lê Quý Đôn" })).toBe(
      "Lớp 4 · TH Lê Quý Đôn",
    );
  });

  it("chỉ có class_name, không trường", () => {
    expect(buildStudentSubtitle({ class_name: "4A" })).toBe("4A");
  });

  it("class_name rỗng → fallback Lớp {level}", () => {
    expect(buildStudentSubtitle({ class_name: "", level: "4", school_name: "TH Lê Quý Đôn" })).toBe(
      "Lớp 4 · TH Lê Quý Đôn",
    );
  });

  it("class_name chỉ có khoảng trắng → fallback Lớp {level}", () => {
    expect(buildStudentSubtitle({ class_name: "   ", level: "4", school_name: "TH Lê Quý Đôn" })).toBe(
      "Lớp 4 · TH Lê Quý Đôn",
    );
  });

  it("chỉ có trường, không lớp", () => {
    expect(buildStudentSubtitle({ school_name: "TH Lê Quý Đôn" })).toBe("TH Lê Quý Đôn");
  });

  it("không lớp, không trường → fallback email", () => {
    expect(buildStudentSubtitle({ email: "a@b.com" })).toBe("a@b.com");
  });

  it("trống hoàn toàn → fallback 'Học sinh'", () => {
    expect(buildStudentSubtitle(undefined)).toBe("Học sinh");
    expect(buildStudentSubtitle(null)).toBe("Học sinh");
    expect(buildStudentSubtitle({})).toBe("Học sinh");
  });
});
