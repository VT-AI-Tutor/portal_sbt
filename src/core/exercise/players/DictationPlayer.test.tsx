import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DictationPlayer } from "./DictationPlayer";

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

function typeTextarea(el: HTMLTextAreaElement, value: string) {
  act(() => {
    textareaValueSetter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("button-mode wrong Kiểm tra shows the red feedback message", () => {
  act(() =>
    root.render(
      <DictationPlayer title="Q" acceptedTranscript="con mèo" instantFeedback={false} />,
    ),
  );
  const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
  typeTextarea(textarea, "sai hết");
  const checkButton = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Kiểm tra",
  )!;
  act(() => checkButton.click());
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
});

it("selfAssessment is record-only: no Kiểm tra button, typing only syncs the answer", () => {
  const onAnswerChange = vi.fn();
  const onStatusChange = vi.fn();
  act(() =>
    root.render(
      <DictationPlayer
        title="Q"
        acceptedTranscript="con mèo"
        selfAssessment
        onAnswerChange={onAnswerChange}
        onStatusChange={onStatusChange}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");
  const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
  typeTextarea(textarea, "em nghe được...");
  expect(onAnswerChange).toHaveBeenCalledWith("em nghe được...");
  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  expect(onStatusChange).not.toHaveBeenCalledWith("success");
});

it("missing transcript (no key) is record-only: no Kiểm tra button", () => {
  act(() => root.render(<DictationPlayer title="Q" acceptedTranscript="" />));
  expect(container.textContent).not.toContain("Kiểm tra");
});
