// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReviewQuestion } from "@/modules/student/api/practiceApi";
import { SolutionBlock } from "./SolutionBlock";

afterEach(cleanup);

function q(over: Partial<ReviewQuestion> = {}): ReviewQuestion {
  return {
    id: "q1",
    order: 0,
    question_text: "",
    question_type: "single_choice",
    payload: {},
    student_answer: null,
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

describe("SolutionBlock", () => {
  it("render lời giải rich từ payload.explanation", () => {
    render(
      <SolutionBlock
        question={q({
          payload: {
            explanation: { blocks: [{ type: "paragraph", text: "Vì 1+1=2" }] },
          },
        })}
      />,
    );
    expect(screen.getByText("Hướng dẫn giải")).toBeTruthy();
    expect(screen.getByText("Vì 1+1=2")).toBeTruthy();
  });

  it("rơi về lời giải chữ phẳng khi không có explanation", () => {
    render(<SolutionBlock question={q({ solution: "Nhân hai vế với 2" })} />);
    expect(screen.getByText("Nhân hai vế với 2")).toBeTruthy();
  });

  it("ẩn hoàn toàn khi câu chưa có lời giải", () => {
    const { container } = render(<SolutionBlock question={q()} />);
    expect(container.innerHTML).toBe("");
  });

  it("ẩn khi explanation rỗng — không hiện khối trắng", () => {
    const { container } = render(
      <SolutionBlock
        question={q({ payload: { explanation: { blocks: [] } } })}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});
