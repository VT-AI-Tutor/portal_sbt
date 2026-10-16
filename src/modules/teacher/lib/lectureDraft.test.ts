import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  generateLectureDraft,
  generateSectionWithQuiz,
} from "@/modules/teacher/lib/lectureDraft";
import type {
  LectureQuizSpec,
  LectureSection,
  LectureSectionKey,
  TeacherLecture,
} from "@/modules/teacher/api/teacherLectureApi";

const outline = vi.hoisted(() => vi.fn());
const generateSection = vi.hoisted(() => vi.fn());
const updateSection = vi.hoisted(() => vi.fn());

vi.mock("@/modules/teacher/api/teacherLectureApi", () => ({
  teacherLectureApi: { outline, generateSection, updateSection },
}));

const pickCell = vi.hoisted(() => vi.fn());
const generateCell = vi.hoisted(() => vi.fn());

vi.mock("@/modules/teacher/api/teacherBlueprintApi", () => ({
  teacherBlueprintApi: { pickCell, generateCell },
}));

const SECTION_KEYS: LectureSectionKey[] = [
  "khoidong",
  "hinhthanh",
  "luyentap",
  "vandung",
];

function section(key: LectureSectionKey, over: Partial<LectureSection> = {}): LectureSection {
  return {
    key,
    title: `Tiêu đề ${key}`,
    objective: `Mục tiêu ${key}`,
    blocks: [],
    slides: [],
    question_ids: [],
    generated_at: null,
    edited_at: null,
    ...over,
  };
}

function lecture(over: Partial<TeacherLecture> = {}): TeacherLecture {
  return {
    id: "lec-1",
    title: "Bài giảng thử",
    subject_code: "toan",
    subject: "Toán",
    level: "6",
    content_code: "PHANSO",
    outcome_codes: [],
    status: "draft",
    class_context: null,
    sections: SECTION_KEYS.map((k) => section(k)),
    created_at: "2026-08-20T00:00:00Z",
    updated_at: "2026-08-20T00:00:00Z",
    ...over,
  };
}

function question(id: string) {
  return {
    id,
    source: "library" as const,
    question_type: "single_choice",
    question_text: `Câu ${id}`,
    options: [],
    payload: null,
    difficulty: "medium",
    cell: { content_code: "PHANSO", level_code: "biet" },
  };
}

const CTX = {
  subject: "Toán",
  subject_code: "toan",
  level: "6",
  content_code: "PHANSO",
};

beforeEach(() => {
  outline.mockReset();
  generateSection.mockReset();
  updateSection.mockReset();
  pickCell.mockReset();
  generateCell.mockReset();
});

describe("dây chuyền sinh bài giảng", () => {
  it("chạy đủ dàn khung + 4 hoạt động, progress báo đúng 0 tới 5", async () => {
    outline.mockResolvedValue({ ai_disabled: false, lecture: lecture() });
    generateSection.mockImplementation(async (_id: string, key: LectureSectionKey) => ({
      ai_disabled: false,
      quiz: null,
      lecture: lecture({ sections: SECTION_KEYS.map((k) => section(k)) }),
    }));

    const progress: { done: number; total: number; current: string }[] = [];
    const result = await generateLectureDraft("lec-1", CTX, "token", {
      onProgress: (p) => progress.push(p),
    });

    expect(outline).toHaveBeenCalledTimes(1);
    expect(generateSection).toHaveBeenCalledTimes(4);
    expect(generateSection.mock.calls.map((c) => c[1])).toEqual(SECTION_KEYS);
    expect(result.sectionErrors).toEqual({});

    expect(progress[0]).toEqual({ done: 0, total: 5, current: "Dàn khung bài giảng" });
    expect(progress.at(-1)).toEqual({ done: 5, total: 5, current: "" });
    expect(progress.map((p) => p.done)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("sinh nội dung TRƯỚC rồi mới gắn câu hỏi SAU, không gửi blocks/slides null", async () => {
    outline.mockResolvedValue({ ai_disabled: false, lecture: lecture() });
    const withQuizSections = SECTION_KEYS.map((k) =>
      k === "khoidong"
        ? section(k, { blocks: [{ type: "text", content: "Đã sinh" }] })
        : section(k),
    );
    generateSection.mockImplementation(async (_id: string, key: LectureSectionKey) => ({
      ai_disabled: false,
      quiz: key === "khoidong" ? ({ count: 2, level_code: "biet" } as LectureQuizSpec) : null,
      lecture: lecture({ sections: withQuizSections }),
    }));
    pickCell.mockResolvedValueOnce({ questions: [question("a"), question("b")], missing: 0 });
    updateSection.mockResolvedValue(lecture());

    await generateLectureDraft("lec-1", CTX, "token", {});

    // generateSection phải chạy xong trước khi updateSection được gọi cho cùng hoạt động.
    const genOrder = generateSection.mock.invocationCallOrder[0];
    const updOrder = updateSection.mock.invocationCallOrder[0];
    expect(genOrder).toBeLessThan(updOrder);

    expect(updateSection).toHaveBeenCalledTimes(1);
    const [, key, payload] = updateSection.mock.calls[0];
    expect(key).toBe("khoidong");
    expect(payload).toEqual({ question_ids: ["a", "b"] });
    expect(payload).not.toHaveProperty("blocks");
    expect(payload).not.toHaveProperty("slides");
  });

  it("một hoạt động hỏng thì các hoạt động sau vẫn chạy, lỗi ghi đúng chỗ", async () => {
    outline.mockResolvedValue({ ai_disabled: false, lecture: lecture() });
    generateSection.mockImplementation(async (_id: string, key: LectureSectionKey) => {
      if (key === "hinhthanh") throw new Error("Máy chủ từ chối");
      return { ai_disabled: false, quiz: null, lecture: lecture() };
    });

    const result = await generateLectureDraft("lec-1", CTX, "token", {});

    expect(generateSection).toHaveBeenCalledTimes(4);
    expect(generateSection.mock.calls.map((c) => c[1])).toEqual(SECTION_KEYS);
    expect(result.sectionErrors.hinhthanh).toBe("Máy chủ từ chối");
    expect(result.sectionErrors.khoidong).toBeUndefined();
    expect(result.sectionErrors.luyentap).toBeUndefined();
    expect(result.sectionErrors.vandung).toBeUndefined();
  });

  it("quiz cần 3 câu mà kho chỉ có 2 thì chỉ nhờ AI sinh đúng 1 câu còn thiếu", async () => {
    outline.mockResolvedValue({ ai_disabled: false, lecture: lecture() });
    generateSection.mockImplementation(async (_id: string, key: LectureSectionKey) => ({
      ai_disabled: false,
      quiz: key === "luyentap" ? ({ count: 3, level_code: "hieu" } as LectureQuizSpec) : null,
      lecture: lecture(),
    }));
    pickCell.mockResolvedValueOnce({ questions: [question("a"), question("b")], missing: 1 });
    generateCell.mockResolvedValueOnce({
      saved: [{ ...question("ai-1"), source: "ai" as const }],
      rejected: [],
      ai_disabled: false,
    });
    updateSection.mockResolvedValue(lecture());

    await generateLectureDraft("lec-1", CTX, "token", {});

    expect(generateCell).toHaveBeenCalledTimes(1);
    expect(generateCell.mock.calls[0][0].count).toBe(1);
    const [, key, payload] = updateSection.mock.calls[0];
    expect(key).toBe("luyentap");
    expect(payload.question_ids).toEqual(["a", "b", "ai-1"]);
  });

  it("kho đủ câu thì không gọi trợ lý AI bù", async () => {
    outline.mockResolvedValue({ ai_disabled: false, lecture: lecture() });
    generateSection.mockImplementation(async (_id: string, key: LectureSectionKey) => ({
      ai_disabled: false,
      quiz: key === "vandung" ? ({ count: 2, level_code: "vandung" } as LectureQuizSpec) : null,
      lecture: lecture(),
    }));
    pickCell.mockResolvedValueOnce({ questions: [question("a"), question("b")], missing: 0 });
    updateSection.mockResolvedValue(lecture());

    await generateLectureDraft("lec-1", CTX, "token", {});

    expect(generateCell).not.toHaveBeenCalled();
  });

  it("I2 — hai hoạt động cùng có quiz: hoạt động sau bốc kho phải loại câu hoạt động trước đã lấy", async () => {
    outline.mockResolvedValue({ ai_disabled: false, lecture: lecture() });
    generateSection.mockImplementation(async (_id: string, key: LectureSectionKey) => ({
      ai_disabled: false,
      quiz:
        key === "khoidong" || key === "luyentap"
          ? ({ count: 2, level_code: "biet" } as LectureQuizSpec)
          : null,
      lecture: lecture(),
    }));
    pickCell.mockResolvedValueOnce({ questions: [question("a"), question("b")], missing: 0 });
    pickCell.mockResolvedValueOnce({ questions: [question("c"), question("d")], missing: 0 });
    updateSection.mockResolvedValue(lecture());

    await generateLectureDraft("lec-1", CTX, "token", {});

    expect(pickCell).toHaveBeenCalledTimes(2);
    expect(pickCell.mock.calls[0][0].exclude_ids).toEqual([]);
    // hoạt động luyentap bốc SAU khoidong — phải loại đúng 2 mã câu khoidong vừa lấy.
    expect(pickCell.mock.calls[1][0].exclude_ids).toEqual(["a", "b"]);
  });

  it("ai_disabled ở lượt dàn khung dừng sớm, không gọi generateSection, 4 hoạt động đều báo lỗi", async () => {
    outline.mockResolvedValue({ ai_disabled: true, lecture: lecture() });

    const result = await generateLectureDraft("lec-1", CTX, "token", {});

    expect(generateSection).not.toHaveBeenCalled();
    for (const key of SECTION_KEYS) {
      expect(result.sectionErrors[key]).toBe("Trợ lý AI đang tắt.");
    }
  });

  it("ai_disabled ở lượt sinh hoạt động dừng sớm, hoạt động sau không chạy", async () => {
    outline.mockResolvedValue({ ai_disabled: false, lecture: lecture() });
    generateSection.mockImplementation(async (_id: string, key: LectureSectionKey) => {
      if (key === "hinhthanh") return { ai_disabled: true, quiz: null, lecture: lecture() };
      return { ai_disabled: false, quiz: null, lecture: lecture() };
    });

    const result = await generateLectureDraft("lec-1", CTX, "token", {});

    expect(generateSection).toHaveBeenCalledTimes(2);
    expect(result.sectionErrors.hinhthanh).toBe("Trợ lý AI đang tắt.");
    expect(result.sectionErrors.luyentap).toBe("Trợ lý AI đang tắt.");
    expect(result.sectionErrors.vandung).toBe("Trợ lý AI đang tắt.");
    expect(result.sectionErrors.khoidong).toBeUndefined();
  });

  it("ai_disabled lúc nhờ AI bù quiz dừng sớm các hoạt động còn lại", async () => {
    outline.mockResolvedValue({ ai_disabled: false, lecture: lecture() });
    generateSection.mockImplementation(async (_id: string, key: LectureSectionKey) => ({
      ai_disabled: false,
      quiz: key === "khoidong" ? ({ count: 2, level_code: "biet" } as LectureQuizSpec) : null,
      lecture: lecture(),
    }));
    pickCell.mockResolvedValueOnce({ questions: [question("a")], missing: 1 });
    generateCell.mockResolvedValueOnce({ saved: [], rejected: [], ai_disabled: true });

    const result = await generateLectureDraft("lec-1", CTX, "token", {});

    expect(generateSection).toHaveBeenCalledTimes(1);
    expect(updateSection).not.toHaveBeenCalled();
    expect(result.sectionErrors.khoidong).toBe("Trợ lý AI đang tắt.");
    expect(result.sectionErrors.hinhthanh).toBe("Trợ lý AI đang tắt.");
    expect(result.sectionErrors.luyentap).toBe("Trợ lý AI đang tắt.");
    expect(result.sectionErrors.vandung).toBe("Trợ lý AI đang tắt.");
  });

  it("dùng đúng bản lecture mới nhất máy chủ trả về, không dựng lại từ trí nhớ", async () => {
    const freshAfterOutline = lecture({ title: "Sau dàn khung" });
    const freshAfterSection = lecture({ title: "Sau hoạt động cuối" });
    outline.mockResolvedValue({ ai_disabled: false, lecture: freshAfterOutline });
    generateSection.mockImplementation(async (_id: string, key: LectureSectionKey) => ({
      ai_disabled: false,
      quiz: null,
      lecture: key === "vandung" ? freshAfterSection : lecture(),
    }));

    const result = await generateLectureDraft("lec-1", CTX, "token", {});

    expect(result.lecture).toBe(freshAfterSection);
  });

  it("gọi onLectureUpdate mỗi khi có bản lecture mới", async () => {
    outline.mockResolvedValue({ ai_disabled: false, lecture: lecture() });
    generateSection.mockImplementation(async () => ({
      ai_disabled: false,
      quiz: null,
      lecture: lecture(),
    }));

    const updates: TeacherLecture[] = [];
    await generateLectureDraft("lec-1", CTX, "token", {
      onLectureUpdate: (l) => updates.push(l),
    });

    // 1 lần cho outline + 4 lần cho 4 hoạt động (quiz null nên không có updateSection).
    expect(updates.length).toBe(5);
  });
});

describe("generateSectionWithQuiz — bước MỘT hoạt động dùng lại cho cả dây chuyền và bốc bù quiz khi Tiếp tục soạn", () => {
  it("sinh nội dung rồi bốc/gắn quiz, updateSection CHỈ nhận question_ids — không kèm blocks/slides", async () => {
    generateSection.mockResolvedValueOnce({
      ai_disabled: false,
      quiz: { count: 2, level_code: "biet" } as LectureQuizSpec,
      lecture: lecture({
        sections: SECTION_KEYS.map((k) =>
          k === "khoidong"
            ? section(k, { blocks: [{ type: "text", content: "Đã sinh" }] })
            : section(k),
        ),
      }),
    });
    pickCell.mockResolvedValueOnce({
      questions: [question("a"), question("b")],
      missing: 0,
    });
    updateSection.mockResolvedValueOnce(lecture());

    const used = new Set<string>();
    const result = await generateSectionWithQuiz(
      "lec-1",
      "khoidong",
      CTX,
      "token",
      used,
    );

    expect(result.aiDisabled).toBe(false);
    expect(updateSection).toHaveBeenCalledTimes(1);
    const [id, key, payload] = updateSection.mock.calls[0];
    expect(id).toBe("lec-1");
    expect(key).toBe("khoidong");
    expect(payload).toEqual({ question_ids: ["a", "b"] });
    expect(payload).not.toHaveProperty("blocks");
    expect(payload).not.toHaveProperty("slides");
    // Set chống trùng câu được cập nhật cho nơi gọi tái sử dụng.
    expect([...used]).toEqual(["a", "b"]);
  });

  it("used truyền vào SẴN mã câu của hoạt động khác thì loại đúng những mã đó khi bốc kho", async () => {
    generateSection.mockResolvedValueOnce({
      ai_disabled: false,
      quiz: { count: 2, level_code: "biet" } as LectureQuizSpec,
      lecture: lecture(),
    });
    pickCell.mockResolvedValueOnce({
      questions: [question("c"), question("d")],
      missing: 0,
    });
    updateSection.mockResolvedValueOnce(lecture());

    const used = new Set<string>(["a", "b"]);
    await generateSectionWithQuiz("lec-1", "luyentap", CTX, "token", used);

    expect(pickCell.mock.calls[0][0].exclude_ids).toEqual(["a", "b"]);
  });

  it("generateSection báo ai_disabled thì dừng ngay, không bốc quiz", async () => {
    generateSection.mockResolvedValueOnce({
      ai_disabled: true,
      quiz: null,
      lecture: lecture(),
    });

    const result = await generateSectionWithQuiz(
      "lec-1",
      "khoidong",
      CTX,
      "token",
      new Set(),
    );

    expect(result.aiDisabled).toBe(true);
    expect(pickCell).not.toHaveBeenCalled();
    expect(updateSection).not.toHaveBeenCalled();
  });

  it("quiz null (hoạt động không cần quiz) thì chỉ trả nội dung, không gọi updateSection", async () => {
    generateSection.mockResolvedValueOnce({
      ai_disabled: false,
      quiz: null,
      lecture: lecture(),
    });

    const result = await generateSectionWithQuiz(
      "lec-1",
      "khoidong",
      CTX,
      "token",
      new Set(),
    );

    expect(result.aiDisabled).toBe(false);
    expect(updateSection).not.toHaveBeenCalled();
  });

  it("kho thiếu câu, AI bù cũng báo ai_disabled thì trả aiDisabled=true, không gọi updateSection", async () => {
    generateSection.mockResolvedValueOnce({
      ai_disabled: false,
      quiz: { count: 2, level_code: "biet" } as LectureQuizSpec,
      lecture: lecture(),
    });
    pickCell.mockResolvedValueOnce({ questions: [question("a")], missing: 1 });
    generateCell.mockResolvedValueOnce({ saved: [], rejected: [], ai_disabled: true });

    const result = await generateSectionWithQuiz(
      "lec-1",
      "khoidong",
      CTX,
      "token",
      new Set(),
    );

    expect(result.aiDisabled).toBe(true);
    expect(updateSection).not.toHaveBeenCalled();
  });
});
