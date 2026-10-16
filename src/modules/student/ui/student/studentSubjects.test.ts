import { describe, expect, it } from "vitest";
import { getStudentSubjectCodes } from "./studentSubjects";

const LOWER_PRIMARY = ["toan", "tieng-viet", "tu-nhien-xa-hoi", "tieng-anh", "dao-duc"];
const PRIMARY = ["khoa-hoc", "toan", "tieng-viet", "lich-su-dia-li", "tieng-anh"];
const SECONDARY = ["khoa-hoc-tu-nhien", "toan", "ngu-van", "lich-su-dia-li", "tieng-anh"];
const HIGH_SCHOOL = ["toan", "ngu-van", "vat-li", "hoa-hoc", "sinh-hoc"];

describe("getStudentSubjectCodes", () => {
  it("lớp 3 → bộ tiểu học dưới gồm tu-nhien-xa-hoi + dao-duc, không dùng khoa-hoc", () => {
    const codes = getStudentSubjectCodes("3");
    expect(codes).toEqual(LOWER_PRIMARY);
    expect(codes).toContain("tu-nhien-xa-hoi");
    expect(codes).toContain("dao-duc");
    expect(codes).not.toContain("khoa-hoc");
    expect(codes).not.toContain("lich-su-dia-li");
  });

  it("lớp 4 → bộ tiểu học trên", () => {
    expect(getStudentSubjectCodes("4")).toEqual(PRIMARY);
  });

  it("lớp 6 → bộ THCS gồm ngu-van + khoa-hoc-tu-nhien", () => {
    const codes = getStudentSubjectCodes("6");
    expect(codes).toEqual(SECONDARY);
    expect(codes).toContain("ngu-van");
    expect(codes).toContain("khoa-hoc-tu-nhien");
  });

  it("lớp 10 → bộ THPT gồm vat-li/hoa-hoc/sinh-hoc, không dùng khoa-hoc-tu-nhien", () => {
    const codes = getStudentSubjectCodes("10");
    expect(codes).toEqual(HIGH_SCHOOL);
    expect(codes).toContain("vat-li");
    expect(codes).toContain("hoa-hoc");
    expect(codes).toContain("sinh-hoc");
    expect(codes).not.toContain("khoa-hoc-tu-nhien");
  });

  it("lớp 11 → bộ THPT", () => {
    expect(getStudentSubjectCodes("11")).toEqual(HIGH_SCHOOL);
  });

  it("lớp 12 → bộ THPT", () => {
    expect(getStudentSubjectCodes("12")).toEqual(HIGH_SCHOOL);
  });

  it("lớp 13 (ngoài khoảng hỗ trợ) → fallback bộ tiểu học", () => {
    expect(getStudentSubjectCodes("13")).toEqual(PRIMARY);
  });

  it("null → fallback bộ tiểu học", () => {
    expect(getStudentSubjectCodes(null)).toEqual(PRIMARY);
  });

  it("undefined → fallback bộ tiểu học", () => {
    expect(getStudentSubjectCodes(undefined)).toEqual(PRIMARY);
  });

  it("chuỗi không parse được ('abc') → fallback bộ tiểu học", () => {
    expect(getStudentSubjectCodes("abc")).toEqual(PRIMARY);
  });
});
