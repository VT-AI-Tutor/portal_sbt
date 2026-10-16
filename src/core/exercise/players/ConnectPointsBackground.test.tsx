import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

// connect_points may render its points over a book scan (spec §5.15). The point
// x/y are fractions OF THAT IMAGE, so the canvas must take the image's own
// aspect ratio — a wrong box silently misplaces every point.

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

const PAYLOAD = {
  points: [
    { id: "tau5020", label: "50 + 20", x: 0.19, y: 0.3 },
    { id: "ben70", label: "70", x: 0.84, y: 0.35 },
  ],
  correctAnswer: [{ from: "tau5020", to: "ben70" }],
};

function render(payload: Record<string, unknown>) {
  act(() => {
    root.render(renderInteractionPlayer("connect_points", payload as never, {} as never));
  });
}

/** Fire a load event carrying natural dimensions, as a real decoded image would. */
function loadImage(img: HTMLImageElement, naturalWidth: number, naturalHeight: number) {
  Object.defineProperty(img, "naturalWidth", { value: naturalWidth, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: naturalHeight, configurable: true });
  act(() => {
    img.dispatchEvent(new Event("load", { bubbles: false }));
  });
}

describe("connect_points background image", () => {
  it("renders the authored backgroundImage behind the points", () => {
    render({ ...PAYLOAD, backgroundImage: "https://cdn.example.com/grid.png" });

    const canvas = container.querySelector<HTMLElement>("[data-connect-points-background]");
    expect(canvas?.dataset.connectPointsBackground).toBe("image");
    const img = canvas?.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example.com/grid.png");
    // Points still render on top and stay clickable.
    expect(container.querySelectorAll("button").length).toBe(2);
  });

  it("adopts the image's natural aspect ratio once it loads", () => {
    render({ ...PAYLOAD, backgroundImage: "https://cdn.example.com/grid.png" });
    const canvas = container.querySelector<HTMLElement>("[data-connect-points-background]")!;

    // Before load: the default 5:3 box, no aspect-ratio claim about the image.
    expect(canvas.style.paddingBottom).toBe("60%");
    expect(canvas.style.aspectRatio).toBe("");

    loadImage(canvas.querySelector("img")!, 1200, 800);

    expect(canvas.style.aspectRatio).toBe("1.5 / 1"); // jsdom serializes the ratio

    expect(canvas.style.paddingBottom).toBe("");
  });

  it("falls back to the plain canvas when the image fails to load", () => {
    render({ ...PAYLOAD, backgroundImage: "https://cdn.example.com/missing.png" });
    const canvas = container.querySelector<HTMLElement>("[data-connect-points-background]")!;

    act(() => {
      canvas.querySelector("img")!.dispatchEvent(new Event("error", { bubbles: false }));
    });

    expect(canvas.dataset.connectPointsBackground).toBe("fallback");
    expect(canvas.querySelector("img")).toBeNull();
    expect(canvas.style.paddingBottom).toBe("60%");
    // The interaction survives a dead url — points are still there to connect.
    expect(container.querySelectorAll("button").length).toBe(2);
  });

  it("renders the bare canvas when no background is authored", () => {
    render(PAYLOAD);
    const canvas = container.querySelector<HTMLElement>("[data-connect-points-background]")!;
    expect(canvas.dataset.connectPointsBackground).toBe("none");
    expect(canvas.querySelector("img")).toBeNull();
  });
});

// ── Nét nối mẫu qua đường dispatch ──────────────────────────────────────────
// Trình soạn và player đã có test riêng; chỗ dễ đứt mà cả hai không phủ là
// KHÂU NỐI: `example` phải đi từ payload thô qua dispatch tới đúng prop của task.
describe("connect_points — `example` đi qua dispatch", () => {
  const withExample = {
    ...PAYLOAD,
    correctAnswer: [
      { from: "tau5020", to: "ben70" },
      { from: "tau3010", to: "ben40" },
    ],
    points: [
      ...PAYLOAD.points,
      { id: "tau3010", label: "30 + 10", x: 0.19, y: 0.7 },
      { id: "ben40", label: "40", x: 0.84, y: 0.75 },
    ],
    example: { from: "tau5020", to: "ben70", locked: true },
  };

  function drawnEdges(): string[] {
    return Array.from(
      container.querySelectorAll<SVGLineElement>('[data-line-role="fill"]'),
    ).map((line) => line.getAttribute("data-connect-edge") ?? "");
  }

  it("vẽ sẵn nét mẫu từ payload thô, không cần bài làm đã lưu", () => {
    render(withExample);
    expect(drawnEdges()).toEqual(["tau5020->ben70"]);
    expect(container.querySelector('[data-connect-edge-example="true"]')).not.toBeNull();
  });

  it("payload không có `example` thì không vẽ sẵn nét nào", () => {
    render(PAYLOAD);
    expect(drawnEdges()).toEqual([]);
  });
});
