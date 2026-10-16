import { describe, expect, it } from "vitest";
import { essayAnswerToPlainText, normalizeMathDollarSpacing } from "./essay-formula";

describe("normalizeMathDollarSpacing", () => {
  it("bỏ dấu cách MathLive chèn bên trong $…$", () => {
    // MathLive trả `$ 54- $`; bộ tách của InlineMathText đòi ký tự KHÔNG trắng
    // ngay sau `$`, nên để nguyên thì công thức hiện thành chữ thô.
    expect(normalizeMathDollarSpacing("Giá là $ 54- $ đồng")).toBe("Giá là $54-$ đồng");
  });

  it("giữ nguyên chuỗi đã đúng dạng", () => {
    expect(normalizeMathDollarSpacing("Giá là $54-$ đồng")).toBe("Giá là $54-$ đồng");
  });

  it("xử lý được nhiều công thức trong một câu", () => {
    expect(normalizeMathDollarSpacing("$ a $ và $ b $")).toBe("$a$ và $b$");
  });

  it("KHÔNG đụng tới giá tiền — `5$` không phải công thức", () => {
    expect(normalizeMathDollarSpacing("giá 5$ và 10$")).toBe("giá 5$ và 10$");
  });

  it("giữ nguyên chuỗi không có $ nào", () => {
    expect(normalizeMathDollarSpacing("Chỉ là văn xuôi")).toBe("Chỉ là văn xuôi");
  });

  it("chuỗi rỗng vẫn an toàn", () => {
    expect(normalizeMathDollarSpacing("")).toBe("");
  });
});

describe("essayAnswerToPlainText", () => {
  it("hạ mỗi dòng của \\displaylines thành một dòng thật", () => {
    // Dùng để ĐẾM TỪ và cho các bề mặt chỉ nhận chuỗi phẳng.
    expect(
      essayAnswerToPlainText("$\\displaylines{\\text{Dòng một}\\\\ \\text{Dòng hai}}$"),
    ).toBe("Dòng một\nDòng hai");
  });

  it("giữ công thức giữa dòng dưới dạng đọc được", () => {
    const out = essayAnswerToPlainText("$\\displaylines{\\text{Giá là }54-32}$");
    expect(out).toContain("Giá là");
    expect(out).not.toContain("displaylines");
    expect(out).not.toContain("\\text");
  });

  it("bài làm chưa có môi trường nhiều dòng vẫn hạ được", () => {
    expect(essayAnswerToPlainText("$\\text{Một dòng thôi}$")).toBe("Một dòng thôi");
  });

  it("văn xuôi thuần giữ nguyên", () => {
    expect(essayAnswerToPlainText("Rừng giữ đất và giữ nước.")).toBe("Rừng giữ đất và giữ nước.");
  });

  it("chuỗi rỗng trả rỗng", () => {
    expect(essayAnswerToPlainText("")).toBe("");
  });
});

describe("normalizeMathDollarSpacing — các ca dễ nhầm", () => {
  it("giá tiền có dấu cách trước $ đóng vẫn không bị hiểu là công thức", () => {
    // `5$` mở đầu bị loại vì đứng ngay sau chữ số — cùng luật với bộ tách.
    expect(normalizeMathDollarSpacing("giá 5$ và 10 $")).toBe("giá 5$ và 10 $");
  });

  it("không nuốt phần văn xuôi giữa hai công thức", () => {
    expect(normalizeMathDollarSpacing("$ a $ và $ b $")).toBe("$a$ và $b$");
  });
});
