/**
 * Rich passages for SelectWordsPlayer: a passage authored as blocks keeps its
 * per-paragraph alignment and inline marks, while grading still runs on the
 * plain text — so the source line "(Theo Ngô Quân Miện)" can sit on the right
 * without moving a single word index.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RichContent } from "@/core/question-schema";
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

const BODY = "Dưới mái trường mới, sao tiếng trống rung động kéo dài!";
// 0=Dưới 1=mái 2=trường 3=mới 4=sao 5=tiếng 6=trống 7=rung 8=động 9=kéo 10=dài
const passageContent: RichContent = {
  blocks: [
    {
      type: "paragraph",
      content: [
        { text: "Dưới mái trường mới, sao tiếng trống ", annotations: {} },
        { text: "rung động", annotations: { bold: true } },
        { text: " kéo dài!", annotations: {} },
      ],
    },
    {
      type: "paragraph",
      align: "right",
      content: [
        { text: "(", annotations: {} },
        { text: "Theo", annotations: { italic: true } },
        { text: " Ngô Quân Miện)", annotations: {} },
      ],
    },
  ],
};

function wordEl(t: string): HTMLElement {
  return Array.from(container.querySelectorAll('[role="button"]')).find(
    (b) => b.textContent?.trim() === t,
  ) as HTMLElement;
}

function clickWord(t: string) {
  act(() => wordEl(t).dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

it("renders the source line right-aligned and the body line unaligned", () => {
  act(() =>
    root.render(
      <SelectWordsPlayer title="Q" passage={BODY} passageContent={passageContent} correctWords={[7, 8]} />,
    ),
  );
  const lines = Array.from(container.querySelectorAll("[data-passage-block]"));
  expect(lines).toHaveLength(2);
  expect(lines[0].className).not.toMatch(/text-right/);
  expect(lines[1].className).toMatch(/text-right/);
  expect(lines[1].textContent).toContain("Ngô Quân Miện");
});

it("keeps counting word indices through the block boundary", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <SelectWordsPlayer
        title="Q"
        passage={BODY}
        passageContent={passageContent}
        correctWords={[11]}
        onElementGraded={onElementGraded}
      />,
    ),
  );
  // "Theo" is the first word of the second block and the 12th of the passage.
  clickWord("Theo");
  expect(onElementGraded).toHaveBeenCalledWith("11", "correct", undefined);
});

it("renders inline marks without letting markup become a word", () => {
  act(() =>
    root.render(
      <SelectWordsPlayer title="Q" passage={BODY} passageContent={passageContent} correctWords={[]} />,
    ),
  );
  expect(wordEl("rung").querySelector("strong")).not.toBeNull();
  expect(wordEl("Theo").querySelector("em")).not.toBeNull();
  expect(wordEl("strong")).toBeUndefined();
});

it("still grades a legacy passage that has no blocks", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <SelectWordsPlayer
        title="Q"
        passage="con mèo ngồi"
        correctWords={[1]}
        onElementGraded={onElementGraded}
      />,
    ),
  );
  clickWord("mèo");
  expect(onElementGraded).toHaveBeenCalledWith("1", "correct", undefined);
});
