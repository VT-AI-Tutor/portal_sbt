/**
 * Regression: câu "đánh dấu X vào ô ở hình ảnh" (image-choice nhiều lựa chọn) CÓ
 * đáp án đúng phải đẩy đáp án đang chọn lên cha (onAnswerChange) ngay khi chọn
 * MỘT PHẦN — không đợi chọn hết — để cha chấm/tự lưu được. Bản chất fix nằm ở
 * useInstantGrading.emit: report đáp án mỗi lần chấm phần tử (verdict
 * "incomplete" khi dở), không chỉ khi done. Bản gốc đầy đủ (kèm restore qua
 * initialAnswer) ở evo-books-web commit 14ba2d2 — studio chưa có kênh
 * initialAnswer nên chỉ kiểm phần đồng bộ đáp án.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ImageChoiceMultiPlayer } from "./ImageChoiceMultiPlayer";

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
  { id: "a", imageUrl: "a.png", text: "A" },
  { id: "b", imageUrl: "b.png", text: "B" },
  { id: "c", imageUrl: "c.png", text: "C" },
  { id: "d", imageUrl: "d.png", text: "D" },
];

it("chọn 1 ảnh (chưa chọn hết đáp án) vẫn onAnswerChange với ảnh đã chọn", () => {
  const onAnswerChange = vi.fn();
  act(() =>
    root.render(
      <ImageChoiceMultiPlayer
        title="Đánh dấu X"
        options={options}
        correctIds={["b", "c"]}
        onAnswerChange={onAnswerChange}
      />,
    ),
  );

  const cellB = Array.from(container.querySelectorAll("button")).find((btn) =>
    btn.textContent?.includes("B"),
  )!;
  act(() => cellB.dispatchEvent(new MouseEvent("click", { bubbles: true })));

  expect(onAnswerChange).toHaveBeenCalled();
  expect(onAnswerChange.mock.calls.at(-1)?.[0]).toEqual(["b"]);
});

it("chọn ĐỦ tập đáp án đúng → báo cả câu đúng (onStatusChange success) — SBT_4 #16", () => {
  // Câu chọn-nhiều-ảnh: verdict cả câu đến từ useInstantGrading.emit theo
  // expectedIds (khớp TẬP), không đợi chấm hết mọi ô. Tick đủ tập đúng b+c →
  // phải bắn "success" để mascot khen; trước khi có expectedIds, cả câu không
  // bao giờ đạt "success" (chỉ tô xanh từng ô) = "kiểm tra không hiện kết quả".
  const onStatusChange = vi.fn();
  act(() =>
    root.render(
      <ImageChoiceMultiPlayer
        title="Đánh dấu X"
        options={options}
        correctIds={["b", "c"]}
        onStatusChange={onStatusChange}
      />,
    ),
  );

  const cell = (t: string) =>
    Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes(t),
    )!;
  act(() => cell("B").dispatchEvent(new MouseEvent("click", { bubbles: true })));
  act(() => cell("C").dispatchEvent(new MouseEvent("click", { bubbles: true })));

  expect(onStatusChange).toHaveBeenCalledWith("success");
});

it("giữ checkbox nổi trên ảnh để không bị nội dung thẻ che mất", () => {
  act(() =>
    root.render(
      <ImageChoiceMultiPlayer
        title="Đánh dấu V"
        options={options}
        correctIds={["a"]}
      />,
    ),
  );

  const marker = container.querySelector<HTMLElement>('[aria-hidden="true"]')!;
  expect(marker.className).toContain("z-10");
  expect(marker.className).toContain("pointer-events-none");
});
