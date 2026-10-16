import { describe, expect, it } from "vitest";
import { suggestCode } from "./suggestCode";

describe("suggestCode", () => {
  it("fold dấu tiếng Việt và kebab-case", () => {
    expect(suggestCode("Giáo dục STEM")).toBe("giao-duc-stem");
    expect(suggestCode("Lịch sử và Địa lí")).toBe("lich-su-va-dia-li");
    expect(suggestCode("Tiếng Đức")).toBe("tieng-duc");
  });

  it("bỏ ký tự đặc biệt, gộp khoảng trắng", () => {
    expect(suggestCode("  Toán  (nâng cao)! ")).toBe("toan-nang-cao");
  });

  it("số thuần giữ nguyên", () => {
    expect(suggestCode("13")).toBe("13");
  });
});
