import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectPointsTask } from "./ConnectPointsTask";

// Layout `dots` (§5.15, GAP-251): điểm nối vẽ thành chấm tròn đen nhỏ như bản in
// nối-số trong vở bài tập. Ràng buộc gắt nhất KHÔNG phải màu sắc mà là HÌNH HỌC:
// tâm chấm phải nằm đúng x/y tác giả khai, và mọi nét phải xuất phát từ tâm đó —
// kể cả khi vùng chạm được phóng to cho ngón tay.

vi.mock("./AudioUtils", () => ({ playSuccess: vi.fn(), playError: vi.fn() }));

let container: HTMLDivElement;
let root: Root;

const points = [
  { id: "p1", label: "1", x: 0.2, y: 0.3 },
  { id: "p2", label: "2", x: 0.7, y: 0.25 },
  { id: "p3", label: "3", x: 0.75, y: 0.7 },
];

const KEY = [
  { from: "p1", to: "p2" },
  { from: "p2", to: "p3" },
];

// jsdom trả rect toàn số 0, mà "toạ độ nét = tâm chấm" chỉ chứng minh được khi khung
// vẽ có kích thước THẬT — nếu không thì 0 === 0 và phép so sánh không nói gì. Gán rect
// cố định cho đúng khung vẽ để `dims` (x*width, y*height) ra số kiểm chứng được.
const CANVAS_W = 800;
const CANVAS_H = 480;

function stubCanvasBox() {
  const original = HTMLDivElement.prototype.getBoundingClientRect;
  HTMLDivElement.prototype.getBoundingClientRect = function (this: HTMLDivElement) {
    if (this.dataset.connectPointsBackground) {
      return { x: 0, y: 0, left: 0, top: 0, right: CANVAS_W, bottom: CANVAS_H,
        width: CANVAS_W, height: CANVAS_H, toJSON: () => ({}) } as DOMRect;
    }
    return original.call(this);
  };
  return () => { HTMLDivElement.prototype.getBoundingClientRect = original; };
}

let restoreCanvasBox: () => void;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  restoreCanvasBox = stubCanvasBox();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  restoreCanvasBox();
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
      layout="dots"
      {...props}
    />
  );
}

const render = (element: ReactElement) => act(() => root.render(element));

const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
const dotButton = (index: number) => buttons()[index];
const dotOf = (index: number) => dotButton(index).querySelector<HTMLElement>("[data-point-dot]");
const wrapperOf = (index: number) => dotButton(index).parentElement as HTMLElement;

function connect(a: number, b: number) {
  act(() => dotButton(a).click());
  act(() => dotButton(b).click());
}

describe("connect_points — layout `dots`", () => {
  it("vẽ chấm đen nhỏ thay cho vòng tròn lớn", () => {
    render(task());

    const dot = dotOf(0);
    expect(dot).not.toBeNull();
    expect(dot?.className).toContain("rounded-full");
    // Vòng tròn RỖNG: ruột trắng + viền dày, không phải đĩa đặc.
    expect(dot?.className).toContain("bg-white");
    expect(dot?.className).toContain("border-[3px]");
    expect(dot?.className).toContain("border-sky-500");
    // Không còn viền 4px + nền thẻ của layout mặc định.
    expect(dotButton(0).innerHTML).not.toContain("border-4");
    expect(dotButton(0).dataset.displayLayout).toBe("dots");
  });

  it("giữ layout mặc định khi không khai `dots`", () => {
    render(task({ layout: undefined }));

    expect(container.querySelector("[data-point-dot]")).toBeNull();
    expect(dotButton(0).innerHTML).toContain("border-4");
    expect(dotButton(0).dataset.displayLayout).toBeUndefined();
  });

  it("TÂM chấm nằm đúng x/y tác giả khai, vùng chạm bao đối xứng quanh tâm", () => {
    render(task());

    // Bọc ngoài neo tại đúng phân số và tự dịch về tâm.
    const wrapper = wrapperOf(0);
    expect(wrapper.style.left).toBe("20%");
    expect(wrapper.style.top).toBe("30%");
    expect(wrapper.className).toContain("-translate-x-1/2");
    expect(wrapper.className).toContain("-translate-y-1/2");

    // Vùng chạm 44px (h-11 w-11) căn giữa chấm: hộp lớn lên nhưng tâm không dịch,
    // nên nét nối vẫn cắm đúng vào giữa chấm.
    const button = dotButton(0);
    expect(button.className).toContain("h-11");
    expect(button.className).toContain("w-11");
    expect(button.className).toContain("items-center");
    expect(button.className).toContain("justify-center");
  });

  it("nét nối, nét dẫn và nét bám con trỏ đều xuất phát từ TÂM chấm", () => {
    render(task());

    // Toạ độ tâm chấm theo đúng x/y tác giả khai — đây là con số mọi nét phải dùng.
    const p1 = { x: points[0].x * CANVAS_W, y: points[0].y * CANVAS_H }; // 160, 144
    const p2 = { x: points[1].x * CANVAS_W, y: points[1].y * CANVAS_H }; // 560, 120

    // Chọn điểm 1 rồi rê chuột: nét đứt bám con trỏ bắt đầu tại tâm chấm, kết thúc
    // tại con trỏ — vùng chạm 44px KHÔNG được đẩy điểm xuất phát đi đâu cả.
    act(() => dotButton(0).click());
    act(() => {
      container
        .querySelector("[data-connect-points-background]")!
        .dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 120, clientY: 90 }));
    });
    const preview = container.querySelector<SVGLineElement>('[data-line-role="cursor-preview"]')!;
    expect(preview.getAttribute("x1")).toBe(String(p1.x));
    expect(preview.getAttribute("y1")).toBe(String(p1.y));
    expect(preview.getAttribute("x2")).toBe("120");
    expect(preview.getAttribute("y2")).toBe("90");

    // Nối xong: nét dẫn và nét chính nối đúng hai tâm chấm.
    act(() => dotButton(1).click());
    for (const role of ["guide", "fill"]) {
      const line = container.querySelector<SVGLineElement>(`[data-line-role="${role}"]`)!;
      expect(line.getAttribute("x1")).toBe(String(p1.x));
      expect(line.getAttribute("y1")).toBe(String(p1.y));
      expect(line.getAttribute("x2")).toBe(String(p2.x));
      expect(line.getAttribute("y2")).toBe(String(p2.y));
    }
  });

  it("toạ độ nét KHÔNG đổi giữa layout mặc định và `dots`", () => {
    // Chốt lại chính điều Owner yêu cầu: phóng vùng chạm không được xê dịch hình học.
    const originOf = () => {
      act(() => dotButton(0).click());
      act(() => dotButton(1).click());
      const fill = container.querySelector<SVGLineElement>('[data-line-role="fill"]')!;
      return [fill.getAttribute("x1"), fill.getAttribute("y1"), fill.getAttribute("x2"), fill.getAttribute("y2")];
    };

    render(task({ layout: undefined }));
    const defaultGeometry = originOf();

    act(() => root.unmount());
    root = createRoot(container);
    render(task());
    expect(originOf()).toEqual(defaultGeometry);
  });

  it("chấm VÀ nét cùng đổi màu khi chấm ngay", () => {
    render(task());

    connect(0, 1); // p1–p2: đúng
    expect(dotOf(0)?.className).toContain("border-green-500");
    expect(dotOf(1)?.className).toContain("border-green-500");
    expect(
      container.querySelector('[data-connect-edge="p1->p2"]')?.getAttribute("stroke"),
    ).toBe("#22c55e");

    connect(2, 0); // p3–p1: không có trong đáp án
    expect(dotOf(2)?.className).toContain("border-red-500");
    expect(
      container.querySelector('[data-connect-edge="p3->p1"]')?.getAttribute("stroke"),
    ).toBe("#ef4444");
  });

  it("nhãn nằm CẠNH chấm, không nằm trong chấm", () => {
    render(task());

    const dot = dotOf(0)!;
    // Chấm rỗng: nhãn không được nhét vào trong (12px không chứa nổi chữ).
    expect(dot.textContent).toBe("");
    const button = dotButton(0);
    expect(button.textContent?.trim()).toBe("1");
    const label = Array.from(button.querySelectorAll("span")).find(
      (el) => el.textContent?.trim() === "1" && el !== dot,
    );
    expect(label?.className).toContain("left-full");
    expect(label?.className).toContain("absolute");
  });

  it("điểm không có nhãn chỉ còn chấm trần", () => {
    render(task({ points: [{ id: "p1", label: "", x: 0.2, y: 0.3 }], correctConnections: [] }));

    expect(container.querySelector("[data-point-dot]")).not.toBeNull();
    expect(dotButton(0).textContent?.trim()).toBe("");
  });
});
