/**
 * Regression tests for the LCMS adapter against the LIVE API's wire quirks:
 * ids come back as strings (spec says long), and subjectId exceeds
 * Number.MAX_SAFE_INTEGER — matching must happen on string keys and `level`
 * must still land as a string or the UI's strict-equality filters drop
 * every book.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { lcmsGetBook, lcmsGetBookLesson, lcmsListBooks } from "@/core/api/lcmsAdapter";

const envelope = (data: unknown, total: number | null = null) => ({
  success: true,
  message: null,
  data,
  total,
});

// String ids exactly as the live API serializes them.
const GRADES = [
  { id: "1", code: "lop-1", name: "Lớp 1", level: "1" },
  { id: "4", code: "lop-4", name: "Lớp 4", level: "4" },
];
const SUBJECTS = [
  { id: "10256693714406400", code: "am-nhac", name: "Âm nhạc", coverUrl: null },
  { id: "10256683754114048", code: "tieng-viet", name: "Tiếng Việt", coverUrl: null },
];
const BOOKS = [
  {
    id: "50",
    gradeId: "4",
    subjectId: "10256693714406400",
    bookNumber: 0,
    name: "Vở bài tập Âm nhạc 4",
    author: "ĐẶNG KHÁNH NHẬT (Chủ biên) - TRẦN NGỌC TÚ",
    coverUrl: null,
  },
  {
    id: "1",
    gradeId: "1",
    subjectId: "10256683754114048",
    bookNumber: 1,
    name: "Vở Tập viết 1 - Tập một",
    author: "TRẦN MINH HƯƠNG (Chủ biên)",
    coverUrl: null,
  },
];
const BOOK_DETAIL_50 = {
  id: "50",
  gradeId: "4",
  subjectId: "10256693714406400",
  tap: "1",
  name: "Vở bài tập Âm nhạc 4",
  bookType: "standard",
  author: "ĐẶNG KHÁNH NHẬT (Chủ biên) - TRẦN NGỌC TÚ",
  coverUrl: null,
  coverMediaId: "12345",
  // The live API nests the exercise list under `lessons` (not the spec's
  // `excercise`) and omits pdf fields on the book-detail view.
  chapters: [
    {
      id: "5001",
      code: "chu-de-1",
      name: "Chủ đề 1",
      priority: "1",
      lessons: [
        { id: "50001", name: "Bài 1", index: "1", startPage: 3 },
        { id: "50002", name: "Bài 2", index: "2", startPage: 5 },
      ],
    },
  ],
};

// Exercise-detail: the live envelope {book, chapters:[chapter], lesson} where
// lesson_items is an OBJECT carrying questions whose schema is a JSON string.
// The `lesson` node mirrors chapter values (id/index), so identity must come
// from lesson_items.
const EXERCISE_DETAIL_50002 = {
  book: {
    id: "50",
    gradeId: "4",
    subjectId: "10256693714406400",
    tap: 1,
    name: "Vở bài tập Âm nhạc 4",
    bookType: "standard",
    author: "ĐẶNG KHÁNH NHẬT (Chủ biên) - TRẦN NGỌC TÚ",
    coverUrl: null,
    coverMediaId: "12345",
  },
  chapters: [{ code: "chu-de-1", name: "Chủ đề 1", id: "5001", priority: 1 }],
  lesson: {
    name: "",
    index: "chu-de-1", // mirrors chapter — must be ignored
    id: "5001", // mirrors chapter — must be ignored
    page: 5,
    pdf_key: "https://media/lesson.pdf?sig=abc",
    pdf_answer: "https://media/answer.pdf?sig=def",
    lesson_items: {
      name: "Bài 2",
      index: "2",
      id: "50002",
      lesson_id: "50002",
      questions: [
        {
          id: "5000201",
          content: "Chọn quả táo có tiếng chứa b.",
          points: 0,
          order: 0,
          options: '[{"label":"ba","text":"","is_correct":true}]',
          schema_payload: JSON.stringify({
            type: "multiple_choice",
            content: { blocks: [{ type: "paragraph", text: "Chọn quả táo có tiếng chứa b." }] },
            options: [{ id: "ba", content: { blocks: [] } }],
            correctAnswer: ["ba"],
          }),
        },
      ],
    },
  },
};

// Live-API variant of the exercise-detail envelope: the question schema comes
// as a parsed `payload` OBJECT (no `schema_payload` string) and `options` is a
// parsed array.
const EXERCISE_DETAIL_50003 = {
  book: EXERCISE_DETAIL_50002.book,
  chapters: EXERCISE_DETAIL_50002.chapters,
  lesson: {
    name: "",
    index: "chu-de-1",
    id: "5001",
    page: 7,
    pdf_key: null,
    pdf_answer: null,
    lesson_items: {
      name: "Bài 3",
      index: "3",
      id: "50003",
      lesson_id: "50003",
      questions: [
        {
          id: "1989",
          content: "Viết tên bộ phận của thực vật.",
          points: 1,
          order: 0,
          options: [],
          payload: {
            id: "b14_q1",
            type: "matching",
            version: 2,
            content: { blocks: [{ type: "paragraph", text: "Viết tên bộ phận của thực vật." }] },
            leftItems: [{ id: "L1", content: { blocks: [] } }],
            rightItems: [{ id: "Ra", content: { blocks: [] } }],
            correctAnswer: { L1: "Ra" },
          },
        },
      ],
    },
  },
};

// Envelope MỚI: lesson_items là MẢNG các phần của bài, mỗi phần chỉ có `title`
// (không `name`, không `id`) — danh tính bài học nằm ở node `lesson`.
const EXERCISE_DETAIL_50004 = {
  book: EXERCISE_DETAIL_50002.book,
  chapters: EXERCISE_DETAIL_50002.chapters,
  lesson: {
    name: "Bài 4",
    index: "4",
    id: "50004",
    page: 9,
    pdf_key: null,
    pdf_answer: null,
    lesson_items: [
      {
        index: "1",
        title: "ĐỌC – Trả lời câu hỏi",
        lesson_id: "50004",
        questions: [
          {
            id: "8844",
            content: "Khoanh vào chữ cái trước những chi tiết đúng.",
            points: 1,
            order: 0,
            options: [{ label: "A", text: "Vùng dậy", is_correct: true }],
            payload: { id: "b1_i1_q1", type: "multiple_choice", correctAnswer: ["A"] },
          },
        ],
      },
      {
        index: "1",
        title: "ĐỌC – Luyện tập theo văn bản đọc",
        lesson_id: "50004",
        questions: [
          {
            id: "8846",
            content: "Ghi lại từ ngữ trong bài đọc.",
            points: 1,
            order: 0,
            options: [],
            payload: { id: "b1_i2_q1", type: "fill_blank", correctAnswer: { blank_1: ["rụt rè"] } },
          },
        ],
      },
    ],
  },
};

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = String(url).includes("/grade/")
        ? envelope(GRADES, GRADES.length)
        : String(url).includes("/subject/")
          ? envelope(SUBJECTS, SUBJECTS.length)
          : String(url).includes("/book/public/detail/50")
            ? envelope(BOOK_DETAIL_50, 1)
            : String(url).includes("/book-excercise/public/detail/50002")
              ? envelope(EXERCISE_DETAIL_50002, 1)
              : String(url).includes("/book-excercise/public/detail/50003")
                ? envelope(EXERCISE_DETAIL_50003, 1)
              : String(url).includes("/book-excercise/public/detail/50004")
                ? envelope(EXERCISE_DETAIL_50004, 1)
              : String(url).includes("/book/public/list-for-select")
                ? envelope(BOOKS, BOOKS.length)
                : { success: false, message: "not-found", data: null, total: null };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("lcmsAdapter with string-id wire format", () => {
  it("maps level to a STRING via string-keyed lookups and resolves subject codes", async () => {
    stubFetch();
    const items = await lcmsListBooks();
    const amNhac = items.find((b) => b.title === "Vở bài tập Âm nhạc 4")!;
    expect(amNhac.level).toBe("4"); // string — UI filters use strict equality
    expect(amNhac.id).toBe("50"); // ids are STRINGS across the catalog contract
    expect(amNhac.subject_code).toBe("am-nhac");
    expect(amNhac.subject_name).toBe("Âm nhạc");
  });

  it("số tập của danh sách lấy từ bookNumber, 0 = sách không chia tập", async () => {
    stubFetch();
    const items = await lcmsListBooks();
    expect(items.find((b) => b.id === "1")!.tap).toBe(1);
    expect(items.find((b) => b.id === "50")!.tap).toBeNull();
  });

  it("client-side level filter matches string params against string gradeIds", async () => {
    stubFetch();
    const items = await lcmsListBooks({ level: "4" });
    expect(items.map((b) => b.title)).toEqual(["Vở bài tập Âm nhạc 4"]);
  });

  it("book detail reads the live `lessons` chapter key and coerces numerics", async () => {
    stubFetch();
    const book = await lcmsGetBook("50");
    expect(book.tap).toBe(1);
    expect(book.chapters[0].id).toBe("5001");
    expect(book.chapters[0].index).toBe(1);
    expect(book.chapters[0].lessons.map((l) => l.id)).toEqual(["50001", "50002"]);
    expect(book.chapters[0].lessons[0]).toMatchObject({ id: "50001", index: 1, page: 3 });
  });

  it("lesson detail derives identity from lesson_items and maps presigned pdf urls", async () => {
    stubFetch();
    const detail = await lcmsGetBookLesson("50", "50002");
    // Identity comes from lesson_items, not the chapter-mirroring `lesson` node.
    expect(detail.lesson.id).toBe("50002");
    expect(detail.lesson.title).toBe("Bài 2");
    expect(detail.lesson.index).toBe(2);
    expect(detail.lesson.pdf_url).toBe("https://media/lesson.pdf?sig=abc");
    expect(detail.lesson.pdf_answer_url).toBe("https://media/answer.pdf?sig=def");
    expect(detail.chapter.title).toBe("Chủ đề 1");
    expect(detail.book.subject_code).toBe("am-nhac");
  });

  it("parses each question's schema_payload string into type + payload for the players", async () => {
    stubFetch();
    const detail = await lcmsGetBookLesson("50", "50002");
    const items = detail.lesson.lesson_items!;
    expect(items).toHaveLength(1);
    // Envelope cũ không có tên phần: `name` là tên BÀI, không được dựng thành
    // tiêu đề phần (sẽ lặp lại tên bài trên đầu mọi câu hỏi).
    expect(items[0].title).toBe("");
    const q = items[0].questions[0];
    expect(q.type).toBe("multiple_choice"); // from schema_payload.type
    expect(q.payload).toMatchObject({ correctAnswer: ["ba"] });
    expect((q.payload as { content?: unknown }).content).toBeTruthy();
  });

  it("giữ mọi phần của envelope mới, mỗi phần mang tiêu đề lesson_item", async () => {
    stubFetch();
    const detail = await lcmsGetBookLesson("50", "50004");
    const items = detail.lesson.lesson_items!;
    expect(items.map((it) => it.title)).toEqual([
      "ĐỌC – Trả lời câu hỏi",
      "ĐỌC – Luyện tập theo văn bản đọc",
    ]);
    // Không có `id` riêng cho từng phần: khoá phải ổn định và khác nhau.
    expect(items.map((it) => it.id)).toEqual(["50004-0", "50004-1"]);
    expect(items.map((it) => it.order)).toEqual([0, 1]);
    expect(items.flatMap((it) => it.questions).map((q) => q.type)).toEqual([
      "multiple_choice",
      "fill_blank",
    ]);
  });

  it("envelope mới: danh tính bài học lấy ở node lesson, không phải tiêu đề phần", async () => {
    stubFetch();
    const detail = await lcmsGetBookLesson("50", "50004");
    expect(detail.lesson.id).toBe("50004");
    expect(detail.lesson.title).toBe("Bài 4");
    expect(detail.lesson.index).toBe(4);
  });

  it("id bài ở chi tiết TRÙNG id trong mục lục sách", async () => {
    stubFetch();
    // Màn bài học tra số "Bài N" của mục lục bằng chính id này. Envelope cũ để
    // node `lesson` chở id của CHƯƠNG, danh tính thật nằm ở `lesson_items` —
    // lấy nhầm là hub lặng lẽ mất số thay vì báo lỗi.
    const book = await lcmsGetBook("50");
    const catalogIds = book.chapters.flatMap((ch) => ch.lessons.map((l) => l.id));
    const detail = await lcmsGetBookLesson("50", "50002");
    expect(catalogIds).toContain(detail.lesson.id);
  });

  it("reads the renamed `payload` object (and array options) the live API now sends", async () => {
    // The live public exercise-detail now returns the schema as a parsed
    // `payload` OBJECT (not the spec's `schema_payload` JSON string) and
    // `options` as a parsed array. Without tolerating both, guest (logged-out)
    // rendering degraded to type "" → "Loại câu hỏi chưa được hỗ trợ".
    stubFetch();
    const detail = await lcmsGetBookLesson("50", "50003");
    const q = detail.lesson.lesson_items![0].questions[0];
    expect(q.type).toBe("matching");
    expect(q.payload).toMatchObject({
      type: "matching",
      correctAnswer: { L1: "Ra" },
    });
  });
});
