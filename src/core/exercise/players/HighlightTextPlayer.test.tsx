import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HighlightTextPlayer } from "./HighlightTextPlayer";

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
  { id: "s1", text: "con " },
  { id: "s2", text: "mèo" },
];

function clickSegment(t: string) {
  const el = Array.from(container.querySelectorAll('[role="button"]')).find((b) =>
    b.textContent?.includes(t),
  )!;
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

it("button-mode wrong Kiểm tra shows the red feedback message", () => {
  act(() =>
    root.render(
      <HighlightTextPlayer
        title="Q"
        segments={segments}
        correctIds={["s2"]}
        instantFeedback={false}
      />,
    ),
  );
  clickSegment("con"); // chọn sai
  const checkButton = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Kiểm tra",
  )!;
  act(() => checkButton.click());
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng rồi, thử lại nhé!");
});

it("preserves \\n newline segments between selectable segments without making them clickable", () => {
  const dialog = [
    { id: "lead", text: "Phương hỏi Tuấn:", selectable: false },
    { id: "vnl1", text: "\n", selectable: false },
    { id: "s1", text: "Cậu", selectable: true },
    { id: "vnl2", text: "\n", selectable: false },
    { id: "s2", text: "tớ", selectable: true },
  ];
  act(() =>
    root.render(
      <HighlightTextPlayer title="Q" segments={dialog} correctIds={["s1"]} />,
    ),
  );

  // The authored newlines survive to the DOM (were previously eaten by the
  // textarea decode step), so the passage renders across separate lines.
  expect(container.textContent).toContain("Phương hỏi Tuấn:\n");
  expect((container.textContent ?? "").match(/\n/g)?.length).toBe(2);

  // Newline segments stay non-interactive; only real words are clickable.
  const clickable = Array.from(container.querySelectorAll('[role="button"]'));
  expect(clickable.map((b) => b.textContent)).toEqual(["Cậu", "tớ"]);
});

// Issue #510 — mixed selectable / non-selectable segments must share one
// typography + baseline. The selectable word must NOT reuse the studio `chip`
// pill token (text-sm / font-medium / px-3 / py-1.5 / border), which shrank the
// font and spaced words like a chip row.
const mixed = [
  { id: "lbl", text: "a. ", selectable: false },
  { id: "w1", text: "Con", selectable: true },
  { id: "sp1", text: " ", selectable: false },
  { id: "w2", text: "mèo", selectable: true },
  { id: "punc", text: ". ", selectable: false },
  { id: "author", text: "(Hoài Nhi)", selectable: false },
];

it("selectable words inherit passage typography — no chip pill classes, no word-gap margin", () => {
  act(() =>
    root.render(
      <HighlightTextPlayer title="Q" segments={mixed} correctIds={["w1"]} />,
    ),
  );
  const words = Array.from(container.querySelectorAll('[role="button"]'));
  expect(words.map((b) => b.textContent)).toEqual(["Con", "mèo"]);
  for (const w of words) {
    const cls = w.className;
    // studio `chip` pill tokens must not leak onto inline words
    expect(cls).not.toMatch(/\btext-sm\b/);
    expect(cls).not.toMatch(/\bfont-medium\b/);
    expect(cls).not.toMatch(/\bpx-3\b/);
    expect(cls).not.toMatch(/\bpy-1\.5\b/);
    // no positive horizontal margin that would open gaps between words
    expect(cls).not.toMatch(/\bmx-px\b/);
    expect(cls).toMatch(/-mx-0\.5/);
  }
});

it("non-selectable label / punctuation / author are plain text, never buttons", () => {
  act(() =>
    root.render(
      <HighlightTextPlayer title="Q" segments={mixed} correctIds={["w1"]} />,
    ),
  );
  const buttonText = Array.from(container.querySelectorAll('[role="button"]')).map(
    (b) => b.textContent,
  );
  expect(buttonText.join("")).not.toContain("Hoài Nhi");
  expect(buttonText.join("")).not.toContain("a.");
  // the label / author text still renders, just not interactively
  expect(container.textContent).toContain("a. ");
  expect(container.textContent).toContain("(Hoài Nhi)");
});

it("selectable words are keyboard operable (Enter toggles the selection)", () => {
  const onAnswerChange = vi.fn();
  act(() =>
    root.render(
      <HighlightTextPlayer
        title="Q"
        segments={mixed}
        correctIds={["w1"]}
        onAnswerChange={onAnswerChange}
      />,
    ),
  );
  const first = Array.from(container.querySelectorAll('[role="button"]')).find(
    (b) => b.textContent === "Con",
  )! as HTMLElement;
  expect(first.tabIndex).toBe(0);
  act(() =>
    first.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  expect(onAnswerChange).toHaveBeenCalledWith(["w1"]);
});

// Issue #559 — a passage printed in multiple columns (e.g. a two-column poem)
// must be reproducible from data via `display.layout`, without touching grading.
function passageDiv(): HTMLElement {
  // The passage is the container of the clickable word spans.
  return container.querySelector('[role="button"]')!.parentElement as HTMLElement;
}

it("default (no layout) keeps a single-column passage — no multi-column class", () => {
  act(() =>
    root.render(
      <HighlightTextPlayer title="Q" segments={mixed} correctIds={["w1"]} />,
    ),
  );
  expect(passageDiv().className).not.toMatch(/columns-\d/);
});

it("layout grid_2 renders the passage as CSS multi-column (2 columns)", () => {
  act(() =>
    root.render(
      <HighlightTextPlayer
        title="Q"
        segments={mixed}
        correctIds={["w1"]}
        layout="grid_2"
      />,
    ),
  );
  expect(passageDiv().className).toMatch(/\bsm:columns-2\b/);
});

it("layout does not leak into grading — selection is graded the same with columns on", () => {
  const onAnswerChange = vi.fn();
  act(() =>
    root.render(
      <HighlightTextPlayer
        title="Q"
        segments={mixed}
        correctIds={["w1"]}
        layout="grid_2"
        onAnswerChange={onAnswerChange}
      />,
    ),
  );
  const first = Array.from(container.querySelectorAll('[role="button"]')).find(
    (b) => b.textContent === "Con",
  )! as HTMLElement;
  act(() => first.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(onAnswerChange).toHaveBeenCalledWith(["w1"]);
});

it("record-only (no key): hides Kiểm tra, only syncs the selection, never grades", () => {
  const onAnswerChange = vi.fn();
  const onStatusChange = vi.fn();
  act(() =>
    root.render(
      <HighlightTextPlayer
        title="Q"
        segments={segments}
        correctIds={[]}
        onAnswerChange={onAnswerChange}
        onStatusChange={onStatusChange}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");
  clickSegment("con");
  expect(onAnswerChange).toHaveBeenCalledWith(["s1"]);
  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  expect(onStatusChange).not.toHaveBeenCalledWith("success");
  const el = Array.from(container.querySelectorAll('[role="button"]')).find((b) =>
    b.textContent?.includes("con"),
  )!;
  expect(el.className).not.toMatch(/red|green/);
});

// Ids come from authored payloads, and the studio editor exists partly to repair
// blank/duplicate ones — so the player meets duplicate ids exactly while a QA is
// mid-repair. Keying the segment spans by id handed React two identical keys
// there, which it documents as unsupported (children may be duplicated or
// omitted): the preview could drop a segment right when someone is fixing it.
it("renders every segment when two of them share an id", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const clashing = [
    { id: "s1", text: "con mèo" },
    { id: "gap", text: " và ", selectable: false },
    { id: "s1", text: "con chó" },
  ];
  act(() =>
    root.render(<HighlightTextPlayer title="Q" segments={clashing} correctIds={["s1"]} />),
  );

  expect(container.querySelectorAll('[role="button"]')).toHaveLength(2);
  expect(container.textContent).toContain("con mèo");
  expect(container.textContent).toContain("con chó");
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

// Khối "Đáp án đúng" — SBT-62. Đáp án là id của từng ĐOẠN tô được, mà một danh
// từ nhiều tiếng bị tách thành nhiều đoạn để học sinh tô từng tiếng; in rời
// từng id sẽ ra "cô, giáo, công, chúa" thay vì "cô giáo, công chúa".
const passage = [
  { id: "w1", text: "Sau ", selectable: true },
  { id: "p1", text: ", ", selectable: false },
  { id: "w3_w1", text: "cô ", selectable: true },
  { id: "w3_w2", text: "giáo", selectable: true },
  { id: "sp1", text: " ", selectable: false },
  { id: "w4", text: "gọi ", selectable: true },
  { id: "w5", text: "Giét-xi", selectable: true },
  { id: "sp2", text: " ", selectable: false },
  { id: "w6", text: "vào ", selectable: true },
  { id: "w7_w1", text: "công ", selectable: true },
  { id: "w7_w2", text: "chúa", selectable: true },
  { id: "p2", text: ", ", selectable: false },
  { id: "w8", text: "Giét-xi", selectable: true },
  { id: "p3", text: ".", selectable: false },
];

function revealText() {
  const revealBlock = Array.from(container.querySelectorAll("div")).find((d) =>
    d.textContent?.startsWith("Đáp án đúng"),
  );
  return revealBlock?.textContent?.replace("Đáp án đúng", "").trim();
}

it("gộp các đoạn liền nhau thành một từ trong khối Đáp án đúng", () => {
  act(() =>
    root.render(
      <HighlightTextPlayer
        title="Q"
        segments={passage}
        correctIds={["w3_w1", "w3_w2", "w5", "w7_w1", "w7_w2", "w8"]}
        submitted
      />,
    ),
  );
  // "cô "+"giáo" là MỘT từ; "Giét-xi" tô ở hai chỗ nhưng chỉ in một lần.
  expect(revealText()).toBe("cô giáo, Giét-xi, công chúa");
});

it("nối qua đoạn chỉ-toàn-khoảng-trắng khi dấu cách là segment riêng", () => {
  const splitSegments = [
    { id: "a1", text: "cô", selectable: true },
    { id: "gap", text: " ", selectable: false },
    { id: "a2", text: "giáo", selectable: true },
    { id: "p", text: " và ", selectable: false },
    { id: "b1", text: "bạn bè", selectable: true },
  ];
  act(() =>
    root.render(
      <HighlightTextPlayer title="Q" segments={splitSegments} correctIds={["a1", "a2", "b1"]} submitted />,
    ),
  );
  expect(revealText()).toBe("cô giáo, bạn bè");
});

it("không hiện khối Đáp án đúng khi câu tự đánh giá hoặc không có khoá đáp án", () => {
  act(() =>
    root.render(
      <HighlightTextPlayer title="Q" segments={passage} correctIds={["w5"]} selfAssessment submitted />,
    ),
  );
  expect(container.textContent).not.toContain("Đáp án đúng");

  act(() =>
    root.render(<HighlightTextPlayer title="Q" segments={passage} correctIds={[]} submitted />),
  );
  expect(container.textContent).not.toContain("Đáp án đúng");
});

it("không lộ đáp án trước khi nộp bài", () => {
  act(() =>
    root.render(<HighlightTextPlayer title="Q" segments={passage} correctIds={["w5"]} />),
  );
  expect(container.textContent).not.toContain("Đáp án đúng");
});
