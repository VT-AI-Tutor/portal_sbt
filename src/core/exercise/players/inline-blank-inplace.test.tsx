/**
 * #398 / #399 — inline-blank players render blanks IN PLACE within the full
 * content.blocks: paragraph order is preserved (#398, word_bank poem b18_i4_q1)
 * and ContentLayout (two-column etc.) survives (#399, cloze b18_i3_q2), instead
 * of stripping marker paragraphs to a flat box.
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

const idx = (t: string) => (container.textContent ?? "").indexOf(t);

describe("#398 word_bank keeps interleaved paragraph order (b18_i4_q1)", () => {
  it("renders every line in document order with blanks in place", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "word_bank" },
            content: {
              blocks: [
                { type: "paragraph", text: "Nhỏ và trông xinh xắn" },
                { type: "paragraph", text: "Thì gọi là {blank_1}" },
                { type: "paragraph", text: "Nhỏ bé và mỏng manh" },
                { type: "paragraph", text: "Là {blank_2}, bạn nhé!" },
                { type: "paragraph", text: "{blank_3} là rất tệ" },
                { type: "paragraph", text: "Cứ tỏ ra hẹp hòi" },
                { type: "paragraph", text: "Cân đối và hài hoà" },
                { type: "paragraph", text: "Thì đúng là {blank_4}." },
              ],
            },
            wordBank: ["nhỏ nhen", "nhỏ nhoi", "nhỏ nhắn", "nhỏ xinh"],
            correctAnswer: { blank_1: "nhỏ xinh", blank_2: "nhỏ nhoi", blank_3: "nhỏ nhen", blank_4: "nhỏ nhắn" },
          },
          {},
        ),
      );
    });

    // Four blanks, in order.
    const blanks = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Chỗ trống"]'),
    );
    expect(blanks.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Chỗ trống 1",
      "Chỗ trống 2",
      "Chỗ trống 3",
      "Chỗ trống 4",
    ]);

    // Every guide line and blank line appears in the original document order —
    // non-marker lines are NOT hoisted to a header, marker lines are NOT glued.
    for (const [a, b] of [
      ["Nhỏ và trông xinh xắn", "Thì gọi là"],
      ["Thì gọi là", "Nhỏ bé và mỏng manh"],
      ["Nhỏ bé và mỏng manh", "bạn nhé!"],
      ["bạn nhé!", "là rất tệ"],
      ["là rất tệ", "Cứ tỏ ra hẹp hòi"],
      ["Cứ tỏ ra hẹp hòi", "Cân đối và hài hoà"],
      ["Cân đối và hài hoà", "Thì đúng là"],
    ]) {
      expect(idx(a)).toBeGreaterThanOrEqual(0);
      expect(idx(a)).toBeLessThan(idx(b));
    }

    // Word bank chips still render.
    expect(container.querySelectorAll('button[draggable="true"]').length).toBe(4);
  });
});

describe("#479 cloze instruction precedes the word bank (b7_q3)", () => {
  it("renders instruction → bank → all interaction blocks without duplication", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: {
              blocks: [
                { type: "paragraph", text: "Lựa chọn từ phù hợp để hoàn thiện câu chuyện." },
                { type: "paragraph", text: "Đoạn một {blank_1} và {blank_2}." },
                { type: "paragraph", text: "Đoạn hai {blank_3} {blank_4} {blank_5} {blank_6}." },
                { type: "paragraph", text: "Đoạn cuối {blank_7}." },
                { type: "paragraph", text: "Ghi chú cuối thân bài." },
              ],
            },
            wordBank: ["một", "hai", "ba", "bốn", "năm", "sáu", "bảy"],
            correctAnswer: {
              blank_1: "một",
              blank_2: "hai",
              blank_3: "ba",
              blank_4: "bốn",
              blank_5: "năm",
              blank_6: "sáu",
              blank_7: "bảy",
            },
          },
          {},
        ),
      );
    });

    const text = container.textContent ?? "";
    expect(text.indexOf("Lựa chọn từ phù hợp")).toBeLessThan(text.indexOf("một"));
    expect(text.indexOf("một")).toBeLessThan(text.indexOf("Đoạn một"));
    expect(text.indexOf("Đoạn một")).toBeLessThan(text.indexOf("Ghi chú cuối"));
    expect(text.match(/Lựa chọn từ phù hợp/g)).toHaveLength(1);
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(7);
    expect(text).not.toContain("{blank_");
  });

  it("keeps the original bank → body order when the first block is interactive", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: {
              blocks: [{ type: "paragraph", text: "Nội dung {blank_1}." }],
            },
            wordBank: ["đúng"],
            correctAnswer: { blank_1: "đúng" },
          },
          {},
        ),
      );
    });
    const text = container.textContent ?? "";
    expect(text.indexOf("đúng")).toBeLessThan(text.indexOf("Nội dung"));
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(1);
  });
});

describe("#431 marker paragraphs flow inline (no flex container)", () => {
  const B15_Q7_TEXT =
    "Sóc Ni phát hiện rằng nếu luôn đi thẳng về phía trước hoặc rẽ sang bên trái thì sẽ đến được loại quả mà mình thích ăn. Sóc Ni thích ăn quả {blank_1}.";

  it("renders text and blank inside the SAME <p> with natural inline flow (b15_q7)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "inline" },
            content: {
              blocks: [{ type: "paragraph", text: B15_Q7_TEXT }],
            },
            blanks: [{ id: "blank_1" }],
            correctAnswer: { blank_1: ["dứa"] },
          },
          {},
        ),
      );
    });

    const input = container.querySelector<HTMLInputElement>("input[type='text']");
    expect(input).toBeTruthy();

    // The marker paragraph hosts BOTH the prose and the input — same <p>.
    const p = input!.closest("p");
    expect(p).toBeTruthy();
    expect(p!.textContent).toContain("Sóc Ni thích ăn quả");

    // No flex container: the input participates in the paragraph's inline flow,
    // so it fills leftover space on the last text line instead of being pushed
    // whole onto a new line as a second flex item.
    expect(p!.classList.contains("flex")).toBe(false);
    expect(p!.classList.contains("flex-wrap")).toBe(false);
    // Wrapped lines get breathing room around the inline input.
    expect(p!.classList.contains("leading-loose")).toBe(true);

    // Document order: prose span first, then the input.
    const textSpan = Array.from(p!.querySelectorAll("span")).find((s) =>
      (s.textContent ?? "").includes("Sóc Ni thích ăn quả"),
    );
    expect(textSpan).toBeTruthy();
    expect(
      textSpan!.compareDocumentPosition(input!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("a centered marker paragraph carries text-center (effective without flex)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "inline" },
            content: {
              blocks: [
                { type: "paragraph", text: "{blank_1} ghim giấy", align: "center" },
              ],
            },
            blanks: [{ id: "blank_1" }],
            correctAnswer: { blank_1: ["4"] },
          },
          {},
        ),
      );
    });

    const input = container.querySelector<HTMLInputElement>("input[type='text']");
    expect(input).toBeTruthy();
    const p = input!.closest("p");
    expect(p).toBeTruthy();
    expect(p!.classList.contains("text-center")).toBe(true);
    expect(p!.classList.contains("flex")).toBe(false);
  });

  it("keeps a leading vertical-arithmetic operator out of the centred row width", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "inline" },
            content: {
              blocks: [{
                type: "paragraph",
                align: "center",
                text: "a) 6 282 + 1 903\n{blank_a_1}\n+ {blank_a_2}\n{blank_a_3}",
              }],
            },
            correctAnswer: { blank_a_1: "1", blank_a_2: "2", blank_a_3: "3" },
          },
          {},
        ),
      );
    });

    const input = container.querySelectorAll<HTMLInputElement>("input[type='text']")[1];
    expect(input).toBeTruthy();
    const operatorAnchor = Array.from(container.querySelectorAll<HTMLSpanElement>("span"))
      .find((span) => span.classList.contains("w-0"));
    expect(operatorAnchor).toBeTruthy();
    expect(operatorAnchor!.className).toContain("overflow-visible");
    expect(operatorAnchor!.textContent).toBe("+ ");
  });
});

describe("#399 inline-blank players keep ContentLayout (two-column)", () => {
  it("cloze inline renders a two-column layout with an input in each column", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "inline" },
            content: {
              blocks: [
                {
                  type: "layout",
                  layout: "two-column",
                  columns: [
                    [{ type: "paragraph", text: "Thẻ 1: {blank_1}" }],
                    [{ type: "paragraph", text: "Thẻ 2: {blank_2}" }],
                  ],
                },
              ],
            },
            blanks: [
              { id: "blank_1", acceptedAnswers: ["a"] },
              { id: "blank_2", acceptedAnswers: ["b"] },
            ],
            correctAnswer: { blank_1: ["a"], blank_2: ["b"] },
          },
          {},
        ),
      );
    });

    // The two-column grid container survived (not flattened to a vertical stack).
    const grid = container.querySelector('[class*="grid-cols-2"]');
    expect(grid).toBeTruthy();

    // Two inputs, one per column, alongside their card text.
    expect(container.querySelectorAll("input[type='text']").length).toBe(2);
    expect(idx("Thẻ 1")).toBeGreaterThanOrEqual(0);
    expect(idx("Thẻ 2")).toBeGreaterThan(idx("Thẻ 1"));
  });
});
