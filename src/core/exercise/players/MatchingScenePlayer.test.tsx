import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MatchingScenePlayer,
  type MatchingScenePlayerProps,
} from "./MatchingScenePlayer";
import { FieldResizeContext } from "@/core/exercise/field-resize-context";

vi.mock("../tasks/AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

const nodes: MatchingScenePlayerProps["nodes"] = [
  { id: "item-1", kind: "item", x: 12, y: 24, label: "Vật 1" },
  {
    id: "target-1",
    kind: "target",
    x: 82,
    y: 28,
    ariaLabel: "Đích một",
    content: {
      blocks: [
        { type: "image", url: "/uploads/target.png", alt: "Hình đích", width: "45%" },
        { type: "paragraph", text: "Đích 1" },
      ],
    },
  },
  { id: "target-2", kind: "target", x: 84, y: 76, text: "Đích 2" },
];

const correctEdges = [
  { item: "item-1", target: "target-1" },
  { item: "item-1", target: "target-2" },
];

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

function scene(
  props: Partial<MatchingScenePlayerProps> = {},
): ReactElement<MatchingScenePlayerProps> {
  return (
    <MatchingScenePlayer
      title="Nối theo cảnh"
      nodes={nodes}
      correctEdges={correctEdges}
      {...props}
    />
  );
}

function render(element: ReactElement) {
  act(() => root.render(element));
}

function nodeButton(label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button).not.toBeNull();
  return button!;
}

function clickNode(label: string) {
  act(() => nodeButton(label).click());
}

function edgeKeys() {
  return Array.from(container.querySelectorAll<SVGPathElement>("[data-edge-key]"))
    .map((path) => path.dataset.edgeKey)
    .sort();
}

describe("MatchingScenePlayer", () => {
  it("renders the 0–100 scene, background metadata, and rich nodes", () => {
    render(
      scene({
        background: { url: "/uploads/scene.png", alt: "Sân trường", ratio: "5:2" },
        aspect: "4 / 3",
        maxWidth: "720px",
      }),
    );

    const canvas = container.querySelector<HTMLElement>("[data-matching-scene]");
    expect(canvas?.style.aspectRatio).toBe("5 / 2");
    expect(canvas?.style.maxWidth).toBe("720px");
    expect(container.querySelector("[data-scene-background]")?.getAttribute("alt")).toBe(
      "Sân trường",
    );
    expect(container.querySelector<HTMLElement>('[data-scene-node="item-1"]')?.style.left).toBe(
      "12%",
    );
    expect(container.querySelector<HTMLElement>('[data-scene-node="target-2"]')?.style.top).toBe(
      "76%",
    );
    expect(nodeButton("Đích một").getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector('[data-scene-node="target-1"] img')?.getAttribute("alt")).toBe(
      "Hình đích",
    );
  });

  it("hydrates, deduplicates, and rehydrates canonical edge arrays", () => {
    render(
      scene({
        answer: [
          { item: "item-1", target: "target-1" },
          { item: "item-1", target: "target-1" },
          { item: "missing", target: "target-2" },
          { item: "item-1" },
        ],
      }),
    );
    expect(edgeKeys()).toEqual(["item-1->target-1"]);

    render(scene({ answer: [{ item: "item-1", target: "target-2" }] }));
    expect(edgeKeys()).toEqual(["item-1->target-2"]);
    expect(nodeButton("Vật 1").getAttribute("aria-pressed")).toBe("false");
  });

  it("emits non-lossy one-to-many edges and toggles only the selected edge", () => {
    const onAnswerChange = vi.fn();
    render(
      scene({
        answer: [{ item: "item-1", target: "target-1" }],
        onAnswerChange,
      }),
    );

    clickNode("Vật 1");
    clickNode("Đích 2");
    expect(onAnswerChange).toHaveBeenLastCalledWith(correctEdges);
    expect(edgeKeys()).toEqual(["item-1->target-1", "item-1->target-2"]);

    clickNode("Đích 2");
    clickNode("Vật 1");
    expect(onAnswerChange).toHaveBeenLastCalledWith([
      { item: "item-1", target: "target-1" },
    ]);
    expect(edgeKeys()).toEqual(["item-1->target-1"]);
  });

  it("keeps the example edge locked and includes it in later answers", () => {
    const onAnswerChange = vi.fn();
    render(
      scene({
        answer: [],
        lockedExampleEdge: { item: "item-1", target: "target-1" },
        onAnswerChange,
      }),
    );

    expect(edgeKeys()).toEqual(["item-1->target-1"]);
    expect(
      container.querySelector('[data-edge-key="item-1->target-1"]')?.getAttribute(
        "data-edge-locked",
      ),
    ).toBe("true");

    clickNode("Vật 1");
    clickNode("Đích một");
    expect(onAnswerChange).not.toHaveBeenCalled();
    expect(edgeKeys()).toEqual(["item-1->target-1"]);

    clickNode("Vật 1");
    clickNode("Đích 2");
    expect(onAnswerChange).toHaveBeenLastCalledWith(correctEdges);
  });

  it.each([
    ["disabled", { disabled: true }],
    ["submitted", { submitted: true }],
  ] as const)("locks every scene control when %s", (_label, lockedProps) => {
    const onAnswerChange = vi.fn();
    render(scene({ ...lockedProps, onAnswerChange }));

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    expect(buttons).toHaveLength(nodes.length);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(container.textContent).not.toContain("Kiểm tra");
    const callsAfterRender = onAnswerChange.mock.calls.length;
    act(() => buttons[0]?.click());
    expect(onAnswerChange).toHaveBeenCalledTimes(callsAfterRender);
  });

  it("grades exact edge sets and exposes per-edge evaluation", () => {
    const onStatusChange = vi.fn();
    render(scene({ answer: correctEdges, onStatusChange, instantFeedback: false }));

    const check = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Kiểm tra",
    );
    expect(check).toBeDefined();
    act(() => check?.click());

    expect(onStatusChange).toHaveBeenLastCalledWith("success");
    expect(
      Array.from(container.querySelectorAll("[data-edge-state]")).map((edge) =>
        edge.getAttribute("data-edge-state"),
      ),
    ).toEqual(["correct", "correct"]);
  });
});

describe("MatchingScenePlayer — tên đọc ra của nút", () => {
  it("nút chỉ có ảnh đọc alt; không có gì thì gọi theo vị trí, không đọc id", () => {
    render(
      scene({
        nodes: [
          { id: "item_x1", kind: "item", x: 12, y: 24, image: { url: "/a.png", alt: "Con mèo" } },
          { id: "target_y2", kind: "target", x: 82, y: 28 },
        ],
        correctEdges: [{ item: "item_x1", target: "target_y2" }],
      }),
    );
    expect(nodeButton("Con mèo")).toBeTruthy();
    expect(nodeButton("Mục 2")).toBeTruthy();
    expect(container.querySelector('[aria-label="target_y2"]')).toBeNull();
  });
});

describe("MatchingScenePlayer geometry handles", () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  it("renders no move areas or resize handles without a FieldResizeContext provider", () => {
    render(scene());
    expect(container.querySelector("[data-move-area]")).toBeNull();
    expect(container.querySelector("[data-resize-handle]")).toBeNull();
  });

  it("renders a move area and resize handle on every scene node with a controller", () => {
    render(
      <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
        {scene()}
      </FieldResizeContext.Provider>,
    );

    for (const node of nodes) {
      expect(container.querySelector(`[data-move-area="${node.id}"]`)).not.toBeNull();
      expect(container.querySelector(`[data-resize-handle="${node.id}"]`)).not.toBeNull();
    }
    // The move area must stack above the full-cover selection button.
    const wrapper = container.querySelector<HTMLElement>('[data-scene-node="item-1"]')!;
    const children = Array.from(wrapper.children);
    expect(children.indexOf(wrapper.querySelector('[data-move-area="item-1"]')!)).toBeGreaterThan(
      children.indexOf(wrapper.querySelector("button")!),
    );
  });

  it("emits onGeometry PERCENT coordinates while dragging a node's move area", () => {
    const onGeometry = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    try {
      render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry }}>
          {scene()}
        </FieldResizeContext.Provider>,
      );

      const canvas = container.querySelector<HTMLElement>("[data-matching-scene]")!;
      const node = container.querySelector<HTMLElement>('[data-scene-node="item-1"]')!;
      // Canvas 500×200 at origin; node 40×40 centered at (70, 60) → x=14%, y=30%.
      vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(0, 0, 500, 200));
      vi.spyOn(node, "getBoundingClientRect").mockReturnValue(rect(50, 40, 40, 40));

      const moveArea = container.querySelector<HTMLElement>('[data-move-area="item-1"]')!;
      act(() => {
        moveArea.dispatchEvent(
          new MouseEvent("pointerdown", { bubbles: true, clientX: 70, clientY: 60 }),
        );
      });
      act(() => {
        // Drag +50px right (+10% of 500) and +20px down (+10% of 200).
        window.dispatchEvent(new MouseEvent("pointermove", { clientX: 120, clientY: 80 }));
      });
      expect(onGeometry).toHaveBeenLastCalledWith("item-1", { x: 24, y: 40 });

      act(() => {
        window.dispatchEvent(new MouseEvent("pointerup", {}));
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
