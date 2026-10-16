import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectLinesPlayer } from "./ConnectLinesPlayer";
import { TwoColumnMatchPlayer } from "./TwoColumnMatchPlayer";
import {
  AccentProvider,
  PLAYER_ACCENT_OF,
  SkinProvider,
  type SkinName,
} from "@/core/exercise/skin";
import { MATCH_TARGET_ACCENT } from "./MatchingTargetColumn";

/**
 * Bản sắc hai cột của matching: đề bài luôn nói "cột A", "cột B" nên hai cột
 * phải tự giới thiệu được — bằng huy hiệu A/B khi payload không khai tiêu đề,
 * và bằng hai tông màu khác nhau để không nhìn nhầm cột này ra cột kia.
 *
 * Mọi ca render dưới `skin="playful"` (= playfulAccentSkin, skin THẬT của bản
 * deploy) chứ không dùng context default `playfulSkin` cờ-only: tông cột B do hệ
 * accent sinh ra, mà skin cờ-only không khai `chip` nên sẽ đo nhầm nhánh fallback.
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

const leftItems = [{ id: "left-1", text: "Em Bống" }];
const rightItems = [{ id: "right-1", text: "mua búp bê" }];
const correctPairs = { "left-1": "right-1" };

const players = {
  lines: ConnectLinesPlayer,
  columns: TwoColumnMatchPlayer,
} as const;

/** Tên component dùng để tra accent — đúng khoá dispatch bọc ngoài player thật. */
const accentKeys = {
  lines: "ConnectLinesPlayer",
  columns: "TwoColumnMatchPlayer",
} as const;

function renderPlayer(
  variant: keyof typeof players,
  props: { leftTitle?: string; rightTitle?: string; instantFeedback?: boolean } = {},
  skin: SkinName = "playful",
) {
  const Player = players[variant];
  act(() => {
    root.render(
      // dispatch bọc mọi player trong accent của nó (PLAYER_ACCENT_OF); render
      // trần thì cột NGUỒN rơi về DEFAULT_ACCENT và mất tương phản với cột đích.
      <SkinProvider skin={skin}>
        <AccentProvider accent={PLAYER_ACCENT_OF[accentKeys[variant]]}>
        <Player
          title="Nối từ ngữ ở cột A với từ ngữ ở cột B."
          leftItems={leftItems}
          rightItems={rightItems}
          correctPairs={correctPairs}
          {...props}
        />
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

function connectFirstPair() {
  act(() => buttonWithText("Em Bống")?.click());
  act(() => buttonWithText("mua búp bê")?.click());
}

/** Màu chấm đầu nối của ô cột B (inline style vì SVG/hex không nhận class). */
function rightDotColor() {
  return buttonWithText("mua búp bê")
    ?.querySelector<HTMLElement>('[data-matching-endpoint="target"]')?.style.background;
}

function buttonWithText(text: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.includes(text),
  );
}

describe("matching column identity", () => {
  it("accent cột đích khác accent của chính player — nếu trùng thì hai cột cùng màu", () => {
    for (const key of Object.values(accentKeys)) {
      expect(PLAYER_ACCENT_OF[key]).not.toBe(MATCH_TARGET_ACCENT);
    }
  });

  it.each(["lines", "columns"] as const)(
    "%s: không dựng nhãn cột khi payload không khai tiêu đề cột",
    (variant) => {
      renderPlayer(variant);
      expect(columnTitles()).toEqual([]);
    },
  );

  // Item đặt hàng CỨNG bằng `gridRow`, nên hàng 1 dành cho nhãn cột phải biến
  // mất cùng nhãn — hàng trống vẫn ăn trọn một nhịp `gap-y` ở đầu lưới.
  it.each(["lines", "columns"] as const)(
    "%s: không có nhãn cột thì item bắt đầu ngay từ hàng lưới 1",
    (variant) => {
      renderPlayer(variant);
      expect(buttonWithText("Em Bống")?.style.gridRow).toBe("1");
      expect(buttonWithText("mua búp bê")?.style.gridRow).toBe("1");
    },
  );

  it.each(["lines", "columns"] as const)(
    "%s: chỉ MỘT cột khai nhãn thì cả hai cột cùng chừa hàng 1, không lệch nhau",
    (variant) => {
      renderPlayer(variant, { leftTitle: "Nhân vật" });
      expect(buttonWithText("Em Bống")?.style.gridRow).toBe("2");
      expect(buttonWithText("mua búp bê")?.style.gridRow).toBe("2");
    },
  );

  it.each(["lines", "columns"] as const)(
    "%s: tiêu đề tác giả khai được dựng đúng ở cả hai cột",
    (variant) => {
      renderPlayer(variant, { leftTitle: "Nhân vật", rightTitle: "Việc sẽ làm" });
      expect(columnTitles()).toEqual(["Nhân vật", "Việc sẽ làm"]);
    },
  );

  it.each(["lines", "columns"] as const)(
    "%s: hai cột nghỉ mang hai tông màu khác nhau",
    (variant) => {
      renderPlayer(variant);
      const left = buttonWithText("Em Bống")?.className ?? "";
      const right = buttonWithText("mua búp bê")?.className ?? "";

      expect(right).toContain("border-blue-300");
      expect(left).not.toContain("border-blue-300");
    },
  );

  it("lines: ô đã nối ở cột B giữ tông xanh, không mượn màu cột A", () => {
    renderPlayer("lines", { instantFeedback: false });
    act(() => buttonWithText("Em Bống")?.click());
    act(() => buttonWithText("mua búp bê")?.click());

    const right = buttonWithText("mua búp bê")?.className ?? "";
    expect(right).toContain("border-blue-400");
    expect(right).not.toContain("border-fuchsia-400");
  });

  it.each(["lines", "columns"] as const)(
    "%s: chấm đầu nối cột B lúc nghỉ ăn theo màu viền, không còn xám trung tính",
    (variant) => {
      renderPlayer(variant);
      // border-blue-300 — cùng màu viền ô, xem RIGHT_ENDPOINT_HEX.
      expect(rightDotColor()).toBe("rgb(147, 197, 253)");
    },
  );

  it("lines: chấm đầu nối cột B lúc đã nối là border-blue-400, không mượn màu đường nối", () => {
    renderPlayer("lines", { instantFeedback: false });
    connectFirstPair();
    expect(rightDotColor()).toBe("rgb(96, 165, 250)");
  });

  it("lines: chấm đầu nối cột B sau khi chấm đúng đi theo viền xanh lá", () => {
    renderPlayer("lines");
    connectFirstPair();
    expect(rightDotColor()).toBe("rgb(74, 222, 128)"); // border-green-400
  });

  // Bản sắc cột B đi qua hệ accent chứ KHÔNG phải một chuỗi class đè lên sau
  // skin.chip(): đè literal thì twMerge ghi đè mọi skin — dark từng dính
  // `hover:bg-blue-50` gần trắng dưới chữ `text-gray-200`, đọc không ra.
  it.each(["lines", "columns"] as const)(
    "%s: skin dark giữ nguyên bảng màu của nó, tông cột B không rò sang",
    (variant) => {
      renderPlayer(variant, {}, "dark");
      const right = buttonWithText("mua búp bê")?.className ?? "";
      expect(right).toContain("bg-gray-800");
      expect(right).not.toMatch(/(^|\s|:)bg-blue-50\b/);
      expect(right).not.toContain("border-blue-300");
    },
  );

  it.each(["lines", "columns"] as const)(
    "%s: skin studio render trung thực, tông cột B không rò sang",
    (variant) => {
      renderPlayer(variant, {}, "studio");
      const left = buttonWithText("Em Bống")?.className ?? "";
      const right = buttonWithText("mua búp bê")?.className ?? "";
      expect(right).toContain("border-gray-200");
      expect(right).toBe(left.replace("justify-self-start", "justify-self-end"));
    },
  );

  it("lines: phản hồi chấm điểm thắng bản sắc cột — nối đúng vẫn xanh lá", () => {
    renderPlayer("lines");
    act(() => buttonWithText("Em Bống")?.click());
    act(() => buttonWithText("mua búp bê")?.click());

    const right = buttonWithText("mua búp bê")?.className ?? "";
    expect(right).toContain("border-green-400");
    expect(right).not.toContain("border-blue-400");
  });
});
