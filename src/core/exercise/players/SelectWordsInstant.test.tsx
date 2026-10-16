/**
 * Instant per-element grading for SelectWordsPlayer: each selectable word is
 * one element; clicking it grades that word immediately (chip turns red/green
 * without waiting for "Kiểm tra"). Deselecting clears it back to idle.
 */
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SelectWordsPlayer } from "./SelectWordsPlayer";

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

const passage = "con mèo ngồi";
// word indices: 0=con, 1=mèo, 2=ngồi
const correctWords = [1];

function clickWord(t: string) {
  const el = Array.from(container.querySelectorAll('[role="button"]')).find((b) =>
    b.textContent?.includes(t),
  );
  act(() => el!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

it('emits onElementGraded("incorrect") and turns the word red when a wrong word is selected', () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <SelectWordsPlayer
        title="Q"
        passage={passage}
        correctWords={correctWords}
        onElementGraded={onElementGraded}
      />,
    ),
  );
  clickWord("con"); // wrong word (index 0)
  expect(onElementGraded).toHaveBeenCalledWith("0", "incorrect", undefined);
  const el = Array.from(container.querySelectorAll('[role="button"]')).find((b) =>
    b.textContent?.includes("con"),
  )!;
  expect(el.className).toMatch(/red/);
});

it("hides Kiểm tra when instant, shows it when instantFeedback=false", () => {
  act(() =>
    root.render(
      <SelectWordsPlayer title="Q" passage={passage} correctWords={correctWords} />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");

  act(() =>
    root.render(
      <SelectWordsPlayer
        title="Q"
        passage={passage}
        correctWords={correctWords}
        instantFeedback={false}
      />,
    ),
  );
  expect(container.textContent).toContain("Kiểm tra");
});

it("a correct word turns green immediately, and clicking it again (deselect) clears it back to idle", () => {
  act(() =>
    root.render(
      <SelectWordsPlayer title="Q" passage={passage} correctWords={correctWords} />,
    ),
  );
  clickWord("mèo"); // correct word (index 1)
  const el = () =>
    Array.from(container.querySelectorAll('[role="button"]')).find((b) =>
      b.textContent?.includes("mèo"),
    )!;
  expect(el().className).toMatch(/green/);

  clickWord("mèo"); // deselect
  expect(el().className).not.toMatch(/green/);
  expect(el().className).not.toMatch(/red/);
});

it("button-mode wrong Kiểm tra turns wrong-selected words red + shows the feedback line, without leaking, and clears on retry", () => {
  act(() =>
    root.render(
      <SelectWordsPlayer
        title="Q"
        passage={passage}
        correctWords={correctWords}
        instantFeedback={false}
      />,
    ),
  );
  clickWord("con"); // sai (index 0)
  const checkButton = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Kiểm tra",
  )!;
  act(() => checkButton.click());

  const word = (t: string) =>
    Array.from(container.querySelectorAll('[role="button"]')).find((b) =>
      b.textContent?.includes(t),
    )!;
  expect(word("con").className).toMatch(/red/);
  // Từ đúng chưa chọn KHÔNG được gợi ý xanh — không lộ đáp án khi còn thử lại.
  expect(word("mèo").className).not.toMatch(/green/);
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng rồi, thử lại nhé!");

  // Đổi lựa chọn (bỏ chọn từ sai) → xoá trạng thái sai.
  clickWord("con");
  expect(word("con").className).not.toMatch(/red/);
  expect(container.textContent).not.toContain("Chưa đúng rồi, thử lại nhé!");
});

it("record-only (no key): hides Kiểm tra, syncs the selection as incomplete, never grades", () => {
  const onAnswerChange = vi.fn();
  const onStatusChange = vi.fn();
  act(() =>
    root.render(
      <SelectWordsPlayer
        title="Q"
        passage={passage}
        correctWords={[]}
        onAnswerChange={onAnswerChange}
        onStatusChange={onStatusChange}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");
  clickWord("mèo");
  expect(onAnswerChange).toHaveBeenCalledWith([1]);
  expect(onStatusChange).toHaveBeenCalledWith("idle");
  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  const el = Array.from(container.querySelectorAll('[role="button"]')).find((b) =>
    b.textContent?.includes("mèo"),
  )!;
  expect(el.className).not.toMatch(/red|green/);
});

it("fires onElementGraded exactly once per click under StrictMode (no double-fire)", () => {
  // Grading must live OUTSIDE the setState updater — StrictMode double-invokes
  // updaters in dev, which would otherwise double-fire the signal.
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <StrictMode>
        <SelectWordsPlayer
          title="Q"
          passage={passage}
          correctWords={correctWords}
          onElementGraded={onElementGraded}
        />
      </StrictMode>,
    ),
  );
  clickWord("con");
  expect(onElementGraded).toHaveBeenCalledTimes(1);
});
