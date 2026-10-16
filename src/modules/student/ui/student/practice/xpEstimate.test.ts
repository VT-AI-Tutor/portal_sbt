import { describe, expect, it } from "vitest";
import { estimateXp, SESSION_COMPLETED_XP } from "./xpEstimate";

// GAP-057 / GAME-R1: ước tính XP chế độ chơi phải khớp công thức BE
// floor(correct × 10 × 1.5) và KHÔNG cộng sẵn +20 hoàn thành phiên.
describe("estimateXp", () => {
  it("dùng floor, không làm tròn lên (1 câu → floor(15) = 15)", () => {
    expect(estimateXp(1)).toBe(15);
  });

  it("floor với số lẻ: 3 câu → floor(45) = 45; 7 câu → floor(105) = 105", () => {
    expect(estimateXp(3)).toBe(45);
    expect(estimateXp(7)).toBe(105);
  });

  it("0 câu đúng → 0 (không tính sẵn XP hoàn thành phiên)", () => {
    expect(estimateXp(0)).toBe(0);
  });

  it("khác round: 5 câu → 75 (floor(75)); công thức không tạo phần thập phân nhưng vẫn dùng floor", () => {
    // round và floor trùng ở đây; chốt giá trị để chống hồi quy nếu hệ số đổi.
    expect(estimateXp(5)).toBe(75);
  });

  it("XP hoàn thành phiên là hằng số tách biệt (+20), không nằm trong estimateXp", () => {
    expect(SESSION_COMPLETED_XP).toBe(20);
  });
});
