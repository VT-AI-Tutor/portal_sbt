import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * web-own: player phải truyền ĐÚNG tập node xuống bộ xuất ảnh.
 *
 * File riêng vì nó mock `diagram-fill-download` cho cả module — các ca khác
 * cần hàm thật. Và vì studio không có file này nên bước copy khi sync không đè.
 *
 * Vì sao cần ca này dù đã có test cho `paintAnswers`: ca kia khoá HỢP ĐỒNG của
 * paintAnswers ("chỉ vẽ node được truyền vào"), không khoá việc NGƯỜI GỌI truyền
 * đúng. Đo b���ng mutation `fillableNodes` → `nodes` ở DiagramFillPlayer: toàn bộ
 * test còn lại vẫn xanh, chỉ ca này đỏ.
 */

vi.mock("./diagram-fill-download", async () => {
  const actual = await vi.importActual<typeof import("./diagram-fill-download")>(
    "./diagram-fill-download",
  );
  return {
    ...actual,
    renderDiagramFillAnswerImage: vi.fn(async () => new Blob(["x"], { type: "image/png" })),
  };
});

import { renderInteractionPlayer } from "./dispatch";
import { renderDiagramFillAnswerImage } from "./diagram-fill-download";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.mocked(renderDiagramFillAnswerImage).mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/** Một node điền được và một node nhãn tĩnh, cùng nằm trên phiếu. */
const PAYLOAD = {
  id: "b5_q7_a",
  backgroundImage:
    "https://cdn.example.com/sbt/book-assets/63aa91ed-14dd-4b73-a377-ac3a3e33821d/assets/images/bai5_q7.png",
  nodes: [
    { id: "o_dien", label: "Sáng - Thứ Hai", fillable: true, x: 0.25, y: 0.6, width: 0.09, height: 0.11 },
    { id: "nhan_tinh", label: "Thời gian", x: 0.1, y: 0.6, width: 0.09, height: 0.11 },
  ],
  edges: [],
  selfAssessment: true,
};

describe("tham số truyền xuống bộ xuất ảnh", () => {
  it("chỉ truyền node ĐIỀN ĐƯỢC, không truyền nhãn tĩnh", async () => {
    act(() => {
      root.render(renderInteractionPlayer("diagram_fill", PAYLOAD as never, {} as never));
    });

    const img = container.querySelector<HTMLImageElement>("[data-diagram-background] img")!;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "currentSrc", { value: img.src, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 2023, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 1349, configurable: true });
    act(() => img.dispatchEvent(new Event("load", { bubbles: false })));

    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      /Tải ảnh bài làm/.test(b.textContent ?? ""),
    )!;
    expect(button.disabled).toBe(false);
    await act(async () => {
      button.click();
    });

    expect(renderDiagramFillAnswerImage).toHaveBeenCalledTimes(1);
    const nodesTruyenVao = vi.mocked(renderDiagramFillAnswerImage).mock.calls[0][1];
    expect(nodesTruyenVao.map((n) => n.id)).toEqual(["o_dien"]);
  });
});
