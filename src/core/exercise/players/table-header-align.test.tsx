/**
 * web-own: file này CHỈ có ở evo-books-web-sbt, cố ý.
 *
 * Nhãn cột ĐẦU của hai bảng (`TrueFalseTablePlayer`, `CheckboxTablePlayer`) căn
 * GIỮA cho khớp các cột Đ/S — vốn đã căn giữa từ đầu. Trước đó cột đầu căn TRÁI
 * nên cả dải tiêu đề lệch hẳn về một bên; NXB ghi nhận lặp ở Đạo đức (Đ3 bài
 * 3/4/5, Đ5 bài 3), Lịch sử và Địa lí (x4) và Toán 1 bài 7.
 *
 * Hai player đó KHÔNG web-own — bước 2 của quy trình sync chép đè cả file. Bản
 * vá vì thế nằm trong `WEB_OWN_CLASS_PATCHES` của
 * `apps/learner/scripts/detokenize-players.mjs` (bước 3 tự đặt lại sau mỗi lần
 * copy). Các ca dưới đây là lưới an toàn cho chính cái regex đó: studio đổi
 * `min-w-[200px]` thành số khác thì regex hết khớp TRONG IM LẶNG, và file này
 * đỏ ngay ở bước 6 thay vì để lỗi trôi về tay học sinh.
 *
 * Đặt dưới một tên studio KHÔNG có để bước copy không xoá được — cùng khuôn với
 * `true-false-table-stripe-contrast.test.tsx` và `diagram-fill-answer-reveal.test.tsx`.
 * Xem checklist "WEB-OWN PATCHES" cuối codemod.
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

/** Mọi ô tiêu đề có căn giữa không — theo đúng thứ tự cột. */
const headerAligns = () =>
  Array.from(container.querySelectorAll("thead th")).map((th) =>
    th.className.includes("text-center"),
  );

/** Ô ĐẦU TIÊN của thân bảng: phải KHÔNG bị kéo theo. */
const firstBodyCellClass = () =>
  container.querySelector("tbody td")?.className ?? "";

describe("WEB-OWN · hàng tiêu đề của bảng căn giữa hết", () => {
  describe("bảng Đúng/Sai (multi_true_false)", () => {
    /** Đề rút gọn kiểu Đạo đức: nhận định là câu dài, hai cột Đ/S. */
    const twoColumns = (extra: Record<string, unknown> = {}) => ({
      statements: [
        { id: "s_a", label: "a)", content: richBlock("Chào hỏi người lớn tuổi khi gặp mặt.") },
        { id: "s_b", label: "b)", content: richBlock("Chen ngang khi người khác đang nói.") },
      ],
      correctAnswer: { s_a: true, s_b: false },
      ...extra,
    });

    it("nhãn 'Nhận định' căn giữa như hai cột Đ/S", () => {
      act(() => {
        root.render(renderInteractionPlayer("multi_true_false", twoColumns(), {}));
      });

      // Ba cột: Nhận định · Đúng · Sai — không cột nào lệch khỏi hai cột kia.
      expect(headerAligns()).toEqual([true, true, true]);
    });

    it("nội dung nhận định trong thân bảng VẪN căn trái", () => {
      act(() => {
        root.render(renderInteractionPlayer("multi_true_false", twoColumns(), {}));
      });

      // Nhận định là câu dài, phải đọc theo dòng từ mép trái. Đây là nửa kia của
      // yêu cầu NXB — sửa lố xuống <td> là hỏng chỗ đang đúng.
      expect(firstBodyCellClass()).not.toContain("text-center");
    });

    it("bản BA cột: 'Tình huống' căn giữa cùng 'Nhận định', không để lệch một nửa", () => {
      act(() => {
        root.render(
          renderInteractionPlayer(
            "multi_true_false",
            twoColumns({
              columns: { situation: "Tình huống", statement: "Nhận định" },
              statements: [
                {
                  id: "s_a",
                  label: "a)",
                  situation: richBlock("Lan thấy bạn bị ngã ở sân trường."),
                  content: richBlock("Lan chạy tới đỡ bạn dậy."),
                },
              ],
              correctAnswer: { s_a: true },
            }),
            {},
          ),
        );
      });

      // Bốn cột: Tình huống · Nhận định · Đúng · Sai.
      expect(headerAligns()).toEqual([true, true, true, true]);
    });

    it("áp cho MỌI nhãn tác giả khai, không neo vào chữ 'Nhận định'", () => {
      // LS-ĐL khai "Thông tin", Đạo đức 5 bài 3 khai "Hành vi, việc làm" — cùng
      // một ghi nhận, khác chữ. Sửa ở <th> nên không chữ nào phải liệt kê riêng.
      for (const label of ["Thông tin", "Hành vi, việc làm"]) {
        act(() => {
          root.render(
            renderInteractionPlayer("multi_true_false", twoColumns({ statementLabel: label }), {}),
          );
        });

        const first = container.querySelector("thead th");
        expect(first?.textContent).toContain(label);
        expect(first?.className).toContain("text-center");
      }
    });
  });

  describe("bảng đánh dấu (checkbox_table)", () => {
    const payload = (extra: Record<string, unknown> = {}) => ({
      id: "b5_q7",
      type: "checkbox_table",
      version: 2,
      display: { interactionType: "rows" },
      columns: [
        { id: "dung", label: "Đúng" },
        { id: "sai", label: "Sai" },
      ],
      rows: [
        { id: "s1", content: richBlock("a) Có thể di chuyển, đổi tên, xoá tệp.") },
        { id: "s2", content: richBlock("b) Di chuyển là tạo thêm một bản sao.") },
      ],
      correctAnswer: { s1: ["sai"], s2: ["sai"] },
      ...extra,
    });

    it("nhãn hàng căn giữa như các cột dấu tích", () => {
      act(() => {
        root.render(
          renderInteractionPlayer("checkbox_table", payload({ rowsLabel: "Nhận định" }), {}),
        );
      });

      expect(headerAligns()).toEqual([true, true, true]);
      expect(firstBodyCellClass()).not.toContain("text-center");
    });

    it("ô góc để trống cũng căn giữa — không có nhãn thì hàng tiêu đề vẫn đều", () => {
      act(() => {
        root.render(renderInteractionPlayer("checkbox_table", payload(), {}));
      });

      expect(headerAligns()).toEqual([true, true, true]);
    });
  });
});
