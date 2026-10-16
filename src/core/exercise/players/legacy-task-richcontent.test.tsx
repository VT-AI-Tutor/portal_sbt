import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

// Regression for issue #558: the three "legacy" players that render via a
// dedicated task component instead of PlayerShell — MindMapCompletionPlayer
// (P73), ConnectPointsPlayer (P72) and UploadAnswerPlayer (P74) — used to
// receive only a plain `title` (the FIRST line of content) plus a hardcoded
// fallback subtitle, silently dropping every content block after the first.
// They now receive the full `richContent` and render it through PlayerHeader
// like every other player, so multi-paragraph stems survive.

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // ConnectPointsTask observes its container via ResizeObserver, absent in jsdom.
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const titleText = "Hoàn thành sơ đồ tư duy";
const instructionText =
  "Hoàn thành sơ đồ tìm ý cho đoạn văn giới thiệu một nhân vật trong bộ phim hoạt hình em đã được xem.";

// content.blocks with two paragraphs: block 1 is the title, block 2 is the real
// authored instruction — the exact shape from b31_i3_q1 that regressed.
const twoBlockContent = {
  blocks: [
    { type: "paragraph", text: titleText },
    { type: "paragraph", text: instructionText },
  ],
};

const cases = [
  {
    name: "MindMapCompletionPlayer",
    type: "mind_map_completion",
    interactionType: "fill",
    hardcodedHint: "Điền vào các ô trống trong sơ đồ",
    extra: {
      nodes: [{ id: "n1", label: "Nút", nodeType: "static" }],
      edges: [],
    },
  },
  {
    name: "ConnectPointsPlayer",
    type: "connect_points",
    interactionType: "lines",
    hardcodedHint: "Nhấn hai điểm liên tiếp để nối chúng",
    extra: {
      points: [
        { id: "p1", label: "1", x: 0.2, y: 0.2 },
        { id: "p2", label: "2", x: 0.8, y: 0.8 },
      ],
      correctAnswer: [{ from: "p1", to: "p2" }],
    },
  },
  {
    name: "UploadAnswerPlayer",
    type: "upload_answer",
    interactionType: "upload",
    hardcodedHint: "Chụp và tải lên bài làm của em",
    extra: {},
  },
] as const;

describe("legacy task players render full content (issue #558)", () => {
  for (const c of cases) {
    it(`${c.name} shows every content paragraph, not just the first, and no hardcoded subtitle`, () => {
      act(() => {
        root.render(
          renderInteractionPlayer(c.type, {
            display: { interactionType: c.interactionType },
            content: twoBlockContent,
            ...c.extra,
          }, {}),
        );
      });

      const text = container.textContent ?? "";
      // Both the title paragraph AND the second (instruction) paragraph render.
      expect(text).toContain(titleText);
      expect(text).toContain(instructionText);
      // The hardcoded fallback subtitle must NOT override authored content.
      expect(text).not.toContain(c.hardcodedHint);
    });

    it(`${c.name} still shows the default hint when no content is authored`, () => {
      act(() => {
        root.render(
          renderInteractionPlayer(c.type, {
            display: { interactionType: c.interactionType },
            ...c.extra,
          }, {}),
        );
      });

      expect(container.textContent ?? "").toContain(c.hardcodedHint);
    });
  }
});
