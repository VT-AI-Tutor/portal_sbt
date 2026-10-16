/**
 * Cờ `presentation.hideInlineFeedback` — surface HỌC SINH không hiện các DÒNG
 * phản hồi đúng/sai tự-hiển-thị bên trong nội dung câu hỏi ("🎉 Chính xác!",
 * "Tuyệt vời! 🎉", "Chưa đúng, thử lại nhé! 🤔"…), còn `studioSkin` (QA duyệt
 * nội dung) vẫn thấy đủ. Owner 4/8.
 *
 * Ghim 3 CƠ CHẾ gỡ, mỗi cơ chế một đại diện — nếu ai đó thêm player mới mà
 * dựng dòng feedback bằng tay thì test này không bắt được, nhưng ba đường ống
 * dùng chung thì có:
 *   1. <PlayerErrorFeedback>      — ~30 player dùng chung (đại diện: SingleChoice)
 *   2. <PlayerInlineFeedback>     — dòng success/error riêng của player (SelectWords)
 *   3. useInlineFeedbackShown()   — player có markup riêng (Dictation)
 *
 * KHÔNG bị cờ này đụng tới (khẳng định trong test cuối): dòng "Đã ghi nhận…"
 * (feedback kind `neutral`) và ResultBanner của host.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SkinProvider, playfulSkin, studioSkin } from "@/core/exercise/skin";
import { PlayerErrorFeedback, GradeModeContext } from "./shared";
import { SingleChoicePlayer } from "./SingleChoicePlayer";
import { SelectWordsPlayer } from "./SelectWordsPlayer";
import { DictationPlayer } from "./DictationPlayer";
import { ShortAnswerPlayer } from "./ShortAnswerPlayer";

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

/**
 * Render dưới skin học sinh (cờ BẬT = ẩn) hoặc skin studio (cờ tắt = hiện).
 * Gỡ cây cũ trước: một test render HAI ca (đúng rồi sai) vào cùng root, mà
 * render lại cùng component type thì React GIỮ state — ca sau sẽ thừa hưởng
 * verdict của ca trước và assert "not.toContain" đậu giả.
 */
function renderWith(skin: "playful" | "studio", node: ReactNode) {
  act(() => root.render(null));
  act(() =>
    root.render(
      <SkinProvider skin={skin === "playful" ? playfulSkin : studioSkin}>{node}</SkinProvider>,
    ),
  );
}

const textareaValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype,
  "value",
)!.set!;

function typeTextarea(value: string) {
  const el = container.querySelector("textarea") as HTMLTextAreaElement;
  act(() => {
    textareaValueSetter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function clickButtonWithText(text: string) {
  const b = Array.from(container.querySelectorAll("button")).find(
    (x) => x.textContent?.trim() === text,
  )!;
  expect(b).toBeTruthy();
  act(() => b.click());
}

describe("PlayerErrorFeedback (đường dùng chung của ~30 player)", () => {
  it("skin học sinh: không render dòng nào", () => {
    renderWith("playful", <PlayerErrorFeedback show />);
    expect(container.textContent).toBe("");
  });

  it("studioSkin: vẫn render dòng đỏ mặc định", () => {
    renderWith("studio", <PlayerErrorFeedback show />);
    expect(container.textContent).toContain("Chưa đúng, thử lại nhé!");
  });
});

describe("SingleChoicePlayer — chọn sai", () => {
  const props = {
    title: "Q",
    options: [
      { id: "a", text: "Alpha" },
      { id: "b", text: "Beta" },
    ],
    correctId: "a",
  };

  it("skin học sinh: không có dòng 'Chưa đúng…', nhưng lựa chọn sai VẪN tô đỏ", () => {
    renderWith("playful", <SingleChoicePlayer {...props} />);
    const wrong = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]')).find(
      (b) => b.textContent?.includes("Beta"),
    )!;
    act(() => wrong.click());

    expect(container.textContent).not.toContain("Chưa đúng");
    // Phản hồi CHÍNH còn nguyên: per-element đỏ.
    const graded = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]')).find(
      (b) => b.textContent?.includes("Beta"),
    )!;
    expect(graded.className).toMatch(/red/);
  });

  it("studioSkin: vẫn hiện dòng 'Chưa đúng…'", () => {
    renderWith("studio", <SingleChoicePlayer {...props} />);
    const wrong = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]')).find(
      (b) => b.textContent?.includes("Beta"),
    )!;
    act(() => wrong.click());
    expect(container.textContent).toContain("Chưa đúng");
  });
});

describe("SelectWordsPlayer — dòng success VÀ error riêng của player", () => {
  const props = { title: "Q", passage: "con mèo ngồi", correctWords: [1], instantFeedback: false };

  function clickWord(t: string) {
    const el = Array.from(container.querySelectorAll('[role="button"]')).find((b) =>
      b.textContent?.includes(t),
    )!;
    act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  }

  it("skin học sinh: chấm đúng không hiện 'Tuyệt vời! 🎉', chấm sai không hiện 'Chưa đúng…'", () => {
    renderWith("playful", <SelectWordsPlayer {...props} />);
    clickWord("con"); // sai
    clickButtonWithText("Kiểm tra");
    expect(container.textContent).not.toContain("Chưa đúng");

    renderWith("playful", <SelectWordsPlayer {...props} />);
    clickWord("mèo"); // đúng
    clickButtonWithText("Kiểm tra");
    expect(container.textContent).not.toContain("Tuyệt vời");
  });

  it("studioSkin: cả hai dòng vẫn hiện", () => {
    renderWith("studio", <SelectWordsPlayer {...props} />);
    clickWord("con");
    clickButtonWithText("Kiểm tra");
    expect(container.textContent).toContain("Chưa đúng");

    renderWith("studio", <SelectWordsPlayer {...props} />);
    clickWord("mèo");
    clickButtonWithText("Kiểm tra");
    expect(container.textContent).toContain("Tuyệt vời");
  });
});

describe("DictationPlayer — markup riêng, gate bằng useInlineFeedbackShown()", () => {
  const props = { title: "Q", acceptedTranscript: "con mèo", instantFeedback: false };

  it("skin học sinh: không hiện 'Chính xác!' / 'Chưa đúng…'", () => {
    renderWith("playful", <DictationPlayer {...props} />);
    typeTextarea("sai hết");
    clickButtonWithText("Kiểm tra");
    expect(container.textContent).not.toContain("Chưa đúng");

    renderWith("playful", <DictationPlayer {...props} />);
    typeTextarea("con mèo");
    clickButtonWithText("Kiểm tra");
    expect(container.textContent).not.toContain("Chính xác");
  });

  it("studioSkin: vẫn hiện cả hai", () => {
    renderWith("studio", <DictationPlayer {...props} />);
    typeTextarea("sai hết");
    clickButtonWithText("Kiểm tra");
    expect(container.textContent).toContain("Chưa đúng");

    renderWith("studio", <DictationPlayer {...props} />);
    typeTextarea("con mèo");
    clickButtonWithText("Kiểm tra");
    expect(container.textContent).toContain("Chính xác");
  });
});

describe("cờ KHÔNG đụng tới", () => {
  // web-own (SBT-61): biên nhận giờ là "Hệ thống đã ghi nhận", bật bằng nút "Nộp câu trả lời".
  it("dòng biên nhận 'Hệ thống đã ghi nhận' vẫn hiện ở surface học sinh", () => {
    renderWith("playful", <ShortAnswerPlayer title="Q" selfAssessment />);
    typeTextarea("bài làm của em");
    clickButtonWithText("Nộp câu trả lời");
    expect(container.textContent).toContain("Hệ thống đã ghi nhận");
  });

  it("ResultBanner của host (gradeMode parent) vẫn hiện ở surface học sinh", () => {
    renderWith(
      "playful",
      <GradeModeContext.Provider value={{ mode: "parent", result: "correct" }}>
        <SingleChoicePlayer
          title="Q"
          options={[{ id: "a", text: "Alpha" }]}
          correctId="a"
        />
      </GradeModeContext.Provider>,
    );
    expect(container.textContent).toContain("Đúng rồi!");
  });
});
