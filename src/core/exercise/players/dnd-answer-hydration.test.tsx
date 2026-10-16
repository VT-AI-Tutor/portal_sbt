/**
 * Restore channel (`answer` prop) for the drag-and-drop player family.
 *
 * The parent (submission runner, embeds, remounted previews) supplies the last
 * reported answer through the `answer` prop; each player must seed/hydrate its
 * placement/order state from it IN PLACE — no key-remount, so no entrance
 * animation replay. The answer shape is always exactly what the player itself
 * emits via report()/onAnswerChange.
 *
 * Also covered: in parent grade mode the players never render their own
 * "Kiểm tra" self-check chrome — the parent owns the verdict.
 */
import { act, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GradeModeContext } from "./shared";
import { JigsawPlayer } from "./JigsawPlayer";
import { DragToZonesPlayer } from "./DragToZonesPlayer";
import { DragToGridPlayer } from "./DragToGridPlayer";
import { CardSortPlayer } from "./CardSortPlayer";
import { CategorizePlayer } from "./CategorizePlayer";
import { ReorderListPlayer } from "./ReorderListPlayer";
import { RankPlayer } from "./RankPlayer";
import { ProcessSequencePlayer } from "./ProcessSequencePlayer";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";
import { TimelinePlayer } from "./TimelinePlayer";
import { LabelDiagramPlayer } from "./LabelDiagramPlayer";
import { WordBankPlayer } from "./WordBankPlayer";

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

function render(element: ReactNode) {
  act(() => root.render(element));
}

function parentMode(children: ReactNode): ReactElement {
  return (
    <GradeModeContext.Provider value={{ mode: "parent" }}>{children}</GradeModeContext.Provider>
  );
}

function checkButton(): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === "Kiểm tra",
  );
}

/**
 * Which drop region (zone/bucket/pile) holds the chip with `chipText`: walk up
 * from the chip's innermost text node until an ancestor's text includes one of
 * the authored region labels — that ancestor is the region container. Hitting
 * two labels at once means the walk passed the region boundary ("ambiguous"),
 * which only happens when the chip is NOT inside any labeled region.
 */
function regionLabelOf(chipText: string, labels: string[]): string {
  const matches = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
    (el) => el.textContent === chipText,
  );
  expect(matches.length).toBeGreaterThan(0);
  let el: HTMLElement | null = matches[matches.length - 1];
  while (el) {
    const text = el.textContent ?? "";
    const hits = labels.filter((label) => text.includes(label));
    if (hits.length > 0) return hits.length === 1 ? hits[0] : "ambiguous";
    el = el.parentElement;
  }
  return "none";
}

describe("dnd answer hydration", () => {
  it("JigsawPlayer restores piece placement from an answer array", () => {
    render(
      <JigsawPlayer
        title="Ghép hình"
        rows={1}
        cols={2}
        answer={[
          { pieceId: "0-0", slotId: "0-1" },
          { pieceId: "0-1", slotId: "0-0" },
        ]}
      />,
    );

    // Every piece restored onto the board → tray shows its empty state.
    expect(container.textContent).toContain("Đã đặt hết các mảnh!");
    const board = container.querySelector<HTMLElement>(".aspect-square")!;
    expect(board.querySelector('[aria-label="Mảnh ghép 0-0"]')).not.toBeNull();
    expect(board.querySelector('[aria-label="Mảnh ghép 0-1"]')).not.toBeNull();
  });

  it("JigsawPlayer drops malformed/unknown entries instead of hydrating them", () => {
    render(
      <JigsawPlayer
        title="Ghép hình"
        rows={1}
        cols={2}
        answer={[{ pieceId: "9-9", slotId: "0-0" }, { pieceId: "0-0" }, null]}
      />,
    );
    // Nothing valid → both pieces stay in the tray.
    expect(container.textContent).not.toContain("Đã đặt hết các mảnh!");
  });

  it("DragToZonesPlayer restores mappings and rehydrates on a parent answer update", () => {
    const props = {
      title: "Kéo thả",
      draggables: [{ id: "d1", text: "Táo" }],
      dropZones: [
        { id: "z1", label: "Trái cây" },
        { id: "z2", label: "Rau" },
      ],
      correctMappings: { d1: "z1" },
    };
    render(<DragToZonesPlayer {...props} answer={{ d1: "z1" }} />);

    expect(container.textContent).toContain("Đã kéo hết các thẻ rồi!");
    expect(regionLabelOf("Táo", ["Trái cây", "Rau"])).toBe("Trái cây");

    // Parent supplies a different answer → placement follows without a remount.
    render(<DragToZonesPlayer {...props} answer={{ d1: "z2" }} />);
    expect(regionLabelOf("Táo", ["Trái cây", "Rau"])).toBe("Rau");
  });

  it("DragToZonesPlayer keeps picture cards compact in a horizontal tray", () => {
    render(
      <DragToZonesPlayer
        title="Kéo thả"
        draggables={[
          { id: "d1", text: '<img src="/one.png" alt="" />' },
          { id: "d2", text: '<img src="/two.png" alt="" />' },
        ]}
        dropZones={[{ id: "z1", label: "Nhóm" }]}
        correctMappings={{ d1: "z1", d2: "z1" }}
      />,
    );

    const card = container.querySelector<HTMLElement>('[draggable="true"]')!;
    expect(card.parentElement?.className).toContain("w-44");
    expect(card.className).toContain("w-full");
    expect(card.className).toContain("[&_img]:!max-h-28");
  });

  it("DragToGridPlayer restores cell placement from an answer record", () => {
    render(
      <DragToGridPlayer
        title="Lưới"
        rows={1}
        cols={2}
        tokens={[
          { id: "t1", text: "Một" },
          { id: "t2", text: "Hai" },
        ]}
        correctCells={{ "0-0": "t1", "0-1": "t2" }}
        answer={{ "0-0": "t1", "0-1": "t2" }}
      />,
    );

    expect(container.textContent).toContain("Đã đặt hết các thẻ rồi!");
    expect(container.querySelector('[aria-label="Một"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Hai"]')).not.toBeNull();
  });

  it("CardSortPlayer restores piles from an answer record", () => {
    render(
      <CardSortPlayer
        title="Chia bài"
        categories={[
          { id: "cat1", label: "Dưới nước" },
          { id: "cat2", label: "Trên cạn" },
        ]}
        cards={[{ id: "c1", text: "Cá" }]}
        correctMappings={{ c1: "cat1" }}
        answer={{ c1: "cat1" }}
      />,
    );

    expect(container.textContent).toContain("Đã chia hết bài");
    expect(regionLabelOf("Cá", ["Dưới nước", "Trên cạn"])).toBe("Dưới nước");
  });

  it("CategorizePlayer restores buckets from an answer record", () => {
    render(
      <CategorizePlayer
        title="Phân loại"
        categories={[
          { id: "cat1", label: "Gia cầm" },
          { id: "cat2", label: "Thú" },
        ]}
        items={[{ id: "i1", text: "Gà" }]}
        correctMappings={{ i1: "cat1" }}
        answer={{ i1: "cat1" }}
      />,
    );

    expect(container.textContent).toContain("Đã sắp xếp hết các thẻ");
    expect(regionLabelOf("Gà", ["Gia cầm", "Thú"])).toBe("Gia cầm");
  });

  it("ReorderListPlayer restores the saved order and rehydrates on a parent answer update", () => {
    const props = {
      title: "Sắp xếp",
      items: [
        { id: "a", text: "Ánh sáng" },
        { id: "b", text: "Bóng tối" },
        { id: "c", text: "Cầu vồng" },
      ],
      correctOrder: ["a", "b", "c"],
    };
    render(<ReorderListPlayer {...props} answer={["c", "a", "b"]} />);

    const rows = () =>
      Array.from(container.querySelectorAll('[role="listitem"]')).map((row) =>
        row.getAttribute("aria-label"),
      );
    expect(rows()).toEqual(["Cầu vồng", "Ánh sáng", "Bóng tối"]);

    render(<ReorderListPlayer {...props} answer={["b", "c", "a"]} />);
    expect(rows()).toEqual(["Bóng tối", "Cầu vồng", "Ánh sáng"]);
  });

  it("ReorderListPlayer appends items missing from a partial answer", () => {
    render(
      <ReorderListPlayer
        title="Sắp xếp"
        items={[
          { id: "a", text: "Ánh sáng" },
          { id: "b", text: "Bóng tối" },
          { id: "c", text: "Cầu vồng" },
        ]}
        correctOrder={["a", "b", "c"]}
        answer={["c"]}
      />,
    );
    const rows = Array.from(container.querySelectorAll('[role="listitem"]')).map((row) =>
      row.getAttribute("aria-label"),
    );
    expect(rows).toEqual(["Cầu vồng", "Ánh sáng", "Bóng tối"]);
  });

  it("RankPlayer restores the saved ranking order", () => {
    render(
      <RankPlayer
        title="Xếp hạng"
        items={[
          { id: "a", text: "An" },
          { id: "b", text: "Bình" },
          { id: "c", text: "Cường" },
        ]}
        correctOrder={["a", "b", "c"]}
        answer={["b", "c", "a"]}
      />,
    );
    const rows = Array.from(container.querySelectorAll('[role="listitem"]')).map((row) =>
      row.getAttribute("aria-label"),
    );
    expect(rows).toEqual(["Bình", "Cường", "An"]);
  });

  it("ProcessSequencePlayer restores the saved step order", () => {
    render(
      <ProcessSequencePlayer
        title="Quy trình"
        items={[
          { id: "a", text: "Gieo hạt" },
          { id: "b", text: "Tưới nước" },
          { id: "c", text: "Thu hoạch" },
        ]}
        correctOrder={["a", "b", "c"]}
        answer={["c", "b", "a"]}
      />,
    );
    const rows = Array.from(container.querySelectorAll('[role="listitem"]')).map(
      (row) => row.textContent ?? "",
    );
    expect(rows[0]).toContain("Thu hoạch");
    expect(rows[1]).toContain("Tưới nước");
    expect(rows[2]).toContain("Gieo hạt");
    // Regression: a bare `//` comment in JSX children position used to render
    // as literal text inside every step row.
    expect(container.textContent).not.toContain("Drag source");
  });

  it("TwoBucketSortPlayer restores bucket placement from an answer record", () => {
    render(
      <TwoBucketSortPlayer
        title="Hai rổ"
        buckets={[
          { id: "b1", label: "Nóng" },
          { id: "b2", label: "Lạnh" },
        ]}
        items={[{ id: "i1", text: "Mặt trời" }]}
        correctMappings={{ i1: "b1" }}
        answer={{ i1: "b1" }}
      />,
    );

    expect(container.textContent).toContain("Đã phân loại hết rồi!");
    expect(regionLabelOf("Mặt trời", ["Nóng", "Lạnh"])).toBe("Nóng");
  });

  it("TimelinePlayer restores the per-slot placement array", () => {
    render(
      <TimelinePlayer
        title="Dòng thời gian"
        items={[
          { id: "i1", text: "Sự kiện A" },
          { id: "i2", text: "Sự kiện B" },
        ]}
        slots={[
          { id: "s1", label: "1945" },
          { id: "s2", label: "1954" },
        ]}
        correctOrder={["i1", "i2"]}
        answer={["i2", "i1"]}
      />,
    );

    expect(container.textContent).toContain("Đã xếp hết các thẻ!");
    const slotColumns = Array.from(
      container.querySelectorAll<HTMLElement>('[class*="w-40"]'),
    );
    expect(slotColumns).toHaveLength(2);
    expect(slotColumns[0].textContent).toContain("Sự kiện B");
    expect(slotColumns[1].textContent).toContain("Sự kiện A");
  });

  it("TimelinePlayer ignores an answer whose length no longer matches the slots", () => {
    render(
      <TimelinePlayer
        title="Dòng thời gian"
        items={[
          { id: "i1", text: "Sự kiện A" },
          { id: "i2", text: "Sự kiện B" },
        ]}
        slots={[
          { id: "s1", label: "1945" },
          { id: "s2", label: "1954" },
        ]}
        correctOrder={["i1", "i2"]}
        answer={["i2"]}
      />,
    );
    // Stale answer for a changed payload → nothing hydrated, tray keeps both.
    expect(container.textContent).not.toContain("Đã xếp hết các thẻ!");
    expect(container.querySelector('[aria-label="Sự kiện A"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Sự kiện B"]')).not.toBeNull();
  });

  it("TimelinePlayer ignores an answer with non string|null entries", () => {
    render(
      <TimelinePlayer
        title="Dòng thời gian"
        items={[{ id: "i1", text: "Sự kiện A" }]}
        slots={[{ id: "s1", label: "1945" }]}
        correctOrder={["i1"]}
        answer={[7]}
      />,
    );
    expect(container.textContent).not.toContain("Đã xếp hết các thẻ!");
  });

  it("LabelDiagramPlayer restores pinned labels from an answer record", () => {
    render(
      <LabelDiagramPlayer
        title="Gắn nhãn"
        imageUrl="https://example.test/diagram.png"
        labels={[{ id: "l1", text: "Lá" }]}
        targets={[{ id: "t1", x: 0.5, y: 0.5 }]}
        correctMappings={{ l1: "t1" }}
        answer={{ l1: "t1" }}
      />,
    );

    expect(container.textContent).toContain("Đã gắn hết các nhãn rồi!");
    expect(container.querySelector('[aria-label="Lá"]')).not.toBeNull();
  });

  it("WordBankPlayer restores filled blanks from an answer record", () => {
    render(
      <WordBankPlayer
        title="Điền từ"
        segments={[{ text: "Con " }, { blankId: "b1" }]}
        wordBank={[{ id: "w1", text: "mèo" }]}
        correctMappings={{ b1: "w1" }}
        answer={{ b1: "w1" }}
      />,
    );

    expect(container.textContent).toContain("Đã dùng hết các từ");
    const blank = container.querySelector<HTMLButtonElement>('button[aria-label^="Chỗ trống"]')!;
    expect(blank.textContent).toContain("mèo");
  });
});

describe("parent grade mode hides the self-check button", () => {
  const playersWithCheck: [string, () => ReactElement][] = [
    [
      "DragToZonesPlayer",
      () => (
        <DragToZonesPlayer
          title="Kéo thả"
          instantFeedback={false}
          draggables={[{ id: "d1", text: "Táo" }]}
          dropZones={[{ id: "z1", label: "Trái cây" }]}
          correctMappings={{ d1: "z1" }}
        />
      ),
    ],
    [
      "DragToGridPlayer",
      () => (
        <DragToGridPlayer
          title="Lưới"
          instantFeedback={false}
          rows={1}
          cols={1}
          tokens={[{ id: "t1", text: "Một" }]}
          correctCells={{ "0-0": "t1" }}
        />
      ),
    ],
    [
      "CardSortPlayer",
      () => (
        <CardSortPlayer
          title="Chia bài"
          instantFeedback={false}
          categories={[{ id: "cat1", label: "Nhóm" }]}
          cards={[{ id: "c1", text: "Cá" }]}
          correctMappings={{ c1: "cat1" }}
        />
      ),
    ],
    [
      "CategorizePlayer",
      () => (
        <CategorizePlayer
          title="Phân loại"
          instantFeedback={false}
          categories={[{ id: "cat1", label: "Nhóm" }]}
          items={[{ id: "i1", text: "Gà" }]}
          correctMappings={{ i1: "cat1" }}
        />
      ),
    ],
    [
      "ReorderListPlayer",
      () => (
        <ReorderListPlayer
          title="Sắp xếp"
          instantFeedback={false}
          items={[
            { id: "a", text: "Một" },
            { id: "b", text: "Hai" },
          ]}
          correctOrder={["a", "b"]}
        />
      ),
    ],
    [
      "RankPlayer",
      () => (
        <RankPlayer
          title="Xếp hạng"
          instantFeedback={false}
          items={[
            { id: "a", text: "Một" },
            { id: "b", text: "Hai" },
          ]}
          correctOrder={["a", "b"]}
        />
      ),
    ],
    [
      "ProcessSequencePlayer",
      () => (
        <ProcessSequencePlayer
          title="Quy trình"
          instantFeedback={false}
          items={[
            { id: "a", text: "Một" },
            { id: "b", text: "Hai" },
          ]}
          correctOrder={["a", "b"]}
        />
      ),
    ],
    [
      "TwoBucketSortPlayer",
      () => (
        <TwoBucketSortPlayer
          title="Hai rổ"
          instantFeedback={false}
          buckets={[
            { id: "b1", label: "Nóng" },
            { id: "b2", label: "Lạnh" },
          ]}
          items={[{ id: "i1", text: "Mặt trời" }]}
          correctMappings={{ i1: "b1" }}
        />
      ),
    ],
    [
      "TimelinePlayer",
      () => (
        <TimelinePlayer
          title="Dòng thời gian"
          instantFeedback={false}
          items={[{ id: "i1", text: "Sự kiện A" }]}
          slots={[{ id: "s1", label: "1945" }]}
          correctOrder={["i1"]}
        />
      ),
    ],
    [
      "LabelDiagramPlayer",
      () => (
        <LabelDiagramPlayer
          title="Gắn nhãn"
          instantFeedback={false}
          imageUrl="https://example.test/diagram.png"
          labels={[{ id: "l1", text: "Lá" }]}
          targets={[{ id: "t1", x: 0.5, y: 0.5 }]}
          correctMappings={{ l1: "t1" }}
        />
      ),
    ],
    [
      "WordBankPlayer",
      () => (
        <WordBankPlayer
          title="Điền từ"
          instantFeedback={false}
          segments={[{ text: "Con " }, { blankId: "b1" }]}
          wordBank={[{ id: "w1", text: "mèo" }]}
          correctMappings={{ b1: "w1" }}
        />
      ),
    ],
  ];

  it.each(playersWithCheck)("%s", (_name, make) => {
    // Parent mode: the parent owns the verdict — no in-player "Kiểm tra".
    render(parentMode(make()));
    expect(checkButton()).toBeUndefined();

    // Self mode (default): the button stays, unchanged behaviour.
    render(make());
    expect(checkButton()).toBeDefined();
  });
});
