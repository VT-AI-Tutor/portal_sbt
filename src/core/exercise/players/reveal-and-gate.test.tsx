/**
 * Bước A đồng bộ studio↔web — nhóm choice/matching/blank:
 *
 * 1. revealCorrect=false (web BUG-03): sau submit, ô ĐÚNG chỉ được tô xanh khi
 *    học sinh ĐÃ CHỌN nó — ô đúng chưa chọn giữ nguyên để review/retry không lộ
 *    đáp án. Mặc định (không set) pin hành vi studio: tô xanh ô đúng.
 * 2. mode "parent": nút tự-chấm "Kiểm tra" bị ẩn (cha chấm) — kiểm cho nhóm
 *    matching vừa được gate.
 * 3. Kênh answer sống (web-parity): Cloze hydrate từ prop `answer` và emit
 *    onAnswerChange theo từng lần gõ; MultiChoice emit theo từng toggle.
 */
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GradeModeContext, type GradeModeValue } from "./shared";
import { SingleChoicePlayer } from "./SingleChoicePlayer";
import { MultiChoicePlayer } from "./MultiChoicePlayer";
import { TwoColumnMatchPlayer } from "./TwoColumnMatchPlayer";
import { ConnectLinesPlayer } from "./ConnectLinesPlayer";
import { MatchRowsPlayer } from "./MatchRowsPlayer";
import { MatchingScenePlayer } from "./MatchingScenePlayer";
import { ClozePlayer } from "./ClozePlayer";
import { typeBlur } from "./instant-test-utils";

vi.mock("../tasks/AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

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
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 100,
    bottom: 40,
    width: 100,
    height: 40,
    toJSON: () => ({}),
  } as DOMRect);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(element: ReactElement, gradeMode?: GradeModeValue) {
  act(() =>
    root.render(
      gradeMode ? (
        <GradeModeContext.Provider value={gradeMode}>{element}</GradeModeContext.Provider>
      ) : (
        element
      ),
    ),
  );
}

const radios = () =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
const checkboxes = () =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]'));

describe("revealCorrect=false (web BUG-03) — choice players", () => {
  it("SingleChoice: submitted + sai → ô đúng CHƯA chọn không tô xanh, ô sai đã chọn vẫn đỏ", () => {
    render(
      <SingleChoicePlayer
        title="Chọn đáp án"
        options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
        correctId="a"
        answer="b"
        submitted
      />,
      { mode: "parent", result: "incorrect", revealCorrect: false },
    );
    const options = radios();
    expect(options[0].className).not.toContain("green");
    expect(options[1].className).toContain("red");
  });

  it("SingleChoice: submitted + ĐÃ chọn đúng → vẫn tô xanh dù revealCorrect=false", () => {
    render(
      <SingleChoicePlayer
        title="Chọn đáp án"
        options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
        correctId="a"
        answer="a"
        submitted
      />,
      { mode: "parent", result: "correct", revealCorrect: false },
    );
    expect(radios()[0].className).toContain("green");
  });

  it("SingleChoice: mặc định (không revealCorrect) pin hành vi studio — tô xanh ô đúng chưa chọn", () => {
    render(
      <SingleChoicePlayer
        title="Chọn đáp án"
        options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
        correctId="a"
        answer="b"
        submitted
      />,
    );
    const options = radios();
    expect(options[0].className).toContain("green");
    expect(options[1].className).toContain("red");
  });

  it("MultiChoice: submitted + sai → ô đúng CHƯA chọn không tô xanh, ô sai đã chọn vẫn đỏ", () => {
    render(
      <MultiChoicePlayer
        title="Chọn các đáp án"
        options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
        correctIds={["a"]}
        answer={["b"]}
        submitted
      />,
      { mode: "parent", result: "incorrect", revealCorrect: false },
    );
    const options = checkboxes();
    expect(options[0].className).not.toContain("green");
    expect(options[1].className).toContain("red");
  });

  it("MultiChoice: mặc định pin hành vi studio — tô xanh ô đúng chưa chọn sau submit", () => {
    render(
      <MultiChoicePlayer
        title="Chọn các đáp án"
        options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
        correctIds={["a"]}
        answer={["b"]}
        submitted
      />,
    );
    const options = checkboxes();
    expect(options[0].className).toContain("green");
    expect(options[1].className).toContain("red");
  });
});

const leftItems = [
  { id: "left-1", text: "Trái 1" },
  { id: "left-2", text: "Trái 2" },
];
const rightItems = [
  { id: "right-1", text: "Phải 1" },
  { id: "right-2", text: "Phải 2" },
];
const correctPairs = { "left-1": "right-1", "left-2": "right-2" };

describe('mode "parent" ẩn nút tự-chấm "Kiểm tra" — nhóm matching', () => {
  it("TwoColumnMatch: self hiện nút, parent ẩn nút", () => {
    const props = {
      title: "Nối cặp",
      leftItems,
      rightItems,
      correctPairs,
      instantFeedback: false,
    };
    render(<TwoColumnMatchPlayer {...props} />);
    expect(container.textContent).toContain("Kiểm tra");

    render(<TwoColumnMatchPlayer {...props} />, { mode: "parent" });
    expect(container.textContent).not.toContain("Kiểm tra");
  });

  it.each([
    ["ConnectLines", ConnectLinesPlayer],
    ["MatchRows", MatchRowsPlayer],
  ] as const)("%s: parent ẩn nút Kiểm tra", (_name, Player) => {
    render(
      <Player
        title="Nối cặp"
        leftItems={leftItems}
        rightItems={rightItems}
        correctPairs={correctPairs}
        instantFeedback={false}
      />,
      { mode: "parent" },
    );
    expect(container.textContent).not.toContain("Kiểm tra");
  });

  it("MatchingScene: self hiện nút, parent ẩn nút", () => {
    const props = {
      title: "Nối theo cảnh",
      nodes: [
        { id: "item-1", kind: "item" as const, x: 12, y: 24, label: "Vật 1" },
        { id: "target-1", kind: "target" as const, x: 82, y: 28, text: "Đích 1" },
      ],
      correctEdges: [{ item: "item-1", target: "target-1" }],
      instantFeedback: false,
    };
    render(<MatchingScenePlayer {...props} />);
    expect(container.textContent).toContain("Kiểm tra");

    render(<MatchingScenePlayer {...props} />, { mode: "parent" });
    expect(container.textContent).not.toContain("Kiểm tra");
  });
});

describe("kênh answer sống (web-parity)", () => {
  const lines = [
    {
      id: "L1",
      segments: [
        { text: "Bầu trời màu " },
        { blankId: "b1", acceptedAnswers: ["xanh"] },
      ],
    },
  ];

  it("Cloze: hydrate từ prop answer và emit onAnswerChange theo từng lần gõ", () => {
    const onAnswerChange = vi.fn();
    render(
      <ClozePlayer title="Q" lines={lines} answer={{ b1: "xa" }} onAnswerChange={onAnswerChange} />,
      { mode: "parent" },
    );
    const input = container.querySelector("input") as HTMLInputElement;
    // Khôi phục bản nháp từ prop answer.
    expect(input.value).toBe("xa");
    // Parent mode: không còn nút Kiểm tra — mỗi lần gõ phải emit thẳng.
    expect(container.textContent).not.toContain("Kiểm tra");
    typeBlur(input, "xanh");
    expect(onAnswerChange).toHaveBeenCalledWith({ b1: "xanh" });
  });

  it("MultiChoice: toggle emit đáp án hiện tại lên cha (parent mode, không cần nút)", () => {
    const onAnswerChange = vi.fn();
    render(
      <MultiChoicePlayer
        title="Chọn các đáp án"
        options={[{ id: "a", text: "Một" }, { id: "b", text: "Hai" }]}
        correctIds={["a"]}
        onAnswerChange={onAnswerChange}
      />,
      { mode: "parent" },
    );
    expect(container.textContent).not.toContain("Kiểm tra");
    act(() => checkboxes()[1].click());
    expect(onAnswerChange).toHaveBeenLastCalledWith(["b"]);
    act(() => checkboxes()[0].click());
    expect(onAnswerChange).toHaveBeenLastCalledWith(["b", "a"]);
  });
});
