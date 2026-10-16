import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChainMatchPlayer } from "./ChainMatchPlayer";
import { AccentProvider, PLAYER_ACCENT_OF, SkinProvider } from "@/core/exercise/skin";

/**
 * web-own: cột giữa của câu `triad` KHÔNG vẽ khung nét đứt + nền tím. NXB nhắc
 * ở ba môn — khung ăn mất chỗ chạy của đường nối và làm cột giữa trông rỗng,
 * trong khi nó chỉ chứa nhãn nhóm ngắn.
 *
 * File chỉ có ở repo này nên copy từ studio không đè, và đỏ ngay nếu sync trả
 * lại khung. Dấu `data-matching-triad-centre` là chuyện khác: nó PHẢI còn —
 * MatchingHydration.test.tsx bám vào nó để phân biệt triad với chain.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
    },
  );
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

/** Dáng thật NXB gửi 21/09: ô giữa là NHÓM, toả ra cả hai bên. */
const triadItems = {
  triad: true,
  leftItems: [
    { id: "L1", text: "Trái 1" },
    { id: "L2", text: "Trái 2" },
  ],
  middleItems: [{ id: "M1", text: "Giữa 1" }],
  rightItems: [
    { id: "R1", text: "Phải 1" },
    { id: "R2", text: "Phải 2" },
  ],
  correctEdges: [
    { item: "L1", target: "M1" },
    { item: "L2", target: "M1" },
    { item: "M1", target: "R1" },
    { item: "M1", target: "R2" },
  ],
};

function renderChain(props: Record<string, unknown> = {}) {
  act(() => {
    root.render(
      <SkinProvider skin="playful">
        <AccentProvider accent={PLAYER_ACCENT_OF.ChainMatchPlayer}>
          <ChainMatchPlayer
            title="Nối theo chuỗi ba cột."
            leftItems={[{ id: "L1", text: "Trái 1" }]}
            middleItems={[{ id: "M1", text: "Giữa 1" }]}
            rightItems={[{ id: "R1", text: "Phải 1" }]}
            correctPairs={{ L1: "M1", M1: "R1" }}
            {...props}
          />
        </AccentProvider>
      </SkinProvider>,
    );
  });
}

function column(kind: "left" | "middle" | "right") {
  return container.querySelector<HTMLElement>(`[data-matching-chain-column="${kind}"]`);
}

describe("cột giữa của câu triad — không khung", () => {
  it("không còn khung nét đứt, nền tím hay padding của khung", () => {
    renderChain(triadItems);
    // So theo TỪNG class, không phải chuỗi con: "p-2" nằm lọt trong "gap-2"
    // nên `toContain` trên cả chuỗi đỏ oan.
    const classes = (column("middle")?.className ?? "").split(/\s+/);
    for (const gone of [
      "border-2",
      "border-dashed",
      "border-violet-300",
      "bg-violet-50/60",
      "rounded-2xl",
      "p-2",
    ]) {
      expect(classes).not.toContain(gone);
    }
  });

  it("VẪN đánh dấu là trung tâm: bỏ khung là chuyện nhìn, không phải chuyện dáng", () => {
    renderChain(triadItems);
    expect(column("middle")?.dataset.matchingTriadCentre).toBe("true");
    expect(column("middle")?.getAttribute("aria-label")).toBe("Cột giữa (trung tâm)");
  });

  it("câu chain thường không đổi gì", () => {
    renderChain();
    expect(column("middle")?.dataset.matchingTriadCentre).toBeUndefined();
    expect(column("middle")?.className).toBe(column("right")?.className);
  });
});
