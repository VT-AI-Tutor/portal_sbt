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
});

describe("open exercise renderer regressions", () => {
  it("renders tick cells, reports stable row-column keys, and keeps submitted ticks readable", () => {
    const onAnswerChange = vi.fn();
    const payload = {
      selfAssessment: true,
      table: {
        headers: [
          { id: "label", label: "Đoạn" },
          { id: "start", label: "Đầu đoạn" },
          { id: "end", label: "Cuối đoạn" },
        ],
        rows: [
          {
            id: "row-1",
            cells: [
              { columnId: "label", cellType: "static", text: "Đoạn 1" },
              { columnId: "start", cellType: "tick" },
              { columnId: "end", cellType: "tick" },
            ],
          },
        ],
      },
    };

    act(() => {
      root.render(renderInteractionPlayer("table_completion", payload, { onAnswerChange }));
    });

    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(checkboxes).toHaveLength(2);
    act(() => checkboxes[1].click());
    expect(onAnswerChange).toHaveBeenLastCalledWith({ "row-1__end": "true" });

    act(() => {
      root.render(
        renderInteractionPlayer("table_completion", payload, {
          answer: { "row-1__end": "true" },
          submitted: true,
        }),
      );
    });
    const submittedCheckboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    expect(submittedCheckboxes[1].checked).toBe(true);
    expect(submittedCheckboxes.every((checkbox) => checkbox.disabled)).toBe(true);
  });

  it("normalizes content-block placeholders and string word banks through dispatch", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "word_bank" },
            content: {
              blocks: [
                {
                  type: "paragraph",
                  text: "___[blank_1]___ và ___[blank_2]___ là những từ đúng.",
                },
              ],
            },
            wordBank: ["lo lắng", "cách xa", "đáng mến"],
            correctAnswer: { blank_1: "lo lắng", blank_2: "cách xa" },
            selfAssessment: true,
          },
          { onAnswerChange },
        ),
      );
    });

    expect(container.textContent).toContain("lo lắng");
    expect(container.textContent).toContain("cách xa");
    expect(container.querySelectorAll('button[aria-label^="Dòng"]').length).toBe(0);
    expect(container.querySelectorAll("button").length).toBeGreaterThanOrEqual(5);
    expect(container.textContent).not.toContain("___[blank_1]___");

    const word = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("lo lắng"),
    );
    const blank = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("______"),
    );
    expect(word).toBeDefined();
    expect(blank).toBeDefined();
    act(() => {
      word?.click();
    });
    act(() => blank?.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith({ blank_1: "word-1" });
    expect(container.textContent).not.toContain("undefined");
  });

  it("keeps legacy word-bank segments and item IDs intact", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("cloze", {
          display: { interactionType: "word_bank" },
          segments: [
            { text: "Câu này " },
            { blankId: "blank_1" },
            { text: " nhé." },
          ],
          wordBank: [{ id: "w1", text: "đáng mến" }],
          correctAnswer: { blank_1: "w1" },
          selfAssessment: true,
        }, {}),
      );
    });

    expect(container.textContent).toContain("Câu này");
    expect(container.textContent).toContain("đáng mến");
    expect(container.textContent).not.toContain("undefined");
  });

  it("decodes entity-only essay text at the shared rich-text boundary", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("essay", {
          content: {
            blocks: [
              {
                type: "paragraph",
                text: 'Viết 1–2 câu cho biết &quot;điều kì diệu&quot; &amp; cảm nghĩ của em.',
              },
            ],
          },
        }, {}),
      );
    });

    expect(container.textContent).toContain('"điều kì diệu" & cảm nghĩ');
    expect(container.textContent).not.toContain("&quot;");
  });
});
