import { describe, expect, it } from "vitest";
import { masteryColor } from "./masteryColor";

describe("masteryColor", () => {
  it("75% → success (giỏi)", () => {
    expect(masteryColor(75).tone).toBe("success");
  });

  it("60% → info (khá)", () => {
    expect(masteryColor(60).tone).toBe("info");
  });

  it("45% → warning (trung bình)", () => {
    expect(masteryColor(45).tone).toBe("warning");
  });

  it("44% → danger (yếu)", () => {
    expect(masteryColor(44).tone).toBe("danger");
  });

  it("null → muted (chưa có dữ liệu)", () => {
    expect(masteryColor(null).tone).toBe("muted");
  });

  it("mỗi tone trả về một mã hex hợp lệ", () => {
    for (const percent of [75, 60, 45, 44, null]) {
      expect(masteryColor(percent).hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
