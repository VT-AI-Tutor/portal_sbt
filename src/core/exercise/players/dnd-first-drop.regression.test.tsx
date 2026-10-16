/**
 * Regression for issue #533 — "lần kéo đầu chỉ làm mờ thẻ, phải kéo lần 2 mới thả được".
 *
 * Native HTML5 drop only fires when `onDragOver` calls `preventDefault()`. The
 * buggy players gated that call behind React drag state (`if (!locked && dragId)`),
 * but that state is set asynchronously in `onDragStart` and hasn't committed for
 * the first `dragover` ticks — so the first drag never became droppable. The fix
 * drops the state condition: a drop target always prevents default while unlocked.
 *
 * jsdom can't reproduce Chrome's "cancel the drag when the source's transform
 * changes" behaviour (the Framer `layout` half of the fix), so this locks in the
 * observable half: dragover over a drop zone is cancelable-prevented with no prior
 * dragstart, and stays un-prevented when the player is locked.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";
import { DragToZonesPlayer } from "./DragToZonesPlayer";

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

/** Dispatch a bubbling, cancelable dragover from `el` and report if it was prevented. */
function dragOver(el: Element): boolean {
  const ev = new Event("dragover", { bubbles: true, cancelable: true });
  act(() => {
    el.dispatchEvent(ev);
  });
  return ev.defaultPrevented;
}

function byGroup(label: string): Element {
  const el = container.querySelector(`[aria-label="${label}"]`);
  if (!el) throw new Error(`no element with aria-label="${label}"`);
  return el;
}

it("TwoBucketSort: a bucket + the tray accept a drop on the first dragover (no prior drag state)", () => {
  act(() =>
    root.render(
      <TwoBucketSortPlayer
        title="Q"
        buckets={[
          { id: "b1", label: "Nhóm A" },
          { id: "b2", label: "Nhóm B" },
        ]}
        items={[{ id: "i1", text: "Thẻ 1" }]}
        correctMappings={{ i1: "b1" }}
      />,
    ),
  );
  // No dragstart fired → dragId is still null. Before the fix this dragover was
  // NOT prevented, so the first drop silently failed.
  expect(dragOver(byGroup("Các thẻ trong nhóm Nhóm A"))).toBe(true);
  expect(dragOver(byGroup("Các thẻ chưa phân loại"))).toBe(true);
});

it("TwoBucketSort: a submitted (locked) player does not prevent default → no drop", () => {
  act(() =>
    root.render(
      <TwoBucketSortPlayer
        title="Q"
        submitted
        buckets={[
          { id: "b1", label: "Nhóm A" },
          { id: "b2", label: "Nhóm B" },
        ]}
        items={[{ id: "i1", text: "Thẻ 1" }]}
        correctMappings={{ i1: "b1" }}
      />,
    ),
  );
  expect(dragOver(byGroup("Các thẻ trong nhóm Nhóm A"))).toBe(false);
});

it("DragToZones: a zone accepts a drop on the first dragover (no prior drag state)", () => {
  act(() =>
    root.render(
      <DragToZonesPlayer
        title="Q"
        draggables={[{ id: "d1", text: "Thẻ 1" }]}
        dropZones={[{ id: "z1", label: "Ô 1" }]}
        correctMappings={{ d1: "z1" }}
      />,
    ),
  );
  // Anchor on the zone label text, dragover bubbles up to the zone's handler.
  const label = Array.from(container.querySelectorAll("div")).find(
    (d) => d.textContent === "Ô 1",
  );
  expect(label, "zone label element").toBeTruthy();
  expect(dragOver(label!)).toBe(true);
});
