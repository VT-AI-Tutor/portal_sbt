/**
 * Record-only guards — when a question has no key or selfAssessment is on, the
 * button-driven players must hide "Kiểm tra" and never emit fake verdicts.
 * Companion of wrong-feedback-sounds.test.tsx (same fix wave).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HotspotMultiPlayer } from "./HotspotMultiPlayer";
import { PlacePinPlayer } from "./PlacePinPlayer";
import { ProcessSequencePlayer } from "./ProcessSequencePlayer";
import { RankPlayer } from "./RankPlayer";
import { ReorderListPlayer } from "./ReorderListPlayer";
import { TimelinePlayer } from "./TimelinePlayer";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";

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

const checkButton = () =>
  Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Kiểm tra",
  );

const ORDER_ITEMS = [
  { id: "a", text: "A" },
  { id: "b", text: "B" },
];

describe("ordering players (list / rank / process)", () => {
  const players = [
    ["ReorderListPlayer", ReorderListPlayer],
    ["RankPlayer", RankPlayer],
    ["ProcessSequencePlayer", ProcessSequencePlayer],
  ] as const;

  it.each(players)("%s: wrong self-check shows the red feedback line", (_name, Player) => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <Player
          title="Sắp xếp"
          items={ORDER_ITEMS}
          correctOrder={["a", "b"]}
          instantFeedback={false}
          onStatusChange={onStatusChange}
        />,
      );
    });

    // With 2 items the initial shuffle is guaranteed to differ from [a, b].
    const button = checkButton();
    expect(button).toBeTruthy();
    act(() => button?.click());

    expect(onStatusChange).toHaveBeenCalledWith("error");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("thử lại nhé!");
  });

  it.each(players)("%s: selfAssessment hides Kiểm tra (record-only)", (_name, Player) => {
    act(() => {
      root.render(
        <Player
          title="Sắp xếp"
          items={ORDER_ITEMS}
          correctOrder={["a", "b"]}
          instantFeedback={false}
          selfAssessment
        />,
      );
    });
    expect(checkButton()).toBeUndefined();
  });

  it.each(players)("%s: missing key hides Kiểm tra (record-only)", (_name, Player) => {
    act(() => {
      root.render(
        <Player
          title="Sắp xếp"
          items={ORDER_ITEMS}
          correctOrder={[]}
          instantFeedback={false}
        />,
      );
    });
    expect(checkButton()).toBeUndefined();
  });
});

describe("TimelinePlayer", () => {
  const props = {
    title: "Dòng thời gian",
    items: ORDER_ITEMS,
    slots: [
      { id: "s1", label: "1990" },
      { id: "s2", label: "2000" },
    ],
    correctOrder: ["a", "b"],
    instantFeedback: false,
  };

  it("shows Kiểm tra in graded mode but not in record-only", () => {
    act(() => {
      root.render(<TimelinePlayer {...props} />);
    });
    expect(checkButton()).toBeTruthy();

    act(() => {
      root.render(<TimelinePlayer {...props} selfAssessment />);
    });
    expect(checkButton()).toBeUndefined();
  });
});

describe("TwoBucketSortPlayer", () => {
  const props = {
    title: "Phân loại",
    buckets: [
      { id: "b1", label: "Nhóm 1" },
      { id: "b2", label: "Nhóm 2" },
    ] as [{ id: string; label: string }, { id: string; label: string }],
    items: [{ id: "i1", text: "Một" }],
    correctMappings: { i1: "b1" },
    instantFeedback: false,
  };

  it("wrong self-check shows the red feedback line", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(<TwoBucketSortPlayer {...props} onStatusChange={onStatusChange} />);
    });
    const button = checkButton();
    expect(button).toBeTruthy();
    act(() => button?.click()); // nothing placed → incorrect
    expect(onStatusChange).toHaveBeenCalledWith("error");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Có thẻ xếp nhầm rồi, thử lại nhé!");
  });

  it("selfAssessment hides Kiểm tra (record-only)", () => {
    act(() => {
      root.render(<TwoBucketSortPlayer {...props} selfAssessment />);
    });
    expect(checkButton()).toBeUndefined();
  });
});

describe("HotspotMultiPlayer", () => {
  const props = {
    title: "Chọn vùng",
    imageUrl: "/img.png",
    hotspots: [
      { id: "h1", x: 0.2, y: 0.2 },
      { id: "h2", x: 0.8, y: 0.8 },
    ],
    correctIds: ["h1"],
    instantFeedback: false,
  };

  it("shows Kiểm tra in graded mode but not in record-only", () => {
    act(() => {
      root.render(<HotspotMultiPlayer {...props} />);
    });
    expect(checkButton()).toBeTruthy();

    act(() => {
      root.render(<HotspotMultiPlayer {...props} selfAssessment />);
    });
    expect(checkButton()).toBeUndefined();
  });
});

describe("PlacePinPlayer", () => {
  const props = {
    title: "Đặt ghim",
    imageUrl: "/img.png",
    target: { x: 0.9, y: 0.9 },
  };

  const placePin = (clientX: number, clientY: number) => {
    const area = container.querySelector<HTMLElement>(".cursor-crosshair");
    expect(area).toBeTruthy();
    area!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    act(() => {
      area!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX, clientY }));
    });
  };

  it("wrong self-check shows the red line WITHOUT revealing the target zone", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(<PlacePinPlayer {...props} onStatusChange={onStatusChange} />);
    });

    placePin(10, 10); // far from target (0.9, 0.9)
    const button = checkButton();
    expect(button).toBeTruthy();
    act(() => button?.click());

    expect(onStatusChange).toHaveBeenCalledWith("error");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Gần đúng rồi, thử lại nhé!");
    // Regression: the dashed target zone must NOT leak while retry is possible.
    expect(container.querySelector(".border-dashed")).toBeNull();
  });

  it("selfAssessment hides Kiểm tra and still syncs the pin (record-only)", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(<PlacePinPlayer {...props} selfAssessment onAnswerChange={onAnswerChange} />);
    });

    placePin(10, 10);
    expect(onAnswerChange).toHaveBeenCalledWith({ x: 0.1, y: 0.1 });
    expect(checkButton()).toBeUndefined();
  });

  it("missing target data behaves as record-only (no key)", () => {
    act(() => {
      root.render(
        <PlacePinPlayer
          title="Đặt ghim"
          imageUrl="/img.png"
          target={undefined as unknown as { x: number; y: number }}
        />,
      );
    });
    placePin(10, 10);
    expect(checkButton()).toBeUndefined();
  });
});
