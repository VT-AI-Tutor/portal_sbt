/**
 * web-own: file này CHỈ có ở evo-books-web-sbt, cố ý.
 *
 * Bảng Đúng/Sai ở repo này có SỌC chẵn/lẻ thân bảng; studio thì không
 * (`tableStripeClass` và role `"stripe"` không tồn tại bên đó). Sọc lấy màu qua
 * `skin.accent("primary", "stripe")`, skin playful trả về tint bản sắc của
 * player — player này accent indigo nên sọc ra `bg-indigo-100`. Nền nhạt CŨ của
 * ô Đ/S đang chọn cũng đúng `bg-indigo-100`, trùng tới từng chữ số
 * (`oklch(0.93 0.034 272.788)`), nên ở hàng lẻ ô đã chọn mất tín hiệu nền và ô
 * trống thì ăn luôn màu sọc. NXB báo hai lần — Toán 4 tập một, bài 1 C1/C2:
 * "ĐC màu để nút Đ, S ở dòng màu tím để hiển thị rõ".
 *
 * Vì lỗi sinh ra từ một tính năng CHỈ repo này có, không có gì để sửa ngược lên
 * studio. Luật màu vá nó nằm trong `TrueFalseTablePlayer.tsx` — file bị bước 2
 * của quy trình sync CHÉP ĐÈ. Đặt các ca khoá ở đây, dưới một tên studio không
 * có, để bước copy không xoá được chúng: sync mà nuốt mất luật thì file này đỏ
 * ngay thay vì im lặng trả lỗi về tay học sinh.
 *
 * Cùng khuôn với `diagram-fill-answer-reveal.test.tsx` — xem checklist
 * "WEB-OWN PATCHES" cuối `apps/learner/scripts/detokenize-players.mjs`.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

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

const richBlock = (text: string) => ({
  blocks: [{ type: "paragraph", content: [{ text, annotations: {} }] }],
});

/** Đề THẬT của phiếu góp ý: bốn nhận định để hàng b) và d) rơi vào sọc. */
const FOUR = {
  statements: [
    { id: "s_a", label: "a)", content: richBlock("9 999 > 10 000") },
    { id: "s_b", label: "b)", content: richBlock("27 362 < 27 400") },
    { id: "s_c", label: "c)", content: richBlock("57 899 < 75 001") },
    { id: "s_d", label: "d)", content: richBlock("84 012 > 84 021") },
  ],
  correctAnswer: { s_a: false, s_b: true, s_c: true, s_d: false },
};

/** Class nền TĨNH của một phần tử — "hover:bg-…" không tính. */
const bgOf = (el: Element) =>
  Array.from(el.classList).find((cls) => cls.startsWith("bg-"));

const render = () =>
  act(() => {
    root.render(
      // Tắt chấm tức thì: ca NXB báo là lúc HS ĐANG chọn, chưa lộ đúng/sai.
      renderInteractionPlayer("multi_true_false", FOUR, { instantFeedback: false }),
    );
  });

describe("WEB-OWN · nút Đ/S phải nổi trên sọc thân bảng", () => {
  it("sọc vẫn còn: hàng chẵn để trần, hàng lẻ có nền riêng", () => {
    render();
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    expect(rows).toHaveLength(4);
    // Không chốt cứng mã màu: ở đây không có SkinProvider nên sọc rơi về
    // `oddFallback` của player; skin playful trả `bg-indigo-100`. Bất biến là
    // NHỊP, không phải hue — sọc là thứ PHẢI GIỮ, đừng "sửa" bằng cách gỡ nó.
    expect(bgOf(rows[0])).toBe("bg-transparent");
    expect(bgOf(rows[2])).toBe("bg-transparent");
    expect(bgOf(rows[1])).toBeDefined();
    expect(bgOf(rows[1])).not.toBe("bg-transparent");
    expect(bgOf(rows[3])).toBe(bgOf(rows[1]));
  });

  it("ô đã chọn ở HÀNG LẺ không trùng nền sọc của chính hàng đó", () => {
    render();
    // Hàng lẻ (index 1) — đúng hàng NXB gọi là "dòng màu tím".
    const oddRow = container.querySelectorAll("tbody tr")[1];
    const dBtn = Array.from(oddRow.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Đ",
    )!;
    const sBtn = Array.from(oddRow.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "S",
    )!;

    // Ô TRỐNG phải tự khai nền trắng, nếu không nó ăn màu sọc.
    expect(bgOf(dBtn)).toBe("bg-white");

    act(() => {
      dBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Ca hồi quy: hai giá trị này từng BẰNG NHAU (đều bg-indigo-100).
    expect(bgOf(dBtn)).not.toBe(bgOf(oddRow));
    // Nền ĐẶC — sắc độ chọn theo số đo tương phản, xem chú thích ở cellBtn.
    expect(bgOf(dBtn)).toBe("bg-indigo-500");
    expect(dBtn.className).toContain("text-white");
    // Ô còn lại của cùng hàng vẫn trắng, không bị sọc nuốt.
    expect(bgOf(sBtn)).toBe("bg-white");
  });

  it("viền ô trống KHÔNG dùng slate-200 — cùng độ sáng với sọc nên tàng hình", () => {
    render();
    const oddRow = container.querySelectorAll("tbody tr")[1];
    const dBtn = oddRow.querySelectorAll("button")[0];
    // slate-200 so với bg-indigo-100 cho tỉ lệ tương phản 1.00 — đo trên trang
    // thật. Viền biến mất đúng ở hàng cần nó nhất.
    expect(dBtn.className).not.toContain("border-slate-200");
    expect(dBtn.className).toContain("border-slate-400");
  });

  it("viền HOVER đậm hơn lúc nghỉ, không nhạt đi", () => {
    render();
    const dBtn = container.querySelectorAll("tbody tr")[1].querySelectorAll("button")[0];
    // indigo-300 so với sọc chỉ 1.63 — THẤP hơn 2.13 của slate-400 lúc nghỉ, nên
    // rê chuột vào ô trống lại làm nó mờ đi. indigo-400 được 2.54.
    expect(dBtn.className).not.toContain("hover:border-indigo-300");
    expect(dBtn.className).toContain("hover:border-indigo-400");
  });

  it("ô đã chấm giữ cặp 500, không tối lại thành green-700/red-600", () => {
    // Hàng đã chấm KHÔNG còn sọc chàm: nó nhận `accent("success"|"danger",
    // "softFill")` (green-100 / red-100), nên ô Đ/S ở đây đứng trên nền tint
    // cùng họ màu chứ không phải trên sọc — ràng buộc nhẹ hơn thứ đã dùng để
    // chọn cặp 700/600 hồi 11/09. NXB báo cặp đó đậm quá so với màu cũ, Owner
    // chốt 21/09 quay lại cặp 500; ranh giới ô do viền 4px gánh (green-600 2.93
    // · red-600 3.91 so với nền hàng). Ca này chặn đúng chiều ĐÃ BỊ BÁC: tối lại.
    act(() => {
      root.render(renderInteractionPlayer("multi_true_false", FOUR, {}));
    });
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    const btn = (row: Element, label: string) =>
      Array.from(row.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === label,
      )!;

    // b) đáp án ĐÚNG là "Đ" → chấm tức thì ra ô đúng.
    const ok = btn(rows[1], "Đ");
    act(() => {
      ok.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(bgOf(ok)).toBe("bg-green-500");
    expect(ok.className).toContain("text-white");

    // a) đáp án đúng là "S" → bấm "Đ" ra ô sai.
    const wrong = btn(rows[0], "Đ");
    act(() => {
      wrong.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(bgOf(wrong)).toBe("bg-red-500");
    expect(wrong.className).toContain("text-white");

    // Hai nấc tối của vòng 11/09 không được lặng lẽ quay lại.
    expect(bgOf(ok)).not.toBe("bg-green-700");
    expect(bgOf(wrong)).not.toBe("bg-red-600");
  });

  it("nhận định CHỈ CÓ ẢNH: aria-label không cụt, không lộ id", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "multi_true_false",
          {
            statements: [
              // Không chữ, chỉ ảnh — `dispatch` để `text` rỗng (#837/#783).
              {
                id: "s_img",
                content: { blocks: [{ type: "image", url: "https://x.test/a.png" }] },
              },
            ],
            correctAnswer: { s_img: true },
          },
          { instantFeedback: false },
        ),
      );
    });
    const dBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Đ",
    )!;
    const nhan = dBtn.getAttribute("aria-label") ?? "";
    // Từng ra "Đ — " (gạch ngang cụt) hoặc "Đ — s_img" (lộ khoá nội bộ).
    expect(nhan).not.toMatch(/—\s*$/);
    expect(nhan).not.toContain("s_img");
    expect(nhan.trim()).toBe("Đ");
  });

  it("trình đọc màn hình phân biệt được ô đã chọn", () => {
    render();
    const oddRow = container.querySelectorAll("tbody tr")[1];
    const dBtn = Array.from(oddRow.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Đ",
    )!;

    // Nhãn mang cả chữ cái lẫn nhận định — một chữ "Đ" trơ không đủ ngữ cảnh
    // khi người dùng quét qua bốn hàng.
    expect(dBtn.getAttribute("aria-label")).toContain("Đ");
    expect(dBtn.getAttribute("aria-label")).toContain("27 362");

    expect(dBtn.getAttribute("aria-pressed")).toBe("false");
    act(() => {
      dBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(dBtn.getAttribute("aria-pressed")).toBe("true");
  });
});
