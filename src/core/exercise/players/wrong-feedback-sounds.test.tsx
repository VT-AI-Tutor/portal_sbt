/**
 * Wrong-answer feedback + sounds — a wrong self-checked answer must never be
 * silent (red notation/line + error sound), and record-only mode must never
 * grade or play verdict sounds. Companion of record-only-guards.test.tsx.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../tasks/AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

import { playError, playSuccess } from "../tasks/AudioUtils";
import { HangmanPlayer } from "./HangmanPlayer";
import { HotspotSinglePlayer } from "./HotspotSinglePlayer";
import { JigsawPlayer } from "./JigsawPlayer";
import { MemoryMatchPlayer } from "./MemoryMatchPlayer";
import { PathConnectPlayer } from "./PathConnectPlayer";
import { PikachuPlayer } from "./PikachuPlayer";
import { SpotDifferencePlayer } from "./SpotDifferencePlayer";
import { WordSearchPlayer } from "./WordSearchPlayer";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const buttonWithText = (text: string) =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text),
  );

/** Mock the bounding rect of the clickable media area, then click at (x, y). */
const clickArea = (clientX: number, clientY: number) => {
  const area = container.querySelector<HTMLElement>(".cursor-crosshair");
  expect(area).toBeTruthy();
  area!.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  act(() => {
    area!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX, clientY }));
  });
};

describe("HotspotSinglePlayer", () => {
  const props = {
    title: "Chọn vùng",
    imageUrl: "/img.png",
    hotspots: [
      { id: "h1", x: 0.2, y: 0.2 },
      { id: "h2", x: 0.8, y: 0.8 },
    ],
    correctId: "h1",
  };

  it("wrong pick shows the red marker message and plays the error sound", () => {
    act(() => {
      root.render(<HotspotSinglePlayer {...props} />);
    });
    clickArea(80, 80); // hits h2 — wrong
    expect(playError).toHaveBeenCalledTimes(1);
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chưa đúng rồi, thử lại nhé!");
  });

  it("record-only pick syncs the answer without grading", () => {
    const onAnswerChange = vi.fn();
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <HotspotSinglePlayer
          {...props}
          selfAssessment
          onAnswerChange={onAnswerChange}
          onStatusChange={onStatusChange}
        />,
      );
    });
    clickArea(80, 80);
    expect(onAnswerChange).toHaveBeenCalledWith("h2");
    expect(onStatusChange).toHaveBeenCalledWith("idle");
    expect(playError).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Chưa đúng rồi");
  });
});

describe("HangmanPlayer", () => {
  it("losing plays the error sound in graded mode", () => {
    act(() => {
      root.render(<HangmanPlayer title="Đoán từ" word="A" maxWrong={0} />);
    });
    const wrongKey = buttonWithText("C");
    expect(wrongKey).toBeTruthy();
    act(() => wrongKey?.click()); // 1 wrong > maxWrong 0 → lose
    expect(playError).toHaveBeenCalledTimes(1);
  });

  it("record-only guesses only sync the answer — no verdict, no sounds", () => {
    const onAnswerChange = vi.fn();
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <HangmanPlayer
          title="Đoán từ"
          word="AB"
          selfAssessment
          onAnswerChange={onAnswerChange}
          onStatusChange={onStatusChange}
        />,
      );
    });
    act(() => buttonWithText("A")?.click());
    act(() => buttonWithText("B")?.click()); // fully revealed
    expect(onAnswerChange).toHaveBeenLastCalledWith("AB");
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
    expect(playSuccess).not.toHaveBeenCalled();
    expect(playError).not.toHaveBeenCalled();
  });
});

describe("JigsawPlayer", () => {
  const draggables = () =>
    Array.from(container.querySelectorAll<HTMLElement>('[draggable="true"]'));
  const boardSlots = () =>
    Array.from(
      container.querySelector<HTMLElement>(".aspect-square")!.children,
    ) as HTMLElement[];

  const dragTo = (piece: HTMLElement, target: HTMLElement) => {
    act(() => {
      piece.dispatchEvent(new Event("dragstart", { bubbles: true }));
    });
    act(() => {
      target.dispatchEvent(new Event("drop", { bubbles: true }));
    });
  };

  it("a fully placed but wrong board reports incorrect (red line + sound), moving a piece clears it", () => {
    act(() => {
      root.render(<JigsawPlayer title="Ghép hình" rows={1} cols={2} />);
    });

    // Place both pieces swapped → full board, wrong arrangement.
    const piece = (id: string) => draggables().find((d) => d.textContent === id)!;
    dragTo(piece("0-0"), boardSlots()[1]);
    dragTo(piece("0-1"), boardSlots()[0]);

    expect(playError).toHaveBeenCalledTimes(1);
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Bức tranh chưa đúng");

    // Moving a piece back to the tray clears the error for the retry.
    const tray = container.querySelector("h3")!.parentElement as HTMLElement;
    dragTo(piece("0-1"), tray);
    expect(container.textContent).not.toContain("Bức tranh chưa đúng");
  });

  it("record-only never grades a completed board", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <JigsawPlayer
          title="Ghép hình"
          rows={1}
          cols={2}
          selfAssessment
          onStatusChange={onStatusChange}
        />,
      );
    });
    const piece = (id: string) => draggables().find((d) => d.textContent === id)!;
    dragTo(piece("0-0"), boardSlots()[0]);
    dragTo(piece("0-1"), boardSlots()[1]); // correct arrangement
    expect(playSuccess).not.toHaveBeenCalled();
    expect(playError).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
  });
});

describe("PathConnectPlayer", () => {
  it("clicking a wrong node flashes red AND plays the error sound", () => {
    act(() => {
      root.render(
        <PathConnectPlayer
          title="Nối đường"
          nodes={[
            { id: "n1", label: "Một", x: 0.2, y: 0.2 },
            { id: "n2", label: "Hai", x: 0.8, y: 0.8 },
          ]}
          correctPath={["n1", "n2"]}
        />,
      );
    });
    act(() => buttonWithText("Hai")?.click()); // expected first node is n1
    expect(playError).toHaveBeenCalledTimes(1);
  });
});

describe("MemoryMatchPlayer", () => {
  const pairs = [
    { id: "p1", a: { text: "A1" }, b: { text: "B1" } },
    { id: "p2", a: { text: "A2" }, b: { text: "B2" } },
  ];

  it("a mismatched pair plays the error sound (flip-back kept)", () => {
    act(() => {
      root.render(<MemoryMatchPlayer title="Lật thẻ" pairs={pairs} />);
    });
    act(() => buttonWithText("A1")?.click());
    act(() => buttonWithText("A2")?.click()); // different pair → mismatch
    expect(playError).toHaveBeenCalledTimes(1);
  });

  it("record-only completes without a verdict or success sound", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <MemoryMatchPlayer title="Lật thẻ" pairs={pairs} selfAssessment onStatusChange={onStatusChange} />,
      );
    });
    act(() => buttonWithText("A1")?.click());
    act(() => buttonWithText("B1")?.click());
    act(() => buttonWithText("A2")?.click());
    act(() => buttonWithText("B2")?.click());
    expect(playSuccess).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
  });
});

describe("PikachuPlayer", () => {
  const tiles = [
    { id: "t1", symbol: "🐟" },
    { id: "t2", symbol: "🐟" },
    { id: "t3", symbol: "🐱" },
    { id: "t4", symbol: "🐱" },
  ];

  it("a mismatched pair plays the error sound (shake kept)", () => {
    act(() => {
      root.render(<PikachuPlayer title="Pikachu" tiles={tiles} />);
    });
    act(() => buttonWithText("🐟")?.click());
    act(() => buttonWithText("🐱")?.click());
    expect(playError).toHaveBeenCalledTimes(1);
  });

  it("record-only clears the board without a verdict or success sound", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <PikachuPlayer title="Pikachu" tiles={tiles} selfAssessment onStatusChange={onStatusChange} />,
      );
    });
    const tilesWith = (symbol: string) =>
      Array.from(container.querySelectorAll("button")).filter((b) =>
        b.textContent?.includes(symbol),
      );
    act(() => tilesWith("🐟")[0].click());
    act(() => tilesWith("🐟")[1].click());
    act(() => tilesWith("🐱")[0].click());
    act(() => tilesWith("🐱")[1].click());
    expect(playSuccess).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
  });
});

describe("SpotDifferencePlayer", () => {
  const props = {
    title: "Tìm điểm khác",
    imageA: "/a.png",
    imageB: "/b.png",
    differences: [{ id: "d1", x: 0.5, y: 0.5 }],
  };

  it("finding all differences reports correct in graded mode", () => {
    act(() => {
      root.render(<SpotDifferencePlayer {...props} />);
    });
    clickArea(50, 50);
    expect(playSuccess).toHaveBeenCalledTimes(1);
  });

  it("record-only finds them all without a verdict or success sound", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(<SpotDifferencePlayer {...props} selfAssessment onStatusChange={onStatusChange} />);
    });
    clickArea(50, 50);
    expect(playSuccess).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
  });
});

describe("WordSearchPlayer", () => {
  const props = {
    title: "Tìm từ",
    grid: [["C", "A"]],
    words: ["CA"],
  };

  const selectRun = () => {
    const cells = Array.from(container.querySelectorAll("button")).filter((b) =>
      ["C", "A"].includes(b.textContent ?? ""),
    );
    act(() => {
      cells[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    act(() => {
      cells[1].dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
  };

  it("finding every word reports correct in graded mode", () => {
    act(() => {
      root.render(<WordSearchPlayer {...props} />);
    });
    selectRun();
    expect(playSuccess).toHaveBeenCalledTimes(1);
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Tuyệt vời! Tìm được hết rồi!");
  });

  it("record-only finds every word without a verdict or success sound", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(<WordSearchPlayer {...props} selfAssessment onStatusChange={onStatusChange} />);
    });
    selectRun();
    expect(playSuccess).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
  });
});
