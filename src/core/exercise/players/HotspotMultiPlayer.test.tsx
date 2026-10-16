import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HotspotMultiPlayer, type MultiHotspot } from "./HotspotMultiPlayer";
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

const playContainer = () => container.querySelector<HTMLElement>("img")!.parentElement!;

const MIXED = [
  { id: "h1", shape: "rect", x: 0.5, y: 0.5, width: 0.35, height: 0.8, label: "Vùng trái" },
  { id: "c1", shape: "circle", x: 0.3, y: 0.3, radius: 0.1 },
  { id: "hs11", shape: "polygon", points: [[0.0135, 0.5633], [0.4, 0.6], [0.2, 0.9]] },
] as unknown as MultiHotspot[];

describe("HotspotMultiPlayer edit overlay", () => {
  it("renders no overlay without a provider and click-to-toggle still works", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <HotspotMultiPlayer
          title="Bấm vào các vùng đúng"
          imageUrl="/img.png"
          hotspots={[
            { id: "c1", x: 0.3, y: 0.3, radius: 0.1 },
            { id: "c2", x: 0.8, y: 0.8, radius: 0.1 },
          ]}
          correctIds={["c1", "c2"]}
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    expect(container.querySelector("[data-hotspot-edit-overlay]")).toBeNull();
    expect(container.querySelector("[data-move-area]")).toBeNull();
    expect(container.querySelector("[data-edit-outline]")).toBeNull();

    const target = playContainer();
    stubRect(target);
    clickAt(target, 30, 30);
    expect(onAnswerChange).toHaveBeenCalledWith(["c1"]);
  });

  it("keeps a deselected marker over its hotspot area while it fades out", () => {
    act(() => {
      root.render(
        <HotspotMultiPlayer
          title="Báº¥m vÃ o cÃ¡c vÃ¹ng Ä‘Ãºng"
          imageUrl="/img.png"
          hotspots={[{ id: "c1", x: 0.3, y: 0.3, radius: 0.1 }]}
          correctIds={["c1"]}
        />,
      );
    });

    const target = playContainer();
    stubRect(target);
    clickAt(target, 34, 27);
    clickAt(target, 34, 27);

    const marker = container.querySelector<HTMLElement>('[data-hotspot-marker="c1"]')!;
    expect(marker.style.left).toBe("30%");
    expect(marker.style.top).toBe("30%");
    expect(marker.style.width).toBe("20%");
    expect(marker.style.borderColor).toBe("transparent");
  });

  it("renders no overlay with an onResize-only controller and still toggles clicks", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn() }}>
          <HotspotMultiPlayer
            title="Bấm vào các vùng đúng"
          imageUrl="/img.png"
            hotspots={[{ id: "c1", x: 0.3, y: 0.3, radius: 0.1 }]}
            correctIds={["c1"]}
            onAnswerChange={onAnswerChange}
          />
        </FieldResizeContext.Provider>,
      );
    });

    expect(container.querySelector("[data-hotspot-edit-overlay]")).toBeNull();
    expect(container.querySelector("[data-move-area]")).toBeNull();

    const target = playContainer();
    stubRect(target);
    clickAt(target, 30, 30);
    expect(onAnswerChange).toHaveBeenCalledWith(["c1"]);
  });

  it("renders one dashed outline per shape with the right affordances under an onGeometry controller", () => {
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          <HotspotMultiPlayer title="Bấm vào các vùng đúng" imageUrl="/img.png" hotspots={MIXED} correctIds={["c1"]} />
        </FieldResizeContext.Provider>,
      );
    });

    expect(container.querySelectorAll("[data-edit-outline]").length).toBe(3);

    expect(container.querySelector('[data-move-area="h1"]')).not.toBeNull();
    expect(container.querySelector('[data-resize-handle="h1"]')).not.toBeNull();
    expect(container.querySelector('[data-radius-handle="h1"]')).toBeNull();

    expect(container.querySelector('[data-move-area="c1"]')).not.toBeNull();
    expect(container.querySelector('[data-radius-handle="c1"]')).not.toBeNull();
    expect(container.querySelector('[data-resize-handle="c1"]')).toBeNull();

    expect(container.querySelector('[data-edit-polygon="hs11"]')).not.toBeNull();
    expect(container.querySelector('[data-move-area="hs11"]')).not.toBeNull();
    expect(container.querySelector('[data-resize-handle="hs11"]')).toBeNull();
    expect(container.querySelector('[data-radius-handle="hs11"]')).toBeNull();

    expect(container.querySelector('[data-edit-outline="h1"]')?.textContent).toContain("Vùng trái");
    expect(container.querySelector('[data-edit-outline="hs11"]')?.textContent).toContain("hs11");
  });

  it("suppresses the play click while geometry editing is active", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          <HotspotMultiPlayer
            title="Bấm vào các vùng đúng"
          imageUrl="/img.png"
            hotspots={[{ id: "c1", x: 0.3, y: 0.3, radius: 0.1 }]}
            correctIds={["c1"]}
            onAnswerChange={onAnswerChange}
          />
        </FieldResizeContext.Provider>,
      );
    });

    const target = playContainer();
    stubRect(target);
    clickAt(target, 30, 30);
    expect(onAnswerChange).not.toHaveBeenCalled();
  });
});

describe("HotspotMultiPlayer correctAnswer {count}", () => {
  const THREE = [
    { id: "f1", x: 0.3, y: 0.3, radius: 0.1 },
    { id: "f2", x: 0.8, y: 0.8, radius: 0.1 },
    { id: "f3", x: 0.8, y: 0.2, radius: 0.1 },
  ] as unknown as MultiHotspot[];

  it("instant mode: thành công khi chọn ĐỦ số vùng, vùng nào cũng được", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <HotspotMultiPlayer
          title="Tô màu 2 bông hoa"
          imageUrl="/img.png"
          hotspots={THREE}
          correctIds={[]}
          correctCount={2}
          onStatusChange={onStatusChange}
        />,
      );
    });

    const target = playContainer();
    stubRect(target);
    clickAt(target, 80, 20);
    expect(onStatusChange).not.toHaveBeenCalledWith("success");
    clickAt(target, 80, 80);
    expect(onStatusChange).toHaveBeenCalledWith("success");
  });

  it("đáp án khôi phục cũng được ĐẾM: đã lưu 1 vùng, chọn thêm 1 là thành công", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <HotspotMultiPlayer
          title="Tô màu 2 bông hoa"
          imageUrl="/img.png"
          hotspots={THREE}
          correctIds={[]}
          correctCount={2}
          answer={["f1"]}
          onStatusChange={onStatusChange}
        />,
      );
    });

    const target = playContainer();
    stubRect(target);
    clickAt(target, 80, 80);
    expect(onStatusChange).toHaveBeenCalledWith("success");
  });

  it("chọn THỪA sau khi thành công: rơi về đang-làm-dở, marker không còn xanh", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <HotspotMultiPlayer
          title="Tô màu 2 bông hoa"
          imageUrl="/img.png"
          hotspots={THREE}
          correctIds={[]}
          correctCount={2}
          onStatusChange={onStatusChange}
        />,
      );
    });

    const target = playContainer();
    stubRect(target);
    clickAt(target, 80, 20);
    clickAt(target, 80, 80);
    expect(onStatusChange).toHaveBeenCalledWith("success");

    clickAt(target, 30, 30);
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
    const green = ["#22c55e", "rgb(34, 197, 94)"];
    for (const m of container.querySelectorAll<HTMLElement>("[data-hotspot-marker]")) {
      expect(green).not.toContain(m.style.borderColor);
    }
  });

  it("nút Kiểm tra: sai khi thiếu, đúng khi đủ số vùng", () => {
    const onStatusChange = vi.fn();
    act(() => {
      root.render(
        <HotspotMultiPlayer
          title="Tô màu 2 bông hoa"
          imageUrl="/img.png"
          hotspots={THREE}
          correctIds={[]}
          correctCount={2}
          instantFeedback={false}
          onStatusChange={onStatusChange}
        />,
      );
    });

    // recordOnly phải là false: {count} là một đáp án hợp lệ nên nút phải hiện.
    const button = () =>
      [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Kiểm tra"))!;
    expect(button()).toBeTruthy();

    const target = playContainer();
    stubRect(target);
    clickAt(target, 30, 30);
    act(() => {
      button().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onStatusChange).toHaveBeenLastCalledWith("error");

    clickAt(target, 80, 80);
    act(() => {
      button().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });
});
