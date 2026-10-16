/**
 * Chốt chặn cho prop `revealCorrect` của QuestionPlayer (đồng bộ từ studio-web).
 *
 * Vì sao cần pin: web CỐ Ý mặc định `false` (BUG-03 — còn làm lại được thì lộ đáp
 * án là hỏng bài học). Nếu ai đó lỡ đổi mặc định thành `true`/`undefined`, MỌI bề
 * mặt đang làm bài sẽ lộ đáp án mà không test nào khác bắt được: các test dưới
 * `players/` bơm GradeModeContext thẳng nên không đi qua mặc định của file này.
 *
 * Phủ CẢ HAI đường lộ đáp án, vì chúng khác nhau về cơ chế:
 *  - player choice tự tô xanh ô đúng (đọc useGradeMode trong chính player)
 *  - 36 player còn lại qua PlayerShell → khối "Đáp án đúng" (answerReveal)
 */
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionPlayer } from "./QuestionPlayer";

vi.mock("./tasks/AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

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

function render(element: ReactElement) {
  act(() => root.render(element));
}

const radios = () =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));

const choiceQuestion = {
  id: "q1",
  question_type: "single_choice",
  payload: {
    content: { blocks: [{ type: "paragraph", text: "Thủ đô Việt Nam?" }] },
    options: [
      { id: "a", content: { blocks: [{ type: "paragraph", text: "Hà Nội" }] } },
      { id: "b", content: { blocks: [{ type: "paragraph", text: "Huế" }] } },
    ],
    correctAnswer: "a",
  },
};

const numericQuestion = {
  id: "q2",
  question_type: "numeric_answer",
  payload: {
    content: { blocks: [{ type: "paragraph", text: "3 + 1 = ?" }] },
    correctAnswer: 4,
  },
};

describe("QuestionPlayer — mặc định KHÔNG lộ đáp án (BUG-03)", () => {
  it("choice: chấm sai mà không truyền prop → ô đúng chưa chọn không tô xanh", () => {
    render(
      <QuestionPlayer
        question={choiceQuestion}
        index={0}
        answer="b"
        submitted
        gradeMode="parent"
        result="incorrect"
      />,
    );

    expect(radios()[0].className).not.toContain("green");
  });

  it("player dùng PlayerShell: không truyền prop → không có khối 'Đáp án đúng'", () => {
    render(
      <QuestionPlayer
        question={numericQuestion}
        index={0}
        answer="7"
        submitted
        gradeMode="parent"
        result="incorrect"
      />,
    );

    expect(container.textContent).not.toContain("Đáp án đúng");
  });
});

describe("QuestionPlayer — revealCorrect bật lộ đáp án cho màn xem lại", () => {
  it("choice: chấm sai + revealCorrect → ô đúng chưa chọn được tô xanh", () => {
    render(
      <QuestionPlayer
        question={choiceQuestion}
        index={0}
        answer="b"
        submitted
        gradeMode="parent"
        result="incorrect"
        revealCorrect
      />,
    );

    expect(radios()[0].className).toContain("green");
  });

  it("player dùng PlayerShell: revealCorrect → hiện khối 'Đáp án đúng' kèm giá trị", () => {
    render(
      <QuestionPlayer
        question={numericQuestion}
        index={0}
        answer="7"
        submitted
        gradeMode="parent"
        result="incorrect"
        revealCorrect
      />,
    );

    expect(container.textContent).toContain("Đáp án đúng");
    expect(container.textContent).toContain("4");
  });

  it("revealCorrect={false} tường minh vẫn phải giấu — không chỉ dựa vào mặc định", () => {
    render(
      <QuestionPlayer
        question={numericQuestion}
        index={0}
        answer="7"
        submitted
        gradeMode="parent"
        result="incorrect"
        revealCorrect={false}
      />,
    );

    expect(container.textContent).not.toContain("Đáp án đúng");
  });
});
