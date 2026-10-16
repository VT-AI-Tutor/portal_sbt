/**
 * Instant per-element grading for ConnectLinesPlayer: each LEFT item is one
 * element; drawing/changing its line grades that item immediately — the
 * connecting SVG line turns red/green without waiting for "Kiểm tra".
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConnectLinesPlayer } from "./ConnectLinesPlayer";

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

function lineFor(leftId: string, rightId: string) {
  return container.querySelector(
    `[data-matching-edge="${leftId}->${rightId}"]`,
  ) as SVGLineElement | null;
}

it("emits onElementGraded when a wrong line is drawn — no need to finish, line turns red", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <ConnectLinesPlayer
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
  const line = lineFor("l1", "r2");
  expect(line).not.toBeNull();
  expect(line!.getAttribute("stroke")).toBe("#ef4444");
});

it("hides Kiểm tra when instant, shows it when instantFeedback=false", () => {
  act(() =>
    root.render(
      <ConnectLinesPlayer
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
      <ConnectLinesPlayer
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

it("button mode: a wrong Kiểm tra turns the wrong lines red + shows the feedback line, without revealing correct pairs", () => {
  // Ô nhiễu "Ụt" để nét sai không đâm vào cùng ô đích với nét đúng: khoá song
  // ánh nên trần vào là 1, hai nét chung một đích sẽ đẩy nhau ra.
  const decoyRightItems = [...rightItems, { id: "r3", text: "Ụt" }];
  act(() =>
    root.render(
      <ConnectLinesPlayer
        title="Q"
        leftItems={leftItems}
        rightItems={decoyRightItems}
        correctPairs={correctPairs}
        instantFeedback={false}
      />,
    ),
  );
  clickText("Chó");
  clickText("Ụt"); // l1 -> r3 (sai)
  clickText("Mèo");
  clickText("Meo"); // l2 -> r2 (đúng)
  clickText("Kiểm tra");

  expect(lineFor("l1", "r3")!.getAttribute("stroke")).toBe("#ef4444");
  // Cặp đúng giữ màu thường — không lộ đáp án khi còn được thử lại.
  expect(lineFor("l2", "r2")!.getAttribute("stroke")).not.toBe("#22c55e");
  expect(lineFor("l2", "r2")!.getAttribute("stroke")).not.toBe("#ef4444");
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");

  clickText("Chó");
  clickText("Ụt"); // gỡ cặp sai -> xoá trạng thái sai để thử lại
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
});

it("recordOnly (no key): no Kiểm tra button even in button mode", () => {
  act(() =>
    root.render(
      <ConnectLinesPlayer
        title="Q"
        leftItems={leftItems}
        rightItems={rightItems}
        correctPairs={{}}
        instantFeedback={false}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");
});

it("one-to-many: a wrong line from a left item does not turn its other, still-correct lines red (issue #528)", () => {
  const manyLeftItems = [{ id: "l1", text: "Mau_den" }];
  const manyRightItems = [
    { id: "r1", text: "Than" },
    { id: "r2", text: "ChatLieu" },
    { id: "r3", text: "VoSo" },
    { id: "r4", text: "KhongLienQuan" },
  ];
  // Ba đích đúng + một ý nhiễu: trần ra là 3, nên nét sai thứ ba là nét THỪA
  // về nội dung chứ không phải nét vượt trần.
  const correctEdges = [
    { item: "l1", target: "r1" },
    { item: "l1", target: "r2" },
    { item: "l1", target: "r3" },
  ];
  act(() =>
    root.render(
      <ConnectLinesPlayer
        title="Q"
        leftItems={manyLeftItems}
        rightItems={manyRightItems}
        correctEdges={correctEdges}
      />,
    ),
  );
  clickText("Mau_den");
  clickText("Than"); // l1 -> r1 (đúng)
  clickText("Mau_den");
  clickText("ChatLieu"); // l1 -> r2 (đúng)
  expect(lineFor("l1", "r1")!.getAttribute("stroke")).toBe("#22c55e");
  expect(lineFor("l1", "r2")!.getAttribute("stroke")).toBe("#22c55e");

  clickText("Mau_den");
  clickText("KhongLienQuan"); // l1 -> r4 (sai) — target set không khớp đáp án nữa

  // Dây sai chuyển đỏ, nhưng hai dây đúng còn lại vẫn giữ màu xanh.
  expect(lineFor("l1", "r4")!.getAttribute("stroke")).toBe("#ef4444");
  expect(lineFor("l1", "r1")!.getAttribute("stroke")).toBe("#22c55e");
  expect(lineFor("l1", "r2")!.getAttribute("stroke")).toBe("#22c55e");
});

it("a correct line turns green immediately, and removing it clears back to idle", () => {
  act(() =>
    root.render(
      <ConnectLinesPlayer
        title="Q"
        leftItems={leftItems}
        rightItems={rightItems}
        correctPairs={correctPairs}
      />,
    ),
  );
  clickText("Chó");
  clickText("Gâu"); // l1 -> r1 (đúng)
  expect(lineFor("l1", "r1")!.getAttribute("stroke")).toBe("#22c55e");

  clickText("Chó");
  clickText("Gâu"); // toggle OFF — gỡ cặp
  expect(lineFor("l1", "r1")).toBeNull();
});
