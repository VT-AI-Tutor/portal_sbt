import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectPointsTask } from "./ConnectPointsTask";

vi.mock("./AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

/** Bốn điểm, hai cặp đáp án: p1–p3 (đặt làm mẫu) và p2–p4 (việc của học sinh). */
const points = [
  { id: "p1", label: "A", x: 0.1, y: 0.3 },
  { id: "p2", label: "B", x: 0.1, y: 0.6 },
  { id: "p3", label: "C", x: 0.9, y: 0.4 },
  { id: "p4", label: "D", x: 0.9, y: 0.7 },
];

const correctConnections = [
  { from: "p1", to: "p3" },
  { from: "p2", to: "p4" },
];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
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

function task(props: Partial<React.ComponentProps<typeof ConnectPointsTask>> = {}): ReactElement {
  return (
    <ConnectPointsTask
      title="Nối (theo mẫu)"
      points={points}
      correctConnections={correctConnections}
      onComplete={vi.fn()}
      {...props}
    />
  );
}

function render(element: ReactElement) {
  act(() => root.render(element));
}

function pointButton(label: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  expect(button).toBeDefined();
  return button!;
}

function drawnEdges(): string[] {
  return Array.from(
    container.querySelectorAll<SVGLineElement>('[data-line-role="fill"]'),
  ).map((line) => line.getAttribute("data-connect-edge") ?? "");
}

function exampleLine(): SVGLineElement | null {
  return container.querySelector<SVGLineElement>('[data-connect-edge-example="true"]');
}

const EXAMPLE = { from: "p1", to: "p3", locked: true };

describe("ConnectPointsTask — nét nối mẫu", () => {
  it("vẽ sẵn nét mẫu ngay khi vào câu, chưa cần học sinh làm gì", () => {
    render(task({ example: EXAMPLE }));
    expect(drawnEdges()).toEqual(["p1->p3"]);
    expect(exampleLine()).not.toBeNull();
  });

  it("nét mẫu không tô xanh/đỏ — nó là dữ kiện đề, không phải bài làm", () => {
    render(task({ example: EXAMPLE }));
    expect(exampleLine()?.getAttribute("data-edge-verdict")).toBeNull();
  });

  it("không gỡ được nét mẫu, kể cả khi bấm ĐÍCH trước rồi mới bấm NGUỒN", () => {
    const onAnswerChange = vi.fn();
    render(task({ example: EXAMPLE, onAnswerChange }));

    // Bấm C rồi A — thứ tự ngược với {from,to} đã khai. edgeKey không phân hướng
    // nên nếu chặn ở mức ĐIỂM thay vì mức CẠNH thì đường này lọt.
    act(() => pointButton("C").click());
    act(() => pointButton("A").click());

    expect(drawnEdges()).toEqual(["p1->p3"]);
    expect(onAnswerChange).not.toHaveBeenCalled();
  });

  it("không gỡ được nét mẫu khi bấm nguồn rồi đích", () => {
    render(task({ example: EXAMPLE }));

    act(() => pointButton("A").click());
    act(() => pointButton("C").click());

    expect(drawnEdges()).toEqual(["p1->p3"]);
  });

  it("vẫn nối được cặp còn lại, và đáp án gửi lên gồm cả nét mẫu", () => {
    const onAnswerChange = vi.fn();
    render(task({ example: EXAMPLE, onAnswerChange }));

    act(() => pointButton("B").click());
    act(() => pointButton("D").click());

    expect(drawnEdges()).toEqual(["p1->p3", "p2->p4"]);
    expect(onAnswerChange).toHaveBeenLastCalledWith([
      { from: "p1", to: "p3" },
      { from: "p2", to: "p4" },
    ]);
  });

  it("câu ĐẠT khi học sinh nối xong phần còn lại — hai đầu nét mẫu không tính vào tiến độ", () => {
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    render(task({ example: EXAMPLE, onProgress, onComplete }));

    act(() => pointButton("B").click());
    act(() => pointButton("D").click());

    // Nếu p1/p3 vẫn nằm trong expectedIds thì `done` không bao giờ true (chúng
    // không bao giờ được chạm nên không bao giờ được chấm) — câu kẹt vĩnh viễn.
    const last = onProgress.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ total: 2, correct: 2, wrong: 0, done: true });
  });

  it("đánh dấu hai đầu nét mẫu là điểm cho sẵn", () => {
    render(task({ example: EXAMPLE }));
    expect(pointButton("A").getAttribute("data-point-example")).toBe("true");
    expect(pointButton("C").getAttribute("data-point-example")).toBe("true");
    expect(pointButton("B").getAttribute("data-point-example")).toBeNull();
  });

  it("điểm cho sẵn không mở được nét mới đi nơi khác", () => {
    render(task({ example: EXAMPLE }));

    act(() => pointButton("A").click());
    act(() => pointButton("D").click());

    expect(drawnEdges()).toEqual(["p1->p3"]);
  });

  it("bài làm đã lưu được vẽ lại cùng nét mẫu, không nhân đôi nét mẫu", () => {
    render(
      task({
        example: EXAMPLE,
        answer: [
          { from: "p1", to: "p3" },
          { from: "p2", to: "p4" },
        ],
      }),
    );
    expect(drawnEdges()).toEqual(["p1->p3", "p2->p4"]);
  });

  it("`locked: false` thì học sinh gỡ được nét mẫu", () => {
    render(task({ example: { from: "p1", to: "p3", locked: false } }));
    expect(drawnEdges()).toEqual(["p1->p3"]);

    // Gỡ từ đầu ĐÍCH — đúng luật sẵn có của mọi nét đã vẽ: điểm đã mở nét
    // ("spent") không tự mở lại được, phải thao tác từ đầu bên kia.
    act(() => pointButton("C").click());
    act(() => pointButton("A").click());

    expect(drawnEdges()).toEqual([]);
  });

  it("bỏ qua nét mẫu trỏ tới điểm không tồn tại", () => {
    render(task({ example: { from: "p1", to: "khong_co", locked: true } }));
    expect(drawnEdges()).toEqual([]);
  });

  it("nét mẫu KHÔNG có trong correctAnswer thì không được khoá và không loại khỏi chấm", () => {
    // Bất biến §5.9 bị tác giả khai lệch: vẫn vẽ sẵn, nhưng đối xử như nét thường
    // — thà để học sinh sửa được còn hơn âm thầm bỏ hai điểm khỏi phần phải làm.
    render(task({ example: { from: "p1", to: "p4", locked: true } }));
    expect(drawnEdges()).toEqual(["p1->p4"]);
    expect(pointButton("A").getAttribute("data-point-example")).toBeNull();

    // Gỡ được (từ đầu đích) — trái hẳn với nét mẫu hợp lệ ở test bên trên.
    act(() => pointButton("D").click());
    act(() => pointButton("A").click());
    expect(drawnEdges()).toEqual([]);
  });

  it("không có `example` thì hành vi cũ giữ nguyên", () => {
    render(task());
    expect(drawnEdges()).toEqual([]);
    expect(exampleLine()).toBeNull();
  });
});

describe("ConnectPointsTask — nét mẫu giữ được nét đứt", () => {
  it("không bọc motion nên `stroke-dasharray` không bị pathLength đè mất", () => {
    render(task({ example: EXAMPLE }));
    const line = exampleLine();
    // Đo trên app thật: motion.line animate `pathLength` bằng đơn vị chuẩn hoá và
    // chốt `stroke-dasharray="1 1"`, xoá sạch nét đứt. jsdom không chạy animation
    // nên chỉ khẳng định phần kiểm được: nét mẫu là <line> thường, giữ dash khai ở
    // code, và KHÔNG mang thuộc tính animate của motion.
    expect(line?.getAttribute("stroke-dasharray")).toBe("3 2");
    expect(line?.getAttribute("style") ?? "").not.toContain("path-length");
  });
});
