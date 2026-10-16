import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectLinesPlayer } from "./ConnectLinesPlayer";
import { TwoColumnMatchPlayer } from "./TwoColumnMatchPlayer";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.tagName !== "BUTTON") {
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 400,
        bottom: 100,
        width: 400,
        height: 100,
        toJSON: () => ({}),
      } as DOMRect;
    }
    const text = this.textContent ?? "";
    const left = text.includes("nho nhỏ.") || text.includes("có cỏ.") ? 300 : 0;
    const top = text.includes("Nghé và bê") || text.includes("có cỏ.") ? 50 : 0;
    const width = text.includes("Nối từ") ? 400 : 100;
    const height = text.includes("Nối từ") ? 100 : 40;
    return {
      x: left,
      y: top,
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const leftItems = [
  { id: "left-1", text: "Mẹ" },
  { id: "left-2", text: "Nghé và bê" },
];
const rightItems = [
  { id: "right-1", text: "nho nhỏ." },
  { id: "right-2", text: "có cỏ." },
];
const correctPairs = { "left-1": "right-1", "left-2": "right-2" };

function buttonWithText(text: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.includes(text),
  );
}

function renderAndConnect(
  player: "columns" | "lines",
) {
  renderPlayer(player);

  act(() => buttonWithText("Mẹ")?.click());
  act(() => buttonWithText("nho nhỏ.")?.click());
}

function renderPlayer(player: "columns" | "lines") {
  act(() => {
    root.render(
      player === "columns" ? (
        <TwoColumnMatchPlayer
          title="Nối từ"
          leftItems={leftItems}
          rightItems={rightItems}
          correctPairs={correctPairs}
        />
      ) : (
        <ConnectLinesPlayer
          title="Nối từ"
          leftItems={leftItems}
          rightItems={rightItems}
          correctPairs={correctPairs}
        />
      ),
    );
  });
}

function selectLeftAndMoveCursor() {
  act(() => buttonWithText("Mẹ")?.click());
  const canvas = container.querySelector<HTMLElement>('[data-matching-canvas="true"]');
  const event = new Event("pointermove", { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: 220 },
    clientY: { value: 30 },
  });
  act(() => canvas?.dispatchEvent(event));
}

describe("matching connection line animation", () => {
  it.each(["columns", "lines"] as const)(
    "draws a dashed connection from left to right for the %s renderer",
    (player) => {
      renderAndConnect(player);

      const guide = container.querySelector<SVGLineElement>('svg line[data-line-role="guide"]');
      const fill = container.querySelector<SVGLineElement>('svg line[data-line-role="fill"]');
      expect(guide).not.toBeNull();
      expect(fill).not.toBeNull();
      expect(guide?.getAttribute("x1")).toBe("100");
      expect(guide?.getAttribute("x2")).toBe("300");
      expect(guide?.getAttribute("stroke-dasharray")).toBe("8 8");
      expect(guide?.getAttribute("pathLength")).toBeNull();
    },
  );

  it.each(["columns", "lines"] as const)(
    "draws a dashed preview from the selected item to the cursor for the %s renderer",
    (player) => {
      renderPlayer(player);
      selectLeftAndMoveCursor();

      const preview = container.querySelector<SVGLineElement>(
        'svg line[data-line-role="cursor-preview"]',
      );
      expect(preview).not.toBeNull();
      expect(preview?.getAttribute("x1")).toBe("100");
      expect(preview?.getAttribute("y1")).toBe("20");
      expect(preview?.getAttribute("x2")).toBe("220");
      expect(preview?.getAttribute("y2")).toBe("30");
      expect(preview?.getAttribute("stroke-dasharray")).toBe("8 8");
      expect(preview?.getAttribute("pathLength")).toBeNull();

      act(() => buttonWithText("nho nhỏ.")?.click());
      expect(container.querySelector('line[data-line-role="cursor-preview"]')).toBeNull();
    },
  );

  it.each(["columns", "lines"] as const)(
    "progressively reveals the fill for the %s renderer",
    async (player) => {
      renderAndConnect(player);

      const fill = container.querySelector<SVGLineElement>('svg line[data-line-role="fill"]');
      const initialDash = fill?.getAttribute("stroke-dasharray");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
      const middleDash = fill?.getAttribute("stroke-dasharray");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 450));
      });
      const finalDash = fill?.getAttribute("stroke-dasharray");

      expect(initialDash).toBe("0 1");
      expect(middleDash).not.toBe(initialDash);
      expect(finalDash).toBe("1 1");
    },
  );
});
