import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagramFillPlayer, type DiagramFillPlayerProps } from "./DiagramFillPlayer";

vi.mock("../tasks/AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

// The measured-fallback branch observes its container; jsdom has no
// ResizeObserver, so stub it before rendering that shape.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof NoopResizeObserver }).ResizeObserver ??=
  NoopResizeObserver;

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
  vi.restoreAllMocks();
});

function render(element: ReactElement) {
  act(() => root.render(element));
}

const edges: DiagramFillPlayerProps["edges"] = [{ from: "n_la", to: "n_blank" }];

/** Coordinate mode: every node carries x/y (issue #677 repro shape, e.g. b17_q1). */
const coordinateNodes: DiagramFillPlayerProps["nodes"] = [
  { id: "n_la", label: "Lá", x: 0.25, y: 0.3 },
  { id: "n_blank", x: 0.7, y: 0.65, acceptedAnswers: ["Thân"] },
];

/** Flow mode: no coordinates, so the player falls back to measured anchors. */
const flowNodes: DiagramFillPlayerProps["nodes"] = [
  { id: "n_la", label: "Lá" },
  { id: "n_blank", acceptedAnswers: ["Thân"] },
];

function lines() {
  return Array.from(container.querySelectorAll("line"));
}

describe("diagram_fill leader lines (#677)", () => {
  it("draws coordinate-mode edges as arrowless neutral hairlines", () => {
    render(<DiagramFillPlayer title="Sơ đồ cây cà chua" nodes={coordinateNodes} edges={edges} />);

    const [line] = lines();
    expect(line).toBeTruthy();
    expect(line.getAttribute("marker-end")).toBeNull();
    expect(line.getAttribute("stroke")).toBe("currentColor");
    expect(line.getAttribute("stroke-width")).toBe("1.5");
    // Pins the width against the stretched 0-100 viewBox on wide backgrounds.
    expect(line.getAttribute("vector-effect")).toBe("non-scaling-stroke");
  });

  it("never defines an arrowhead marker", () => {
    render(<DiagramFillPlayer title="Sơ đồ cây cà chua" nodes={coordinateNodes} edges={edges} />);

    expect(container.querySelector("marker")).toBeNull();
    expect(container.innerHTML).not.toContain("diagram-fill-arrow");
  });

  it("uses the same stroke width in the measured-fallback branch", () => {
    render(<DiagramFillPlayer title="Sơ đồ cây cà chua" nodes={flowNodes} edges={edges} />);

    const fallback = lines();
    expect(fallback.length).toBe(1);
    for (const line of fallback) {
      expect(line.getAttribute("marker-end")).toBeNull();
      expect(line.getAttribute("stroke")).toBe("currentColor");
      expect(line.getAttribute("stroke-width")).toBe("1.5");
      expect(line.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    }
  });

  // Connectors take their colour from the <svg>'s text colour via
  // stroke="currentColor", using the same split the nodes use: pinned light on
  // an always-light book scan, theme-reactive when there is no scan.
  it("pins the colour on a background scan but follows the theme without one", () => {
    render(
      <DiagramFillPlayer
        title="Sơ đồ cây cà chua"
        nodes={coordinateNodes}
        edges={edges}
        backgroundImage="/uploads/bai17_q1.png"
      />,
    );
    const onScan = container.querySelector("svg.pointer-events-none");
    expect(onScan?.getAttribute("class")).toContain("text-slate-400");
    expect(onScan?.getAttribute("class")).not.toContain("text-slate-500");

    render(<DiagramFillPlayer title="Sơ đồ cây cà chua" nodes={coordinateNodes} edges={edges} />);
    const noScan = container.querySelector("svg.pointer-events-none");
    expect(noScan?.getAttribute("class")).toContain("text-slate-500");
    expect(noScan?.getAttribute("class")).not.toContain("text-slate-400");
  });

  // Regression: the entrance animation must not be motion's `pathLength`.
  // motion implements pathLength by writing pathLength="1" +
  // stroke-dasharray="1 1"; combined with vector-effect="non-scaling-stroke"
  // the browser resolves that dash pattern in device space, shattering the
  // connector into visible dashes instead of drawing one solid hairline.
  it("never writes a dash pattern onto the connectors", () => {
    for (const nodes of [coordinateNodes, flowNodes]) {
      render(<DiagramFillPlayer title="Sơ đồ cây cà chua" nodes={nodes} edges={edges} />);

      const rendered = lines();
      expect(rendered.length).toBe(1);
      for (const line of rendered) {
        expect(line.getAttribute("stroke-dasharray")).toBeNull();
        expect(line.getAttribute("stroke-dashoffset")).toBeNull();
        expect(line.getAttribute("pathLength")).toBeNull();
        expect(line.style.strokeDasharray).toBe("");
      }
    }
  });
});
