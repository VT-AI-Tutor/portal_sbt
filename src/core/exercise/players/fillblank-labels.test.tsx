/**
 * #397 — fill_blank blanks[].label must render next to each input. When the stem
 * carries no {blank_*} marker, parseCloze() synthesizes one input per blank; it
 * used to drop `label`, so learners saw bare inputs with no idea which prompt each
 * belonged to. Labels now render as leading text, one labeled blank per line.
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

describe("fill_blank blank labels (#397)", () => {
  it("renders blanks[].label in order with one blank per line (b20_i2_q2)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "fill_blank",
          {
            selfAssessment: true,
            content: {
              blocks: [
                {
                  type: "paragraph",
                  text: "Tra cứu từ điển thành ngữ, tục ngữ và ghi lại ý nghĩa của các câu tục ngữ sau:",
                },
              ],
            },
            blanks: [
              { id: "blank_1", label: "a. Ăn vóc học hay:" },
              { id: "blank_2", label: "b. Đi một ngày đàng học một sàng khôn:" },
            ],
          },
          {},
        ),
      );
    });

    const text = container.textContent ?? "";
    // Both labels render...
    expect(text).toContain("a. Ăn vóc học hay:");
    expect(text).toContain("b. Đi một ngày đàng học một sàng khôn:");
    // ...in the order of the blanks[] array.
    expect(text.indexOf("a. Ăn vóc")).toBeLessThan(text.indexOf("b. Đi một ngày"));
    // Two inputs render.
    expect(container.querySelectorAll("input[type='text']").length).toBe(2);
    // A full-width break separates the two labeled rows.
    expect(container.querySelectorAll("span.basis-full").length).toBe(1);
  });

  it("keeps bare blanks (no label) inline, without inserting line breaks", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "fill_blank",
          {
            content: { blocks: [{ type: "paragraph", text: "Điền số:" }] },
            blanks: [
              { id: "b1", acceptedAnswers: ["4"] },
              { id: "b2", acceptedAnswers: ["6"] },
            ],
            correctAnswer: { b1: ["4"], b2: ["6"] },
          },
          {},
        ),
      );
    });
    expect(container.querySelectorAll("input[type='text']").length).toBe(2);
    // No labels → no forced line breaks (unchanged legacy layout).
    expect(container.querySelectorAll("span.basis-full").length).toBe(0);
  });
});
