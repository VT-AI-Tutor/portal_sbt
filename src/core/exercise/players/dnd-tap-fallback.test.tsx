/**
 * Tap-to-select fallback for every drag player — the ONLY way to answer these
 * questions on a tablet.
 *
 * Native HTML5 drag-and-drop does not fire on iOS/iPadOS Safari or Chrome: no
 * `dragstart`, no `dragover`, no `drop`. A player whose only interaction is a
 * native drag is therefore not merely awkward on an iPad, it is unanswerable.
 * These tests drive each player purely by CLICK — never by a drag event — and
 * assert the answer actually lands, which is exactly what a touch user gets.
 *
 * The companion source-level guard in `dnd-source-shape.regression.test.ts`
 * fails the build if a new `DraggableChip` forgets `onClick`; this file proves
 * the wiring behind it really moves the item.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";
import { DragToZonesPlayer } from "./DragToZonesPlayer";
import { DragToGridPlayer } from "./DragToGridPlayer";
import { JigsawPlayer } from "./JigsawPlayer";
import { LabelDiagramPlayer } from "./LabelDiagramPlayer";
import { ReorderListPlayer } from "./ReorderListPlayer";
import { RankPlayer } from "./RankPlayer";
import { ProcessSequencePlayer } from "./ProcessSequencePlayer";
import { TimelinePlayer } from "./TimelinePlayer";
import * as security from "@/core/lib/security";

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

const click = (el: Element | null | undefined) => {
  expect(el, "expected the tap target to exist").toBeTruthy();
  act(() => el!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
};

/** The chip for `text` — a <button>, which is what passing onClick produces. */
const chip = (text: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === text);

const chipExists = (text: string) => !!chip(text);

/**
 * A reorder row's button also holds its position badge, so its text reads
 * "1Một" — match on a substring rather than the whole label.
 */
const row = (text: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(text));

/** The Timeline slot that is still showing its empty-state placeholder. */
const emptyTimelineSlot = () =>
  Array.from(container.querySelectorAll("div")).find(
    (n) => n.textContent?.trim() === "Kéo hoặc chạm để đặt",
  );

/** Walk up from a label to the ancestor carrying the drop handler. */
const ancestorOf = (el: Element, levels: number) => {
  let node: Element | null = el;
  for (let i = 0; i < levels && node; i++) node = node.parentElement;
  return node;
};

describe("drop-target players: tap a chip, tap a target", () => {
  it("TwoBucketSortPlayer places an item into the tapped bucket", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <TwoBucketSortPlayer
          title="Q"
          buckets={[
            { id: "b1", label: "Có" },
            { id: "b2", label: "Không" },
          ]}
          items={[{ id: "i1", text: "Chó" }]}
          correctMappings={{ i1: "b1" }}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );

    click(chip("Chó"));
    // The bucket heading sits inside the bucket div that owns the onClick.
    const heading = Array.from(container.querySelectorAll("h3, div")).find(
      (n) => n.textContent?.trim() === "Có",
    );
    click(heading);

    expect(onAnswerChange).toHaveBeenCalledWith({ i1: "b1" });
  });

  it("DragToZonesPlayer places a chip into the tapped zone", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <DragToZonesPlayer
          title="Q"
          draggables={[{ id: "d1", text: "Mèo" }]}
          dropZones={[{ id: "z1", label: "Vật nuôi" }]}
          correctMappings={{ d1: "z1" }}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );

    click(chip("Mèo"));
    const label = Array.from(container.querySelectorAll("div")).find(
      (n) => n.textContent?.trim() === "Vật nuôi",
    );
    click(ancestorOf(label!, 1));

    expect(onAnswerChange).toHaveBeenCalledWith({ d1: "z1" });
  });

  it("DragToGridPlayer drops a token into the tapped cell", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <DragToGridPlayer
          title="Q"
          rows={1}
          cols={2}
          tokens={[{ id: "t1", text: "A" }]}
          correctCells={{ "0-0": "t1" }}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );

    click(chip("A"));
    // Empty cells render a "+" placeholder; the first one is cell 0-0.
    const plus = Array.from(container.querySelectorAll("span")).find(
      (n) => n.textContent === "+",
    );
    click(plus!.parentElement);

    expect(onAnswerChange).toHaveBeenCalledWith({ "0-0": "t1" });
  });

  it("JigsawPlayer puts a tapped piece into the tapped slot", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <JigsawPlayer title="Q" rows={1} cols={2} onAnswerChange={onAnswerChange} />,
      ),
    );

    // No image → each piece renders its own "r-c" id as its label.
    click(chip("0-0"));
    // Board slots come before the tray; the first is slot 0-0.
    const slots = container.querySelectorAll(".grid > div");
    click(slots[0]);

    expect(onAnswerChange).toHaveBeenCalled();
    const answer = onAnswerChange.mock.calls.at(-1)![0] as { pieceId: string; slotId: string }[];
    expect(answer).toContainEqual({ pieceId: "0-0", slotId: "0-0" });
  });

  it("LabelDiagramPlayer pins a tapped label onto the tapped target dot", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <LabelDiagramPlayer
          title="Q"
          imageUrl="/x.png"
          labels={[{ id: "l1", text: "Rễ" }]}
          targets={[{ id: "t1", x: 0.5, y: 0.5 }]}
          correctMappings={{ l1: "t1" }}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );

    click(chip("Rễ"));
    const dot = container.querySelector('[style*="left"]');
    click(dot);

    expect(onAnswerChange).toHaveBeenCalledWith({ l1: "t1" });
  });

  it("returns a placed chip to the tray when it is tapped again", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <TwoBucketSortPlayer
          title="Q"
          buckets={[
            { id: "b1", label: "Có" },
            { id: "b2", label: "Không" },
          ]}
          items={[{ id: "i1", text: "Chó" }]}
          correctMappings={{ i1: "b1" }}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );

    click(chip("Chó"));
    click(
      Array.from(container.querySelectorAll("h3, div")).find((n) => n.textContent?.trim() === "Có"),
    );
    expect(onAnswerChange).toHaveBeenLastCalledWith({ i1: "b1" });

    // Tapping the placed chip sends it back — and must NOT also re-place it via
    // the bucket's own onClick, which is what stopPropagation guards.
    click(chip("Chó"));
    expect(onAnswerChange).toHaveBeenLastCalledWith({});
  });

  it("does not move anything when the player is locked", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <DragToZonesPlayer
          title="Q"
          draggables={[{ id: "d1", text: "Mèo" }]}
          dropZones={[{ id: "z1", label: "Vật nuôi" }]}
          correctMappings={{ d1: "z1" }}
          submitted
          onAnswerChange={onAnswerChange}
        />,
      ),
    );

    const target = chip("Mèo");
    expect(target?.disabled, "a locked chip must be a disabled button").toBe(true);
    click(target);
    click(
      ancestorOf(
        Array.from(container.querySelectorAll("div")).find(
          (n) => n.textContent?.trim() === "Vật nuôi",
        )!,
        1,
      ),
    );

    expect(onAnswerChange).not.toHaveBeenCalled();
  });
});

describe("reorder players: tap a row, tap where it should go", () => {
  const items = [
    { id: "a", text: "Một" },
    { id: "b", text: "Hai" },
    { id: "c", text: "Ba" },
  ];

  // displayOrder pins the starting order so the assertion is not fighting the
  // shuffle; Rank/ProcessSequence have no such prop, so those assert a change.
  it("ReorderListPlayer moves the picked row to the tapped row's position", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <ReorderListPlayer
          title="Q"
          items={items}
          correctOrder={["a", "b", "c"]}
          displayOrder={["a", "b", "c"]}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );

    click(row("Ba")); // pick up "c"
    click(row("Một")); // drop it where "a" is

    expect(onAnswerChange).toHaveBeenLastCalledWith(["c", "a", "b"]);
  });

  it("ReorderListPlayer puts a row back down when it is tapped twice", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <ReorderListPlayer
          title="Q"
          items={items}
          correctOrder={["a", "b", "c"]}
          displayOrder={["a", "b", "c"]}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );

    click(row("Ba"));
    click(row("Ba"));
    expect(onAnswerChange).not.toHaveBeenCalled();

    // Deselected, so the next tap starts a fresh pick rather than moving.
    click(row("Một"));
    click(row("Hai"));
    expect(onAnswerChange).toHaveBeenLastCalledWith(["b", "a", "c"]);
  });

  it.each([
    ["RankPlayer", RankPlayer],
    ["ProcessSequencePlayer", ProcessSequencePlayer],
  ] as const)("%s reorders by tapping two rows", (_name, Player) => {
    // Neither takes `displayOrder`, so both shuffle on mount. Pin the shuffle RNG
    // or the expected result depends on where the shuffle happened to put the
    // rows: shuffle([a,b,c]) with secureRandomInt()=0 is deterministically [b,c,a].
    const random = vi.spyOn(security, "secureRandomInt").mockReturnValue(0);
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <Player title="Q" items={items} correctOrder={["a", "b", "c"]} onAnswerChange={onAnswerChange} />,
      ),
    );

    click(row("Ba")); // pick up "c" (at index 1)
    click(row("Một")); // drop it where "a" is (index 2)

    // The count is deliberately not asserted: instant grading reports again
    // once every slot has been graded.
    expect(onAnswerChange).toHaveBeenCalled();
    expect(onAnswerChange.mock.calls.at(-1)![0]).toEqual(["b", "a", "c"]);
    random.mockRestore();
  });
});

describe("TimelinePlayer: tap a card, tap a slot", () => {
  const items = [
    { id: "i1", text: "Sự kiện 1" },
    { id: "i2", text: "Sự kiện 2" },
  ];
  const slots = [
    { id: "s1", label: "1945" },
    { id: "s2", label: "1975" },
  ];

  it("places a tapped tray card into the tapped slot", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <TimelinePlayer
          title="Q"
          items={items}
          slots={slots}
          correctOrder={["i1", "i2"]}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );

    click(chip("Sự kiện 1"));
    click(emptyTimelineSlot());

    expect(onAnswerChange).toHaveBeenLastCalledWith(["i1", null]);
  });

  it("sends a placed card back when the tray is tapped", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <TimelinePlayer
          title="Q"
          items={items}
          slots={slots}
          correctOrder={["i1", "i2"]}
          onAnswerChange={onAnswerChange}
        />,
      ),
    );

    click(chip("Sự kiện 1"));
    click(emptyTimelineSlot());
    expect(chipExists("Sự kiện 1")).toBe(true);

    // Pick the placed card back up, then tap the tray to return it.
    click(chip("Sự kiện 1"));
    const tray = Array.from(container.querySelectorAll("p")).find((n) =>
      n.textContent?.includes("mốc thời gian"),
    )?.parentElement;
    click(tray);

    expect(onAnswerChange).toHaveBeenLastCalledWith([null, null]);
  });
});
