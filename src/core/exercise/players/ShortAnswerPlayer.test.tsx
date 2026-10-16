import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortAnswerPlayer } from "./ShortAnswerPlayer";
import { renderInteractionPlayer } from "./dispatch";

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

const textareaValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype,
  "value",
)!.set!;

function typeBlurTextarea(el: HTMLTextAreaElement, value: string) {
  act(() => {
    textareaValueSetter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => el.dispatchEvent(new Event("focusout", { bubbles: true })));
}

it("button-mode wrong Kiểm tra turns the textarea red + shows the feedback line, and typing clears it", () => {
  act(() =>
    root.render(
      <ShortAnswerPlayer title="Q" acceptedAnswers={["bốn"]} instantFeedback={false} />,
    ),
  );
  const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
  typeBlurTextarea(textarea, "sai quá");
  const checkButton = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Kiểm tra",
  )!;
  act(() => checkButton.click());

  expect(textarea.className).toContain("red");
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");

  // Sửa lại → xoá trạng thái sai để thử lại.
  typeBlurTextarea(textarea, "bốn");
  expect(textarea.className).not.toContain("red");
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
});

it("selfAssessment with acceptedAnswers is record-only: no Kiểm tra, blur reports incomplete, never grades", () => {
  const onAnswerChange = vi.fn();
  const onStatusChange = vi.fn();
  act(() =>
    root.render(
      <ShortAnswerPlayer
        title="Q"
        acceptedAnswers={["bốn"]}
        selfAssessment
        onAnswerChange={onAnswerChange}
        onStatusChange={onStatusChange}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");
  const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
  typeBlurTextarea(textarea, "ý kiến của em");
  expect(onAnswerChange).toHaveBeenCalledWith("ý kiến của em");
  expect(onStatusChange).toHaveBeenCalledWith("idle");
  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  expect(onStatusChange).not.toHaveBeenCalledWith("success");
  expect(textarea.className).not.toContain("red");
  expect(textarea.className).not.toContain("green");
  // web-own (SBT-61): chưa bấm "Nộp câu trả lời" thì chưa có dòng ghi nhận nào.
  expect(container.textContent).not.toContain("đã ghi nhận");
  expect(container.textContent).toContain("Nộp câu trả lời");
});

describe("fill_blank + short_text với blanks[] (#509)", () => {
  // Payload tương đương b2_i2_q1 trong issue #509.
  const b2i2q1 = {
    id: "b2_i2_q1",
    content: {
      blocks: [{ type: "paragraph", content: [{ text: "Tìm trong bài đọc:", annotations: {} }] }],
    },
    blanks: [
      { id: "blank_1", label: "a. 3 động từ:" },
      { id: "blank_2", label: "b. 3 tính từ:" },
    ],
    display: { interactionType: "short_text" },
    selfAssessment: true,
    stem: "Tìm trong bài đọc:",
  };

  it("hiển thị đúng thứ tự các label và một ô nhập cho mỗi blank", () => {
    const onAnswerChange = vi.fn();
    act(() => root.render(renderInteractionPlayer("fill_blank", b2i2q1, { onAnswerChange })));

    const labels = Array.from(container.querySelectorAll("label")).map((l) => l.textContent);
    expect(labels).toEqual(["a. 3 động từ:", "b. 3 tính từ:"]);

    const textareas = Array.from(container.querySelectorAll("textarea"));
    expect(textareas).toHaveLength(2);
    // Mỗi label gắn với đúng ô nhập tương ứng.
    const firstLabel = container.querySelector("label")!;
    expect(document.getElementById(firstLabel.htmlFor)).toBe(textareas[0]);

    // selfAssessment: chỉ ghi nhận — không có nút "Kiểm tra".
    expect(container.textContent).not.toContain("Kiểm tra");

    // Câu trả lời được ghi nhận theo đúng blank.id.
    typeBlurTextarea(textareas[1], "vui, đẹp, tươi");
    expect(onAnswerChange).toHaveBeenLastCalledWith({ blank_2: "vui, đẹp, tươi" });
    expect(textareas[1].className).not.toContain("green");
    // web-own (SBT-61): chưa bấm "Nộp câu trả lời" thì chưa có dòng ghi nhận nào.
    expect(container.textContent).not.toContain("đã ghi nhận");
    expect(container.textContent).toContain("Nộp câu trả lời");
  });

  it("chấm từng blank theo correctAnswer khi có đáp án (button mode)", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "fill_blank",
          {
            content: {
              blocks: [{ type: "paragraph", content: [{ text: "Điền:", annotations: {} }] }],
            },
            blanks: [
              { id: "blank_1", label: "a:" },
              { id: "blank_2", label: "b:" },
            ],
            correctAnswer: { blank_1: "chạy", blank_2: "đẹp" },
            display: { interactionType: "short_text" },
          },
          { instantFeedback: false },
        ),
      ),
    );

    const textareas = Array.from(container.querySelectorAll("textarea"));
    typeBlurTextarea(textareas[0], "sai");
    typeBlurTextarea(textareas[1], "đẹp");
    const checkButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Kiểm tra",
    )!;
    act(() => checkButton.click());

    // Ô sai tô đỏ; ô đúng không bị lộ (giữ idle) trong khi còn có thể thử lại.
    expect(textareas[0].className).toContain("red");
    expect(textareas[1].className).not.toContain("green");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
  });

  it("short_text không có blanks[] vẫn là một textarea đơn (regression)", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "fill_blank",
          {
            content: {
              blocks: [{ type: "paragraph", content: [{ text: "Trả lời:", annotations: {} }] }],
            },
            display: { interactionType: "short_text" },
            selfAssessment: true,
          },
          {},
        ),
      ),
    );

    expect(container.querySelectorAll("textarea")).toHaveLength(1);
    expect(container.querySelector("label")).toBeNull();
  });
});
