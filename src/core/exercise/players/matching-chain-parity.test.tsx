import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChainMatchPlayer } from "./ChainMatchPlayer";
import {
  AccentProvider,
  PLAYER_ACCENT_OF,
  SkinProvider,
  type SkinName,
} from "@/core/exercise/skin";
import type { MatchEdge } from "@/core/question-schema/matching";

/**
 * Chuỗi ba cột phải nhìn và cư xử ĐÚNG NHƯ bản hai cột: chấm đầu nối ở hai mép
 * ô, nét dẫn + nét chờ bám con trỏ, và số nét đi ra khỏi một ô do ĐÁP ÁN quyết
 * định. Khác biệt duy nhất được phép là bản sắc: ba cột, ba tông màu.
 *
 * Mọi ca render dưới `skin="playful"` (= playfulAccentSkin, skin THẬT của bản
 * deploy) chứ không dùng context default `playfulSkin` cờ-only: tông cột do hệ
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
  // Ba cột nằm ở 0–100, 200–300, 400–500; hàng 1 ở y=0, hàng 2 ở y=50.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const text = this.textContent ?? "";
    if (this.tagName !== "BUTTON") {
      return rect(0, 0, 600, 200);
    }
    const left = text.startsWith("Trái") ? 0 : text.startsWith("Giữa") ? 200 : 400;
    const top = text.endsWith("1") ? 0 : 50;
    return rect(left, top, 100, 40);
  });
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

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

const leftItems = [
  { id: "L1", text: "Trái 1" },
  { id: "L2", text: "Trái 2" },
];
const middleItems = [
  { id: "M1", text: "Giữa 1" },
  { id: "M2", text: "Giữa 2" },
];
const rightItems = [
  { id: "R1", text: "Phải 1" },
  { id: "R2", text: "Phải 2" },
];
/** Đáp án MỘT-MỘT: mỗi ô nguồn đúng một nét đi ra. */
const oneToOnePairs = { L1: "M1", M1: "R1", L2: "M2", M2: "R2" };
/** Đáp án MỘT-NHIỀU (dáng của `triad`): ô giữa toả ra cả hai bên. */
const oneToManyEdges: MatchEdge[] = [
  { item: "L1", target: "M1" },
  { item: "L2", target: "M1" },
  { item: "M1", target: "R1" },
  { item: "M1", target: "R2" },
];

function renderChain(
  props: Record<string, unknown> = {},
  skin: SkinName = "playful",
) {
  act(() => {
    root.render(
      // dispatch bọc mọi player trong accent của nó (PLAYER_ACCENT_OF); render
      // trần thì cột trái rơi về DEFAULT_ACCENT và lệch khỏi bản deploy.
      <SkinProvider skin={skin}>
        <AccentProvider accent={PLAYER_ACCENT_OF.ChainMatchPlayer}>
          <ChainMatchPlayer
            title="Nối theo chuỗi ba cột."
            leftItems={leftItems}
            middleItems={middleItems}
            rightItems={rightItems}
            correctPairs={oneToOnePairs}
            {...props}
          />
        </AccentProvider>
      </SkinProvider>,
    );
  });
}

function buttonWithText(text: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

function connect(from: string, to: string) {
  act(() => buttonWithText(from)?.click());
  act(() => buttonWithText(to)?.click());
}

function renderedEdges() {
  return Array.from(container.querySelectorAll<SVGLineElement>("[data-matching-edge]"))
    .map((line) => line.dataset.matchingEdge)
    .sort();
}

function endpointRoles(text: string) {
  return Array.from(
    buttonWithText(text)?.querySelectorAll<HTMLElement>("[data-matching-endpoint]") ?? [],
  ).map((dot) => dot.dataset.matchingEndpoint);
}

function targetDotColor(text: string) {
  return buttonWithText(text)?.querySelector<HTMLElement>('[data-matching-endpoint="target"]')
    ?.style.background;
}

function moveCursorTo(x: number, y: number) {
  const canvas = container.querySelector<HTMLElement>('[data-matching-canvas="true"]');
  const event = new Event("pointermove", { bubbles: true });
  Object.defineProperties(event, { clientX: { value: x }, clientY: { value: y } });
  act(() => canvas?.dispatchEvent(event));
}

describe("matching/chain — bản sắc ba cột", () => {
  it("ba cột nghỉ mang ba tông màu khác nhau", () => {
    renderChain();

    expect(buttonWithText("Trái 1")?.className).toContain("border-fuchsia-300");
    expect(buttonWithText("Giữa 1")?.className).toContain("border-violet-300");
    expect(buttonWithText("Phải 1")?.className).toContain("border-blue-300");
  });

  it.each(["dark", "studio"] as const)(
    "skin %s giữ nguyên bảng màu của nó, tông ba cột không rò sang",
    (skin) => {
      renderChain({}, skin);

      for (const text of ["Trái 1", "Giữa 1", "Phải 1"]) {
        const cls = buttonWithText(text)?.className ?? "";
        // Không neo `(^|\s)` thì `hover:border-blue-300` của CHÍNH studio bị
        // tính là rò tông cột — đó là bảng màu riêng của skin, không phải accent.
        expect(cls).not.toMatch(/(^|\s)border-(fuchsia|violet|blue)-300\b/);
        expect(cls).toContain(skin === "dark" ? "bg-gray-800" : "border-gray-200");
      }
    },
  );
});

describe("matching/chain — chấm đầu nối", () => {
  it("cột trái chỉ có đầu RA, cột phải chỉ có đầu VÀO, cột giữa có cả hai", () => {
    renderChain();

    expect(endpointRoles("Trái 1")).toEqual(["source"]);
    expect(endpointRoles("Giữa 1")).toEqual(["target", "source"]);
    expect(endpointRoles("Phải 1")).toEqual(["target"]);
  });

  it("chấm đầu VÀO lúc nghỉ ăn theo tông cột của chính nó", () => {
    renderChain();

    expect(targetDotColor("Giữa 1")).toBe("rgb(196, 181, 253)"); // border-violet-300
    expect(targetDotColor("Phải 1")).toBe("rgb(147, 197, 253)"); // border-blue-300
  });

  it("chấm đầu VÀO của ô đã nối mang màu cặp, để thấy ô nào nối với ô nào", () => {
    renderChain({ instantFeedback: false });
    connect("Trái 1", "Giữa 1");

    expect(targetDotColor("Giữa 1")).toBe("rgb(217, 70, 239)"); // LINE_HEX[0]
  });
});

describe("matching/chain — nét nối", () => {
  it("mỗi cạnh vẽ nét dẫn mờ dưới nét chính, đúng hai mép ô", () => {
    renderChain({ instantFeedback: false });
    connect("Trái 1", "Giữa 1");

    const guide = container.querySelector<SVGLineElement>('svg line[data-line-role="guide"]');
    const fill = container.querySelector<SVGLineElement>('svg line[data-line-role="fill"]');
    expect(guide).not.toBeNull();
    expect(fill).not.toBeNull();
    expect(guide?.getAttribute("x1")).toBe("100");
    expect(guide?.getAttribute("x2")).toBe("200");
    expect(guide?.getAttribute("stroke-dasharray")).toBe("8 8");
  });

  it("nét chờ bám con trỏ, phát từ mép PHẢI khi con trỏ ở bên phải ô", () => {
    renderChain();
    act(() => buttonWithText("Trái 1")?.click());
    moveCursorTo(150, 20);

    const preview = container.querySelector<SVGLineElement>(
      'svg line[data-line-role="cursor-preview"]',
    );
    expect(preview?.getAttribute("x1")).toBe("100");
    expect(preview?.getAttribute("x2")).toBe("150");
    expect(preview?.getAttribute("stroke-dasharray")).toBe("8 8");

    act(() => buttonWithText("Giữa 1")?.click());
    expect(container.querySelector('line[data-line-role="cursor-preview"]')).toBeNull();
  });

  it("chọn ô cột PHẢI rồi kéo sang trái: nét chờ phát từ mép TRÁI và vẫn có màu", () => {
    renderChain();
    act(() => buttonWithText("Phải 1")?.click());
    moveCursorTo(350, 20);

    const preview = container.querySelector<SVGLineElement>(
      'svg line[data-line-role="cursor-preview"]',
    );
    expect(preview?.getAttribute("x1")).toBe("400");
    expect(preview?.getAttribute("x2")).toBe("350");
    expect(preview?.getAttribute("stroke")).toBeTruthy();
  });
});

describe("matching/chain — số nét đi ra do đáp án quyết định", () => {
  it("đáp án MỘT-MỘT: nối lại từ cùng một ô THAY nét cũ", () => {
    renderChain({ instantFeedback: false });

    connect("Trái 1", "Giữa 1");
    expect(renderedEdges()).toEqual(["L1->M1"]);

    connect("Trái 1", "Giữa 2");
    expect(renderedEdges()).toEqual(["L1->M2"]);
  });

  it("đáp án MỘT-MỘT: ô GIỮA cũng chỉ giữ một nét đi sang phải", () => {
    renderChain({ instantFeedback: false });

    connect("Giữa 1", "Phải 1");
    connect("Giữa 1", "Phải 2");

    expect(renderedEdges()).toEqual(["M1->R2"]);
  });

  it("đáp án MỘT-NHIỀU: nét thứ hai THÊM chứ không thay", () => {
    renderChain({ correctPairs: undefined, correctEdges: oneToManyEdges, instantFeedback: false });

    connect("Giữa 1", "Phải 1");
    connect("Giữa 1", "Phải 2");

    expect(renderedEdges()).toEqual(["M1->R1", "M1->R2"]);
  });

  it("nét vào cùng một ô đích vẫn cộng dồn: giới hạn là ở đầu RA", () => {
    renderChain({ correctPairs: undefined, correctEdges: oneToManyEdges, instantFeedback: false });

    connect("Trái 1", "Giữa 1");
    connect("Trái 2", "Giữa 1");

    expect(renderedEdges()).toEqual(["L1->M1", "L2->M1"]);
  });
  /**
   * `correctPairs` là `Record<fromId, toId>` nên đề triad khai bằng Record luôn
   * ra `isOneToManyMatch === false`. Đọc thẳng trần từ khoá thì chính biến thể
   * "toả ra từ tâm" bị chặn, trong khi gợi ý dưới chân bài vẫn mời học sinh nối
   * nhiều — nên trần của tâm đếm theo SỐ Ô cột phải còn trống cho nó.
   */
  it("triad khai bằng Record vẫn toả được từ tâm khi cột phải còn chỗ", () => {
    renderChain({ triad: true, correctPairs: { L1: "M1", M1: "R1" }, instantFeedback: false });

    connect("Giữa 1", "Phải 1");
    connect("Giữa 1", "Phải 2");

    expect(renderedEdges()).toEqual(["M1->R1", "M1->R2"]);
  });

  it("triad: tâm không rải hết cột phải khi khoá còn ô giữa khác", () => {
    // `oneToOnePairs` có cả M1 và M2 làm nguồn sang cột phải, mà cột phải chỉ
    // có hai ô — M2 giữ một ô cho mình nên M1 chỉ còn đúng một nét.
    renderChain({ triad: true, instantFeedback: false });

    connect("Giữa 1", "Phải 1");
    connect("Giữa 1", "Phải 2");

    expect(renderedEdges()).toEqual(["M1->R2"]);
  });
});
