/**
 * Fail-loud cho payload rỗng (issue #810).
 *
 * Trước đây `coloring` không vùng tô ra bảng màu trống và `crossword` không mục
 * ra lưới đen kịt — cả hai đều "chạy được" nên QA lẫn học sinh đều không thấy gì
 * bất thường. Test đi qua `renderInteractionPlayer` (ranh giới payload → player)
 * vì đó chính là chỗ hỏng.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

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
  vi.unstubAllGlobals();
});

function render(type: string, payload: Record<string, unknown>) {
  act(() => root.render(renderInteractionPlayer(type, { title: "Câu 1", ...payload }, {})));
  return container.querySelector<HTMLElement>("[data-renderer-diagnostic]");
}

describe("coloring không có vùng tô", () => {
  it("báo lỗi thay vì hiện bảng màu trống", () => {
    const alert = render("coloring", { colors: ["#ff0000", "#00ff00"] });
    expect(alert?.dataset.diagnosticCode).toBe("COLORING_NO_REGIONS");
    expect(alert?.textContent).toContain("Câu tô màu không có vùng tô");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("báo lỗi cả khi regions có phần tử nhưng không dùng được", () => {
    expect(render("coloring", { regions: [null, {}, { id: "" }] })?.dataset.diagnosticCode)
      .toBe("COLORING_NO_REGIONS");
  });

  it("vẫn hiện player bình thường khi có vùng tô", () => {
    expect(render("coloring", { regions: [{ id: "r1", label: "Ô 1" }] })).toBeNull();
    expect(container.textContent).toContain("Ô 1");
  });
});

describe("crossword không có mục nào", () => {
  it("báo lỗi thay vì tô đen cả lưới đã khai báo", () => {
    const alert = render("crossword", { size: { rows: 10, cols: 8 }, entries: [] });
    expect(alert?.dataset.diagnosticCode).toBe("CROSSWORD_NO_ENTRIES");
    expect(container.querySelectorAll("[data-cell-key]")).toHaveLength(0);
  });

  it("báo lỗi khi entries chỉ chứa phần tử hỏng", () => {
    expect(render("crossword", { entries: [null, "e1", 7] })?.dataset.diagnosticCode)
      .toBe("CROSSWORD_NO_ENTRIES");
  });

  it("vẫn hiện lưới bình thường khi có mục hợp lệ", () => {
    const alert = render("crossword", {
      size: { rows: 2, cols: 3 },
      entries: [{ id: "e1", startRow: 0, startCol: 0, direction: "across", length: 3, clue: "Ngang" }],
      correctAnswer: { e1: "ABC" },
    });
    expect(alert).toBeNull();
    expect(container.querySelectorAll("[data-cell-key]").length).toBeGreaterThan(0);
  });
});
