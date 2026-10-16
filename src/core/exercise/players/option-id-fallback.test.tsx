// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionPlayer } from "@/core/exercise/QuestionPlayer";

/**
 * Phương án THIẾU `id` (một phương ngữ payload có thật) từng để `undefined` chảy
 * xuống player: React mất `key` (cảnh báo "unique key prop"), và cả lựa chọn của
 * học sinh lẫn phép so với `correctAnswer` đều là `undefined` — bấm gì cũng
 * không ăn. Nay rơi về chữ cái theo vị trí, đúng chữ cái đang hiện trên màn.
 */
const payload = {
  content: "Chọn số lớn nhất",
  options: [{ content: "5" }, { content: "4" }, { content: "8" }],
  correctAnswer: "C",
};

afterEach(cleanup);

function renderQ(onAnswerChange?: (a: unknown) => void) {
  return render(
    <QuestionPlayer
      question={{ id: "q1", question_type: "single_choice", payload } as never}
      index={0}
      onAnswerChange={onAnswerChange}
    />,
  );
}

describe("phương án thiếu id", () => {
  it("không còn cảnh báo key của React", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderQ();
    const keyWarnings = spy.mock.calls
      .map((c) => c.map(String).join(" "))
      .filter((m) => m.includes("unique"));
    spy.mockRestore();
    expect(keyWarnings).toEqual([]);
  });

  it("báo lên trên chữ cái theo vị trí chứ không phải undefined", () => {
    const onAnswerChange = vi.fn();
    renderQ(onAnswerChange);

    const third = screen.getAllByRole("radio")[2];
    fireEvent.click(third);

    expect(onAnswerChange).toHaveBeenCalledWith("C");
  });
});

/**
 * `id` là CHUỖI RỖNG — đường nhập QTI đặt `""` khi file nguồn không khai
 * `identifier`. `??` bỏ lọt `""`, mà `""` hỏng nặng hơn `undefined`: mọi phương
 * án cùng `key=""` nên React coi là một, và `select("")` không khớp
 * `correctAnswer` nào.
 */
describe("phương án có id là chuỗi rỗng", () => {
  const emptyIdPayload = {
    content: "Chọn số lớn nhất",
    options: [
      { id: "", content: "5" },
      { id: "", content: "4" },
      { id: "  ", content: "8" },
    ],
    correctAnswer: "C",
  };

  function renderEmpty(onAnswerChange?: (a: unknown) => void) {
    return render(
      <QuestionPlayer
        question={{ id: "q1", question_type: "single_choice", payload: emptyIdPayload } as never}
        index={0}
        onAnswerChange={onAnswerChange}
      />,
    );
  }

  it("không còn cảnh báo key của React", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderEmpty();
    const keyWarnings = spy.mock.calls
      .map((c) => c.map(String).join(" "))
      .filter((m) => m.includes("unique"));
    spy.mockRestore();
    expect(keyWarnings).toEqual([]);
  });

  it("báo lên trên chữ cái theo vị trí chứ không phải chuỗi rỗng", () => {
    const onAnswerChange = vi.fn();
    renderEmpty(onAnswerChange);

    const third = screen.getAllByRole("radio")[2];
    fireEvent.click(third);

    expect(onAnswerChange).toHaveBeenCalledWith("C");
  });
});
