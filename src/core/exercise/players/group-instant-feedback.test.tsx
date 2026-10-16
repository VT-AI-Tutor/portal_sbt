// @vitest-environment jsdom
/**
 * CHẤM NGAY trong NHÓM CÂU HỎI (question_group).
 *
 * Nhóm không tự chấm, nhưng verdict của TỪNG CÂU CON phải nổi lên host để
 * mascot nói được: mỗi câu con chấm xong → onElementGraded(childId, verdict);
 * chấm hết mà đúng cả → onStatusChange("success") (lời khen cả câu).
 * Trước đây QuestionGroupPlayer truyền `onStatusChange: () => {}` cho câu con
 * nên mọi verdict của con bị nuốt — mascot đứng im trong nhóm.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { QuestionPlayer, type PlayerQuestion } from "../QuestionPlayer";

afterEach(cleanup);

const groupQuestion: PlayerQuestion = {
  id: "g1",
  question_type: "question_group",
  payload: {
    sharedContent: "Đọc đoạn văn rồi trả lời.",
    children: [
      {
        id: "c1",
        type: "single_choice",
        content: "Câu 1",
        options: [
          { id: "A", text: "Con mèo" },
          { id: "B", text: "Con chó" },
        ],
        correctAnswer: "A",
      },
      {
        id: "c2",
        type: "single_choice",
        content: "Câu 2",
        options: [
          { id: "A", text: "Màu đỏ" },
          { id: "B", text: "Màu xanh" },
        ],
        correctAnswer: "B",
      },
    ],
  },
};

describe("question_group — chấm ngay nổi lên host", () => {
  it("mỗi câu con chấm xong → host nhận onElementGraded", async () => {
    const user = userEvent.setup();
    const onElementGraded = vi.fn();
    const onStatusChange = vi.fn();

    render(
      <QuestionPlayer
        question={groupQuestion}
        index={0}
        onElementGraded={onElementGraded}
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getByText("Con mèo"));

    expect(onElementGraded).toHaveBeenCalledWith("c1", "correct");
  });

  it("chọn sai ở câu con → host nhận verdict incorrect", async () => {
    const user = userEvent.setup();
    const onElementGraded = vi.fn();

    render(
      <QuestionPlayer question={groupQuestion} index={0} onElementGraded={onElementGraded} />,
    );

    await user.click(screen.getByText("Con chó"));

    expect(onElementGraded).toHaveBeenCalledWith("c1", "incorrect");
  });

  it("đúng hết mọi câu con → host nhận status success (lời khen cả câu)", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(
      <QuestionPlayer question={groupQuestion} index={0} onStatusChange={onStatusChange} />,
    );

    await user.click(screen.getByText("Con mèo"));
    expect(onStatusChange).not.toHaveBeenCalledWith("success");

    await user.click(screen.getByText("Màu xanh"));
    expect(onStatusChange).toHaveBeenCalledWith("success");
  });

  it("chấm hết nhưng còn câu con sai → host nhận status error, KHÔNG success", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    render(
      <QuestionPlayer question={groupQuestion} index={0} onStatusChange={onStatusChange} />,
    );

    await user.click(screen.getByText("Con mèo"));
    await user.click(screen.getByText("Màu đỏ"));

    expect(onStatusChange).toHaveBeenCalledWith("error");
    expect(onStatusChange).not.toHaveBeenCalledWith("success");
  });

  it("chấm KÍN (gradeMode parent) → không lộ verdict câu con", async () => {
    const user = userEvent.setup();
    const onElementGraded = vi.fn();
    const onStatusChange = vi.fn();

    render(
      <QuestionPlayer
        question={groupQuestion}
        index={0}
        gradeMode="parent"
        onElementGraded={onElementGraded}
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getByText("Con mèo"));

    expect(onElementGraded).not.toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalledWith("success");
    expect(onStatusChange).not.toHaveBeenCalledWith("error");
  });
});
