/**
 * Instant per-option grading for MultiChoicePlayer (multiple_choice ·
 * checkbox/circle/color_fill): mỗi Ô là một phần tử — tick là chấm ngay, không
 * chờ nút "Kiểm tra" (nút đó biến mất ở chế độ chấm ngay). Đưa player này về
 * cùng hành vi với 2 interaction anh em cùng type đã instant từ trước
 * (TileSelectPlayer cho `button`, ImageChoiceMultiPlayer cho `image`).
 *
 * Verdict CẢ CÂU: chỉ báo "correct" khi tập đã chọn KHỚP đáp án — useInstantGrading
 * tự nó không bao giờ "xong" ở câu nhiều lựa chọn (học sinh không tick hết mọi ô).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MultiChoicePlayer } from "./MultiChoicePlayer";
import { GradeModeContext } from "./shared";

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

const options = [
  { id: "A", text: "Cảnh sát bảo vệ an ninh Tổ quốc." },
  { id: "B", text: "Người lao động trí óc." },
  { id: "C", text: "Người lao động chân tay." },
];
const correctIds = ["B", "C"];

function optionButton(text: string): HTMLButtonElement {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')).find(
    (b) => b.textContent?.includes(text),
  )!;
}

function checkButton(): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Kiểm tra",
  );
}

it("tick ô đúng → chấm ngay correct, không cần nút Kiểm tra", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <MultiChoicePlayer
        title="Chọn đáp án đúng"
        options={options}
        correctIds={correctIds}
        onElementGraded={onElementGraded}
      />,
    ),
  );

  act(() => optionButton("trí óc").click());

  expect(onElementGraded).toHaveBeenCalledWith("B", "correct", undefined);
  expect(checkButton()).toBeUndefined();
});

it("tick ô sai → chấm ngay incorrect và tô đỏ chính ô đó", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <MultiChoicePlayer
        title="Chọn đáp án đúng"
        options={options}
        correctIds={correctIds}
        onElementGraded={onElementGraded}
      />,
    ),
  );

  const wrong = optionButton("Cảnh sát");
  act(() => wrong.click());

  expect(onElementGraded).toHaveBeenCalledWith("A", "incorrect", undefined);
  expect(wrong.className).toMatch(/red/);
});

it("bỏ tick → xoá verdict của ô đó", () => {
  const onProgress = vi.fn();
  act(() =>
    root.render(
      <MultiChoicePlayer
        title="Chọn đáp án đúng"
        options={options}
        correctIds={correctIds}
        onProgress={onProgress}
      />,
    ),
  );

  const wrong = optionButton("Cảnh sát");
  act(() => wrong.click());
  expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ wrong: 1 }));

  act(() => wrong.click());
  expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ wrong: 0, correct: 0 }));
});

it('chọn đủ và đúng tập đáp án → báo verdict "correct" cho cả câu', () => {
  const onStatusChange = vi.fn();
  act(() =>
    root.render(
      <MultiChoicePlayer
        title="Chọn đáp án đúng"
        options={options}
        correctIds={correctIds}
        onStatusChange={onStatusChange}
      />,
    ),
  );

  act(() => optionButton("trí óc").click());
  expect(onStatusChange).not.toHaveBeenCalledWith("success");

  act(() => optionButton("chân tay").click());
  expect(onStatusChange).toHaveBeenCalledWith("success");
});

it("mới tick một phần đáp án đúng → KHÔNG báo sai cả câu", () => {
  const onStatusChange = vi.fn();
  act(() =>
    root.render(
      <MultiChoicePlayer
        title="Chọn đáp án đúng"
        options={options}
        correctIds={correctIds}
        onStatusChange={onStatusChange}
      />,
    ),
  );

  act(() => optionButton("trí óc").click());

  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  expect(onStatusChange).not.toHaveBeenCalledWith("success");
});

it("bỏ tick đáp án KHÔI PHỤC (quay lại câu) → đẩy đáp án rỗng lên cha (SBT_3 #35)", () => {
  // Mô phỏng quay lại câu: `answer` khôi phục ô B (picked=[B]) nhưng verdict map
  // rỗng (chưa chấm ô nào trong lần mount này). Bỏ tick B phải sync [] lên cha —
  // trước fix clear() early-return khi id chưa graded nên cha giữ [B], hydrate
  // lại → không bỏ chọn được.
  const onAnswerChange = vi.fn();
  act(() =>
    root.render(
      <MultiChoicePlayer
        title="Chọn đáp án đúng"
        options={options}
        correctIds={correctIds}
        answer={["B"]}
        onAnswerChange={onAnswerChange}
      />,
    ),
  );

  onAnswerChange.mockClear();
  act(() => optionButton("trí óc").click()); // bỏ tick B

  expect(onAnswerChange).toHaveBeenCalledWith([]);
});

it("instantFeedback=false → giữ nguyên đường cũ: có nút Kiểm tra, tick không chấm", () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <MultiChoicePlayer
        title="Chọn đáp án đúng"
        options={options}
        correctIds={correctIds}
        instantFeedback={false}
        onElementGraded={onElementGraded}
      />,
    ),
  );

  act(() => optionButton("Cảnh sát").click());

  expect(onElementGraded).not.toHaveBeenCalled();
  expect(checkButton()).toBeDefined();
});

it("chấm kín (gradeMode parent) → không lộ verdict từng ô", () => {
  const onElementGraded = vi.fn();
  const onStatusChange = vi.fn();
  // gradeMode tới player qua GradeModeContext (dispatch bọc Provider), KHÔNG
  // phải prop trực tiếp — truyền prop là test tự lừa mình.
  act(() =>
    root.render(
      <GradeModeContext.Provider value={{ mode: "parent" }}>
        <MultiChoicePlayer
          title="Chọn đáp án đúng"
          options={options}
          correctIds={correctIds}
          onElementGraded={onElementGraded}
          onStatusChange={onStatusChange}
        />
      </GradeModeContext.Provider>,
    ),
  );

  const wrong = optionButton("Cảnh sát");
  act(() => wrong.click());

  expect(wrong.className).not.toMatch(/red/);
  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  expect(onStatusChange).not.toHaveBeenCalledWith("success");
});
