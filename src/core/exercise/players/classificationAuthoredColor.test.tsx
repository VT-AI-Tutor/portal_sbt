/**
 * Màu nhóm tác giả khai đi TRỌN đường: payload → dispatch → player → DOM.
 *
 * Bug gốc (HĐTN 1, bài 5, câu 1): nội dung đã khai `categories[].color`
 * ("#3AAA35" / "#ED1C24") nhưng `dispatch.tsx` chỉ bốc `{id,label,imageUrl,
 * imageWidth}` sang player, nên màu chết tại đó và hai rổ luôn cùng một màu —
 * tác giả phải viết màu vào nhãn ("Thân thiện ( tô màu xanh)") để bù.
 *
 * Bài test này canh ĐÚNG chỗ đứt đó: nếu ai gỡ `color: c.color` khỏi dispatch
 * thì phần "dispatch" đỏ; nếu player thôi gắn style thì phần "render" đỏ.
 */
import { act } from "react";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { CategorizePlayer } from "./CategorizePlayer";
import { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";

const GREEN = "#3AAA35";
const RED = "#ED1C24";
const GREEN_RGB = "rgb(58, 170, 53)";
const RED_RGB = "rgb(237, 28, 36)";
/* Lưu ý: NỀN thanh tiêu đề có thể lệch một nấc so với hai hằng trên khi màu tác
   giả chưa đạt tương phản AA (#ED1C24 là một ca như vậy) — xem authoredGroupColor.
   Viền và nền khung rổ thì luôn đúng mã tác giả khai, nên mọi assert về mã màu
   chính xác bám vào viền/nền, không bám vào tiêu đề. */

// renderInteractionPlayer → GradeMode provider → AccentProvider → player.
type WrappedPlayer = React.ReactElement<{
  children: React.ReactElement<{ children: React.ReactElement<Record<string, unknown>> }>;
}>;
function playerOf(type: string, payload: unknown) {
  const rendered = renderInteractionPlayer(type, payload as never, {} as never) as WrappedPlayer;
  return rendered.props.children.props.children;
}

describe("dispatch chuyển màu tác giả sang player", () => {
  const categories = [
    { id: "than_thien", label: "Thân thiện", color: GREEN },
    { id: "khong_than_thien", label: "Không thân thiện", color: RED },
  ];
  const items = [{ id: "hv1", text: "Chào hỏi, cười với bạn" }];
  const correctAnswer = [{ itemId: "hv1", categoryId: "than_thien" }];

  it("two_bucket: `categories[].color` tới được `buckets[].color`", () => {
    const player = playerOf("classification", {
      display: { interactionType: "two_bucket" },
      categories,
      items,
      correctAnswer,
    });
    expect(player.type).toBe(TwoBucketSortPlayer);
    const buckets = player.props.buckets as Array<{ color?: string }>;
    expect(buckets[0].color).toBe(GREEN);
    expect(buckets[1].color).toBe(RED);
  });

  it("buckets (nhiều nhóm): màu tới được `categories[].color` của CategorizePlayer", () => {
    const player = playerOf("classification", { categories, items, correctAnswer });
    expect(player.type).toBe(CategorizePlayer);
    const cats = player.props.categories as Array<{ color?: string }>;
    expect(cats.map((c) => c.color)).toEqual([GREEN, RED]);
  });

  it("câu không khai màu thì `color` vẫn undefined — không bịa màu ra", () => {
    const player = playerOf("classification", {
      display: { interactionType: "two_bucket" },
      categories: [{ id: "c1", label: "A" }, { id: "c2", label: "B" }],
      items,
      correctAnswer: [{ itemId: "hv1", categoryId: "c1" }],
    });
    const buckets = player.props.buckets as Array<{ color?: string }>;
    expect(buckets[0].color).toBeUndefined();
  });
});

describe("player gắn màu tác giả lên khung rổ và thanh tiêu đề", () => {
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

  /** Mọi element có style nền inline — khung rổ và thanh tiêu đề đều nằm trong đây. */
  function inlineBackgrounds(): string[] {
    return Array.from(container.querySelectorAll<HTMLElement>("[style]"))
      .map((el) => el.style.backgroundColor)
      .filter(Boolean);
  }

  /** Thanh tiêu đề nhóm — chỗ DUY NHẤT đặt cả nền đặc lẫn màu chữ inline. */
  function headBars(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>("[style]")).filter(
      (el) => !!el.style.backgroundColor && !!el.style.color,
    );
  }

  it("two_bucket: hai rổ ra HAI màu khác nhau, không còn cùng một màu", () => {
    act(() =>
      root.render(
        <TwoBucketSortPlayer
          title="Q"
          buckets={[
            { id: "than_thien", label: "Thân thiện", color: GREEN },
            { id: "khong_than_thien", label: "Không thân thiện", color: RED },
          ]}
          items={[{ id: "hv1", text: "Chào hỏi" }]}
          correctMappings={{ hv1: "than_thien" }}
        />,
      ),
    );

    // Khung rổ giữ ĐÚNG mã tác giả khai, pha loãng làm nền.
    const bgs = inlineBackgrounds();
    expect(bgs).toContain("rgba(58, 170, 53, 0.12)");
    expect(bgs).toContain("rgba(237, 28, 36, 0.12)");
    const borders = Array.from(container.querySelectorAll<HTMLElement>("[style]")).map(
      (el) => el.style.borderColor,
    );
    expect(borders).toContain(GREEN_RGB);
    expect(borders).toContain(RED_RGB);

    // Hai thanh tiêu đề ra HAI màu khác nhau — đây là thứ trước đây KHÔNG có.
    const heads = headBars();
    expect(heads).toHaveLength(2);
    expect(heads[0].style.backgroundColor).not.toBe(heads[1].style.backgroundColor);
  });

  it("two_bucket: chữ tiêu đề đổi theo nền — xanh lá chữ đậm, đỏ chữ trắng", () => {
    act(() =>
      root.render(
        <TwoBucketSortPlayer
          title="Q"
          buckets={[
            { id: "b1", label: "Thân thiện", color: GREEN },
            { id: "b2", label: "Không thân thiện", color: RED },
          ]}
          items={[{ id: "hv1", text: "Chào hỏi" }]}
          correctMappings={{ hv1: "b1" }}
        />,
      ),
    );

    const [green, red] = headBars();
    expect(green.style.color).toBe("rgb(30, 41, 59)");
    expect(red.style.color).toBe("rgb(255, 255, 255)");
  });

  it("buckets: CategorizePlayer cũng tô theo màu tác giả, kể cả khi có 3 nhóm", () => {
    act(() =>
      root.render(
        <CategorizePlayer
          title="Q"
          categories={[
            { id: "truoc", label: "Trước", color: "#22c55e" },
            { id: "trong", label: "Trong", color: "#0ea5e9" },
            { id: "sau", label: "Sau", color: "#f59e0b" },
          ]}
          items={[{ id: "i1", text: "x" }]}
          correctMappings={{ i1: "truoc" }}
        />,
      ),
    );

    // Ba nhóm → ba thanh tiêu đề, ba màu khác nhau.
    const heads = headBars().map((el) => el.style.backgroundColor);
    expect(heads).toHaveLength(3);
    expect(new Set(heads).size).toBe(3);
    // Khung rổ giữ đúng mã tác giả khai.
    const bgs = inlineBackgrounds();
    expect(bgs).toContain("rgba(34, 197, 94, 0.12)");
    expect(bgs).toContain("rgba(14, 165, 233, 0.12)");
    expect(bgs).toContain("rgba(245, 158, 11, 0.12)");
  });

  it("KHÔNG khai màu → không có nền inline nào, giữ nguyên đường skin cũ", () => {
    act(() =>
      root.render(
        <TwoBucketSortPlayer
          title="Q"
          buckets={[
            { id: "b1", label: "A" },
            { id: "b2", label: "B" },
          ]}
          items={[{ id: "i1", text: "x" }]}
          correctMappings={{ i1: "b1" }}
        />,
      ),
    );
    expect(inlineBackgrounds()).toEqual([]);
  });

  it("chuỗi không phải màu → cũng rơi về skin, không gắn style nửa vời", () => {
    act(() =>
      root.render(
        <CategorizePlayer
          title="Q"
          categories={[{ id: "c1", label: "A", color: "xanh lá cây" }]}
          items={[{ id: "i1", text: "x" }]}
          correctMappings={{ i1: "c1" }}
        />,
      ),
    );
    expect(inlineBackgrounds()).toEqual([]);
  });
});
