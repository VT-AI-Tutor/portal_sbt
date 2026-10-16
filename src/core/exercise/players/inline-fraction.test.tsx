import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuestionPlayer } from "../QuestionPlayer";

function renderQuestion(
  questionType: "fill_blank" | "cloze",
  text = "⅕ thế kỉ = ___[blank_1]___ năm",
) {
  return renderToString(
    <QuestionPlayer
      question={{
        id: "fraction-question",
        question_type: questionType,
        payload: {
          type: questionType,
          content: {
            blocks: [
              {
                type: "paragraph",
                text,
              },
            ],
          },
          correctAnswer: { blank_1: "20" },
        },
      }}
      index={0}
    />,
  );
}

describe("inline fractions in text-entry players", () => {
  it.each(["fill_blank", "cloze"] as const)(
    "renders the fraction and blank together for %s",
    (questionType) => {
      const html = renderQuestion(questionType);

      expect(html).toContain("mfrac");
      expect(html).toContain(String.raw`\frac{1}{5}`);
      expect(html).toContain("thế kỉ");
      expect(html).toContain("năm");
      expect(html).toContain('type="text"');
      // web-own: default (không khai width/input.size) là kích thước TO cố
      // định 7rem như web cũ — clamp 42cqi chỉ áp khi tác giả khai size (#444).
      // Từ khi ô tự giãn, cỡ là SÀN (`min-width`) chứ không còn khoá hộp; và
      // sàn nay suy từ đáp án ("20" → chạm sàn 6ch, Owner 12/8).
      expect(html).toContain("min-width:6ch");
      expect(html).not.toContain("⅕");
      expect(html).not.toContain("w-28");
    },
  );

  it("renders the composed rich-text form from the QA preview vertically", () => {
    const html = renderQuestion(
      "cloze",
      "<strong><sup>1</sup>/<sub>5</sub></strong> thế kỉ = ___[blank_1]___ năm",
    );

    expect(html).toContain("<strong>");
    expect(html).toContain("mfrac");
    expect(html).toContain(String.raw`\frac{1}{5}`);
    expect(html).not.toContain("<sup>");
  });

  it("renders both authored b2_q2 quarter fractions around all seven cloze blanks", () => {
    const html = renderToString(
      <QuestionPlayer
        question={{
          id: "b2_q2",
          question_type: "cloze",
          payload: {
            type: "cloze",
            content: {
              blocks: [
                {
                  type: "paragraph",
                  text:
                    "Nước ta có ¾ diện tích đất liền là {blank_1}, trong đó phần lớn là {blank_2}. " +
                    "Các {blank_3} có hướng chính. Diện tích {blank_4} chỉ chiếm ¼ lãnh thổ, " +
                    "thấp và tương đối {blank_5}; {blank_6} và {blank_7}.",
                },
              ],
            },
            correctAnswer: Object.fromEntries(
              Array.from({ length: 7 }, (_, index) => [`blank_${index + 1}`, "đúng"]),
            ),
          },
        }}
        index={0}
      />,
    );

    expect(html).toContain("mfrac");
    expect(html).toContain(String.raw`\frac{3}{4}`);
    expect(html).toContain(String.raw`\frac{1}{4}`);
    expect(html.match(/type="text"/g)).toHaveLength(7);
    expect(html).not.toContain("¾");
    expect(html).not.toContain("¼");
  });
});
