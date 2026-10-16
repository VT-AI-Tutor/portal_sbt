/**
 * Instant per-element grading for CategorizePlayer: each ITEM is one element;
 * dropping it into a bucket grades that item immediately — the chip turns
 * red/green without waiting for "Kiểm tra". Returning it to the tray clears
 * it back to idle.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CategorizePlayer } from "./CategorizePlayer";

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

const categories = [
  { id: "c1", label: "Động vật" },
  { id: "c2", label: "Thực vật" },
];
const items = [
  { id: "i1", text: "Chó" },
  { id: "i2", text: "Hoa hồng" },
];
const correctMappings = { i1: "c1", i2: "c2" };

// Item chips are <button>s; category buckets are plain <div onClick>s with
// the label rendered in a nested <h3>. Click a button match first, and fall
// back to an h3 (bubbles up to the bucket's onClick) otherwise.
function clickText(t: string) {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(t),
  );
  const target = btn ?? Array.from(container.querySelectorAll("h3")).find((h) =>
    h.textContent?.includes(t),
  );
  act(() => target!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

it('emits onElementGraded("incorrect") and turns the chip red when dropped into a wrong bucket', () => {
  const onElementGraded = vi.fn();
  act(() =>
    root.render(
      <CategorizePlayer
        title="Q"
        categories={categories}
        items={items}
        correctMappings={correctMappings}
        onElementGraded={onElementGraded}
      />,
    ),
  );
  clickText("Chó"); // select i1
  clickText("Thực vật"); // drop into wrong bucket (c2)
  expect(onElementGraded).toHaveBeenCalledWith("i1", "incorrect", undefined);
  const chip = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Chó"),
  )!;
  expect(chip.className).toMatch(/red/);
});

it("hides Kiểm tra when instant, shows it when instantFeedback=false", () => {
  act(() =>
    root.render(
      <CategorizePlayer
        title="Q"
        categories={categories}
        items={items}
        correctMappings={correctMappings}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Kiểm tra");

  act(() =>
    root.render(
      <CategorizePlayer
        title="Q"
        categories={categories}
        items={items}
        correctMappings={correctMappings}
        instantFeedback={false}
      />,
    ),
  );
  expect(container.textContent).toContain("Kiểm tra");
});

it("button mode: a wrong Kiểm tra shows red on the wrong chips + the feedback line, and rearranging clears it", () => {
  act(() =>
    root.render(
      <CategorizePlayer
        title="Q"
        categories={categories}
        items={items}
        correctMappings={correctMappings}
        instantFeedback={false}
      />,
    ),
  );
  clickText("Chó"); // select i1
  clickText("Thực vật"); // wrong bucket (c2)
  clickText("Hoa hồng"); // select i2
  clickText("Động vật"); // wrong bucket (c1)
  clickText("Kiểm tra");

  const chip = (t: string) =>
    Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(t))!;
  expect(chip("Chó").className).toMatch(/red/);
  expect(chip("Hoa hồng").className).toMatch(/red/);
  // Surface học sinh: dòng chữ phản hồi bị ẩn (presentation.hideInlineFeedback,
  // Owner 4/8) — phản hồi thật là MÀU per-element + âm thanh, assert quanh đây.
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
  // Correct placements are NOT revealed while the pupil can still retry.
  expect(chip("Chó").className).not.toMatch(/green/);

  clickText("Chó"); // chip in bucket -> returns to tray, clearing the error
  expect(container.textContent).not.toContain("Chưa đúng, thử lại nhé!");
  expect(chip("Chó").className).not.toMatch(/red/);
});

it("recordOnly (selfAssessment): no Kiểm tra button and no self-grading on host submit", () => {
  const onStatusChange = vi.fn();
  const renderPlayer = (submitted: boolean) =>
    act(() =>
      root.render(
        <CategorizePlayer
          title="Q"
          categories={categories}
          items={items}
          correctMappings={correctMappings}
          instantFeedback={false}
          selfAssessment
          submitted={submitted}
          onStatusChange={onStatusChange}
        />,
      ),
    );
  renderPlayer(false);
  clickText("Chó");
  clickText("Thực vật"); // "wrong" bucket — must not matter in recordOnly
  clickText("Hoa hồng");
  clickText("Động vật");
  expect(container.textContent).not.toContain("Kiểm tra");

  renderPlayer(true); // host submit — the player must never self-grade here
  expect(onStatusChange).not.toHaveBeenCalledWith("error");
  expect(onStatusChange).not.toHaveBeenCalledWith("success");
});

it("a correct placement turns the chip green immediately, and returning it to the tray clears it back to idle", () => {
  act(() =>
    root.render(
      <CategorizePlayer
        title="Q"
        categories={categories}
        items={items}
        correctMappings={correctMappings}
      />,
    ),
  );
  clickText("Chó"); // select i1
  clickText("Động vật"); // drop into correct bucket (c1)
  const chip = () =>
    Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Chó"),
    )!;
  expect(chip().className).toMatch(/green/);

  clickText("Chó"); // click chip while in bucket -> returns to tray
  expect(chip().className).not.toMatch(/green/);
  expect(chip().className).not.toMatch(/red/);
});
