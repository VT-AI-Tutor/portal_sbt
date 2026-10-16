import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MathField } from "./MathField";

/**
 * MathLive không dựng trong jsdom nên `<math-field>` ở đây là phần tử trơ — vừa
 * đủ để kiểm thuộc tính mà `MathField` đặt lên nó.
 */
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

describe("chữ trong ô toán dùng phông của chung quanh", () => {
  it("neo --text-font-family vào token phông của player", () => {
    // MathLive vẽ `\text{}` bằng phông riêng (`system-ui`), nên câu văn học sinh
    // gõ trông khác hẳn đề bài ngay phía trên. `inherit` KHÔNG ăn — phải là danh
    // sách phông cụ thể, nên neo vào token dùng chung của player.
    act(() => root.render(<MathField value="" onChange={() => {}} />));
    const field = container.querySelector("math-field") as HTMLElement;
    expect(field.style.getPropertyValue("--text-font-family")).toContain("--player-font-body");
  });

  it("lớp gọi vẫn đè được style", () => {
    act(() =>
      root.render(<MathField value="" onChange={() => {}} style={{ width: "100%" }} />),
    );
    const field = container.querySelector("math-field") as HTMLElement;
    expect(field.style.width).toBe("100%");
    expect(field.style.getPropertyValue("--text-font-family")).toContain("--player-font-body");
  });
});

describe("phím cách ở chế độ toán", () => {
  it("đặt mathModeSpace để phím cách gõ ra dấu cách", () => {
    // Mặc định của MathLive là chuỗi rỗng: trong công thức, phím cách KHÔNG làm
    // gì. Học sinh mở bàn phím viết công thức rồi gõ tiếp văn xuôi trong cùng ô
    // thì "Mai phải trả" ra "Maiphaitra", mất sạch dấu cách, không báo lỗi.
    act(() => root.render(<MathField value="" onChange={() => {}} />));
    const field = container.querySelector("math-field") as HTMLElement & {
      mathModeSpace?: string;
    };
    expect(field.mathModeSpace).toBe("\\ ");
  });
});
