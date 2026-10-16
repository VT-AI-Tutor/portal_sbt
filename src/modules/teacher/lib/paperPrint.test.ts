import { describe, expect, it } from "vitest";
import type {
  PaperQuestion,
  TeacherPaper,
} from "@/modules/teacher/api/teacherPaperApi";
import {
  answerLabel,
  buildMatrixFromQuestions,
  preparePrintablePaper,
} from "@/modules/teacher/lib/paperPrint";
import {
  authoredTextToWordHtml,
  buildPaperWordHtml,
} from "@/modules/teacher/lib/paperToWord";

const LEVELS = ["biet", "hieu", "vandung", "vandungcao"];

function question(over: Partial<PaperQuestion> = {}): PaperQuestion {
  return {
    id: `q-${Math.random().toString(36).slice(2)}`,
    type: "single_choice",
    content: "Câu hỏi mẫu",
    options: ["A", "B", "C"],
    payload: { options: ["A", "B", "C"], answer: 0 },
    correct_answer: 0,
    points: 2.5,
    ...over,
  };
}

function paper(questions: PaperQuestion[]): TeacherPaper {
  return {
    id: "p1",
    created_by: "gv",
    kind: "exam",
    title: "Đề kiểm tra giữa kỳ",
    subject: "Toán",
    level: "6",
    duration_minutes: 45,
    questions,
    total_points: 10,
    created_at: "2026-08-20T00:00:00Z",
  };
}

describe("chuẩn bị đề để in", () => {
  it("bỏ câu tương tác và ĐẾM số câu đã bỏ", () => {
    const result = preparePrintablePaper(
      paper([
        question({ type: "single_choice" }),
        question({ type: "drag_drop" }),
        question({ type: "crossword" }),
        question({ type: "essay" }),
      ]),
    );

    expect(result.choice).toHaveLength(1);
    expect(result.written).toHaveLength(1);
    // Im lặng bỏ câu là cách chắc chắn nhất để giáo viên in ra mới phát hiện
    // đề thiếu — con số này phải bày lên màn hình.
    expect(result.droppedCount).toBe(2);
  });

  it("đánh số lại từ 1 cho mỗi phần", () => {
    const result = preparePrintablePaper(
      paper([
        question({ type: "single_choice" }),
        question({ type: "essay" }),
        question({ type: "single_choice" }),
        question({ type: "short_answer" }),
      ]),
    );

    expect(result.choice.map((q) => q.number)).toEqual([1, 2]);
    expect(result.written.map((q) => q.number)).toEqual([1, 2]);
  });

  it("chỉ cộng điểm của câu in được", () => {
    const result = preparePrintablePaper(
      paper([
        question({ points: 4 }),
        question({ points: 6 }),
        question({ type: "drag_drop", points: 99 }),
      ]),
    );
    expect(result.totalPoints).toBe(10);
  });
});

describe("đáp án in ra giấy", () => {
  it("đổi chỉ số phương án thành chữ cái", () => {
    expect(answerLabel(question({ correct_answer: 0 }))).toBe("A");
    expect(answerLabel(question({ correct_answer: 2 }))).toBe("C");
  });

  it("đọc được cả hai phương ngữ đáp án của kho", () => {
    // correct_answer rỗng nhưng payload.answer có — nếu chỉ đọc một đường thì
    // bảng đáp án in ra thiếu nửa số câu.
    const q = question({ correct_answer: null, payload: { answer: 1 } });
    expect(answerLabel(q)).toBe("B");
  });

  it("gộp nhiều đáp án đúng", () => {
    expect(answerLabel(question({ type: "multiple_choice", correct_answer: [0, 2] }))).toBe(
      "A, C",
    );
  });

  it("không bịa đáp án khi câu không có", () => {
    expect(answerLabel(question({ correct_answer: null, payload: {} }))).toBe("—");
  });
});

describe("bảng ma trận in kèm", () => {
  it("dựng từ chính các câu trong đề, không từ ảnh chụp ma trận", () => {
    const rows = buildMatrixFromQuestions(
      [
        question({
          points: 2,
          blueprint_cell: { content_code: "PHANSO", level_code: "biet" },
        }),
        question({
          points: 3,
          blueprint_cell: { content_code: "PHANSO", level_code: "hieu" },
        }),
        question({
          points: 5,
          blueprint_cell: { content_code: "SOTHAPPHAN", level_code: "biet" },
        }),
      ],
      LEVELS,
    );

    expect(rows).toHaveLength(2);
    const phanSo = rows.find((r) => r.contentCode === "PHANSO")!;
    expect(phanSo.counts.biet).toBe(1);
    expect(phanSo.counts.hieu).toBe(1);
    expect(phanSo.counts.vandung).toBe(0);
    expect(phanSo.totalPoints).toBe(5);
  });

  it("dùng NHÃN chủ đề đông cứng cùng đề, không in mã máy", () => {
    // Bảng ma trận in ra là giấy nộp cho nhà trường — "MT_PHANSO" nằm trên đó
    // là lỗi ai cũng thấy, và chỉ thấy sau khi đã in.
    const rows = buildMatrixFromQuestions(
      [
        question({
          blueprint_cell: {
            content_code: "MT_PHANSO",
            level_code: "biet",
            label: "Phân số",
          },
        }),
      ],
      LEVELS,
    );
    expect(rows[0].label).toBe("Phân số");
  });

  it("đề cũ chưa có nhãn thì rơi về mã, không để trống", () => {
    const rows = buildMatrixFromQuestions(
      [question({ blueprint_cell: { content_code: "MT_PHANSO", level_code: "biet" } })],
      LEVELS,
    );
    expect(rows[0].label).toBe("MT_PHANSO");
  });

  it("bỏ qua câu chèn tay không có ô ma trận", () => {
    const rows = buildMatrixFromQuestions(
      [
        question({ blueprint_cell: { content_code: "PHANSO", level_code: "biet" } }),
        question(),
      ],
      LEVELS,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(1);
  });
});

describe("xuất tệp Word", () => {
  it("chuyển công thức thành MathML để Word dựng lại công thức sửa được", () => {
    const html = authoredTextToWordHtml("Tính \\(\\frac{1}{2}\\) của 8");
    expect(html).toContain("<math");
    expect(html).toContain("Tính ");
    // Công thức KHÔNG được lọt ra dạng chữ thô — đó là cả lý do dùng MathML.
    expect(html).not.toContain("\\frac");
  });

  it("thoát ký tự HTML trong nội dung câu", () => {
    expect(authoredTextToWordHtml("So sánh 3 < 5 & 2 > 1")).toBe(
      "So sánh 3 &lt; 5 &amp; 2 &gt; 1",
    );
  });

  it("dựng tài liệu Word có đầu đề, hai phần và trang đáp án", () => {
    const html = buildPaperWordHtml(
      paper([
        question({ type: "single_choice", content: "Câu trắc nghiệm" }),
        question({ type: "essay", content: "Câu tự luận", points: 7.5 }),
      ]),
      { schoolName: "Trường THCS Lê Quý Đôn", includeAnswerKey: true },
    );

    expect(html).toContain("xmlns:w=");
    expect(html).toContain("Trường THCS Lê Quý Đôn");
    expect(html).toContain("PHẦN I. TRẮC NGHIỆM");
    expect(html).toContain("PHẦN II. TỰ LUẬN");
    expect(html).toContain("ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM");
    expect(html).toContain("Câu trắc nghiệm");
  });

  it("bỏ trang đáp án khi giáo viên không chọn", () => {
    const html = buildPaperWordHtml(paper([question()]), {});
    expect(html).not.toContain("ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM");
  });
});
