import { describe, expect, it } from "vitest";
import {
  buildStudyTopicChips,
  buildTopicChips,
  parseCustomCount,
  COUNT_PRESETS,
  practiceBlockedReason,
} from "./customPracticeLogic";
import type { PracticeTopic } from "@/modules/student/api/practiceApi";

const topic = (code: string, label: string): PracticeTopic => ({
  content_code: code,
  label,
  mastery_percent: null,
  attempted: 0,
  question_available: 10,
  ref: { content_code: code },
});

describe("buildTopicChips", () => {
  it("môn cụ thể: Tổng hợp đứng đầu mang subjectCode, chips không prefix môn", () => {
    const chips = buildTopicChips("toan", [topic("t1", "Phân số")], [], () => "Toán");
    expect(chips[0]).toEqual({ key: "all", subjectCode: "toan", contentCode: null, label: "Tổng hợp" });
    expect(chips[1]).toEqual({ key: "toan:t1", subjectCode: "toan", contentCode: "t1", label: "Phân số" });
  });

  it("Tất cả: Tổng hợp không có môn (disable), chips prefix 'Môn · Chủ đề' và suy ra môn", () => {
    const chips = buildTopicChips(
      "all",
      [],
      [
        { subjectCode: "toan", data: [topic("t1", "Phân số")], isLoading: false, isError: false },
        { subjectCode: "khoa-hoc", data: [topic("k1", "Chất")], isLoading: false, isError: false },
      ],
      (c) => (c === "toan" ? "Toán" : "Khoa học"),
    );
    expect(chips[0].subjectCode).toBeNull();
    expect(chips[1]).toEqual({ key: "toan:t1", subjectCode: "toan", contentCode: "t1", label: "Toán · Phân số" });
    expect(chips[2].label).toBe("Khoa học · Chất");
  });

  it("Tất cả: slice đang loading/chưa có data bị bỏ qua, không crash", () => {
    const chips = buildTopicChips(
      "all",
      [],
      [{ subjectCode: "toan", data: undefined, isLoading: true, isError: false }],
      () => "Toán",
    );
    expect(chips).toHaveLength(1); // chỉ còn Tổng hợp
  });
});

describe("parseCustomCount", () => {
  it("presets nằm trong khoảng hợp lệ", () => {
    for (const p of COUNT_PRESETS) {
      expect(parseCustomCount(String(p))).toEqual({ ok: true, value: p });
    }
  });

  it("chặn ngoài khoảng và không phải số nguyên", () => {
    expect(parseCustomCount("0").ok).toBe(false);
    expect(parseCustomCount("31").ok).toBe(false);
    expect(parseCustomCount("2.5").ok).toBe(false);
    expect(parseCustomCount("abc").ok).toBe(false);
    expect(parseCustomCount(" 15 ")).toEqual({ ok: true, value: 15 });
  });
});

describe("practiceBlockedReason", () => {
  const ok = { pending: false, needSubject: false, hasLevel: true, count: 10 };

  it("ca hay gặp nhất: bộ lọc môn để 'Tất cả' nên chỉ có chủ đề Tổng hợp", () => {
    // Nút khoá mà không nói lý do thì học sinh bấm mãi rồi bỏ cuộc (nghiệm thu 19/8).
    expect(practiceBlockedReason({ ...ok, needSubject: true })).toBe(
      "Chọn một môn ở trên để bắt đầu nhé.",
    );
  });

  it("thiếu khối lớp thì chỉ sang Hồ sơ, vì đó là chỗ sửa được", () => {
    expect(practiceBlockedReason({ ...ok, hasLevel: false })).toContain("Hồ sơ");
  });

  it("số câu không hợp lệ", () => {
    expect(practiceBlockedReason({ ...ok, count: null })).toBe("Nhập số câu hợp lệ để bắt đầu.");
  });

  it("đủ điều kiện thì im lặng, không thêm chữ thừa cạnh nút", () => {
    expect(practiceBlockedReason(ok)).toBeNull();
  });

  it("đang tạo phiên thì không báo thiếu gì — nút đã đổi sang 'Đang tạo...'", () => {
    expect(practiceBlockedReason({ ...ok, pending: true, needSubject: true })).toBeNull();
  });
});

describe("buildStudyTopicChips (Owner 21/08 — chip theo bài lộ trình)", () => {
  const tree = {
    id: "p1",
    code: "X",
    version: "1",
    name: "Path",
    path_type: "standard",
    subject_code: "toan",
    level: "6",
    sections: [
      {
        id: "s1",
        sequence: 0,
        title: "Chương I",
        topics: [
          { id: "t1", sequence: 0, title: "Tập hợp", topic_type: "new_content", estimated_duration: null,
            units: [{ unit_code: "U1", role: "primary", name: "Khái niệm tập hợp" }] },
          { id: "t2", sequence: 1, title: "Bài chưa gắn unit", topic_type: "new_content", estimated_duration: null,
            units: [] },
        ],
      },
    ],
    cross_cutting_topics: [
      { id: "t3", sequence: 0, title: "Chuyên đề số liệu", topic_type: "cross_cutting", estimated_duration: null,
        units: [{ unit_code: "U9", role: "primary", name: null }] },
    ],
  };

  it("lấy bài có unit theo thứ tự cây, bỏ bài chưa gắn unit", () => {
    const chips = buildStudyTopicChips("toan", tree);
    expect(chips.map((c) => c.label)).toEqual(["Tập hợp", "Chuyên đề số liệu"]);
    expect(chips[0]).toMatchObject({ key: "sp:t1", subjectCode: "toan", studyTopicId: "t1", contentCode: null });
  });

  it("lọc 'Tất cả' hoặc không có cây → rỗng (rơi về chip chủ đề cũ)", () => {
    expect(buildStudyTopicChips("all", tree)).toEqual([]);
    expect(buildStudyTopicChips("toan", null)).toEqual([]);
  });

  it("buildTopicChips ưu tiên chip lộ trình khi có, giữ Tổng hợp đứng đầu", () => {
    const sp = buildStudyTopicChips("toan", tree);
    const chips = buildTopicChips("toan", [{ content_code: "c1", label: "Chủ đề cũ" } as never], [], () => "Toán", sp);
    expect(chips.map((c) => c.label)).toEqual(["Tổng hợp", "Tập hợp", "Chuyên đề số liệu"]);
    // Không có lộ trình → fallback chip chủ đề cũ.
    const fallback = buildTopicChips("toan", [{ content_code: "c1", label: "Chủ đề cũ" } as never], [], () => "Toán", []);
    expect(fallback.map((c) => c.label)).toEqual(["Tổng hợp", "Chủ đề cũ"]);
  });
});
