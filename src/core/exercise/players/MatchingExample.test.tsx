/**
 * web#706 — "cặp nối mẫu" (`example`) cho MỌI biến thể matching.
 *
 * Đề in kiểu "Nối (theo mẫu)" đã vẽ sẵn một cặp nối mẫu trên trang giấy; học
 * sinh chỉ bắt chước, không phải vẽ lại và cũng không bị chấm cặp đó. Bốn hành
 * vi phải đúng ở cả năm player columns/lines/rows/radial/chain:
 *   1. vẽ sẵn ngay khi vào bài (không cần thao tác nào),
 *   2. không xoá được khi còn khoá,
 *   3. không tính vào chấm/tiến độ,
 *   4. sống sót qua "Làm lại".
 *
 * Các bài kiểm thử dưới đây là chốt hồi quy cho từng landmine đã ghi trong
 * `.claude/plans/issue-706-matching-example.md` §4 — đặc biệt landmine 4
 * (`edges.length < correctEdges.length`), thứ chính là lỗi mà issue báo cáo.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveMatchingPayload } from "@/core/question-schema/matching";
import { renderInteractionPlayer, type PlayerHandlers } from "./dispatch";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 100,
    bottom: 40,
    width: 100,
    height: 40,
    toJSON: () => ({}),
  } as DOMRect);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(element: ReactNode) {
  act(() => root.render(element));
}

function renderedEdges() {
  return Array.from(container.querySelectorAll<SVGLineElement>("[data-matching-edge]"))
    .map((line) => line.dataset.matchingEdge)
    .sort();
}

function lockedEdges() {
  return Array.from(container.querySelectorAll<SVGLineElement>('[data-edge-locked="true"]'))
    .map((line) => line.dataset.matchingEdge)
    .sort();
}

function edgeLine(edge: string): SVGLineElement {
  const line = container.querySelector<SVGLineElement>(`[data-matching-edge="${edge}"]`);
  if (!line) throw new Error(`Không tìm thấy nét nối: ${edge}`);
  return line;
}

/** Nút của một mục: khớp nguyên văn trước, nếu không có thì khớp chứa. */
function findButton(text: string): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
  const button =
    buttons.find((candidate) => candidate.textContent?.trim() === text) ??
    buttons.find((candidate) => candidate.textContent?.includes(text));
  if (!button) throw new Error(`Không tìm thấy nút: ${text}`);
  return button;
}

function clickButton(text: string) {
  const button = findButton(text);
  act(() => button.click());
}

/** Nối một cặp = hai lần bấm: nguồn rồi đích. */
function connect(source: string, target: string) {
  clickButton(source);
  clickButton(target);
}

// ── Đề hai cột: cặp 1 là mẫu, cặp 2 do học sinh nối ────────────────────────
type StandardPlayer = "columns" | "lines" | "rows" | "radial";
const STANDARD_PLAYERS = ["columns", "lines", "rows", "radial"] as const;

function standardPayload(
  interactionType: StandardPlayer,
  example?: unknown,
  correctAnswer: unknown[] = [
    { item: "L1", target: "R1" },
    { item: "L2", target: "R2" },
  ],
): Record<string, unknown> {
  return {
    id: `ex-${interactionType}`,
    type: "matching",
    display: { interactionType },
    content: { blocks: [{ type: "paragraph", text: "Nối (theo mẫu)." }] },
    leftItems: [
      { id: "L1", text: "Mèo" },
      { id: "L2", text: "Chó" },
    ],
    rightItems: [
      { id: "R1", text: "Meo" },
      { id: "R2", text: "Gâu" },
    ],
    correctAnswer,
    ...(example === undefined ? {} : { example }),
  };
}

function renderStandard(
  interactionType: StandardPlayer,
  example: unknown,
  handlers: PlayerHandlers = {},
  correctAnswer?: unknown[],
) {
  render(renderInteractionPlayer("matching", standardPayload(interactionType, example, correctAnswer), handlers));
}

// ── Đề chuỗi ba cột, mô phỏng b27_q3 (VBT Toán 3 Tập 1) ────────────────────
// Mẫu `24 → Gấp 2 lần → 48` là HAI cạnh: đúng ca thực mà issue báo cáo.
function chainPayload(example?: unknown): Record<string, unknown> {
  return {
    id: "ex-chain",
    type: "matching",
    display: { interactionType: "chain" },
    content: { blocks: [{ type: "paragraph", text: "Nối (theo mẫu)." }] },
    columns: [
      {
        id: "left",
        title: "Số",
        items: [
          { id: "L24", text: "24" },
          { id: "L15", text: "15" },
        ],
      },
      {
        id: "middle",
        title: "Phép biến đổi",
        items: [
          { id: "M2", text: "Gấp 2 lần" },
          { id: "M3", text: "Gấp 3 lần" },
        ],
      },
      {
        id: "right",
        title: "Kết quả",
        items: [
          { id: "R48", text: "48" },
          { id: "R45", text: "45" },
        ],
      },
    ],
    correctAnswer: [
      { item: "L24", target: "M2" },
      { item: "M2", target: "R48" },
      { item: "L15", target: "M3" },
      { item: "M3", target: "R45" },
    ],
    ...(example === undefined ? {} : { example }),
  };
}

const CHAIN_EXAMPLE = [
  { item: "L24", target: "M2" },
  { item: "M2", target: "R48" },
];

function renderChain(example: unknown, handlers: PlayerHandlers = {}) {
  render(renderInteractionPlayer("matching", chainPayload(example), handlers));
}

// ═══════════════════════════════════════════════════════════════════════════

describe("#706 sample edges — columns / lines / rows / radial", () => {
  it.each(STANDARD_PLAYERS)(
    "#706: draws the sample edge on entry with no student action in %s",
    (player) => {
      renderStandard(player, { item: "L1", target: "R1" }, { answer: undefined });

      expect(renderedEdges()).toEqual(["L1->R1"]);
    },
  );

  it.each(STANDARD_PLAYERS)(
    "#706: marks a locked sample edge with data-edge-locked in %s",
    (player) => {
      renderStandard(player, { item: "L1", target: "R1", locked: true });

      expect(lockedEdges()).toEqual(["L1->R1"]);
    },
  );

  it.each(STANDARD_PLAYERS)(
    "#706: omits data-edge-locked when the payload declared locked:false in %s",
    (player) => {
      renderStandard(player, { item: "L1", target: "R1", locked: false });

      expect(renderedEdges()).toEqual(["L1->R1"]);
      expect(lockedEdges()).toEqual([]);
    },
  );

  it.each(STANDARD_PLAYERS)(
    "#706: a locked sample cannot be removed and its source button is disabled in %s",
    (player) => {
      const onAnswerChange = vi.fn();
      renderStandard(player, { item: "L1", target: "R1" }, { onAnswerChange });

      expect(findButton("Mèo").disabled).toBe(true);
      // Bấm lại đúng cặp mẫu (nguồn rồi đích) — không được gỡ ra.
      connect("Mèo", "Meo");

      expect(onAnswerChange).not.toHaveBeenCalled();
      expect(renderedEdges()).toEqual(["L1->R1"]);
    },
  );

  it.each(STANDARD_PLAYERS)(
    "khoá đáp án còn đích khác cho item mẫu thì vẫn nối thêm được ở %s",
    (player) => {
      const onAnswerChange = vi.fn();
      const onProgress = vi.fn();
      renderStandard(
        player,
        { item: "L1", target: "R1" },
        { onAnswerChange, onProgress },
        [
          { item: "L1", target: "R1" },
          { item: "L1", target: "R2" },
        ],
      );

      // Bản thân cạnh mẫu vẫn bất biến, nhưng item nguồn của nó phải chọn được
      // vì khoá đáp án còn một đích thứ hai cho chính item đó.
      expect(findButton("Mèo").disabled).toBe(false);
      connect("Mèo", "Meo");
      expect(onAnswerChange).not.toHaveBeenCalled();
      expect(renderedEdges()).toEqual(["L1->R1"]);

      connect("Mèo", "Gâu");

      expect(onAnswerChange).toHaveBeenLastCalledWith([
        { item: "L1", target: "R1" },
        { item: "L1", target: "R2" },
      ]);
      expect(renderedEdges()).toEqual(["L1->R1", "L1->R2"]);
      expect(onProgress).toHaveBeenLastCalledWith({
        correct: 1,
        wrong: 0,
        total: 1,
        done: true,
      });
    },
  );

  it.each(STANDARD_PLAYERS)(
    "#706: a locked:false sample CAN be removed by the student in %s",
    (player) => {
      const onAnswerChange = vi.fn();
      renderStandard(player, { item: "L1", target: "R1", locked: false }, { onAnswerChange });

      expect(findButton("Mèo").disabled).toBe(false);
      connect("Mèo", "Meo");

      expect(onAnswerChange).toHaveBeenLastCalledWith([]);
      expect(renderedEdges()).toEqual([]);
    },
  );

  it.each(STANDARD_PLAYERS)(
    "#706: the sample is excluded from instant progress (total drops to 1) in %s",
    (player) => {
      const onProgress = vi.fn();
      renderStandard(player, { item: "L1", target: "R1" }, { onProgress });

      // onProgress KHÔNG phát khi mount (useInstantGrading chỉ emit sau
      // grade/clear) — chỉ đọc sau khi học sinh nối.
      expect(onProgress).not.toHaveBeenCalled();
      connect("Chó", "Gâu");

      expect(onProgress).toHaveBeenLastCalledWith({
        correct: 1,
        wrong: 0,
        total: 1,
        done: true,
      });
    },
  );

  it.each(STANDARD_PLAYERS)(
    "#706: grades success without the student redrawing the sample in %s",
    (player) => {
      // Landmine 4: `edges.length < correctEdges.length` — nếu vẫn so với
      // correctEdges gốc thì học sinh luôn bị báo thiếu một cặp.
      const onStatusChange = vi.fn();
      renderStandard(
        player,
        { item: "L1", target: "R1" },
        { onStatusChange, instantFeedback: false },
      );

      connect("Chó", "Gâu");
      clickButton("Kiểm tra");

      expect(onStatusChange).toHaveBeenLastCalledWith("success");
    },
  );

  it.each(STANDARD_PLAYERS)(
    "#706: the sample survives a \"Làm lại\" reset in %s",
    (player) => {
      renderStandard(player, { item: "L1", target: "R1" }, { questionId: "q-1" });
      connect("Chó", "Gâu");
      expect(renderedEdges()).toEqual(["L1->R1", "L2->R2"]);

      // "Làm lại" = cha đổi questionId và xoá đáp án → player remount.
      renderStandard(player, { item: "L1", target: "R1" }, {
        questionId: "q-1#retry",
        answer: undefined,
      });

      expect(renderedEdges()).toEqual(["L1->R1"]);
    },
  );

  it.each(STANDARD_PLAYERS)(
    "#706: a payload with no example behaves exactly as before in %s",
    (player) => {
      const onProgress = vi.fn();
      renderStandard(player, undefined, { onProgress });

      expect(renderedEdges()).toEqual([]);
      expect(lockedEdges()).toEqual([]);
      expect(findButton("Mèo").disabled).toBe(false);

      connect("Mèo", "Meo");
      expect(onProgress).toHaveBeenLastCalledWith({
        correct: 1,
        wrong: 0,
        total: 2,
        done: false,
      });
    },
  );
});

/**
 * KIỂU HIỂN THỊ của cặp mẫu — trước đây không ca nào khoá, nên "mẫu trông như
 * mẫu" chỉ là quy ước truyền miệng. Chain từng ép verdict cạnh mẫu thành
 * "correct" (ô mẫu xanh lá ngay từ đầu, nhánh xám-đứt của nét mẫu là code
 * chết); ba player còn lại thì không. Ca dưới đây khoá kiểu nghỉ CHUNG cho cả
 * ba, để lần sau lệch là đỏ ngay.
 *
 * `rows`/`radial` không nằm trong danh sách: hai player đó chưa có chip mẫu
 * xám-đứt, và bù khoảng lệch ấy nằm ngoài phạm vi ở đây.
 */
describe("#706 sample edges — kiểu hiển thị lúc nghỉ", () => {
  const DASHED_CHIP = /border-dashed\s+border-slate-400/;

  it.each(["columns", "lines"] as const)(
    "#706: %s vẽ nét mẫu xám + đứt mảnh, KHÔNG phải nét đã-chấm-đúng",
    (player) => {
      renderStandard(player, { item: "L1", target: "R1" });

      const line = edgeLine("L1->R1");
      expect(line.getAttribute("stroke")).toBe("#64748b");
      expect(line.getAttribute("stroke-dasharray")).toBe("3 2");
      expect(line.getAttribute("stroke")).not.toBe("#22c55e");
    },
  );

  it.each(["columns", "lines"] as const)(
    "#706: %s tô hai ĐẦU của cặp mẫu bằng chip xám-đứt",
    (player) => {
      renderStandard(player, { item: "L1", target: "R1" });

      expect(findButton("Mèo").className).toMatch(DASHED_CHIP);
      expect(findButton("Meo").className).toMatch(DASHED_CHIP);
      // Cặp học sinh phải tự nối thì KHÔNG được mặc kiểu mẫu.
      expect(findButton("Chó").className).not.toMatch(DASHED_CHIP);
    },
  );

  it("#706: chain vẽ CẢ HAI nét mẫu xám + đứt mảnh", () => {
    renderChain(CHAIN_EXAMPLE);

    for (const edge of ["L24->M2", "M2->R48"]) {
      expect(edgeLine(edge).getAttribute("stroke")).toBe("#64748b");
      expect(edgeLine(edge).getAttribute("stroke-dasharray")).toBe("3 2");
    }
  });

  it("#706: chain tô cả BA ô của chuỗi mẫu bằng chip xám-đứt", () => {
    renderChain(CHAIN_EXAMPLE);

    // Ô giữa chạm cả hai cạnh mẫu (đích của cạnh trước, nguồn của cạnh sau).
    for (const text of ["24", "Gấp 2 lần", "48"]) {
      expect(findButton(text).className).toMatch(DASHED_CHIP);
    }
    expect(findButton("15").className).not.toMatch(DASHED_CHIP);
  });

  it("#706: chain KHÔNG có mẫu thì không ô nào mặc kiểu mẫu", () => {
    renderChain(undefined);

    for (const text of ["24", "Gấp 2 lần", "48"]) {
      expect(findButton(text).className).not.toMatch(DASHED_CHIP);
    }
  });
});

describe("#706 sample edges — chain (the issue's real case)", () => {
  it("#706: a two-edge example array draws BOTH halves of the chain sample", () => {
    renderChain(CHAIN_EXAMPLE, { answer: undefined });

    expect(renderedEdges()).toEqual(["L24->M2", "M2->R48"]);
  });

  it("#706: both chain sample edges carry the locked marker", () => {
    renderChain(CHAIN_EXAMPLE);

    expect(lockedEdges()).toEqual(["L24->M2", "M2->R48"]);
  });

  it("#706: neither chain sample edge can be removed — both sources are locked", () => {
    const onAnswerChange = vi.fn();
    renderChain(CHAIN_EXAMPLE, { onAnswerChange });

    // Cả nút cột TRÁI (24) lẫn nút cột GIỮA (Gấp 2 lần) đều là nguồn của mẫu.
    expect(findButton("24").disabled).toBe(true);
    expect(findButton("Gấp 2 lần").disabled).toBe(true);

    connect("24", "Gấp 2 lần");
    connect("Gấp 2 lần", "48");

    expect(onAnswerChange).not.toHaveBeenCalled();
    expect(renderedEdges()).toEqual(["L24->M2", "M2->R48"]);
  });

  it("#706: BOTH chain sample sources are excluded from grading (total 2, not 4)", () => {
    const onProgress = vi.fn();
    renderChain(CHAIN_EXAMPLE, { onProgress });

    connect("15", "Gấp 3 lần");
    connect("Gấp 3 lần", "45");

    expect(onProgress).toHaveBeenLastCalledWith({
      correct: 2,
      wrong: 0,
      total: 2,
      done: true,
    });
  });

  it("#706: chain grades success without the student redrawing the sample", () => {
    const onStatusChange = vi.fn();
    renderChain(CHAIN_EXAMPLE, { onStatusChange, instantFeedback: false });

    connect("15", "Gấp 3 lần");
    connect("Gấp 3 lần", "45");
    clickButton("Kiểm tra");

    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });

  it("#706: the chain sample survives a \"Làm lại\" reset", () => {
    renderChain(CHAIN_EXAMPLE, { questionId: "b27_q3" });
    connect("15", "Gấp 3 lần");
    expect(renderedEdges()).toEqual(["L15->M3", "L24->M2", "M2->R48"]);

    renderChain(CHAIN_EXAMPLE, { questionId: "b27_q3#retry", answer: undefined });

    expect(renderedEdges()).toEqual(["L24->M2", "M2->R48"]);
  });

  it("#706: a chain payload with no example behaves exactly as before", () => {
    const onProgress = vi.fn();
    renderChain(undefined, { onProgress });

    expect(renderedEdges()).toEqual([]);
    expect(lockedEdges()).toEqual([]);
    expect(findButton("24").disabled).toBe(false);

    connect("24", "Gấp 2 lần");
    expect(onProgress).toHaveBeenLastCalledWith({
      correct: 1,
      wrong: 0,
      total: 4,
      done: false,
    });
  });
});

/**
 * Đơn vị cho `resolveMatchingPayload` — đặt ở đây thay vì
 * `question-schema/matching.test.ts` để không chèn vào giữa bộ kiểm thử sẵn có
 * của file đó (lane của Part E chỉ sở hữu ba file).
 */
describe("#706 resolveMatchingPayload example parsing", () => {
  const twoColumn = {
    display: { interactionType: "columns" },
    leftItems: [{ id: "L1" }, { id: "L2" }],
    rightItems: [{ id: "R1" }, { id: "R2" }],
    correctAnswer: [
      { item: "L1", target: "R1" },
      { item: "L2", target: "R2" },
    ],
  };

  it("#706: parses the single-object form and defaults locked to true", () => {
    const resolved = resolveMatchingPayload({
      ...twoColumn,
      example: { item: "L1", target: "R1" },
    });

    expect(resolved.exampleEdges).toEqual([{ item: "L1", target: "R1" }]);
    expect(resolved.exampleLocked).toBe(true);
  });

  it("#706: parses the ARRAY form (a chain sample is two edges)", () => {
    const resolved = resolveMatchingPayload({
      ...chainPayload(CHAIN_EXAMPLE),
    });

    expect(resolved.exampleEdges).toEqual([
      { item: "L24", target: "M2" },
      { item: "M2", target: "R48" },
    ]);
    expect(resolved.exampleLocked).toBe(true);
  });

  it("#706: honours locked:false on the object form", () => {
    const resolved = resolveMatchingPayload({
      ...twoColumn,
      example: { item: "L1", target: "R1", locked: false },
    });

    expect(resolved.exampleEdges).toEqual([{ item: "L1", target: "R1" }]);
    expect(resolved.exampleLocked).toBe(false);
  });

  it("#706: filters out sample edges whose ids do not exist", () => {
    const resolved = resolveMatchingPayload({
      ...twoColumn,
      example: [
        { item: "L1", target: "R1" },
        { item: "khong-co", target: "R1" },
        { item: "L2", target: "cung-khong-co" },
      ],
    });

    expect(resolved.exampleEdges).toEqual([{ item: "L1", target: "R1" }]);
  });

  it("#706: validates chain sample edges by the (left→middle)|(middle→right) rule", () => {
    const resolved = resolveMatchingPayload({
      ...chainPayload([
        { item: "L24", target: "M2" },
        // Bỏ qua cột giữa — không hợp lệ ở chuỗi ba cột.
        { item: "L24", target: "R48" },
        // Ngược chiều — cũng không hợp lệ.
        { item: "R48", target: "M2" },
      ]),
    });

    expect(resolved.exampleEdges).toEqual([{ item: "L24", target: "M2" }]);
  });

  it("#706: an absent example resolves to no edges and stays locked by default", () => {
    const resolved = resolveMatchingPayload(twoColumn);

    expect(resolved.exampleEdges).toEqual([]);
    expect(resolved.exampleLocked).toBe(true);
  });
});
