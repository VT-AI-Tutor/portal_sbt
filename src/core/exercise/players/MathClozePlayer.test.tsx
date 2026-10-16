import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MathClozePlayer } from "./MathClozePlayer";
import { MATH_FIELD_AS_CONTENT } from "./math-field-chrome";

/**
 * MathLive's custom element does not upgrade in jsdom, so `<math-field>` here is an
 * inert element. That is enough: `MathField` reads `element.value` on `input`, so
 * setting the property and dispatching the event drives the player through exactly
 * the path a real MathLive edit takes. Painting inside the formula
 * (`setPromptState`) is the part only a browser can show, and is verified manually.
 */
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const FORMULA = "\\frac{3}{\\placeholder[blank_1]{}} = \\placeholder[blank_2]{}";

function fields() {
  return Array.from(container.querySelectorAll("math-field")) as Array<
    HTMLElement & { value?: string }
  >;
}

/** Type into the formula the way MathLive would: whole latex, prompts inlined. */
function editFormula(latex: string) {
  const field = fields()[0];
  field.value = latex;
  act(() => {
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function blurFormula() {
  act(() => {
    fields()[0].dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

function render(props: Partial<React.ComponentProps<typeof MathClozePlayer>> = {}) {
  act(() => {
    root.render(
      <MathClozePlayer
        title="Q"
        formulas={[FORMULA]}
        blanks={[
          { id: "blank_1", correctAnswer: ["5"], gradingMode: "numeric" },
          { id: "blank_2", correctAnswer: ["\\frac{3}{5}"], gradingMode: "algebraic_equivalence" },
        ]}
        {...props}
      />,
    );
  });
}

describe("MathClozePlayer", () => {
  it("renders one field per formula", () => {
    render({ formulas: [FORMULA, "a = \\placeholder[blank_3]{}"] });
    expect(fields()).toHaveLength(2);
  });

  it("restores a part-finished answer so it grades without retyping", () => {
    // Cái được viết trở lại công thức thì `writeMathPlaceholderValues` đã chốt
    // riêng; ở đây kiểm rằng bài làm phục hồi đi thẳng vào luật chấm.
    const onElementGraded = vi.fn();
    render({ onElementGraded, answer: { blank_1: "5", blank_2: "\\frac{3}{5}" } });
    blurFormula();
    expect(onElementGraded).toHaveBeenCalledWith("blank_1", "correct", undefined);
    expect(onElementGraded).toHaveBeenCalledWith("blank_2", "correct", undefined);
  });

  it("grades each blank independently on blur", () => {
    const onElementGraded = vi.fn();
    render({ onElementGraded });
    editFormula("\\frac{3}{\\placeholder[blank_1]{5}} = \\placeholder[blank_2]{7}");
    blurFormula();
    expect(onElementGraded).toHaveBeenCalledWith("blank_1", "correct", undefined);
    expect(onElementGraded).toHaveBeenCalledWith("blank_2", "incorrect", undefined);
  });

  it("accepts an algebraically equivalent answer in a blank", () => {
    const onElementGraded = vi.fn();
    render({ onElementGraded });
    editFormula("\\frac{3}{\\placeholder[blank_1]{5}} = \\placeholder[blank_2]{0.6}");
    blurFormula();
    expect(onElementGraded).toHaveBeenCalledWith("blank_2", "correct", undefined);
  });

  it("reads a Vietnamese decimal comma typed into a blank", () => {
    const onElementGraded = vi.fn();
    render({ onElementGraded });
    editFormula("\\frac{3}{\\placeholder[blank_1]{5}} = \\placeholder[blank_2]{0{,}6}");
    blurFormula();
    expect(onElementGraded).toHaveBeenCalledWith("blank_2", "correct", undefined);
  });

  it("leaves an empty blank ungraded rather than wrong", () => {
    const onElementGraded = vi.fn();
    render({ onElementGraded });
    editFormula("\\frac{3}{\\placeholder[blank_1]{5}} = \\placeholder[blank_2]{}");
    blurFormula();
    expect(onElementGraded).toHaveBeenCalledWith("blank_1", "correct", undefined);
    expect(onElementGraded).not.toHaveBeenCalledWith("blank_2", "incorrect", undefined);
  });

  it("emits the answer as a map keyed by blank id", () => {
    const onAnswerChange = vi.fn();
    render({ onAnswerChange });
    editFormula("\\frac{3}{\\placeholder[blank_1]{5}} = \\placeholder[blank_2]{}");
    expect(onAnswerChange).toHaveBeenCalledWith({ blank_1: "5", blank_2: "" });
  });

  it("reads answers back out of MathLive's re-serialised latex", () => {
    // MathLive trả về công thức đã chuẩn hoá lại khoảng trắng: `} = \\placeholder`
    // thành `}=\\placeholder`. Bài làm phải đọc ra đúng bất kể chuyện đó.
    const onElementGraded = vi.fn();
    render({ onElementGraded });
    editFormula("\\frac{3}{\\placeholder[blank_1]{5}}=\\placeholder[blank_2]{0.6}");
    blurFormula();
    expect(onElementGraded).toHaveBeenCalledWith("blank_1", "correct", undefined);
    expect(onElementGraded).toHaveBeenCalledWith("blank_2", "correct", undefined);
  });

  it("offers the Kiểm tra button when instant feedback is off", () => {
    render({ instantFeedback: false });
    expect(container.textContent).toContain("Kiểm tra");
  });

  it("does not grade a question whose blanks carry no key", () => {
    const onElementGraded = vi.fn();
    render({ onElementGraded, blanks: [] });
    editFormula("\\frac{3}{\\placeholder[blank_1]{5}} = \\placeholder[blank_2]{1}");
    blurFormula();
    expect(onElementGraded).not.toHaveBeenCalled();
  });
});

describe("MathClozePlayer dưới một parent có echo (đúng như runtime thật)", () => {
  /**
   * `QuestionRenderer` lưu bài làm bằng `onAnswerChange={setAnswer}` rồi trả lại
   * làm prop `answer`, nên mỗi phím gõ cha đẩy xuống một ĐỐI TƯỢNG MỚI cùng nội
   * dung. Không bài test nào trước đây dựng player theo cách này, nên lỗi "dựng
   * lại công thức mỗi phím gõ" lọt qua cả bộ test lẫn các lượt thử tay.
   */
  function EchoHost() {
    const [answer, setAnswer] = React.useState<unknown>(undefined);
    return (
      <MathClozePlayer
        title="Q"
        formulas={[FORMULA]}
        blanks={[{ id: "blank_1", correctAnswer: ["5"], gradingMode: "numeric" }]}
        answer={answer}
        onAnswerChange={setAnswer}
      />
    );
  }

  it("không đẩy ngược một công thức dựng lại về trường sau mỗi phím gõ", () => {
    act(() => root.render(<EchoHost />));
    const field = fields()[0] as HTMLElement & { value?: string; setValue?: unknown };
    // Giả lập MathLive: có setValue, và tuần tự hoá lại BỎ khoảng trắng quanh dấu =
    const setValue = vi.fn();
    field.setValue = setValue;
    field.value = "\\frac{3}{\\placeholder[blank_1]{5}}=\\placeholder[blank_2]{}";
    act(() => {
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(setValue).not.toHaveBeenCalled();
  });

  it("vẫn nhận bài làm mới khi cha đẩy xuống nội dung KHÁC", () => {
    let external: ((value: unknown) => void) | undefined;
    function Host() {
      const [answer, setAnswer] = React.useState<unknown>(undefined);
      external = setAnswer;
      return <MathClozePlayer title="Q" formulas={[FORMULA]} blanks={[]} answer={answer} />;
    }
    act(() => root.render(<Host />));
    const field = fields()[0] as HTMLElement & { value?: string; setValue?: unknown };
    const setValue = vi.fn();
    field.setValue = setValue;
    field.value = "";
    act(() => external!({ blank_1: "9" }));
    expect(setValue).toHaveBeenCalled();
  });
});

describe("bài làm cha đẩy xuống đi thẳng vào luật chấm", () => {
  it("chấm theo bài làm mới ngay ở cú blur đầu tiên", () => {
    // `valuesRef` do HAI cơ chế nuôi: ghi đồng bộ ở `readField`, và một effect cho
    // đường cha đẩy xuống. Bất biến này trước đây chỉ nằm trong comment.
    const onElementGraded = vi.fn();
    function Host({ answer }: { answer: unknown }) {
      return (
        <MathClozePlayer
          title="Q"
          formulas={[FORMULA]}
          blanks={[{ id: "blank_1", correctAnswer: ["5"], gradingMode: "numeric" }]}
          answer={answer}
          onElementGraded={onElementGraded}
        />
      );
    }
    act(() => root.render(<Host answer={undefined} />));
    act(() => root.render(<Host answer={{ blank_1: "5" }} />));
    blurFormula();
    expect(onElementGraded).toHaveBeenCalledWith("blank_1", "correct", undefined);
  });
});

describe("biểu thức trông như NỘI DUNG, không như ô nhập", () => {
  it("không khoác lớp ô nhập lên biểu thức", () => {
    // Phản ánh đã nhận: câu điền vào biểu thức hiện ra y như câu tự luận, vì mỗi
    // công thức bị bọc trong `skin.input("idle")` — một khung viền kiểu ô nhập —
    // trong khi công thức bị khoá và chỉ các ô trống mới nhận chữ.
    act(() =>
      root.render(
        <MathClozePlayer
          title="Q"
          formulas={[FORMULA]}
          blanks={[{ id: "blank_1", correctAnswer: ["5"], gradingMode: "numeric" }]}
        />,
      ),
    );
    const field = container.querySelector("math-field")!;
    expect(field.className).toBe(MATH_FIELD_AS_CONTENT);
  });

  it("nhúng luật ẩn nút chrome của MathLive", () => {
    // `::part()` là cửa duy nhất chạm được vào shadow DOM, nên luật phải là CSS
    // thật; mất thẻ style là hai nút hiện lại và ô lại trông như chỗ gõ.
    act(() =>
      root.render(
        <MathClozePlayer
          title="Q"
          formulas={[FORMULA]}
          blanks={[{ id: "blank_1", correctAnswer: ["5"], gradingMode: "numeric" }]}
        />,
      ),
    );
    const css = Array.from(container.querySelectorAll("style"))
      .map((node) => node.textContent ?? "")
      .join("");
    expect(css).toContain("::part(virtual-keyboard-toggle)");
    expect(css).toContain("::part(menu-toggle)");
  });
});
