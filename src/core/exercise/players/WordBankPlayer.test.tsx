import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { WordBankPlayer } from "./WordBankPlayer";

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

function wordBankButtonWithText(text: string): HTMLButtonElement {
  const button = Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[draggable="true"]'),
  ).find((candidate) => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`Không tìm thấy từ trong ngân hàng: ${text}`);
  return button;
}

describe("WordBankPlayer normalization", () => {
  it("uses the authored content as the question stem without showing the capability label", () => {
    const instruction =
      "Lựa chọn từ hoặc cụm từ cho sẵn phù hợp và điền vào chỗ trống để hoàn thành đoạn thông tin.";

    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "word_bank" },
            content: {
              blocks: [
                { type: "paragraph", text: instruction },
                {
                  type: "paragraph",
                  text: "Khu vực Đông Nam Á gồm {blank_1} và {blank_2}.",
                },
              ],
            },
            wordBank: ["Đông Nam Á lục địa", "Đông Nam Á hải đảo"],
            correctAnswer: {
              blank_1: "Đông Nam Á lục địa",
              blank_2: "Đông Nam Á hải đảo",
            },
          },
          {},
        ),
      );
    });

    expect(container.textContent).toContain(instruction);
    expect(container.textContent).not.toContain("Word bank → blank");
    expect(container.textContent!.indexOf(instruction)).toBeLessThan(
      container.textContent!.indexOf("Đông Nam Á lục địa"),
    );
  });

  it("hydrates a saved answer on the first render", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "word_bank" },
            segments: [{ text: "Chọn " }, { blankId: "blank_saved" }],
            wordBank: [
              { id: "saved", text: "đã lưu" },
              { id: "unused", text: "chưa dùng" },
            ],
            correctAnswer: { blank_saved: "saved" },
          },
          { answer: { blank_saved: "saved" } },
        ),
      );
    });

    expect(container.querySelector('[aria-label="Chỗ trống 1"]')?.textContent).toContain("đã lưu");
    expect(wordBankButtonWithText("chưa dùng")).toBeTruthy();
    expect(container.querySelector('button[draggable="true"]')?.textContent).not.toContain("đã lưu");
  });

  it("parses editor placeholders, assigns stable word IDs, and grades by blank ID", () => {
    const onAnswerChange = vi.fn();
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "word_bank" },
            content: {
              blocks: [{ type: "paragraph", text: "___[blank_1]___ và {blank_2}." }],
            },
            wordBank: ["một", "hai", "nhiễu"],
            correctAnswer: { blank_1: "một", blank_2: "hai" },
          },
          { onAnswerChange, onStatusChange, instantFeedback: false },
        ),
      );
    });

    const blanks = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Chỗ trống"]'),
    );
    expect(blanks.map((blank) => blank.getAttribute("aria-label"))).toEqual([
      "Chỗ trống 1",
      "Chỗ trống 2",
    ]);

    act(() => buttonWithText("một").click());
    act(() => blanks[0].click());
    act(() => buttonWithText("hai").click());
    act(() => blanks[1].click());

    expect(onAnswerChange).toHaveBeenLastCalledWith({ blank_1: "word-1", blank_2: "word-2" });
    expect(Object.keys(onAnswerChange.mock.lastCall?.[0] ?? {})).not.toContain("undefined");

    act(() => buttonWithText("Kiểm tra").click());
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });

  it("renders the passage prose when blocks use canonical rich runs (block.content)", () => {
    // Real imported data: build_question_v1 → coerce_rich_content rewrites the
    // essay paragraph from `text` into `content: [{ text, annotations }]` runs,
    // keeping the {blank_N} markers inline. The passage text between the blanks
    // must still render — regression for word_bank essays showing bare blanks only.
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
                      text: "Bình minh trong hơi sương {blank_1} và nắng {blank_2} dịu.",
                      annotations: {},
                    },
                  ],
                },
              ],
            },
            wordBank: ["mỏng mảnh", "tờ mờ"],
            correctAnswer: { blank_1: "mỏng mảnh", blank_2: "tờ mờ" },
          },
          { instantFeedback: false },
        ),
      );
    });

    // The two blanks render...
    const blanks = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Chỗ trống"]'),
    );
    expect(blanks.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Chỗ trống 1",
      "Chỗ trống 2",
    ]);
    // ...AND the surrounding passage prose is present (not dropped).
    expect(container.textContent).toContain("Bình minh trong hơi sương");
    expect(container.textContent).toContain("và nắng");
    expect(container.textContent).toContain("dịu.");
  });

  it("preserves object IDs and accepts a real drag payload", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "word_bank" },
            segments: [{ text: "Chọn " }, { blankId: "blank_drag" }],
            wordBank: [{ id: "w-stable", text: "đáp án" }],
            correctAnswer: { blank_drag: "w-stable" },
          },
          { onAnswerChange },
        ),
      );
    });

    const transfer = {
      effectAllowed: "none",
      getData: vi.fn(() => "w-stable"),
      setData: vi.fn(),
    };
    const dragStart = new Event("dragstart", { bubbles: true });
    Object.defineProperty(dragStart, "dataTransfer", { value: transfer });
    act(() => buttonWithText("đáp án").dispatchEvent(dragStart));

    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: transfer });
    const blank = container.querySelector<HTMLButtonElement>('[aria-label="Chỗ trống 1"]');
    act(() => blank?.dispatchEvent(drop));

    expect(transfer.setData).toHaveBeenCalledWith("text/plain", "w-stable");
    expect(onAnswerChange).toHaveBeenLastCalledWith({ blank_drag: "w-stable" });
  });

  it("maps repeated legacy answer text to distinct word-bank occurrences", () => {
    const onAnswerChange = vi.fn();
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "word_bank" },
            segments: [{ blankId: "first" }, { text: " và " }, { blankId: "second" }],
            wordBank: ["lặp", "lặp"],
            correctAnswer: { first: "lặp", second: "lặp" },
          },
          { onAnswerChange, onStatusChange, instantFeedback: false },
        ),
      );
    });

    const blanks = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Chỗ trống"]'),
    );
    act(() => wordBankButtonWithText("lặp").click());
    act(() => blanks[0].click());
    act(() => wordBankButtonWithText("lặp").click());
    act(() => blanks[1].click());

    expect(onAnswerChange).toHaveBeenLastCalledWith({ first: "word-1", second: "word-2" });
    act(() => buttonWithText("Kiểm tra").click());
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });

  it("renders NO Kiểm tra button for a zero-blank image-only content (#440 parity)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "word_bank" },
            content: {
              blocks: [
                { type: "image", url: "assets/images/minh-hoa.png", alt: "Mẫu minh hoạ" },
              ],
            },
            wordBank: [],
            selfAssessment: true,
          },
          { instantFeedback: false },
        ),
      );
    });

    expect(container.querySelectorAll('button[aria-label^="Chỗ trống"]').length).toBe(0);
    expect(container.textContent).not.toContain("Kiểm tra");
  });
});

describe("WordBankPlayer self-check feedback", () => {
  const props = {
    title: "Q",
    segments: [{ blankId: "b1" }, { text: " và " }, { blankId: "b2" }],
    wordBank: [
      { id: "w1", text: "một" },
      { id: "w2", text: "hai" },
    ],
    correctMappings: { b1: "w1", b2: "w2" },
  };
  const blanks = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Chỗ trống"]'));

  it("button mode: a wrong Kiểm tra turns the wrong blanks red + shows the feedback line without revealing the expected words", () => {
    act(() => root.render(<WordBankPlayer {...props} instantFeedback={false} />));
    act(() => wordBankButtonWithText("hai").click());
    act(() => blanks()[0].click()); // b1 = w2 (sai)
    act(() => wordBankButtonWithText("một").click());
    act(() => blanks()[1].click()); // b2 = w1 (sai)
    act(() => buttonWithText("Kiểm tra").click());

    expect(blanks()[0].className).toContain("red");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    // The blank keeps showing the pupil's own word — expected words stay hidden.
    expect(blanks()[0].textContent).toContain("hai");
    expect(blanks()[0].className).not.toContain("green");

    act(() => blanks()[0].click()); // bỏ từ khỏi chỗ trống -> xoá trạng thái sai
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    expect(blanks()[1].className).not.toContain("red");
  });

  it("recordOnly (selfAssessment): no Kiểm tra button in button mode", () => {
    act(() => root.render(<WordBankPlayer {...props} selfAssessment instantFeedback={false} />));
    expect(container.textContent).not.toContain("Kiểm tra");
  });
});
