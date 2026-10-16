import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectPointsTask } from "./ConnectPointsTask";
import { GradeModeContext } from "../players/shared";

// §5.15 chấm bằng BẰNG NHAU TẬP CẠNH không phân hướng. Trước đây connect_points
// chỉ chấm khi cha bật `submitted`, nên trong bài học (runner không truyền
// `submitted`) học sinh nối xong không có phản hồi nào. Bộ test này khoá hành vi
// chấm-ngay từng nét, đúng như câu nối (ConnectLinesPlayer).

vi.mock("./AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

const points = [
  { id: "p1", label: "A", x: 0.1, y: 0.3 },
  { id: "p2", label: "B", x: 0.1, y: 0.6 },
  { id: "p3", label: "1", x: 0.9, y: 0.4 },
  { id: "p4", label: "2", x: 0.9, y: 0.7 },
];

const KEY = [
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
      title="Nối các điểm"
      points={points}
      correctConnections={KEY}
      onComplete={vi.fn()}
      {...props}
    />
  );
}

function render(element: ReactElement) {
  act(() => root.render(element));
}

function point(label: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  expect(button).toBeDefined();
  return button!;
}

/** Nối hai điểm: bấm điểm thứ nhất rồi điểm thứ hai. */
function connect(a: string, b: string) {
  act(() => point(a).click());
  act(() => point(b).click());
}

const edge = (from: string, to: string) =>
  container.querySelector<SVGLineElement>(`[data-connect-edge="${from}->${to}"]`);

const verdictOf = (label: string) => point(label).dataset.pointVerdict;

const canvas = () => container.querySelector<HTMLElement>("[data-connect-points-background]")!;

/**
 * Di chuột trong khung vẽ. jsdom trả rect toàn số 0 nên toạ độ khung = toạ độ
 * client — đủ để khoá hành vi "nét bám đúng chỗ con trỏ".
 */
function movePointer(x: number, y: number) {
  act(() => {
    canvas().dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y }),
    );
  });
}

describe("connect_points — chấm ngay từng nét", () => {
  it("chấm nét ĐÚNG ngay khi nối, không cần bấm Kiểm tra", () => {
    const onElementGraded = vi.fn();
    render(task({ onElementGraded }));

    connect("A", "1");

    expect(edge("p1", "p3")?.dataset.edgeVerdict).toBe("correct");
    expect(verdictOf("A")).toBe("correct");
    expect(verdictOf("1")).toBe("correct");
    expect(onElementGraded).toHaveBeenCalledWith("p1", "correct", undefined);
    expect(onElementGraded).toHaveBeenCalledWith("p3", "correct", undefined);
  });

  it("chấm nét SAI ngay khi nối", () => {
    render(task());

    connect("A", "2");

    expect(edge("p1", "p4")?.dataset.edgeVerdict).toBe("wrong");
    expect(verdictOf("A")).toBe("incorrect");
    expect(verdictOf("2")).toBe("incorrect");
  });

  it("nối ngược đầu vẫn đúng — tập cạnh không phân hướng", () => {
    render(task());

    connect("1", "A");

    expect(edge("p3", "p1")?.dataset.edgeVerdict).toBe("correct");
  });

  it("gỡ nét thì điểm trở lại chưa trả lời (không phải sai)", () => {
    render(task());

    connect("A", "2");
    expect(verdictOf("A")).toBe("incorrect");

    connect("A", "2"); // bấm lại đúng cặp đó = gỡ nét
    expect(edge("p1", "p4")).toBeNull();
    expect(verdictOf("A")).toBeUndefined();
    expect(verdictOf("2")).toBeUndefined();
  });

  it("báo đúng CẢ CÂU khi nối đủ tập cạnh — không cần submitted", () => {
    const onStatusChange = vi.fn();
    const onProgress = vi.fn();
    render(task({ onStatusChange, onProgress }));

    connect("A", "1");
    expect(onStatusChange).not.toHaveBeenCalledWith("success");

    connect("B", "2");
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ correct: 4, wrong: 0, total: 4, done: true }),
    );
  });

  it("nét THỪA ngoài đáp án chặn kết luận đúng cả câu", () => {
    const onStatusChange = vi.fn();
    render(task({ onStatusChange }));

    connect("A", "1");
    connect("B", "2");
    expect(onStatusChange).toHaveBeenLastCalledWith("success");

    // Nối thêm một nét không có trong đáp án. Mở nét từ "1"/"2" — hai đầu ĐƯỢC
    // nối tới, vẫn mở nét được; "A"/"B" đã tiêu vai mở nét (xem luật chuỗi).
    connect("1", "2");
    expect(onStatusChange).toHaveBeenLastCalledWith("idle");
    expect(edge("p3", "p4")?.dataset.edgeVerdict).toBe("wrong");
  });

  it("đẩy đáp án lên cha ở mọi bước", () => {
    const onAnswerChange = vi.fn();
    render(task({ onAnswerChange }));

    connect("A", "1");

    expect(onAnswerChange).toHaveBeenLastCalledWith([{ from: "p1", to: "p3" }]);
  });

  it("vẽ lại bài làm đã lưu (answer) khi quay lại câu", () => {
    render(task({ answer: [{ from: "p1", to: "p3" }] }));

    expect(edge("p1", "p3")).not.toBeNull();
    // Khôi phục KHÔNG chấm lại (đúng hợp đồng useInstantGrading) — chưa có verdict.
    expect(verdictOf("A")).toBeUndefined();
  });

  it("tắt chấm ngay thì quay về chấm khi nộp", () => {
    const onStatusChange = vi.fn();
    render(task({ instantFeedback: false, onStatusChange }));

    connect("A", "1");
    connect("B", "2");
    expect(edge("p1", "p3")?.dataset.edgeVerdict).toBeUndefined();
    expect(onStatusChange).not.toHaveBeenCalledWith("success");

    render(task({ instantFeedback: false, onStatusChange, submitted: true }));
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });

  it("chế độ chấm kín (parent) không lộ verdict khi đang làm", () => {
    const onStatusChange = vi.fn();
    render(
      <GradeModeContext.Provider value={{ mode: "parent" }}>
        {task({ onStatusChange })}
      </GradeModeContext.Provider>,
    );

    connect("A", "1");

    expect(edge("p1", "p3")?.dataset.edgeVerdict).toBeUndefined();
    expect(verdictOf("A")).toBeUndefined();
    expect(onStatusChange).not.toHaveBeenCalledWith("success");
  });

  it("điểm cần HAI nét không bị tô đỏ khi mới nối đúng một nét", () => {
    // Chuỗi 1–2–3: điểm "2" nằm giữa, đáp án của nó gồm hai nét.
    const onStatusChange = vi.fn();
    render(
      task({
        correctConnections: [
          { from: "p1", to: "p2" },
          { from: "p2", to: "p3" },
        ],
        onStatusChange,
      }),
    );

    connect("A", "B"); // p1–p2, đúng một nửa phần việc của điểm B

    expect(edge("p1", "p2")?.dataset.edgeVerdict).toBe("correct");
    expect(verdictOf("A")).toBe("correct");
    // Tập nét của B chưa đủ (thiếu p2–p3) nên câu CHƯA xong…
    expect(onStatusChange).not.toHaveBeenCalledWith("success");
    // …nhưng nét vừa nối là nét đúng: tô đỏ B lúc này là báo động giả.
    expect(verdictOf("B")).toBe("correct");

    connect("B", "1"); // p2–p3: đủ tập
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });

  it("nối chuỗi: đầu ĐƯỢC nối tới mở được nét tiếp, đầu đã nối thì không", () => {
    // Chuỗi 1–2–3: nối A→B rồi B→1.
    render(
      task({
        correctConnections: [
          { from: "p1", to: "p2" },
          { from: "p2", to: "p3" },
        ],
      }),
    );

    connect("A", "B");

    // A đã tìm được bạn: bấm vào A không mở nét mới (không có nét bám con trỏ).
    act(() => point("A").click());
    movePointer(120, 80);
    expect(container.querySelector('[data-line-role="cursor-preview"]')).toBeNull();
    expect(point("A").dataset.pointSpent).toBe("true");

    // B là đầu ĐƯỢC nối tới → vẫn mở được nét sang điểm kế tiếp.
    expect(point("B").dataset.pointSpent).toBeUndefined();
    act(() => point("B").click());
    movePointer(120, 80);
    expect(container.querySelector('[data-line-role="cursor-preview"]')).not.toBeNull();

    act(() => point("1").click());
    expect(edge("p2", "p3")).not.toBeNull();
    expect(edge("p1", "p2")).not.toBeNull();
  });

  it("điểm đã nối vẫn NHẬN được nét, và vẫn gỡ được nét từ đầu kia", () => {
    render(task());

    connect("A", "1"); // p1→p3 đúng; A tiêu vai mở nét
    expect(point("A").dataset.pointSpent).toBe("true");

    // Gỡ nét: chọn đầu được nối tới ("1") rồi bấm "A".
    connect("1", "A");
    expect(edge("p1", "p3")).toBeNull();
    expect(edge("p3", "p1")).toBeNull();
    // Gỡ xong thì A mở nét lại được.
    expect(point("A").dataset.pointSpent).toBeUndefined();
  });

  it("nối SAI thì vẫn mở lại được nét từ điểm đó, và nét mới THAY nét sai", () => {
    render(task());

    connect("A", "2"); // p1–p4: sai
    expect(edge("p1", "p4")?.dataset.edgeVerdict).toBe("wrong");
    // Nét sai không khoá điểm — nếu khoá, học sinh nối nhầm sẽ kẹt.
    expect(point("A").dataset.pointSpent).toBeUndefined();

    connect("A", "1"); // nối lại đúng
    expect(edge("p1", "p4")).toBeNull(); // nét sai bị thay, không chồng thêm
    expect(edge("p1", "p3")?.dataset.edgeVerdict).toBe("correct");
    expect(verdictOf("2")).toBeUndefined(); // đầu kia của nét cũ trở lại trung tính
  });

  it("vẽ nét nối giữa hai điểm: nét chính + nét dẫn đứt bên dưới", () => {
    render(task());

    connect("A", "1");

    const fill = container.querySelector<SVGLineElement>('[data-line-role="fill"]');
    const guide = container.querySelector<SVGLineElement>('[data-line-role="guide"]');
    expect(fill?.getAttribute("data-connect-edge")).toBe("p1->p3");
    // Nét chính chạy pathLength 0→1 nên cần nét dẫn đứt để hai điểm trông đã
    // nối với nhau ngay, y như ConnectLinesPlayer.
    expect(guide).not.toBeNull();
    expect(guide?.getAttribute("stroke-dasharray")).toBe("8 8");
    // Hai đầu nét trùng nhau giữa nét dẫn và nét chính.
    for (const attr of ["x1", "y1", "x2", "y2"]) {
      expect(guide?.getAttribute(attr)).toBe(fill?.getAttribute(attr));
    }
  });

  it("nét đứt bám con trỏ sau khi chọn điểm đầu, và tắt khi nối xong", () => {
    render(task());

    // Chưa chọn điểm nào: không có nét bám con trỏ.
    movePointer(120, 80);
    expect(container.querySelector('[data-line-role="cursor-preview"]')).toBeNull();

    act(() => point("A").click());
    movePointer(120, 80);

    const preview = container.querySelector<SVGLineElement>('[data-line-role="cursor-preview"]');
    expect(preview).not.toBeNull();
    expect(preview?.getAttribute("stroke-dasharray")).toBe("8 8");
    expect(preview?.getAttribute("x2")).toBe("120");
    expect(preview?.getAttribute("y2")).toBe("80");

    // Con trỏ đi tiếp thì nét bám theo.
    movePointer(200, 140);
    expect(
      container.querySelector('[data-line-role="cursor-preview"]')?.getAttribute("x2"),
    ).toBe("200");

    // Bấm điểm thứ hai: nét bám biến mất, còn lại nét nối thật.
    act(() => point("1").click());
    expect(container.querySelector('[data-line-role="cursor-preview"]')).toBeNull();
    expect(container.querySelector('[data-connect-edge="p1->p3"]')).not.toBeNull();
  });

  it("bỏ nét bám con trỏ khi thao tác con trỏ bị huỷ", () => {
    render(task());

    act(() => point("A").click());
    movePointer(120, 80);
    expect(container.querySelector('[data-line-role="cursor-preview"]')).not.toBeNull();

    // React dựng onPointerLeave từ `pointerout` (sự kiện leave gốc không nổi
    // bọt), nên ở jsdom ta khoá nhánh huỷ — cùng một handler xoá nét bám.
    act(() => {
      canvas().dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
    });
    expect(container.querySelector('[data-line-role="cursor-preview"]')).toBeNull();
  });

  it("câu không có đáp án chỉ ghi nhận, không chấm", () => {
    const onStatusChange = vi.fn();
    render(task({ correctConnections: [], onStatusChange }));

    connect("A", "1");

    expect(edge("p1", "p3")?.dataset.edgeVerdict).toBeUndefined();
    expect(onStatusChange).not.toHaveBeenCalledWith("success");
  });
});
