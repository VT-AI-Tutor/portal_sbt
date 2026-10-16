// @vitest-environment jsdom
/**
 * SBT-73 — bong bóng mascot hiển thị định dạng của gợi ý người soạn.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BusyBee } from "./BusyBee";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("BusyBee", () => {
  it("lời nhắc dạng run → in nghiêng / đậm / màu đúng run", () => {
    act(() =>
      root.render(
        <BusyBee
          status="idle"
          message={[
            { text: "Tìm vần ", annotations: {} },
            { text: "ăc", annotations: { italic: true } },
            { text: ", ", annotations: {} },
            { text: "âc", annotations: { bold: true, color: "rgb(236, 1, 140)" } },
            { text: " nhé!", annotations: {} },
          ]}
        />,
      ),
    );
    expect(container.textContent).toContain("Tìm vần ăc, âc nhé!");
    expect(container.querySelector("em")?.textContent).toBe("ăc");
    expect(container.querySelector("strong")?.textContent).toBe("âc");
    const colored = container.querySelector<HTMLElement>("span[style]");
    expect(colored?.style.color).toBe("rgb(236, 1, 140)");
    expect(colored?.textContent).toBe("âc");
  });

  it("chữ trong run là chữ, không phải HTML", () => {
    act(() =>
      root.render(<BusyBee status="idle" message={[{ text: "<b>đậm</b>", annotations: { italic: true } }]} />),
    );
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("em")?.textContent).toBe("<b>đậm</b>");
  });

  it("lời nhắc dạng chuỗi → in y như cũ", () => {
    act(() => root.render(<BusyBee status="success" message="Tuyệt vời!" />));
    expect(container.textContent).toContain("Tuyệt vời!");
    expect(container.querySelector("em")).toBeNull();
  });

  it("lời nhắc rỗng (chuỗi rỗng hoặc mảng rỗng) → không vẽ bong bóng", () => {
    act(() => root.render(<BusyBee status="idle" message="" />));
    const withEmptyString = container.querySelectorAll("div").length;
    act(() => root.render(<BusyBee status="idle" message={[]} />));
    expect(container.querySelectorAll("div").length).toBe(withEmptyString);
    expect(container.textContent).toBe("");
  });

  it("gợi ý có định dạng → chữ thường nhẹ hơn để run đậm nhìn ra được", () => {
    act(() =>
      root.render(
        <BusyBee
          status="idle"
          message={[
            { text: "Tìm vần ", annotations: {} },
            { text: "âc", annotations: { bold: true } },
          ]}
        />,
      ),
    );
    const bubble = container.querySelector<HTMLElement>(".rounded-2xl");
    expect(bubble?.className).toContain("font-bold");
    expect(bubble?.className).not.toContain("font-black");
    expect(container.querySelector("strong")?.className).toContain("font-black");
  });

  it("lời nhắc dạng chuỗi → bong bóng vẫn font-black như cũ", () => {
    act(() => root.render(<BusyBee status="idle" message="Làm bài nhé!" />));
    const bubble = container.querySelector<HTMLElement>(".rounded-2xl");
    expect(bubble?.className).toContain("font-black");
    expect(bubble?.className).not.toContain("font-bold");
  });
});
