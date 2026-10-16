import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChainMatchPlayer } from "./ChainMatchPlayer";
import { AccentProvider, PLAYER_ACCENT_OF, SkinProvider } from "@/core/exercise/skin";

/**
 * Tiêu đề cột của nối chuỗi ba cột: chỉ hiện thứ tác giả khai, không tự chèn
 * A/B/C (làm nốt phần #69 cố ý chưa sync — studio #1273 "UI không tự sinh
 * placeholder"; NXB 09/2026 báo chữ tự chèn là chữ thừa ở Đạo đức).
 *
 * File CHỈ có ở repo này, cố ý: `matching-chain-parity.test.tsx` dùng chung với
 * studio nên bước copy của quy trình sync sẽ ghi đè — luật web-own mà khoá ở
 * đó thì mất im lặng.
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

const chainItems = {
  leftItems: [{ id: "L1", text: "Trái 1" }],
  middleItems: [{ id: "M1", text: "Giữa 1" }],
  rightItems: [{ id: "R1", text: "Phải 1" }],
  correctPairs: { L1: "M1", M1: "R1" },
};

function renderChain(props: Record<string, unknown> = {}) {
  act(() => {
    root.render(
      <SkinProvider skin="playful">
        <AccentProvider accent={PLAYER_ACCENT_OF.ChainMatchPlayer}>
          <ChainMatchPlayer title="Nối theo chuỗi ba cột." {...chainItems} {...props} />
        </AccentProvider>
      </SkinProvider>,
    );
  });
}

function columnTitles() {
  return Array.from(container.querySelectorAll("[data-matching-col-title]")).map(
    (el) => el.textContent,
  );
}

/** Con đầu của mỗi cột: nhãn thật, chỗ chừa, hay thẳng vào ô nối. */
function firstChildOfColumns() {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-matching-chain-column]"),
  ).map((column) => {
    const first = column.firstElementChild as HTMLElement | null;
    if (first?.hasAttribute("data-matching-col-title")) return "title";
    const spacer = first?.getAttribute("data-matching-col-title-spacer");
    return spacer ? `spacer:${spacer}` : "items";
  });
}

describe("tiêu đề cột của nối chuỗi ba cột", () => {
  it("không khai tiêu đề thì KHÔNG dựng nhãn nào", () => {
    renderChain();
    expect(columnTitles()).toEqual([]);
  });

  it("cả ba cùng trống thì không chừa chỗ — ô nối dính đỉnh", () => {
    renderChain();
    expect(firstChildOfColumns()).toEqual(["items", "items", "items"]);
  });

  it("tiêu đề tác giả khai vẫn hiện đủ ba", () => {
    renderChain({ leftTitle: "Con vật", middleTitle: "Thức ăn", rightTitle: "Môi trường" });
    expect(columnTitles()).toEqual(["Con vật", "Thức ăn", "Môi trường"]);
  });

  /**
   * Khai THIẾU là ca dễ gặp nhất ở dáng triad: tác giả đặt tên ô giữa ("NÊN")
   * mà bỏ trống hai bên. Không chừa chỗ thì hai cột kia kéo ô lên cao hơn cột
   * giữa một nhịp, hàng ô gãy so le và nét nối xiên.
   */
  it("chỉ khai tiêu đề GIỮA: hai cột kia chừa đúng một dòng chữ", () => {
    renderChain({ middleTitle: "NÊN" });
    expect(columnTitles()).toEqual(["NÊN"]);
    expect(firstChildOfColumns()).toEqual(["spacer:text", "title", "spacer:text"]);
  });

  /**
   * Ca từng lọt: trình soạn hay để lại rich content RỖNG sau khi xoá chữ, lúc
   * đó nhãn phải đọc theo `title` (component vẫn vẽ huy hiệu). Chỗ chừa mà đo
   * theo rich rỗng sẽ tính nhầm thành nhãn chữ và hụt 24px.
   */
  it("titleContent rỗng thì đọc theo title — vẫn là huy hiệu", () => {
    renderChain({ leftTitle: "A", leftTitleContent: { blocks: [{ type: "paragraph", content: [] }] } });
    expect(columnTitles()).toEqual(["A"]);
    expect(firstChildOfColumns()).toEqual(["title", "spacer:badge", "spacer:badge"]);
  });

  it("nhãn ngắn ra huy hiệu thì chỗ chừa cũng cỡ huy hiệu", () => {
    renderChain({ leftTitle: "A" });
    expect(firstChildOfColumns()).toEqual(["title", "spacer:badge", "spacer:badge"]);
  });

  it("chỗ chừa là hình trang trí — trình đọc màn hình bỏ qua", () => {
    renderChain({ middleTitle: "NÊN" });
    const spacer = container.querySelector("[data-matching-col-title-spacer]");
    expect(spacer?.getAttribute("aria-hidden")).toBe("true");
    expect(spacer?.textContent).toBe("");
  });
});
