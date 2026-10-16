import { act, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkinProvider } from "@/core/exercise/skin";
import { ChainMatchPlayer } from "./ChainMatchPlayer";
import { ConnectLinesPlayer } from "./ConnectLinesPlayer";
import { MatchRadialPlayer } from "./MatchRadialPlayer";
import { MatchRowsPlayer } from "./MatchRowsPlayer";
import { TwoColumnMatchPlayer } from "./TwoColumnMatchPlayer";
import { renderInteractionPlayer } from "./dispatch";

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
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 100,
    bottom: 40,
    width: 100,
    height: 40,
    toJSON: () => ({}),
  } as DOMRect);
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

const leftItems = [
  { id: "left-1", text: "Trái 1" },
  { id: "left-2", text: "Trái 2" },
];
const rightItems = [
  { id: "right-1", text: "Phải 1" },
  { id: "right-2", text: "Phải 2" },
];
const correctPairs = { "left-1": "right-1", "left-2": "right-2" };
// Khoá một-nhiều: `correctPairs` (Record) không diễn đạt nổi hai đích cho cùng
// một ô, mà trần nối đọc chính từ khoá — nên ca một-nhiều phải khai bằng mảng.
const oneToManyKey = [
  { item: "left-1", target: "right-1" },
  { item: "left-1", target: "right-2" },
];

type StandardPlayer = "columns" | "lines" | "rows" | "radial";

function standardPlayer(
  player: StandardPlayer,
  answer: unknown,
  options: {
    onAnswerChange?: (answer: unknown) => void;
    submitted?: boolean;
    /** Khoá một-nhiều: cần khai để trần nối cho phép ô trái toả nhiều nét. */
    correctEdges?: { item: string; target: string }[];
  } = {},
): ReactElement {
  const props = {
    title: "Nối cặp",
    leftItems,
    rightItems,
    correctPairs,
    answer,
    ...options,
  };
  if (player === "columns") return <TwoColumnMatchPlayer {...props} />;
  if (player === "lines") return <ConnectLinesPlayer {...props} />;
  if (player === "rows") return <MatchRowsPlayer {...props} />;
  return <MatchRadialPlayer {...props} />;
}

function render(element: ReactNode) {
  act(() => root.render(element));
}

function renderedEdges() {
  return Array.from(container.querySelectorAll<SVGLineElement>("[data-matching-edge]"))
    .map((line) => line.dataset.matchingEdge)
    .sort();
}

function clickButton(text: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  expect(button).toBeDefined();
  act(() => button?.click());
}

describe("matching answer hydration", () => {
  it.each(["columns", "lines", "rows", "radial"] as const)(
    "does not mark unpaired left items green in submitted %s previews",
    (player) => {
      render(standardPlayer(player, undefined, { submitted: true }));

      const leftButtons = leftItems.map((item) =>
        Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent?.includes(item.text),
        ),
      );
      for (const button of leftButtons) {
        expect(button).toBeDefined();
        expect(button?.className).not.toContain("green");
      }
    },
  );

  it("renders nxbgd display.layout columns through the two-column player", () => {
    render(renderInteractionPlayer("matching", {
      id: "b2_q2",
      type: "matching",
      display: { layout: "columns" },
      content: { blocks: [{ type: "paragraph", text: "Nối từ phù hợp với hình." }] },
      leftItems: [{ id: "i_grandma", text: "Bà cụ" }],
      rightItems: [{ id: "t_ba", text: "bà" }],
      correctAnswer: { i_grandma: "t_ba" },
    }, {}));

    expect(container.querySelector('[data-matching-canvas="true"]')).not.toBeNull();
    expect(container.textContent).toContain("Bà cụ");
    expect(container.textContent).toContain("bà");
    expect(container.textContent).not.toContain("UNSUPPORTED_LAYOUT");
  });

  it("LEGACY-SYNTHESIS: a columnALabel/columnBLabel-only payload (no `columns` key) renders per-column titles with no re-import", () => {
    render(renderInteractionPlayer("matching", {
      id: "legacy-titles",
      type: "matching",
      display: { layout: "columns" },
      content: { blocks: [{ type: "paragraph", text: "Nối từ với nghĩa." }] },
      leftItems: [{ id: "i_grandma", text: "Bà cụ" }],
      rightItems: [{ id: "t_ba", text: "bà" }],
      correctAnswer: { i_grandma: "t_ba" },
      columnALabel: "Từ vựng",
      columnBLabel: "Nghĩa",
    }, {}));

    const titles = Array.from(container.querySelectorAll("[data-matching-col-title]")).map(
      (el) => el.textContent,
    );
    expect(titles).toEqual(["Từ vựng", "Nghĩa"]);
  });

  it("không dựng nhãn cột nào khi tác giả không khai tiêu đề", () => {
    render(renderInteractionPlayer("matching", {
      id: "no-titles",
      type: "matching",
      display: { layout: "columns" },
      content: { blocks: [{ type: "paragraph", text: "Nối từ với nghĩa." }] },
      leftItems: [{ id: "i_grandma", text: "Bà cụ" }],
      rightItems: [{ id: "t_ba", text: "bà" }],
      correctAnswer: { i_grandma: "t_ba" },
    }, {}));

    const titles = Array.from(container.querySelectorAll("[data-matching-col-title]")).map(
      (el) => el.textContent,
    );
    expect(titles).toEqual([]);
  });

  it("LEGACY-SYNTHESIS: a chain payload with columnALabel/columnMiddleLabel/columnBLabel (evo's own field names) renders all three titles with no re-import", () => {
    render(
      <ChainMatchPlayer
        title="Chuỗi"
        leftItems={[{ id: "left", text: "Trái" }]}
        middleItems={[{ id: "middle", text: "Giữa" }]}
        rightItems={[{ id: "right", text: "Phải" }]}
        leftTitle="Con vật"
        middleTitle="Thức ăn"
        rightTitle="Môi trường sống"
      />,
    );

    const titles = Array.from(container.querySelectorAll("[data-matching-col-title]")).map(
      (el) => el.textContent,
    );
    expect(titles).toEqual(["Con vật", "Thức ăn", "Môi trường sống"]);
  });

  it.each(["columns", "lines", "rows", "radial"] as const)(
    "renders independent rich title color and alignment in matching/%s",
    (interactionType) => {
      render(renderInteractionPlayer("matching", {
        id: `rich-title-${interactionType}`,
        type: "matching",
        display: { interactionType },
        columns: [
          {
            id: "left",
            title: "Fallback trái",
            titleContent: {
              blocks: [{
                type: "paragraph",
                align: "center",
                content: [{ text: "Tiêu đề trái", annotations: { color: "#ed1c24" } }],
              }],
            },
            items: [{ id: "L1", text: "Trái" }],
          },
          {
            id: "right",
            title: "Fallback phải",
            titleContent: {
              blocks: [{
                type: "paragraph",
                align: "justify",
                content: [{ text: "Tiêu đề phải", annotations: { color: "blue" } }],
              }],
            },
            items: [{ id: "R1", text: "Phải" }],
          },
        ],
        correctAnswer: [{ item: "L1", target: "R1" }],
      }, {}));

      const titles = Array.from(
        container.querySelectorAll<HTMLElement>("[data-matching-col-title]"),
      );
      expect(titles.map((title) => title.textContent?.trim())).toEqual([
        "Tiêu đề trái",
        "Tiêu đề phải",
      ]);
      expect(titles[0].querySelector(".text-center")).not.toBeNull();
      expect(titles[1].querySelector(".text-justify")).not.toBeNull();
      expect(titles[0].querySelector<HTMLElement>('[style*="color"]')?.style.color)
        .toBe("rgb(237, 28, 36)");
      expect(titles[1].querySelector<HTMLElement>('[style*="color"]')?.style.color)
        .toBe("blue");
    },
  );

  it.each(["columns", "lines", "rows", "radial"] as const)(
    "#561: a rich column title drops the forced typography classes in matching/%s",
    (interactionType) => {
      render(renderInteractionPlayer("matching", {
        id: `rich-title-format-${interactionType}`,
        type: "matching",
        display: { interactionType },
        columns: [
          {
            id: "left",
            title: "Fallback trái",
            // Author typed a plain (non-bold, lowercase) title in the editor.
            titleContent: {
              blocks: [{
                type: "paragraph",
                content: [{ text: "tiêu đề thường", annotations: {} }],
              }],
            },
            items: [{ id: "L1", text: "Trái" }],
          },
          {
            id: "right",
            // Legacy: plain string title only, no rich content → keeps the
            // original small-bold-uppercase-muted default so old questions
            // render unchanged.
            title: "Nhãn cũ",
            items: [{ id: "R1", text: "Phải" }],
          },
        ],
        correctAnswer: [{ item: "L1", target: "R1" }],
      }, {}));

      const titles = Array.from(
        container.querySelectorAll<HTMLElement>("[data-matching-col-title]"),
      );
      const richTitle = titles.find((t) => t.textContent?.trim() === "tiêu đề thường");
      const plainTitle = titles.find((t) => t.textContent?.trim() === "Nhãn cũ");
      expect(richTitle).toBeDefined();
      expect(plainTitle).toBeDefined();

      // Rich title: author formatting is NOT overridden — none of the forced
      // typography classes (which inline runs cannot un-set) are applied.
      for (const forced of ["uppercase", "font-bold", "text-sm", "text-slate-500", "tracking-wide"]) {
        expect(richTitle!.className).not.toContain(forced);
      }

      // Plain-string fallback: legacy default styling is preserved.
      expect(plainTitle!.className).toContain("uppercase");
      expect(plainTitle!.className).toContain("font-bold");
      expect(plainTitle!.className).toContain("text-slate-500");
    },
  );

  it("renders independently styled left/middle/right titles in matching/chain", () => {
    render(renderInteractionPlayer("matching", {
      id: "rich-title-chain",
      type: "matching",
      display: { interactionType: "chain" },
      columns: [
        {
          id: "left",
          title: "L",
          titleContent: {
            blocks: [{
              type: "paragraph",
              align: "left",
              content: [{ text: "Trái", annotations: { color: "red" } }],
            }],
          },
          items: [{ id: "L1", text: "Một" }],
        },
        {
          id: "middle",
          title: "M",
          titleContent: {
            blocks: [{
              type: "paragraph",
              align: "center",
              content: [{ text: "Giữa", annotations: { color: "green" } }],
            }],
          },
          items: [{ id: "M1", text: "Hai" }],
        },
        {
          id: "right",
          title: "R",
          titleContent: {
            blocks: [{
              type: "paragraph",
              align: "right",
              content: [{ text: "Phải", annotations: { color: "blue" } }],
            }],
          },
          items: [{ id: "R1", text: "Ba" }],
        },
      ],
      correctAnswer: [
        { item: "L1", target: "M1" },
        { item: "M1", target: "R1" },
      ],
    }, {}));

    const titles = Array.from(
      container.querySelectorAll<HTMLElement>("[data-matching-col-title]"),
    );
    expect(titles.map((title) => title.textContent?.trim())).toEqual(["Trái", "Giữa", "Phải"]);
    expect(titles[0].className).toContain("text-left");
    expect(titles[1].querySelector(".text-center")).not.toBeNull();
    expect(titles[2].querySelector(".text-right")).not.toBeNull();
  });

  it.each(["columns", "lines", "rows", "radial"] as const)(
    "hydrates canonical one-to-many edges and drops malformed endpoints in %s",
    (player) => {
      render(
        standardPlayer(player, [
          { item: "left-1", target: "right-1" },
          { item: "left-1", target: "right-2" },
          { item: "left-1", target: "right-2" },
          { item: "missing-left", target: "right-1" },
          { item: "left-2", target: "missing-right" },
          { item: "left-2" },
          null,
        ], { correctEdges: oneToManyKey }),
      );

      expect(renderedEdges()).toEqual(["left-1->right-1", "left-1->right-2"]);
    },
  );

  it("accepts a legacy Record at the boundary and rehydrates a parent answer update", () => {
    render(standardPlayer("lines", { "left-1": "right-1" }));
    expect(renderedEdges()).toEqual(["left-1->right-1"]);

    render(standardPlayer("lines", [{ item: "left-2", target: "right-2" }]));
    expect(renderedEdges()).toEqual(["left-2->right-2"]);
  });

  it("rehydrates from the answer when the player remounts", () => {
    render(
      <ConnectLinesPlayer
        key="first"
        title="Nối cặp"
        leftItems={leftItems}
        rightItems={rightItems}
        correctEdges={oneToManyKey}
        answer={[{ item: "left-1", target: "right-1" }]}
      />,
    );
    expect(renderedEdges()).toEqual(["left-1->right-1"]);

    render(
      <ConnectLinesPlayer
        key="second"
        title="Nối cặp"
        leftItems={leftItems}
        rightItems={rightItems}
        correctEdges={oneToManyKey}
        answer={[
          { item: "left-1", target: "right-1" },
          { item: "left-1", target: "right-2" },
        ]}
      />,
    );
    expect(renderedEdges()).toEqual(["left-1->right-1", "left-1->right-2"]);
  });

  it("emits a canonical non-lossy edge array after a local edit", () => {
    const onAnswerChange = vi.fn();
    render(
      standardPlayer(
        "columns",
        [
          { item: "left-1", target: "right-1" },
          { item: "missing-left", target: "right-1" },
        ],
        { onAnswerChange },
      ),
    );

    // Connect a second, distinct left item — the invalid hydrated edge
    // (missing-left) is dropped and both valid edges are emitted canonically.
    clickButton("Trái 2");
    clickButton("Phải 2");

    expect(onAnswerChange).toHaveBeenLastCalledWith([
      { item: "left-1", target: "right-1" },
      { item: "left-2", target: "right-2" },
    ]);
    expect(renderedEdges()).toEqual(["left-1->right-1", "left-2->right-2"]);
  });

  it.each(["columns", "lines", "rows", "radial"] as const)(
    "one-to-one key (%s): re-picking a right for a connected left auto-dismisses the prior edge",
    (player) => {
      const onAnswerChange = vi.fn();
      // correctPairs is one-to-one, so each left holds at most one target.
      render(standardPlayer(player, [{ item: "left-1", target: "right-1" }], { onAnswerChange }));
      expect(renderedEdges()).toEqual(["left-1->right-1"]);

      clickButton("Trái 1");
      clickButton("Phải 2");

      expect(onAnswerChange).toHaveBeenLastCalledWith([{ item: "left-1", target: "right-2" }]);
      expect(renderedEdges()).toEqual(["left-1->right-2"]);
    },
  );

  it("one-to-many key (columns): a connected left may still fan out to multiple targets", () => {
    const onAnswerChange = vi.fn();
    render(
      <TwoColumnMatchPlayer
        title="Nối cặp"
        leftItems={leftItems}
        rightItems={rightItems}
        // Answer key maps left-1 to BOTH rights → genuine one-to-many.
        correctEdges={[
          { item: "left-1", target: "right-1" },
          { item: "left-1", target: "right-2" },
        ]}
        answer={[{ item: "left-1", target: "right-1" }]}
        onAnswerChange={onAnswerChange}
      />,
    );

    clickButton("Trái 1");
    clickButton("Phải 2");

    expect(onAnswerChange).toHaveBeenLastCalledWith([
      { item: "left-1", target: "right-1" },
      { item: "left-1", target: "right-2" },
    ]);
    expect(renderedEdges()).toEqual(["left-1->right-1", "left-1->right-2"]);
  });

  it("hydrates a three-column chain and keeps submitted answers locked", () => {
    const onAnswerChange = vi.fn();
    render(
      <ChainMatchPlayer
        title="Chuỗi"
        leftItems={[{ id: "left", text: "Trái" }]}
        middleItems={[{ id: "middle", text: "Giữa" }]}
        rightItems={[{ id: "right", text: "Phải" }]}
        correctPairs={{ left: "middle", middle: "right" }}
        answer={[
          { item: "left", target: "middle" },
          { item: "middle", target: "right" },
          { item: "left", target: "right" },
          { item: "missing", target: "middle" },
        ]}
        submitted
        onAnswerChange={onAnswerChange}
      />,
    );

    expect(renderedEdges()).toEqual(["left->middle", "middle->right"]);
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.disabled)).toBe(true);

    clickButton("Trái");
    clickButton("Giữa");
    expect(onAnswerChange).not.toHaveBeenCalled();
    expect(renderedEdges()).toEqual(["left->middle", "middle->right"]);
  });

  it("keeps three readable columns in a keyboard-accessible horizontal region", () => {
    render(
      <ChainMatchPlayer
        title="Chuỗi"
        leftItems={[{ id: "left", text: "Trái" }]}
        middleItems={[{ id: "middle", text: "Giữa" }]}
        rightItems={[{ id: "right", text: "Phải" }]}
      />,
    );

    const scrollRegion = container.querySelector<HTMLElement>("[data-matching-chain-scroll]");
    const grid = container.querySelector<HTMLElement>("[data-matching-chain-grid]");
    const columns = Array.from(
      container.querySelectorAll<HTMLElement>("[data-matching-chain-column]"),
    );
    expect(scrollRegion?.getAttribute("role")).toBe("region");
    expect(scrollRegion?.getAttribute("aria-label")).toBe("Bài nối chuỗi ba cột");
    expect(scrollRegion?.getAttribute("aria-describedby")).toBeTruthy();
    expect(scrollRegion?.tabIndex).toBe(0);
    expect(scrollRegion?.className).toContain("overflow-x-auto");
    expect(scrollRegion?.firstElementChild?.className).toContain("min-w-[42rem]");
    expect(grid?.className).toContain("grid-cols-3");
    expect(columns.map((column) => column.dataset.matchingChainColumn)).toEqual([
      "left",
      "middle",
      "right",
    ]);
    // Ba cột DỒN LÊN ĐẦU: nhãn cột nằm chung flex column với các ô, nên hễ cột
    // nào canh giữa theo trục dọc là nhãn của nó tụt theo và ba tiêu đề lệch
    // hàng — đo được 53px ở `95131076/bai2` câu 1 (Owner 9/8, gỡ `justify-center`
    // mà #92 áp đại trà). Muốn cân quanh cột giữa cho ca TRANH thì phải gắn điều
    // kiện và đưa nhãn ra ngoài vùng canh giữa.
    for (const column of columns) {
      expect(column.className).not.toContain("justify-center");
    }
    expect(columns.map((column) => column.getAttribute("aria-label"))).toEqual([
      "Cột trái",
      "Cột giữa",
      "Cột phải",
    ]);
  });

  /**
   * Hai luật của lưới ba cột, khoá cùng chỗ vì chúng chỉ đúng khi đi cùng nhau
   * (58086b6 gỡ #92 chính vì thiếu cả hai):
   *   1. tiêu đề cột LUÔN dính đỉnh — ba tiêu đề là một hàng đọc ngang;
   *   2. ô nối chỉ canh giữa theo trục dọc khi CÂU có media.
   */
  function chainColumns(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>("[data-matching-chain-column]"));
  }

  function expectTitlesPinnedToTop() {
    for (const column of chainColumns()) {
      // Canh giữa CẢ CỘT thì mỗi tiêu đề trôi tới một cao độ khác nhau theo số
      // item của cột → hàng tiêu đề gãy so le. Nên cột không bao giờ mang nó.
      expect(column.className).not.toContain("justify-center");
      expect(column.firstElementChild?.hasAttribute("data-matching-col-title")).toBe(true);
      const items = column.querySelector<HTMLElement>("[data-matching-chain-items]");
      expect(items?.querySelector("[data-matching-col-title]")).toBeNull();
      expect(items?.querySelectorAll("button").length).toBeGreaterThan(0);
    }
  }

  const textColumns = {
    leftItems: [{ id: "l1", text: "Trái 1" }, { id: "l2", text: "Trái 2" }],
    middleItems: [{ id: "m1", text: "Giữa" }],
    rightItems: [{ id: "r1", text: "Phải" }],
  };

  it("câu CÓ ảnh: tiêu đề dính đỉnh, chỉ các ô nối canh giữa theo trục dọc", () => {
    render(
      <ChainMatchPlayer
        title="Chuỗi"
        leftTitle="Tranh"
        middleTitle="Nhân vật"
        rightTitle="Cảm xúc"
        leftItems={[
          { id: "l1", text: "Tranh 1", imageUrl: "/uploads/l1.png" },
          { id: "l2", text: "Tranh 2", imageUrl: "/uploads/l2.png" },
        ]}
        middleItems={textColumns.middleItems}
        rightItems={textColumns.rightItems}
      />,
    );

    expectTitlesPinnedToTop();
    for (const column of chainColumns()) {
      const items = column.querySelector<HTMLElement>("[data-matching-chain-items]");
      // Cột toàn CHỮ cũng canh giữa: cửa là của CẢ CÂU, vì chiều cao lệch do
      // cột tranh gây ra — cột chữ dồn lên đầu thì hộp giữa hở một mảng trống.
      expect(items?.className).toContain("flex-1");
      expect(items?.className).toContain("justify-center");
      expect(items?.getAttribute("data-matching-items-align")).toBe("center");
    }
  });

  it("câu TOÀN CHỮ: không canh giữa gì cả, mọi cột dồn lên đầu", () => {
    render(<ChainMatchPlayer title="Chuỗi" leftTitle="A" middleTitle="B" rightTitle="C" {...textColumns} />);

    expectTitlesPinnedToTop();
    for (const column of chainColumns()) {
      const items = column.querySelector<HTMLElement>("[data-matching-chain-items]");
      expect(items?.className).not.toContain("justify-center");
      expect(items?.className).not.toContain("flex-1");
      expect(items?.getAttribute("data-matching-items-align")).toBe("top");
    }
  });

  it("ảnh soạn trong rich-text cũng mở cửa canh giữa", () => {
    render(
      <ChainMatchPlayer
        title="Chuỗi"
        {...textColumns}
        rightItems={[
          {
            id: "r1",
            text: "",
            content: { blocks: [{ type: "image", url: "/uploads/r1.png" }] },
          },
        ]}
      />,
    );

    const items = container.querySelector<HTMLElement>("[data-matching-chain-items]");
    expect(items?.getAttribute("data-matching-items-align")).toBe("center");
  });

  it("tắt cờ autoMediaSizing → về dồn-lên-đầu kiểu studio dù câu có ảnh", () => {
    // Skin studio/QA: `presentation` vắng mặt = mọi hành vi smart tắt.
    render(
      <SkinProvider skin={{}}>
        <ChainMatchPlayer
          title="Chuỗi"
          {...textColumns}
          leftItems={[{ id: "l1", text: "Tranh 1", imageUrl: "/uploads/l1.png" }]}
        />
      </SkinProvider>,
    );

    for (const column of chainColumns()) {
      const items = column.querySelector<HTMLElement>("[data-matching-chain-items]");
      expect(items?.getAttribute("data-matching-items-align")).toBe("top");
    }
  });
});

describe("matching/triad — cột giữa là trung tâm, toả nhiều cạnh (§5.9.3)", () => {
  const triadPayload = {
    id: "triad-1",
    type: "matching",
    display: { interactionType: "triad" },
    columns: [
      { id: "left", items: [{ id: "L1", text: "Dưới nước" }, { id: "L2", text: "Trên cạn" }] },
      { id: "middle", items: [{ id: "M1", text: "Vịt" }] },
      { id: "right", items: [{ id: "R1", text: "Thóc" }, { id: "R2", text: "Cá nhỏ" }] },
    ],
    correctAnswer: [
      { item: "L1", target: "M1" },
      { item: "L2", target: "M1" },
      { item: "M1", target: "R1" },
      { item: "M1", target: "R2" },
    ],
  };

  const clickText = (text: string) => {
    const node = [...container.querySelectorAll<HTMLElement>("*")].find(
      (el) => el.textContent?.trim() === text && el.querySelector("*") === null,
    );
    act(() => node?.closest<HTMLElement>("[role='button'],button,div")?.click());
  };

  it("dựng đủ ba cột thay vì rơi về renderer hai cột", () => {
    render(renderInteractionPlayer("matching", triadPayload, {}) as ReactElement);
    // Cột giữa phải có mặt — đây là chỗ fallback P22 làm mất trước đây.
    expect(container.textContent).toContain("Vịt");
    expect(container.textContent).toContain("Dưới nước");
    expect(container.textContent).toContain("Thóc");
  });

  it("một ô giữa nối được nhiều ô: cạnh thứ hai THÊM chứ không thay", () => {
    const answers: unknown[] = [];
    render(renderInteractionPlayer("matching", triadPayload, {
      onAnswerChange: (value: unknown) => answers.push(value),
    }) as ReactElement);

    clickText("Vịt");
    clickText("Thóc");
    clickText("Vịt");
    clickText("Cá nhỏ");

    const last = answers.at(-1) as { item: string; target: string }[] | undefined;
    expect(last).toEqual([
      { item: "M1", target: "R1" },
      { item: "M1", target: "R2" },
    ]);
  });

  it("đánh dấu cột giữa là TRUNG TÂM và đổi gợi ý thao tác", () => {
    render(renderInteractionPlayer("matching", triadPayload, {}) as ReactElement);

    expect(container.querySelectorAll("[data-matching-chain-column]")).toHaveLength(3);
    expect(container.querySelector("[data-matching-triad-centre]")).not.toBeNull();
    // Gợi ý riêng của triad: bắt đầu từ cột giữa.
    expect(container.querySelector("[data-matching-chain-hint]")?.textContent)
      .toContain("cột giữa");
  });

  it("chain KHÔNG đánh dấu cột giữa là trung tâm — chỉ triad mới có", () => {
    render(renderInteractionPlayer("matching", {
      ...triadPayload,
      id: "chain-1",
      display: { interactionType: "chain" },
    }, {}) as ReactElement);

    expect(container.querySelectorAll("[data-matching-chain-column]")).toHaveLength(3);
    expect(container.querySelector("[data-matching-triad-centre]")).toBeNull();
  });

  it("bấm từ cột giữa ra cột trái vẫn lưu cạnh xuôi trái→giữa", () => {
    render(renderInteractionPlayer("matching", triadPayload, {}) as ReactElement);

    // Trước đây chỉ đi được trái→giữa; giờ bấm ô giữa trước cũng nối được.
    clickText("Vịt");
    clickText("Dưới nước");

    // Cạnh luôn lưu xuôi trái→phải dù bấm ô giữa trước.
    expect(container.querySelector('[data-matching-edge="L1->M1"]')).not.toBeNull();
    expect(container.querySelector('[data-matching-edge="M1->L1"]')).toBeNull();
  });
});
