/**
 * Tên đề đặt cho điểm học sinh tạo ra (`pointName` của điều kiện) phải hiện trên
 * hình ngay khi vị trí khớp. Tên đi theo điều kiện nên nằm trong `correctAnswer`:
 * luồng server che đáp án thì tên cũng không còn — chấp nhận có chủ đích.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
});

/** Toán 4 · b30_t1q3 — "Vẽ đoạn NK song song với MQ, điểm K nằm trên PQ". */
const payload = {
  content: { blocks: [{ type: "paragraph", text: "Vẽ đoạn NK song song với MQ, điểm K nằm trên PQ." }] },
  grid: { rows: 7, cols: 10 },
  given: {
    points: [
      { id: "M", x: 1, y: 1 },
      { id: "N", x: 4, y: 1 },
      { id: "P", x: 8, y: 5 },
      { id: "Q", x: 1, y: 5 },
    ],
    segments: [
      { id: "MQ", from: "M", to: "Q" },
      { id: "PQ", from: "P", to: "Q" },
    ],
  },
  correctAnswer: {
    constraints: [{ kind: "segment", through: ["N"], parallelTo: "MQ", endpointOn: "PQ", pointName: "K" }],
  },
};

const NK = { segments: [[{ x: 4, y: 1 }, { x: 4, y: 5 }]] };

const svgTexts = () => Array.from(container.querySelectorAll("svg text")).map((t) => t.textContent);

function render(p: Record<string, unknown>, answer?: unknown) {
  act(() => {
    root.render(renderInteractionPlayer("geometry_grid", p, { answer }));
  });
}

describe("GeometryGridPlayer · tên điểm học sinh tạo", () => {
  it("chưa vẽ thì chưa có K", () => {
    render(payload);
    expect(svgTexts()).toEqual(["M", "N", "P", "Q"]);
  });

  it("vẽ xong đoạn chạm PQ thì K hiện ngay trên hình", () => {
    render(payload, NK);
    expect(svgTexts()).toContain("K");
  });

  it("correctAnswer bị che thì không có tên — tên đi theo điều kiện", () => {
    render({ ...payload, correctAnswer: undefined }, NK);
    expect(svgTexts()).not.toContain("K");
  });

  it("khối Đáp án đúng gọi điểm bằng tên đề đặt", () => {
    act(() => {
      root.render(renderInteractionPlayer("geometry_grid", payload, { answer: NK, submitted: true }));
    });
    expect(container.textContent).toContain("một đầu là điểm K nằm trên PQ");
  });

  it("bấm vẽ trực tiếp trên lưới cũng ra K", () => {
    render(payload);
    const hit = (x: number, y: number) =>
      Array.from(container.querySelectorAll("svg circle")).find(
        (c) => c.getAttribute("cx") === String(26 + x * 34) && c.getAttribute("cy") === String(26 + y * 34) && c.getAttribute("r") === "15",
      )!;
    act(() => hit(4, 1).dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(svgTexts()).not.toContain("K");
    act(() => hit(4, 5).dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(svgTexts()).toContain("K");
  });
});
