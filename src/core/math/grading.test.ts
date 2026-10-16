import { describe, expect, it } from "vitest";
import { gradeMathExpression } from "./grading";

describe("gradeMathExpression", () => {
  it("grades numeric fractions with the configured tolerance", () => {
    expect(gradeMathExpression("\\frac{1}{2}", ["0.5000000001"], "numeric", 1e-9)).toBe("correct");
    expect(gradeMathExpression("\\frac{1}{2}", ["0.51"], "numeric", 1e-9)).toBe("incorrect");
  });

  it("uses canonical symbolic structure instead of string equality", () => {
    expect(gradeMathExpression("2x + 1", ["1 + 2x"], "symbolic")).toBe("correct");
  });

  it("supports algebraic equivalence", () => {
    expect(gradeMathExpression("(x+1)^2", ["x^2+2x+1"], "algebraic_equivalence")).toBe("correct");
  });

  it("rejects malformed expressions without executing them", () => {
    expect(gradeMathExpression("\\text{not math}", ["1"], "numeric")).toBe("incorrect");
  });
});


describe("Vietnamese decimal comma", () => {
  it("reads 0{,}6 as 0.6", () => {
    expect(gradeMathExpression("0{,}6", ["0.6"], "numeric")).toBe("correct");
  });

  it("does NOT read 0{,}6 as 6", () => {
    expect(gradeMathExpression("0{,}6", ["6"], "numeric")).toBe("incorrect");
  });

  it("reads 54{,}7 as 54.7, not 547", () => {
    expect(gradeMathExpression("54{,}7", ["54.7"], "numeric")).toBe("correct");
    expect(gradeMathExpression("54{,}7", ["547"], "numeric")).toBe("incorrect");
  });

  it("accepts a bare comma between two digits", () => {
    expect(gradeMathExpression("3,5", ["3.5"], "numeric")).toBe("correct");
  });

  it("normalises the author-supplied answer too", () => {
    expect(gradeMathExpression("0.6", ["0{,}6"], "numeric")).toBe("correct");
  });

  it("leaves comma-free expressions alone", () => {
    expect(gradeMathExpression("\\frac{1}{2}", ["0.5"], "numeric")).toBe("correct");
  });
});

describe("decimal comma must not reach prose inside \\text{}", () => {
  it("leaves a comma inside \\text{} alone", () => {
    // `\text{có 3, 4 quả}` là văn xuôi: dấu phẩy ở đây là dấu ngắt, không phải
    // dấu thập phân. Viết lại nó thành `3.4` là sửa sai đáp án của tác giả.
    expect(gradeMathExpression("\\text{có 3, 4 quả}", ["\\text{có 3, 4 quả}"], "symbolic")).toBe(
      "correct",
    );
    expect(gradeMathExpression("\\text{có 3, 4 quả}", ["\\text{có 3.4 quả}"], "symbolic")).toBe(
      "incorrect",
    );
  });

  it("still normalises a decimal comma when nothing is wrapped in \\text{}", () => {
    // Bản viết lại của `normalizeVietnameseDecimals` phải giữ nguyên hành vi cũ ở
    // chuỗi không có `\text{}` — các test dấu phẩy phía trên chính là lưới an toàn,
    // đây là ca chốt thêm ngay cạnh luật mới.
    expect(gradeMathExpression("1{,}5", ["1.5"], "numeric")).toBe("correct");
  });

  it("mixed prose and maths is not gradeable at all — a compute-engine limit", () => {
    // `0.6 + \text{abc}` không parse được, kể cả khi hai vế viết y hệt nhau. Ghi lại
    // để lần sau không ai mất công đi tìm lỗi ở luật chuẩn hoá dấu phẩy.
    expect(gradeMathExpression("0.6 + \\text{abc}", ["0.6 + \\text{abc}"], "symbolic")).toBe(
      "incorrect",
    );
  });
});
