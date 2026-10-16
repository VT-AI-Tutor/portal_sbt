import { describe, expect, it } from "vitest";
import {
  lineOf,
  sectionLabel,
  toLessonSections,
  toNavMarks,
  toQuestionLabels,
} from "./lessonSections";

const LESSON_ITEMS = [
  {
    title: "ĐỌC – Trả lời câu hỏi",
    questions: [{ id: "8844" }, { id: "8845" }],
  },
  {
    title: "ĐỌC – Luyện tập theo văn bản đọc",
    questions: [{ id: "8846" }, { id: "8847" }, { id: "8848" }],
  },
  { title: "VẬN DỤNG", questions: [{ id: "8849" }] },
];

describe("toLessonSections", () => {
  it("giữ đúng thứ tự phần kèm số câu để hub dựng mục", () => {
    const sections = toLessonSections(LESSON_ITEMS);

    expect(sections.map((s) => s.title)).toEqual([
      "ĐỌC – Trả lời câu hỏi",
      "ĐỌC – Luyện tập theo văn bản đọc",
      "VẬN DỤNG",
    ]);
    expect(sections.map((s) => s.questionIds.length)).toEqual([2, 3, 1]);
    expect(sections.map((s) => s.key)).toEqual(["0", "1", "2"]);
  });

  it("bỏ phần không tên hoặc không có câu hỏi", () => {
    const sections = toLessonSections([
      { title: null, questions: [{ id: "1" }] },
      { title: "   ", questions: [{ id: "2" }] },
      { title: "VẬN DỤNG", questions: [] },
      ...LESSON_ITEMS,
    ]);

    expect(sections.map((s) => s.title)).toEqual([
      "ĐỌC – Trả lời câu hỏi",
      "ĐỌC – Luyện tập theo văn bản đọc",
      "VẬN DỤNG",
    ]);
  });
});

describe("lineOf", () => {
  it("gộp mọi phần cùng mạch, bất kể tên phần phía sau dấu ngăn", () => {
    expect(lineOf("ĐỌC – Trả lời câu hỏi")).toBe("ĐỌC");
    expect(lineOf("ĐỌC – Luyện tập theo văn bản đọc")).toBe("ĐỌC");
    expect(lineOf("NÓI VÀ NGHE: kể chuyện")).toBe("NÓI VÀ NGHE");
  });

  it("tên mạch dạng NFD vẫn là cùng một mạch với bản dựng sẵn", () => {
    const nfd = "ĐỌC – Trả lời câu hỏi".normalize("NFD");

    expect(nfd).not.toBe("ĐỌC – Trả lời câu hỏi"); // đúng là hai chuỗi khác nhau
    expect(lineOf(nfd)).toBe("ĐỌC");
  });

  it("giữ nguyên tên mạch không có dấu ngăn, kể cả từ ghép gạch nối", () => {
    expect(lineOf("LUYỆN TỪ VÀ CÂU")).toBe("LUYỆN TỪ VÀ CÂU");
    expect(lineOf("ĐỌC-HIỂU")).toBe("ĐỌC-HIỂU");
  });

  it("khoảng số là cả một tên, không cắt đôi (SBT-68)", () => {
    // Bài ôn tập TV2–5: NXB yêu cầu tag đúng "TIẾT 1 – 2", không phải "TIẾT 1".
    expect(lineOf("Tiết 1 – 2")).toBe("TIẾT 1 – 2");
    expect(lineOf("Tiết 7 – 8")).toBe("TIẾT 7 – 8");
    expect(lineOf("Tiết 3 – 4".normalize("NFD"))).toBe("TIẾT 3 – 4");
    expect(lineOf("Tiết 5 - 6")).toBe("TIẾT 5 - 6");
  });

  it("chỉ là khoảng số khi có chữ số ở CẢ HAI bên dấu ngăn", () => {
    expect(lineOf("Tiết 1 – Đọc")).toBe("TIẾT 1");
    expect(lineOf("Tiết 1 – 2: Luyện tập")).toBe("TIẾT 1 – 2");
    expect(lineOf("Tiết 1 - 2 - Luyện tập")).toBe("TIẾT 1 - 2");
  });
});

describe("sectionLabel", () => {
  it("cắt tiền tố mạch, giữ nguyên phần chữ bản thảo muốn hiện", () => {
    expect(sectionLabel("ĐỌC – BÀI ĐỌC")).toBe("BÀI ĐỌC");
    expect(sectionLabel("ĐỌC – Luyện tập theo văn bản đọc")).toBe(
      "Luyện tập theo văn bản đọc",
    );
    expect(sectionLabel("NÓI VÀ NGHE: kể chuyện")).toBe("kể chuyện");
  });

  it("phần chỉ có tên mạch thì không có chữ nào để hiện", () => {
    expect(sectionLabel("VẬN DỤNG")).toBe("");
    expect(sectionLabel("ĐỌC-HIỂU")).toBe("");
  });

  it("chỉ cắt ở dấu ngăn ĐẦU TIÊN", () => {
    expect(sectionLabel("ĐỌC – BÀI ĐỌC – phần 2")).toBe("BÀI ĐỌC – phần 2");
  });

  it("dạng NFD cũng cắt đúng", () => {
    expect(sectionLabel("ĐỌC – BÀI ĐỌC".normalize("NFD"))).toBe("BÀI ĐỌC");
  });

  it("khoảng số không có phần nào đứng sau", () => {
    expect(sectionLabel("Tiết 1 – 2")).toBe("");
  });

  it("khoảng số có phần đứng sau thì cắt ở dấu ngăn kế tiếp", () => {
    expect(sectionLabel("Tiết 1 – 2: Luyện tập")).toBe("Luyện tập");
    expect(sectionLabel("Tiết 1 – Đọc")).toBe("Đọc");
  });
});

describe("toQuestionLabels", () => {
  it("đánh số nối tiếp trong một mạch và đếm lại từ 1 khi sang mạch khác", () => {
    const labels = toQuestionLabels(toLessonSections(LESSON_ITEMS));

    // Hai phần ĐỌC là CÙNG mạch: 8846 là bài thứ 3 của ĐỌC, không phải bài 1.
    expect(labels["8844"]).toMatchObject({ line: "ĐỌC", ordinal: 1 });
    expect(labels["8846"]).toMatchObject({ line: "ĐỌC", ordinal: 3 });
    expect(labels["8848"]).toMatchObject({ line: "ĐỌC", ordinal: 5 });
    expect(labels["8849"]).toMatchObject({ line: "VẬN DỤNG", ordinal: 1 });
  });

  it("mang theo chữ hiển thị đã bỏ tiền tố mạch và tổng số bài", () => {
    const labels = toQuestionLabels(toLessonSections(LESSON_ITEMS));

    // Tên mạch đã nằm ở bộ đếm đầu màn — chữ trên đầu câu chỉ còn phần sau.
    expect(labels["8846"].sectionLabel).toBe("Luyện tập theo văn bản đọc");
    expect(labels["8849"].sectionLabel).toBe("");
    expect(labels["8846"].lineTotal).toBe(5);
    expect(labels["8849"].lineTotal).toBe(1);
    expect(labels["9999"]).toBeUndefined();
  });

  it("bài ôn tập: mỗi tiết vẫn là một mạch riêng, đếm lại từ 1", () => {
    const labels = toQuestionLabels(
      toLessonSections([
        { title: "Tiết 1 – 2", questions: [{ id: "a1" }, { id: "a2" }] },
        { title: "Tiết 3 – 4", questions: [{ id: "b1" }] },
      ]),
    );

    expect(labels["a2"]).toMatchObject({
      line: "TIẾT 1 – 2",
      sectionLabel: "",
      ordinal: 2,
      lineTotal: 2,
    });
    expect(labels["b1"]).toMatchObject({
      line: "TIẾT 3 – 4",
      ordinal: 1,
      lineTotal: 1,
    });
  });

  it("sách không chia mạch thì không có nhãn nào — mọi chỗ lùi về đánh số cả bài", () => {
    expect(
      toQuestionLabels(
        toLessonSections([{ title: "", questions: [{ id: "1" }] }]),
      ),
    ).toEqual({});
  });
});

describe("toNavMarks", () => {
  const labels = toQuestionLabels(toLessonSections(LESSON_ITEMS));

  it("tra nhãn theo ID câu, không theo thứ tự phần", () => {
    // API bài tập có thể trả đề theo thứ tự khác lesson_items.
    const marks = toNavMarks(["8849", "8844"], labels);

    expect(marks).toEqual([
      { label: "1", group: "VẬN DỤNG" },
      { label: "1", group: "ĐỌC" },
    ]);
  });

  it("thiếu nhãn của một câu là bỏ hẳn cách đánh số theo mạch", () => {
    expect(toNavMarks(["8844", "9999"], labels)).toBeUndefined();
    expect(toNavMarks([], labels)).toBeUndefined();
  });
});
