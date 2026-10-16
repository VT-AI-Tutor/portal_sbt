// Trợ giảng có thể chèn "ô tương tác" vào câu trả lời bằng token quy ước (hướng C):
//   [[blank: <nhãn>]]                         → một ô để học sinh điền
//   [[choice: <nhãn> :: <a> | <b> | <c>]]     → chọn 1 trong nhiều đáp án
// Các token CHỈ giúp học sinh nhập câu trả lời thân thiện hơn — KHÔNG chấm ở client;
// khi gửi, câu trả lời được gộp thành một lượt chat để AI xem lại (Socratic).

export type HintField =
  | { kind: "blank"; label: string }
  | { kind: "choice"; label: string; options: string[] };

// Bắt cả blank/choice trong một lượt quét để giữ ĐÚNG thứ tự xuất hiện.
const TOKEN_RE = /\[\[(blank|choice):\s*([^\]]+?)\]\]/gi;

export interface ParsedHints {
  /** Phần lời giải thích (đã bỏ token) để render markdown. */
  prose: string;
  /** Các ô tương tác theo thứ tự xuất hiện. */
  fields: HintField[];
}

export function parseHints(content: string): ParsedHints {
  const fields: HintField[] = [];

  const stripped = content.replace(
    TOKEN_RE,
    (_m, kind: string, body: string) => {
      if (kind.toLowerCase() === "choice") {
        const [labelPart, optsPart = ""] = body.split("::");
        const options = optsPart
          .split("|")
          .map((o) => o.trim())
          .filter(Boolean);
        // Choice cần ≥2 lựa chọn mới có nghĩa; thiếu thì coi như văn bản thường (giữ nguyên).
        if (options.length >= 2) {
          fields.push({ kind: "choice", label: labelPart.trim(), options });
          return "";
        }
        return _m;
      }
      fields.push({ kind: "blank", label: body.trim() });
      return "";
    },
  );

  // Dọn rác để lại sau khi bỏ token (chỉ với tin nhắn CÓ token, tránh đụng văn bản thường):
  // - "Vậy … sẽ là: [[blank]]." → bỏ đuôi ": ." lơ lửng.
  // - "20 + 60 = [[blank]]"      → bỏ dấu "= " lơ lửng cuối dòng.
  const cleaned =
    fields.length === 0
      ? stripped
      : stripped
          .split("\n")
          .map((line) =>
            line
              .replace(/[ \t]{2,}/g, " ") // gộp khoảng trắng do token bị bỏ giữa dòng
              .replace(/[ \t]+([.,;:!?])/g, "$1") // bỏ khoảng trắng trước dấu câu
              .replace(/[ \t]*[=+][ \t]*[.．]?[ \t]*$/u, "") // "= " / "+ ." lơ lửng cuối dòng
              .replace(/[ \t]*:[ \t]*[.．][ \t]*$/u, "") // ": ." lơ lửng (nhưng GIỮ ":" đứng riêng)
              .replace(/[ \t]+$/g, ""),
          )
          .join("\n");

  const prose = cleaned
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { prose, fields };
}

/** Gộp câu trả lời của học sinh thành một lượt chat để gửi cho AI xem lại. */
export function buildAnswerMessage(
  fields: HintField[],
  values: Record<number, string>,
): string {
  const parts = fields.map((f, i) => {
    const v = (values[i] ?? "").trim();
    return `${f.label} = ${v || "?"}`;
  });
  return `Em trả lời: ${parts.join("; ")}`;
}
