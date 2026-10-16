import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { FieldResizeContext } from "@/core/exercise/field-resize-context";

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

// Corpus-shaped payload (labeling): targets carry x/y only (normalized 0..1,
// CENTER-anchored) — move-only geometry, no size data.
function payload(overrides: Record<string, unknown> = {}) {
  return {
    image: { url: "/uploads/face.png" },
    labels: [
      { id: "l_mui", text: "Mũi" },
      { id: "l_mat", text: "Mắt" },
    ],
    targets: [
      { id: "t_mui", x: 0.63, y: 0.25 },
      { id: "t_mat", x: 0.4, y: 0.15 },
    ],
    correctAnswer: [
      { labelId: "l_mui", targetId: "t_mui" },
      { labelId: "l_mat", targetId: "t_mat" },
    ],
    ...overrides,
  };
}

function targetWrapper(left: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>("div")).find(
    (d) => d.style.left === left && d.className.includes("-translate-x-1/2"),
  );
}

describe("LabelDiagramPlayer geometry affordances", () => {
  it("renders no move areas without a provider and keeps HTML5 drag-and-drop working", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(renderInteractionPlayer("labeling", payload(), { onAnswerChange }));
    });

    expect(container.querySelector("[data-move-area]")).toBeNull();

    // Play interaction intact: drag the first chip from the tray onto a target.
    const chip = container.querySelector<HTMLElement>('[draggable="true"]');
    const target = targetWrapper("63%");
    expect(chip).not.toBeNull();
    expect(target).not.toBeUndefined();
    act(() => {
      chip!.dispatchEvent(new MouseEvent("dragstart", { bubbles: true }));
    });
    act(() => {
      target!.dispatchEvent(new MouseEvent("drop", { bubbles: true }));
    });
    expect(onAnswerChange).toHaveBeenLastCalledWith({ l_mui: "t_mui" });
  });

  // Regression #563: the chip must NOT be remounted by the dragstart re-render.
  // `Chip` used to be defined inside the player, so every `setDragId` gave it a
  // new identity → React tore out + recreated every chip → the native drag
  // SOURCE node was removed from the DOM mid-drag → Chrome cancelled the drag
  // (chip only dimmed, no drag image, drop never fired). jsdom can't reproduce
  // Chrome's cancel, but it CAN prove the node identity is now stable.
  it("keeps the draggable chip node alive across the dragstart re-render (no remount)", () => {
    act(() => {
      root.render(renderInteractionPlayer("labeling", payload(), {}));
    });

    const before = container.querySelector<HTMLElement>('[draggable="true"]');
    expect(before).not.toBeNull();
    // dragstart sets dragId → the player re-renders while the drag is live.
    act(() => {
      before!.dispatchEvent(new MouseEvent("dragstart", { bubbles: true }));
    });
    const after = container.querySelector<HTMLElement>('[draggable="true"]');
    // The SAME node must persist — not be unmounted and replaced.
    expect(document.contains(before!)).toBe(true);
    expect(after).toBe(before);
  });

  // Regression #563: the native drag SOURCE must not carry a CSS transform.
  // Chrome cancels a native drag when the source element's transform changes on
  // the `dragstart` re-render (the setDragId re-render), so the entrance/hover
  // scale must live on a wrapper, never on the `draggable` node itself. jsdom
  // can't reproduce Chrome's cancel, so we lock the structural invariant.
  it("keeps the entrance/hover scale off the draggable chip (transform on a wrapper)", () => {
    act(() => {
      root.render(renderInteractionPlayer("labeling", payload(), {}));
    });

    const chips = container.querySelectorAll<HTMLElement>('[draggable="true"]');
    expect(chips.length).toBeGreaterThan(0);
    chips.forEach((chip) => {
      // The drag source itself carries no inline transform...
      expect(chip.style.transform).toBeFalsy();
      // ...and is wrapped by the animated (motion) element that holds the scale.
      expect(chip.parentElement?.className).toContain("inline-flex");
    });
  });

  it("renders no move areas with a v1 width-only controller (no onGeometry)", () => {
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn() }}>
          {renderInteractionPlayer("labeling", payload(), {})}
        </FieldResizeContext.Provider>,
      );
    });

    expect(container.querySelector("[data-move-area]")).toBeNull();
  });

  it("renders a MoveArea per target (move only — no resize/radius) with an onGeometry controller", () => {
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          {renderInteractionPlayer("labeling", payload(), {})}
        </FieldResizeContext.Provider>,
      );
    });

    expect(container.querySelector('[data-move-area="t_mui"]')).not.toBeNull();
    expect(container.querySelector('[data-move-area="t_mat"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-move-area]")).toHaveLength(2);
    expect(container.querySelector("[data-resize-handle]")).toBeNull();
    expect(container.querySelector("[data-radius-handle]")).toBeNull();
  });
});
