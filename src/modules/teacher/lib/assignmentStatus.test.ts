import { describe, expect, it } from "vitest";
import { assignmentStatusLabel } from "@/modules/teacher/lib/assignmentStatus";

describe("assignmentStatusLabel", () => {
  it("chua_lam → Chưa làm", () => {
    expect(assignmentStatusLabel("chua_lam")).toBe("Chưa làm");
  });

  it("da_nop → Đã nộp", () => {
    expect(assignmentStatusLabel("da_nop")).toBe("Đã nộp");
  });

  it("nop_muon → Nộp muộn", () => {
    expect(assignmentStatusLabel("nop_muon")).toBe("Nộp muộn");
  });

  it("da_cham → Đã chấm", () => {
    expect(assignmentStatusLabel("da_cham")).toBe("Đã chấm");
  });

  it("giá trị lạ → trả về chính nó", () => {
    expect(assignmentStatusLabel("unknown_status")).toBe("unknown_status");
  });
});
