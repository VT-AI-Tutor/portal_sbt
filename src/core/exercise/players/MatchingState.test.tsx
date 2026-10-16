import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const payload = {
  type: "matching",
  leftItems: [{ id: "a", text: "A" }],
  rightItems: [{ id: "x", text: "X" }, { id: "y", text: "Y" }],
  correctAnswer: [{ item: "a", target: "x" }, { item: "a", target: "y" }],
};

function click(text: string) {
  act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === text)?.click());
}

describe("matching canonical edge state", () => {
  it("keeps repeated sources and grades the exact edge set", () => {
    const onAnswerChange = vi.fn();
    const onStatusChange = vi.fn();
    // Kiểm tra logic canonical edge-set qua đường "Kiểm tra" (batch). Hành vi
    // instant per-element có test riêng (MatchRowsInstant.test.tsx).
    act(() => root.render(renderInteractionPlayer("matching", payload, { questionId: "q-a", instantFeedback: false, onAnswerChange, onStatusChange })));
    click("A"); click("X"); click("A"); click("Y"); click("Kiểm tra");
    expect(onAnswerChange).toHaveBeenLastCalledWith([
      { item: "a", target: "x" },
      { item: "a", target: "y" },
    ]);
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });

  it("rejects unknown extra edges", () => {
    const onStatusChange = vi.fn();
    act(() => root.render(renderInteractionPlayer("matching", { ...payload, correctAnswer: [{ item: "a", target: "x" }] }, {
      questionId: "q-extra",
      instantFeedback: false,
      answer: [{ item: "a", target: "x" }, { item: "ghost", target: "x" }],
      onStatusChange,
    })));
    click("Kiểm tra");
    expect(onStatusChange).toHaveBeenLastCalledWith("error");
  });

  it("remounts state and grading when question identity changes with undefined answer", () => {
    const single = { ...payload, correctAnswer: [{ item: "a", target: "x" }] };
    act(() => root.render(renderInteractionPlayer("matching", single, { questionId: "q-a", instantFeedback: false })));
    click("A"); click("X"); click("Kiểm tra");
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "A")?.disabled).toBe(true);

    act(() => root.render(renderInteractionPlayer("matching", single, { questionId: "q-b", instantFeedback: false, answer: undefined })));
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "A")?.disabled).toBe(false);
    expect(container.querySelectorAll('line[data-line-role="fill"]')).toHaveLength(0);
  });
});
