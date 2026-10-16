import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PathConnectPlayer, type PathConnectPlayerProps } from "./PathConnectPlayer";
import { FieldResizeContext } from "@/core/exercise/field-resize-context";

vi.mock("../tasks/AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

const nodes: PathConnectPlayerProps["nodes"] = [
  { id: "n_trung", label: "Trứng", x: 0.85, y: 0.3 },
  { id: "n_non", label: "Nòng nọc", x: 0.2, y: 0.6 },
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

function player(props: Partial<PathConnectPlayerProps> = {}): ReactElement {
  return (
    <PathConnectPlayer
      title="Nối theo thứ tự"
      nodes={nodes}
      correctPath={["n_trung", "n_non"]}
      {...props}
    />
  );
}

function render(element: ReactElement) {
  act(() => root.render(element));
}

function nodeButton(label: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.includes(label),
  );
  expect(button).toBeDefined();
  return button!;
}

describe("PathConnectPlayer", () => {
  it("keeps nodes center-anchored at their fractional coordinates", () => {
    render(player());
    const wrapper = nodeButton("Trứng").parentElement as HTMLElement;
    expect(wrapper.style.left).toBe("85%");
    expect(wrapper.style.top).toBe("30%");
    expect(wrapper.className).toContain("-translate-x-1/2");
  });

  it("builds the ordered path and grades on completion", () => {
    const onStatusChange = vi.fn();
    render(player({ onStatusChange }));

    act(() => nodeButton("Trứng").click());
    act(() => nodeButton("Nòng nọc").click());
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });

  it("blocks out-of-order nodes without adding them", () => {
    const onAnswerChange = vi.fn();
    render(player({ onAnswerChange }));

    act(() => nodeButton("Nòng nọc").click());
    expect(onAnswerChange).not.toHaveBeenCalled();
  });
});

describe("PathConnectPlayer geometry handles", () => {
  it("renders no move areas without a FieldResizeContext provider", () => {
    render(player());
    expect(container.querySelector("[data-move-area]")).toBeNull();
  });

  it("renders a move area per node with a controller, and no resize handle (move only)", () => {
    render(
      <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
        {player()}
      </FieldResizeContext.Provider>,
    );

    for (const node of nodes) {
      expect(container.querySelector(`[data-move-area="${node.id}"]`)).not.toBeNull();
    }
    expect(container.querySelector("[data-resize-handle]")).toBeNull();
  });
});
