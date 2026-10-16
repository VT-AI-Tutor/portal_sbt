/**
 * Marker của HotspotMultiPlayer nằm đè lên ảnh scan sách (#624): mọi vòng tròn
 * vẽ sẵn đều che chữ in. Test chốt hai điều — vùng chưa chọn không vẽ gì cả, và
 * marker khi hiện ra thì blend multiply (không lấy nền đặc từ skin studio).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HotspotMultiPlayer } from "./HotspotMultiPlayer";
import { SkinProvider } from "@/core/exercise/skin";

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
});

const hotspots = [
  { id: "a", shape: "circle" as const, x: 0.25, y: 0.25, radius: 0.1 },
  { id: "b", shape: "circle" as const, x: 0.75, y: 0.75, radius: 0.1 },
];

function render(submitted = false) {
  act(() => {
    root.render(
      <SkinProvider skin="studio">
        <HotspotMultiPlayer
          title="Chọn (tô) các ô chữ"
          imageUrl="/scan.png"
          hotspots={hotspots}
          correctIds={["a"]}
          submitted={submitted}
        />
      </SkinProvider>,
    );
  });
}

const markers = () => container.querySelectorAll<HTMLElement>("[data-hotspot-marker]");

describe("HotspotMultiPlayer — marker không che chữ", () => {
  it("chưa chọn thì marker hoàn toàn vô hình", () => {
    render();
    const idle = markers();
    expect(idle).toHaveLength(2);
    for (const m of idle) {
      expect(m.style.borderColor).toBe("transparent");
      expect(m.style.background).toBe("transparent");
      // không dính nền đặc từ skin studio
      expect(m.className).not.toMatch(/\bbg-/);
    }
  });

  it("marker hiện ra (đáp án đúng lúc khoá) blend multiply, không dùng nền skin", () => {
    render(true);
    const shown = container.querySelector<HTMLElement>('[data-hotspot-marker="a"]')!;
    expect(shown.className).toContain("mix-blend-multiply");
    expect(shown.className).not.toMatch(/\bbg-/);
    expect(shown.style.borderColor).not.toBe("transparent");
    // ô không phải đáp án vẫn vô hình
    const other = container.querySelector<HTMLElement>('[data-hotspot-marker="b"]')!;
    expect(other.style.borderColor).toBe("transparent");
  });
});
