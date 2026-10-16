/**
 * Issue #795 — Vietnamese input into crossword cells.
 *
 * A Vietnamese letter is typed in several keystrokes (Telex `a`+`s` → `á`), and
 * the operating system's input method reports that through composition events.
 * These tests drive the real event sequence a browser emits, in both the Chrome
 * order (`compositionend` → `input`) and the Firefox order (`input` →
 * `compositionend`), plus the decomposed-letter case.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  vi.unstubAllGlobals();
});

/** Write `value` into the field the way a browser does, then fire `input`. */
function typeRaw(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
}

function composition(input: HTMLInputElement, kind: "compositionstart" | "compositionend") {
  input.dispatchEvent(new CompositionEvent(kind, { bubbles: true }));
}

/**
 * Telex `á`: press `a` (field holds `a`), press `s` (field holds the input
 * method's buffer `as`), the method folds it and commits `á`.
 * `order` picks which of `compositionend` / `input` the browser fires first.
 */
function typeTelex(input: HTMLInputElement, keys: string[], composed: string, order: "chrome" | "firefox") {
  act(() => {
    composition(input, "compositionstart");
    for (const buffer of keys) typeRaw(input, buffer);
    if (order === "chrome") {
      setValue(input, composed);
      composition(input, "compositionend");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      typeRaw(input, composed);
      composition(input, "compositionend");
    }
  });
}

function renderOneCell(props: Record<string, unknown> = {}) {
  act(() => {
    root.render(
      renderInteractionPlayer(
        "crossword",
        {
          size: { rows: 1, cols: 1 },
          entries: [{ id: "one", direction: "across", startRow: 0, startCol: 0, length: 1, clue: "Một" }],
          correctAnswer: { one: "Á" },
        },
        { instantFeedback: false, ...props },
      ),
    );
  });
  return container.querySelector<HTMLInputElement>("input[data-cell-key='0-0']")!;
}

describe("CrosswordPlayer — Vietnamese input (issue #795)", () => {
  it("does not cap the cell at one character, which would refuse the second Telex keystroke", () => {
    const input = renderOneCell();
    expect(input.getAttribute("maxlength")).toBeNull();
  });

  it("never commits the input method's intermediate buffer as the cell's answer", () => {
    const onAnswerChange = vi.fn();
    const input = renderOneCell({ onAnswerChange });

    act(() => {
      composition(input, "compositionstart");
      typeRaw(input, "a");
      typeRaw(input, "as"); // the Telex buffer, mid-fold
    });

    // The regression: `as` was reduced to its last code unit and stored as `S`.
    expect(onAnswerChange).not.toHaveBeenCalledWith({ "0-0": "S" });
    expect(onAnswerChange).not.toHaveBeenCalled();
    // …and the field keeps showing the buffer, so the input method can finish.
    expect(input.value).toBe("as");
  });

  it.each(["chrome", "firefox"] as const)(
    "keeps Á, not the tone key S, when Telex 'as' composes (%s event order)",
    (order) => {
      const onAnswerChange = vi.fn();
      const input = renderOneCell({ onAnswerChange });

      typeTelex(input, ["a", "as"], "á", order);

      expect(onAnswerChange).toHaveBeenLastCalledWith({ "0-0": "Á" });
      expect(input.value).toBe("Á");
    },
  );

  it.each([
    ["â", ["a", "aa"], "â", "Â"],
    ["ô", ["o", "oo"], "ô", "Ô"],
    ["ế", ["e", "ee", "ees"], "ế", "Ế"],
    ["ắ", ["a", "aw", "aws"], "ắ", "Ắ"],
    ["đ", ["d", "dd"], "đ", "Đ"],
  ])("composes %s through its Telex keystrokes", (_label, keys, composed, expected) => {
    const onAnswerChange = vi.fn();
    const input = renderOneCell({ onAnswerChange });

    typeTelex(input, keys as string[], composed as string, "chrome");

    expect(onAnswerChange).toHaveBeenLastCalledWith({ "0-0": expected });
  });

  it("keeps the letter, not the bare accent, when the input method emits NFD", () => {
    const onAnswerChange = vi.fn();
    const input = renderOneCell({ onAnswerChange });

    typeTelex(input, ["a", "aw", "aws"], "ắ".normalize("NFD"), "chrome");

    expect(onAnswerChange).toHaveBeenLastCalledWith({ "0-0": "Ắ".normalize("NFC") });
  });

  it("still accepts a pasted precomposed letter (the path that already worked)", () => {
    const onAnswerChange = vi.fn();
    const input = renderOneCell({ onAnswerChange });

    act(() => typeRaw(input, "ắ"));

    expect(onAnswerChange).toHaveBeenLastCalledWith({ "0-0": "Ắ" });
  });

  it("commits a composition abandoned by clicking away", () => {
    const onAnswerChange = vi.fn();
    const input = renderOneCell({ onAnswerChange });

    act(() => {
      composition(input, "compositionstart");
      typeRaw(input, "a");
      setValue(input, "á");
      input.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(onAnswerChange).toHaveBeenLastCalledWith({ "0-0": "Á" });
  });

  it("grades a decomposed typed letter equal to the composed answer key", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "crossword",
          {
            size: { rows: 1, cols: 3 },
            entries: [{ id: "h1", direction: "across", startRow: 0, startCol: 0, length: 3, clue: "Hoa mùa thu" }],
            // The answer key of b17_i4_q1, precomposed as the payload stores it.
            correctAnswer: { h1: "CÚC" },
          },
          { onStatusChange, instantFeedback: false },
        ),
      );
    });

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    // The student's input method emits the same word decomposed.
    ["C", "Ú".normalize("NFD"), "C"].forEach((value, index) => {
      act(() => typeRaw(inputs[index]!, value));
    });
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());

    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });
});
