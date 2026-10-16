/**
 * Khối "Đáp án đúng" và nhãn trợ năng chỉ gọi phần tử bằng tên TÁC GIẢ khai.
 * Id là định danh máy — thiếu tên thì gọi theo vị trí ("Thẻ 2"), phần tử chỉ
 * có ảnh thì hiện chính ảnh đó.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authoredName, joinReveal, nameOrOrdinal, revealName } from "./answer-name";
import { renderInteractionPlayer } from "./dispatch";
import { RankPlayer } from "./RankPlayer";

vi.mock("../tasks/AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

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
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const render = (node: ReactNode) => act(() => root.render(<>{node}</>));
const revealText = () => {
  const heading = Array.from(container.querySelectorAll("p")).find((p) => p.textContent === "Đáp án đúng");
  return heading?.parentElement?.textContent ?? "";
};

describe("authoredName", () => {
  it("lấy content → text → label, bỏ khoảng trắng", () => {
    expect(authoredName({ text: "  Lá  ", label: "x" })).toBe("Lá");
    expect(authoredName({ text: "", label: "Rễ" })).toBe("Rễ");
  });

  it("không khai tên → undefined", () => {
    expect(authoredName({})).toBeUndefined();
    expect(authoredName({ text: "   " })).toBeUndefined();
  });

  it("nhãn kiểu số không làm sập câu", () => {
    expect(authoredName({ label: 361 })).toBe("361");
  });
});

describe("revealName / joinReveal", () => {
  it("thiếu tên thì gọi theo vị trí, chỉ có ảnh thì trả ảnh", () => {
    expect(nameOrOrdinal({}, 2, "Thẻ")).toBe("Thẻ 3");
    expect(revealName({ imageUrl: "/a.png" }, 0, "Thẻ")).toEqual({ image: "/a.png", alt: "Thẻ 1" });
    expect(nameOrOrdinal(undefined, -1, "Thẻ")).toBe("");
  });

  it("toàn chữ thì vẫn là chuỗi", () => {
    expect(joinReveal([["Táo", " → ", "Trái cây"], ["Cà rốt", " → ", "Rau"]])).toBe(
      "Táo → Trái cây\nCà rốt → Rau",
    );
  });
});

describe("bảng đáp án không lộ id", () => {
  it("classification: thẻ chỉ có ảnh hiện ảnh, nhóm không tên gọi theo vị trí", () => {
    render(
      renderInteractionPlayer(
        "classification",
        {
          categories: [{ id: "cat-fruit", label: "Trái cây" }, { id: "cat_x9" }],
          items: [
            { id: "item_a1", imageUrl: "/uploads/apple.png" },
            { id: "item_b2", text: "Cà rốt" },
          ],
          correctAnswer: [
            { itemId: "item_a1", categoryId: "cat-fruit" },
            { itemId: "item_b2", categoryId: "cat_x9" },
          ],
        },
        { submitted: true },
      ),
    );
    const text = revealText();
    expect(text).toContain("Cà rốt → Nhóm 2");
    expect(text).not.toMatch(/item_a1|item_b2|cat_x9/);
    const img = Array.from(container.querySelectorAll("img")).find((i) => i.alt === "Thẻ 1");
    expect(img).toBeTruthy();
  });

  it("classification gộp theo nhóm: nhóm không tên gọi theo vị trí, không in id", () => {
    render(
      renderInteractionPlayer(
        "classification",
        {
          categories: [{ id: "cat-fruit", label: "Trái cây" }, { id: "cat_x9" }],
          items: [
            { id: "item_a1", text: "Táo" },
            { id: "item_b2", text: "Cà rốt" },
          ],
          correctAnswer: [
            { itemId: "item_a1", categoryId: "cat-fruit" },
            { itemId: "item_b2", categoryId: "cat_x9" },
          ],
        },
        { submitted: true },
      ),
    );
    const text = revealText();
    expect(text).toContain("Trái cây: Táo");
    expect(text).toContain("Nhóm 2: Cà rốt");
    expect(text).not.toContain("cat_x9");
  });

  it("thẻ không chữ: mặt bài và bảng đáp án gọi cùng một tên", () => {
    render(
      renderInteractionPlayer(
        "classification",
        {
          categories: [{ id: "cat-a", label: "Nhóm A" }],
          items: [
            { id: "item_a1", text: "Táo" },
            { id: "item_b2" },
          ],
          correctAnswer: [
            { itemId: "item_a1", categoryId: "cat-a" },
            { itemId: "item_b2", categoryId: "cat-a" },
          ],
        },
        { submitted: true },
      ),
    );
    expect(container.textContent).not.toContain("item_b2");
    const chips = Array.from(container.querySelectorAll("button")).map((b) => b.textContent?.trim());
    expect(chips).toContain("Thẻ 2");
    expect(revealText()).toContain("Thẻ 2");
  });

  it("rank: mục không khai chữ gọi theo vị trí", () => {
    render(
      <RankPlayer
        title="Xếp hạng"
        submitted
        items={[
          { id: "r_1", text: "Nhất" },
          { id: "r_2", text: "" },
        ]}
        correctOrder={["r_2", "r_1"]}
      />,
    );
    expect(revealText()).toContain("1. Mục 2");
    expect(revealText()).toContain("2. Nhất");
    expect(revealText()).not.toContain("r_2");
  });

  it("diagram_fill: không nhãn thì khối đáp án và aria cùng gọi Chỗ trống N; có nhãn thì giữ", () => {
    render(
      renderInteractionPlayer(
        "diagram_fill",
        {
          nodes: [
            { id: "n_root", label: "Cây" },
            { id: "n_361", fillable: true },
            { id: "n_la", label: "Lá", fillable: true },
          ],
          edges: [],
          correctAnswer: { n_361: "300 + 60 + 1", n_la: "quang hợp" },
        },
        { submitted: true },
      ),
    );
    const text = revealText();
    expect(text).toContain("Chỗ trống 1: 300 + 60 + 1");
    expect(text).toContain("Lá: quang hợp");
    expect(text).not.toContain("n_361");
    const labels = Array.from(container.querySelectorAll("input")).map((i) => i.getAttribute("aria-label"));
    expect(labels).toEqual(["Chỗ trống 1", "Chỗ trống Lá"]);
  });

  it("diagram_fill: ô không nhãn đứng sau ô có nhãn vẫn đánh số theo thứ tự mọi ô điền được", () => {
    render(
      renderInteractionPlayer(
        "diagram_fill",
        {
          nodes: [
            { id: "n_la", label: "Lá", fillable: true },
            { id: "n_361", fillable: true },
          ],
          edges: [],
          correctAnswer: { n_la: "quang hợp", n_361: "300 + 60 + 1" },
        },
        { submitted: true },
      ),
    );
    expect(revealText()).toContain("Chỗ trống 2: 300 + 60 + 1");
    const labels = Array.from(container.querySelectorAll("input")).map((i) => i.getAttribute("aria-label"));
    expect(labels).toEqual(["Chỗ trống Lá", "Chỗ trống 2"]);
  });

  it("diagram_fill: ô chưa có đáp án không in dòng cụt, các ô sau giữ số của mình", () => {
    render(
      renderInteractionPlayer(
        "diagram_fill",
        {
          nodes: [
            { id: "n_a", fillable: true },
            { id: "n_b", fillable: true },
            { id: "n_c", fillable: true },
          ],
          edges: [],
          correctAnswer: { n_a: "5", n_c: "7" },
        },
        { submitted: true },
      ),
    );
    const text = revealText();
    expect(text).toContain("Chỗ trống 1: 5");
    expect(text).not.toContain("Chỗ trống 2");
    expect(text).toContain("Chỗ trống 3: 7");
  });
});

describe("diagram_fill có toạ độ: aria đếm đúng thứ tự ô", () => {
  it("node trải qua bản sao toạ độ vẫn ra Chỗ trống 1, không phải 0", () => {
    render(
      renderInteractionPlayer(
        "diagram_fill",
        {
          nodes: [
            { id: "n_root", label: "Cây", x: 0.5, y: 0.15 },
            { id: "n_361", fillable: true, x: 0.25, y: 0.7 },
            { id: "n_la", label: "Lá", fillable: true, x: 0.75, y: 0.7 },
          ],
          edges: [],
          correctAnswer: { n_361: "300 + 60 + 1", n_la: "quang hợp" },
        },
        { submitted: true },
      ),
    );
    const labels = Array.from(container.querySelectorAll("input")).map((i) => i.getAttribute("aria-label"));
    expect(labels).toEqual(["Chỗ trống 1", "Chỗ trống Lá"]);
  });
});

describe("nhóm chỉ có ảnh", () => {
  it("gọi là Ảnh N ở cả mặt bài lẫn bảng đáp án, không phải Nhóm N", () => {
    render(
      renderInteractionPlayer(
        "classification",
        {
          categories: [
            { id: "cat_fruit", label: "Trái cây" },
            { id: "cat_x9", imageUrl: "/uploads/veg.png" },
          ],
          items: [{ id: "item_c3", text: "Cà rốt" }],
          correctAnswer: [{ itemId: "item_c3", categoryId: "cat_x9" }],
        },
        { submitted: true },
      ),
    );
    // Mono gộp bảng phân loại theo nhóm (#474): "- Ảnh 2: Cà rốt."
    expect(revealText()).toContain("Ảnh 2: Cà rốt");
    expect(revealText()).not.toContain("Nhóm 2");
    expect(container.textContent).not.toContain("cat_x9");
  });
});
