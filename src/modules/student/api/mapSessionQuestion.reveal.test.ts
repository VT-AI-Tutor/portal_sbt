/**
 * Khoá đáp án ở màn XEM LẠI bài đã nộp (báo lỗi nghiệm thu 17/8: câu làm sai chỉ
 * hiện "Chưa đúng 😅", không nói đáp án đúng là gì).
 *
 * Hai chiều đều phải pin:
 *  - `reveal: true` → payload CÓ khoá đáp án, đúng hình dạng player đọc được.
 *  - mặc định (đang làm bài) → TUYỆT ĐỐI không có khoá; đây là chốt chặn BUG-03,
 *    lộ đáp án lúc còn làm lại được là hỏng bài học.
 */
import { describe, expect, it } from "vitest";
import { mapSessionQuestion } from "./mapSessionQuestion";
import type { SessionQuestion } from "./practiceApi";

function question(overrides: Partial<SessionQuestion>): SessionQuestion {
  return {
    id: "q1",
    order: 0,
    question_text: "Câu hỏi",
    question_type: "single_choice",
    payload: {},
    ...overrides,
  } as SessionQuestion;
}

describe("mapSessionQuestion — khoá đáp án khi xem lại", () => {
  it("mặc định KHÔNG gắn khoá đáp án (đang làm bài)", () => {
    const q = question({
      payload: { correctAnswer: "B", options: [{ id: "A" }, { id: "B" }] },
    });

    expect(mapSessionQuestion(q).payload.correctAnswer).toBeUndefined();
  });

  it("reveal: true gắn khoá đáp án cho câu chọn một", () => {
    const q = question({
      payload: { correctAnswer: "B", options: [{ id: "A" }, { id: "B" }] },
    });

    expect(mapSessionQuestion(q, { reveal: true }).payload.correctAnswer).toBe("B");
  });

  it("reveal: true giữ nguyên mảng đáp án của câu chọn nhiều", () => {
    const q = question({
      question_type: "multiple_choice",
      payload: { correctAnswer: ["A", "C"] },
    });

    expect(mapSessionQuestion(q, { reveal: true }).payload.correctAnswer).toEqual(["A", "C"]);
  });

  it("đổi mảng id đúng của multi_true_false sang Record player đọc được", () => {
    // Trên đường dây payload.correctAnswer là MẢNG id nhận định đúng; player đọc
    // Record<statementId, boolean> — sai hình dạng thì player không tô được gì.
    const q = question({
      question_type: "multi_true_false",
      payload: {
        statements: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
        correctAnswer: ["s1", "s3"],
      },
    });

    expect(mapSessionQuestion(q, { reveal: true }).payload.correctAnswer).toEqual({
      s1: true,
      s2: false,
      s3: true,
    });
  });

  it("gắn khoá cho TỪNG câu con của question_group", () => {
    const q = question({
      question_type: "question_group",
      payload: {
        subQuestions: [
          { id: "c1", type: "single_choice", correctAnswer: "A" },
          { id: "c2", type: "multiple_choice", correctAnswer: ["B"] },
        ],
      },
    });

    const children = mapSessionQuestion(q, { reveal: true }).payload
      .subQuestions as Array<Record<string, unknown>>;

    expect(children.map((c) => c.correctAnswer)).toEqual(["A", ["B"]]);
    // Và mặc định thì con cũng không được mang khoá.
    const kin = mapSessionQuestion(q).payload.subQuestions as Array<Record<string, unknown>>;
    expect(kin.every((c) => c.correctAnswer === undefined)).toBe(true);
  });

  it("câu không có đáp án trong payload thì không dựng khoá rỗng", () => {
    const q = question({ question_type: "essay", payload: {} });

    expect("correctAnswer" in mapSessionQuestion(q, { reveal: true }).payload).toBe(false);
  });

  it("ưu tiên cờ Đ/S của từng nhận định khi có, không lấy mảng cấp trên", () => {
    // Dữ liệu thật mang CẢ HAI; cờ riêng là nguồn chuẩn.
    const q = question({
      question_type: "multi_true_false",
      payload: {
        statements: [
          { id: "s1", correctAnswer: true },
          { id: "s2", correctAnswer: false },
        ],
        correctAnswer: ["s2"],
      },
    });

    expect(mapSessionQuestion(q, { reveal: true }).payload.correctAnswer).toEqual({
      s1: true,
      s2: false,
    });
  });

  it("reveal tắt record-only, mặc định giữ bật", () => {
    // Mấu chốt của cả bản sửa: player đọc `recordOnly = selfAssessment || !hasKey`
    // và record-only thì KHÔNG tô ô đúng dù có khoá đáp án lẫn cờ revealCorrect.
    const q = question({ payload: { correctAnswer: "B" } });

    expect(mapSessionQuestion(q).payload.selfAssessment).toBe(true);
    expect(mapSessionQuestion(q, { reveal: true }).payload.selfAssessment).toBe(false);
  });
});
