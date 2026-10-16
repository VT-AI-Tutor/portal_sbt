/**
 * #526 — QA preview must reproduce leading indentation for every rich-content
 * render path, not just the b11_i2_q2 repro. The bug was in the shared
 * boundary `InlineMathText.renderRichText` (used by every `RichTextValue`
 * caller): a text segment with raw leading whitespace that ALSO contains a
 * later inline marker (a `<br>` from an embedded newline, `<strong>`, a
 * link, ...) lost that leading whitespace because the browser parsed it as a
 * bare HTML document instead of inside a wrapper element.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

const INDENT = "   ";

/** Shape of the real b11_i2_q2 payload: an instruction paragraph, then a
 * single indented passage paragraph whose text wraps across an authored
 * newline (→ `<br>`) BEFORE reaching the first `{blank_*}` marker. */
function clozePayload() {
  return {
    type: "cloze",
    display: { interactionType: "inline", layout: "list" },
    content: {
      blocks: [
        {
          type: "paragraph",
          content: [
            { text: "Tìm từ đồng nghĩa với mỗi từ in đậm trong đoạn văn sau:", annotations: {} },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              text: `${INDENT}Mùa xuân vừa sang, cây cối đâm chồi\nnảy lộc `,
              annotations: {},
            },
            { text: "{blank_1}", annotations: {} },
            { text: ", nở hoa ", annotations: {} },
            { text: "{blank_2}", annotations: {} },
            { text: ".", annotations: {} },
          ],
        },
      ],
    },
    correctAnswer: { blank_1: "xanh tốt", blank_2: "rực rỡ" },
  };
}

describe("Cloze inline keeps leading indentation (#526)", () => {
  it("renders the blank-bearing paragraph with its leading indent intact", () => {
    act(() => {
      root.render(<>{renderInteractionPlayer("cloze", clozePayload(), {})}</>);
    });

    const paragraphs = Array.from(container.querySelectorAll("p"));
    const passage = paragraphs.find((p) => p.textContent?.includes("Mùa xuân"));
    expect(passage).toBeTruthy();
    expect(passage!.textContent?.startsWith(INDENT)).toBe(true);
    expect(passage!.className).toContain("whitespace-pre-wrap");
  });

  it("keeps the instruction paragraph (before the blank block) unindented and unaffected", () => {
    act(() => {
      root.render(<>{renderInteractionPlayer("cloze", clozePayload(), {})}</>);
    });

    // web-own: đoạn hướng dẫn (không thụt lề, không blank) được look joyful
    // của web promote thành tiêu đề h2 to + accent bar — tìm trong h2 lẫn p.
    const textEls = Array.from(container.querySelectorAll("h2, p"));
    const instruction = textEls.find((el) => el.textContent?.includes("Tìm từ đồng nghĩa"));
    expect(instruction).toBeTruthy();
    expect(instruction!.textContent?.startsWith(" ")).toBe(false);
  });

  it("does not disturb the blank inputs or text after the blanks", () => {
    act(() => {
      root.render(<>{renderInteractionPlayer("cloze", clozePayload(), {})}</>);
    });

    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(2);
    const paragraphs = Array.from(container.querySelectorAll("p"));
    const passage = paragraphs.find((p) => p.textContent?.includes("Mùa xuân"));
    expect(passage!.textContent).toContain("nở hoa");
    expect(passage!.textContent?.trim().endsWith(".")).toBe(true);
  });
});
