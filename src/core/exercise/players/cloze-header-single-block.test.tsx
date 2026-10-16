/**
 * b17_i3_q3 — a cloze passage whose opening line carries no blank ("Tú nói với
 * anh Việt:") used to be hoisted into the header alongside the real đề bài: it
 * rendered at heading size and the accent bar fell between it and the rest of
 * its own dialogue. Only the first block is the đề bài.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { SkinProvider } from "../skin";

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

const paragraph = (text: string) => ({ type: "paragraph", text });

const renderCloze = (blocks: unknown[]) =>
  act(() => {
    root.render(
      // "playful" is the student surface in both repos — the only skin that
      // promotes đề bài blocks to heading size (studio renders block-honest).
      <SkinProvider skin="playful">
        {renderInteractionPlayer(
          "cloze",
          {
            display: { interactionType: "inline" },
            content: { blocks },
            blanks: [{ id: "blank_1" }, { id: "blank_2" }],
            correctAnswer: { blank_1: ["."], blank_2: ["?"] },
          },
          {},
        )}
      </SkinProvider>,
    );
  });

const headings = () =>
  Array.from(container.querySelectorAll("h2")).map((h) => h.textContent?.trim());

const bodyText = () =>
  Array.from(container.querySelectorAll("p"))
    .map((p) => p.textContent ?? "")
    .join("\n");

describe("cloze header holds only the first block", () => {
  it("keeps a blank-free passage line in the body instead of the header", () => {
    renderCloze([
      paragraph("Điền dấu chấm hoặc dấu chấm hỏi vào ô trống."),
      paragraph("Tú nói với anh Việt:"),
      paragraph("– Nước có ý nghĩa to lớn với con người đấy, anh ạ {blank_1}"),
      paragraph("– Sao em biết {blank_2}"),
    ]);

    expect(headings()).toEqual(["Điền dấu chấm hoặc dấu chấm hỏi vào ô trống."]);
    expect(bodyText()).toContain("Tú nói với anh Việt:");
    expect(container.querySelectorAll("input")).toHaveLength(2);
  });

  it("reaches past a leading spacer paragraph to find the đề bài", () => {
    renderCloze([
      paragraph(""),
      paragraph("Điền dấu chấm hoặc dấu chấm hỏi vào ô trống."),
      paragraph("Tú nói với anh Việt:"),
      paragraph("– Sao em biết {blank_1} Thế nào {blank_2}"),
    ]);

    expect(headings()).toEqual(["Điền dấu chấm hoặc dấu chấm hỏi vào ô trống."]);
    expect(bodyText()).toContain("Tú nói với anh Việt:");
  });

  it("reaches past a leading image to find the đề bài", () => {
    renderCloze([
      { type: "image", url: "/uploads/tranh.png", alt: "tranh minh hoạ" },
      paragraph("Điền dấu chấm hoặc dấu chấm hỏi vào ô trống."),
      paragraph("Tú nói với anh Việt:"),
      paragraph("– Sao em biết {blank_1} Thế nào {blank_2}"),
    ]);

    expect(headings()).toEqual(["Điền dấu chấm hoặc dấu chấm hỏi vào ô trống."]);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(bodyText()).toContain("Tú nói với anh Việt:");
  });

  it("renders no header when the first block already carries a blank", () => {
    renderCloze([
      paragraph("Khi bị ốm, em cần {blank_1} để được khám."),
      paragraph("Em không {blank_2} một mình."),
    ]);

    expect(headings()).toEqual([]);
    expect(container.querySelectorAll("input")).toHaveLength(2);
  });
});
