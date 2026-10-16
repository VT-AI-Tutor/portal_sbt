import { describe, expect, it } from "vitest";
import type { LectureSection } from "@/modules/teacher/api/teacherLectureApi";
import {
  blockingSectionGroups,
  blockingSectionKeys,
  sectionMissingQuiz,
} from "./lectureFinalizeGate";

function section(
  overrides: Partial<LectureSection> & { key: LectureSection["key"] },
): LectureSection {
  return {
    title: "X",
    objective: "",
    blocks: [],
    slides: [],
    question_ids: [],
    generated_at: null,
    edited_at: null,
    ...overrides,
  };
}

describe("sectionMissingQuiz — nguồn thật DUY NHẤT cho luật 'đang thiếu quiz' (review vòng 2)", () => {
  it("quiz VẮNG MẶT (chưa sinh lần nào / bài giảng cũ) — KHÔNG coi là thiếu dù question_ids rỗng", () => {
    const s = section({
      key: "khoidong",
      blocks: [{ type: "text", content: "A" }],
    });
    expect(sectionMissingQuiz(s)).toBe(false);
  });

  it("quiz.count===0 (máy chủ ĐÃ XÉT, không cần quiz) — KHÔNG coi là thiếu, đây là ca HỢP LỆ", () => {
    const s = section({
      key: "khoidong",
      blocks: [{ type: "text", content: "A" }],
      quiz: { count: 0 },
    });
    expect(sectionMissingQuiz(s)).toBe(false);
  });

  it("quiz.count>0 (có đề xuất thật) và question_ids rỗng — ĐÚNG ca dây chuyền rớt mạng ở bước bốc/gắn quiz", () => {
    const s = section({
      key: "khoidong",
      blocks: [{ type: "text", content: "A" }],
      quiz: { count: 2, level_code: "biet" },
    });
    expect(sectionMissingQuiz(s)).toBe(true);
  });

  it("quiz.count>0 nhưng question_ids ĐÃ gắn — không còn thiếu", () => {
    const s = section({
      key: "khoidong",
      blocks: [{ type: "text", content: "A" }],
      quiz: { count: 2, level_code: "biet" },
      question_ids: ["q1", "q2"],
    });
    expect(sectionMissingQuiz(s)).toBe(false);
  });

  it("nội dung rỗng thì KHÔNG tính vào thiếu quiz dù quiz.count>0 — thuộc nhóm 'chưa xong nội dung' riêng, không lẫn hai nhóm", () => {
    const s = section({
      key: "khoidong",
      quiz: { count: 2, level_code: "biet" },
    });
    expect(sectionMissingQuiz(s)).toBe(false);
  });
});

describe("blockingSectionGroups — tách riêng ba nhóm để LectureFlow báo đúng lý do", () => {
  it("phân loại đúng: rỗng nội dung → incomplete; có nội dung + quiz thật + chưa gắn câu → missingQuiz", () => {
    const sections = [
      section({
        key: "khoidong",
        blocks: [{ type: "text", content: "A" }],
        question_ids: ["q1"],
      }),
      section({ key: "hinhthanh" }), // rỗng nội dung
      section({
        key: "luyentap",
        slides: [{ layout: "bullets", title: "S" }],
        quiz: { count: 2, level_code: "hieu" },
      }),
      section({
        key: "vandung",
        blocks: [{ type: "text", content: "B" }],
        quiz: { count: 0 },
      }),
    ];

    const groups = blockingSectionGroups(sections, {});
    expect(groups.incomplete).toEqual(["hinhthanh"]);
    expect(groups.missingQuiz).toEqual(["luyentap"]);
    expect(groups.errored).toEqual([]);
  });

  it("lỗi treo trên hoạt động KHÔNG rơi vào incomplete/missingQuiz vẫn được liệt kê riêng ở errored", () => {
    const sections = [
      section({
        key: "khoidong",
        blocks: [{ type: "text", content: "A" }],
        quiz: { count: 0 },
      }),
    ];
    const groups = blockingSectionGroups(sections, {
      khoidong: "Lỗi mạng.",
    });
    expect(groups.incomplete).toEqual([]);
    expect(groups.missingQuiz).toEqual([]);
    expect(groups.errored).toEqual(["khoidong"]);
  });
});

describe("blockingSectionKeys", () => {
  // Ba test bắt buộc theo yêu cầu vòng sửa sau review.
  it("có nội dung + quiz:{count:0} (đã xét, không cần) — KHÔNG chặn hoàn tất", () => {
    const sections = [
      section({
        key: "khoidong",
        blocks: [{ type: "text", content: "A" }],
        quiz: { count: 0 },
      }),
    ];
    expect(blockingSectionKeys(sections, {})).toEqual([]);
  });

  it("có nội dung + quiz:{count:2} + question_ids rỗng — CHẶN, và đúng nhóm missingQuiz (không lẫn incomplete)", () => {
    const sections = [
      section({
        key: "khoidong",
        blocks: [{ type: "text", content: "A" }],
        quiz: { count: 2, level_code: "biet" },
      }),
    ];
    expect(blockingSectionKeys(sections, {})).toEqual(["khoidong"]);
    const groups = blockingSectionGroups(sections, {});
    expect(groups.missingQuiz).toEqual(["khoidong"]);
    expect(groups.incomplete).toEqual([]);
  });

  it("có nội dung + KHÔNG có khoá quiz (bài giảng cũ trước khi máy chủ lưu trường này) — KHÔNG chặn", () => {
    const sections = [
      section({ key: "khoidong", blocks: [{ type: "text", content: "A" }] }),
    ];
    expect(blockingSectionKeys(sections, {})).toEqual([]);
  });

  it("chặn hoàn tất khi còn hoạt động rỗng cả khối lẫn slide — dây chuyền đổ giữa chừng", () => {
    const sections = [
      section({
        key: "khoidong",
        blocks: [{ type: "text", content: "A" }],
        quiz: { count: 0 },
      }),
      section({ key: "hinhthanh" }), // rỗng — dây chuyền rớt mạng đúng ở đây
      section({
        key: "luyentap",
        slides: [{ layout: "bullets", title: "S" }],
        quiz: { count: 0 },
      }),
      section({
        key: "vandung",
        blocks: [{ type: "text", content: "B" }],
        quiz: { count: 0 },
      }),
    ];

    expect(blockingSectionKeys(sections, {})).toEqual(["hinhthanh"]);
  });

  it("chặn hoàn tất khi còn sectionErrors treo dù nội dung không rỗng", () => {
    const sections = [
      section({
        key: "khoidong",
        blocks: [{ type: "text", content: "A" }],
        quiz: { count: 0 },
      }),
    ];

    expect(
      blockingSectionKeys(sections, { khoidong: "Trợ lý AI đang tắt." }),
    ).toEqual(["khoidong"]);
  });

  it("không lặp khoá khi một hoạt động vừa rỗng vừa còn lỗi", () => {
    const sections = [section({ key: "hinhthanh" })];

    expect(blockingSectionKeys(sections, { hinhthanh: "Lỗi mạng." })).toEqual([
      "hinhthanh",
    ]);
  });

  it("mảng rỗng khi mọi hoạt động đủ nội dung, đã gắn quiz (hoặc không cần) và không còn lỗi — mở nút hoàn tất", () => {
    const sections = [
      section({
        key: "khoidong",
        blocks: [{ type: "text", content: "A" }],
        question_ids: ["q1"],
        quiz: { count: 1, level_code: "biet" },
      }),
      section({
        key: "hinhthanh",
        slides: [{ layout: "bullets", title: "S" }],
        quiz: { count: 0 },
      }),
    ];

    expect(blockingSectionKeys(sections, {})).toEqual([]);
  });
});
