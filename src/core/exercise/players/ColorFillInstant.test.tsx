/**
 * Biến thể `color_fill` chấm ngay y hệt mọi biến thể trắc nghiệm khác
 * (Owner 4/8) — trước đây nó bị loại khỏi `useInstantGrading` bằng
 * `recordOnly || isColorFill` nên vẫn còn nút "Kiểm tra".
 *
 * Lý do ngoại lệ cũ ("chấm ngay sẽ xoá nét bút học sinh") không đúng bản chất:
 * color_fill là câu TRẮC NGHIỆM dạng tô màu, tô chỉ để ĐÁNH DẤU LỰA CHỌN. Nên
 * verdict tô đè xanh/đỏ lên thẻ là ĐÚNG Ý ĐỒ và test dưới đây ghim điều đó.
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
  { id: "A", text: "Cái bàn" },
  { id: "B", text: "Cái ghế" },
];
const correctIds = ["B"];

/** Xanh "correct" / đỏ "wrong" mà ColorFillChoiceButton tô đè lên thẻ. */
const CORRECT_FILL = "rgb(34, 197, 94)"; // #22c55e
const WRONG_FILL = "rgb(239, 68, 68)"; // #ef4444

function card(text: string): HTMLButtonElement {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')).find(
    (b) => b.textContent?.includes(text),
  )!;
}

function checkButton(): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Kiểm tra",
  );
}

function renderPlayer(props: Record<string, unknown> = {}) {
  act(() => root.render(null));
  act(() =>
    root.render(
      <MultiChoicePlayer
        title="Tô màu vào ô dưới từ ngữ chỉ đồ vật"
        variant="color_fill"
        options={options}
        correctIds={correctIds}
        {...props}
      />,
    ),
  );
}

it("color_fill chấm ngay: KHÔNG còn nút 'Kiểm tra' (theo gate !instant.active)", () => {
  renderPlayer();
  expect(checkButton()).toBeUndefined();
});

it("instantFeedback=false thì nút 'Kiểm tra' quay lại — nút không bị hard-code ẩn", () => {
  renderPlayer({ instantFeedback: false });
  expect(checkButton()).toBeTruthy();
});

it("tô ĐÚNG → chấm ngay correct, thẻ tô xanh verdict", () => {
  const onElementGraded = vi.fn();
  renderPlayer({ onElementGraded });

  act(() => card("Cái ghế").click());

  expect(onElementGraded).toHaveBeenCalledWith("B", "correct", undefined);
  expect(card("Cái ghế").style.backgroundColor).toBe(CORRECT_FILL);
});

it("tô SAI → chấm ngay incorrect, thẻ tô đỏ verdict", () => {
  const onElementGraded = vi.fn();
  renderPlayer({ onElementGraded });

  act(() => card("Cái bàn").click());

  expect(onElementGraded).toHaveBeenCalledWith("A", "incorrect", undefined);
  expect(card("Cái bàn").style.backgroundColor).toBe(WRONG_FILL);
  // Ô ĐÚNG chưa được chọn vẫn phải im — chấm ngay không được lộ đáp án.
  expect(card("Cái ghế").style.backgroundColor).toBe("");
});

it("chọn ĐỦ tập đúng → KHÔNG khoá câu (giống checkbox/circle chấm ngay)", () => {
  renderPlayer();

  // Tập đúng chỉ có "Cái ghế" — chọn xong là cả câu đúng.
  act(() => card("Cái ghế").click());

  // instant không khoá khi đúng: thẻ vẫn bấm được để đổi ý (bỏ chọn).
  expect(card("Cái ghế").disabled).toBe(false);
  act(() => card("Cái ghế").click());
  expect(card("Cái ghế").getAttribute("aria-checked")).toBe("false");
});

it("revealCorrect=false: sau submit, ô đúng CHƯA chọn vẫn không lộ", () => {
  act(() => root.render(null));
  act(() =>
    root.render(
      <GradeModeContext.Provider value={{ mode: "self", revealCorrect: false }}>
        <MultiChoicePlayer
          title="Tô màu vào ô dưới từ ngữ chỉ đồ vật"
          variant="color_fill"
          options={options}
          correctIds={correctIds}
          submitted
        />
      </GradeModeContext.Provider>,
    ),
  );

  expect(card("Cái ghế").style.backgroundColor).toBe("");
});
