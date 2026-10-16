import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChainMatchPlayer } from "./ChainMatchPlayer";
import {
  AccentProvider,
  PLAYER_ACCENT_OF,
  SkinProvider,
  playfulAccentSkin,
  type AnySkin,
} from "@/core/exercise/skin";

/**
 * web-own: dòng gợi ý dưới lưới nối chuỗi. Studio giữ ở mọi câu; repo này ẩn
 * cho sách Đạo đức (NXB 09/2026). File chỉ có ở repo này nên copy từ studio
 * không đè, và đỏ ngay nếu sync nuốt mất cờ.
 *
 * Hai ranh giới: chỉ hai câu HƯỚNG DẪN bị ẩn ("Đã chọn 1 ô →…" là phản hồi lúc
 * đang giữ một ô), và thẻ `<p>` LUÔN render — nó nằm trong vùng `footerRef` mà
 * trần ảnh đo, cho nó mọc/biến là ảnh co giãn giữa lúc học sinh đang bấm.
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

/** playfulAccentSkin + cờ tắt gợi ý, đúng skin dựng cho Đạo đức. */
const noHintSkin: AnySkin = {
  name: "playful-no-chain-hint",
  forAccent: (accent) => {
    const bound = playfulAccentSkin.forAccent(accent);
    return {
      ...bound,
      presentation: { ...bound.presentation, hideChainMatchHint: true },
    };
  },
};

const chainItems = {
  leftItems: [{ id: "L1", text: "Trái 1" }],
  middleItems: [{ id: "M1", text: "Giữa 1" }],
  rightItems: [{ id: "R1", text: "Phải 1" }],
  correctPairs: { L1: "M1", M1: "R1" },
};

/** Dáng `triad` (§5.9.3): cờ payload khai + ô giữa toả ra hai bên. */
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

function renderChain(
  props: Record<string, unknown> = {},
  skin: AnySkin | "playful" = "playful",
) {
  act(() => {
    root.render(
      <SkinProvider skin={skin}>
        <AccentProvider accent={PLAYER_ACCENT_OF.ChainMatchPlayer}>
          <ChainMatchPlayer title="Nối theo chuỗi ba cột." {...chainItems} {...props} />
        </AccentProvider>
      </SkinProvider>,
    );
  });
}

function hintNode() {
  return container.querySelector<HTMLElement>("[data-matching-chain-hint]");
}

function hintText() {
  return hintNode()?.textContent?.trim() ?? null;
}

function buttonWithText(text: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.includes(text),
  );
}

describe("dòng gợi ý của câu nối chuỗi", () => {
  it("mặc định hiện câu hướng dẫn của chuỗi thường", () => {
    renderChain();
    expect(hintText()).toBe("Bấm ô ở một cột rồi bấm ô ở cột kề để nối thành chuỗi.");
  });

  it("mặc định hiện đúng câu của dáng triad", () => {
    renderChain(triadItems);
    expect(hintText()).toBe(
      "Bấm ô cột giữa rồi bấm ô ở cột kề để nối (mỗi ô giữa nối được nhiều ô).",
    );
  });

  it.each([
    ["chuỗi thường", {}],
    ["dáng triad", triadItems],
  ])("tắt cờ: %s không còn câu hướng dẫn", (_name, props) => {
    renderChain(props, noHintSkin);
    expect(hintText()).toBe("");
  });

  it("tắt cờ vẫn GIỮ chỗ của dòng — thẻ không biến mất", () => {
    renderChain({}, noHintSkin);
    expect(hintNode()).not.toBeNull();
    expect(hintNode()?.getAttribute("aria-hidden")).toBe("true");
  });

  it("tắt cờ vẫn hiện phản hồi 'Đã chọn 1 ô' lúc đang giữ một ô", () => {
    renderChain({}, noHintSkin);
    act(() => buttonWithText("Trái 1")?.click());
    expect(hintText()).toBe("Đã chọn 1 ô → bấm ô ở cột kề để nối.");
    expect(hintNode()?.getAttribute("aria-hidden")).toBeNull();
  });
});
