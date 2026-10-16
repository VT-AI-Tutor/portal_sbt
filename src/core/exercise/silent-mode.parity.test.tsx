/**
 * CHẤM CÂM phải chấm CHÍNH XÁC BẰNG chấm ngay — không phải "gần bằng".
 *
 * Chấm ngay: player tự chấm theo ngữ nghĩa loại của CHÍNH NÓ rồi báo verdict
 * qua `onStatusChange`; runner tin verdict đó để ghi điểm. Chấm kín trước đây
 * vứt verdict ấy đi (`useGrading.report` return sớm ở mode "parent"), nên mọi
 * câu phải chấm lại bằng bộ chấm ngoài `gradeByType` — và bộ đó không hiểu hết
 * mọi phương ngữ dữ liệu (đã có ca `multi_true_false` chấm sai câu đúng).
 *
 * Kênh `onSilentVerdict` giữ lại đúng verdict của player mà không hiển thị gì.
 * Test này lái PLAYER THẬT ở cả hai chế độ với cùng thao tác và ghim: verdict
 * hai bên GIỐNG NHAU, chấm câm không kêu tiếng nào, và không mọc nút "Kiểm tra".
 */
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionPlayer, type PlayerQuestion } from "./QuestionPlayer";
import { playError, playSuccess } from "./tasks/AudioUtils";

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
  vi.clearAllMocks();
});

function render(element: ReactElement) {
  act(() => root.render(element));
}

function clickText(text: string) {
  const el = Array.from(container.querySelectorAll("button")).find(
    // Thẻ đáp án gói cả nhãn "A." nên khớp CHỨA, không khớp tuyệt đối.
    (b) => (b.textContent ?? "").includes(text),
  );
  if (!el) throw new Error(`Không thấy nút "${text}"`);
  act(() => el.click());
}

const richText = (text: string) => ({ blocks: [{ type: "paragraph", text }] });

/** Mỗi ca: đề bài + chuỗi thao tác dẫn tới một đáp án XÁC ĐỊNH. */
const CASES: Array<{
  name: string;
  question: PlayerQuestion;
  play: () => void;
  expected: "correct" | "incorrect";
}> = [
  {
    name: "single_choice — chọn đúng",
    question: {
      id: "q1",
      question_type: "single_choice",
      payload: {
        type: "single_choice",
        content: richText("Thủ đô Việt Nam?"),
        options: [
          { id: "A", content: richText("Huế") },
          { id: "B", content: richText("Hà Nội") },
        ],
        correctAnswer: "B",
      },
    },
    play: () => clickText("Hà Nội"),
    expected: "correct",
  },
  {
    name: "single_choice — chọn sai",
    question: {
      id: "q2",
      question_type: "single_choice",
      payload: {
        type: "single_choice",
        content: richText("Thủ đô Việt Nam?"),
        options: [
          { id: "A", content: richText("Huế") },
          { id: "B", content: richText("Hà Nội") },
        ],
        correctAnswer: "B",
      },
    },
    play: () => clickText("Huế"),
    expected: "incorrect",
  },
  {
    name: "multi_true_false — khoá dạng Record (dạng chính tắc)",
    question: {
      id: "q3",
      question_type: "multi_true_false",
      payload: {
        type: "multi_true_false",
        content: richText("Đúng hay Sai?"),
        statements: [
          { id: "s1", content: richText("Hà Nội là thủ đô") },
          { id: "s2", content: richText("Cá biết bay") },
        ],
        correctAnswer: { s1: true, s2: false },
      },
    },
    play: () => {
      // Bảng Đ/S: mỗi hàng hai ô "Đ" / "S", bấm theo thứ tự hàng.
      const cells = Array.from(container.querySelectorAll("button")).filter(
        (b) => ["Đ", "S"].includes((b.textContent ?? "").trim()),
      );
      act(() => cells[0].click()); // s1 → Đ
      act(() => cells[3].click()); // s2 → S
    },
    expected: "correct",
  },
];

describe("chấm câm ↔ chấm ngay: verdict phải trùng khớp", () => {
  for (const c of CASES) {
    it(`${c.name}`, () => {
      // Chấm ngay: player tự chấm, báo qua onStatusChange.
      const onStatusChange = vi.fn();
      render(
        <QuestionPlayer
          question={c.question}
          index={0}
          onStatusChange={onStatusChange}
        />,
      );
      c.play();
      const instantStatus = onStatusChange.mock.calls
        .map(([s]) => s)
        .filter((s) => s === "success" || s === "error")
        .pop();
      expect(instantStatus).toBe(c.expected === "correct" ? "success" : "error");

      // Chấm kín: cùng thao tác, verdict về qua kênh câm.
      act(() => root.unmount());
      container.remove();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      vi.clearAllMocks();

      const onSilentVerdict = vi.fn();
      const sealedStatusChange = vi.fn();
      render(
        <QuestionPlayer
          question={c.question}
          index={0}
          gradeMode="silent"
          onSilentVerdict={onSilentVerdict}
          onStatusChange={sealedStatusChange}
        />,
      );
      c.play();

      const sealedVerdict = onSilentVerdict.mock.calls
        .map(([v]) => v)
        .filter((v) => v !== "incomplete")
        .pop();
      expect(sealedVerdict).toBe(c.expected);

      // …và tuyệt đối im lặng: không status thật, không âm thanh.
      expect(
        sealedStatusChange.mock.calls.map(([s]) => s).filter((s) => s !== "idle"),
      ).toEqual([]);
      expect(playSuccess).not.toHaveBeenCalled();
      expect(playError).not.toHaveBeenCalled();
    });
  }

  // Bảng Đ/S chấm theo TỪNG ô nên là ca duy nhất quan sát được onElementGraded.
  it("chấm câm KHÔNG phát onElementGraded (kênh mascot của runner)", () => {
    const c = CASES[2];
    const onElementGraded = vi.fn();
    render(
      <QuestionPlayer
        question={c.question}
        index={0}
        gradeMode="silent"
        onElementGraded={onElementGraded}
      />,
    );
    c.play();
    expect(onElementGraded).not.toHaveBeenCalled();
  });

  it("chấm ngay VẪN phát onElementGraded — không đổi hành vi mặc định", () => {
    const c = CASES[2];
    const onElementGraded = vi.fn();
    render(
      <QuestionPlayer question={c.question} index={0} onElementGraded={onElementGraded} />,
    );
    c.play();
    expect(onElementGraded).toHaveBeenCalled();
  });

  it("chấm câm KHÔNG khoá câu khi làm đúng — học sinh còn sửa được", () => {
    const c = CASES[0]; // single_choice, đáp án đúng
    render(<QuestionPlayer question={c.question} index={0} gradeMode="silent" />);
    c.play();
    const stillClickable = Array.from(container.querySelectorAll("button")).some(
      (b) => (b.textContent ?? "").includes("Huế") && !b.disabled,
    );
    expect(stillClickable).toBe(true);
  });

  it("chấm câm: ResultBanner chỉ hiện SAU khi nộp", () => {
    const c = CASES[0];
    render(<QuestionPlayer question={c.question} index={0} gradeMode="silent" />);
    c.play();
    expect(container.textContent).not.toContain("Đúng rồi");

    act(() =>
      root.render(
        <QuestionPlayer question={c.question} index={0} gradeMode="silent" submitted />,
      ),
    );
    expect(container.textContent).toContain("Đúng rồi");
  });

  it('chấm câm KHÔNG mọc nút "Kiểm tra" ở bất kỳ ca nào', () => {
    for (const c of CASES) {
      act(() => root.render(<QuestionPlayer question={c.question} index={0} gradeMode="silent" />));
      const labels = Array.from(container.querySelectorAll("button")).map((b) =>
        (b.textContent ?? "").trim(),
      );
      expect(labels).not.toContain("Kiểm tra");
    }
  });
});
