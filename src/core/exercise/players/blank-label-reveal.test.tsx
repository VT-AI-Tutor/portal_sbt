/**
 * Khối "Đáp án đúng" của cloze / fill_blank / word_bank gọi tên từng ô theo
 * `blanks[].label` do tác giả khai, thay cho chuỗi cứng "Số N".
 *
 * web-own: chưa upstream lên studio — studio cũng đang in cứng "Số N" ở cả ba
 * player. File này không tồn tại bên studio nên sync-bằng-copy không đè, và nó
 * đỏ ngay nếu một đợt sync nuốt mất bản vá — hệt cách
 * grouped-mapping-reveal.test.tsx giữ luật gộp theo nhóm.
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

/** aria-label của các ô trống, theo thứ tự xuất hiện. */
function blankAriaLabels(): string[] {
  return Array.from(container.querySelectorAll("button[aria-label]"))
    .map((b) => b.getAttribute("aria-label") ?? "")
    .filter((a) => a.startsWith("Chỗ trống"));
}

/** Khối "Đáp án đúng" của PlayerShell. */
function revealText(): string {
  const heading = Array.from(container.querySelectorAll("p")).find(
    (p) => p.textContent?.trim() === "Đáp án đúng",
  );
  expect(heading).toBeTruthy();
  return (heading!.parentElement as HTMLElement).textContent ?? "";
}

function render(type: string, payload: Record<string, unknown>) {
  act(() => {
    // `submitted` đi ở handlers, không phải payload — đó là công tắc bật khối
    // "Đáp án đúng" của PlayerShell.
    root.render(renderInteractionPlayer(type, payload as never, { submitted: true }));
  });
}

/** Câu Đạo đức 2 bài 5 — nhãn "(1)(2)(3)" đã nằm sẵn trong câu văn. */
function daoDuc(labels?: Array<string | undefined>) {
  return {
    content: {
      blocks: [
        {
          type: "paragraph",
          text: "Quý trọng thời gian là (1){blank_1} thời gian một cách (2){blank_2}. Biết quý trọng thời gian sẽ giúp em (3){blank_3} mọi việc.",
        },
      ],
    },
    blanks: ["blank_1", "blank_2", "blank_3"].map((id, i) => ({
      id,
      ...(labels && labels[i] !== undefined ? { label: labels[i] } : {}),
    })),
    wordBank: ["hoàn thành tốt", "hợp lí", "sử dụng"],
    correctAnswer: {
      blank_1: ["sử dụng"],
      blank_2: ["hợp lí"],
      blank_3: ["hoàn thành tốt"],
    },
    display: { interactionType: "word_bank" },
  };
}

describe("khối Đáp án đúng — nhãn ô trống do tác giả khai", () => {
  describe("cloze (P13)", () => {
    const cloze = (labels?: Array<string | undefined>) => ({
      content: {
        blocks: [{ type: "paragraph", text: "Chứa (1){blank_1} và (2){blank_2}." }],
      },
      blanks: ["blank_1", "blank_2"].map((id, i) => ({
        id,
        ...(labels && labels[i] !== undefined ? { label: labels[i] } : {}),
      })),
      correctAnswer: { blank_1: "văn bản", blank_2: "âm thanh" },
    });

    it("khai nhãn → in đúng nhãn đó", () => {
      render("cloze", cloze(["(1)", "(2)"]));
      const text = revealText();
      expect(text).toContain("(1): văn bản");
      expect(text).toContain("(2): âm thanh");
      expect(text).not.toContain("Số 1");
    });

    it("không khai → giữ nguyên Số N như trước", () => {
      render("cloze", cloze());
      expect(revealText()).toContain("Số 1: văn bản");
    });

    it("khai nhãn RỖNG → bỏ hẳn tiền tố, chỉ còn đáp án", () => {
      render("cloze", cloze(["", ""]));
      const text = revealText();
      expect(text).toContain("văn bản");
      expect(text).not.toContain("Số 1");
      expect(text).not.toContain(": văn bản");
    });

    it("nhãn tận cùng bằng dấu câu KHÔNG bị nối thêm dấu — b22_t1q1 VBT Toán 5", () => {
      // Nhãn viết để in CẠNH Ô (#397) nên tự mang dấu; nối ": " nữa là ra
      // "5,4 : 8 =: 0,675". Không có marker → đi nhánh dự phòng của parseCloze.
      render("cloze", {
        content: { blocks: [{ type: "paragraph", text: "Đặt tính rồi tính:" }] },
        blanks: [
          { id: "blank_7", label: "5,4 : 8 =" },
          { id: "blank_8", label: "3,24 : 6 =" },
        ],
        correctAnswer: { blank_7: ["0,675"], blank_8: ["0,54"] },
      });
      const text = revealText();
      expect(text).toContain("5,4 : 8 = 0,675");
      expect(text).toContain("3,24 : 6 = 0,54");
      expect(text).not.toContain("=:");
    });

    it("nhãn tận cùng \":\" cũng chỉ cách một dấu cách", () => {
      render("cloze", {
        content: { blocks: [{ type: "paragraph", text: "Tìm từ:" }] },
        blanks: [{ id: "b1", label: "a. lưỡi:" }],
        correctAnswer: { b1: ["bộ phận trong miệng"] },
      });
      const text = revealText();
      expect(text).toContain("a. lưỡi: bộ phận trong miệng");
      expect(text).not.toContain("lưỡi::");
    });

    it("nhãn tận cùng \")\" VẪN giữ dấu phân cách — \"(1)\" không phải dấu ngắt câu", () => {
      render("cloze", cloze(["(1)", "(2)"]));
      expect(revealText()).toContain("(1): văn bản");
    });

    it("nhãn KHÔNG in cạnh ô nhập — câu văn đã có sẵn, in nữa là trùng", () => {
      render("cloze", cloze(["(1)", "(2)"]));
      // "(1)" xuất hiện đúng hai lần: một trong câu văn, một trong khối đáp án.
      const all = container.textContent ?? "";
      expect(all.split("(1)").length - 1).toBe(2);
    });
  });

  describe("word_bank (P25)", () => {
    it("khai nhãn → in đúng nhãn đó", () => {
      render("cloze", daoDuc(["(1)", "(2)", "(3)"]));
      const text = revealText();
      expect(text).toContain("(1) → sử dụng");
      expect(text).toContain("(3) → hoàn thành tốt");
      expect(text).not.toContain("Số 1");
    });

    it("không khai → giữ nguyên Số N như trước", () => {
      render("cloze", daoDuc());
      expect(revealText()).toContain("Số 1 → sử dụng");
    });

    it("aria-label GHÉP nhãn, không thay chữ \"Chỗ trống\"", () => {
      // aria-label đè nội dung nút. Thay hẳn bằng "(1)" là học sinh khiếm thị
      // mất manh mối duy nhất rằng đây là ô cần điền.
      render("cloze", daoDuc(["(1)", "(2)", "(3)"]));
      expect(blankAriaLabels()).toEqual([
        "Chỗ trống (1)",
        "Chỗ trống (2)",
        "Chỗ trống (3)",
      ]);
    });

    it("không khai nhãn → aria-label gọi theo thứ tự, không lộ id", () => {
      render("cloze", daoDuc());
      expect(blankAriaLabels()).toEqual([
        "Chỗ trống 1",
        "Chỗ trống 2",
        "Chỗ trống 3",
      ]);
    });

    it("khai nhãn RỖNG → bỏ hẳn tiền tố", () => {
      render("cloze", daoDuc(["", "", ""]));
      const text = revealText();
      expect(text).toContain("sử dụng");
      expect(text).not.toContain("Số 1 →");
    });
  });

  describe("fill_blank (P12)", () => {
    it("khai nhãn → in đúng nhãn đó, kể cả nhãn dài trùng câu văn", () => {
      render("fill_blank", {
        content: {
          blocks: [
            { type: "paragraph", text: "– Tên nhân vật: {blank_1}" },
            { type: "paragraph", text: "– Sự kiện tiêu biểu: {blank_2}" },
          ],
        },
        blanks: [
          { id: "blank_1", label: "Tên nhân vật" },
          { id: "blank_2", label: "Sự kiện tiêu biểu" },
        ],
        correctAnswer: { blank_1: "Lê Lợi", blank_2: "Khởi nghĩa Lam Sơn" },
      });
      const text = revealText();
      expect(text).toContain("Tên nhân vật: Lê Lợi");
      expect(text).toContain("Sự kiện tiêu biểu: Khởi nghĩa Lam Sơn");
      expect(text).not.toContain("Số 1");
    });
  });
});
