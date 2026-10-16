import { describe, expect, it } from "vitest";
import { numberToVietnameseWords } from "./numberWords";

describe("numberToVietnameseWords", () => {
  it("reads single digits and tens", () => {
    expect(numberToVietnameseWords(1)).toBe("một");
    expect(numberToVietnameseWords(2)).toBe("hai");
    expect(numberToVietnameseWords(10)).toBe("mười");
    expect(numberToVietnameseWords(15)).toBe("mười lăm");
    expect(numberToVietnameseWords(21)).toBe("hai mươi mốt");
    expect(numberToVietnameseWords(24)).toBe("hai mươi tư");
    expect(numberToVietnameseWords(25)).toBe("hai mươi lăm");
    expect(numberToVietnameseWords(30)).toBe("ba mươi");
  });
  it("returns '' for out-of-range / non-integers", () => {
    expect(numberToVietnameseWords(0)).toBe("");
    expect(numberToVietnameseWords(100)).toBe("");
    expect(numberToVietnameseWords(1.5)).toBe("");
  });
});
