import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FieldResizeContext } from "@/core/exercise/field-resize-context";
import { ClozePlayer } from "./ClozePlayer";
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

const lines = [
  { id: "L1", segments: [{ text: "Thủ đô VN là " }, { blankId: "b1", acceptedAnswers: ["Hà Nội"] }] },
  { id: "L2", segments: [{ text: "Số lớn nhất một chữ số là " }, { blankId: "b2", acceptedAnswers: ["9"] }] },
];

it("grades one blank on blur and emits onElementGraded (instant default)", () => {
  const onElementGraded = vi.fn();
  act(() => root.render(<ClozePlayer title="Q" lines={lines} onElementGraded={onElementGraded} />));
  const inputs = container.querySelectorAll("input");
  typeBlur(inputs[0] as HTMLInputElement, "Hà Nội");
  expect(onElementGraded).toHaveBeenCalledWith("b1", "correct", undefined);
  // ô đúng tô xanh (class chứa green)
  expect((inputs[0] as HTMLInputElement).className).toContain("green");
});

it("hides the Kiểm tra button when instant (default) and shows it when instantFeedback=false", () => {
  act(() => root.render(<ClozePlayer title="Q" lines={lines} />));
  expect(container.textContent).not.toContain("Kiểm tra");

  act(() => root.render(<ClozePlayer title="Q" lines={lines} instantFeedback={false} />));
  expect(container.textContent).toContain("Kiểm tra");
});

it("marks a wrong blank red but leaves it editable, then re-grades to correct", () => {
  act(() => root.render(<ClozePlayer title="Q" lines={lines} />));
  const inputs = container.querySelectorAll("input");
  typeBlur(inputs[0] as HTMLInputElement, "Sài Gòn");
  expect((inputs[0] as HTMLInputElement).className).toContain("red");
  expect((inputs[0] as HTMLInputElement).disabled).toBe(false);
  typeBlur(inputs[0] as HTMLInputElement, "Hà Nội");
  expect((inputs[0] as HTMLInputElement).className).toContain("green");
});

it("button-mode wrong Kiểm tra marks only the wrong blanks red + shows the feedback line, without leaking, and clears on retry", () => {
  act(() => root.render(<ClozePlayer title="Q" lines={lines} instantFeedback={false} />));
  const inputs = container.querySelectorAll("input");
  typeBlur(inputs[0] as HTMLInputElement, "Sài Gòn"); // sai
  typeBlur(inputs[1] as HTMLInputElement, "9"); // đúng
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
  typeBlur(inputs[0] as HTMLInputElement, "Hà Nội");
  expect((inputs[0] as HTMLInputElement).className).not.toContain("red");
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
});

it("record-only (no key): hides Kiểm tra and reports incomplete on blur, never grading", () => {
  const onAnswerChange = vi.fn();
  const onStatusChange = vi.fn();
  const keyless = [
    { id: "L1", segments: [{ text: "Ghi lại: " }, { blankId: "b1", acceptedAnswers: [] }] },
  ];
  act(() =>
    root.render(
      <ClozePlayer
        title="Q"
        lines={keyless}
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

it("renders NO Kiểm tra button for a zero-blank image-only child (#440, b6_q3_stapler shape)", () => {
  // A question_group sample cell: content is a single illustration image,
  // no blanks, selfAssessment true, instantFeedback false (QA preview mode).
  act(() =>
    root.render(
      <ClozePlayer
        title=""
        lines={[]}
        content={{
          blocks: [
            {
              type: "image",
              url: "assets/images/bai6_t2q3_stapler.png",
              alt: "Mẫu: cái dập ghim dài bằng 4 ghim giấy",
            },
          ],
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
  act(() => root.render(<ClozePlayer title="Q" lines={lines} />));
  expect(container.querySelectorAll("[data-resize-handle]").length).toBe(0);
});

it("renders one resize handle per blank inside a FieldResizeContext provider (edit preview)", () => {
  act(() =>
    root.render(
      <FieldResizeContext.Provider value={{ onResize: vi.fn() }}>
        <ClozePlayer title="Q" lines={lines} />
      </FieldResizeContext.Provider>,
    ),
  );
  expect(container.querySelector('[data-resize-handle="b1"]')).toBeTruthy();
  expect(container.querySelector('[data-resize-handle="b2"]')).toBeTruthy();
  expect(container.querySelectorAll("[data-resize-handle]").length).toBe(2);
});

it("multiline blank (#444) grades on blur through the textarea, same as an input", () => {
  const onElementGraded = vi.fn();
  const multilineLines = [
    {
      id: "L1",
      segments: [
        { text: "Thủ đô VN là " },
        { blankId: "b1", acceptedAnswers: ["Hà Nội"], input: { mode: "multiline" as const, rows: 3 } },
      ],
    },
  ];
  act(() =>
    root.render(<ClozePlayer title="Q" lines={multilineLines} onElementGraded={onElementGraded} />),
  );
  const ta = container.querySelector("textarea") as HTMLTextAreaElement;
  expect(ta).toBeTruthy();
  expect(ta.rows).toBe(3);
  typeBlur(ta, "Hà Nội");
  expect(onElementGraded).toHaveBeenCalledWith("b1", "correct", undefined);
  expect(ta.className).toContain("green");
});

it("multiline record-only blank preserves newlines through the answer record (#444)", () => {
  const onAnswerChange = vi.fn();
  const multilineLines = [
    {
      id: "L1",
      segments: [
        { text: "Cảm nghĩ: " },
        {
          blankId: "b1",
          acceptedAnswers: [] as string[],
          input: { mode: "multiline" as const, size: "full" as const, rows: 4 },
        },
      ],
    },
  ];
  act(() =>
    root.render(
      <ClozePlayer title="Q" lines={multilineLines} selfAssessment onAnswerChange={onAnswerChange} />,
    ),
  );
  const ta = container.querySelector("textarea") as HTMLTextAreaElement;
  expect(ta.className).toContain("w-full");
  expect(ta.rows).toBe(4);
  typeBlur(ta, "Dòng một\nDòng hai");
  expect(onAnswerChange).toHaveBeenCalledWith({ b1: "Dòng một\nDòng hai" });
  expect(ta.value).toBe("Dòng một\nDòng hai");
});

// Owner 8/8 (bai18 picture-cloze): dòng KHÔNG có chữ (toàn ô điền) căn giữa —
// ảnh phía trên vốn căn giữa, ô điền lệch trái trông rơi khỏi bố cục. Dòng có
// chữ giữ căn trái như văn xuôi.
it("centers a blanks-only line but keeps prose lines left-aligned", () => {
  const mixed = [
    { id: "L1", segments: [{ blankId: "b1", acceptedAnswers: ["chim"] }] },
    { id: "L2", segments: [{ text: "Con vật là " }, { blankId: "b2", acceptedAnswers: ["mèo"] }] },
  ];
  act(() => root.render(<ClozePlayer title="Q" lines={mixed} />));
  const rows = Array.from(container.querySelectorAll("p"));
  const blankOnly = rows.find((p) => p.querySelector('input') && !p.textContent?.trim());
  const prose = rows.find((p) => p.textContent?.includes("Con vật là"));
  expect(blankOnly?.className).toContain("justify-center");
  expect(prose?.className).not.toContain("justify-center");
});

// Owner 12/8: bỏ MỌI whitespace trước khi chấm — spacing không phải kiến thức
// được chấm; bàn phím điện thoại hay chèn space thừa/space cứng.
it("matchBlank bỏ hết space (kể cả NBSP) hai phía trước khi so", async () => {
  const { matchBlank } = await import("./ClozePlayer");
  const blank = { blankId: "b1", acceptedAnswers: ["A, B, O, P, Q"] };
  expect(matchBlank("A,B,O,P,Q", blank)).toBe(true);
  expect(matchBlank("A , B , O , P , Q ", blank)).toBe(true);
  expect(matchBlank("A, B, O, P, Q ", blank)).toBe(true); // NBSP bàn phím mobile
  expect(matchBlank("A, B, O, P, Q", blank)).toBe(true);
  expect(matchBlank("a, b, o, p, q", blank)).toBe(true); // caseSensitive tắt
  expect(matchBlank("A, B, O, P", blank)).toBe(false);
  // caseSensitive vẫn phân biệt hoa thường, nhưng space vẫn bỏ.
  const strict = { blankId: "b2", acceptedAnswers: ["AB, PQ"], caseSensitive: true };
  expect(matchBlank("AB,PQ", strict)).toBe(true);
  expect(matchBlank("ab,pq", strict)).toBe(false);
});
