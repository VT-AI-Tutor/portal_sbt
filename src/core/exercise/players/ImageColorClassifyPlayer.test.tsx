import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
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

// Corpus-shaped payload (classification / image_color): rect x/y = TOP-LEFT,
// circle x/y = CENTER + radius as fraction of image width.
function payload(overrides: Record<string, unknown> = {}) {
  return {
    display: { interactionType: "image_color" },
    image: { url: "/uploads/scene.png" },
    categories: [
      { id: "c_red", label: "Đỏ", color: "#ef4444" },
      { id: "c_blue", label: "Xanh", color: "#3b82f6" },
    ],
    items: [
      { id: "a_3", label: "Vùng A", shape: "rect", x: 0.3691, y: 0.6861, width: 0.1217, height: 0.1884 },
      { id: "c_1", label: "Vùng B", shape: "circle", x: 0.63, y: 0.25, radius: 0.06 },
    ],
    correctAnswer: { a_3: "c_red", c_1: "c_blue" },
    ...overrides,
  };
}

function domRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left, top, width, height,
    right: left + width,
    bottom: top + height,
    x: left, y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("ImageColorClassifyPlayer geometry affordances", () => {
  it("renders no move/resize/radius affordances without a provider and keeps click-to-paint working", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(renderInteractionPlayer("classification", payload(), { onAnswerChange }));
    });

    expect(container.querySelector("[data-move-area]")).toBeNull();
    expect(container.querySelector("[data-resize-handle]")).toBeNull();
    expect(container.querySelector("[data-radius-handle]")).toBeNull();

    // Play interaction intact: first category is auto-selected, click paints.
    const region = container.querySelector<HTMLElement>('div[title="Vùng A"]');
    expect(region).not.toBeNull();
    act(() => region!.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith({ a_3: "c_red" });
  });

  it("renders no affordances with a v1 width-only controller (no onGeometry)", () => {
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn() }}>
          {renderInteractionPlayer("classification", payload(), {})}
        </FieldResizeContext.Provider>,
      );
    });

    expect(container.querySelector("[data-move-area]")).toBeNull();
    expect(container.querySelector("[data-resize-handle]")).toBeNull();
    expect(container.querySelector("[data-radius-handle]")).toBeNull();
  });

  it("renders MoveArea on every region, ResizeHandle on rects and RadiusHandle on circles with an onGeometry controller", () => {
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          {renderInteractionPlayer("classification", payload(), {})}
        </FieldResizeContext.Provider>,
      );
    });

    expect(container.querySelector('[data-move-area="a_3"]')).not.toBeNull();
    expect(container.querySelector('[data-move-area="c_1"]')).not.toBeNull();
    // Rect → xy resize handle, no radius grip.
    expect(container.querySelector('[data-resize-handle="a_3"]')).not.toBeNull();
    expect(container.querySelector('[data-radius-handle="a_3"]')).toBeNull();
    // Circle → radius grip, no resize handle.
    expect(container.querySelector('[data-radius-handle="c_1"]')).not.toBeNull();
    expect(container.querySelector('[data-resize-handle="c_1"]')).toBeNull();
  });

  it("emits top-left fractions while dragging a rect region", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const onGeometry = vi.fn();
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry }}>
          {renderInteractionPlayer("classification", payload(), {})}
        </FieldResizeContext.Provider>,
      );
    });

    const moveArea = container.querySelector<HTMLElement>('[data-move-area="a_3"]')!;
    const region = moveArea.parentElement as HTMLElement; // positioned region div
    const wrapper = region.parentElement!.parentElement as HTMLElement; // relative wrapper (containerRef)
    region.getBoundingClientRect = () => domRect(100, 60, 40, 30); // top-left = (0.25, 0.2)
    wrapper.getBoundingClientRect = () => domRect(0, 0, 400, 300);

    act(() => {
      moveArea.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 110, clientY: 70 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 150, clientY: 100 })); // +40px, +30px
    });

    // New top-left anchor = (140, 90) → fractions of the 400×300 container.
    expect(onGeometry).toHaveBeenLastCalledWith("a_3", { x: 0.35, y: 0.3 });

    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
  });
});

describe("ImageColorClassifyPlayer grading", () => {
  it("grades after all keyed regions are painted when the answer map is partial", () => {
    const onStatusChange = vi.fn();
    const onAnswerChange = vi.fn();
    const partialPayload = payload({
      items: [
        { id: "a_3", label: "Vùng A", shape: "rect", x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
        { id: "c_1", label: "Vùng B", shape: "circle", x: 0.5, y: 0.5, radius: 0.06 },
        { id: "extra", label: "Vùng ngoài đáp án", shape: "circle", x: 0.8, y: 0.5, radius: 0.06 },
      ],
      correctAnswer: { a_3: "c_red", c_1: "c_blue" },
    });

    act(() => {
      root.render(renderInteractionPlayer("classification", partialPayload, { onAnswerChange, onStatusChange }));
    });

    act(() => container.querySelector<HTMLElement>('div[title="Vùng A"]')!.click());
    expect(onStatusChange).not.toHaveBeenCalledWith("success");

    const blue = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Xanh"));
    expect(blue).not.toBeNull();
    act(() => blue!.click());
    act(() => container.querySelector<HTMLElement>('div[title="Vùng B"]')!.click());

    expect(onAnswerChange).toHaveBeenLastCalledWith({ a_3: "c_red", c_1: "c_blue" });
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chính xác! 🎉");
  });

  it("CHẤM NGAY: tô đúng màu key → onElementGraded 'correct' + viền xanh ngay", () => {
    const onElementGraded = vi.fn();
    act(() => {
      root.render(renderInteractionPlayer("classification", payload(), { onElementGraded }));
    });

    // Màu mặc định là category đầu (Đỏ = c_red); Vùng A có đáp án c_red.
    act(() => container.querySelector<HTMLElement>('div[title="Vùng A"]')!.click());

    expect(onElementGraded).toHaveBeenCalledWith("a_3", "correct", undefined);
    expect(container.querySelector<HTMLElement>('div[title="Vùng A"]')!.style.border).toContain(
      "rgb(34, 197, 94)",
    );
  });

  it("CHẤM NGAY: tô sai màu → onElementGraded 'incorrect' + viền đỏ ngay", () => {
    const onElementGraded = vi.fn();
    act(() => {
      root.render(renderInteractionPlayer("classification", payload(), { onElementGraded }));
    });

    // Vẫn giữ màu Đỏ (mặc định) rồi tô Vùng B (đáp án là Xanh) → sai ngay.
    act(() => container.querySelector<HTMLElement>('div[title="Vùng B"]')!.click());

    expect(onElementGraded).toHaveBeenCalledWith("c_1", "incorrect", undefined);
    expect(container.querySelector<HTMLElement>('div[title="Vùng B"]')!.style.border).toContain(
      "rgb(239, 68, 68)",
    );
  });

  it("CHẤM NGAY không khoá câu khi đúng: vẫn tô lại được", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(renderInteractionPlayer("classification", payload(), { onAnswerChange }));
    });

    act(() => container.querySelector<HTMLElement>('div[title="Vùng A"]')!.click()); // Đỏ → A
    const blue = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      b.textContent?.includes("Xanh"),
    )!;
    act(() => blue.click());
    act(() => container.querySelector<HTMLElement>('div[title="Vùng B"]')!.click()); // Xanh → B ⇒ đúng cả câu

    // Không khoá: bấm lại Vùng B để bỏ tô vẫn ăn (đáp án mất c_1).
    act(() => container.querySelector<HTMLElement>('div[title="Vùng B"]')!.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith({ a_3: "c_red" });
  });

  it("rejects painting a region omitted from the answer map", () => {
    const onStatusChange = vi.fn();
    const partialPayload = payload({
      items: [
        { id: "a_3", label: "Vùng A", shape: "rect", x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
        { id: "extra", label: "Vùng ngoài đáp án", shape: "circle", x: 0.8, y: 0.5, radius: 0.06 },
      ],
      correctAnswer: { a_3: "c_red" },
    });

    act(() => {
      root.render(renderInteractionPlayer("classification", partialPayload, { onStatusChange }));
    });

    act(() => container.querySelector<HTMLElement>('div[title="Vùng ngoài đáp án"]')!.click());
    act(() => container.querySelector<HTMLElement>('div[title="Vùng A"]')!.click());

    expect(onStatusChange).toHaveBeenLastCalledWith("error");
  });
});

// Regression: real "tô màu theo vùng" corpus (e.g. Toán 1 Tập 2, Bài 1 c20 —
// rainbow arcs) defines regions as shape:"polygon" with a points[] array and NO
// x/y. Before polygon support they fell through to the rect branch → x/y
// undefined → left/top "NaN%" → every region collapsed into a 10% box at the
// image's top-left corner, so clicking the artwork painted nothing.
describe("ImageColorClassifyPlayer polygon regions", () => {
  function polygonPayload(overrides: Record<string, unknown> = {}) {
    return payload({
      items: [
        // A triangle covering the left third, and one covering the right third.
        { id: "p_left", label: "Cung trái", shape: "polygon", points: [[0.1, 0.1], [0.4, 0.1], [0.25, 0.6]] },
        { id: "p_right", label: "Cung phải", shape: "polygon", points: [[0.6, 0.1], [0.9, 0.1], [0.75, 0.6]] },
      ],
      correctAnswer: { p_left: "c_red", p_right: "c_blue" },
      ...overrides,
    });
  }

  const polygon = (id: string) =>
    container.querySelector<SVGPolygonElement>(`polygon[data-region-id="${id}"]`);

  it("renders each polygon as a clickable <polygon> with its normalized points scaled to the 0..100 viewBox", () => {
    act(() => {
      root.render(renderInteractionPlayer("classification", polygonPayload(), {}));
    });
    // Not the mispositioned box path.
    expect(container.querySelector('div[title="Cung trái"]')).toBeNull();
    const left = polygon("p_left");
    expect(left).not.toBeNull();
    expect(left!.getAttribute("points")).toBe("10,10 40,10 25,60");
  });

  it("paints the polygon with the selected colour on click and reports the assignment", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(renderInteractionPlayer("classification", polygonPayload(), { onAnswerChange }));
    });
    // Default category = first (c_red); p_left keys to c_red.
    act(() => polygon("p_left")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onAnswerChange).toHaveBeenLastCalledWith({ p_left: "c_red" });
    // 33%-alpha fill of the chosen colour.
    expect(polygon("p_left")!.getAttribute("fill")).toBe("#ef444455");
  });

  it("CHẤM NGAY still grades each polygon per-element (no verdict outline on the polygon)", () => {
    const onElementGraded = vi.fn();
    act(() => {
      root.render(renderInteractionPlayer("classification", polygonPayload(), { onElementGraded }));
    });
    // Red is selected by default; p_left is correct, p_right (needs blue) is wrong.
    act(() => polygon("p_left")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onElementGraded).toHaveBeenCalledWith("p_left", "correct", undefined);
    // Graded correct, but the polygon keeps its painted category colour (#ef4444)
    // — no green verdict outline is drawn on the artwork.
    expect(polygon("p_left")!.getAttribute("stroke")).toBe("#ef4444");

    act(() => polygon("p_right")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onElementGraded).toHaveBeenCalledWith("p_right", "incorrect", undefined);
  });

  it("grades the whole question correct once every polygon holds its keyed colour", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(renderInteractionPlayer("classification", polygonPayload(), { onStatusChange }));
    });
    // Red → p_left (correct), then Blue → p_right (correct).
    act(() => polygon("p_left")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const blue = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      b.textContent?.includes("Xanh"),
    )!;
    act(() => blue.click());
    act(() => polygon("p_right")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });

  // A malformed polygon (missing/degenerate points) must not vanish: a keyed
  // region with no rendered element could never be painted, so the question
  // could never complete. It falls back to the positioned-box path instead.
  it("falls back to a clickable box when a polygon has fewer than 3 points (never silently dropped)", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "classification",
          payload({
            items: [{ id: "p_bad", label: "Vùng méo", shape: "polygon", points: [[0.1, 0.1], [0.2, 0.2]] }],
            correctAnswer: { p_bad: "c_red" },
          }),
          { onAnswerChange },
        ),
      );
    });
    // Not an SVG polygon…
    expect(polygon("p_bad")).toBeNull();
    // …but still rendered as a clickable box, so the region stays paintable.
    const box = container.querySelector<HTMLElement>('div[title="Vùng méo"]');
    expect(box).not.toBeNull();
    act(() => box!.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith({ p_bad: "c_red" });
  });

  it("falls back to a box when a polygon has ≥3 points but a vertex is malformed (would emit NaN in SVG)", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        renderInteractionPlayer(
          "classification",
          payload({
            // Middle vertex is missing its y — enough entries to pass a length
            // check, but a raw SVG points string would contain "20,NaN".
            items: [{ id: "p_nan", label: "Đỉnh hỏng", shape: "polygon", points: [[0.1, 0.1], [0.2], [0.3, 0.3]] }],
            correctAnswer: { p_nan: "c_red" },
          }),
          { onAnswerChange },
        ),
      );
    });
    expect(polygon("p_nan")).toBeNull();
    const box = container.querySelector<HTMLElement>('div[title="Đỉnh hỏng"]');
    expect(box).not.toBeNull();
    act(() => box!.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith({ p_nan: "c_red" });
  });

  it("never prints the region label over the artwork", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "classification",
          payload({
            items: [{ id: "p_left", label: "Cung trái", shape: "polygon", points: [[0.1, 0.1], [0.4, 0.1], [0.25, 0.6]] }],
            correctAnswer: { p_left: "c_red" },
          }),
          {},
        ),
      );
    });
    act(() => polygon("p_left")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    // Nhãn vùng chỉ còn là tooltip <title>, không phải chữ trắng vẽ đè lên hình.
    expect(container.querySelector('[data-region-label="p_left"]')).toBeNull();
    expect(polygon("p_left")!.querySelector("title")!.textContent).toBe("Cung trái");
  });

  it("keeps a painted box region free of printed label text", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "classification",
          payload({
            items: [{ id: "a_3", label: "Vùng A", shape: "rect", x: 0.1, y: 0.1, width: 0.2, height: 0.2 }],
            correctAnswer: { a_3: "c_red" },
          }),
          {},
        ),
      );
    });
    const box = container.querySelector<HTMLElement>('div[title="Vùng A"]')!;
    act(() => box.click());
    expect(box.textContent).toBe("");
  });
});
