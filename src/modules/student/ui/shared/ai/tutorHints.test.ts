import { describe, expect, it } from "vitest";
import { parseHints, buildAnswerMessage } from "./tutorHints";

describe("parseHints", () => {
  it("tách blank + choice theo đúng thứ tự và bỏ token khỏi prose", () => {
    const { prose, fields } = parseHints(
      "Em điền các ô sau nhé:\n[[blank: Bước 1: 20 + 60]]\n[[choice: 25 + 60 :: 80 | 85 | 90]]",
    );
    expect(prose).toBe("Em điền các ô sau nhé:");
    expect(fields).toEqual([
      { kind: "blank", label: "Bước 1: 20 + 60" },
      { kind: "choice", label: "25 + 60", options: ["80", "85", "90"] },
    ]);
  });

  it("choice thiếu lựa chọn (<2) thì giữ nguyên như văn bản, không thành field", () => {
    const { prose, fields } = parseHints(
      "Thử xem [[choice: chỉ một :: 80]] nhé",
    );
    expect(fields).toHaveLength(0);
    expect(prose).toContain("[[choice: chỉ một :: 80]]");
  });

  it("dọn đuôi lơ lửng sau khi bỏ token (: . và = )", () => {
    const a = parseHints("Vậy số cuối cùng sẽ là: [[blank: kết quả]].");
    expect(a.prose).toBe("Vậy số cuối cùng sẽ là");
    const b = parseHints("Bước 1: 20 + 60 = [[blank: tổng]]");
    expect(b.prose).toBe("Bước 1: 20 + 60");
  });

  it("KHÔNG đụng phép tính hợp lệ trong tin nhắn có token", () => {
    const { prose } = parseHints(
      "Đúng là 60 + 1 = 61.\nChọn tiếp nhé: [[choice: 2 + 3 :: 4 | 5 | 6]]",
    );
    expect(prose).toContain("60 + 1 = 61.");
  });

  it("không có token thì prose giữ nguyên, fields rỗng", () => {
    const { prose, fields } = parseHints("Bạn thử tính lại xem sao?");
    expect(fields).toHaveLength(0);
    expect(prose).toBe("Bạn thử tính lại xem sao?");
  });

  it("buildAnswerMessage gộp nhãn = giá trị; ô trống thành ?", () => {
    const fields = parseHints(
      "[[blank: Bước 1]]\n[[choice: Bước 2 :: 80 | 85]]",
    ).fields;
    expect(buildAnswerMessage(fields, { 0: "80", 1: "" })).toBe(
      "Em trả lời: Bước 1 = 80; Bước 2 = ?",
    );
  });
});
