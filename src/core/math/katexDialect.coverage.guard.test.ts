/**
 * GUARD — phương ngữ MathLive phải được KaTeX dựng hết.
 *
 * Test này KHÔNG kiểm một danh sách chép tay: nó đọc chính hai từ điển trong
 * `node_modules/mathlive` (bảng macro và bảng ký hiệu), tự tính lại tập lệnh mà
 * KaTeX không dựng nổi, rồi bắt lỗi nếu có lệnh nào chưa được `katexDialect`
 * nhận hoặc chưa được khai miễn trừ.
 *
 * Vì sao phải đọc node_modules: nguồn sự thật của phương ngữ nằm ở gói MathLive,
 * không ở repo này. Nâng phiên bản MathLive mà nó thêm lệnh mới thì test đỏ ngay
 * lúc `npm install`, thay vì đợi một người đọc nhìn thấy chữ đỏ giữa bài.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import katex from "katex";
import { describe, expect, it } from "vitest";

import { KATEX_UNSUPPORTED_MATHLIVE_COMMANDS, katexMacros } from "./katexDialect";

/**
 * Bản KHÔNG rút gọn của gói, cạnh entry chính.
 *
 * `exports` của MathLive không mở đường dẫn con nào nên không `resolve` thẳng
 * được; còn entry chính lại trỏ vào bản `.min.js` — đã rút gọn thì hai bảng từ
 * điển không còn giữ dạng để đọc ra. Nên: lấy thư mục gói từ entry chính, rồi
 * mở bản `.mjs` nằm cạnh.
 */
const mathliveSource = readFileSync(
  join(dirname(createRequire(import.meta.url).resolve("mathlive")), "mathlive.mjs"),
  "utf8",
);

/** Bảng macro: `"tên": "vế phải"` — vế phải là LaTeX (bắt đầu bằng `\`). */
function mathliveMacroNames(): string[] {
  const names: string[] = [];
  for (const m of mathliveSource.matchAll(/^ {2}"([a-zA-Z]+)": ("(?:[^"\\]|\\.)*")[,$]/gm)) {
    if (JSON.parse(m[2]).startsWith("\\")) names.push(m[1]);
  }
  return names;
}

/** Bảng ký hiệu: `["\tên", <mã unicode>]`. */
function mathliveSymbolNames(): string[] {
  return [...mathliveSource.matchAll(/\["\\\\([a-zA-Z]+)",\s*\d+\]/g)].map((m) => m[1]);
}

/** KaTeX gặp lệnh lạ thì in tên lệnh bằng chữ đỏ `#cc0000` — dấu hiệu duy nhất. */
function buildsRed(latex: string, macros?: Record<string, string>): boolean {
  try {
    const html = katex.renderToString(latex, {
      output: "html",
      throwOnError: false,
      strict: "ignore",
      ...(macros ? { macros: { ...macros } } : {}),
    });
    return html.includes("color:#cc0000");
  } catch {
    return true;
  }
}

/** Môi trường (`\begin{matrix}`) không phải macro — đừng kéo vào bảng. */
const isEnvironment = (name: string) => !buildsRed(`\\begin{${name}} a \\end{${name}}`);

describe("guard: phủ hết phương ngữ MathLive", () => {
  const macros = katexMacros();
  const excused = new Set(KATEX_UNSUPPORTED_MATHLIVE_COMMANDS);

  it("mọi lệnh MathLive mà KaTeX không biết đều đã được dịch, hoặc đã khai miễn trừ", () => {
    const candidates = [...new Set([...mathliveMacroNames(), ...mathliveSymbolNames()])];
    // Lệnh KaTeX vốn dựng được thì không cần dịch; môi trường cũng không phải macro.
    const gaps = candidates.filter(
      (name) => buildsRed(`\\${name}{x}{y}`) && !isEnvironment(name),
    );
    // Lưới có thật: nếu regex trên hỏng, mảng rỗng sẽ làm test xanh giả.
    expect(gaps.length).toBeGreaterThan(50);

    const uncovered = gaps.filter((name) => !(`\\${name}` in macros) && !excused.has(name));
    expect(uncovered).toEqual([]);
  });

  it("nạp bảng vào rồi thì không lệnh nào còn dựng ra chữ đỏ", () => {
    const stillRed = Object.keys(macros).filter((command) =>
      buildsRed(macros[command].includes("#1") ? `${command}{x}{y}` : command, macros),
    );
    expect(stillRed).toEqual([]);
  });

  it("không có dòng miễn trừ nào thừa — đã dịch rồi thì đừng khai miễn trừ nữa", () => {
    expect([...excused].filter((name) => `\\${name}` in macros)).toEqual([]);
  });
});
