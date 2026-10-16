import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionGroupPlayer } from "./QuestionGroupPlayer";
import { TwoColumnMatchPlayer } from "./TwoColumnMatchPlayer";
import { MEDIA_GROUP_TILE_MAX_HEIGHT, RichContentBlocks } from "./shared";

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
  vi.unstubAllGlobals();
});

describe("QuestionGroupPlayer", () => {
  it("renders group children in the requested responsive layout", () => {
    act(() => {
      root.render(
        <QuestionGroupPlayer
          title="Nhóm câu hỏi"
          layout="grid_2"
          children={[
            { id: "child-1", type: "single_choice", render: () => <div>Câu 1</div> },
            { id: "child-2", type: "single_choice", render: () => <div>Câu 2</div> },
          ]}
        />,
      );
    });

    const region = container.querySelector<HTMLElement>('[data-layout-region="question-group-children"]');
    expect(region?.dataset.displayLayout).toBe("grid_2");
    expect(region?.className).toContain("grid");
    expect(region?.className).toContain("sm:grid-cols-2");
    const childWrappers = region?.querySelectorAll(":scope > div");
    expect(childWrappers).toHaveLength(2);
    // Ô câu con giữ padding ĐỀU 4 cạnh (p-1.5 sm:p-2 — Owner 12/8 giảm nửa từ
    // p-3 sm:p-4): pt-0 từng làm câu con không có header (bảng/ảnh) dính sát
    // mép trên ô — xem comment tại chỗ.
    expect(childWrappers?.[0].className).toContain("p-1.5");
    expect(childWrappers?.[0].className).toContain("sm:p-2");
    expect(childWrappers?.[0].className).not.toContain("pt-0");
  });

  it("keeps supported child renders and exposes an explicit error for unsupported children", () => {
    act(() => {
      root.render(
        <QuestionGroupPlayer
          title="Nhóm câu hỏi"
          children={[
            {
              id: "child-1",
              type: "single_choice",
              render: () => <div data-testid="supported-child">Câu con đã render</div>,
            },
            {
              id: "child-2",
              type: "future_question_type",
              render: () => null,
            },
          ]}
        />,
      );
    });

    expect(container.querySelector('[data-testid="supported-child"]')).toBeTruthy();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "future_question_type",
    );
    expect(container.textContent).toContain("Cần xử lý lỗi này trước khi duyệt nhóm câu hỏi.");
  });

  it("lets a long matching child shrink within a list group", () => {
    act(() => {
      root.render(
        <QuestionGroupPlayer
          title="Nhóm câu hỏi"
          layout="list"
          children={[
            {
              id: "b2_q1",
              type: "matching",
              render: () => (
                <TwoColumnMatchPlayer
                  title="Nối"
                  leftItems={[{ id: "left", text: "a. Vì gia đình chỉ có ba mẹ con nên Hoà vừa đi học, vừa trông em bé để mẹ đi làm." }]}
                  rightItems={[{ id: "right", text: "Hoàn cảnh của bạn." }]}
                />
              ),
            },
          ]}
        />,
      );
    });

    const childWrapper = container.querySelector<HTMLElement>('[data-layout-region="question-group-children"] > div');
    const canvas = container.querySelector<HTMLElement>('[data-matching-canvas="true"]');
    const grid = canvas?.querySelector<HTMLElement>(":scope > div:last-child");
    const longChoice = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Vì gia đình chỉ có ba mẹ con"),
    );

    expect(childWrapper?.className).toContain("min-w-0");
    expect(canvas?.className).toContain("w-full");
    expect(canvas?.className).toContain("min-w-0");
    expect(canvas?.className).not.toContain("w-max");
    expect(grid?.className).toContain("grid-cols-2");
    expect(longChoice?.className).toContain("min-w-0");
    expect(longChoice?.querySelector("span.min-w-0.break-words")).not.toBeNull();
  });

  // Owner 8/8 (bai18 "Viết từ có tiếng chứa iêu hoặc ươu"): nhóm xếp LƯỚI thì
  // ảnh đề của câu con nhận trần cao qua context; xếp DỌC (list) giữ nguyên khổ.
  describe("trần cỡ ảnh cho ô con xếp lưới", () => {
    const imageChild = {
      id: "child-1",
      type: "fill_blank",
      render: () => (
        <RichContentBlocks blocks={[{ type: "image", url: "https://cdn.test/scan.webp" }]} />
      ),
    };

    it("nhóm grid_2: ảnh trong ô con bị chặn chiều cao", () => {
      act(() => {
        root.render(
          <QuestionGroupPlayer title="Nhóm" layout="grid_2" children={[imageChild]} />,
        );
      });

      const img = container.querySelector<HTMLImageElement>('img[src*="scan.webp"]');
      expect(img?.style.maxHeight).toBe(MEDIA_GROUP_TILE_MAX_HEIGHT);
    });

    // Owner 8/8 ("ưu tiên UX hơn luật tác giả", bai13 Toán 5): width % do
    // khâu sinh gán đại trà từng vô hiệu hoá trần — trong Ô LƯỚI % bị bỏ,
    // width px (icon cỡ chủ ý) vẫn thắng, ngoài lưới % giữ nguyên.
    it("nhóm lưới: width % bị bỏ (trần áp), width px vẫn thắng", () => {
      const child = (width: string) => ({
        id: "c1",
        type: "fill_blank",
        render: () => (
          <RichContentBlocks
            blocks={[{ type: "image", url: "https://cdn.test/can.webp", width }]}
          />
        ),
      });
      act(() => {
        root.render(
          <QuestionGroupPlayer title="Nhóm" layout="grid_2" children={[child("90%")]} />,
        );
      });
      let img = container.querySelector<HTMLImageElement>('img[src*="can.webp"]')!;
      expect(img.style.maxHeight).toBe(MEDIA_GROUP_TILE_MAX_HEIGHT);
      expect(img.style.maxWidth).toBe("");

      act(() => {
        root.render(
          <QuestionGroupPlayer title="Nhóm" layout="grid_2" children={[child("120px")]} />,
        );
      });
      img = container.querySelector<HTMLImageElement>('img[src*="can.webp"]')!;
      expect(img.style.maxWidth).toBe("min(120px, 100%)");
      expect(img.style.maxHeight).toBe("");
    });

    it("nhóm list: ảnh trong ô con giữ nguyên khổ (không trần)", () => {
      act(() => {
        root.render(
          <QuestionGroupPlayer title="Nhóm" layout="list" children={[imageChild]} />,
        );
      });

      const img = container.querySelector<HTMLImageElement>('img[src*="scan.webp"]');
      expect(img?.style.maxHeight).toBe("");
    });
  });
});

// Owner 8/8 (bai1 Toán 1 câu 14 — 5 ô tranh khai grid_2 thành 3 hàng): nhóm
// TOÀN ô tranh chỉ tăng cột nếu cần để không quá 2 hàng; không ép nhóm đã có
// 1 hàng xuống 2 hàng. Nhóm có ô CHỮ giữ layout tác giả.
describe("nhóm ô tranh chỉ chia lại cột khi vượt quá 2 hàng", () => {
  const picChild = (i: number) => ({
    id: `c${i}`,
    type: "fill_blank",
    render: () => (
      <RichContentBlocks blocks={[{ type: "image", url: `https://cdn.test/p${i}.webp` }]} />
    ),
  });

  it.each([
    [2, "grid_2"],
    [4, "grid_2"],
    [5, "grid_3"],
    [6, "grid_3"],
    [8, "grid_4"],
  ])("%i ô tranh → %s (tối đa 2 hàng)", (n, key) => {
    act(() => {
      root.render(
        <QuestionGroupPlayer
          title="Nhóm"
          layout="grid_2"
          pictureChildren={Array.from({ length: n }, () => true)}
          children={Array.from({ length: n }, (_, i) => picChild(i))}
        />,
      );
    });
    const region = container.querySelector<HTMLElement>(
      '[data-layout-region="question-group-children"]',
    )!;
    expect(region.dataset.displayLayout).toBe(key);
  });

  it.each([
    [3, "grid_3"],
    [5, "grid_3"],
    [6, "grid_3"],
    [4, "grid_4"],
    [5, "grid_4"],
    [7, "grid_4"],
    [8, "grid_4"],
  ] as const)(
    "%i ô tranh giữ %s khi layout tác giả đã có không quá 2 hàng",
    (n, layout) => {
      act(() => {
        root.render(
          <QuestionGroupPlayer
            title="Nhóm"
            layout={layout}
            pictureChildren={Array.from({ length: n }, () => true)}
            children={Array.from({ length: n }, (_, i) => picChild(i))}
          />,
        );
      });
      const region = container.querySelector<HTMLElement>(
        '[data-layout-region="question-group-children"]',
      )!;
      expect(region.dataset.displayLayout).toBe(layout);
      expect(region.className).toContain(
        layout === "grid_3" ? "lg:grid-cols-3" : "lg:grid-cols-4",
      );
    },
  );

  // Mirror từ studio-web PR #1105 — sàn cho nhóm tác giả CHƯA khai layout.
  it("nhóm CHƯA khai layout + ≥2 ô tranh → lên lưới", () => {
    act(() => {
      root.render(
        <QuestionGroupPlayer
          title="Nhóm"
          layout={{ key: "list", mode: "list", flow: "column", columns: 1, order: "column-major", authored: false }}
          pictureChildren={[true, true, true, false]}
          children={[0, 1, 2, 3].map((i) => picChild(i))}
        />,
      );
    });
    const region = container.querySelector<HTMLElement>(
      '[data-layout-region="question-group-children"]',
    )!;
    expect(region.dataset.displayLayout).toBe("grid_2");
  });

  it("tác giả KHAI `list` thì vẫn giữ xếp dọc (ý đồ tác giả thắng)", () => {
    act(() => {
      root.render(
        <QuestionGroupPlayer
          title="Nhóm"
          layout="list"
          pictureChildren={[true, true, true, true]}
          children={[0, 1, 2, 3].map((i) => picChild(i))}
        />,
      );
    });
    const region = container.querySelector<HTMLElement>(
      '[data-layout-region="question-group-children"]',
    )!;
    expect(region.dataset.displayLayout).toBe("list");
  });

  it("nâng grid_3 lên grid_4 khi 7 ô sẽ thành quá 2 hàng", () => {
    act(() => {
      root.render(
        <QuestionGroupPlayer
          title="Nhóm"
          layout="grid_3"
          pictureChildren={Array.from({ length: 7 }, () => true)}
          children={Array.from({ length: 7 }, (_, i) => picChild(i))}
        />,
      );
    });
    const region = container.querySelector<HTMLElement>(
      '[data-layout-region="question-group-children"]',
    )!;
    expect(region.dataset.displayLayout).toBe("grid_4");
    expect(region.className).toContain("sm:grid-cols-4");
  });

  it("nhóm có ô CHỮ giữ nguyên layout tác giả khai", () => {
    act(() => {
      root.render(
        <QuestionGroupPlayer
          title="Nhóm"
          layout="grid_2"
          children={Array.from({ length: 5 }, (_, i) => ({
            id: `t${i}`,
            type: "single_choice",
            render: () => <div>Câu {i}</div>,
          }))}
        />,
      );
    });
    const region = container.querySelector<HTMLElement>(
      '[data-layout-region="question-group-children"]',
    )!;
    expect(region.dataset.displayLayout).toBe("grid_2");
    expect(region.className).toContain("sm:grid-cols-2");
  });
});
