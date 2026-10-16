/**
 * Instant per-element grading for the matching reference player (MatchRows):
 * each LEFT item is one element; making/changing a pair grades that item
 * immediately — no "Kiểm tra" button needed while instant is active.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MatchRowsPlayer } from "./MatchRowsPlayer";

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
});

const leftItems = [
  { id: "l1", text: "Chó" },
  { id: "l2", text: "Mèo" },
];
const rightItems = [
  { id: "r1", text: "Gâu" },
  { id: "r2", text: "Meo" },
];
const correctPairs = { l1: "r1", l2: "r2" };

function clickText(t: string) {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(t),
  );
  act(() => btn!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function chipOf(t: string) {
  return Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(t),
  ) as HTMLButtonElement;
}

it("emits onElementGraded when a wrong pair is made — no need to finish", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <MatchRowsPlayer
        title="Q"
        leftItems={leftItems}
        rightItems={rightItems}
        correctPairs={correctPairs}
        onElementGraded={onElementGraded}
      />,
    ),
  );
  clickText("Chó");
  clickText("Meo"); // l1 -> r2 (sai)
  expect(onElementGraded).toHaveBeenCalledWith("l1", "incorrect", undefined);
  expect(chipOf("Chó").className).toContain("red");
});

it("hides Kiểm tra when instant, shows it when instantFeedback=false", () => {
  act(() =>
    root.render(
      <MatchRowsPlayer
        title="Q"
        leftItems={leftItems}
        rightItems={rightItems}
        correctPairs={correctPairs}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");

  act(() =>
    root.render(
      <MatchRowsPlayer
        title="Q"
        leftItems={leftItems}
        rightItems={rightItems}
        correctPairs={correctPairs}
        instantFeedback={false}
      />,
    ),
  );
  expect(container.textContent).toContain("Kiểm tra");
});

it("button mode: a wrong Kiểm tra marks the wrong chips red + shows the feedback line, and re-pairing clears it", () => {
  act(() =>
    root.render(
      <MatchRowsPlayer
        title="Q"
        leftItems={leftItems}
        rightItems={rightItems}
        correctPairs={correctPairs}
        instantFeedback={false}
      />,
    ),
  );
  clickText("Chó");
  clickText("Meo"); // l1 -> r2 (sai)
  clickText("Mèo");
  clickText("Gâu"); // l2 -> r1 (sai)
  clickText("Kiểm tra");

  expect(chipOf("Chó").className).toContain("red");
  // Không lộ đáp án đúng khi còn được thử lại.
  expect(chipOf("Chó").className).not.toContain("green");
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");

  clickText("Chó");
  clickText("Meo"); // gỡ cặp sai -> xoá trạng thái sai để thử lại
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
  expect(chipOf("Chó").className).not.toContain("red");
});

// Web vẫn hiện nút Kiểm tra ở self mode kể cả record-only (grade() report
// incomplete, không verdict giả) — kỳ vọng studio "ẩn nút" đã đổi (Owner 30/7).
it("recordOnly (no key): Kiểm tra button stays in self mode (reports incomplete)", () => {
  act(() =>
    root.render(
      <MatchRowsPlayer
        title="Q"
        leftItems={leftItems}
        rightItems={rightItems}
        correctPairs={{}}
        instantFeedback={false}
      />,
    ),
  );
  expect(container.textContent).toContain("Kiểm tra");
});

it("toggling a correct pair off clears the left chip back to idle", () => {
  act(() =>
    root.render(
      <MatchRowsPlayer
        title="Q"
        leftItems={leftItems}
        rightItems={rightItems}
        correctPairs={correctPairs}
      />,
    ),
  );
  clickText("Chó");
  clickText("Gâu"); // l1 -> r1 (đúng)
  expect(chipOf("Chó").className).toContain("green");
  clickText("Chó");
  clickText("Gâu"); // toggle OFF — gỡ cặp
  expect(chipOf("Chó").className).not.toContain("green");
  expect(chipOf("Chó").className).not.toContain("red");
});
