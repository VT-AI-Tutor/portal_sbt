import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MindMapTask } from "./MindMapTask";

let container: HTMLDivElement;
let root: Root;

// Mirrors the real b31_i3_q1 payload (VBT Tiếng Việt 5): three independent
// root branches ("Mở đầu", "Triển khai", "Kết thúc"), the middle one with two
// children — the shape that regressed to "only the first branch renders".
const nodes = [
  { id: "modau", label: "Mở đầu", nodeType: "static" as const },
  { id: "modau_nd", nodeType: "essay" as const, rowLines: 2 },
  { id: "trienkhai", label: "Triển khai", nodeType: "static" as const },
  { id: "tk_noidung", prefix: "Nội dung phim:", nodeType: "essay" as const, rowLines: 3 },
  { id: "tk_dacdiem", prefix: "Đặc điểm nhân vật:", nodeType: "essay" as const, rowLines: 4 },
  { id: "ketthuc", label: "Kết thúc", nodeType: "static" as const },
  { id: "ketthuc_nd", nodeType: "essay" as const, rowLines: 2 },
];

const edges = [
  { from: "modau", to: "modau_nd" },
  { from: "trienkhai", to: "tk_noidung" },
  { from: "trienkhai", to: "tk_dacdiem" },
  { from: "ketthuc", to: "ketthuc_nd" },
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

function render(element: ReactElement) {
  act(() => root.render(element));
}

function staticLabels(): string[] {
  // web-own: look joyful của web promote title trong PlayerHeader thành heading
  // font-black (studio default không promote) — scope vào nhãn node (.text-sm)
  // để không đếm nhầm header.
  return Array.from(container.querySelectorAll(".font-black.text-sm")).map(
    (el) => el.textContent ?? "",
  );
}

describe("MindMapTask", () => {
  it("renders every root branch and its children, not just the first", () => {
    render(<MindMapTask title="TÌM Ý" nodes={nodes} edges={edges} onComplete={vi.fn()} />);

    expect(staticLabels()).toEqual(["Mở đầu", "Triển khai", "Kết thúc"]);
    // Every essay/input node gets its own textbox — all four essay nodes across
    // all three branches must be present, not just the first branch's.
    expect(container.querySelectorAll("textarea")).toHaveLength(4);
  });

  it("does not crash on an edge referencing an unknown node, and still renders the valid nodes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const brokenEdges = [...edges, { from: "trienkhai", to: "does_not_exist" }];

    render(<MindMapTask title="TÌM Ý" nodes={nodes} edges={brokenEdges} onComplete={vi.fn()} />);

    expect(staticLabels()).toEqual(["Mở đầu", "Triển khai", "Kết thúc"]);
    expect(warn).toHaveBeenCalled();
  });

  it("breaks cycles instead of infinite-looping and still shows the reachable nodes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cyclicNodes = [
      { id: "a", label: "A", nodeType: "static" as const },
      { id: "b", label: "B", nodeType: "static" as const },
    ];
    const cyclicEdges = [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ];

    render(<MindMapTask title="Cycle" nodes={cyclicNodes} edges={cyclicEdges} onComplete={vi.fn()} />);

    // Every node has an incoming edge in a pure cycle, so buildTree falls back
    // to a flat list — both nodes must still be visible, none silently lost.
    expect(staticLabels().sort()).toEqual(["A", "B"]);
    expect(warn).toHaveBeenCalled();
  });

  it("hydrates inputs from a parent-supplied answer, so a remount restores the student's work", () => {
    const inputNodes = [
      { id: "node_1", label: "Môn học", nodeType: "static" as const },
      { id: "node_2", nodeType: "input" as const },
      { id: "node_3", nodeType: "input" as const },
    ];
    const inputEdges = [
      { from: "node_1", to: "node_2" },
      { from: "node_1", to: "node_3" },
    ];

    render(
      <MindMapTask
        title="Hoàn thành sơ đồ"
        nodes={inputNodes}
        edges={inputEdges}
        onComplete={vi.fn()}
        answer={{ node_2: "Văn", node_3: "Hóa" }}
      />,
    );

    const values = Array.from(container.querySelectorAll("input")).map(
      (el) => el.value,
    );
    expect(values).toEqual(["Văn", "Hóa"]);
  });

  it("re-hydrates when the parent hands over a semantically different answer, but ignores echoes", () => {
    const inputNodes = [
      { id: "node_1", label: "Môn học", nodeType: "static" as const },
      { id: "node_2", nodeType: "input" as const },
    ];
    const inputEdges = [{ from: "node_1", to: "node_2" }];
    const onAnswerChange = vi.fn();

    const el = (answer: unknown) => (
      <MindMapTask
        title="Hoàn thành sơ đồ"
        nodes={inputNodes}
        edges={inputEdges}
        onComplete={vi.fn()}
        onAnswerChange={onAnswerChange}
        answer={answer}
      />
    );
    render(el(undefined));

    const input = () => container.querySelector("input")!;
    act(() => {
      // React's onChange path via native setter + input event.
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input(), "Văn");
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input().value).toBe("Văn");
    expect(onAnswerChange).toHaveBeenCalledWith({ node_2: "Văn" });

    // Parent echoes the emitted answer back — must NOT clobber local state.
    render(el({ node_2: "Văn" }));
    expect(input().value).toBe("Văn");

    // Parent hands over a different answer (restore path) — must re-hydrate.
    render(el({ node_2: "Hóa" }));
    expect(input().value).toBe("Hóa");
  });

  it("keeps the first occurrence of a duplicate node id and warns instead of silently overwriting it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dupNodes = [
      { id: "x", label: "First", nodeType: "static" as const },
      { id: "x", label: "Second", nodeType: "static" as const },
    ];

    render(<MindMapTask title="Dup" nodes={dupNodes} edges={[]} onComplete={vi.fn()} />);

    expect(staticLabels()).toEqual(["First"]);
    expect(warn).toHaveBeenCalled();
  });
});
