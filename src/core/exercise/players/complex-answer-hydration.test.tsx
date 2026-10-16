/**
 * Bước A — restore (`answer` prop) cho NHÓM PHỨC TẠP: Essay, FormulaEntry,
 * ShortAnswer, QuestionGroup (2 shape hợp đồng), FreeDraw, Speaking.
 *
 * Kênh khôi phục: prop `answer` cha cấp; player hydrate lúc mount (uncontrolled,
 * reset = remount) và chỉ resync khi cha cấp answer KHÁC giá trị hiện tại.
 * Kèm gate nút tự-chấm/tự-nộp theo `mode !== "parent"` (useGrading trả `mode`).
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EssayPlayer } from "./EssayPlayer";
import { FormulaEntryPlayer } from "./FormulaEntryPlayer";
import { FreeDrawPlayer } from "./FreeDrawPlayer";
import { ShortAnswerPlayer } from "./ShortAnswerPlayer";
import { SpeakingPlayer } from "./SpeakingPlayer";
import { GradeModeContext } from "./shared";
import { renderInteractionPlayer } from "./dispatch";
import { typeBlur } from "./instant-test-utils";

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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(element: ReactNode) {
  act(() => root.render(element));
}

function inParentMode(element: ReactNode) {
  return (
    <GradeModeContext.Provider value={{ mode: "parent" }}>{element}</GradeModeContext.Provider>
  );
}

function textareas(): HTMLTextAreaElement[] {
  return Array.from(container.querySelectorAll("textarea"));
}

describe("EssayPlayer answer hydration", () => {
  it("restores single mode from a string answer", () => {
    render(<EssayPlayer title="Viết đoạn văn" answer="Bài viết của em" />);
    expect(textareas()).toHaveLength(1);
    expect(textareas()[0].value).toBe("Bài viết của em");
  });

  it("restores multi mode (prompts) from the string[] emit shape, by slot index", () => {
    render(
      <EssayPlayer
        title="Trả lời từng ý"
        prompts={["Ý a", "Ý b"]}
        answer={["câu một", "câu hai"]}
      />,
    );
    expect(textareas().map((t) => t.value)).toEqual(["câu một", "câu hai"]);
  });

  it("accepts the Record<slotIndex, string> round-trip shape in multi mode", () => {
    render(
      <EssayPlayer
        title="Trả lời từng ý"
        prompts={["Ý a", "Ý b"]}
        answer={{ "0": "câu một", "1": "câu hai" }}
      />,
    );
    expect(textareas().map((t) => t.value)).toEqual(["câu một", "câu hai"]);
  });

  it("does not clobber local typing when the parent merely echoes our own answer back", () => {
    const answers: unknown[] = [];
    render(
      <EssayPlayer title="Viết" answer="" onAnswerChange={(a) => answers.push(a)} />,
    );
    typeBlur(textareas()[0], "đang gõ dở");
    // Cha echo lại đúng giá trị vừa emit — không được reset ô nhập.
    render(
      <EssayPlayer title="Viết" answer="đang gõ dở" onAnswerChange={(a) => answers.push(a)} />,
    );
    expect(textareas()[0].value).toBe("đang gõ dở");
    expect(answers).toContain("đang gõ dở");
  });

  // web-own (SBT-61): nút "Nộp câu trả lời" trong câu ở MỌI chế độ, thay "Lưu câu trả
  // lời" — luật đầy đủ khoá ở recorded-receipt.test.tsx.
  it('shows the in-question "Nộp câu trả lời" in every mode', () => {
    render(<EssayPlayer title="Viết" />);
    expect(container.textContent).toContain("Nộp câu trả lời");

    render(<EssayPlayer title="Viết" instantFeedback={false} />);
    expect(container.textContent).toContain("Nộp câu trả lời");

    render(inParentMode(<EssayPlayer title="Viết" instantFeedback={false} />));
    expect(container.textContent).toContain("Nộp câu trả lời");
    expect(container.textContent).not.toContain("Lưu câu trả lời");
  });
});

describe("FormulaEntryPlayer answer hydration", () => {
  // inputMode="text": <math-field> không hoạt động trong jsdom (xem
  // FormulaEntryPlayer.test.tsx) — MathField nhận cùng prop `value` nên đường
  // hydrate là một; phần sync value→mathlive đã nằm sẵn trong MathField.
  it("restores the LaTeX string answer into the input", () => {
    render(
      <FormulaEntryPlayer
        title="Tính"
        inputMode="text"
        acceptedAnswers={["\\frac{1}{2}"]}
        answer={"\\frac{1}{2}"}
      />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("\\frac{1}{2}");
  });

  it('gates the "Kiểm tra" button on mode !== "parent"', () => {
    render(
      <FormulaEntryPlayer title="Tính" inputMode="text" acceptedAnswers={["4"]} instantFeedback={false} />,
    );
    expect(container.textContent).toContain("Kiểm tra");

    render(
      inParentMode(
        <FormulaEntryPlayer title="Tính" inputMode="text" acceptedAnswers={["4"]} instantFeedback={false} />,
      ),
    );
    expect(container.textContent).not.toContain("Kiểm tra");
  });
});

describe("ShortAnswerPlayer answer hydration", () => {
  it("restores the single-textarea branch from a string answer", () => {
    render(<ShortAnswerPlayer title="Trả lời ngắn" answer="đáp án của em" />);
    expect(textareas()[0].value).toBe("đáp án của em");
  });

  it("restores the multi-blank branch from a Record<blankId, string> answer", () => {
    render(
      <ShortAnswerPlayer
        title="Trả lời ngắn"
        blanks={[
          { id: "b1", label: "Ý 1" },
          { id: "b2", label: "Ý 2" },
        ]}
        answer={{ b1: "một", b2: "hai" }}
      />,
    );
    expect(textareas().map((t) => t.value)).toEqual(["một", "hai"]);
  });

  it('gates the "Kiểm tra" button on mode !== "parent" in both branches', () => {
    render(
      <ShortAnswerPlayer title="Q" acceptedAnswers={["x"]} instantFeedback={false} />,
    );
    expect(container.textContent).toContain("Kiểm tra");
    render(
      inParentMode(<ShortAnswerPlayer title="Q" acceptedAnswers={["x"]} instantFeedback={false} />),
    );
    expect(container.textContent).not.toContain("Kiểm tra");

    const blanks = [
      { id: "b1", label: "Ý 1", acceptedAnswers: ["x"] },
      { id: "b2", label: "Ý 2", acceptedAnswers: ["y"] },
    ];
    render(
      <ShortAnswerPlayer title="Q" blanks={blanks} instantFeedback={false} />,
    );
    expect(container.textContent).toContain("Kiểm tra");
    render(
      inParentMode(<ShortAnswerPlayer title="Q" blanks={blanks} instantFeedback={false} />),
    );
    expect(container.textContent).not.toContain("Kiểm tra");
  });
});

describe("QuestionGroupRestore — envelope {answers, order} VÀ Record phẳng {childId: answer}", () => {
  const groupPayload = {
    id: "g1",
    type: "question_group",
    display: { interactionType: "group" },
    content: { blocks: [{ type: "paragraph", text: "Đọc và trả lời." }] },
    children: [
      { id: "c1", type: "essay" },
      { id: "c2", type: "essay" },
    ],
  };

  it("restores child c1 from the {answers, order} envelope", () => {
    render(
      renderInteractionPlayer("question_group", groupPayload, {
        answer: { answers: { c1: "A" }, order: ["c1", "c2"] },
      }),
    );
    expect(textareas().map((t) => t.value)).toEqual(["A", ""]);
  });

  it("restores child c1 from the flat Record shape (web's second contract)", () => {
    render(
      renderInteractionPlayer("question_group", groupPayload, {
        answer: { c1: "A" },
      }),
    );
    expect(textareas().map((t) => t.value)).toEqual(["A", ""]);
  });

  it("keeps restored sibling answers in the emitted envelope after editing one child", () => {
    const onAnswerChange = vi.fn();
    render(
      renderInteractionPlayer("question_group", groupPayload, {
        answer: { answers: { c1: "A" }, order: ["c1", "c2"] },
        onAnswerChange,
      }),
    );
    typeBlur(textareas()[1], "B");
    expect(onAnswerChange).toHaveBeenLastCalledWith({
      answers: { c1: "A", c2: "B" },
      order: ["c1", "c2"],
    });
  });

  it("keeps restored sibling answers when hydrated from the flat Record shape too", () => {
    const onAnswerChange = vi.fn();
    render(
      renderInteractionPlayer("question_group", groupPayload, {
        answer: { c1: "A" },
        onAnswerChange,
      }),
    );
    typeBlur(textareas()[1], "B");
    expect(onAnswerChange).toHaveBeenLastCalledWith({
      answers: { c1: "A", c2: "B" },
      order: ["c1", "c2"],
    });
  });
});

describe("FreeDrawPlayer answer hydration", () => {
  const dataUrl = "data:image/png;base64,iVBORw0KGgo=";

  it("mounts without crashing on a restored dataURL answer (jsdom: no 2d context)", () => {
    render(<FreeDrawPlayer title="Vẽ" answer={dataUrl} />);
    expect(container.querySelector("canvas")).not.toBeNull();
    // web-own: bản vẽ cũ được khôi phục nhưng KHÔNG kèm dòng ghi nhận — dòng đó
    // chỉ do nút "Nộp câu trả lời" bật (xem FreeDrawPlayer.test.tsx, describe
    // "FreeDrawPlayer confirm button"). Ảnh cũ có thể là bài vẽ dở.
    expect(container.textContent).not.toContain("Hệ thống đã ghi nhận");
  });

  it("redraws the restored dataURL onto the canvas, scale-to-fit", () => {
    const ctx = {
      fillStyle: "",
      globalCompositeOperation: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    class ImmediateImage {
      onload: (() => void) | null = null;
      width = 800;
      height = 560;
      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", ImmediateImage);

    render(<FreeDrawPlayer title="Vẽ" answer={dataUrl} />);

    // Nền trắng rồi vẽ lại bản chụp; cùng kích thước canvas → scale = 1, tại (0,0).
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 560);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    const [, x, y, w, h] = ctx.drawImage.mock.calls[0];
    expect([x, y, w, h]).toEqual([0, 0, 800, 560]);
  });

  it("ignores a non-dataURL answer and keeps the blank-canvas path", () => {
    render(<FreeDrawPlayer title="Vẽ" answer={{ not: "an image" }} />);
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.textContent).not.toContain("Hệ thống đã ghi nhận");
  });
});

describe("SpeakingPlayer stale answer", () => {
  it("does not crash on a restored {audioRef, durationMs} whose blob URL is gone", () => {
    // audioRef là blob URL phù du — không khôi phục được cross-session; player
    // phải bỏ qua answer cũ và render trạng thái ghi âm ban đầu.
    render(
      <SpeakingPlayer
        title="Nói"
        answer={{ audioRef: "blob:http://localhost/dead-beef", durationMs: 4000 }}
      />,
    );
    expect(container.textContent).toContain("Nhấn nút để bắt đầu ghi âm");
  });
});
