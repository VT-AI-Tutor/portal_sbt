import { describe, expect, it } from "vitest";
import { plainTextFromAuthoredMath } from "./plainTextFromAuthoredMath";

describe("plainTextFromAuthoredMath", () => {
  it("lowers the reported label to readable prose", () => {
    expect(
      plainTextFromAuthoredMath(
        String.raw`Một bức tường có chiều dài \(\frac{51}{4}\) m và chiều rộng 3 m.`,
      ),
    ).toBe("Một bức tường có chiều dài 51/4 m và chiều rộng 3 m.");
  });

  it("lowers a display span the same way as an inline one", () => {
    expect(plainTextFromAuthoredMath(String.raw`Tính \[\frac{3}{4} + \frac{1}{2}\] rồi so sánh.`)).toBe(
      "Tính 3/4 + 1/2 rồi so sánh.",
    );
  });

  it("keeps the grouping of a compound numerator or denominator", () => {
    expect(plainTextFromAuthoredMath(String.raw`\(\frac{a + b}{2}\)`)).toBe("(a + b)/2");
    expect(plainTextFromAuthoredMath(String.raw`\(\frac{1}{n - 1}\)`)).toBe("1/(n - 1)");
  });

  it("handles a nested fraction and a braceless fraction argument", () => {
    expect(plainTextFromAuthoredMath(String.raw`\(\frac{\frac{1}{2}}{3}\)`)).toBe("(1/2)/3");
    expect(plainTextFromAuthoredMath(String.raw`\(\frac12\)`)).toBe("1/2");
  });

  it("maps the operator commands a workbook actually uses", () => {
    expect(plainTextFromAuthoredMath(String.raw`\(5 \times 4 \div 2 \le 12\)`)).toBe(
      "5 × 4 ÷ 2 ≤ 12",
    );
  });

  it("renders digit scripts as Unicode and keeps the rest as TeX operators", () => {
    expect(plainTextFromAuthoredMath(String.raw`\(x^2 + a_1\)`)).toBe("x² + a₁");
    expect(plainTextFromAuthoredMath(String.raw`\(x^{n+k}\)`)).toBe("x^n+k");
  });

  it("drops an unknown command but never its content", () => {
    expect(plainTextFromAuthoredMath(String.raw`\(\overline{AB} = \left( 3 \right)\)`)).toBe(
      "AB = ( 3 )",
    );
    expect(plainTextFromAuthoredMath(String.raw`\(\text{Đáp số}: 12\)`)).toBe("Đáp số: 12");
  });

  it("lowers a bare command outside any delimiter", () => {
    expect(plainTextFromAuthoredMath(String.raw`Chiều dài \frac{51}{4} m`)).toBe(
      "Chiều dài 51/4 m",
    );
  });

  it("leaves prose braces, carets and underscores alone outside a span", () => {
    expect(plainTextFromAuthoredMath(String.raw`Mã {b8_q1} là 2^3 \(x^2\)`)).toBe(
      "Mã {b8_q1} là 2^3 x²",
    );
  });

  it("returns a string with no backslash byte for byte", () => {
    const value = "Một bức tường có chiều dài 12,75 m — {chú thích} 50%";
    expect(plainTextFromAuthoredMath(value)).toBe(value);
  });

  it("keeps a lone dollar amount out of math mode", () => {
    expect(plainTextFromAuthoredMath(String.raw`Giá 5$ và 10$, giảm \(\frac{1}{4}\)`)).toBe(
      "Giá 5$ và 10$, giảm 1/4",
    );
  });

  it("lowers a $ … $ span the same way it lowers a bracket span", () => {
    expect(plainTextFromAuthoredMath(String.raw`chiều dài $\frac{51}{4}$ m`)).toBe(
      "chiều dài 51/4 m",
    );
    expect(plainTextFromAuthoredMath(String.raw`nếu $x \le 5$ thì đúng`)).toBe(
      "nếu x ≤ 5 thì đúng",
    );
  });

  it("keeps newlines but collapses the gap a dropped command leaves", () => {
    expect(plainTextFromAuthoredMath("Câu 1: \\quad 5 + 5\nCâu 2: 6 + 6")).toBe(
      "Câu 1: 5 + 5\nCâu 2: 6 + 6",
    );
  });

  it("does not lose the body of an unbalanced span", () => {
    expect(plainTextFromAuthoredMath(String.raw`Tính \frac{51`)).toBe("Tính 51");
  });

  it("treats a null or empty label as empty", () => {
    expect(plainTextFromAuthoredMath(null)).toBe("");
    expect(plainTextFromAuthoredMath(undefined)).toBe("");
    expect(plainTextFromAuthoredMath("")).toBe("");
  });

  it("treats malformed non-string values as empty instead of crashing the page", () => {
    // Persisted legacy payloads can be malformed; this display helper must not
    // throw while a QA list is rendering.
    expect(plainTextFromAuthoredMath([String.raw`\\broken`])).toBe("");
    expect(plainTextFromAuthoredMath({ blocks: [] })).toBe("");
  });
});

describe("blanks inside a formula", () => {
  it("lowers a blank to an ellipsis instead of leaking its id", () => {
    const label = plainTextFromAuthoredMath("\\(\\frac{3}{\\placeholder[blank_1]{}}\\)");
    expect(label).toContain("…");
    expect(label).not.toContain("blank_1");
    expect(label).not.toContain("placeholder");
  });

  it("lowers every blank in a multi-blank formula", () => {
    const label = plainTextFromAuthoredMath(
      "\\(\\placeholder[blank_1]{} + \\placeholder[blank_2]{} = 10\\)",
    );
    expect(label).toBe("… + … = 10");
  });

  it("leaves an id-less \\placeholder{} as an ellipsis too", () => {
    expect(plainTextFromAuthoredMath("\\(1 + \\placeholder{}\\)")).toBe("1 + …");
  });
});

describe("môi trường nhiều dòng của bài giải", () => {
  it("hạ \\displaylines thành các dòng, không lòi tên môi trường", () => {
    const out = plainTextFromAuthoredMath(
      "\\(\\displaylines{\\text{Dòng một}\\\\ \\text{Dòng hai}}\\)",
    );
    expect(out).toContain("Dòng một");
    expect(out).toContain("Dòng hai");
    expect(out).not.toContain("displaylines");
  });
});
