import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HotspotSinglePlayer, type SingleHotspot } from "./HotspotSinglePlayer";
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

/** Give the play container a real box so normalized click math works in jsdom. */
function stubRect(el: HTMLElement, width = 100, height = 100) {
  el.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }) as DOMRect;
}

function clickAt(el: HTMLElement, clientX: number, clientY: number) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX, clientY }));
  });
}

const playContainer = () => container.querySelector<HTMLElement>("img")!.parentElement!;

// Mixed corpus shapes (rect/circle/polygon pass through the dispatch cast).
const MIXED = [
  { id: "h1", shape: "rect", x: 0.5, y: 0.5, width: 0.35, height: 0.8, label: "Vùng trái" },
  { id: "c1", shape: "circle", x: 0.3, y: 0.3, radius: 0.1 },
  { id: "hs11", shape: "polygon", points: [[0.0135, 0.5633], [0.4, 0.6], [0.2, 0.9]] },
] as unknown as SingleHotspot[];

describe("HotspotSinglePlayer edit overlay", () => {
  it("renders no overlay without a provider and click-to-answer still works", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <HotspotSinglePlayer
          title="Bấm vào vùng đúng"
          imageUrl="/img.png"
          hotspots={[{ id: "c1", x: 0.3, y: 0.3, radius: 0.1 }]}
          correctId="c1"
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    expect(container.querySelector("[data-hotspot-edit-overlay]")).toBeNull();
    expect(container.querySelector("[data-move-area]")).toBeNull();
    expect(container.querySelector("[data-edit-outline]")).toBeNull();

    const target = playContainer();
    stubRect(target);
    clickAt(target, 30, 30);
    expect(onAnswerChange).toHaveBeenCalledWith("c1");
  });

  it("renders no overlay with an onResize-only controller and still grades clicks", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn() }}>
          <HotspotSinglePlayer
            title="Bấm vào vùng đúng"
          imageUrl="/img.png"
            hotspots={[{ id: "c1", x: 0.3, y: 0.3, radius: 0.1 }]}
            correctId="c1"
            onAnswerChange={onAnswerChange}
          />
        </FieldResizeContext.Provider>,
      );
    });

    expect(container.querySelector("[data-hotspot-edit-overlay]")).toBeNull();
    expect(container.querySelector("[data-move-area]")).toBeNull();

    const target = playContainer();
    stubRect(target);
    clickAt(target, 30, 30);
    expect(onAnswerChange).toHaveBeenCalledWith("c1");
  });

  it("renders one dashed outline per shape with the right affordances under an onGeometry controller", () => {
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          <HotspotSinglePlayer title="Bấm vào vùng đúng" imageUrl="/img.png" hotspots={MIXED} correctId="c1" />
        </FieldResizeContext.Provider>,
      );
    });

    expect(container.querySelectorAll("[data-edit-outline]").length).toBe(3);

    // rect: move + xy-resize, no radius grip
    expect(container.querySelector('[data-move-area="h1"]')).not.toBeNull();
    expect(container.querySelector('[data-resize-handle="h1"]')).not.toBeNull();
    expect(container.querySelector('[data-radius-handle="h1"]')).toBeNull();

    // circle: move + radius grip, no resize handle
    expect(container.querySelector('[data-move-area="c1"]')).not.toBeNull();
    expect(container.querySelector('[data-radius-handle="c1"]')).not.toBeNull();
    expect(container.querySelector('[data-resize-handle="c1"]')).toBeNull();

    // rect anchoring: x/y is the TOP-LEFT corner (matches hitTestHotspot) —
    // no center-translate, so the outline covers the real hit zone.
    const rect = container.querySelector<HTMLElement>('[data-edit-outline="h1"]')!;
    expect(rect.style.left).toBe("50%");
    expect(rect.style.top).toBe("50%");
    expect(rect.style.width).toBe("35%");
    expect(rect.style.height).toBe("80%");
    expect(rect.className).not.toContain("-translate-x-1/2");
    expect(rect.className).not.toContain("-translate-y-1/2");

    // circle sizing: diameter = radius*200% of container width, aspect-ratio
    // keeps it round — must never collapse to 0px.
    const circle = container.querySelector<HTMLElement>('[data-edit-outline="c1"]')!;
    expect(circle.style.left).toBe("30%");
    expect(circle.style.top).toBe("30%");
    expect(circle.style.width).toBe("20%");
    expect(circle.style.aspectRatio).toBe("1 / 1");

    // polygon: SVG outline + bbox move grip only
    expect(container.querySelector('[data-edit-polygon="hs11"]')).not.toBeNull();
    expect(container.querySelector('[data-move-area="hs11"]')).not.toBeNull();
    expect(container.querySelector('[data-resize-handle="hs11"]')).toBeNull();
    expect(container.querySelector('[data-radius-handle="hs11"]')).toBeNull();

    // labels: shape.label when present, id otherwise
    expect(container.querySelector('[data-edit-outline="h1"]')?.textContent).toContain("Vùng trái");
    expect(container.querySelector('[data-edit-outline="hs11"]')?.textContent).toContain("hs11");
  });

  it("suppresses the play click while geometry editing is active", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          <HotspotSinglePlayer
            title="Bấm vào vùng đúng"
          imageUrl="/img.png"
            hotspots={[{ id: "c1", x: 0.3, y: 0.3, radius: 0.1 }]}
            correctId="c1"
            onAnswerChange={onAnswerChange}
          />
        </FieldResizeContext.Provider>,
      );
    });

    const target = playContainer();
    stubRect(target);
    clickAt(target, 30, 30);
    expect(onAnswerChange).not.toHaveBeenCalled();
  });
});
