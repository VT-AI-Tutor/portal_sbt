import { describe, expect, it } from "vitest";
import { componentShortLabel, shortenLabel } from "./shortLabel";

describe("shortenLabel", () => {
  it("giữ nguyên tên ngắn", () => {
    expect(shortenLabel("Phân số")).toBe("Phân số");
  });
  it("bỏ số thứ tự đầu và cắt ở ranh giới từ, có dấu …", () => {
    const long = "1. Số tự nhiên và các phép tính cộng trừ nhân chia trong phạm vi một trăm";
    const out = shortenLabel(long, 28);
    expect(out.length).toBeLessThanOrEqual(29); // 28 + "…"
    expect(out.endsWith("…")).toBe(true);
    expect(out.startsWith("Số tự nhiên")).toBe(true);
  });
});

describe("componentShortLabel", () => {
  it("dict GDPT môn Toán", () => {
    expect(componentShortLabel("Tư duy và lập luận toán học")).toBe("Tư duy & lập luận");
    expect(componentShortLabel("Mô hình hoá toán học")).toBe("Mô hình hoá");
    expect(componentShortLabel("Giải quyết vấn đề toán học")).toBe("Giải quyết vấn đề");
  });
  it("không có trong dict -> cắt 20 ký tự", () => {
    const out = componentShortLabel("Năng lực tự chủ và tự học suốt đời của học sinh");
    expect(out.length).toBeLessThanOrEqual(21);
  });
  it("có ngân sách riêng cho nơi gọi hẹp hơn (radar) mà không đổi mặc định", () => {
    const long = "Năng lực tự chủ và tự học suốt đời của học sinh";
    expect(componentShortLabel(long, 14).length).toBeLessThanOrEqual(15);
    expect(componentShortLabel(long).length).toBeLessThanOrEqual(21); // mặc định 20 không đổi
  });
  it("khớp dict dù dùng \"và\" hay dấu phẩy — tên bank thật dùng \"và\"", () => {
    // Bank câu hỏi thực tế dùng "và" (không phải dấu phẩy như dict cũ), lệch
    // này từng khiến khoá không khớp và rơi về cắt chung chung "Sử dụng công
    // cụ và…" — cụt giữa câu, không đọc được gì (regression nguồn gốc).
    expect(componentShortLabel("Sử dụng công cụ và phương tiện học toán")).toBe(
      "Công cụ & phương tiện",
    );
    expect(componentShortLabel("Sử dụng công cụ, phương tiện học toán")).toBe(
      "Công cụ & phương tiện",
    );
    // Khoảng trắng thừa / hoa thường lệch cũng không được làm rơi khỏi dict.
    expect(
      componentShortLabel("  sử  dụng công cụ VÀ phương tiện học toán  "),
    ).toBe("Công cụ & phương tiện");
  });
});
