/**
 * Dấu ✓ / ✗ trong ô in cho P10 hotspot "multiple" (spec §5.13.3 `display.mark`)
 * — câu HĐTN 1 bài 1 câu 3 ("Đánh dấu ✓ vào ☐ ở những điều em thường hỏi…"):
 * đề bảo ĐÁNH DẤU vào ô vuông in sẵn, player lại tô một vòng tròn đè lên ô.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { MARK_MAX_PX, MARK_MIN_PX, hotspotMarkCenter, hotspotMarkKind, hotspotMarkSize } from "./hotspot-check-mark";

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
  vi.unstubAllGlobals();
});

/** Hình học của câu thật b1_q3: vòng tròn tâm đặt đúng tâm ô in. */
function payload(display: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    type: "hotspot",
    display: { interactionType: "multiple", ...display },
    selfAssessment: true,
    image: { url: "/uploads/may.png" },
    hotspots: [
      { id: "a", shape: "circle", x: 0.0376, y: 0.2218, radius: 0.06 },
      { id: "b", shape: "circle", x: 0.3778, y: 0.2263, radius: 0.06 },
    ],
    ...overrides,
  };
}

const playContainer = () => container.querySelector<HTMLElement>("img")!.parentElement!;
const markerOf = (id: string) => container.querySelector<HTMLElement>(`[data-hotspot-marker="${id}"]`);

/** Bấm vào tâm vùng `a` trên khung 1000×250 (đúng tỉ lệ ảnh 1800×451). */
function pickA() {
  const el = playContainer();
  el.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 250, width: 1000, height: 250, toJSON: () => ({}) }) as DOMRect;
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 37.6, clientY: 55.45 }));
  });
}

describe("hotspot multiple — display.mark", () => {
  it("không khai mark: vẫn tô vòng tròn như cũ (câu 'Khoanh tròn vào…')", () => {
    act(() => root.render(renderInteractionPlayer("hotspot", payload({}), {})));
    pickA();

    const marker = markerOf("a")!;
    expect(marker.getAttribute("data-hotspot-mark")).toBeNull();
    expect(marker.querySelector("svg")).toBeNull();
    expect(marker.style.borderRadius).toBe("9999px");
    expect(marker.style.borderColor).not.toBe("transparent");
  });

  it("khai ✓: vùng chưa chọn không vẽ gì, chọn rồi chỉ hiện dấu ở tâm — không vòng, không nền", () => {
    act(() => root.render(renderInteractionPlayer("hotspot", payload({ mark: "✓" }), {})));
    expect(markerOf("a")).toBeNull();
    expect(markerOf("b")).toBeNull();

    pickA();
    const marker = markerOf("a")!;
    expect(marker.getAttribute("data-hotspot-mark")).toBe("check");
    expect(marker.querySelector("svg")).not.toBeNull();
    expect(marker.style.left).toBe("3.76%");
    expect(marker.style.top).toBe("22.18%");
    expect(marker.style.background).toBe("");
    expect(marker.style.borderRadius).toBe("");
    expect(markerOf("b")).toBeNull();
  });

  it("câu Không chấm: dấu hiện ngay khi chọn và giữ màu chọn, không đợi chấm", () => {
    const onAnswerChange = vi.fn();
    act(() => root.render(renderInteractionPlayer("hotspot", payload({ mark: "✓" }), { onAnswerChange })));
    pickA();

    expect(onAnswerChange).toHaveBeenLastCalledWith(["a"]);
    expect(markerOf("a")!.style.color).toBe("rgb(234, 88, 12)");
  });

  it("bấm lại vùng đã đánh dấu thì bỏ dấu", () => {
    act(() => root.render(renderInteractionPlayer("hotspot", payload({ mark: "✓" }), {})));
    pickA();
    pickA();
    expect(markerOf("a")).toBeNull();
  });

  it("câu có đáp án: dấu đổi xanh khi chọn đúng", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "hotspot",
          payload({ mark: "✓" }, { selfAssessment: false, correctAnswer: ["a"] }),
          {},
        ),
      ),
    );
    pickA();
    expect(markerOf("a")!.style.color).toBe("rgb(22, 163, 74)");
  });

  it("có chấm: chọn sai hiện ✗ đỏ dù câu khai ✓", () => {
    const graded = payload({ mark: "✓" }, { selfAssessment: false, correctAnswer: ["b"] });
    act(() => root.render(renderInteractionPlayer("hotspot", graded, { answer: ["a"], submitted: true })));

    const wrong = markerOf("a")!;
    expect(wrong.getAttribute("data-hotspot-mark")).toBe("cross");
    expect(wrong.style.color).toBe("rgb(220, 38, 38)");
  });

  it("có chấm: chọn đúng hiện ✓ xanh dù câu khai ✗", () => {
    const graded = payload({ mark: "✗" }, { selfAssessment: false, correctAnswer: ["a"] });
    act(() => root.render(renderInteractionPlayer("hotspot", graded, { answer: ["a"], submitted: true })));

    const right = markerOf("a")!;
    expect(right.getAttribute("data-hotspot-mark")).toBe("check");
    expect(right.style.color).toBe("rgb(22, 163, 74)");
  });

  it("khoá bài: ô đúng bị bỏ sót hiện ✓ dù câu khai ✗", () => {
    const graded = payload({ mark: "✗" }, { selfAssessment: false, correctAnswer: ["a", "b"] });
    act(() => root.render(renderInteractionPlayer("hotspot", graded, { answer: ["a"], submitted: true })));

    const missed = markerOf("b")!;
    expect(missed.getAttribute("data-hotspot-missed")).toBe("true");
    expect(missed.getAttribute("data-hotspot-mark")).toBe("check");
  });

  it("câu Không chấm kèm correctAnswer: khoá bài vẫn giữ dấu khai và màu chọn, không lộ ô đúng", () => {
    const selfChecked = payload({ mark: "✓" }, { correctAnswer: ["b"] });
    act(() => root.render(renderInteractionPlayer("hotspot", selfChecked, { answer: ["a"], submitted: true })));

    const picked = markerOf("a")!;
    expect(picked.getAttribute("data-hotspot-mark")).toBe("check");
    expect(picked.style.color).toBe("rgb(234, 88, 12)");
    expect(markerOf("b")).toBeNull();
  });

  it("chế độ đếm bỏ qua mark, vẫn tô vòng", () => {
    const counted = payload({ mark: "✓" }, { selfAssessment: false, correctAnswer: { count: 1 } });
    act(() => root.render(renderInteractionPlayer("hotspot", counted, {})));
    pickA();

    const marker = markerOf("a")!;
    expect(marker.getAttribute("data-hotspot-mark")).toBeNull();
    expect(marker.querySelector("svg")).toBeNull();
  });

  it("chưa có đúng/sai thì vẽ đúng dấu câu khai", () => {
    act(() => root.render(renderInteractionPlayer("hotspot", payload({ mark: "✗" }), { answer: ["a"] })));
    expect(markerOf("a")!.getAttribute("data-hotspot-mark")).toBe("cross");
  });

  it("khoá bài: ô đúng bị bỏ sót hiện dấu xanh mờ, ô đã chọn giữ dấu rõ", () => {
    const graded = payload({ mark: "✓" }, { selfAssessment: false, correctAnswer: ["a", "b"] });
    act(() => root.render(renderInteractionPlayer("hotspot", graded, { answer: ["a"], submitted: true })));

    const picked = markerOf("a")!;
    expect(picked.getAttribute("data-hotspot-missed")).toBeNull();
    expect(picked.style.color).toBe("rgb(22, 163, 74)");

    const missed = markerOf("b")!;
    expect(missed.getAttribute("data-hotspot-missed")).toBe("true");
    expect(missed.style.color).toBe("rgb(22, 163, 74)");
    expect(missed.getAttribute("data-hotspot-mark")).toBe("check");
  });

  it("chưa khoá bài thì ô đúng chưa chọn không lộ dấu", () => {
    const graded = payload({ mark: "✓" }, { selfAssessment: false, correctAnswer: ["a", "b"] });
    act(() => root.render(renderInteractionPlayer("hotspot", graded, { answer: ["a"] })));
    expect(markerOf("b")).toBeNull();
  });

  it("khôi phục đáp án đã lưu ra lại dấu", () => {
    act(() => root.render(renderInteractionPlayer("hotspot", payload({ mark: "✓" }), { answer: ["b"] })));
    expect(markerOf("b")!.getAttribute("data-hotspot-mark")).toBe("check");
    expect(markerOf("a")).toBeNull();
  });

  it("mark khai sai kiểu hoặc lạ thì bỏ qua, câu vẫn vẽ vòng", () => {
    for (const mark of [1, "", "★", null]) {
      act(() => root.render(renderInteractionPlayer("hotspot", payload({ mark }), {})));
      pickA();
      expect(markerOf("a")!.getAttribute("data-hotspot-mark")).toBeNull();
      act(() => root.render(<></>));
    }
  });
});

describe("hotspotMarkKind", () => {
  it("nhận các cách gõ thường gặp", () => {
    for (const m of ["✓", "✔", " v ", "V", "check"]) expect(hotspotMarkKind(m)).toBe("check");
    for (const m of ["✗", "✕", "x", "X", "×"]) expect(hotspotMarkKind(m)).toBe("cross");
    for (const m of [undefined, 1, "", "o", "★"]) expect(hotspotMarkKind(m)).toBeNull();
  });
});

describe("hotspotMarkCenter", () => {
  it("polygon dồn đỉnh về một phía vẫn đặt dấu giữa khung bao", () => {
    // Ô vuông 0.1–0.2 × 0.4–0.5, mép phải kéo thêm ba đỉnh và lặp đỉnh đầu
    // để khép hình — trung bình đỉnh lệch hẳn sang phải.
    const hs = {
      id: "p",
      shape: "polygon" as const,
      points: [
        { x: 0.1, y: 0.4 }, { x: 0.2, y: 0.4 }, { x: 0.2, y: 0.42 }, { x: 0.2, y: 0.45 },
        { x: 0.2, y: 0.48 }, { x: 0.2, y: 0.5 }, { x: 0.1, y: 0.5 }, { x: 0.1, y: 0.4 },
      ],
    };
    const c = hotspotMarkCenter(hs);
    expect(c.x).toBeCloseTo(0.15, 6);
    expect(c.y).toBeCloseTo(0.45, 6);
  });

  it("circle, rect giữ tâm như cũ", () => {
    expect(hotspotMarkCenter({ id: "c", shape: "circle", x: 0.3, y: 0.6, radius: 0.05 })).toEqual({ x: 0.3, y: 0.6 });
    const r = hotspotMarkCenter({ id: "r", shape: "rect", x: 0.1, y: 0.2, width: 0.2, height: 0.4 });
    expect(r.x).toBeCloseTo(0.2, 6);
    expect(r.y).toBeCloseTo(0.4, 6);
  });
});

describe("hotspotMarkSize", () => {
  const circle = { id: "a", shape: "circle" as const, x: 0.04, y: 0.22, radius: 0.06 };

  it("vùng kéo rộng hơn ô in (b1_q3): chặn trên giữ dấu xấp xỉ cỡ ô", () => {
    // Khung 1144px: ô in ~51px, vòng tác giả kéo 137px → dấu chạm trần 48px.
    expect(hotspotMarkSize(circle, 1144, 287)).toBe(MARK_MAX_PX);
  });

  it("vùng kéo sát ô in (b8_q7) cho dấu lấp phần lớn ô, không lọt thỏm", () => {
    const tight = { id: "h1", shape: "rect" as const, x: 0.2705, y: 0.3667, width: 0.0566, height: 0.0926 };
    // Khung 1144×699: vùng 65×65px → dấu 42px (0.4 cũ chỉ ra 26px).
    expect(hotspotMarkSize(tight, 1144, 699)).toBe(42);
  });

  it("chặn dưới khi chưa đo được khung, chặn trên khi vùng rất to", () => {
    expect(hotspotMarkSize(circle, 0, 0)).toBe(MARK_MIN_PX);
    expect(hotspotMarkSize({ ...circle, radius: 0.4 }, 1200, 800)).toBe(MARK_MAX_PX);
  });

  it("hình tròn không khai bán kính dùng đúng bán kính mặc định của vòng chọn", () => {
    const noRadius = { id: circle.id, shape: circle.shape, x: circle.x, y: circle.y };
    // Mặc định 0.05 bề ngang → đường kính 40px trên khung 400px → dấu 26px.
    expect(hotspotMarkSize(noRadius, 400, 200)).toBe(26);
  });

  it("line lấy theo dải có bề dày, không theo đường tim bẹt", () => {
    const line = { id: "l", shape: "line" as const, points: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }], thickness: 0.06 };
    // Dải dày 0.06 bề ngang = 60px trên khung 1000px → dấu 39px.
    expect(hotspotMarkSize(line, 1000, 1000)).toBe(39);
  });

  it("rect lấy cạnh ngắn theo pixel thật", () => {
    const rect = { id: "r", shape: "rect" as const, x: 0, y: 0, width: 0.5, height: 0.2 };
    // 0.2 × 300 = 60px cạnh ngắn → 39px.
    expect(hotspotMarkSize(rect, 1000, 300)).toBe(39);
  });
});
