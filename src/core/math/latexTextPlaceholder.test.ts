import { describe, expect, it } from "vitest";
import { latexTextPlaceholder } from "./latexTextPlaceholder";

describe("latexTextPlaceholder", () => {
  it("giữ nguyên dấu cách và dấu tiếng Việt", () => {
    // MathLive đọc chữ mờ như LaTeX ở chế độ toán, nên để trần thì
    // "Viết bài của em ở đây..." hiện ra "Viếtbàicủaemởđây...".
    expect(latexTextPlaceholder("Viết bài của em ở đây...")).toBe(
      "\\text{Viết bài của em ở đây...}",
    );
  });

  it("thoát các ký tự LaTeX để chữ mờ không phá cú pháp", () => {
    expect(latexTextPlaceholder("100% & #1 _ ^ ~ $ {x}")).toBe(
      "\\text{100\\% \\& \\#1 \\_ \\textasciicircum{} \\textasciitilde{} \\$ \\{x\\}}",
    );
  });

  it("thoát dấu chéo ngược", () => {
    expect(latexTextPlaceholder("a \\ b")).toBe("\\text{a \\textbackslash{} b}");
  });
});
