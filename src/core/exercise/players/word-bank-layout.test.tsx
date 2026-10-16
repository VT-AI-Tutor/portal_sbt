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

function buttonWithText(text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Không tìm thấy nút: ${text}`);
  return button;
}

describe("#490 word-bank Cloze layout (b9_i4_q1)", () => {
  it("renders requirement → bank → marker paragraph while preserving rich runs and block order", () => {
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
                  content: [
                    {
                      text: "Chọn từ phù hợp điền vào chỗ trống trong đoạn văn sau:",
                      annotations: { bold: true },
                    },
                  ],
                },
                {
                  type: "paragraph",
                  content: [
                    {
                      text: "Bình minh trong hơi sương {blank_1} và nắng dịu.",
                      annotations: { italic: true },
                    },
                  ],
                },
                { type: "paragraph", text: "(Theo Thanh Tuyết)" },
              ],
            },
            wordBank: ["mỏng mảnh", "tờ mờ"],
            correctAnswer: { blank_1: "mỏng mảnh" },
          },
          { onAnswerChange, instantFeedback: false },
        ),
      );
    });

    const text = container.textContent ?? "";
    const requirement = "Chọn từ phù hợp điền vào chỗ trống trong đoạn văn sau:";
    // Thứ tự web — đoạn văn TRƯỚC, ngân hàng từ SAU (kỳ vọng cũ pin layout
    // bank-trên của studio #490 đã đổi; Owner 30/7).
    expect(text.indexOf(requirement)).toBeLessThan(text.indexOf("Bình minh"));
    expect(text.indexOf("(Theo Thanh Tuyết)")).toBeLessThan(text.indexOf("mỏng mảnh"));
    expect(text.indexOf("Bình minh")).toBeLessThan(text.indexOf("(Theo Thanh Tuyết)"));
    expect(text.match(/Chọn từ phù hợp/g)).toHaveLength(1);
    expect(container.querySelector("strong")?.textContent).toBe(requirement);
    expect(container.querySelector("em")?.textContent).toContain("Bình minh");

    const blank = container.querySelector<HTMLButtonElement>(
      '[aria-label="Chỗ trống 1"]',
    );
    expect(blank).toBeTruthy();

    act(() => buttonWithText("mỏng mảnh").click());
    act(() => blank!.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith({ blank_1: "word-1" });
    expect(container.querySelectorAll('button[draggable="true"]')).toHaveLength(1);

    act(() => blank!.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith({});
    expect(container.querySelectorAll('button[draggable="true"]')).toHaveLength(2);

    act(() => buttonWithText("mỏng mảnh").click());
    act(() => blank!.click());
    act(() => buttonWithText("tờ mờ").click());
    act(() => blank!.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith({ blank_1: "word-2" });
    expect(blank!.textContent).toContain("tờ mờ");
    expect(buttonWithText("mỏng mảnh")).toBeTruthy();
  });

  // Web đặt bank SAU nội dung (thứ tự web) — kỳ vọng studio bank-trước đã đổi.
  it("places the bank after content when the first authored block already contains a blank", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "word_bank" },
            content: {
              blocks: [
                { type: "paragraph", text: "Nội dung {blank_1}." },
              ],
            },
            wordBank: ["đúng"],
            correctAnswer: { blank_1: "đúng" },
          },
          {},
        ),
      );
    });

    const text = container.textContent ?? "";
    expect(text.indexOf("Nội dung")).toBeLessThan(text.indexOf("đúng"));
  });
});
