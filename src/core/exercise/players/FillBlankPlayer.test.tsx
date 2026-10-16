import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FieldResizeContext } from "@/core/exercise/field-resize-context";
import { FillBlankPlayer } from "./FillBlankPlayer";
import { typeBlur } from "./instant-test-utils";

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

const segments = [
  { text: "2 + 2 = " },
  { blankId: "b1", acceptedAnswers: ["4"] },
  { text: " và 3 + 3 = " },
  { blankId: "b2", acceptedAnswers: ["6"] },
];

it("grades one blank on blur and emits onElementGraded (instant default)", () => {
  const onElementGraded = vi.fn();
  act(() => root.render(<FillBlankPlayer title="Q" segments={segments} onElementGraded={onElementGraded} />));
  const inputs = container.querySelectorAll("input");
  typeBlur(inputs[0] as HTMLInputElement, "4");
  expect(onElementGraded).toHaveBeenCalledWith("b1", "correct", undefined);
  // ô đúng tô xanh (class chứa green)
  expect((inputs[0] as HTMLInputElement).className).toContain("green");
});

it("hides the Kiểm tra button when instant (default) and shows it when instantFeedback=false", () => {
  act(() => root.render(<FillBlankPlayer title="Q" segments={segments} />));
  expect(container.textContent).not.toContain("Kiểm tra");

  act(() => root.render(<FillBlankPlayer title="Q" segments={segments} instantFeedback={false} />));
  expect(container.textContent).toContain("Kiểm tra");
});

it("marks a wrong blank red but leaves it editable, then re-grades to correct", () => {
  act(() => root.render(<FillBlankPlayer title="Q" segments={segments} />));
  const inputs = container.querySelectorAll("input");
  typeBlur(inputs[0] as HTMLInputElement, "5");
  expect((inputs[0] as HTMLInputElement).className).toContain("red");
  expect((inputs[0] as HTMLInputElement).disabled).toBe(false);
  typeBlur(inputs[0] as HTMLInputElement, "4");
  expect((inputs[0] as HTMLInputElement).className).toContain("green");
});

it("button-mode wrong Kiểm tra marks only the wrong blanks red + shows the feedback line, without leaking, and clears on retry", () => {
  act(() => root.render(<FillBlankPlayer title="Q" segments={segments} instantFeedback={false} />));
  const inputs = container.querySelectorAll("input");
  typeBlur(inputs[0] as HTMLInputElement, "5"); // sai
  typeBlur(inputs[1] as HTMLInputElement, "6"); // đúng
  const checkButton = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Kiểm tra",
  )!;
  act(() => checkButton.click());

  expect((inputs[0] as HTMLInputElement).className).toContain("red");
  // Ô đúng không bị tô — không lộ đáp án khi còn được thử lại.
  expect((inputs[1] as HTMLInputElement).className).not.toContain("red");
  expect((inputs[1] as HTMLInputElement).className).not.toContain("green");
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");

  // Sửa lại → xoá trạng thái sai.
  typeBlur(inputs[0] as HTMLInputElement, "4");
  expect((inputs[0] as HTMLInputElement).className).not.toContain("red");
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
});

it("record-only (no key): hides Kiểm tra and reports incomplete on blur, never grading", () => {
  const onAnswerChange = vi.fn();
  const onStatusChange = vi.fn();
  const keyless = [{ text: "Ghi lại: " }, { blankId: "b1", acceptedAnswers: [] as string[] }];
  act(() =>
    root.render(
      <FillBlankPlayer
        title="Q"
        segments={keyless}
        onAnswerChange={onAnswerChange}
        onStatusChange={onStatusChange}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");
  const input = container.querySelector("input") as HTMLInputElement;
  typeBlur(input, "tự do");
  expect(onAnswerChange).toHaveBeenCalledWith({ b1: "tự do" });
  expect(onStatusChange).toHaveBeenCalledWith("idle");
  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  expect(input.className).not.toContain("red");
});

it("renders NO Kiểm tra button for a zero-blank image-only content (#440 parity)", () => {
  act(() =>
    root.render(
      <FillBlankPlayer
        title=""
        segments={[]}
        content={{
          blocks: [{ type: "image", url: "assets/images/minh-hoa.png", alt: "Mẫu minh hoạ" }],
        }}
        selfAssessment
        instantFeedback={false}
      />,
    ),
  );
  expect(container.querySelectorAll("input").length).toBe(0);
  expect(container.textContent).not.toContain("Kiểm tra");
});

it("renders no resize handle without a FieldResizeContext provider (student surfaces)", () => {
  act(() => root.render(<FillBlankPlayer title="Q" segments={segments} />));
  expect(container.querySelectorAll("[data-resize-handle]").length).toBe(0);
});

it("renders one resize handle per blank inside a FieldResizeContext provider (edit preview)", () => {
  act(() =>
    root.render(
      <FieldResizeContext.Provider value={{ onResize: vi.fn() }}>
        <FillBlankPlayer title="Q" segments={segments} />
      </FieldResizeContext.Provider>,
    ),
  );
  expect(container.querySelector('[data-resize-handle="b1"]')).toBeTruthy();
  expect(container.querySelector('[data-resize-handle="b2"]')).toBeTruthy();
  expect(container.querySelectorAll("[data-resize-handle]").length).toBe(2);
});

it("multiline blank (#444) grades on blur through the textarea, same as an input", () => {
  const onElementGraded = vi.fn();
  const multiline = [
    { text: "Trả lời: " },
    { blankId: "b1", acceptedAnswers: ["4"], input: { mode: "multiline" as const, rows: 3 } },
  ];
  act(() =>
    root.render(<FillBlankPlayer title="Q" segments={multiline} onElementGraded={onElementGraded} />),
  );
  const ta = container.querySelector("textarea") as HTMLTextAreaElement;
  expect(ta).toBeTruthy();
  expect(ta.rows).toBe(3);
  typeBlur(ta, "4");
  expect(onElementGraded).toHaveBeenCalledWith("b1", "correct", undefined);
  expect(ta.className).toContain("green");
});

it("multiline record-only blank preserves newlines through the answer record (#444)", () => {
  const onAnswerChange = vi.fn();
  const multiline = [
    { text: "Bài học: " },
    {
      blankId: "b1",
      acceptedAnswers: [] as string[],
      input: { mode: "multiline" as const, size: "full" as const, rows: 4 },
    },
  ];
  act(() =>
    root.render(
      <FillBlankPlayer title="Q" segments={multiline} selfAssessment onAnswerChange={onAnswerChange} />,
    ),
  );
  const ta = container.querySelector("textarea") as HTMLTextAreaElement;
  expect(ta.className).toContain("w-full");
  typeBlur(ta, "Dòng một\nDòng hai");
  expect(onAnswerChange).toHaveBeenCalledWith({ b1: "Dòng một\nDòng hai" });
  expect(ta.value).toBe("Dòng một\nDòng hai");
});

it("multiline blank renders a resize handle inside a FieldResizeContext provider (#444)", () => {
  const multiline = [
    { blankId: "b1", acceptedAnswers: ["4"], input: { mode: "multiline" as const } },
  ];
  act(() =>
    root.render(
      <FieldResizeContext.Provider value={{ onResize: vi.fn() }}>
        <FillBlankPlayer title="Q" segments={multiline} />
      </FieldResizeContext.Provider>,
    ),
  );
  expect(container.querySelector("textarea")).toBeTruthy();
  expect(container.querySelector('[data-resize-handle="b1"]')).toBeTruthy();
});

// Owner 8/8 (cùng luật với ClozePlayer): segments KHÔNG có chữ (toàn ô điền)
// căn giữa; có chữ giữ căn trái như văn xuôi.
it("centers a blanks-only segment row but keeps prose left-aligned", () => {
  act(() =>
    root.render(
      <FillBlankPlayer title="Q" segments={[{ blankId: "b1", acceptedAnswers: ["chim"] }]} />,
    ),
  );
  const blankRow = Array.from(container.querySelectorAll("p")).find((p) => p.querySelector("input"));
  expect(blankRow?.className).toContain("justify-center");

  act(() =>
    root.render(
      <FillBlankPlayer
        title="Q"
        segments={[{ text: "Điền vào: " }, { blankId: "b1", acceptedAnswers: ["chim"] }]}
      />,
    ),
  );
  const proseRow = Array.from(container.querySelectorAll("p")).find((p) => p.querySelector("input"));
  expect(proseRow?.className).not.toContain("justify-center");
});

// Nhánh IN-PLACE (marker trong content, bai4 "Viết tên các nhạc cụ"): đoạn
// KHÔNG có chữ nào ngoài marker cũng căn giữa — cùng luật với nhánh segments.
it("centers an in-place marker paragraph that has no prose around the blank", () => {
  act(() =>
    root.render(
      <FillBlankPlayer
        title="Q"
        content={{
          blocks: [
            { type: "image", url: "/drum.png" },
            { type: "paragraph", text: "{blank_b1}" },
          ],
        }}
        segments={[{ blankId: "b1", acceptedAnswers: ["trống"] }]}
      />,
    ),
  );
  const para = Array.from(container.querySelectorAll("p")).find((p) => p.querySelector("input"));
  expect(para?.className).toContain("text-center");

  act(() =>
    root.render(
      <FillBlankPlayer
        title="Q"
        content={{
          blocks: [{ type: "paragraph", text: "Nhạc cụ này là {blank_b1} đấy." }],
        }}
        segments={[{ blankId: "b1", acceptedAnswers: ["trống"] }]}
      />,
    ),
  );
  const prose = Array.from(container.querySelectorAll("p")).find((p) => p.querySelector("input"));
  expect(prose?.className).not.toContain("text-center");
});

// Owner 12/8: cùng luật bỏ space với matchBlank của ClozePlayer — xem comment
// tại FillBlankPlayer.matchBlank.
it("matchBlank bỏ hết space trước khi so", async () => {
  const { matchBlank } = await import("./FillBlankPlayer");
  const blank = { blankId: "b1", acceptedAnswers: ["21 + 14 = 35"] };
  expect(matchBlank("21+14=35", blank)).toBe(true);
  expect(matchBlank(" 21 + 14 = 35", blank)).toBe(true);
  expect(matchBlank("21 + 14 = 36", blank)).toBe(false);
});
