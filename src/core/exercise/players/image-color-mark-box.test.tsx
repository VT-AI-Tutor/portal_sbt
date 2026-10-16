/**
 * Ô đánh dấu ✓ / ✗ của P62 image_color — câu Đạo đức 3 bài 1 ("Đánh dấu ✓ vào
 * những bạn nghiêm trang…"): đề bảo ĐÁNH DẤU chứ không phải tô màu.
 *
 * web-own: chưa upstream lên studio — xem WEB-OWN PATCHES trong
 * apps/learner/scripts/detokenize-players.mjs. Tên tệp CHỈ có ở repo này: bước
 * sync copy `players/*.{ts,tsx}` từ studio nên không đè tệp lạ, và nếu lần sync
 * sau nuốt mất luật thì các ca dưới đây đỏ ngay.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { markBoxSize } from "./image-color-mark";
import { FieldResizeContext } from "@/core/exercise/field-resize-context";

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

/** Payload dạng corpus: rect x/y = GÓC TRÊN TRÁI, circle x/y = TÂM. */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    display: { interactionType: "image_color" },
    image: { url: "/uploads/scene.png" },
    categories: [
      { id: "c_red", label: "Đỏ", color: "#ef4444" },
      { id: "c_blue", label: "Xanh", color: "#3b82f6" },
    ],
    items: [
      { id: "a_3", label: "Vùng A", shape: "rect", x: 0.3691, y: 0.6861, width: 0.1217, height: 0.1884 },
      { id: "c_1", label: "Vùng B", shape: "circle", x: 0.63, y: 0.25, radius: 0.06 },
    ],
    correctAnswer: { a_3: "c_red", c_1: "c_blue" },
    ...overrides,
  };
}

/** Hai nhóm ✓ / ✗ + đúng hai hình dạng vùng, giống câu Đạo đức thật. */
const markPayload = (overrides: Record<string, unknown> = {}) =>
  payload({
    categories: [
      { id: "c_ok", label: "Nghiêm trang", color: "#22c55e", mark: "✓" },
      { id: "c_no", label: "Chưa nghiêm trang", color: "#ef4444", mark: "✗" },
    ],
    correctAnswer: { a_3: "c_ok", c_1: "c_no" },
    ...overrides,
  });

const markOf = (itemId: string) =>
  container.querySelector<HTMLElement>(`[data-region-mark="${itemId}"]`);
const regionOf = (label: string) => container.querySelector<HTMLElement>(`div[title="${label}"]`)!;
const chip = (text: string) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
    b.textContent?.includes(text),
  )!;

describe("P62 — ô đánh dấu thay cho mảng màu", () => {
  it("không khai mark thì giữ nguyên lối tô màu — không đẻ ra ô dấu nào", () => {
    act(() => root.render(renderInteractionPlayer("classification", payload(), {})));
    act(() => regionOf("Vùng A").click());

    expect(container.querySelector("[data-region-mark]")).toBeNull();
    expect(regionOf("Vùng A").style.backgroundColor).not.toBe("");
  });

  it("khai mark thì vùng đã chọn hiện dấu và KHÔNG còn mảng màu đè lên tranh", () => {
    act(() => root.render(renderInteractionPlayer("classification", markPayload(), {})));
    act(() => regionOf("Vùng A").click()); // nhóm mặc định = c_ok (✓)

    expect(markOf("a_3")!.textContent).toBe("✓");
    expect(regionOf("Vùng A").style.backgroundColor).toBe("");
    expect(regionOf("Vùng A").style.border).toBe("");
  });

  it("đặt dấu ở TÂM hình học khai báo — rect lấy giữa khung, circle lấy tâm", () => {
    act(() => root.render(renderInteractionPlayer("classification", markPayload(), {})));

    act(() => regionOf("Vùng A").click());
    act(() => chip("Chưa nghiêm trang").click());
    act(() => regionOf("Vùng B").click());

    // rect x=0.3691 w=0.1217 → tâm 0.42995; y=0.6861 h=0.1884 → 0.7803.
    expect(markOf("a_3")!.style.left).toBe("42.995%");
    expect(markOf("a_3")!.style.top).toBe("78.03%");
    // circle x/y ĐÃ là tâm — giữ nguyên.
    expect(markOf("c_1")!.style.left).toBe("63%");
    expect(markOf("c_1")!.style.top).toBe("25%");
    expect(markOf("c_1")!.textContent).toBe("✗");
  });

  it("đúng/sai báo bằng màu của ô dấu, vì vùng đã bỏ nền và viền", () => {
    act(() => root.render(renderInteractionPlayer("classification", markPayload(), {})));

    act(() => regionOf("Vùng B").click()); // đáp án c_no, đang cầm c_ok → sai
    expect(markOf("c_1")!.style.borderColor).toBe("rgb(239, 68, 68)");

    act(() => regionOf("Vùng A").click()); // đáp án c_ok → đúng
    expect(markOf("a_3")!.style.borderColor).toBe("rgb(34, 197, 94)");
  });

  it("bấm lại vùng đang đánh dấu thì gỡ dấu đi, ô vuông vẫn còn đó", () => {
    act(() => root.render(renderInteractionPlayer("classification", markPayload(), {})));

    act(() => regionOf("Vùng A").click());
    expect(markOf("a_3")!.textContent).toBe("✓");
    act(() => regionOf("Vùng A").click());
    expect(markOf("a_3")!.textContent).toBe("");
  });

  it("chưa đánh gì thì mỗi vùng vẫn có sẵn một ô rỗng viền xám để bấm vào", () => {
    act(() => root.render(renderInteractionPlayer("classification", markPayload(), {})));

    // NXB: "tạo ô vuông trên mỗi học sinh để đánh dấu" — ô là cái đích bấm.
    expect(container.querySelectorAll("[data-region-mark]")).toHaveLength(2);
    expect(markOf("a_3")!.textContent).toBe("");
    expect(markOf("a_3")!.style.borderColor).toBe("rgb(100, 116, 139)");
    // Nền trong suốt: ô nằm ngay trên mặt bạn trong tranh, tô trắng là xoá mất mặt.
    expect(markOf("a_3")!.style.backgroundColor).toBe("transparent");
    // Và vùng bên dưới không còn vẽ vòng nét đứt cũ chồng lên ô.
    expect(regionOf("Vùng A").style.border).toBe("");
  });

  it("rê chuột lên ô còn rỗng thì hiện mờ dấu sắp đánh", () => {
    act(() => root.render(renderInteractionPlayer("classification", markPayload(), {})));
    act(() => regionOf("Vùng A").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));

    const ghost = markOf("a_3")!;
    expect(ghost.textContent).toBe("✓");
    // Ô vẫn rõ (nó là cái đích bấm), chỉ DẤU bên trong mới mờ.
    expect(ghost.style.opacity).toBe("");
    expect((ghost.firstElementChild as HTMLElement).style.opacity).toBe("0.45");
  });

  it("câu trộn: nhóm không khai dấu vẫn tô màu, không bị úp ô rỗng lên trên", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "classification",
          markPayload({
            categories: [
              { id: "c_ok", label: "Nghiêm trang", color: "#22c55e", mark: "✓" },
              { id: "c_mau", label: "Tô màu", color: "#3b82f6" },
            ],
            correctAnswer: { a_3: "c_ok", c_1: "c_mau" },
          }),
          {},
        ),
      ),
    );

    act(() => chip("Tô màu").click());
    act(() => regionOf("Vùng B").click());

    expect(regionOf("Vùng B").style.backgroundColor).not.toBe("");
    expect(markOf("c_1")).toBeNull();
    expect(markOf("a_3")!.textContent).toBe("");
  });

  it("mark rỗng hay toàn khoảng trắng coi như không khai", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "classification",
          markPayload({
            categories: [{ id: "c_ok", label: "Nghiêm trang", color: "#22c55e", mark: "   " }],
            correctAnswer: { a_3: "c_ok" },
          }),
          {},
        ),
      ),
    );
    act(() => regionOf("Vùng A").click());

    expect(container.querySelector("[data-region-mark]")).toBeNull();
    expect(regionOf("Vùng A").style.backgroundColor).not.toBe("");
  });

  it("mark khai sai kiểu (số) thì bỏ qua, KHÔNG làm hỏng cả câu", () => {
    // Payload gõ tay trong tab JSON của studio ra `"mark": 1` là chuyện có thật;
    // gọi thẳng `.trim()` trên số sẽ ném và câu hỏi trắng bảng.
    act(() =>
      root.render(
        renderInteractionPlayer(
          "classification",
          markPayload({
            categories: [{ id: "c_ok", label: "Nghiêm trang", color: "#22c55e", mark: 1 }],
            correctAnswer: { a_3: "c_ok" },
          }),
          {},
        ),
      ),
    );
    act(() => regionOf("Vùng A").click());

    expect(container.querySelector("[data-region-mark]")).toBeNull();
    expect(regionOf("Vùng A").style.backgroundColor).not.toBe("");
  });

  it("trình đọc màn hình đọc được vùng nào đã đánh dấu gì", () => {
    act(() => root.render(renderInteractionPlayer("classification", markPayload(), {})));

    expect(regionOf("Vùng A").getAttribute("aria-label")).toBe("Vùng A: chưa đánh dấu");
    act(() => regionOf("Vùng A").click());
    expect(regionOf("Vùng A").getAttribute("aria-label")).toBe("Vùng A: đã đánh dấu ✓");
  });

  it("chế độ sửa hình học vẫn thấy ranh giới vùng, không chỉ mỗi ô dấu", () => {
    // Ô dấu BÉ HƠN vùng nên không thay được vai "cho tác giả thấy đang kéo cái gì".
    act(() =>
      root.render(
        <FieldResizeContext.Provider value={{ onResize: vi.fn(), onGeometry: vi.fn() }}>
          {renderInteractionPlayer("classification", markPayload(), {})}
        </FieldResizeContext.Provider>,
      ),
    );

    expect(regionOf("Vùng A").style.border).toContain("dashed");
    expect(markOf("a_3")).not.toBeNull();
  });
});

describe("P62 — polygon hỏng vẫn đặt được ô dấu", () => {
  // Lối vẽ SVG bỏ qua polygon thiếu đỉnh / có toạ độ NaN và rơi về lối hộp;
  // chỗ đặt ô dấu PHẢI theo đúng luật đó, không thì dấu bay khỏi vùng.
  const brokenPolygon = (points: unknown) =>
    markPayload({
      items: [{ id: "a_3", label: "Vùng A", shape: "polygon", points, x: 0.2, y: 0.4, width: 0.2, height: 0.2 }],
      correctAnswer: { a_3: "c_ok" },
    });

  it("polygon có đỉnh NaN → ô dấu bám hộp khai báo, không ra toạ độ NaN", () => {
    act(() =>
      root.render(
        renderInteractionPlayer(
          "classification",
          brokenPolygon([[0.8, Number.NaN], [0.9, 0.2], [0.85, 0.3]]),
          {},
        ),
      ),
    );

    // Hộp x=0.2 w=0.2 → tâm 0.3; y=0.4 h=0.2 → 0.5. (toBeCloseTo vì phép cộng
    // nhị phân ra 30.000000000000004 — sai số đó không phải thứ cần khoá.)
    expect(parseFloat(markOf("a_3")!.style.left)).toBeCloseTo(30);
    expect(parseFloat(markOf("a_3")!.style.top)).toBeCloseTo(50);
    expect(markOf("a_3")!.style.width).not.toContain("NaN");
  });

  it("polygon chỉ có 2 đỉnh → cũng bám hộp, không bám hai điểm đó", () => {
    act(() =>
      root.render(
        renderInteractionPlayer("classification", brokenPolygon([[0.8, 0.1], [0.9, 0.2]]), {}),
      ),
    );

    expect(parseFloat(markOf("a_3")!.style.left)).toBeCloseTo(30);
    expect(parseFloat(markOf("a_3")!.style.top)).toBeCloseTo(50);
  });
});

describe("markBoxSize — chặn trên chặn dưới theo cỡ vùng", () => {
  const rect = (width: number, height: number) => ({ shape: "rect" as const, x: 0, y: 0, width, height });

  it("vùng vừa tầm thì dấu co theo cạnh ngắn của vùng", () => {
    // 0.2 × 600 = 120px → 66, nhưng chặn trên là 40.
    expect(markBoxSize(rect(0.2, 0.2), 600, 600)).toBe(40);
    // 0.1 × 500 = 50px → 27.5 → 28.
    expect(markBoxSize(rect(0.1, 0.1), 500, 500)).toBe(28);
  });

  it("vùng bé tí vẫn không nhỏ hơn chặn dưới", () => {
    // Mặt một bạn trong tranh đông người: 0.04 × 600 = 24px → 13.2, kẹp lên 16.
    expect(markBoxSize(rect(0.04, 0.04), 600, 600)).toBe(16);
    // Chưa đo được khung (jsdom, lúc mới mount) cũng rơi về chặn dưới.
    expect(markBoxSize(rect(0.2, 0.2), 0, 0)).toBe(16);
  });

  it("vùng rất to cũng không vượt chặn trên", () => {
    expect(markBoxSize(rect(0.9, 0.9), 1200, 900)).toBe(40);
  });

  it("lấy cạnh NGẮN, nên vùng dẹt không đẻ ra dấu tràn ra ngoài", () => {
    // Bề ngang 480px nhưng bề dọc chỉ 30px → theo 30.
    expect(markBoxSize(rect(0.8, 0.05), 600, 600)).toBe(17);
  });

  it("circle đo theo ĐƯỜNG KÍNH, không phải bán kính", () => {
    expect(markBoxSize({ shape: "circle", x: 0.5, y: 0.5, radius: 0.05 }, 500, 500)).toBe(28);
  });
});
