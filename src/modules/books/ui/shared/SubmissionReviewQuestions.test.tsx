// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SubmissionReviewQuestion } from "@/modules/books/api/assessmentApi";
import { SubmissionReviewQuestions } from "./SubmissionReviewQuestions";

vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    submitted,
    result,
    revealCorrect,
  }: {
    submitted?: boolean;
    result?: string;
    revealCorrect?: boolean;
  }) => (
    <div
      data-testid="player"
      data-submitted={String(submitted)}
      data-result={result ?? ""}
      data-reveal={String(revealCorrect)}
    />
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function q(
  over: Partial<SubmissionReviewQuestion> = {},
): SubmissionReviewQuestion {
  return {
    id: "q1",
    order: 0,
    type: "single_choice",
    content: "1 + 1 = ?",
    options: [],
    payload: { options: [], correctAnswer: "A" },
    studentAnswer: "B",
    isCorrect: false,
    gradable: true,
    points: 0,
    maxPoints: 1,
    teacherComment: null,
    fileCount: 0,
    ...over,
  };
}

describe("SubmissionReviewQuestions", () => {
  it("render tất cả câu theo thứ tự", () => {
    render(
      <SubmissionReviewQuestions
        questions={[q(), q({ id: "q2", order: 1, isCorrect: true, points: 1 })]}
        revealAnswers
      />,
    );

    expect(screen.getAllByTestId("player")).toHaveLength(2);
    expect(screen.getByText("Câu 1")).toBeTruthy();
    expect(screen.getByText("Câu 2")).toBeTruthy();
    expect(screen.getByText("0/1")).toBeTruthy();
    expect(screen.getByText("1/1")).toBeTruthy();
  });

  it("truyền trạng thái đã chấm xuống player", () => {
    render(<SubmissionReviewQuestions questions={[q()]} revealAnswers />);

    const player = screen.getByTestId("player");
    expect(player.dataset.submitted).toBe("true");
    expect(player.dataset.result).toBe("incorrect");
  });

  it("revealAnswers được chuyển thành revealCorrect của player", () => {
    render(<SubmissionReviewQuestions questions={[q()]} revealAnswers />);
    expect(screen.getByTestId("player").dataset.reveal).toBe("true");
  });

  it("bài giấu đáp án: player nhận revealCorrect=false", () => {
    render(
      <SubmissionReviewQuestions questions={[q()]} revealAnswers={false} />,
    );
    expect(screen.getByTestId("player").dataset.reveal).toBe("false");
  });

  it("câu chấm tay: nhãn 'Chờ chấm', KHÔNG đánh dấu sai", () => {
    render(
      <SubmissionReviewQuestions
        questions={[q({ gradable: false, isCorrect: null })]}
        revealAnswers
      />,
    );

    expect(screen.getByText("Chờ chấm")).toBeTruthy();
    expect(screen.getByTestId("player").dataset.result).toBe("incomplete");
  });

  it("câu bỏ trống: nhãn 'Chưa trả lời', KHÔNG đánh dấu sai dù server chấm sai", () => {
    render(
      <SubmissionReviewQuestions
        questions={[q({ studentAnswer: null, isCorrect: false })]}
        revealAnswers
      />,
    );

    expect(screen.getByText("Chưa trả lời")).toBeTruthy();
    expect(screen.getByTestId("player").dataset.result).toBe("incomplete");
    // Vẫn phải lộ đáp án đúng — bỏ trống là lúc học sinh cần biết nhất.
    expect(screen.getByTestId("player").dataset.reveal).toBe("true");
  });

  it("KHÔNG render lời giải tác giả kể cả khi payload còn sót explanation", () => {
    render(
      <SubmissionReviewQuestions
        questions={[
          q({
            payload: {
              correctAnswer: "A",
              explanation: {
                blocks: [{ type: "paragraph", text: "GIẢNG BÀI" }],
              },
              solution: "LỜI GIẢI PHẲNG",
            },
          }),
        ]}
        revealAnswers
      />,
    );

    expect(screen.queryByText(/GIẢNG BÀI/)).toBeNull();
    expect(screen.queryByText(/LỜI GIẢI PHẲNG/)).toBeNull();
    expect(screen.queryByText(/Hướng dẫn giải/)).toBeNull();
  });

  it("hiện số tệp đính kèm và nhận xét từng câu của giáo viên", () => {
    render(
      <SubmissionReviewQuestions
        questions={[
          q({
            fileCount: 2,
            teacherComment: "Cần viết dài hơn",
            gradable: false,
          }),
        ]}
        revealAnswers
      />,
    );

    expect(screen.getByText(/Đã nộp 2 tệp đính kèm/)).toBeTruthy();
    expect(screen.getByText("Cần viết dài hơn")).toBeTruthy();
  });

  it("chặn tương tác — vùng câu hỏi là chỉ đọc", async () => {
    render(<SubmissionReviewQuestions questions={[q()]} revealAnswers />);

    const shell = screen.getByTestId("review-question-q1");
    expect(shell.getAttribute("aria-disabled")).toBe("true");
    expect(shell.className).toContain("pointer-events-none");
    await userEvent.click(shell);
  });

  it("không có câu nào thì không render gì", () => {
    const { container } = render(
      <SubmissionReviewQuestions questions={[]} revealAnswers />,
    );
    expect(container.textContent).toBe("");
  });
});

// SBT-61: câu tự viết / tự vẽ không đáp án — học sinh thấy "Đã ghi nhận" (khớp
// dòng trong câu); giáo viên vẫn thấy "Chờ chấm".
describe("SubmissionReviewQuestions — nhãn câu tự viết", () => {
  const ungradable = { gradable: false, isCorrect: null, studentAnswer: "bài" };

  it.each([
    ["essay", { type: "essay" }],
    ["bài vẽ", { type: "drawing" }],
    ["trả lời ngắn không key", { type: "fill_blank", payload: { display: { interactionType: "short_text" } } }],
  ])("%s: học sinh thấy 'Đã ghi nhận', không 'Chờ chấm'", (_name, over) => {
    render(<SubmissionReviewQuestions questions={[q({ ...ungradable, ...over })]} revealAnswers />);
    expect(screen.getByText("Đã ghi nhận")).toBeTruthy();
    expect(screen.queryByText("Chờ chấm")).toBeNull();
  });

  it("câu nhóm chứa essay (cạnh câu trắc nghiệm): học sinh thấy 'Đã ghi nhận'", () => {
    const payload = {
      subQuestions: [
        { id: "c1", type: "single_choice", correctAnswer: "a" },
        { id: "c2", type: "essay" },
      ],
    };
    render(
      <SubmissionReviewQuestions
        questions={[q({ ...ungradable, type: "question_group", payload })]}
        revealAnswers
      />,
    );
    expect(screen.getByText("Đã ghi nhận")).toBeTruthy();
  });

  it("câu con chỉ mang question_type (không có type) vẫn được nhận là câu tự viết", () => {
    const payload = { subQuestions: [{ id: "c1", question_type: "essay" }] };
    render(
      <SubmissionReviewQuestions
        questions={[q({ ...ungradable, type: "question_group", payload })]}
        revealAnswers
      />,
    );
    expect(screen.getByText("Đã ghi nhận")).toBeTruthy();
  });

  it("câu nhóm có cả upload: vẫn 'Chờ chấm' — upload ngoài phạm vi", () => {
    const payload = {
      subQuestions: [
        { id: "c1", type: "essay" },
        { id: "c2", type: "upload_answer" },
      ],
    };
    render(
      <SubmissionReviewQuestions
        questions={[q({ ...ungradable, type: "question_group", payload })]}
        revealAnswers
      />,
    );
    expect(screen.getByText("Chờ chấm")).toBeTruthy();
  });

  it("màn giáo viên giữ 'Chờ chấm'", () => {
    render(
      <SubmissionReviewQuestions
        questions={[q({ ...ungradable, type: "essay" })]}
        revealAnswers
        teacherView
      />,
    );
    expect(screen.getByText("Chờ chấm")).toBeTruthy();
  });

  it("loại chấm tay khác (upload) vẫn 'Chờ chấm' — ngoài phạm vi", () => {
    render(<SubmissionReviewQuestions questions={[q({ ...ungradable, type: "upload_answer" })]} revealAnswers />);
    expect(screen.getByText("Chờ chấm")).toBeTruthy();
  });

  it.each([
    ["essay", ""],
    ["drawing", null],
  ])("%s bỏ trống mà server trả gradable:false: 'Chưa trả lời', không 'Đã ghi nhận'", (type, studentAnswer) => {
    render(
      <SubmissionReviewQuestions
        questions={[q({ type, gradable: false, isCorrect: null, studentAnswer })]}
        revealAnswers
      />,
    );
    expect(screen.getByText("Chưa trả lời")).toBeTruthy();
    expect(screen.queryByText("Đã ghi nhận")).toBeNull();
  });

  it("essay bỏ trống vẫn là 'Chưa trả lời'", () => {
    render(
      <SubmissionReviewQuestions
        questions={[q({ type: "essay", gradable: true, isCorrect: false, studentAnswer: "" })]}
        revealAnswers
      />,
    );
    expect(screen.getByText("Chưa trả lời")).toBeTruthy();
  });
});
