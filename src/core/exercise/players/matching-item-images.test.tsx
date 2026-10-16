/**
 * #829 — nội dung của một mục nối cột có thể có NHIỀU ảnh xen giữa các đoạn chữ.
 * Trước đây dispatch chỉ nhấc ảnh ĐẦU TIÊN thành `imageUrl` còn `AlignedRichText`
 * bỏ hết block ảnh, nên ảnh thứ hai không có đường render và ảnh thứ nhất bị đẩy
 * lên đầu thẻ. Bộ test này khoá lại: đủ ảnh, đúng thứ tự tác giả đặt, và alias
 * legacy (`imageUrl` / `image.url`) vẫn chỉ hiện đúng một lần.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const para = (text: string) => ({ type: "paragraph", content: [{ text, annotations: {} }] });
const img = (url: string) => ({ type: "image", url });

/** Mục `a)` của b16_q5: chữ → ảnh → chữ → ảnh. */
const b16q5ItemA = {
  id: "l1",
  content: {
    blocks: [
      para("a) Tạo biến Diện tích, dùng phép toán nhân tạo biểu thức"),
      img("/uploads/dai-nhan-rong.png"),
      para("và tạo lệnh tính diện tích"),
      img("/uploads/khoi-lenh-dien-tich.png"),
    ],
  },
};

function render(payload: Record<string, unknown>) {
  act(() => {
    root.render(renderInteractionPlayer("matching", { display: { interactionType: "columns" }, ...payload }, {}));
  });
}

/**
 * Ảnh + đoạn chữ theo đúng thứ tự chúng xuất hiện trong DOM. Huy hiệu tiêu đề
 * cột (A/B) là chrome của player, không phải nội dung mục — bỏ ra để phép so
 * sánh chỉ nói về thứ tự chữ/ảnh BÊN TRONG một mục.
 */
function documentOrder(): string[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.closest("[data-matching-col-title]")) continue;
      const text = node.textContent?.trim();
      if (text) out.push(`text:${text}`);
    } else if ((node as Element).tagName === "IMG") {
      out.push(`img:${(node as HTMLImageElement).getAttribute("src")?.split("/").pop()}`);
    }
  }
  return out;
}

describe("matching item images (#829)", () => {
  it("hiển thị đủ mọi ảnh của mục, đúng thứ tự chữ → ảnh → chữ → ảnh", () => {
    render({
      leftItems: [b16q5ItemA],
      rightItems: [{ id: "r1", text: "Công việc khi lập trình" }],
      correctAnswer: [{ item: "l1", target: "r1" }],
    });

    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    expect(srcs.filter((s) => s.includes("dai-nhan-rong"))).toHaveLength(1);
    expect(srcs.filter((s) => s.includes("khoi-lenh-dien-tich"))).toHaveLength(1);

    expect(documentOrder()).toEqual([
      "text:a) Tạo biến Diện tích, dùng phép toán nhân tạo biểu thức",
      "img:dai-nhan-rong.png",
      "text:và tạo lệnh tính diện tích",
      "img:khoi-lenh-dien-tich.png",
      "text:Công việc khi lập trình",
    ]);
  });

  it("không đẩy ảnh lên đầu khi tác giả đặt sau phần chữ", () => {
    render({
      leftItems: [
        { id: "l1", content: { blocks: [para("nhãn trước"), img("/uploads/sau.png")] } },
      ],
      rightItems: [{ id: "r1", text: "phải" }],
      correctAnswer: [{ item: "l1", target: "r1" }],
    });

    const order = documentOrder();
    expect(order.indexOf("text:nhãn trước")).toBeLessThan(order.indexOf("img:sau.png"));
  });

  it("alias legacy imageUrl / image.url chỉ render một lần", () => {
    render({
      leftItems: [
        { id: "l1", imageUrl: "/uploads/legacy-a.png", text: "trái" },
        { id: "l2", image: { url: "/uploads/legacy-b.png" }, text: "trái 2" },
      ],
      rightItems: [{ id: "r1", text: "phải" }, { id: "r2", text: "phải 2" }],
      correctAnswer: [{ item: "l1", target: "r1" }, { item: "l2", target: "r2" }],
    });

    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    expect(srcs.filter((s) => s.includes("legacy-a"))).toHaveLength(1);
    expect(srcs.filter((s) => s.includes("legacy-b"))).toHaveLength(1);
  });

  it("alias legacy thắng URL nhưng ảnh trong content vẫn hiện đúng vị trí, không trùng", () => {
    render({
      leftItems: [
        {
          id: "l1",
          imageUrl: "/uploads/alias.png",
          content: { blocks: [para("chữ"), img("/uploads/trong-noi-dung.png"), img("/uploads/thu-hai.png")] },
        },
      ],
      rightItems: [{ id: "r1", text: "phải" }],
      correctAnswer: [{ item: "l1", target: "r1" }],
    });

    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    expect(srcs.filter((s) => s.includes("alias"))).toHaveLength(1);
    expect(srcs.filter((s) => s.includes("trong-noi-dung"))).toHaveLength(1);
    expect(srcs.filter((s) => s.includes("thu-hai"))).toHaveLength(1);
  });

  it("mục một ảnh duy nhất đứng trước chữ giữ nguyên thứ tự cũ", () => {
    render({
      leftItems: [
        { id: "l1", content: { blocks: [img("/uploads/dau.png"), para("nhãn sau")] } },
      ],
      rightItems: [{ id: "r1", text: "phải" }],
      correctAnswer: [{ item: "l1", target: "r1" }],
    });

    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
    expect(srcs.filter((s) => s.includes("dau"))).toHaveLength(1);
    const order = documentOrder();
    expect(order.indexOf("img:dau.png")).toBeLessThan(order.indexOf("text:nhãn sau"));
  });
});
