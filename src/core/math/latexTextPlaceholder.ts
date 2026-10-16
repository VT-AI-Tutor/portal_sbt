/**
 * Bọc chữ mờ thành `\text{}` để MathLive vẽ nó như văn xuôi.
 *
 * MathLive đọc `placeholder` như LaTeX ở chế độ toán, nên "Viết bài của em ở
 * đây..." hiện thành "Viếtbàicủaemởđây..." — in nghiêng kiểu tên biến và mất
 * sạch dấu cách. Mọi ô của ta đều đặt chữ mờ bằng tiếng Việt nên việc bọc làm ở
 * đây, cửa duy nhất mọi bề mặt toán đi qua, thay vì nhắc từng nơi gọi.
 */
const LATEX_ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "$": "\\$",
  "&": "\\&",
  "#": "\\#",
  "%": "\\%",
  "_": "\\_",
  "^": "\\textasciicircum{}",
  "~": "\\textasciitilde{}",
};

export function latexTextPlaceholder(value: string): string {
  const escaped = value.replace(/[\\{}$&#%_^~]/g, (char) => LATEX_ESCAPES[char] ?? char);
  return `\\text{${escaped}}`;
}
