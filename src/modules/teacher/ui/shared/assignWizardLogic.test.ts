import { describe, expect, it } from "vitest";
import { missingAssignFields } from "./assignWizardLogic";

describe("missingAssignFields", () => {
  it("nói rõ còn thiếu gì khi chưa chọn lớp — ca hay gặp nhất", () => {
    // Thẻ lớp trông như đã chọn sẵn khi trường chỉ có một lớp, nên giáo viên chọn phiếu xong
    // thấy nút "Tiếp tục" vẫn khoá và không hiểu vì sao (nghiệm thu 19/8).
    expect(missingAssignFields({ classId: null, paperId: "p1", due: "2026-08-25" })).toEqual([
      "lớp nhận bài",
    ]);
  });

  it("liệt kê đủ mọi thứ còn thiếu, đúng thứ tự thao tác", () => {
    expect(missingAssignFields({ classId: null, paperId: null, due: null })).toEqual([
      "lớp nhận bài",
      "phiếu bài tập",
      "hạn nộp",
    ]);
  });

  it("đủ điều kiện thì trả mảng rỗng để nút mở", () => {
    expect(missingAssignFields({ classId: "c1", paperId: "p1", due: "2026-08-25" })).toEqual([]);
  });

  it("coi chuỗi rỗng là chưa chọn, không phải đã chọn", () => {
    expect(missingAssignFields({ classId: "", paperId: "p1", due: "2026-08-25" })).toEqual([
      "lớp nhận bài",
    ]);
  });
});
