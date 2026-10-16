import { act, StrictMode } from "react";
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

function fillInput(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const entries = [
  { id: "across", direction: "across", startRow: 0, startCol: 0, length: 3, clue: "Ngang" },
  { id: "down", direction: "down", startRow: 0, startCol: 0, length: 2, clue: "Dọc" },
];

const b2OchuLikeFixture = {
  size: { rows: 10, cols: 8 },
  entries: [
    { id: "row-1", direction: "across", startRow: 0, startCol: 1, length: 9, clue: "Nơi em học tập" },
    { id: "row-2", direction: "across", startRow: 1, startCol: 0, length: 7, clue: "Người đang đi học" },
    { id: "row-3", direction: "across", startRow: 2, startCol: 2, length: 8, clue: "Người dạy học (nam)" },
    { id: "row-4", direction: "across", startRow: 3, startCol: 1, length: 6, clue: "Người dạy học (nữ)" },
    { id: "row-5", direction: "across", startRow: 4, startCol: 0, length: 12, clue: "Sách dùng trong nhà trường" },
    { id: "row-6", direction: "across", startRow: 5, startCol: 0, length: 7, clue: "Nơi giáo viên viết bài" },
    { id: "row-7", direction: "across", startRow: 6, startCol: 2, length: 6, clue: "Dụng cụ dùng để viết" },
    { id: "row-8", direction: "across", startRow: 7, startCol: 1, length: 7, clue: "Dụng cụ dùng để kẻ" },
    { id: "row-9", direction: "across", startRow: 8, startCol: 0, length: 7, clue: "Vật dùng để đựng sách" },
    { id: "row-10", direction: "across", startRow: 9, startCol: 3, length: 6, clue: "Phòng dành cho một lớp" },
  ],
  correctAnswer: {
    "row-1": "TRUONGHOC",
    "row-2": "HOCSINH",
    "row-3": "THAYGIAO",
    "row-4": "COGIAO",
    "row-5": "SACHGIAOKHOA",
    "row-6": "BANGDEN",
    "row-7": "BUTCHI",
    "row-8": "THUOCKE",
    "row-9": "CAP SACH",
    "row-10": "LOPHOC",
  },
} as const;

describe("CrosswordPlayer geometry", () => {
  it("hydrates saved cells and emits one callback per edit under StrictMode", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <StrictMode>
          {renderInteractionPlayer(
            "crossword",
            { size: { rows: 1, cols: 1 }, entries: [{ id: "one", direction: "across", startRow: 0, startCol: 0, length: 1, clue: "Một" }] },
            { answer: { "0-0": "A" }, onAnswerChange, instantFeedback: false },
          )}
        </StrictMode>,
      );
    });

    const input = container.querySelector<HTMLInputElement>("input[data-cell-key='0-0']")!;
    expect(input.value).toBe("A");
    onAnswerChange.mockClear();
    fillInput(input, "B");
    expect(onAnswerChange).toHaveBeenCalledTimes(1);
    expect(onAnswerChange).toHaveBeenLastCalledWith({ "0-0": "B" });
  });

  it("renders white cells from length and coordinates without an answer key", () => {
    const onAnswerChange = vi.fn();
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "crossword",
          { size: { rows: 4, cols: 4 }, entries },
          { onAnswerChange, onStatusChange, instantFeedback: false },
        ),
      );
    });

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    expect(inputs).toHaveLength(4);

    fillInput(inputs[0], "h");
    expect(onAnswerChange).toHaveBeenLastCalledWith({ "0-0": "H" });
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
    expect(inputs.every((input) => !input.disabled)).toBe(true);
  });

  it("keeps coordinate geometry while grading the separate answer key", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "crossword",
          { size: { rows: 4, cols: 4 }, entries, correctAnswer: { across: "CAT", down: "CD" } },
          { onStatusChange, instantFeedback: false },
        ),
      );
    });

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    expect(inputs).toHaveLength(4);
    ["C", "A", "T", "D"].forEach((value, index) => fillInput(inputs[index], value));
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());

    expect(onStatusChange).toHaveBeenLastCalledWith("success");
    expect(inputs.every((input) => input.disabled)).toBe(true);
  });

  it("does not allocate cells for answer whitespace and looks answers up by entry ID", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "crossword",
          {
            size: { rows: 1, cols: 1 },
            entries: [
              { id: "city-name", direction: "across", startRow: 0, startCol: 0, clue: "Thành phố" },
            ],
            correctAnswer: { "city-name": "HÀ NỘI" },
          },
          { onStatusChange, instantFeedback: false },
        ),
      );
    });

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    expect(inputs).toHaveLength(5);
    ["H", "À", "N", "Ộ", "I"].forEach((value, index) => fillInput(inputs[index], value));
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });

  it("renders given cells as static letters, keeps them out of grading, and honours printed numbers", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "crossword",
          {
            size: { rows: 2, cols: 3 },
            entries: [
              { id: "across", direction: "across", startRow: 0, startCol: 0, length: 3, clue: "Ngang", number: 1, given: [0] },
              { id: "down", direction: "down", startRow: 0, startCol: 0, length: 2, clue: "Dọc", number: 2 },
            ],
            correctAnswer: { across: "CAT", down: "CD" },
          },
          { onStatusChange, instantFeedback: false },
        ),
      );
    });

    // The given cell is static text, not an input.
    const givenCell = container.querySelector<HTMLElement>('[data-given="true"][data-cell-key="0-0"]')!;
    expect(givenCell.tagName).not.toBe("INPUT");
    expect(givenCell.textContent).toBe("C");
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    expect(inputs).toHaveLength(3);

    // Filling only the non-given cells is enough to be correct.
    ["A", "T", "D"].forEach((value, index) => fillInput(inputs[index], value));
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    expect(onStatusChange).toHaveBeenLastCalledWith("success");

    // Numbers come from the payload, not from cell position.
    const clues = Array.from(container.querySelectorAll("li")).map((li) => li.textContent);
    expect(clues).toEqual(["1. Ngang", "2. Dọc"]);
  });

  it("tints exactly the keyword entry's cells, derived from its own geometry", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "crossword",
          {
            size: { rows: 2, cols: 3 },
            entries: [
              { id: "across", direction: "across", startRow: 0, startCol: 0, length: 3, clue: "Ngang" },
              { id: "down", direction: "down", startRow: 0, startCol: 0, length: 2, clue: "Dọc", display: { role: "keyword" } },
            ],
            correctAnswer: { across: "CAT", down: "CD" },
          },
          { instantFeedback: false },
        ),
      );
    });

    // The keyword run is the down entry's own cells: (0,0) and (1,0) — nothing else.
    const tinted = Array.from(container.querySelectorAll<HTMLElement>("[data-cell-key]"))
      .filter((cell) => cell.className.includes("!bg-amber-100"))
      .map((cell) => cell.getAttribute("data-cell-key"));
    expect(tinted.sort()).toEqual(["0-0", "1-0"]);
  });

  it("renders clue content blocks — text, picture-only, and both — and keeps the legacy string working", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "crossword",
          {
            size: { rows: 3, cols: 3 },
            entries: [
              {
                id: "text", direction: "across", startRow: 0, startCol: 0, length: 3, number: 1,
                content: { blocks: [{ type: "paragraph", text: "Gợi ý bằng chữ" }] },
              },
              {
                // VBT Âm nhạc 2: the book prints only a photo, no wording at all.
                id: "picture", direction: "across", startRow: 1, startCol: 0, length: 3, number: 2,
                content: { blocks: [{ type: "image", url: "/chim.png", altText: "Chim gáy" }] },
              },
              {
                id: "both", direction: "across", startRow: 2, startCol: 0, length: 3, number: 3,
                content: {
                  blocks: [
                    { type: "paragraph", text: "Con gì?" },
                    { type: "image", url: "/meo.png", altText: "Mèo" },
                  ],
                },
              },
            ],
            correctAnswer: { text: "CAT", picture: "DOG", both: "PIG" },
          },
          { instantFeedback: false },
        ),
      );
    });

    const clues = Array.from(container.querySelectorAll("li"));
    expect(clues[0].textContent).toContain("Gợi ý bằng chữ");
    // Picture-only clue: the image renders even though there is no text to fall
    // back on. `src` arrives resolved against the API origin, so match the tail.
    expect(clues[1].querySelector("img")?.getAttribute("src")).toMatch(/\/chim\.png$/);
    expect(clues[2].textContent).toContain("Con gì?");
    expect(clues[2].querySelector("img")?.getAttribute("src")).toMatch(/\/meo\.png$/);
  });

  it("ignores a given index with no letter behind it so the cell stays typeable", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "crossword",
          {
            size: { rows: 1, cols: 3 },
            // Answer key withheld: `given` resolves to no letter, so nothing is frozen.
            entries: [{ id: "across", direction: "across", startRow: 0, startCol: 0, length: 3, clue: "Ngang", given: [0, 9] }],
          },
          { instantFeedback: false },
        ),
      );
    });

    expect(container.querySelector('[data-given="true"]')).toBeNull();
    expect(container.querySelectorAll("input")).toHaveLength(3);
  });

  it("renders a realistic 10-row b2_ochu-like board that fits its column without horizontal scroll", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("crossword", b2OchuLikeFixture, {}),
      );
    });

    const gridRegion = container.querySelector<HTMLElement>("[data-crossword-grid]");
    const grid = gridRegion?.firstElementChild as HTMLElement | null;
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    expect(gridRegion?.className).not.toContain("overflow-x-auto");
    expect(grid?.style.gridTemplateColumns).toBe("repeat(12, minmax(0, 1fr))");
    expect(grid?.style.maxWidth).toBe("33rem");
    expect(grid?.children).toHaveLength(120);
    expect(inputs).toHaveLength(75);
    expect(container.querySelector('[data-cell-key="9-8"]')).not.toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(10);
    expect(container.textContent).toContain("Sách dùng trong nhà trường");
    expect(inputs.every((input) => !input.disabled && input.tabIndex >= 0)).toBe(true);
  });
});
