/**
 * #400 / #404 — matching items must keep the rich-text alignment chosen in the
 * editor (block.align) when rendered in QA preview / the live player. The adapter
 * used to flatten item.content to a plain string via textItems(), dropping align;
 * now content flows through and players render it via AlignedRichText.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function alignedItem(id: string, text: string, align: string) {
  return { id, content: { blocks: [{ type: "paragraph", align, content: [{ text, annotations: {} }] }] } };
}

/** Class of the innermost <div> wrapping exactly `text` — the AlignedRichText block. */
function alignmentOf(text: string): string {
  const els = Array.from(container.querySelectorAll<HTMLElement>("div")).filter(
    (d) => d.textContent?.trim() === text,
  );
  return els[els.length - 1]?.className ?? "";
}

describe("matching rich-text alignment (#400/#404)", () => {
  it("keeps center/right alignment of column items through the player", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "matching",
          {
            display: { interactionType: "columns" },
            leftItems: [
              alignedItem("l1", "uyên bác", "center"),
              alignedItem("l2", "thành thục", "right"),
            ],
            rightItems: [
              { id: "r1", text: "nghĩa 1" }, // legacy plain text
              { id: "r2", text: "nghĩa 2" },
            ],
            correctAnswer: [
              { item: "l1", target: "r1" },
              { item: "l2", target: "r2" },
            ],
          },
          {},
        ),
      );
    });

    // Center- and right-aligned items expose the corresponding alignment class.
    expect(alignmentOf("uyên bác")).toContain("text-center");
    expect(alignmentOf("thành thục")).toContain("text-right");
    // Legacy plain-text items still render (no rich content, no crash).
    expect(container.textContent).toContain("nghĩa 1");
    expect(container.textContent).toContain("nghĩa 2");
  });

  it("does not force alignment on items without an align attribute", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "matching",
          {
            display: { interactionType: "columns" },
            leftItems: [
              { id: "l1", content: { blocks: [{ type: "paragraph", content: [{ text: "trái mặc định", annotations: {} }] }] } },
            ],
            rightItems: [{ id: "r1", text: "phải" }],
            correctAnswer: [{ item: "l1", target: "r1" }],
          },
          {},
        ),
      );
    });
    // No align attribute → no explicit text-center/right/justify class injected.
    const cls = alignmentOf("trái mặc định");
    expect(cls).not.toContain("text-center");
    expect(cls).not.toContain("text-right");
    expect(cls).not.toContain("text-justify");
  });
});
