// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QuestionPlayer } from "@/core/exercise/QuestionPlayer";

/**
 * Lựa chọn của ô điền khai dạng OBJECT (thói quen của phương án trắc nghiệm)
 * từng bị `normalizeBlankOptions` lọc sạch, và ô im lặng tụt về gõ tay dù câu
 * có khai lựa chọn. Nay rút chữ hiển thị ra để vẫn là dropdown.
 */
afterEach(cleanup);

function renderCloze(options: unknown) {
  return render(
    <QuestionPlayer
      index={0}
      question={
        {
          id: "q1",
          question_type: "cloze",
          payload: {
            content: "Con {blank_1} bay cao.",
            blanks: [{ id: "blank_1" }],
            options,
            correctAnswer: { blank_1: "máy bay" },
          },
        } as never
      }
    />,
  );
}

/** Bỏ mục giữ chỗ (`value=""`, hiện dấu "…") — chỉ lấy lựa chọn thật. */
function optionValues(): string[] {
  const select = screen.getByRole("combobox") as HTMLSelectElement;
  return [...select.options].map((o) => o.value).filter((v) => v !== "");
}

describe("lựa chọn ô điền dạng object", () => {
  it("dạng {text} vẫn ra dropdown", () => {
    renderCloze([{ id: "A", text: "máy bay" }, { id: "B", text: "chim" }]);

    expect(optionValues()).toEqual(["máy bay", "chim"]);
  });

  it("dạng rich {content:{blocks}} rút đúng chữ", () => {
    renderCloze([
      { id: "A", content: { blocks: [{ type: "paragraph", text: "máy bay" }] } },
      { id: "B", content: { blocks: [{ type: "paragraph", text: "chim" }] } },
    ]);

    expect(optionValues()).toEqual(["máy bay", "chim"]);
  });

  it("mảng chuỗi giữ nguyên hành vi cũ", () => {
    renderCloze(["máy bay", "chim"]);

    expect(optionValues()).toEqual(["máy bay", "chim"]);
  });

  it("object rỗng chữ thì KHÔNG dựng dropdown rỗng, trả về ô gõ tay", () => {
    renderCloze([{ id: "A" }, { id: "B" }]);

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});
