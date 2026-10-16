import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("learner-facing technical labels", () => {
  it("renders no generated heading or orphan accent bar without authored content", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "single_choice",
          {
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
            ],
          },
          {},
        ),
      );
    });

    expect(container.querySelector("h2")).toBeNull();
    expect(container.textContent).not.toContain("Single choice / radio MCQ");
  });

  // web-own: kỳ vọng cũ pin hành vi studio "không promote đoạn văn". Look
  // joyful của web promote đoạn đề bài đầu tiên thành tiêu đề to h2 + accent
  // bar (Owner 30/7: style không được chạy theo studio) — stem vẫn hiển thị,
  // label kỹ thuật vẫn bị ẩn.
  it("promotes the authored stem paragraph to the joyful heading", () => {
    const stem = "Chọn đáp án đúng.";

    act(() => {
      root.render(
        renderInteractionPlayer(
          "single_choice",
          {
            content: { blocks: [{ type: "paragraph", text: stem }] },
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
            ],
          },
          {},
        ),
      );
    });

    const h2 = container.querySelector("h2");
    expect(h2).not.toBeNull();
    expect(h2!.textContent).toContain(stem);
    expect(container.textContent).not.toContain("Single choice / radio MCQ");
  });

  it.each([
    {
      type: "connect_points",
      payload: { points: [], correctAnswer: [] },
      technicalLabel: "Nối các điểm",
      learnerInstruction: "Nhấn hai điểm liên tiếp để nối chúng",
    },
    {
      type: "mind_map_completion",
      payload: { nodes: [], edges: [] },
      technicalLabel: "Hoàn thành sơ đồ tư duy",
      learnerInstruction: "Điền vào các ô trống trong sơ đồ",
    },
    {
      type: "upload_answer",
      payload: {},
      technicalLabel: "Nộp bài làm",
      learnerInstruction: "Chụp và tải lên bài làm của em",
    },
  ])(
    "hides the $type capability label while retaining learner instructions",
    ({ type, payload, technicalLabel, learnerInstruction }) => {
      act(() => {
        root.render(renderInteractionPlayer(type, payload, {}));
      });

      expect(container.querySelector("h2")).toBeNull();
      expect(container.textContent).not.toContain(technicalLabel);
      expect(container.textContent).toContain(learnerInstruction);
    },
  );
});
