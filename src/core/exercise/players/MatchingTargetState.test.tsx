/**
 * WEB16 — ô chữ ĐÍCH phải phản ánh trạng thái nối, không chỉ "đã được nối".
 *
 * Trước đây cả ba player matching đều tính state của cột đích bằng
 * `hasOwner ? "placed" : ...`, không có nhánh wrong/correct. Hệ quả: sau khi
 * chấm, ô nguồn và đường nối đã đỏ/xanh nhưng ô đích vẫn giữ màu cặp trung
 * tính — đúng triệu chứng báo ở Câu 8/14 sách 39204387.
 *
 * Không suite nào trước đây kiểm tra className của cột phải, nên lỗi này không
 * làm hỏng bài test nào. Các case dưới đây khoá lại đúng chỗ đó.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, describe, it, vi } from "vitest";
import { MatchRowsPlayer } from "./MatchRowsPlayer";
import { TwoColumnMatchPlayer } from "./TwoColumnMatchPlayer";
import { ConnectLinesPlayer } from "./ConnectLinesPlayer";

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
});

const leftItems = [
  { id: "l1", text: "Chó" },
  { id: "l2", text: "Mèo" },
];
const rightItems = [
  { id: "r1", text: "Gâu" },
  { id: "r2", text: "Meo" },
];
const correctPairs = { l1: "r1", l2: "r2" };

function chipOf(t: string) {
  return Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(t),
  ) as HTMLButtonElement;
}

function clickText(t: string) {
  act(() => chipOf(t).dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

const PLAYERS = [
  { name: "MatchRowsPlayer", Player: MatchRowsPlayer },
  { name: "TwoColumnMatchPlayer", Player: TwoColumnMatchPlayer },
  { name: "ConnectLinesPlayer", Player: ConnectLinesPlayer },
] as const;

describe.each(PLAYERS)("$name — trạng thái ô đích", ({ Player }) => {
  const render = () =>
    act(() =>
      root.render(
        <Player
          title="Q"
          leftItems={leftItems}
          rightItems={rightItems}
          correctPairs={correctPairs}
        />,
      ),
    );

  it("nối SAI: ô đích chuyển đỏ, không kẹt ở màu cặp", () => {
    render();
    clickText("Chó");
    clickText("Meo"); // l1 -> r2 (sai)
    // Ô nguồn đỏ là hành vi đã có; điều WEB16 thiếu là ô đích.
    expect(chipOf("Chó").className).toContain("red");
    expect(chipOf("Meo").className).toContain("red");
  });

  it("nối ĐÚNG: ô đích chuyển xanh", () => {
    render();
    clickText("Chó");
    clickText("Gâu"); // l1 -> r1 (đúng)
    expect(chipOf("Gâu").className).toContain("green");
  });

  it("chưa nối: ô đích không mang màu đúng/sai", () => {
    render();
    expect(chipOf("Gâu").className).not.toContain("red");
    expect(chipOf("Gâu").className).not.toContain("green");
  });

  it("ô đích và đường nối luôn cùng một verdict", () => {
    render();
    clickText("Chó");
    clickText("Meo"); // sai
    const edge = container.querySelector('[data-matching-edge="l1->r2"]');
    expect(edge?.getAttribute("stroke")).toBe("#ef4444");
    expect(chipOf("Meo").className).toContain("red");
  });
});
