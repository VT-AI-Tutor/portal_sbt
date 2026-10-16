import { describe, expect, it } from "vitest";
import {
  practiceModeLabel,
  practiceSourceLabel,
  practiceStatusLabel,
} from "./practiceLabels";

// GAP-109: bảng "Phiên gần nhất" (màn Tài khoản) trước đây hiện mã thô.
describe("practice labels", () => {
  it("dịch mã chế độ sang tiếng Việt", () => {
    expect(practiceModeLabel("practice")).toBe("Luyện tập");
    expect(practiceModeLabel("timed")).toBe("Tính giờ");
  });

  it('chế độ game là "Chơi game", KHÔNG phải "Thi đấu" (GAP-091: Thi đấu là màn riêng)', () => {
    expect(practiceModeLabel("game")).toBe("Chơi game");
  });

  it("dịch mã trạng thái sang tiếng Việt", () => {
    expect(practiceStatusLabel("in_progress")).toBe("Đang làm");
    expect(practiceStatusLabel("completed")).toBe("Hoàn thành");
    expect(practiceStatusLabel("abandoned")).toBe("Đã bỏ dở");
  });

  it("dịch mã nguồn sang tiếng Việt", () => {
    expect(practiceSourceLabel("ai_suggested")).toBe("AI gợi ý");
  });

  it("mã lạ trả về chính nó thay vì vỡ giao diện", () => {
    expect(practiceModeLabel("che_do_moi")).toBe("che_do_moi");
    expect(practiceStatusLabel("trang_thai_moi")).toBe("trang_thai_moi");
  });
});
