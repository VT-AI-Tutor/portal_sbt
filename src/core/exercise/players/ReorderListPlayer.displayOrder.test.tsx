import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReorderListPlayer } from "./ReorderListPlayer";
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

const items = [
  { id: "one", text: "Một" },
  { id: "two", text: "Hai" },
  { id: "three", text: "Ba" },
];

function render(player: ReactElement) {
  act(() => root.render(player));
}

/** Visible order of the cards (answer/badge digits stripped). */
function visibleOrder(): string[] {
  return Array.from(container.querySelectorAll('[role="listitem"]')).map((li) =>
    (li.textContent ?? "").replace(/\d+/g, "").trim(),
  );
}

describe("ReorderListPlayer display order (#591)", () => {
  it("renders items in the authored displayOrder instead of shuffling", () => {
    render(
      <ReorderListPlayer
        title="Sắp xếp"
        items={items}
        correctOrder={items.map((i) => i.id)}
        displayOrder={["three", "one", "two"]}
      />,
    );
    expect(visibleOrder()).toEqual(["Ba", "Một", "Hai"]);
  });

  it("keeps valid displayOrder ids first and appends items it forgot", () => {
    render(
      <ReorderListPlayer
        title="Sắp xếp"
        items={items}
        correctOrder={items.map((i) => i.id)}
        displayOrder={["three", "ghost"]}
      />,
    );
    // "three" honoured first; unknown "ghost" dropped; "one"/"two" appended in item order.
    expect(visibleOrder()).toEqual(["Ba", "Một", "Hai"]);
  });

  it("still renders every item when no displayOrder is provided (shuffle path)", () => {
    render(
      <ReorderListPlayer
        title="Sắp xếp"
        items={items}
        correctOrder={items.map((i) => i.id)}
      />,
    );
    expect(visibleOrder().slice().sort()).toEqual(["Ba", "Hai", "Một"].sort());
  });
});

// Owner 8/8: ảnh thẻ ordering co theo CHỖ TRỐNG THẬT (useAvailableHeight) chứ
// không theo số rem cứng. jsdom không layout nên hook trả null — bài này chốt
// ĐƯỜNG LÙI: chưa đo được thì ảnh giữ trần item mặc định, không rơi về sàn.
describe("ordering ảnh co theo chỗ trống đo được", () => {
  it("chưa đo được (jsdom) thì giữ trần mặc định, KHÔNG tụt xuống sàn", () => {
    act(() => {
      root.render(
        <SkinProvider skin={{ presentation: { autoMediaSizing: true } }}>
          <ReorderListPlayer
            title="Sắp xếp"
            items={[
              { id: "a", text: "A", imageUrl: "/a.png" },
              { id: "b", text: "B", imageUrl: "/b.png" },
              { id: "c", text: "C", imageUrl: "/c.png" },
              { id: "d", text: "D", imageUrl: "/d.png" },
            ]}
            correctOrder={["a", "b", "c", "d"]}
          />
        </SkinProvider>,
      );
    });
    const img = container.querySelector<HTMLImageElement>('img[src*="a.png"]')!;
    // 22rem = trần item mặc định của ContentImage; sàn của phép chia là 96px.
    expect(img.style.maxHeight).toBe("22rem");
    expect(img.style.maxHeight).not.toBe("96px");
  });
});
