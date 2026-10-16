/**
 * "Wrong answer must never be silent" — arrangement/matching players:
 * a self-graded wrong "Kiểm tra" must show red notation on the wrong elements
 * plus the red feedback line, and recordOnly questions (selfAssessment / no
 * key) must not grade at all (no Kiểm tra button, no fake verdicts).
 * Sibling coverage: CategorizeInstant / ConnectLinesInstant / MatchRowsInstant /
 * MatchScenePlayer / WordBankPlayer / DiagramFillPlayer test files.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardSortPlayer } from "./CardSortPlayer";
import { ChainMatchPlayer } from "./ChainMatchPlayer";
import { MatchRadialPlayer } from "./MatchRadialPlayer";
import { TwoColumnMatchPlayer } from "./TwoColumnMatchPlayer";
import { DragToGridPlayer } from "./DragToGridPlayer";
import { DragToZonesPlayer } from "./DragToZonesPlayer";
import { LabelDiagramPlayer } from "./LabelDiagramPlayer";

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

const FEEDBACK = "Chưa đúng, thử lại nhé!";

/** Click the first button containing the text; fall back to an h3 (bubbles to
 * its container's onClick — category piles/buckets render labels in an h3). */
function clickText(t: string) {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(t),
  );
  const target = btn ?? Array.from(container.querySelectorAll("h3")).find((h) =>
    h.textContent?.includes(t),
  );
  act(() => target!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function chipOf(t: string) {
  return Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(t),
  ) as HTMLButtonElement;
}

function lineFor(fromId: string, toId: string) {
  return container.querySelector(
    `[data-matching-edge="${fromId}->${toId}"]`,
  ) as SVGLineElement | null;
}

describe("CardSortPlayer recordOnly guard + error feedback", () => {
  const categories = [
    { id: "c1", label: "Nhóm Một" },
    { id: "c2", label: "Nhóm Hai" },
  ];
  const cards = [
    { id: "k1", text: "Thẻ A" },
    { id: "k2", text: "Thẻ B" },
  ];
  const correctMappings = { k1: "c1", k2: "c2" };

  it("button mode: a wrong Kiểm tra shows the red feedback text, and rearranging clears it", () => {
    act(() =>
      root.render(
        <CardSortPlayer
          title="Q"
          categories={categories}
          cards={cards}
          correctMappings={correctMappings}
          instantFeedback={false}
        />,
      ),
    );
    clickText("Thẻ A");
    clickText("Nhóm Hai"); // sai
    clickText("Thẻ B");
    clickText("Nhóm Một"); // sai
    clickText("Kiểm tra");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Có thẻ chưa đúng nhóm, thử lại nhé!");

    clickText("Thẻ A"); // card in pile -> returns to tray, clearing the error
    expect(container.textContent).not.toContain("Có thẻ chưa đúng nhóm");
  });

  it("recordOnly (selfAssessment): no Kiểm tra button and no self-grading on host submit", () => {
    const onStatusChange = vi.fn();
    const renderPlayer = (submitted: boolean) =>
      act(() =>
        root.render(
          <CardSortPlayer
            title="Q"
            categories={categories}
            cards={cards}
            correctMappings={correctMappings}
            instantFeedback={false}
            selfAssessment
            submitted={submitted}
            onStatusChange={onStatusChange}
          />,
        ),
      );
    renderPlayer(false);
    clickText("Thẻ A");
    clickText("Nhóm Hai"); // "wrong" pile — must not matter in recordOnly
    clickText("Thẻ B");
    clickText("Nhóm Một");
    expect(container.textContent).not.toContain("Kiểm tra");

    renderPlayer(true); // host submit — the player must never self-grade here
    expect(onStatusChange).not.toHaveBeenCalledWith("error");
    expect(onStatusChange).not.toHaveBeenCalledWith("success");
  });

  it("recordOnly (no key): no Kiểm tra button", () => {
    act(() =>
      root.render(
        <CardSortPlayer
          title="Q"
          categories={categories}
          cards={cards}
          correctMappings={{}}
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).not.toContain("Kiểm tra");
  });
});

describe("ChainMatchPlayer self-check feedback", () => {
  const leftItems = [{ id: "l1", text: "Trái" }];
  const middleItems = [
    { id: "m1", text: "GiữaMột" },
    { id: "m2", text: "GiữaHai" },
  ];
  const rightItems = [{ id: "r1", text: "Phải" }];
  const correctPairs = { l1: "m1", m1: "r1" };

  it("button mode: a wrong Kiểm tra marks the wrong node + line red and shows the feedback line, without leaking correct pairs", () => {
    act(() =>
      root.render(
        <ChainMatchPlayer
          title="Q"
          leftItems={leftItems}
          middleItems={middleItems}
          rightItems={rightItems}
          correctPairs={correctPairs}
          instantFeedback={false}
        />,
      ),
    );
    clickText("Trái");
    clickText("GiữaHai"); // l1 -> m2 (sai)
    clickText("GiữaMột");
    clickText("Phải"); // m1 -> r1 (đúng)
    clickText("Kiểm tra");

    expect(chipOf("Trái").className).toContain("red");
    // Cặp đúng không được tô xanh khi còn được thử lại — không lộ đáp án.
    expect(chipOf("GiữaMột").className).not.toContain("green");
    expect(lineFor("l1", "m2")!.getAttribute("stroke")).toBe("#ef4444");
    expect(lineFor("m1", "r1")!.getAttribute("stroke")).not.toBe("#22c55e");
    expect(lineFor("m1", "r1")!.getAttribute("stroke")).not.toBe("#ef4444");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);

    clickText("Trái");
    clickText("GiữaHai"); // gỡ cặp sai -> xoá trạng thái sai để thử lại
    expect(container.textContent).not.toContain(FEEDBACK);
    expect(chipOf("Trái").className).not.toContain("red");
  });

  // Web vẫn hiện nút Kiểm tra ở self mode kể cả record-only (grade() report
  // incomplete, không verdict giả) — kỳ vọng studio "ẩn nút" đã đổi (Owner 30/7).
  it("recordOnly (no key): Kiểm tra button stays in self mode (reports incomplete)", () => {
    act(() =>
      root.render(
        <ChainMatchPlayer
          title="Q"
          leftItems={leftItems}
          middleItems={middleItems}
          rightItems={rightItems}
          correctPairs={{}}
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).toContain("Kiểm tra");
  });
});

describe("MatchRadialPlayer self-check feedback", () => {
  const leftItems = [
    { id: "l1", text: "Cáo" },
    { id: "l2", text: "Gấu" },
  ];
  const rightItems = [
    { id: "r1", text: "Hang" },
    { id: "r2", text: "Rừng" },
  ];
  const correctPairs = { l1: "r1", l2: "r2" };

  it("button mode: a wrong Kiểm tra marks the wrong chips red + shows the feedback line, and re-pairing clears it", () => {
    act(() =>
      root.render(
        <MatchRadialPlayer
          title="Q"
          leftItems={leftItems}
          rightItems={rightItems}
          correctPairs={correctPairs}
          instantFeedback={false}
        />,
      ),
    );
    clickText("Cáo");
    clickText("Rừng"); // l1 -> r2 (sai)
    clickText("Gấu");
    clickText("Hang"); // l2 -> r1 (sai)
    clickText("Kiểm tra");

    expect(chipOf("Cáo").className).toContain("red");
    expect(chipOf("Cáo").className).not.toContain("green");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);

    clickText("Cáo");
    clickText("Rừng"); // gỡ cặp sai -> xoá trạng thái sai để thử lại
    expect(container.textContent).not.toContain(FEEDBACK);
    expect(chipOf("Cáo").className).not.toContain("red");
  });

  // Web vẫn hiện nút Kiểm tra ở self mode kể cả record-only (grade() report
  // incomplete, không verdict giả) — kỳ vọng studio "ẩn nút" đã đổi (Owner 30/7).
  it("recordOnly (no key): Kiểm tra button stays in self mode (reports incomplete)", () => {
    act(() =>
      root.render(
        <MatchRadialPlayer
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
});

describe("TwoColumnMatchPlayer self-check feedback", () => {
  const leftItems = [
    { id: "l1", text: "Cáo" },
    { id: "l2", text: "Gấu" },
  ];
  const rightItems = [
    { id: "r1", text: "Hang" },
    { id: "r2", text: "Rừng" },
    // Ý nhiễu: khoá song ánh nên trần vào là 1, nét sai phải có ô đích riêng
    // thay vì đâm vào cùng ô với nét đúng.
    { id: "r3", text: "Biển" },
  ];
  const correctPairs = { l1: "r1", l2: "r2" };

  it("button mode: a wrong Kiểm tra marks the wrong chips + lines red and shows the feedback line, and re-pairing clears it", () => {
    act(() =>
      root.render(
        <TwoColumnMatchPlayer
          title="Q"
          leftItems={leftItems}
          rightItems={rightItems}
          correctPairs={correctPairs}
          instantFeedback={false}
        />,
      ),
    );
    clickText("Cáo");
    clickText("Biển"); // l1 -> r3 (sai)
    clickText("Gấu");
    clickText("Rừng"); // l2 -> r2 (đúng)
    clickText("Kiểm tra");

    expect(chipOf("Cáo").className).toContain("red");
    // Cặp đúng giữ màu thường — không lộ đáp án khi còn được thử lại.
    expect(chipOf("Gấu").className).not.toContain("green");
    expect(lineFor("l1", "r3")!.getAttribute("stroke")).toBe("#ef4444");
    expect(lineFor("l2", "r2")!.getAttribute("stroke")).not.toBe("#22c55e");
    expect(lineFor("l2", "r2")!.getAttribute("stroke")).not.toBe("#ef4444");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);

    clickText("Cáo");
    clickText("Biển"); // gỡ cặp sai -> xoá trạng thái sai để thử lại
    expect(container.textContent).not.toContain(FEEDBACK);
    expect(chipOf("Cáo").className).not.toContain("red");
  });

  it("recordOnly (no key): no Kiểm tra button even in button mode", () => {
    act(() =>
      root.render(
        <TwoColumnMatchPlayer
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
});

describe("Drag players recordOnly guard (no Kiểm tra, no fake verdicts)", () => {
  it("DragToGridPlayer: no button when selfAssessment or the key is empty; button stays for real grading", () => {
    const tokens = [{ id: "t1", text: "Một" }];
    act(() =>
      root.render(
        <DragToGridPlayer
          title="Q"
          rows={1}
          cols={2}
          tokens={tokens}
          correctCells={{ "0-0": "t1" }}
          selfAssessment
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).not.toContain("Kiểm tra");

    act(() =>
      root.render(
        <DragToGridPlayer
          title="Q"
          rows={1}
          cols={2}
          tokens={tokens}
          correctCells={{}}
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).not.toContain("Kiểm tra");

    act(() =>
      root.render(
        <DragToGridPlayer
          title="Q"
          rows={1}
          cols={2}
          tokens={tokens}
          correctCells={{ "0-0": "t1" }}
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).toContain("Kiểm tra");
  });

  it("DragToZonesPlayer: no button when selfAssessment or the key is empty; button stays for real grading", () => {
    const draggables = [{ id: "d1", text: "Một" }];
    const dropZones = [{ id: "z1", label: "Vùng" }];
    act(() =>
      root.render(
        <DragToZonesPlayer
          title="Q"
          draggables={draggables}
          dropZones={dropZones}
          correctMappings={{ d1: "z1" }}
          selfAssessment
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).not.toContain("Kiểm tra");

    act(() =>
      root.render(
        <DragToZonesPlayer
          title="Q"
          draggables={draggables}
          dropZones={dropZones}
          correctMappings={{}}
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).not.toContain("Kiểm tra");

    act(() =>
      root.render(
        <DragToZonesPlayer
          title="Q"
          draggables={draggables}
          dropZones={dropZones}
          correctMappings={{ d1: "z1" }}
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).toContain("Kiểm tra");
  });

  it("LabelDiagramPlayer: no button when selfAssessment or the key is empty; button stays for real grading", () => {
    const labels = [{ id: "n1", text: "Nhãn" }];
    const targets = [{ id: "p1", x: 0.5, y: 0.5 }];
    act(() =>
      root.render(
        <LabelDiagramPlayer
          title="Q"
          imageUrl="/hinh.png"
          labels={labels}
          targets={targets}
          correctMappings={{ n1: "p1" }}
          selfAssessment
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).not.toContain("Kiểm tra");

    act(() =>
      root.render(
        <LabelDiagramPlayer
          title="Q"
          imageUrl="/hinh.png"
          labels={labels}
          targets={targets}
          correctMappings={{}}
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).not.toContain("Kiểm tra");

    act(() =>
      root.render(
        <LabelDiagramPlayer
          title="Q"
          imageUrl="/hinh.png"
          labels={labels}
          targets={targets}
          correctMappings={{ n1: "p1" }}
          instantFeedback={false}
        />,
      ),
    );
    expect(container.textContent).toContain("Kiểm tra");
  });
});
