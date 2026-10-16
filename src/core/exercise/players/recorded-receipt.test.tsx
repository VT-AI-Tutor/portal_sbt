/**
 * web-own: chưa upstream lên studio — xem WEB-OWN PATCHES (mục I) trong
 * apps/learner/scripts/detokenize-players.mjs. Tên file chỉ có ở repo này nên
 * bước copy từ studio không đè; copy đè ba player sẽ làm file này đỏ.
 *
 * SBT-61 (chốt 07/10/2026): câu tự viết / tự vẽ không có đáp án có nút "Nộp câu trả lời"
 * ngay trong câu → "Hệ thống đã ghi nhận". Không khoá câu, sửa bài thì dòng tắt.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EssayPlayer } from "./EssayPlayer";
import { FreeDrawPlayer } from "./FreeDrawPlayer";
import { ShortAnswerPlayer } from "./ShortAnswerPlayer";
import { GradeModeContext, type GradeModeValue } from "./shared";
import { renderInteractionPlayer } from "./dispatch";

const RECORDED = "Hệ thống đã ghi nhận";

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
  vi.restoreAllMocks();
});

const textareaValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype,
  "value",
)!.set!;

function render(element: ReactNode) {
  act(() => root.render(element));
}

function withGradeMode(value: GradeModeValue, element: ReactNode) {
  return <GradeModeContext.Provider value={value}>{element}</GradeModeContext.Provider>;
}

function type(value: string, index = 0) {
  const el = container.querySelectorAll("textarea")[index] as HTMLTextAreaElement;
  act(() => {
    textareaValueSetter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function submitButton() {
  return Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Nộp câu trả lời",
  );
}

function clickSubmit() {
  const b = submitButton();
  expect(b).toBeTruthy();
  act(() => b!.click());
}

const text = () => container.textContent ?? "";
const occurrences = (needle: string) => text().split(needle).length - 1;

describe("EssayPlayer — nút Nộp câu trả lời trong câu", () => {
  it("chưa bấm thì không có dòng ghi nhận, kể cả khi đã viết", () => {
    render(<EssayPlayer title="Viết" />);
    type("Bài văn của em");
    expect(submitButton()).toBeTruthy();
    expect(text()).not.toContain(RECORDED);
  });

  it("ô trống thì nút mờ; viết rồi bấm thì dòng ghi nhận thay chỗ nút, câu KHÔNG bị khoá", () => {
    render(<EssayPlayer title="Viết" />);
    expect(submitButton()!.disabled).toBe(true);
    type("Bài làm");
    expect(submitButton()!.disabled).toBe(false);
    clickSubmit();
    expect(text()).toContain(RECORDED);
    expect(submitButton()).toBeUndefined();
    expect(container.querySelector("textarea")!.disabled).toBe(false);
  });

  it("sửa bài sau khi nộp thì dòng tắt, nút hiện lại", () => {
    render(<EssayPlayer title="Viết" />);
    type("Bản đầu");
    clickSubmit();
    type("Bản đầu, viết thêm");
    expect(text()).not.toContain(RECORDED);
    expect(submitButton()).toBeTruthy();
  });

  it("câu nhiều ý: sửa một ý cũng tắt dòng", () => {
    render(<EssayPlayer title="Viết" prompts={["Ý 1", "Ý 2"]} />);
    type("ý một", 0);
    clickSubmit();
    type("ý hai", 1);
    expect(text()).not.toContain(RECORDED);
  });

  it("quay lại câu (mount lại với bài cũ) thì chưa có dòng — chỉ có nút", () => {
    render(<EssayPlayer title="Viết" answer="Bài cũ" />);
    expect(text()).not.toContain(RECORDED);
    expect(submitButton()).toBeTruthy();
  });

  it("tên nút KHÁC 'Nộp bài' của runner — tránh học sinh tưởng đã nộp cả bài", () => {
    render(<EssayPlayer title="Viết" />);
    const labels = Array.from(container.querySelectorAll("button")).map((b) => b.textContent?.trim());
    expect(labels).toContain("Nộp câu trả lời");
    expect(labels).not.toContain("Nộp bài");
  });

  it("có nút ở mọi chế độ: practice, tắt instant, bài giao chấm kín", () => {
    render(<EssayPlayer title="Viết" instantFeedback={false} />);
    expect(submitButton()).toBeTruthy();
    render(withGradeMode({ mode: "parent" }, <EssayPlayer title="Viết" />));
    expect(submitButton()).toBeTruthy();
  });

  it("đã nộp cả bài: đúng MỘT dòng ghi nhận, không nút, không 'chờ chấm', không banner trùng", () => {
    render(
      withGradeMode(
        { mode: "parent", result: "incomplete" },
        <EssayPlayer title="Viết" answer="Bài đã nộp" submitted />,
      ),
    );
    expect(occurrences(RECORDED)).toBe(1);
    expect(submitButton()).toBeUndefined();
    expect(text()).not.toContain("chờ chấm");
    expect(text()).not.toContain("Đã ghi nhận câu trả lời.");
  });

  it("câu GV đã chấm (host bơm correct/incorrect) vẫn giữ banner kết quả", () => {
    render(
      withGradeMode(
        { mode: "parent", result: "correct" },
        <EssayPlayer title="Viết" answer="Bài đã chấm" submitted />,
      ),
    );
    expect(text()).toContain("Đúng rồi");
    render(
      withGradeMode(
        { mode: "parent", result: "incorrect" },
        <FreeDrawPlayer title="Vẽ" answer="data:image/png;base64,x" submitted />,
      ),
    );
    expect(text()).toContain("Chưa đúng");
  });

  it("verdict chấm câm đổi (undefined → incomplete) KHÔNG gỡ-dựng lại player", () => {
    render(withGradeMode({ mode: "parent", silent: true }, <EssayPlayer title="Viết" answer="Bài" />));
    const before = container.querySelector("textarea");
    render(
      withGradeMode(
        { mode: "parent", silent: true, silentVerdict: "incomplete" },
        <EssayPlayer title="Viết" answer="Bài" />,
      ),
    );
    expect(container.querySelector("textarea")).toBe(before);
  });

  it("chấm câm (bài trong sách): verdict incomplete thì banner trùng vẫn bị ẩn", () => {
    render(
      withGradeMode(
        { mode: "parent", silent: true, silentVerdict: "incomplete" },
        <EssayPlayer title="Viết" answer="Bài đã nộp" submitted />,
      ),
    );
    expect(text()).not.toContain("Đã ghi nhận câu trả lời.");
    expect(occurrences(RECORDED)).toBe(1);
  });

  it("đã nộp mà bỏ trống thì không 'ghi nhận' gì", () => {
    render(<EssayPlayer title="Viết" submitted />);
    expect(text()).not.toContain(RECORDED);
    expect(submitButton()).toBeUndefined();
  });

  it("ô trống: nút mờ, bấm không báo ghi nhận và không đẩy '' lên cha", () => {
    const onEssay = vi.fn();
    render(<EssayPlayer title="Viết" onAnswerChange={onEssay} />);
    type("   ");
    expect(submitButton()!.disabled).toBe(true);
    act(() => submitButton()!.click());
    expect(text()).not.toContain(RECORDED);

    const onShort = vi.fn();
    render(<ShortAnswerPlayer key="sa" title="Q" onAnswerChange={onShort} />);
    expect(submitButton()!.disabled).toBe(true);
    act(() => submitButton()!.click());
    expect(onShort).not.toHaveBeenCalled();
    expect(text()).not.toContain(RECORDED);
  });

  it("bấm Nộp câu trả lời vẫn đẩy bài làm lên cha", () => {
    const onAnswerChange = vi.fn();
    render(<EssayPlayer title="Viết" onAnswerChange={onAnswerChange} />);
    type("Bài làm");
    onAnswerChange.mockClear();
    clickSubmit();
    expect(onAnswerChange).toHaveBeenCalledWith("Bài làm");
  });
});

describe("ShortAnswerPlayer không key — nút Nộp câu trả lời trong câu", () => {
  it("gõ xong chưa bấm thì không còn dòng 'Đã ghi nhận câu trả lời.'", () => {
    render(<ShortAnswerPlayer title="Q" selfAssessment />);
    type("ý kiến của em");
    expect(text()).not.toContain("Đã ghi nhận câu trả lời.");
    expect(text()).not.toContain(RECORDED);
  });

  it("bấm → ghi nhận; sửa → nút trở lại", () => {
    const onAnswerChange = vi.fn();
    render(<ShortAnswerPlayer title="Q" onAnswerChange={onAnswerChange} />);
    type("câu trả lời");
    clickSubmit();
    expect(text()).toContain(RECORDED);
    expect(onAnswerChange).toHaveBeenCalledWith("câu trả lời");
    type("câu trả lời mới");
    expect(text()).not.toContain(RECORDED);
    expect(submitButton()).toBeTruthy();
  });

  it("câu nhiều ô (blanks[]): mờ khi chưa điền ô nào, điền một ô là bấm được", () => {
    render(
      renderInteractionPlayer("fill_blank", {
        id: "q",
        blanks: [
          { id: "b1", label: "a." },
          { id: "b2", label: "b." },
        ],
        display: { interactionType: "short_text" },
        selfAssessment: true,
        stem: "Q",
      }, {}),
    );
    expect(submitButton()!.disabled).toBe(true);
    type("vui", 1);
    clickSubmit();
    expect(text()).toContain(RECORDED);
  });

  it("đã nộp: một dòng ghi nhận, banner 'Đã ghi nhận câu trả lời.' bị ẩn", () => {
    render(
      withGradeMode(
        { mode: "parent", result: "incomplete" },
        <ShortAnswerPlayer title="Q" answer="bài" submitted />,
      ),
    );
    expect(occurrences(RECORDED)).toBe(1);
    expect(text()).not.toContain("Đã ghi nhận câu trả lời.");
  });

  it("câu CÓ key thì không có nút Nộp câu trả lời trong câu (chấm như cũ)", () => {
    render(<ShortAnswerPlayer title="Q" acceptedAnswers={["bốn"]} />);
    type("bốn");
    expect(submitButton()).toBeUndefined();
    expect(text()).not.toContain(RECORDED);
  });
});

describe("FreeDrawPlayer — cùng câu chữ", () => {
  it("đã nộp có bài vẽ: 'Hệ thống đã ghi nhận', không nút, banner trùng bị ẩn", () => {
    render(
      withGradeMode(
        { mode: "parent", result: "incomplete" },
        <FreeDrawPlayer title="Vẽ" answer="data:image/png;base64,x" submitted />,
      ),
    );
    expect(occurrences(RECORDED)).toBe(1);
    expect(submitButton()).toBeUndefined();
    expect(text()).not.toContain("Đã ghi nhận câu trả lời.");
    expect(text()).not.toContain("Em vẽ xong");
  });
});
