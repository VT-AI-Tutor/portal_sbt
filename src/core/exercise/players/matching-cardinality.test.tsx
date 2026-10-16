/**
 * Trần nối của câu matching: bao nhiêu nét được ĐI RA khỏi một ô nguồn và bao
 * nhiêu nét được ĐI VÀO một ô đích. Cả hai suy từ đáp án, lấy max toàn cục nên
 * không lộ số nét của từng ô, và áp ở CẢ HAI cửa — lúc học sinh bấm lẫn lúc nạp
 * lại bài đã lưu.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChainMatchPlayer } from "./ChainMatchPlayer";
import { ConnectLinesPlayer } from "./ConnectLinesPlayer";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function clickText(t: string) {
  const btn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === t,
  );
  expect(btn, `không tìm thấy nút "${t}"`).toBeDefined();
  act(() => btn!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function edges() {
  return Array.from(container.querySelectorAll<SVGLineElement>("[data-matching-edge]"))
    .map((line) => line.dataset.matchingEdge)
    .sort();
}

const leftItems = [
  { id: "l1", text: "L1" },
  { id: "l2", text: "L2" },
  { id: "l3", text: "L3" },
];
const rightItems = [
  { id: "r1", text: "R1" },
  { id: "r2", text: "R2" },
  { id: "r3", text: "R3" },
];

function renderLines(props: Record<string, unknown>) {
  act(() =>
    root.render(
      <ConnectLinesPlayer title="Q" leftItems={leftItems} rightItems={rightItems} {...props} />,
    ),
  );
}

describe("trần ĐÍCH — nhiều ô nguồn không dồn được vào một ô đích", () => {
  const bijection = [
    { item: "l1", target: "r1" },
    { item: "l2", target: "r2" },
    { item: "l3", target: "r3" },
  ];

  it("khoá song ánh: nét thứ hai vào cùng ô đích đẩy nét cũ ra", () => {
    renderLines({ correctEdges: bijection });
    clickText("L1");
    clickText("R1");
    expect(edges()).toEqual(["l1->r1"]);

    clickText("L2");
    clickText("R1");
    expect(edges()).toEqual(["l2->r1"]);
  });

  it("khoá nhiều-một: hai ô nguồn vẫn cùng đổ vào một ô đích được", () => {
    renderLines({
      correctEdges: [
        { item: "l1", target: "r1" },
        { item: "l2", target: "r1" },
      ],
    });
    clickText("L1");
    clickText("R1");
    clickText("L2");
    clickText("R1");
    expect(edges()).toEqual(["l1->r1", "l2->r1"]);
  });

  it("chạm trần đích thì đẩy nét CŨ NHẤT ra, không phải nét bất kỳ", () => {
    renderLines({
      correctEdges: [
        { item: "l1", target: "r1" },
        { item: "l2", target: "r1" },
      ],
    });
    clickText("L1");
    clickText("R1");
    clickText("L2");
    clickText("R1");
    clickText("L3");
    clickText("R1");
    expect(edges()).toEqual(["l2->r1", "l3->r1"]);
  });

  it("ô đích NHIỄU vẫn bấm được — trần là max toàn cục, không phải bậc của riêng ô", () => {
    // r3 không xuất hiện trong khoá. Nếu trần tính riêng từng ô thì bậc của r3
    // là 0 và ô nhiễu thành bấm-không-được, tức là lộ luôn đâu là ý nhiễu.
    renderLines({
      correctEdges: [
        { item: "l1", target: "r1" },
        { item: "l2", target: "r2" },
      ],
    });
    clickText("L1");
    clickText("R3");
    expect(edges()).toEqual(["l1->r3"]);
  });
});

describe("trần NGUỒN — số nét ra khỏi một ô", () => {
  it("khoá một-nhiều bậc 2 cho đúng 2 nét, nét thứ ba đẩy nét cũ nhất ra", () => {
    renderLines({
      correctEdges: [
        { item: "l1", target: "r1" },
        { item: "l1", target: "r2" },
        { item: "l2", target: "r3" },
      ],
    });
    clickText("L1");
    clickText("R1");
    clickText("L1");
    clickText("R2");
    expect(edges()).toEqual(["l1->r1", "l1->r2"]);

    clickText("L1");
    clickText("R3");
    // Bỏ ĐÚNG cạnh cũ nhất — cơ chế cũ xoá sạch cạnh của ô và chỉ còn lại một.
    expect(edges()).toEqual(["l1->r2", "l1->r3"]);
  });
});

describe("nạp lại bài đã lưu", () => {
  it("bài vượt trần bị cắt ngay khi hiển thị, không đợi học sinh bấm tiếp", () => {
    renderLines({
      correctEdges: [
        { item: "l1", target: "r1" },
        { item: "l2", target: "r2" },
      ],
      answer: [
        { item: "l1", target: "r1" },
        { item: "l1", target: "r2" },
        { item: "l1", target: "r3" },
      ],
    });
    expect(edges()).toEqual(["l1->r1"]);
  });

  it("bài đúng trần thì giữ nguyên", () => {
    const key = [
      { item: "l1", target: "r1" },
      { item: "l1", target: "r2" },
    ];
    renderLines({ correctEdges: key, answer: key });
    expect(edges()).toEqual(["l1->r1", "l1->r2"]);
  });
});

describe("cặp nối mẫu không bị trần đẩy ra", () => {
  it("nạn nhân duy nhất là cạnh mẫu thì thao tác rỗng", () => {
    renderLines({
      correctEdges: [
        { item: "l1", target: "r1" },
        { item: "l2", target: "r2" },
      ],
      exampleEdges: [{ item: "l1", target: "r1" }],
      exampleLocked: true,
    });
    expect(edges()).toEqual(["l1->r1"]);

    // Trần đích là 1 và cạnh duy nhất vào r1 là cạnh mẫu đã khoá.
    clickText("L2");
    clickText("R1");
    expect(edges()).toEqual(["l1->r1"]);
  });
});

describe("ba cột — trần tính riêng từng chặng", () => {
  const chainItems = {
    leftItems: [{ id: "L1", text: "L1" }, { id: "L2", text: "L2" }],
    middleItems: [{ id: "M1", text: "M1" }, { id: "M2", text: "M2" }],
    rightItems: [{ id: "R1", text: "R1" }, { id: "R2", text: "R2" }],
  };

  function renderChain(props: Record<string, unknown>) {
    act(() => root.render(<ChainMatchPlayer title="Q" {...chainItems} {...props} />));
  }

  it("chain: ô giữa chỉ nhận đúng một nét vào (spec §5.9.3)", () => {
    renderChain({
      correctEdges: [
        { item: "L1", target: "M1" }, { item: "M1", target: "R1" },
        { item: "L2", target: "M2" }, { item: "M2", target: "R2" },
      ],
    });
    clickText("L1");
    clickText("M1");
    expect(edges()).toEqual(["L1->M1"]);

    clickText("L2");
    clickText("M1");
    expect(edges()).toEqual(["L2->M1"]);
  });

  it("triad: chặng trái→giữa siết, chặng giữa→phải toả — trong CÙNG một câu", () => {
    renderChain({
      triad: true,
      correctEdges: [
        { item: "L1", target: "M1" }, { item: "L2", target: "M1" },
        { item: "M1", target: "R1" }, { item: "M1", target: "R2" },
      ],
    });
    // Chặng 1 nhiều-một: hai ô trái cùng vào M1.
    clickText("L1");
    clickText("M1");
    clickText("L2");
    clickText("M1");
    expect(edges()).toEqual(["L1->M1", "L2->M1"]);

    // Chặng 2 một-nhiều: M1 toả sang cả hai ô phải.
    clickText("M1");
    clickText("R1");
    clickText("M1");
    clickText("R2");
    expect(edges()).toEqual(["L1->M1", "L2->M1", "M1->R1", "M1->R2"]);
  });

  it("triad khai bằng Record vẫn toả được từ ô giữa", () => {
    // Record không giữ nổi một-nhiều, nên trần suy từ khoá sẽ khoá tâm ở một
    // nét; `triadCentreFanOutCeiling` đếm theo hai ô cột phải nên M1 được hai nét.
    renderChain({ triad: true, correctPairs: { L1: "M1", M1: "R1" } });
    clickText("M1");
    clickText("R1");
    clickText("M1");
    clickText("R2");
    expect(edges()).toEqual(["M1->R1", "M1->R2"]);
  });
});
