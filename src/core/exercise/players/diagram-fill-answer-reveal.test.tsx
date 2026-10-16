/**
 * Khối "Đáp án đúng" của diagram-fill: nhãn là thứ TÁC GIẢ khai — node không
 * nhãn gọi "Chỗ trống N" (cùng số với aria-label của ô), không bao giờ dựng
 * nhãn từ id (`n_361`). Dấu phân cách là
 * "=" khi nhãn là số và vế phải là phép tính ra chính nó, ":" trong mọi ca khác.
 *
 * web-own: luật dấu "=" chỉ có ở repo này — studio và mono luôn dùng ":". File
 * này không tồn tại bên studio nên sync-bằng-copy không đè, và nó đỏ ngay nếu
 * một đợt sync nuốt mất luật đó.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagramFillPlayer } from "./DiagramFillPlayer";

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
  vi.unstubAllGlobals();
});

/** Khối "Đáp án đúng" của PlayerShell. */
function revealBox(): HTMLElement {
  const heading = Array.from(container.querySelectorAll("p")).find(
    (p) => p.textContent?.trim() === "Đáp án đúng",
  );
  expect(heading).toBeTruthy();
  return heading!.parentElement as HTMLElement;
}

function render(nodes: React.ComponentProps<typeof DiagramFillPlayer>["nodes"]) {
  act(() => {
    root.render(<DiagramFillPlayer title="Điền số" submitted nodes={nodes} edges={[]} />);
  });
}

describe("DiagramFillPlayer answer reveal", () => {
  it("node không nhãn gọi Chỗ trống N — không dựng nhãn từ id", () => {
    render([
      { id: "n_361", fillable: true, acceptedAnswers: ["300 + 60 + 1"] },
      { id: "n_935", fillable: true, acceptedAnswers: ["900 + 30 + 5"] },
    ]);

    const text = revealBox().textContent ?? "";
    expect(text).toContain("Chỗ trống 1: 300 + 60 + 1");
    expect(text).toContain("Chỗ trống 2: 900 + 30 + 5");
    expect(text).not.toContain("361");
    expect(text).not.toContain("n_");
  });

  it("dùng dấu = khi nhãn số do tác giả khai là tổng của đáp án", () => {
    render([
      { id: "n_361", label: "361", fillable: true, acceptedAnswers: ["300 + 60 + 1"] },
      { id: "top", label: "472", fillable: true, acceptedAnswers: ["400 + 70 + 2"] },
    ]);

    const text = revealBox().textContent ?? "";
    expect(text).toContain("361 = 300 + 60 + 1");
    expect(text).toContain("472 = 400 + 70 + 2");
  });

  it("giữ dấu : khi nhãn là chữ", () => {
    render([{ id: "n_la", label: "Lá", fillable: true, acceptedAnswers: ["quang hợp"] }]);

    const text = revealBox().textContent ?? "";
    expect(text).toContain("Lá: quang hợp");
    expect(text).not.toContain("Lá =");
  });

  it("nhãn số có dấu phân cách rơi về dấu :", () => {
    render([{ id: "n_x", label: "1.000", fillable: true, acceptedAnswers: ["1000"] }]);

    const text = revealBox().textContent ?? "";
    expect(text).toContain("1.000: 1000");
    expect(text).not.toContain("1.000 =");
  });

  it("nhãn số + đáp án là chữ giữ dấu : — không dựng đẳng thức sai", () => {
    render([{ id: "n_1", label: "1", fillable: true, acceptedAnswers: ["quang hợp"] }]);

    const text = revealBox().textContent ?? "";
    expect(text).toContain("1: quang hợp");
    expect(text).not.toContain("1 = quang hợp");
  });

  // Ca thật, sách 14-06592d: nhãn là số THỨ TỰ và đáp án là một số rời — hai vế
  // đều là chữ số nhưng "17 = 9" vẫn sai. Chỉ phép cộng ra đúng nhãn mới được "=".
  it("nhãn thứ tự + đáp án là số rời vẫn giữ dấu :", () => {
    render([
      { id: "n_17", label: "17", fillable: true, acceptedAnswers: ["9"] },
      { id: "n_11", label: "11", fillable: true, acceptedAnswers: ["3"] },
    ]);

    const text = revealBox().textContent ?? "";
    expect(text).toContain("17: 9");
    expect(text).toContain("11: 3");
    expect(text).not.toContain("17 = 9");
  });

  it("tổng không ra đúng nhãn thì không phải phân tích số", () => {
    render([{ id: "n_361", label: "361", fillable: true, acceptedAnswers: ["300 + 60 + 2"] }]);

    const text = revealBox().textContent ?? "";
    expect(text).toContain("361: 300 + 60 + 2");
    expect(text).not.toContain("361 = ");
  });

  it("node chưa có đáp án không ném lỗi", () => {
    render([{ id: "n_361", label: "361", fillable: true, acceptedAnswers: ["300 + 60 + 1"] }, { id: "n_7", fillable: true }]);

    const text = revealBox().textContent ?? "";
    expect(text).toContain("361 = 300 + 60 + 1");
    expect(text).not.toContain("n_7");
    expect(text).not.toContain("Chỗ trống 2");
  });

  it("nhãn kiểu số (không nháy) không làm sập câu", () => {
    render([{ id: "n_361", label: 361 as unknown as string, fillable: true, acceptedAnswers: ["300 + 60 + 1"] }]);

    expect(revealBox().textContent).toContain("361 = 300 + 60 + 1");
  });
});
