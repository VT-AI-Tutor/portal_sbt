import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpotDifferencePlayer } from "./SpotDifferencePlayer";
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

function stubRect(el: HTMLElement, width = 100, height = 100) {
  el.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }) as DOMRect;
}

function clickAt(el: HTMLElement, clientX: number, clientY: number) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX, clientY }));
  });
}

const DIFFS = [
  { id: "d1", x: 0.3, y: 0.3, radius: 0.06 },
  { id: "d2", x: 0.7, y: 0.6 },
];

const imageBContainer = () =>
  container.querySelector<HTMLElement>('img[alt="Hình B"]')!.parentElement!;

describe("SpotDifferencePlayer edit overlay", () => {
  it("renders no overlay without a provider and click-to-find still works", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <SpotDifferencePlayer
          title="Tìm điểm khác biệt"
          imageA="/a.png"
          imageB="/b.png"
          differences={DIFFS}
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    expect(container.querySelector("[data-hotspot-edit-overlay]")).toBeNull();
    expect(container.querySelector("[data-move-area]")).toBeNull();
    expect(container.querySelector("[data-edit-outline]")).toBeNull();

    const target = imageBContainer();
    stubRect(target);
    clickAt(target, 30, 30);
    expect(onAnswerChange).toHaveBeenCalledWith(["d1"]);
  });

  it("renders no overlay with an onResize-only controller and still finds differences", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn() }}>
          <SpotDifferencePlayer
            title="Tìm điểm khác biệt"
          imageA="/a.png"
            imageB="/b.png"
            differences={DIFFS}
            onAnswerChange={onAnswerChange}
          />
        </FieldResizeContext.Provider>,
      );
    });

    expect(container.querySelector("[data-hotspot-edit-overlay]")).toBeNull();

    const target = imageBContainer();
    stubRect(target);
    clickAt(target, 30, 30);
    expect(onAnswerChange).toHaveBeenCalledWith(["d1"]);
  });

  it("renders one draggable circle outline per difference, anchored to image B only", () => {
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          <SpotDifferencePlayer title="Tìm điểm khác biệt" imageA="/a.png" imageB="/b.png" differences={DIFFS} />
        </FieldResizeContext.Provider>,
      );
    });

    // Exactly one overlay, and it lives inside image B's container.
    const overlays = container.querySelectorAll("[data-hotspot-edit-overlay]");
    expect(overlays.length).toBe(1);
    expect(imageBContainer().contains(overlays[0]!)).toBe(true);
    const imageAContainer = container.querySelector<HTMLElement>('img[alt="Hình A"]')!.parentElement!;
    expect(imageAContainer.querySelector("[data-hotspot-edit-overlay]")).toBeNull();

    // circles: move + radius grip each, no rect resize handles
    expect(container.querySelectorAll("[data-edit-outline]").length).toBe(2);
    for (const id of ["d1", "d2"]) {
      expect(container.querySelector<HTMLElement>(`[data-edit-outline="${id}"]`)?.dataset.editShape).toBe("circle");
      expect(container.querySelector(`[data-move-area="${id}"]`)).not.toBeNull();
      expect(container.querySelector(`[data-radius-handle="${id}"]`)).not.toBeNull();
      expect(container.querySelector(`[data-resize-handle="${id}"]`)).toBeNull();
    }

    // circle sizing must never collapse to 0px: diameter = radius*200% of the
    // container width (d1 explicit 0.06; d2 falls back to the 0.06 default),
    // aspect-ratio keeps it round.
    const d1 = container.querySelector<HTMLElement>('[data-edit-outline="d1"]')!;
    expect(d1.style.width).toBe("12%");
    expect(d1.style.aspectRatio).toBe("1 / 1");
    const d2 = container.querySelector<HTMLElement>('[data-edit-outline="d2"]')!;
    expect(d2.style.width).toBe("12%");
    expect(d2.style.aspectRatio).toBe("1 / 1");
  });

  it("suppresses the play click while geometry editing is active", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          <SpotDifferencePlayer
            title="Tìm điểm khác biệt"
          imageA="/a.png"
            imageB="/b.png"
            differences={DIFFS}
            onAnswerChange={onAnswerChange}
          />
        </FieldResizeContext.Provider>,
      );
    });

    const target = imageBContainer();
    stubRect(target);
    clickAt(target, 30, 30);
    expect(onAnswerChange).not.toHaveBeenCalled();
  });
});
