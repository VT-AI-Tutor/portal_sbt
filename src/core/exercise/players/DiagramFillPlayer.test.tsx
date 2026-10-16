import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { DiagramFillPlayer } from "./DiagramFillPlayer";
import { FieldResizeContext, FieldSelectionContext } from "@/core/exercise/field-resize-context";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

describe("DiagramFillPlayer alternative answer sets", () => {
  it("accepts a complete alternative map without accepting mixed combinations", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <DiagramFillPlayer
          title="Điền số"
          instantFeedback={false}
          onStatusChange={onStatusChange}
          nodes={[
            { id: "top", fillable: true, acceptedAnswers: ["4"] },
            { id: "left", fillable: true, acceptedAnswers: ["3"] },
            { id: "mid", fillable: true, acceptedAnswers: ["5"] },
            { id: "right", fillable: true, acceptedAnswers: ["15"] },
            { id: "bottom", fillable: true, acceptedAnswers: ["20"] },
          ]}
          edges={[]}
          acceptedAnswerSets={[{ top: "3", left: "4", mid: "5", right: "20", bottom: "15" }]}
        />,
      );
    });

    const fill = (id: string, value: string) => fillInput(container.querySelector<HTMLInputElement>(`[data-diagram-node="${id}"] input`)!, value);
    fill("top", "3");
    fill("left", "4");
    fill("mid", "5");
    fill("right", "20");
    fill("bottom", "15");
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Kiểm tra")?.click());

    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function fillInput(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("DiagramFillPlayer geometry", () => {
  it("renders the background and scales coordinate nodes with the responsive canvas", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          backgroundImage: "/uploads/diagram.png",
          nodes: [
            { id: "cause", x: 0.2, y: 0.3, fillable: true },
            // Percent coordinates are a supported legacy form alongside normalized values.
            { id: "result", x: 70, y: 70, fillable: false, label: "Kết quả" },
          ],
          edges: [{ from: "cause", to: "result" }],
          correctAnswer: { cause: "Nguyên nhân" },
        }, {}),
      );
    });

    const canvas = container.querySelector<HTMLElement>('[data-diagram-layout="coordinates"]');
    const nodes = Array.from(canvas?.querySelectorAll<HTMLElement>("[data-diagram-node]") ?? []);
    const image = canvas?.querySelector<HTMLImageElement>("img");
    const line = canvas?.querySelector<SVGLineElement>("svg line");

    expect(canvas?.dataset.diagramBackground).toBe("image");
    expect(canvas?.style.aspectRatio).toContain("1.3333333333333333");
    expect(canvas?.className).toContain("overflow-visible");
    expect(image?.src).toContain("diagram.png");
    expect(nodes[0]?.dataset.coordinateX).toBe("20");
    expect(nodes[0]?.dataset.coordinateY).toBe("30");
    expect(nodes[0]?.style.left).toBe("20%");
    expect(nodes[0]?.style.top).toBe("30%");
    expect(nodes[0]?.style.left).not.toContain("clamp(");
    expect(nodes[0]?.style.width).toBe("20%");
    expect(nodes[0]?.style.maxWidth).toBe("9rem");
    expect(nodes[0]?.className).not.toContain("min-w-[");
    expect(nodes[1]?.dataset.coordinateX).toBe("70");
    expect(line?.getAttribute("x1")).toBe("20");
    expect(line?.getAttribute("y1")).toBe("30");
    expect(line?.getAttribute("x2")).toBe("70");

    Object.defineProperties(image!, {
      naturalWidth: { configurable: true, value: 1600 },
      naturalHeight: { configurable: true, value: 900 },
    });
    act(() => image?.dispatchEvent(new Event("load")));
    expect(canvas?.style.aspectRatio).toContain("1.7777777777777777");
  });

  it("renders positioned fillable nodes bare (no chip border/fill) so the scan's own box shows through", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          backgroundImage: "/uploads/diagram.png",
          nodes: [
            { id: "cause", x: 0.2, y: 0.3, fillable: true },
            { id: "result", x: 0.7, y: 0.7, fillable: false, label: "Kết quả" },
          ],
          edges: [],
          correctAnswer: { cause: "Nguyên nhân" },
        }, {}),
      );
    });

    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-diagram-node]"));
    expect(nodes[0]?.className).not.toContain("border");
    expect(nodes[0]?.className).not.toContain("bg-white");
    expect(nodes[0]?.className).not.toContain("shadow");
    // Ink is pinned light-theme — it sits on the (always light) scan, so a
    // theme-reactive text colour would go white in dark mode.
    expect(nodes[0]?.className).toContain("text-slate-900");
    expect(nodes[0]?.className).not.toContain("text-slate-800");
    expect(nodes[0]?.querySelector("input")?.className).toContain("placeholder:text-slate-400");
    // Static label chips keep their styling.
    expect(nodes[1]?.className).toContain("border");
  });

  it("keeps edge coordinates exact instead of clamping them into the canvas", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          nodes: [
            { id: "top-left", x: 0, y: 0, fillable: false, label: "Đầu" },
            { id: "bottom-right", x: 1, y: 1, fillable: false, label: "Cuối" },
          ],
          edges: [{ from: "top-left", to: "bottom-right" }],
        }, {}),
      );
    });

    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-diagram-node]"));
    const line = container.querySelector<SVGLineElement>("svg line");
    expect(nodes[0]?.style.left).toBe("0%");
    expect(nodes[0]?.style.top).toBe("0%");
    expect(nodes[1]?.style.left).toBe("100%");
    expect(nodes[1]?.style.top).toBe("100%");
    expect(line?.getAttribute("x1")).toBe("0");
    expect(line?.getAttribute("y1")).toBe("0");
    expect(line?.getAttribute("x2")).toBe("100");
    expect(line?.getAttribute("y2")).toBe("100");
  });

  it("falls back to the blank coordinate canvas when the background cannot load", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          backgroundImage: "/uploads/missing-diagram.png",
          nodes: [{ id: "node", x: 0.5, y: 0.5, fillable: true }],
          edges: [],
        }, {}),
      );
    });

    const canvas = container.querySelector<HTMLElement>('[data-diagram-layout="coordinates"]')!;
    const image = canvas.querySelector<HTMLImageElement>("img")!;
    act(() => image.dispatchEvent(new Event("error", { bubbles: false })));

    expect(canvas.dataset.diagramBackground).toBe("fallback");
    expect(canvas.querySelector("img")).toBeNull();
    expect(canvas.querySelector("input")).not.toBeNull();
  });

  it("keeps the legacy flow layout when coordinate data is absent and preserves grading", () => {
    const onAnswerChange = vi.fn();
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "diagram_fill",
          {
            backgroundImage: "/uploads/legacy-diagram.png",
            nodes: [{ id: "node", fillable: true }],
            edges: [],
            correctAnswer: { node: "Đáp án" },
          },
          { onAnswerChange, onStatusChange, instantFeedback: false },
        ),
      );
    });

    const canvas = container.querySelector<HTMLElement>('[data-diagram-layout="flow"]');
    const input = canvas?.querySelector<HTMLInputElement>("input");
    expect(canvas).not.toBeNull();
    expect(canvas?.dataset.diagramBackground).toBe("image");
    expect(canvas?.querySelector("img")?.className).toContain("object-contain");
    expect(input).not.toBeNull();
    expect(input?.className).toContain("min-w-0");

    fillInput(input!, "Đáp án");
    expect(onAnswerChange).toHaveBeenLastCalledWith({ node: "Đáp án" });
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });
});

describe("DiagramFillPlayer self-check feedback", () => {
  const nodes = [{ id: "node", fillable: true, acceptedAnswers: ["Đáp án"] }];

  it("button mode: a wrong Kiểm tra turns the wrong input red + shows the feedback line, and editing clears it", () => {
    const onStatusChange = vi.fn();
    act(() =>
      root.render(
        <DiagramFillPlayer
          title="Q"
          nodes={nodes}
          edges={[]}
          instantFeedback={false}
          onStatusChange={onStatusChange}
        />,
      ),
    );
    const input = container.querySelector<HTMLInputElement>("input")!;
    fillInput(input, "Sai");
    act(() =>
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "Kiểm tra")
        ?.click(),
    );

    expect(onStatusChange).toHaveBeenLastCalledWith("error");
    expect(input.closest<HTMLElement>("[data-diagram-node]")?.className).toContain("red");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");

    fillInput(input, "Sửa lại"); // editing clears the error for the retry
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    expect(input.closest<HTMLElement>("[data-diagram-node]")?.className).not.toContain("red");
  });

  it("recordOnly (selfAssessment): no Kiểm tra button in button mode", () => {
    act(() =>
      root.render(
        <DiagramFillPlayer title="Q" nodes={nodes} edges={[]} selfAssessment instantFeedback={false} />,
      ),
    );
    expect(container.textContent).not.toContain("Kiểm tra");
  });
});

describe("DiagramFillPlayer node width", () => {
  it("honors a JSON node width fraction and drops the default maxWidth clamp", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          nodes: [{ id: "sized", x: 0.5, y: 0.5, width: 0.12, fillable: true }],
          edges: [],
        }, {}),
      );
    });

    const node = container.querySelector<HTMLElement>("[data-diagram-node]");
    expect(node?.style.width).toBe("12%");
    expect(node?.style.maxWidth).toBe("");
  });

  it("uses the smaller default width when the node has no width", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          nodes: [{ id: "plain", x: 0.5, y: 0.5, fillable: true }],
          edges: [],
        }, {}),
      );
    });

    const node = container.querySelector<HTMLElement>("[data-diagram-node]");
    expect(node?.style.width).toBe("20%");
    expect(node?.style.maxWidth).toBe("9rem");
  });

  it("falls back to the default when the node width is invalid", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          nodes: [
            { id: "too-big", x: 0.3, y: 0.5, width: 5, fillable: true },
            { id: "not-a-number", x: 0.7, y: 0.5, width: Number.NaN, fillable: true },
          ],
          edges: [],
        }, {}),
      );
    });

    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-diagram-node]"));
    for (const node of nodes) {
      expect(node?.style.width).toBe("20%");
      expect(node?.style.maxWidth).toBe("9rem");
    }
  });
});

describe("DiagramFillPlayer node height", () => {
  it("applies a JSON node height fraction as a percent of the canvas and fills the box", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          nodes: [{ id: "sized", x: 0.5, y: 0.5, width: 0.09, height: 0.12, fillable: true }],
          edges: [],
        }, {}),
      );
    });

    const node = container.querySelector<HTMLElement>("[data-diagram-node]");
    expect(node?.style.height).toBe("12%");
    // parseFloat sidesteps float artifacts (0.09 * 100 → 9.000000000000002).
    expect(parseFloat(node!.style.width)).toBeCloseTo(9);
    // Inner content fills the fixed box and is vertically centered.
    expect(node?.className).toContain("flex flex-col justify-center");
    expect(node?.querySelector("input")?.className).toContain("h-full");
  });

  it("keeps the content-driven height when the node has no height", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          nodes: [{ id: "plain", x: 0.5, y: 0.5, fillable: true }],
          edges: [],
        }, {}),
      );
    });

    const node = container.querySelector<HTMLElement>("[data-diagram-node]");
    expect(node?.style.height).toBe("");
    expect(node?.className).not.toContain("flex flex-col justify-center");
    expect(node?.querySelector("input")?.className).not.toContain("h-full");
  });

  it("drops invalid heights and falls back to the content-driven height", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          nodes: [
            { id: "too-big", x: 0.2, y: 0.5, height: 5, fillable: true },
            { id: "not-a-number", x: 0.5, y: 0.5, height: Number.NaN, fillable: true },
            { id: "zero", x: 0.8, y: 0.5, height: 0, fillable: true },
          ],
          edges: [],
        }, {}),
      );
    });

    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-diagram-node]"));
    expect(nodes).toHaveLength(3);
    for (const node of nodes) {
      expect(node?.style.height).toBe("");
    }
  });

  it("clamps tiny heights up to the 2% minimum", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          nodes: [{ id: "tiny", x: 0.5, y: 0.5, height: 0.01, fillable: true }],
          edges: [],
        }, {}),
      );
    });

    expect(container.querySelector<HTMLElement>("[data-diagram-node]")?.style.height).toBe("2%");
  });

  it("applies width and height to a static (fillable: false) label node", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          nodes: [
            { id: "static", x: 0.5, y: 0.5, width: 0.12, height: 0.1, fillable: false, label: "Thân cây" },
          ],
          edges: [],
        }, {}),
      );
    });

    const node = container.querySelector<HTMLElement>("[data-diagram-node]");
    // Static label nodes share the sizing path with fillable ones.
    expect(node?.style.width).toBe("12%");
    expect(node?.style.height).toBe("10%");
    expect(node?.querySelector("input")).toBeNull();
    expect(node?.textContent).toContain("Thân cây");
  });
});

describe("DiagramFillPlayer fillable derivation", () => {
  it("renders inputs for correctAnswer-keyed nodes without a fillable flag (b33_q13 shape)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer("diagram_fill", {
          backgroundImage: "/uploads/books/6a6047d0b7bf0d70c1bd79b9/assets/bai13_t4q1_trucks.png",
          nodes: [
            { id: "xe1", x: 0.232, y: 0.186, width: 0.09 },
            { id: "xe2", x: 0.799, y: 0.186, width: 0.09 },
            { id: "xe3", x: 0.232, y: 0.7, width: 0.09 },
            { id: "xe4", x: 0.799, y: 0.7, width: 0.09 },
          ],
          edges: [],
          correctAnswer: { xe1: "76", xe2: "42", xe3: "66", xe4: "53" },
        }, {}),
      );
    });

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("[data-diagram-node] input"));
    expect(inputs).toHaveLength(4);
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-diagram-node]"));
    // parseFloat sidesteps float artifacts in fraction → percent conversion.
    expect(parseFloat(nodes[0]!.style.width)).toBeCloseTo(9);
    expect(parseFloat(nodes[0]!.style.left)).toBeCloseTo(23.2);
  });

  it("still grades derived-fillable nodes against the correct answer", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "diagram_fill",
          {
            nodes: [{ id: "xe1", x: 0.232, y: 0.186, width: 0.09 }],
            edges: [],
            correctAnswer: { xe1: "76" },
          },
          { onStatusChange, instantFeedback: false },
        ),
      );
    });

    const input = container.querySelector<HTMLInputElement>("[data-diagram-node] input");
    expect(input).not.toBeNull();
    fillInput(input!, "76");
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });
});

describe("DiagramFillPlayer geometry affordances", () => {
  // Fillable input, static label chip, and a bare placeholder-shape node
  // (b21_q19 corpus: no fillable flag at all) — ALL positioned nodes get
  // geometry affordances in the edit preview.
  const GEOMETRY_NODES = [
    { id: "field", x: 0.3, y: 0.5, fillable: true },
    { id: "static", x: 0.7, y: 0.5, fillable: false, label: "Nhãn" },
    { id: "n77c", x: 0.32, y: 0.74, width: 0.06, placeholder: "…" },
  ];
  const NODE_IDS = ["field", "static", "n77c"];

  function renderNodes(controller: { onResize: (id: string, w: string | number) => void; onGeometry?: (id: string, patch: object) => void } | null) {
    const player = renderInteractionPlayer("diagram_fill", { nodes: GEOMETRY_NODES, edges: [] }, {});
    act(() => {
      root.render(
        controller ? (
          <FieldResizeContext.Provider value={controller}>{player}</FieldResizeContext.Provider>
        ) : (
          player
        ),
      );
    });
  }

  it("renders no geometry affordance without a FieldResizeContext provider", () => {
    renderNodes(null);
    expect(container.querySelector("[data-resize-handle]")).toBeNull();
    expect(container.querySelector("[data-move-area]")).toBeNull();
    expect(container.querySelector("input")?.className).not.toContain("pointer-events-none");
  });

  it("v1 controller (onResize only): resize handles on ALL coordinate nodes, no move areas", () => {
    renderNodes({ onResize: vi.fn() });
    for (const id of NODE_IDS) {
      expect(container.querySelector(`[data-resize-handle="${id}"]`), id).not.toBeNull();
    }
    expect(container.querySelector("[data-move-area]")).toBeNull();
    expect(container.querySelector("input")?.className).not.toContain("pointer-events-none");
  });

  it("v2 controller (onGeometry): move area + resize handle on ALL coordinate nodes", () => {
    renderNodes({ onResize: vi.fn(), onGeometry: vi.fn() });
    for (const id of NODE_IDS) {
      expect(container.querySelector(`[data-move-area="${id}"]`), id).not.toBeNull();
      expect(container.querySelector(`[data-resize-handle="${id}"]`), id).not.toBeNull();
    }
    // The (disabled-in-editor) input yields pointer events to the MoveArea.
    expect(container.querySelector("input")?.className).toContain("pointer-events-none");
  });

  it("v2 controller: every coordinate node is pullable from all FOUR edges", () => {
    renderNodes({ onResize: vi.fn(), onGeometry: vi.fn() });
    for (const id of NODE_IDS) {
      const handles = container.querySelectorAll(`[data-resize-handle="${id}"]`);
      expect(handles, id).toHaveLength(4);
      for (const side of ["left", "right", "top", "bottom"]) {
        expect(
          container.querySelector(`[data-resize-handle="${id}"][data-resize-side="${side}"]`),
          `${id} · ${side}`,
        ).not.toBeNull();
      }
    }
  });

  it("v1 controller: exactly ONE legacy right-edge handle per node, no per-side grips", () => {
    renderNodes({ onResize: vi.fn() });
    for (const id of NODE_IDS) {
      expect(container.querySelectorAll(`[data-resize-handle="${id}"]`), id).toHaveLength(1);
    }
    expect(container.querySelector("[data-resize-side]")).toBeNull();
  });

  it("dragging the RIGHT edge emits {width, x} keeping the left edge pinned", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const onGeometry = vi.fn();
    renderNodes({ onResize: vi.fn(), onGeometry });

    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    const canvas = container.querySelector<HTMLElement>('[data-diagram-layout="coordinates"]')!;
    const node = container.querySelector<HTMLElement>('[data-diagram-node="field"]')!;
    canvas.getBoundingClientRect = () => rect(0, 0, 400, 300);
    node.getBoundingClientRect = () => rect(90, 130, 20, 40); // center (100, 150)

    const handle = container.querySelector<HTMLElement>(
      '[data-resize-handle="field"][data-resize-side="right"]',
    )!;
    act(() => {
      handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 110, clientY: 150 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 150, clientY: 150 }));
    });
    // dx=+40 → width 20+40=60px = 0.15 of 400; center shifts +20px → x=120/400=0.3.
    expect(onGeometry).toHaveBeenLastCalledWith("field", { width: 0.15, x: 0.3 });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
  });

  it("dragging the TOP edge emits {height, y} keeping the bottom edge pinned", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const onGeometry = vi.fn();
    renderNodes({ onResize: vi.fn(), onGeometry });

    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    const canvas = container.querySelector<HTMLElement>('[data-diagram-layout="coordinates"]')!;
    const node = container.querySelector<HTMLElement>('[data-diagram-node="field"]')!;
    canvas.getBoundingClientRect = () => rect(0, 0, 400, 300);
    node.getBoundingClientRect = () => rect(90, 130, 20, 40); // center (100, 150)

    const handle = container.querySelector<HTMLElement>(
      '[data-resize-handle="field"][data-resize-side="top"]',
    )!;
    act(() => {
      handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 130 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 100, clientY: 100 }));
    });
    // dy=-30 (upward) → height 40+30=70px = 0.2333 of 300; center shifts -15px → y=135/300=0.45.
    expect(onGeometry).toHaveBeenLastCalledWith("field", { height: 0.2333, y: 0.45 });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
  });

  it("an inward LEFT-edge drag clamps at the minimum width, center compensating only the applied delta", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const onGeometry = vi.fn();
    renderNodes({ onResize: vi.fn(), onGeometry });

    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    const canvas = container.querySelector<HTMLElement>('[data-diagram-layout="coordinates"]')!;
    const node = container.querySelector<HTMLElement>('[data-diagram-node="field"]')!;
    canvas.getBoundingClientRect = () => rect(0, 0, 400, 300);
    node.getBoundingClientRect = () => rect(90, 130, 20, 40); // center (100, 150)

    const handle = container.querySelector<HTMLElement>(
      '[data-resize-handle="field"][data-resize-side="left"]',
    )!;
    act(() => {
      handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 90, clientY: 150 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 290, clientY: 150 }));
    });
    // dx=+200 inward on the LEFT side → raw width 20-200 = -180px, clamped to
    // min 0.03*400 = 12px; applied delta -8px → center x = 100 + 4 = 104 → 0.26.
    expect(onGeometry).toHaveBeenLastCalledWith("field", { width: 0.03, x: 0.26 });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
  });

  it("flow mode (no coordinates) renders no geometry affordances even with a v2 controller", () => {
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          {renderInteractionPlayer("diagram_fill", {
            nodes: [{ id: "flow-node", fillable: true }],
            edges: [],
          }, {})}
        </FieldResizeContext.Provider>,
      );
    });
    expect(container.querySelector('[data-diagram-layout="flow"]')).not.toBeNull();
    expect(container.querySelector("[data-move-area]")).toBeNull();
    expect(container.querySelector("[data-resize-handle]")).toBeNull();
  });

  it("dragging a node's move area emits clamped 0..1 fraction x/y through onGeometry", () => {
    // Run rAF-throttled drag frames synchronously.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const onGeometry = vi.fn();
    renderNodes({ onResize: vi.fn(), onGeometry });

    // jsdom has no layout: stub the container (canvas) and node rects.
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    const canvas = container.querySelector<HTMLElement>('[data-diagram-layout="coordinates"]')!;
    const node = container.querySelector<HTMLElement>('[data-diagram-node="field"]')!;
    canvas.getBoundingClientRect = () => rect(0, 0, 400, 300);
    node.getBoundingClientRect = () => rect(90, 130, 20, 40); // center (100, 150)

    const moveArea = container.querySelector<HTMLElement>('[data-move-area="field"]')!;
    act(() => {
      moveArea.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 150 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 200, clientY: 225 }));
    });
    // dx=+100, dy=+75 → node center (200, 225) of a 400×300 canvas.
    expect(onGeometry).toHaveBeenLastCalledWith("field", { x: 0.5, y: 0.75 });

    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 2000, clientY: -500 }));
    });
    // Way outside the canvas → clamped to the 0..1 range.
    expect(onGeometry).toHaveBeenLastCalledWith("field", { x: 1, y: 0 });

    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    const calls = onGeometry.mock.calls.length;
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 100, clientY: 150 }));
    });
    // Drag session ended on pointerup — further moves emit nothing.
    expect(onGeometry.mock.calls.length).toBe(calls);
  });
});

describe("DiagramFillPlayer node selection (editor only)", () => {
  const NODES = [
    { id: "field", x: 0.3, y: 0.5, fillable: true },
    { id: "static", x: 0.7, y: 0.5, label: "Nhãn" },
  ];

  function renderWithSelection(selection: {
    selectedFieldId: string | null;
    select: (id: string | null) => void;
    remove?: (id: string) => void;
  } | null) {
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          <FieldSelectionContext.Provider value={selection}>
            <DiagramFillPlayer title="Q" nodes={NODES} edges={[]} />
          </FieldSelectionContext.Provider>
        </FieldResizeContext.Provider>,
      );
    });
  }

  const node = (id: string) =>
    container.querySelector<HTMLElement>(`[data-diagram-node="${id}"]`)!;

  it("is inert without a selection provider", () => {
    renderWithSelection(null);
    expect(node("field").getAttribute("tabindex")).toBeNull();
    expect(node("field").dataset.selected).toBeUndefined();
  });

  it("clicking a node selects it; the selected node is marked", () => {
    const select = vi.fn();
    renderWithSelection({ selectedFieldId: "static", select });

    act(() => {
      node("field").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
    expect(select).toHaveBeenCalledWith("field");
    // Marked from the provided selection, not from the click.
    expect(node("static").dataset.selected).toBe("true");
    expect(node("field").dataset.selected).toBeUndefined();
  });

  it("Delete/Backspace on the node removes it; keys inside the input do not", () => {
    const remove = vi.fn();
    renderWithSelection({ selectedFieldId: "field", select: vi.fn(), remove });

    act(() => {
      node("field").dispatchEvent(
        new KeyboardEvent("keydown", { key: "Delete", bubbles: true }),
      );
    });
    expect(remove).toHaveBeenCalledWith("field");

    remove.mockClear();
    act(() => {
      node("field")
        .querySelector("input")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    });
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("DiagramFillPlayer accessible name", () => {
  it("ô nhập không nhãn đọc theo thứ tự, không lộ id: `Chỗ trống 1`", () => {
    act(() => {
      root.render(
        <DiagramFillPlayer
          title="Điền số"
          nodes={[{ id: "n_361", fillable: true, acceptedAnswers: ["300 + 60 + 1"] }]}
          edges={[]}
        />,
      );
    });

    expect(container.querySelector('input[aria-label="Chỗ trống 1"]')).toBeTruthy();
    expect(container.querySelector('input[aria-label="n_361"]')).toBeNull();
  });

  it("nhãn tác giả đặt vẫn là tên đọc được của ô", () => {
    act(() => {
      root.render(
        <DiagramFillPlayer
          title="Điền số"
          nodes={[{ id: "n_la", label: "Lá", fillable: true, acceptedAnswers: ["quang hợp"] }]}
          edges={[]}
        />,
      );
    });

    expect(container.querySelector('input[aria-label="Chỗ trống Lá"]')).toBeTruthy();
  });
});
