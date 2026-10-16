/**
 * #394 — leading paragraph indentation (thụt đầu dòng) must survive rendering.
 * The passage path (EssayPlayer → RichContentBlocks) already renders body
 * paragraphs `whitespace-pre-wrap`, including the first paragraph. Literal
 * leading whitespace in every paragraph must survive rendering.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RichContentBlocks } from "./shared";

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

const INDENT = "   "; // 3 leading spaces (indent)

describe("paragraph indentation preserved (#394)", () => {
  it("keeps leading indent on both the first and following passage paragraphs", () => {
    act(() => {
      root.render(
        <RichContentBlocks
          blocks={[
            { type: "paragraph", text: `${INDENT}Bác Hồ là tấm gương sáng về sử dụng tiền hợp lí.` },
            { type: "paragraph", text: `${INDENT}Tuy nhiên, quan điểm tiết kiệm của Bác không phải là hà tiện.` },
          ]}
        />,
      );
    });

    const textEls = Array.from(container.querySelectorAll<HTMLElement>("h2, p"));
    const first = textEls.find((el) => el.textContent?.includes("Bác Hồ"));
    const second = textEls.find((el) => el.textContent?.includes("Tuy nhiên"));
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();

    // Both wrapping elements honor pre-wrap so the indent is not collapsed.
    expect(first!.className).toContain("whitespace-pre-wrap");
    expect(second!.className).toContain("whitespace-pre-wrap");

    // The literal leading indent survives to the DOM (not trimmed away).
    expect(first!.textContent?.startsWith(INDENT)).toBe(true);
    expect(second!.textContent?.startsWith(INDENT)).toBe(true);
  });
});
