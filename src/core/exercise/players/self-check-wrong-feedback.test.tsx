/**
 * "Wrong answer must never be silent" — self-graded wrong checks must show the
 * red notation + the uniform red feedback line, and recordOnly questions
 * (selfAssessment / no key) must not grade at all (no Kiểm tra button, no red).
 * Sibling coverage for TrueFalse/YesNo lives in their own test files.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkinProvider } from "@/core/exercise/skin";
import { TileSelectPlayer } from "./TileSelectPlayer";
import { DropdownSelectPlayer } from "./DropdownSelectPlayer";
import { ImageChoiceSinglePlayer } from "./ImageChoiceSinglePlayer";
import { ImageChoiceMultiPlayer } from "./ImageChoiceMultiPlayer";
import { LikertPlayer } from "./LikertPlayer";
import { SemanticDifferentialPlayer } from "./SemanticDifferentialPlayer";
import { StarRatingPlayer } from "./StarRatingPlayer";
import { ConfidenceSliderPlayer } from "./ConfidenceSliderPlayer";
import { NumericSliderPlayer } from "./NumericSliderPlayer";

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

const FEEDBACK = "Chưa đúng, thử lại nhé!";

function checkButton(): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Kiểm tra",
  );
}

describe("TileSelectPlayer (single) self-check feedback", () => {
  it("shows the red tile and feedback line right after a wrong click-graded pick", () => {
    act(() => {
      root.render(
        <TileSelectPlayer
          title="Chọn nút"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctId="a"
        />,
      );
    });

    let tiles = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    act(() => tiles[1].click()); // wrong

    tiles = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(tiles[1].className).toContain("bg-red-50");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);
    // The correct tile must not be leaked while the pupil can still retry.
    expect(tiles[0].className).not.toContain("bg-green-50");
  });

  it("stays silent (recordOnly) when there is no answer key", () => {
    act(() => {
      root.render(
        <TileSelectPlayer
          title="Chọn nút"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctId=""
        />,
      );
    });

    const tiles = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    act(() => tiles[1].click());
    expect(tiles[1].className).not.toContain("bg-red-50");
    expect(container.textContent).not.toContain(FEEDBACK);
  });
});

describe("DropdownSelectPlayer self-check feedback", () => {
  const pick = (value: string) => {
    const select = container.querySelector("select")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    act(() => {
      setter.call(select, value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };

  it("shows the red select state and feedback line right after a wrong pick", () => {
    act(() => {
      root.render(
        <DropdownSelectPlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctId="a"
        />,
      );
    });

    pick("b"); // wrong
    expect(container.querySelector("select")?.className).toContain("text-red-600");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);

    // A new pick re-reports and replaces the wrong state.
    pick("a");
    expect(container.querySelector("select")?.className).not.toContain("text-red-600");
    expect(container.textContent).not.toContain(FEEDBACK);
  });

  it("stays silent (recordOnly) for selfAssessment picks", () => {
    act(() => {
      root.render(
        <DropdownSelectPlayer
          title="Chọn đáp án"
          options={[{ id: "a", text: "A" }, { id: "b", text: "B" }]}
          correctId="a"
          selfAssessment
        />,
      );
    });

    pick("b");
    expect(container.querySelector("select")?.className).not.toContain("text-red-600");
    expect(container.textContent).not.toContain(FEEDBACK);
  });
});

describe("ImageChoiceSinglePlayer self-check feedback", () => {
  it("shows the red card and feedback line right after a wrong click-graded pick", () => {
    act(() => {
      root.render(
        <ImageChoiceSinglePlayer
          title="Chọn hình"
          options={[
            { id: "a", imageUrl: "/a.png", text: "A" },
            { id: "b", imageUrl: "/b.png", text: "B" },
          ]}
          correctId="a"
        />,
      );
    });

    let cards = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    act(() => cards[1].click()); // wrong

    cards = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(cards[1].className).toContain("bg-red-50");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);
    expect(cards[0].className).not.toContain("bg-green-50");
  });
});

describe("ImageChoiceMultiPlayer button-path self-check feedback", () => {
  it("shows the red card + line after a wrong Kiểm tra and clears it on retry", () => {
    act(() => {
      root.render(
        <ImageChoiceMultiPlayer
          title="Chọn hình"
          options={[
            { id: "a", imageUrl: "/a.png", text: "A" },
            { id: "b", imageUrl: "/b.png", text: "B" },
          ]}
          correctIds={["a"]}
          instantFeedback={false}
        />,
      );
    });

    let cards = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    act(() => cards[1].click()); // wrong pick
    act(() => checkButton()?.click());

    cards = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(cards[1].className).toContain("bg-red-50");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);
    // The correct card must not be leaked while the pupil can still retry.
    expect(cards[0].className).not.toContain("bg-green-50");

    // Changing the picks clears the wrong state for the retry.
    act(() => cards[0].click());
    cards = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));
    expect(cards[1].className).not.toContain("bg-red-50");
    expect(container.textContent).not.toContain(FEEDBACK);
  });

  it("hides the Kiểm tra button and stays silent in recordOnly mode", () => {
    act(() => {
      root.render(
        <ImageChoiceMultiPlayer
          title="Chọn hình"
          options={[{ id: "a", imageUrl: "/a.png", text: "A" }]}
          correctIds={["a"]}
          instantFeedback={false}
          selfAssessment
        />,
      );
    });

    const card = container.querySelector<HTMLButtonElement>('[role="checkbox"]');
    act(() => card?.click());
    expect(checkButton()).toBeUndefined();
    expect(container.textContent).not.toContain(FEEDBACK);
  });
});

describe("LikertPlayer self-check feedback + selfAssessment", () => {
  const points = [
    { value: 1, label: "Một" },
    { value: 2, label: "Hai" },
    { value: 3, label: "Ba" },
  ];

  it("shows the red point + line after a wrong Kiểm tra and clears it on retry", () => {
    act(() => {
      root.render(<LikertPlayer title="Đánh giá" points={points} correctValue={3} />);
    });

    const pointButton = (label: string) =>
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes(label),
      );

    act(() => pointButton("Một")?.click()); // wrong
    act(() => checkButton()?.click());

    expect(pointButton("Một")?.innerHTML).toContain("bg-red-50");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);
    // The correct point must not be leaked while the pupil can still retry.
    expect(pointButton("Ba")?.innerHTML).not.toContain("bg-green-50");

    // Changing the pick clears the wrong state for the retry.
    act(() => pointButton("Hai")?.click());
    expect(pointButton("Một")?.innerHTML).not.toContain("bg-red-50");
    expect(container.textContent).not.toContain(FEEDBACK);
  });

  it("is record-only under selfAssessment even with a key: no Kiểm tra, no verdict", () => {
    act(() => {
      root.render(
        <LikertPlayer title="Đánh giá" points={points} correctValue={3} selfAssessment />,
      );
    });

    expect(checkButton()).toBeUndefined();
    const wrongPoint = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Một"),
    );
    act(() => wrongPoint?.click());
    expect(container.textContent).toContain("Đã ghi nhận");
    expect(container.textContent).not.toContain(FEEDBACK);
  });
});

describe("SemanticDifferentialPlayer self-check feedback + selfAssessment", () => {
  const pairs = [{ id: "p1", leftLabel: "Chậm", rightLabel: "Nhanh", points: 3 }];

  it("shows the red dot + line after a wrong Kiểm tra and clears it on retry", () => {
    act(() => {
      root.render(
        <SemanticDifferentialPlayer
          title="Thang đối nghĩa"
          pairs={pairs}
          correctValues={{ p1: 3 }}
        />,
      );
    });

    const dot = (n: number) =>
      container.querySelector<HTMLButtonElement>(`[aria-label="Chậm–Nhanh: ${n}/3"]`);

    act(() => dot(1)?.click()); // wrong
    act(() => checkButton()?.click());

    // web-own: default skin web là playful RỖNG (studio: optionCard wrong/correct
    // = bg-red-50/bg-green-50) → dot dùng fallback playful bg-red-400/bg-green-400.
    expect(dot(1)?.className).toContain("bg-red-400");
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);
    // The correct dot must not be leaked while the pupil can still retry.
    expect(dot(3)?.className).not.toContain("bg-green-400");

    // Changing the pick clears the wrong state for the retry.
    act(() => dot(2)?.click());
    expect(dot(1)?.className).not.toContain("bg-red-400");
    expect(container.textContent).not.toContain(FEEDBACK);
  });

  it("is record-only under selfAssessment even with a key: no Kiểm tra, no verdict", () => {
    act(() => {
      root.render(
        <SemanticDifferentialPlayer
          title="Thang đối nghĩa"
          pairs={pairs}
          correctValues={{ p1: 3 }}
          selfAssessment
        />,
      );
    });

    expect(checkButton()).toBeUndefined();
    const dot = container.querySelector<HTMLButtonElement>('[aria-label="Chậm–Nhanh: 1/3"]');
    act(() => dot?.click());
    expect(container.textContent).toContain("Đã ghi nhận");
    expect(container.textContent).not.toContain(FEEDBACK);
  });
});

describe("StarRatingPlayer selfAssessment + error line", () => {
  it("shows the red feedback line after a wrong Kiểm tra", () => {
    act(() => {
      root.render(<StarRatingPlayer title="Chấm sao" max={3} correctValue={3} />);
    });

    const star = container.querySelector<HTMLButtonElement>('[aria-label="1 / 3"]');
    act(() => star?.click()); // wrong
    act(() => checkButton()?.click());
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);
  });

  it("is record-only under selfAssessment even with a key: no Kiểm tra, no verdict", () => {
    act(() => {
      root.render(
        <StarRatingPlayer title="Chấm sao" max={3} correctValue={3} selfAssessment />,
      );
    });

    expect(checkButton()).toBeUndefined();
    const star = container.querySelector<HTMLButtonElement>('[aria-label="1 / 3"]');
    act(() => star?.click());
    expect(container.textContent).toContain("Đã ghi nhận");
    expect(container.textContent).not.toContain(FEEDBACK);
  });
});

describe("ConfidenceSliderPlayer wrong UI + selfAssessment", () => {
  it("turns the readout red and shows the feedback line after a wrong Kiểm tra", () => {
    act(() => {
      root.render(
        // Playful skin keeps the built-in classes, so the readout tone is testable.
        <SkinProvider skin="playful">
          <ConfidenceSliderPlayer title="Tự tin" correctValue={80} />
        </SkinProvider>,
      );
    });

    act(() => checkButton()?.click()); // value 50 ≠ 80 — wrong
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);
    // Readout (50% would normally be amber) goes red on the wrong verdict.
    const readout = Array.from(container.querySelectorAll("span")).find((span) =>
      span.textContent?.includes("%"),
    );
    expect(readout?.className).toContain("text-red-500");
  });

  it("is record-only under selfAssessment even with a key: no Kiểm tra button", () => {
    act(() => {
      root.render(
        <ConfidenceSliderPlayer title="Tự tin" correctValue={80} selfAssessment />,
      );
    });

    expect(checkButton()).toBeUndefined();
    expect(container.textContent).not.toContain(FEEDBACK);
  });
});

describe("NumericSliderPlayer selfAssessment + error line", () => {
  it("shows the red feedback line after a wrong Kiểm tra", () => {
    act(() => {
      root.render(
        <NumericSliderPlayer title="Kéo thanh" min={0} max={10} correctValue={9} />,
      );
    });

    act(() => checkButton()?.click()); // value 5 ≠ 9 — wrong
    // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
    // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
    expect(container.textContent).not.toContain(FEEDBACK);
  });

  it("is record-only under selfAssessment even with a key: no Kiểm tra button", () => {
    act(() => {
      root.render(
        <NumericSliderPlayer
          title="Kéo thanh"
          min={0}
          max={10}
          correctValue={9}
          selfAssessment
        />,
      );
    });

    expect(checkButton()).toBeUndefined();
    expect(container.textContent).not.toContain(FEEDBACK);
  });
});
