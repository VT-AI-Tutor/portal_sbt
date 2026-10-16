import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectPointsTask } from "./ConnectPointsTask";
import { FieldResizeContext } from "@/core/exercise/field-resize-context";

vi.mock("./AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

const points = [
  { id: "i_xinhdep", label: "A", x: 0.2, y: 0.083 },
  { id: "i_hoa", label: "B", x: 0.7, y: 0.5 },
];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
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

function task(props: Partial<React.ComponentProps<typeof ConnectPointsTask>> = {}): ReactElement {
  return (
    <ConnectPointsTask
      title="Nối các điểm"
      points={points}
      correctConnections={[{ from: "i_xinhdep", to: "i_hoa" }]}
      onComplete={vi.fn()}
      {...props}
    />
  );
}

function render(element: ReactElement) {
  act(() => root.render(element));
}

function pointButton(label: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  expect(button).toBeDefined();
  return button!;
}

describe("ConnectPointsTask", () => {
  it("keeps points center-anchored at their fractional coordinates", () => {
    render(task());
    const wrapper = pointButton("A").parentElement as HTMLElement;
    expect(wrapper.style.left).toBe("20%");
    expect(wrapper.style.top).toBe("8.3%");
    expect(wrapper.className).toContain("-translate-x-1/2");
  });

  it("connects two selected points and emits the answer", () => {
    const onAnswerChange = vi.fn();
    render(task({ onAnswerChange }));

    act(() => pointButton("A").click());
    act(() => pointButton("B").click());
    expect(onAnswerChange).toHaveBeenLastCalledWith([{ from: "i_xinhdep", to: "i_hoa" }]);
  });
});

describe("ConnectPointsTask geometry handles", () => {
  it("renders no move areas without a FieldResizeContext provider", () => {
    render(task());
    expect(container.querySelector("[data-move-area]")).toBeNull();
  });

  it("renders a move area per point with a controller, and no resize handle (move only)", () => {
    render(
      <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
        {task()}
      </FieldResizeContext.Provider>,
    );

    for (const point of points) {
      expect(container.querySelector(`[data-move-area="${point.id}"]`)).not.toBeNull();
    }
    expect(container.querySelector("[data-resize-handle]")).toBeNull();
  });
});
