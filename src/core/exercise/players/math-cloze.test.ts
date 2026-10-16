import { describe, expect, it } from "vitest";
import type { RichContent } from "@/core/question-schema";
import {
  gradeMathClozeBlank,
  latexAtPath,
  mathBlockPaths,
  shouldApplyPromptState,
  withLatexAtPath,
  stableAnswerKey,
  mathClozeBlankIds,
  mathClozeFormulas,
  stripMathClozeBlocks,
} from "./math-cloze";

const withBlank: RichContent = {
  blocks: [
    { type: "paragraph", content: [{ text: "Điền số thích hợp:", annotations: {} }] },
    { type: "math", latex: "\\frac{3}{\\placeholder[blank_1]{}} = \\placeholder[blank_2]{}" },
  ],
};

describe("mathClozeFormulas", () => {
  it("collects the latex of every math block carrying a blank", () => {
    expect(mathClozeFormulas(withBlank)).toEqual([
      "\\frac{3}{\\placeholder[blank_1]{}} = \\placeholder[blank_2]{}",
    ]);
  });

  it("ignores a plain math block with no blank", () => {
    expect(mathClozeFormulas({ blocks: [{ type: "math", latex: "x^2" }] })).toEqual([]);
  });

  it("keeps document order across several formulas", () => {
    expect(
      mathClozeFormulas({
        blocks: [
          { type: "math", latex: "a = \\placeholder[blank_1]{}" },
          { type: "paragraph", content: [{ text: "và", annotations: {} }] },
          { type: "math", latex: "b = \\placeholder[blank_2]{}" },
        ],
      }),
    ).toEqual(["a = \\placeholder[blank_1]{}", "b = \\placeholder[blank_2]{}"]);
  });

  it("reaches formulas nested in a layout column", () => {
    expect(
      mathClozeFormulas({
        blocks: [
          {
            type: "layout",
            columns: [[{ type: "math", latex: "1 + \\placeholder[blank_1]{} = 3" }]],
          },
        ],
      }),
    ).toEqual(["1 + \\placeholder[blank_1]{} = 3"]);
  });

  it("treats missing content as no formulas", () => {
    expect(mathClozeFormulas(undefined)).toEqual([]);
  });
});

describe("stripMathClozeBlocks", () => {
  it("removes the interactive formula so the header cannot render it twice", () => {
    expect(stripMathClozeBlocks(withBlank)).toEqual({
      blocks: [{ type: "paragraph", content: [{ text: "Điền số thích hợp:", annotations: {} }] }],
    });
  });

  it("keeps a plain math block, which the header still owns", () => {
    const content: RichContent = { blocks: [{ type: "math", latex: "x^2" }] };
    expect(stripMathClozeBlocks(content)).toEqual(content);
  });

  it("returns undefined when nothing but the formula was there", () => {
    expect(
      stripMathClozeBlocks({ blocks: [{ type: "math", latex: "\\placeholder[blank_1]{}" }] }),
    ).toBeUndefined();
  });
});

describe("mathClozeBlankIds", () => {
  it("lists blanks across every formula in order", () => {
    expect(
      mathClozeBlankIds(["a = \\placeholder[blank_1]{}", "b = \\placeholder[blank_2]{}"]),
    ).toEqual(["blank_1", "blank_2"]);
  });

  it("de-duplicates an id repeated across formulas", () => {
    expect(
      mathClozeBlankIds(["\\placeholder[blank_1]{}", "\\placeholder[blank_1]{}"]),
    ).toEqual(["blank_1"]);
  });
});

describe("gradeMathClozeBlank", () => {
  const blank = { id: "blank_1", correctAnswer: ["\\frac{1}{2}"] };

  it("accepts an algebraically equivalent answer", () => {
    expect(gradeMathClozeBlank({ ...blank, gradingMode: "algebraic_equivalence" }, "\\frac{2}{4}")).toBe("correct");
  });

  it("rejects a wrong answer", () => {
    expect(gradeMathClozeBlank({ ...blank, gradingMode: "numeric" }, "0.7")).toBe("incorrect");
  });

  it("falls back to the question-level grading mode", () => {
    expect(gradeMathClozeBlank(blank, "0.5", "numeric")).toBe("correct");
  });

  it("prefers the blank's own mode over the question's", () => {
    expect(gradeMathClozeBlank({ ...blank, gradingMode: "numeric" }, "0.5", "symbolic")).toBe("correct");
  });

  it("reads a Vietnamese decimal comma in the pupil's answer", () => {
    expect(gradeMathClozeBlank({ id: "b", correctAnswer: ["0.6"] }, "0{,}6", "numeric")).toBe("correct");
  });

  it("treats a blank with no key as incorrect rather than throwing", () => {
    expect(gradeMathClozeBlank({ id: "b", correctAnswer: [] }, "1", "numeric")).toBe("incorrect");
  });
});

describe("shouldApplyPromptState", () => {
  it("ghi khi chưa đọc được trạng thái đang hiển thị", () => {
    expect(shouldApplyPromptState(undefined, "correct", true)).toBe(true);
  });

  it("bỏ qua khi đang hiển thị đúng thứ cần hiển thị", () => {
    expect(shouldApplyPromptState({ state: "correct", locked: true }, "correct", true)).toBe(false);
  });

  it("ghi khi verdict đổi", () => {
    expect(shouldApplyPromptState({ state: "incorrect", locked: false }, "correct", true)).toBe(true);
  });

  it("ghi khi riêng trạng thái khoá đổi", () => {
    expect(shouldApplyPromptState({ state: "correct", locked: false }, "correct", true)).toBe(true);
  });

  it("ghi lại khi MathLive đã tự xoá trạng thái", () => {
    // Dựng lại công thức làm mọi ô về trắng; một bộ nhớ cục bộ sẽ tưởng đã ghi rồi.
    expect(shouldApplyPromptState({ state: undefined, locked: false }, "correct", true)).toBe(true);
  });

  it("bỏ qua khi cả hai đều chưa chấm", () => {
    expect(shouldApplyPromptState({ state: undefined, locked: false }, undefined, false)).toBe(false);
  });
});

describe("stableAnswerKey", () => {
  it("cùng nội dung thì cùng khoá, dù là hai đối tượng khác nhau", () => {
    // Host lưu nguyên đối tượng player phát ra rồi trả lại làm prop, nên so bằng
    // ĐỊNH DANH luôn khác — phải so bằng nội dung.
    expect(stableAnswerKey({ a: "1" })).toBe(stableAnswerKey({ a: "1" }));
  });

  it("không phụ thuộc thứ tự khoá", () => {
    expect(stableAnswerKey({ a: "1", b: "2" })).toBe(stableAnswerKey({ b: "2", a: "1" }));
  });

  it("nội dung khác thì khoá khác", () => {
    expect(stableAnswerKey({ a: "1" })).not.toBe(stableAnswerKey({ a: "2" }));
  });

  it("thêm ô mới thì khoá khác", () => {
    expect(stableAnswerKey({ a: "1" })).not.toBe(stableAnswerKey({ a: "1", b: "" }));
  });

  it("bài làm rỗng có khoá ổn định", () => {
    expect(stableAnswerKey({})).toBe(stableAnswerKey({}));
  });
});

describe("mathBlockPaths", () => {
  it("tìm khối toán ở cấp cao nhất", () => {
    expect(mathBlockPaths({ blocks: [{ type: "paragraph" }, { type: "math", latex: "x" }] })).toEqual(
      [[1]],
    );
  });

  it("đi được vào khối toán nằm trong cột", () => {
    // Player đã đi vào `columns`; trình soạn không đi thì công thức ở đó không khai
    // được đáp án và câu âm thầm thành record-only.
    expect(
      mathBlockPaths({
        blocks: [{ type: "layout", columns: [[{ type: "paragraph" }], [{ type: "math", latex: "y" }]] }],
      }),
    ).toEqual([[0, 1, 0]]);
  });

  it("giữ thứ tự tài liệu giữa cấp cao và trong cột", () => {
    expect(
      mathBlockPaths({
        blocks: [
          { type: "math", latex: "a" },
          { type: "layout", columns: [[{ type: "math", latex: "b" }]] },
        ],
      }),
    ).toEqual([[0], [1, 0, 0]]);
  });

  it("nội dung rỗng trả mảng rỗng", () => {
    expect(mathBlockPaths(undefined)).toEqual([]);
  });
});

describe("latexAtPath / withLatexAtPath", () => {
  const nested = {
    blocks: [{ type: "layout", columns: [[{ type: "math", latex: "y^2" }]] }],
  };

  it("đọc được công thức trong cột", () => {
    expect(latexAtPath(nested, [0, 0, 0])).toBe("y^2");
  });

  it("ghi được vào công thức trong cột mà không đụng phần còn lại", () => {
    const next = withLatexAtPath(nested, [0, 0, 0], "z^3");
    expect(latexAtPath(next, [0, 0, 0])).toBe("z^3");
    expect(latexAtPath(nested, [0, 0, 0])).toBe("y^2");
  });

  it("đường dẫn không tồn tại thì đọc ra chuỗi rỗng và ghi không làm gì", () => {
    expect(latexAtPath(nested, [9])).toBe("");
    expect(withLatexAtPath(nested, [9], "x")).toEqual(nested);
  });
});

describe("stripMathClozeBlocks với bố cục nhiều cột", () => {
  it("bỏ luôn khối bố cục khi mọi cột của nó chỉ chứa công thức tương tác", () => {
    expect(
      stripMathClozeBlocks({
        blocks: [{ type: "layout", columns: [[{ type: "math", latex: "\\placeholder[b1]{}" }]] }],
      }),
    ).toBeUndefined();
  });

  it("giữ khối bố cục khi còn cột có nội dung khác", () => {
    const kept = stripMathClozeBlocks({
      blocks: [
        {
          type: "layout",
          columns: [
            [{ type: "paragraph", content: [{ text: "Còn đây", annotations: {} }] }],
            [{ type: "math", latex: "\\placeholder[b1]{}" }],
          ],
        },
      ],
    });
    expect(kept?.blocks).toHaveLength(1);
    expect(kept?.blocks[0].columns).toHaveLength(1);
  });
});

describe("cột vốn đã rỗng thì không bị dọn", () => {
  it("giữ nguyên cột tác giả để trống, chỉ dọn cột TRỞ NÊN rỗng", () => {
    // Dọn cột vốn đã rỗng là sửa nội dung không ai yêu cầu; chỉ cột mất hết nội
    // dung VÌ công thức bị gỡ mới đáng dọn.
    const kept = stripMathClozeBlocks({
      blocks: [
        {
          type: "layout",
          columns: [
            [{ type: "paragraph", content: [{ text: "Còn đây", annotations: {} }] }],
            [],
            [{ type: "math", latex: "\\placeholder[b1]{}" }],
          ],
        },
      ],
    });
    // Cột 1 (có chữ) và cột 2 (tác giả để trống) còn lại; cột 3 bị gỡ theo công thức.
    expect(kept?.blocks[0].columns).toHaveLength(2);
    expect(kept?.blocks[0].columns?.[1]).toEqual([]);
  });

  it("withLatexAtPath không đụng tới cột rỗng của tác giả", () => {
    const content = {
      blocks: [{ type: "layout", columns: [[{ type: "math", latex: "x" }], []] }],
    };
    const next = withLatexAtPath(content, [0, 0, 0], "y");
    expect(next.blocks[0].columns).toHaveLength(2);
    expect(next.blocks[0].columns?.[1]).toEqual([]);
  });
});
