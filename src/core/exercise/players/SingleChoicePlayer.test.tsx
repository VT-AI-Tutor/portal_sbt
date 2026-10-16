import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DisplayLayout } from "@/core/exercise/display-layout";
import { SkinProvider } from "@/core/exercise/skin";
import { ImageChoiceSinglePlayer } from "./ImageChoiceSinglePlayer";
import { SingleChoicePlayer } from "./SingleChoicePlayer";
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

const layoutCases: [DisplayLayout, string][] = [
  ["list", "flex flex-col gap-2 sm:gap-3"],
  ["inline", "flex flex-wrap gap-2 sm:gap-3"],
  ["grid_2", "grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"],
  ["grid_4", "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3"],
];

describe("SingleChoicePlayer layout", () => {
  it.each(layoutCases)("renders the %s option layout and preserves answer reporting", (layout, expectedClassName) => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
          correctId="b"
          layout={layout}
          selfAssessment
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    const firstOption = container.querySelector<HTMLButtonElement>("button");
    expect(firstOption?.parentElement?.className).toBe(expectedClassName);
    expect(firstOption?.parentElement?.getAttribute("data-display-layout")).toBe(layout);
    expect(firstOption?.parentElement?.getAttribute("role")).toBe("radiogroup");
    expect(firstOption?.getAttribute("role")).toBe("radio");
    expect(firstOption?.getAttribute("aria-checked")).toBe("false");

    // web-own: pill chrome mọi layout — "pill không phải layout" (Owner 30/7).
    // Layout chỉ điều khiển container (assertion phía trên); option nào cũng là
    // pill bo tròn của web cũ, kèm chữ cái tham chiếu "A." — không còn nhánh
    // radio-row (chấm tròn aria-hidden + w-full) của bản port studio.
    expect(firstOption?.classList.contains("rounded-full")).toBe(true);
    expect(firstOption?.classList.contains("border-4")).toBe(true);
    expect(firstOption?.querySelector('span[aria-hidden="true"]')).toBeFalsy();
    // Id "a" là marker-shaped (#660) nên chữ cái in ra giữ nguyên case: "a.".
    expect(firstOption?.textContent).toContain("a.");

    act(() => firstOption?.click());
    expect(onAnswerChange).toHaveBeenLastCalledWith("a");
    expect(firstOption?.getAttribute("aria-checked")).toBe("true");
  });

  it("defaults to a vertical list", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
          correctId="b"
        />,
      );
    });

    const firstOption = container.querySelector<HTMLButtonElement>("button");
    expect(firstOption?.parentElement?.className).toBe("flex flex-col gap-2 sm:gap-3");
    // web-own: payload P01 không khai display.layout (default "list") vẫn phải
    // ra pill bo tròn — "pill không phải layout" (Owner 30/7).
    expect(firstOption?.classList.contains("rounded-full")).toBe(true);
    expect(firstOption?.classList.contains("border-4")).toBe(true);
  });

  // Cùng luật pictureLedChoices với MultiChoicePlayer (Owner 8/8): toàn thẻ
  // tranh (ảnh + nhãn ngắn) mà layout là list mặc định → lưới 2 cột.
  it("upgrades picture cards with short labels to grid_2", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Chọn tranh"
          layout="list"
          options={[
            { id: "a", imageUrl: "/a.png", text: "1" },
            { id: "b", imageUrl: "/b.png", text: "2" },
          ]}
          correctId="a"
        />,
      );
    });
    const group = container.querySelector<HTMLElement>("[data-display-layout]")!;
    expect(group.dataset.displayLayout).toBe("grid_2");
    expect(group.className).toContain("sm:grid-cols-2");
  });

  it("caps the pill radius for an image option so it never clips the picture", () => {
    // Skin "playful" (surface Học sinh) KHÔNG khai optionCard → dùng pill mặc
    // định (nhánh có bug rounded-full). studioSkin mặc định của QA đã bo rounded-xl.
    act(() => {
      root.render(
        <SkinProvider skin="playful">
          <SingleChoicePlayer
            title="Chọn hình"
            options={[{ id: "a", imageUrl: "/a.png", text: "A" }, { id: "b", text: "Hai" }]}
            correctId="a"
            layout="grid_4"
          />
        </SkinProvider>,
      );
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    // Option mang ảnh: bán kính CÓ GIỚI HẠN (rounded-3xl), không phải rounded-full
    // — nếu không pill phình thành bầu dục khổng lồ bo góc ăn vào ảnh.
    expect(buttons[0].classList.contains("rounded-3xl")).toBe(true);
    expect(buttons[0].classList.contains("rounded-full")).toBe(false);
    // Option chữ ngắn vẫn là pill bo tròn như cũ.
    expect(buttons[1].classList.contains("rounded-full")).toBe(true);
  });

  it("rehydrates parent answer changes, keeps local input responsive, and hydrates on remount", () => {
    const renderPlayer = (answer: string) => {
      act(() => {
        root.render(
          <SingleChoicePlayer
            title="Chọn đáp án"
            options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
            correctId="b"
            answer={answer}
            selfAssessment
          />,
        );
      });
    };

    renderPlayer("a");
    let options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);

    renderPlayer("b");
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["false", "true"]);

    act(() => options[0].click());
    renderPlayer("b");
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);

    act(() => root.unmount());
    root = createRoot(container);
    renderPlayer("b");
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["false", "true"]);
  });

  it.each(["submitted", "disabled"] as const)("locks interaction when %s", (lockMode) => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
          correctId="b"
          answer="a"
          selfAssessment
          submitted={lockMode === "submitted"}
          disabled={lockMode === "disabled"}
          onAnswerChange={onAnswerChange}
        />,
      );
    });

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options.every((option) => option.disabled)).toBe(true);
    act(() => options[1].click());
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    expect(onAnswerChange).not.toHaveBeenCalled();
  });

  it('keeps image geometry and radio semantics in an inline flow', () => {
    act(() => {
      root.render(
        <ImageChoiceSinglePlayer
          title="Chọn hình"
          options={[{ id: 'a', imageUrl: '/a.png', text: 'A' }]}
          correctId="a"
          layout="inline"
        />,
      );
    });

    const group = container.querySelector<HTMLElement>('[role="radiogroup"]');
    const option = group?.querySelector<HTMLButtonElement>('[role="radio"]');
    expect(group?.dataset.displayLayout).toBe('inline');
    // Ảnh phương án nằm trong HỘP CAO CỐ ĐỊNH + object-contain (PR chặn cỡ ảnh
    // phương án): không còn w-full/aspect-square vốn làm ảnh phình theo bề rộng ô.
    const img = option?.querySelector('img');
    expect(img?.classList.contains('object-contain')).toBe(true);
    expect(img?.classList.contains('max-h-full')).toBe(true);
    expect(img?.classList.contains('aspect-square')).toBe(false);
    expect(img?.parentElement?.className).toContain('h-40');
  });

  it('keeps button geometry and radio semantics in a four-column grid', () => {
    act(() => {
      root.render(
        <TileSelectPlayer
          title="Chọn nút"
          options={[{ id: 'a', text: 'A' }]}
          correctId="a"
          layout="grid_4"
        />,
      );
    });

    const group = container.querySelector<HTMLElement>('[role="radiogroup"]');
    const option = group?.querySelector<HTMLButtonElement>('[role="radio"]');
    expect(group?.classList.contains('lg:grid-cols-4')).toBe(true);
    expect(option?.className).toContain('min-h-[96px]');
  });
});

describe("SingleChoicePlayer self-graded wrong state", () => {
  it("shows the wrong notation on an incorrect pick and recovers on the correct one", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
          correctId="a"
          variant="circle"
        />,
      );
    });

    let options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    act(() => options[1].click()); // wrong pick — self-graded immediately
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options[1].className).toContain("text-red-600");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    // The correct answer must not be leaked while the pupil can still retry.
    expect(options[0].className).not.toContain("text-green");

    act(() => options[0].click()); // correct pick — success clears the wrong state
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(options[0].className).toContain("text-green-700");
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
  });

  it("keeps the selection mounted when the parent echoes the reported answer back", () => {
    const renderPlayer = (answer?: string) => {
      act(() => {
        root.render(
          <SingleChoicePlayer
            title="Chọn đáp án"
            options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
            correctId="b"
            variant="circle"
            answer={answer}
            selfAssessment
          />,
        );
      });
    };

    renderPlayer(undefined);
    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    act(() => options[1].click());

    // Host stores the reported answer and passes it back down — the selection
    // must NOT remount (a remount replays the circle draw animation).
    renderPlayer("b");
    const optionsAfter = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(optionsAfter[1]).toBe(options[1]);
    expect(optionsAfter[1].getAttribute("aria-checked")).toBe("true");

    // A semantically different parent answer still rehydrates.
    renderPlayer("a");
    const rehydrated = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(rehydrated.map((option) => option.getAttribute("aria-checked"))).toEqual(["true", "false"]);
  });
});

describe("SingleChoicePlayer multi-paragraph option content (#506)", () => {
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

  it.each(["inline", "grid_2"] as const)(
    "keeps an option's paragraphs in vertical block flow (%s layout)",
    (layout) => {
      act(() => {
        root.render(
          <SingleChoicePlayer
            title="Chọn đáp án"
            options={[multiParagraphOption, { id: "b", text: "Hai" }]}
            correctId="a"
            layout={layout}
            selfAssessment
          />,
        );
      });

      const option = container.querySelector<HTMLButtonElement>('[role="radio"]');
      const paragraphs = option?.querySelectorAll("p");
      expect(paragraphs?.length).toBe(3);
      // Every paragraph shares one content wrapper instead of becoming a direct
      // flex item of the option button — that horizontal split was the bug.
      const wrapper = paragraphs?.[0].parentElement;
      expect(wrapper).not.toBe(option);
      expect(paragraphs?.[1].parentElement).toBe(wrapper);
      expect(paragraphs?.[2].parentElement).toBe(wrapper);
      expect(option?.querySelectorAll(":scope > p").length).toBe(0);
    },
  );
});

describe("SingleChoicePlayer circle interaction", () => {
  it.each(["list", "inline"] as const)(
    "draws an animated circle around the option letter (%s layout)",
    (layout) => {
      act(() => {
        root.render(
          <SingleChoicePlayer
            title="Khoanh tròn"
            // Ids are the letters printed in the book (corpus convention) —
            // since issue #660 the marker shows the data letter verbatim, so
            // an arbitrary lowercase id would render "a", not "A".
            options={[{ id: "A", text: "Một" }, { id: "B", text: "Hai" }]}
            correctId="B"
            variant="circle"
            layout={layout}
            selfAssessment
          />,
        );
      });

      const firstOption = container.querySelector<HTMLButtonElement>("button");
      // The letter marker renders a single <path> (the hand-drawn circle traced
      // from 12 o'clock — see CircleLetterMarker) with the letter.
      expect(firstOption?.querySelector("svg path")).toBeTruthy();
      expect(firstOption?.textContent).toContain("A");
      // Circle variant does not print the "A." radio-style label.
      expect(firstOption?.textContent).not.toContain("A.");
    },
  );
});

describe("SingleChoicePlayer color_fill interaction", () => {
  it.each(["list", "inline"] as const)(
    "floods the whole card with the accent on pick, no marker or letter (%s layout)",
    (layout) => {
      act(() => {
        root.render(
          <SingleChoicePlayer
            title="Tô màu đáp án"
            options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
            correctId="b"
            variant="color_fill"
            layout={layout}
            selfAssessment
          />,
        );
      });

      let firstOption = container.querySelector<HTMLButtonElement>('[role="radio"]');
      // No circle stroke, no radio dot, no generated "A." label — the whole card
      // is the mark. It carries the crayon-shine sweep layer.
      expect(firstOption?.querySelector("svg path")).toBeFalsy();
      expect(firstOption?.textContent).toBe("Một");
      expect(firstOption?.querySelector('[class*="skew-x"]')).toBeTruthy();
      // Idle → no inline fill.
      expect(firstOption?.style.backgroundColor).toBe("");

      act(() => firstOption?.click());
      firstOption = container.querySelector<HTMLButtonElement>('[role="radio"]');
      // Selected → whole card flooded with the single-choice blue (#3b82f6),
      // white text, white border.
      expect(firstOption?.style.backgroundColor).toBe("rgb(59, 130, 246)");
      expect(firstOption?.style.borderColor).toBe("rgb(255, 255, 255)");
      expect(firstOption?.className).toContain("text-white");
    },
  );

  it("floods the picked card by grade (wrong red → correct green)", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Tô màu đáp án"
          options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
          correctId="a"
          variant="color_fill"
        />,
      );
    });

    let options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    act(() => options[1].click()); // wrong pick — self-graded immediately
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    // The wrong card is flooded red (#ef4444).
    expect(options[1].style.backgroundColor).toBe("rgb(239, 68, 68)");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
    // The correct answer must not be leaked (no fill) while the pupil can retry.
    expect(options[0].style.backgroundColor).toBe("");

    act(() => options[0].click()); // correct pick — success clears the wrong state
    options = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    // The correct card is flooded green (#22c55e).
    expect(options[0].style.backgroundColor).toBe("rgb(34, 197, 94)");
  });

  it("colours the card with the crayon picked from the palette", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Tô màu đáp án"
          options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
          correctId="a"
          variant="color_fill"
          selfAssessment
        />,
      );
    });

    const palette = container.querySelector('[data-color-fill-palette]');
    const crayons = Array.from(palette!.querySelectorAll<HTMLButtonElement>("button"));
    expect(crayons).toHaveLength(5);
    // Blue leads the tray and is pressed by default, so an untouched question
    // still fills in the single-choice accent.
    expect(crayons[0].getAttribute("aria-pressed")).toBe("true");
    // The palette is NOT a second radio group — the option cards own that role.
    expect(palette!.querySelectorAll('[role="radio"]')).toHaveLength(0);

    act(() => crayons[1].click()); // hồng #ec4899
    expect(crayons[1].getAttribute("aria-pressed")).toBe("true");
    expect(crayons[0].getAttribute("aria-pressed")).toBe("false");

    act(() => container.querySelector<HTMLButtonElement>('[role="radio"]')?.click());
    const firstOption = container.querySelector<HTMLButtonElement>('[role="radio"]');
    expect(firstOption?.style.backgroundColor).toBe("rgb(236, 72, 153)");
    // Re-picking with another crayon repaints the same card.
    act(() => crayons[3].click()); // xanh ngọc #14b8a6
    act(() => container.querySelector<HTMLButtonElement>('[role="radio"]')?.click());
    expect(container.querySelector<HTMLButtonElement>('[role="radio"]')?.style.backgroundColor).toBe(
      "rgb(20, 184, 166)",
    );
  });

  it("forces the label to inherit the fill's white on a coloured card", () => {
    act(() => {
      root.render(
        <SingleChoicePlayer
          title="Tô màu đáp án"
          options={[
            { id: "a", content: { blocks: [{ type: "paragraph", text: "Một" }] } },
            { id: "b", text: "Hai" },
          ]}
          correctId="a"
          variant="color_fill"
          selfAssessment
        />,
      );
    });

    let firstOption = container.querySelector<HTMLButtonElement>('[role="radio"]');
    expect(firstOption?.className).not.toContain("[&_*]:text-inherit");
    act(() => firstOption?.click());
    firstOption = container.querySelector<HTMLButtonElement>('[role="radio"]');
    // Rich-content option text is painted by the skin's `body` class
    // web-own: default skin của web là playful RỖNG (không có skin.body như
    // studio) → <p> nhận fallback "text-slate-800" của shared.tsx thay vì
    // text-slate-500 của studioSkin. Without this override the grey label
    // sat on the saturated fill and read as blank.
    expect(firstOption?.querySelector("p")?.className).toContain("text-slate-800");
    expect(firstOption?.className).toContain("[&_*]:text-inherit");
  });
});
