/**
 * web-own: bộ test khoá VISUAL của repo này (pill mọi layout, inline flow…) —
 * bản studio khẳng định hình dạng studio-skin nên sẽ đỏ dưới playfulAccentSkin.
 * Mục B của checklist WEB-OWN PATCHES (apps/learner/scripts/detokenize-players.mjs)
 * liệt kê file này; KHÔNG copy đè từ studio, chỉ ghép tay từng `it()` mới.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DisplayLayout } from "@/core/exercise/display-layout";
import { ImageChoiceMultiPlayer } from "./ImageChoiceMultiPlayer";
import { MultiChoicePlayer } from "./MultiChoicePlayer";
import { TileSelectPlayer } from "./TileSelectPlayer";

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

function pressOption(option: HTMLButtonElement, key: " " | "Enter") {
  act(() => {
    option.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

function expectKeyboardSelection() {
  const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
  expect(options).toHaveLength(2);
  expect(options[0].getAttribute("aria-checked")).toBe("false");
  expect(options[0].tabIndex).toBe(0);
  expect(options[0].textContent).not.toContain("✓");

  pressOption(options[0], " ");
  expect(options[0].getAttribute("aria-checked")).toBe("true");
  expect(options[0].textContent).toContain("✓");

  pressOption(options[0], "Enter");
  expect(options[0].getAttribute("aria-checked")).toBe("false");
}

const layoutCases: [DisplayLayout, string][] = [
  ["list", "flex flex-col gap-2 sm:gap-3"],
  ["inline", "flex flex-wrap gap-2 sm:gap-3"],
  ["grid_2", "grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"],
  ["grid_4", "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3"],
];

describe("multi-select players", () => {
  it("exposes checkbox keyboard UX for text options", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctIds={["a"]}
        />,
      );
    });

    expectKeyboardSelection();
  });

  it("exposes checkbox keyboard UX for image options", () => {
    act(() => {
      root.render(
        <ImageChoiceMultiPlayer
          title="Chọn hình"
          options={[
            { id: "a", imageUrl: "/a.png", text: "A" },
            { id: "b", imageUrl: "/b.png", text: "B" },
          ]}
          correctIds={["a"]}
        />,
      );
    });

    expectKeyboardSelection();
  });

  it.each(layoutCases)("renders the %s option layout and preserves selection", (layout, expectedClassName) => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctIds={["a"]}
          layout={layout}
        />,
      );
    });

    const firstOption = container.querySelector<HTMLButtonElement>('[role="checkbox"]');
    expect(firstOption?.parentElement?.className).toBe(expectedClassName);
    expect(firstOption?.parentElement?.getAttribute("data-display-layout")).toBe(layout);
    expect(firstOption?.parentElement?.getAttribute("role")).toBe("group");

    act(() => firstOption?.click());
    expect(firstOption?.getAttribute("aria-checked")).toBe("true");
  });

  it("defaults to a vertical list", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctIds={["a"]}
        />,
      );
    });

    const firstOption = container.querySelector<HTMLButtonElement>('[role="checkbox"]');
    expect(firstOption?.parentElement?.className).toBe("flex flex-col gap-2 sm:gap-3");
  });

  it("renders picture-only checkbox options as a compact two-column grid", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chá»n tranh"
          layout="list"
          options={[
            { id: "a", imageUrl: "/a.png" },
            { id: "b", imageUrl: "/b.png" },
            { id: "c", imageUrl: "/c.png" },
            { id: "d", imageUrl: "/d.png" },
          ]}
          correctIds={["a"]}
        />,
      );
    });

    const group = container.querySelector<HTMLElement>("[data-display-layout]")!;
    expect(group.dataset.displayLayout).toBe("grid_2");
    expect(group.className).toContain("sm:grid-cols-2");
    const option = container.querySelector<HTMLElement>('[role="checkbox"]')!;
    expect(option.className).toContain("w-full");
    expect(option.className).toContain("flex-col");
    expect(option.querySelector("img")!.className).toContain("!max-h-40");
    const marker = option.querySelector<HTMLElement>('[aria-hidden="true"]')!;
    expect(marker.className).toContain("absolute");
    expect(marker.className).toContain("z-10");
    expect(marker.className).toContain("pointer-events-none");
  });

  // Owner 8/8 (câu "tô màu những tranh thể hiện quyền trẻ em"): nhãn NGẮN
  // ("1", "2") cạnh ảnh không làm thẻ mất tư cách thẻ tranh — vẫn nâng lưới 2
  // cột.
  //
  // Owner 10/8 (ca `79921326/bai31`): nới mốc lên 80 ký tự — thẻ tranh đã render
  // chrome DỌC (ảnh trên, chữ dưới) nên "ảnh + một dòng mô tả" vẫn là thẻ tranh.
  // Chỉ ĐOẠN VĂN thật (>80) mới giữ list full-width để đọc.
  it("upgrades picture cards with short labels to grid_2 but keeps long captions in list", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Tô màu tranh"
          layout="list"
          variant="color_fill"
          options={[
            { id: "a", imageUrl: "/a.png", text: "1" },
            { id: "b", imageUrl: "/b.png", text: "2" },
          ]}
          correctIds={["a"]}
        />,
      );
    });
    expect(
      container.querySelector<HTMLElement>("[data-display-layout]")!.dataset.displayLayout,
    ).toBe("grid_2");

    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn tranh"
          layout="list"
          options={[
            {
              id: "a",
              imageUrl: "/a.png",
              text: "Có nắng chói chang rực rỡ chiếu xuống sân trường, cây bàng già rợp bóng mát cả một góc.",
            },
            {
              id: "b",
              imageUrl: "/b.png",
              text: "Có cây bàng rợp bóng mát, lũ trẻ ngồi chơi dưới gốc suốt cả buổi chiều hè oi ả.",
            },
          ]}
          correctIds={["a"]}
        />,
      );
    });
    expect(
      container.querySelector<HTMLElement>("[data-display-layout]")!.dataset.displayLayout,
    ).toBe("list");

    // Ca thật `79921326/bai31`: ảnh + một dòng mô tả 19–44 ký tự. Trước 10/8
    // rơi vào "list" và thành 6 hàng × 384px = 4,6 màn cuộn.
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Đánh dấu biện pháp"
          layout="list"
          options={[
            { id: "a", imageUrl: "/a.png", text: "1. Thu gom rác thải" },
            { id: "b", imageUrl: "/b.png", text: "2. Quét dọn sân chơi, khu sinh hoạt chung" },
          ]}
          correctIds={["a"]}
        />,
      );
    });
    expect(
      container.querySelector<HTMLElement>("[data-display-layout]")!.dataset.displayLayout,
    ).toBe("grid_2");
  });

  // bai9_q2 (Đạo đức 4): tác giả khai display.layout="inline" cho câu toàn thẻ
  // tranh — inline là bố cục pill CHỮ, flex-wrap với ảnh natural-size thành mỗi
  // thẻ tràn một hàng. Thẻ tranh + inline cũng nâng grid_2; grid tác giả giữ.
  it("upgrades authored inline to grid_2 for picture cards but keeps authored grids", () => {
    const pictureOpts = [
      {
        id: "1",
        text: "Tranh 1",
        imageUrl: "/t1.png",
        content: {
          blocks: [
            { type: "image", url: "/t1.png" },
            { type: "paragraph", content: [{ text: "Tranh 1", annotations: {} }] },
          ],
        },
      },
      {
        id: "2",
        text: "Tranh 2",
        imageUrl: "/t2.png",
        content: {
          blocks: [
            { type: "image", url: "/t2.png" },
            { type: "paragraph", content: [{ text: "Tranh 2", annotations: {} }] },
          ],
        },
      },
    ];
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn tranh"
          layout="inline"
          options={pictureOpts}
          correctIds={["1"]}
        />,
      );
    });
    expect(
      container.querySelector<HTMLElement>("[data-display-layout]")!.dataset.displayLayout,
    ).toBe("grid_2");

    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn tranh"
          layout="grid_3"
          options={pictureOpts}
          correctIds={["1"]}
        />,
      );
    });
    expect(
      container.querySelector<HTMLElement>("[data-display-layout]")!.dataset.displayLayout,
    ).toBe("grid_3");
  });

  it("rehydrates parent answer changes, keeps local input responsive, and hydrates on remount", () => {
    const renderPlayer = (answer: string[]) => {
      act(() => {
        root.render(
          <MultiChoicePlayer
            title="Chọn đáp án"
            options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
            correctIds={["a"]}
            answer={answer}
            selfAssessment
          />,
        );
      });
    };

    renderPlayer(["a"]);
    let options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);

    renderPlayer(["b"]);
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["false", "true"]);

    act(() => options[0].click());
    renderPlayer(["b"]);
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "true"]);

    act(() => root.unmount());
    root = createRoot(container);
    renderPlayer(["b"]);
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["false", "true"]);
  });

  it.each(["submitted", "disabled"] as const)("locks interaction when %s", (lockMode) => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctIds={["b"]}
          answer={["a"]}
          selfAssessment
          submitted={lockMode === "submitted"}
          disabled={lockMode === "disabled"}
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(options.every((option) => option.disabled && option.tabIndex === -1)).toBe(true);
    act(() => options[1].click());
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    expect(onAnswerChange).not.toHaveBeenCalled();
  });

  it('keeps image geometry and checkbox semantics in an inline flow', () => {
    act(() => {
      root.render(
        <ImageChoiceMultiPlayer
          title="Chọn hình"
          options={[{ id: 'a', imageUrl: '/a.png', text: 'A' }]}
          correctIds={['a']}
          layout="inline"
        />,
      );
    });

    const group = container.querySelector<HTMLElement>('[role="group"]');
    const option = group?.querySelector<HTMLButtonElement>('[role="checkbox"]');
    expect(group?.dataset.displayLayout).toBe('inline');
    // Ảnh phương án nằm trong HỘP CAO CỐ ĐỊNH + object-contain (PR chặn cỡ ảnh
    // phương án): không còn w-full/aspect-square vốn làm ảnh phình theo bề rộng ô.
    const img = option?.querySelector('img');
    expect(img?.classList.contains('object-contain')).toBe(true);
    expect(img?.classList.contains('max-h-full')).toBe(true);
    expect(img?.classList.contains('aspect-square')).toBe(false);
    expect(img?.parentElement?.className).toContain('h-40');
  });

  it("shows the wrong notation after the in-player Kiểm tra and clears it on retry", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctIds={["a"]}
          variant="circle"
          // Đường CŨ (chấm bằng nút "Kiểm tra") — vẫn dùng khi host tắt chấm ngay.
          instantFeedback={false}
        />,
      );
    });

    let options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    act(() => options[1].click()); // wrong pick
    const checkButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Kiểm tra",
    );
    act(() => checkButton?.click());

    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(options[1].className).toContain("text-red-600");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    // The correct answer must not be leaked while the pupil can still retry.
    expect(options[0].className).not.toContain("text-green");

    // Changing the picks clears the wrong state for the retry.
    act(() => options[1].click());
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(options[1].className).not.toContain("text-red-600");
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
  });

  it("keeps the selection mounted when the parent echoes the reported answer back", () => {
    const renderPlayer = (answer?: string[]) => {
      act(() => {
        root.render(
          <MultiChoicePlayer
            title="Chọn đáp án"
            options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
            correctIds={["a"]}
            variant="circle"
            answer={answer}
          />,
        );
      });
    };

    renderPlayer(undefined);
    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    act(() => options[1].click());

    // Host stores the reported answer and passes it back down — the selection
    // must NOT remount (a remount replays the circle draw animation).
    renderPlayer(["b"]);
    const optionsAfter = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(optionsAfter[1]).toBe(options[1]);
    expect(optionsAfter[1].getAttribute("aria-checked")).toBe("true");

    // A semantically different parent answer still rehydrates.
    renderPlayer(["a"]);
    const rehydrated = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(rehydrated.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);
  });

  it.each(["inline", "grid_2"] as const)(
    "keeps an option's paragraphs in vertical block flow (%s layout) (#506)",
    (layout) => {
      const multiParagraphOption = {
        id: "a",
        content: {
          blocks: [
            { type: "paragraph" as const, text: "Quả cầu vừa tung lên" },
            { type: "paragraph" as const, text: "Ai nấy đều náo nức" },
            { type: "paragraph" as const, text: "Niềm vui trên sân trường" },
          ],
        },
      };
      act(() => {
        root.render(
          <MultiChoicePlayer
            title="Chọn đáp án"
            options={[multiParagraphOption, { id: "b", text: "B" }]}
            correctIds={["a"]}
            layout={layout}
          />,
        );
      });

      const option = container.querySelector<HTMLButtonElement>('[role="checkbox"]');
      const paragraphs = option?.querySelectorAll("p");
      expect(paragraphs?.length).toBe(3);
      // Every paragraph shares one content wrapper instead of becoming a direct
      // flex item of the always-flex option button — that horizontal split was
      // the bug.
      const wrapper = paragraphs?.[0].parentElement;
      expect(wrapper).not.toBe(option);
      expect(paragraphs?.[1].parentElement).toBe(wrapper);
      expect(paragraphs?.[2].parentElement).toBe(wrapper);
      expect(option?.querySelectorAll(":scope > p").length).toBe(0);
    },
  );

  it('keeps multiple button semantics in a two-column grid', () => {
    act(() => {
      root.render(
        <TileSelectPlayer
          title="Chọn các nút"
          options={[{ id: 'a', text: 'A' }]}
          correctId=""
          multiple
          correctIds={['a']}
          layout="grid_2"
        />,
      );
    });

    const group = container.querySelector<HTMLElement>('[role="group"]');
    const option = group?.querySelector<HTMLButtonElement>('[role="checkbox"]');
    expect(group?.classList.contains('sm:grid-cols-2')).toBe(true);
    expect(option?.getAttribute('aria-checked')).toBe('false');
  });
});

describe("MultiChoicePlayer color_fill interaction", () => {
  it.each(["list", "inline"] as const)(
    "floods the picked card with the purple accent, no glyph or letter (%s layout)",
    (layout) => {
      act(() => {
        root.render(
          <MultiChoicePlayer
            title="Tô màu đáp án"
            options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
            correctIds={["a"]}
            variant="color_fill"
            layout={layout}
            // Chấm ngay TẮT: ca này soi màu bút lúc MỚI chọn (chưa có verdict).
            // Từ 4/8 color_fill chấm ngay như mọi biến thể khác nên nếu bật,
            // cú click đầu đã thành verdict xanh/đỏ — xem ColorFillInstant.test.
            instantFeedback={false}
          />,
        );
      });

      let firstOption = container.querySelector<HTMLButtonElement>('[role="checkbox"]');
      // No circle stroke, no "✓" checkbox glyph, no generated "A." label — the
      // whole card is the mark, with the crayon-shine sweep layer.
      expect(firstOption?.querySelector("svg path")).toBeFalsy();
      expect(firstOption?.textContent).toBe("A");
      expect(firstOption?.querySelector('[class*="skew-x"]')).toBeTruthy();
      expect(firstOption?.style.backgroundColor).toBe("");

      act(() => firstOption?.click());
      firstOption = container.querySelector<HTMLButtonElement>('[role="checkbox"]');
      // Selected → flooded with the multiple-choice purple (#a855f7), distinct
      // from single-choice blue; white text, white border.
      expect(firstOption?.style.backgroundColor).toBe("rgb(168, 85, 247)");
      expect(firstOption?.style.borderColor).toBe("rgb(255, 255, 255)");
      expect(firstOption?.className).toContain("text-white");
    },
  );

  it("floods the picked card red after Kiểm tra grades it wrong", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Tô màu đáp án"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctIds={["a"]}
          variant="color_fill"
          // Ca này là đường "Kiểm tra" — chấm ngay phải TẮT thì nút mới có.
          instantFeedback={false}
        />,
      );
    });

    let options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    act(() => options[1].click()); // wrong pick
    const checkButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Kiểm tra",
    );
    act(() => checkButton?.click());

    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    // The wrong card is flooded red (#ef4444).
    expect(options[1].style.backgroundColor).toBe("rgb(239, 68, 68)");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    // The correct answer must not be leaked (no fill) while the pupil can retry.
    expect(options[0].style.backgroundColor).toBe("");
  });

  it("colours each card with the crayon held when it was tapped", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Tô màu đáp án"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctIds={["a"]}
          variant="color_fill"
          selfAssessment
        />,
      );
    });

    const crayons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-color-fill-palette] button'),
    );
    // Purple closes the tray and is pressed by default, keeping the
    // multiple-choice accent for an untouched question.
    expect(crayons).toHaveLength(5);
    expect(crayons[4].getAttribute("aria-pressed")).toBe("true");

    const options = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    act(() => options()[0].click()); // purple
    act(() => crayons[2].click()); // vàng cam #f59e0b
    act(() => options()[1].click());
    // Each card keeps the colour it was filled with — the tray is per-tap, not
    // a global repaint.
    expect(options()[0].style.backgroundColor).toBe("rgb(168, 85, 247)");
    expect(options()[1].style.backgroundColor).toBe("rgb(245, 158, 11)");
    expect(options()[0].getAttribute("aria-checked")).toBe("true");
  });

  it("recolours an already-picked card instead of unpicking it", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Tô màu đáp án"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctIds={["a"]}
          variant="color_fill"
          selfAssessment
        />,
      );
    });

    const crayons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[data-color-fill-palette] button'),
    );
    const options = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));

    act(() => options()[0].click()); // picked, purple
    act(() => crayons[1].click()); // switch to hồng #ec4899
    act(() => options()[0].click()); // colouring over, NOT unpicking
    expect(options()[0].getAttribute("aria-checked")).toBe("true");
    expect(options()[0].style.backgroundColor).toBe("rgb(236, 72, 153)");

    act(() => options()[0].click()); // same crayon again → toggles the pick off
    expect(options()[0].getAttribute("aria-checked")).toBe("false");
    expect(options()[0].style.backgroundColor).toBe("");
  });


  // Thẻ tranh trong lưới dùng chrome DỌC + ảnh cap — hàng flex ngang với ảnh
  // shrink-0 từng tràn khỏi thẻ (bai9_q2).
  it("renders labelled picture cards vertically with a capped image (no overflow row)", () => {
    act(() => {
      root.render(
        <MultiChoicePlayer
          title="Chọn tranh"
          layout="inline"
          options={[
            { id: "1", text: "Tranh 1", imageUrl: "/t1.png" },
            { id: "2", text: "Tranh 2", imageUrl: "/t2.png" },
          ]}
          correctIds={["1"]}
        />,
      );
    });
    const option = container.querySelector<HTMLElement>('[role="checkbox"]')!;
    expect(option.className).toContain("flex-col");
    expect(option.querySelector("img")!.className).toContain("!max-h-40");
  });
});
