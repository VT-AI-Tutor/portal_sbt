/**
 * Công thức soạn bằng MathLive phải dựng được bằng KaTeX.
 *
 * Tác giả gõ công thức ở ô MathLive; màn hình đọc — xem trước, khối nội dung,
 * đề bài trong player — đều dựng bằng KaTeX. MathLive có sẵn lệnh ngữ nghĩa mà
 * KaTeX không có, và KaTeX gặp lệnh lạ thì in TÊN LỆNH ra chữ đỏ chứ không báo
 * lỗi — nên bài soạn đúng quy trình vẫn tới tay người đọc với `\imaginaryI` đỏ
 * giữa dấu tích phân.
 *
 * Ca thật (Owner 09/9): `\sqrt{5566666677}^{}\sqrt{\pi\imaginaryI\int_0^{\infty}
 * \!\int_0^{\infty}\!\placeholder{}^{\placeholder{}}\,\mathrm{d}x\,\mathrm{d}x^2}`
 * — hiện ra ba vệt đỏ giữa công thức.
 *
 * Khoá ở tầng KaTeX thật (không giả lập): dựng xong soi xem còn dấu hiệu lỗi
 * `katex-error` nào không.
 */
import katex from "katex";
import { describe, expect, it } from "vitest";

import { katexMacros, katexSafeLatex } from "./katexDialect";
import { latexWithoutPlaceholders, readMathPlaceholderValues } from "./mathPlaceholders";

/**
 * Dựng đúng như MathRenderer dựng, rồi trả về những đoạn KaTeX ĐÃ BỎ CUỘC.
 *
 * `throwOnError: false` nghĩa là KaTeX không ném lỗi mà in nguyên tên lệnh ra
 * bằng màu đỏ `#cc0000` — không có class riêng nào để bắt, nên phải dò theo
 * chính màu đó. Đây là dấu hiệu DUY NHẤT người đọc nhìn thấy.
 */
function chuaDungDuoc(latex: string, opts?: { thoSo?: boolean }): string[] {
  const html = katex.renderToString(opts?.thoSo ? latex : katexSafeLatex(latex), {
    output: "html",
    throwOnError: false,
    strict: "warn",
    trust: false,
    ...(opts?.thoSo ? {} : { macros: katexMacros() }),
  });
  return [...html.matchAll(/style="color:#cc0000;?"[^>]*>([^<]+)</g)].map((m) => m[1]);
}

/** Chữ mắt người đọc được sau khi dựng. */
function chuNhinThay(latex: string): string {
  const html = katex.renderToString(katexSafeLatex(latex), {
    output: "html",
    throwOnError: false,
    strict: "warn",
    macros: katexMacros(),
  });
  return html.replace(/<[^>]+>/g, "").replace(/​/g, "").trim();
}

describe("lệnh riêng của MathLive", () => {
  const lenh: Array<[string, string]> = [
    [String.raw`\imaginaryI`, "i"],
    [String.raw`\imaginaryJ`, "j"],
    [String.raw`\exponentialE`, "e"],
    [String.raw`\differentialD`, "d"],
    [String.raw`\capitalDifferentialD`, "D"],
    [String.raw`\differencedelta`, "Δ"],
    [String.raw`\doubleStruckCapitalN`, "N"],
    [String.raw`\doubleStruckCapitalZ`, "Z"],
    [String.raw`\doubleStruckCapitalQ`, "Q"],
    [String.raw`\doubleStruckCapitalR`, "R"],
    [String.raw`\doubleStruckCapitalP`, "P"],
  ];

  for (const [tex, chu] of lenh) {
    it(`${tex} dựng được, và ra đúng chữ "${chu}"`, () => {
      // Trước khi sửa: KaTeX in chính tên lệnh ra màn hình bằng chữ đỏ.
      expect(chuaDungDuoc(tex, { thoSo: true })).toEqual([tex]);
      expect(chuaDungDuoc(tex)).toEqual([]);
      expect(chuNhinThay(tex)).toBe(chu);
    });
  }

  it("đơn vị ảo là chữ ĐỨNG, không phải biến số nghiêng", () => {
    // ISO 80000-2: hằng số toán học in đứng để phân biệt với biến `i`.
    const html = katex.renderToString(katexSafeLatex(String.raw`\imaginaryI`), {
      output: "html",
      throwOnError: false,
      macros: katexMacros(),
    });
    expect(html).toContain("mathrm");
  });

  it("tên lệnh chép đúng hoa thường của MathLive", () => {
    // MathLive viết `\differencedelta` thường tất, khác nhịp camelCase của
    // `\differentialD` bên cạnh. Đặt macro theo tên tự suy ra thì nó không bao
    // giờ khớp, mà test lại xanh vì đang tự kiểm chứng cái tên bịa ra.
    expect(chuaDungDuoc(String.raw`\differenceDelta`, { thoSo: true })).toEqual([
      String.raw`\differenceDelta`,
    ]);
    expect(katexMacros()).not.toHaveProperty("\\differenceDelta");
  });
});

describe("`\\placeholder` — ô trống trong công thức", () => {
  it("ô trống trơn thành ô vuông", () => {
    expect(latexWithoutPlaceholders(String.raw`x = \placeholder{}`)).toBe(String.raw`x = \square`);
    expect(chuNhinThay(String.raw`x = \placeholder{}`)).toBe("x=□");
  });

  it("KHÔNG rò id ra màn hình — lý do macro suông không đủ", () => {
    // Đặt macro `\placeholder → \square` thì `[blank_1]` còn nguyên và hiện ra
    // thành chữ; đây chính là ca bắt buộc phải quét riêng.
    expect(chuNhinThay(String.raw`x = \placeholder[blank_1]{}`)).toBe("x=□");
  });

  it("ô đã điền thì hiện đáp án, không hiện ô vuông", () => {
    expect(chuNhinThay(String.raw`x = \placeholder[blank_1]{5}`)).toBe("x=5");
  });

  it("ô đã chấm — tham số thứ hai cũng không rò ra", () => {
    expect(chuNhinThay(String.raw`x = \placeholder[blank_1][incorrect]{5}`)).toBe("x=5");
  });

  it("đáp án lồng ngoặc không bị cắt ở dấu } đầu tiên", () => {
    expect(latexWithoutPlaceholders(String.raw`\placeholder[b1]{\frac{1}{2}}`)).toBe(
      String.raw`\frac{1}{2}`,
    );
  });

  it("nhiều ô trống trên một công thức", () => {
    expect(latexWithoutPlaceholders(String.raw`\placeholder{}+\placeholder[b2]{7}`)).toBe(
      String.raw`\square+7`,
    );
  });

  it("ô lồng trong ô — cái bên trong cũng phải đi, và phần đuôi không bị cắt", () => {
    expect(latexWithoutPlaceholders(String.raw`\placeholder[b1]{\placeholder{}} + 1`)).toBe(
      String.raw`\square + 1`,
    );
  });

  it("`\\placeholderFoo` không phải `\\placeholder`", () => {
    const tex = String.raw`\placeholderFoo{1}`;
    expect(latexWithoutPlaceholders(tex)).toBe(tex);
  });
});

describe("KHÔNG được phá luồng chấm điểm của MathCloze", () => {
  it("đọc đáp án theo id vẫn chạy y như cũ", () => {
    // Ô trống KHÔNG có id là dấu nhắc soạn thảo, không phải ô chấm điểm — bộ
    // quét tổng quát mới không được kéo nó vào bảng đáp án.
    const tex = String.raw`\placeholder{} + \placeholder[b1]{5} + \placeholder[b2]{\frac{1}{2}}`;
    expect(readMathPlaceholderValues(tex)).toEqual({ b1: "5", b2: String.raw`\frac{1}{2}` });
  });

  it("`[]` rỗng không phải là một ô chấm điểm", () => {
    // Khoá rỗng thì mọi ô như vậy đụng nhau trong bảng đáp án; bộ quét cũ đòi id
    // có ít nhất một ký tự, giữ nguyên giao kèo đó.
    expect(readMathPlaceholderValues(String.raw`\placeholder[]{5}`)).toEqual({});
  });

  it("dữ liệu tác giả KHÔNG bị sửa — MathLive vẫn đọc lại được bản gốc", () => {
    // katexSafeLatex chỉ dùng lúc DỰNG. Nếu nó ghi đè dữ liệu thì ô nhập của
    // MathClozePlayer mất chỗ để chấm.
    const goc = String.raw`x = \placeholder[b1]{}`;
    katexSafeLatex(goc);
    expect(goc).toBe(String.raw`x = \placeholder[b1]{}`);
  });
});

describe("công thức thật của Owner (09/9)", () => {
  const cauThat = String.raw`\sqrt{5566666677}^{}\sqrt{\pi\imaginaryI\int_0^{\infty}\!\int_0^{\infty}\!\placeholder{}^{\placeholder{}}\,\mathrm{d}x\,\mathrm{d}x^2}`;

  it("trước khi sửa: ba vệt đỏ", () => {
    expect(chuaDungDuoc(cauThat, { thoSo: true }).length).toBeGreaterThan(0);
  });

  it("sau khi sửa: sạch, không vệt đỏ nào", () => {
    expect(chuaDungDuoc(cauThat)).toEqual([]);
  });
});

describe("lệnh KaTeX vốn đã chạy thì không được đụng vào", () => {
  const giuNguyen = [
    String.raw`\frac{1}{5}`,
    String.raw`\sqrt{9}`,
    String.raw`\sqrt[3]{27}`,
    String.raw`\int_0^{\infty} x \, \mathrm{d}x`,
    String.raw`\sum_{i=1}^{n} i^2`,
    String.raw`\pi r^2`,
    String.raw`a \! b`,
    String.raw`\begin{matrix} a & b \\ c & d \end{matrix}`,
  ];

  for (const tex of giuNguyen) {
    it(`${tex} vẫn dựng sạch`, () => {
      expect(katexSafeLatex(tex)).toBe(tex);
      expect(chuaDungDuoc(tex)).toEqual([]);
    });
  }
});
