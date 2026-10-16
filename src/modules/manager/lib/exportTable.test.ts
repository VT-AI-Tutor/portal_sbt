import { describe, expect, it } from "vitest";
import { buildCsv } from "./exportTable";

describe("buildCsv", () => {
  it("mở được bằng Excel tiếng Việt: có BOM và khai báo dấu phân cách", () => {
    const csv = buildCsv({ headers: ["Họ tên"], rows: [["Trần Thị Ánh"]] });

    // Thiếu BOM thì Excel đọc tiếng Việt thành ký tự lạ; thiếu sep= thì dồn hết vào một cột
    // vì bảng mã địa phương Việt Nam coi dấu phẩy là dấu thập phân.
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")[0]).toBe("\uFEFFsep=;");
    expect(csv).toContain("Trần Thị Ánh");
  });

  it("bọc ô chứa dấu phân cách, ngoặc kép hoặc xuống dòng", () => {
    const csv = buildCsv({
      headers: ["A", "B", "C"],
      rows: [["Tổ Toán; Tin", 'Em "giỏi"', "dòng 1\ndòng 2"]],
    });
    const line = csv.split("\r\n")[2];

    expect(line).toBe('"Tổ Toán; Tin";"Em ""giỏi""";"dòng 1\ndòng 2"');
  });

  it("ô rỗng/null thành chuỗi trống chứ không phải chữ null", () => {
    const csv = buildCsv({ headers: ["A", "B"], rows: [[null, undefined]] });

    expect(csv.split("\r\n")[2]).toBe(";");
  });

  it("giữ số nguyên vẹn (không đổi dấu thập phân) để Excel tự hiểu", () => {
    const csv = buildCsv({ headers: ["Điểm"], rows: [[6.5]] });

    expect(csv.split("\r\n")[2]).toBe("6.5");
  });
});
