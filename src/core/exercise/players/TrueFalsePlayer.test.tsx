import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DisplayLayout } from "@/core/exercise/display-layout";
import { TrueFalsePlayer } from "./TrueFalsePlayer";

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

const layoutCases: [DisplayLayout, string][] = [
  ["list", "flex flex-col gap-2 sm:gap-3"],
  ["inline", "flex flex-wrap gap-2 sm:gap-3"],
  ["grid_2", "grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"],
  ["grid_4", "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3"],
];

describe("TrueFalsePlayer layout", () => {
  it.each(layoutCases)("renders the %s option layout and preserves answer reporting", (layout, expectedClassName) => {
    const onAnswerChange = vi.fn();

    act(() => {
      root.render(
        <TrueFalsePlayer
          title="Chọn đúng hoặc sai"
          correct={false}
          layout={layout}
          selfAssessment
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    const trueOption = container.querySelector<HTMLButtonElement>("button");
    expect(trueOption?.parentElement?.className).toBe(expectedClassName);
    expect(trueOption?.parentElement?.getAttribute("data-display-layout")).toBe(layout);
    expect(trueOption?.parentElement?.getAttribute("role")).toBe("radiogroup");
    expect(trueOption?.getAttribute("role")).toBe("radio");
    expect(trueOption?.getAttribute("aria-checked")).toBe("false");

    act(() => trueOption?.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
    expect(trueOption?.getAttribute("aria-checked")).toBe("true");
  });

  // web-own: default web là 2 pill gọn cạnh nhau căn giữa (không phải list dọc
  // của studio) — kỳ vọng cũ pin hành vi studio đã đổi (Owner 30/7).
  it("defaults to two compact pills side by side, centered", () => {
    act(() => {
      root.render(<TrueFalsePlayer title="Chọn đúng hoặc sai" correct={false} />);
    });

    const trueOption = container.querySelector<HTMLButtonElement>("button");
    expect(trueOption?.parentElement?.className).toBe("flex flex-wrap gap-4 justify-center");
  });

  it("rehydrates parent answer changes, keeps local input responsive, and hydrates on remount", () => {
    const renderPlayer = (answer: boolean) => {
      act(() => {
        root.render(
          <TrueFalsePlayer
            title="Chọn đúng hoặc sai"
            correct
            answer={answer}
            selfAssessment
          />,
        );
      });
    };

    renderPlayer(false);
    let options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["false", "true"]);

    renderPlayer(true);
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);

    act(() => options[1].click());
    renderPlayer(true);
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["false", "true"]);

    act(() => root.unmount());
    root = createRoot(container);
    renderPlayer(true);
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);
  });

  it.each(["submitted", "disabled"] as const)("locks interaction when %s", (lockMode) => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <TrueFalsePlayer
          title="Chọn đúng hoặc sai"
          correct
          answer={false}
          selfAssessment
          submitted={lockMode === "submitted"}
          disabled={lockMode === "disabled"}
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options.every((option) => option.disabled)).toBe(true);
    act(() => options[0].click());
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    expect(onAnswerChange).not.toHaveBeenCalled();
  });
});

describe("TrueFalsePlayer self-check feedback", () => {
  it("shows the wrong notation and feedback line right after a wrong self-graded pick", () => {
    act(() => {
      root.render(<TrueFalsePlayer title="Chọn đúng hoặc sai" correct={false} />);
    });

    let options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    act(() => options[0].click()); // "Đúng" — wrong

    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options[0].className).toContain("bg-red-50");
    expect(options[0].className).not.toContain("bg-green-100");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    // The correct answer must not be leaked while the pupil can still retry.
    expect(options[1].className).not.toContain("bg-green-50");

    // Picking again re-reports and replaces the wrong state.
    act(() => options[1].click());
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    expect(options[1].className).toContain("bg-green-50");
  });

  it("shows no wrong notation for recordOnly (selfAssessment) picks", () => {
    act(() => {
      root.render(<TrueFalsePlayer title="Chọn đúng hoặc sai" correct={false} selfAssessment />);
    });

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    act(() => options[0].click());
    expect(options[0].className).not.toContain("bg-red-50");
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
  });

  it("keeps the selection mounted when the parent echoes the reported answer back", () => {
    const renderPlayer = (answer?: boolean) => {
      act(() => {
        root.render(
          <TrueFalsePlayer title="Chọn đúng hoặc sai" correct answer={answer} selfAssessment />,
        );
      });
    };

    renderPlayer(undefined);
    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    act(() => options[1].click());

    // Host stores the reported answer and passes it back down — the selection
    // must NOT remount (a remount replays the pill transition).
    renderPlayer(false);
    const optionsAfter = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(optionsAfter[1]).toBe(options[1]);
    expect(optionsAfter[1].getAttribute("aria-checked")).toBe("true");

    // A semantically different parent answer still rehydrates.
    renderPlayer(true);
    const rehydrated = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(rehydrated.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);
  });
});
