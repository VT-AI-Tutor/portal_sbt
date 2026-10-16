// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import type { ReviewQuestion } from "@/modules/student/api/practiceApi";
import { SessionReviewQuestions } from "./SessionReviewQuestions";

vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    submitted,
    result,
  }: {
    submitted?: boolean;
    result?: string;
  }) => (
    <div
      data-testid="player"
      data-submitted={String(submitted)}
      data-result={result ?? ""}
    />
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function q(over: Partial<ReviewQuestion> = {}): ReviewQuestion {
  return {
    id: "q1",
    order: 0,
    question_text: "1 + 1 = ?",
    question_type: "single_choice",
    payload: { options: ["A", "B"], correctAnswer: "A" },
    student_answer: "B",
    is_correct: false,
    gradable: true,
    points: 0,
    max_points: 1,
    tutor_tier_used: 0,
    difficulty: "easy",
    level_code: null,
    content_code: null,
    outcome_code: null,
    competency_code: null,
    component_code: null,
    level_label: null,
    content_label: null,
    outcome_label: null,
    competency_label: null,
    component_label: null,
    solution: null,
    ...over,
  };
}

describe("SessionReviewQuestions", () => {
  it("render tất cả câu theo thứ tự, không cần bấm mở", () => {
    render(
      <SessionReviewQuestions
        questions={[
          q(),
          q({ id: "q2", order: 1, is_correct: true, points: 1 }),
        ]}
      />,
    );
    expect(screen.getAllByTestId("player")).toHaveLength(2);
    expect(screen.getByText("Câu 1")).toBeTruthy();
    expect(screen.getByText("Câu 2")).toBeTruthy();
  });

  it("truyền trạng thái đã chấm xuống player", () => {
    render(<SessionReviewQuestions questions={[q()]} />);
    const player = screen.getByTestId("player");
    expect(player.dataset.submitted).toBe("true");
    expect(player.dataset.result).toBe("incorrect");
  });

  it("câu không tự chấm được hiện nhãn riêng, không đánh dấu sai", () => {
    render(
      <SessionReviewQuestions
        questions={[q({ gradable: false, is_correct: null })]}
      />,
    );
    expect(screen.getByText(/Chưa chấm tự động/)).toBeTruthy();
    expect(screen.getByTestId("player").dataset.result).toBe("incomplete");
  });

  it("chỉ hiện hướng dẫn giải ở câu sai", () => {
    render(
      <SessionReviewQuestions
        questions={[
          q({ id: "wrong", is_correct: false, solution: "Giải thích A" }),
          q({
            id: "right",
            order: 1,
            is_correct: true,
            points: 1,
            solution: "Giải thích B",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Giải thích A")).toBeTruthy();
    expect(screen.queryByText("Giải thích B")).toBeNull();
  });

  it("chặn tương tác — vùng câu hỏi là chỉ đọc", async () => {
    render(<SessionReviewQuestions questions={[q()]} />);
    const shell = screen.getByTestId("review-question-q1");
    expect(shell.getAttribute("aria-disabled")).toBe("true");
    expect(shell.className).toContain("pointer-events-none");
    await userEvent.click(shell);
  });
});
