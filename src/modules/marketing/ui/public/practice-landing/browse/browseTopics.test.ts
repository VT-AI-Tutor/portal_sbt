import { describe, expect, it } from "vitest";

import type { PracticeTopicItem } from "@/modules/catalog/api/types";
import {
  filterBrowseTopics,
  subjectCodesForLevel,
  toBrowseTopics,
} from "./browseTopics";

function topic(over: Partial<PracticeTopicItem> = {}): PracticeTopicItem {
  return {
    level: "1",
    subject_code: "toan",
    subject_name: "Toán",
    content_code: "T1_SO",
    label: "Số học",
    question_available: 20,
    ...over,
  };
}

describe("toBrowseTopics", () => {
  it("sắp lớp theo số, không theo chữ", () => {
    const out = toBrowseTopics([
      topic({ level: "10", content_code: "A" }),
      topic({ level: "2", content_code: "B" }),
    ]);
    expect(out.map((t) => t.level)).toEqual(["2", "10"]);
  });

  it("cùng lớp thì sắp theo môn rồi tên chủ đề", () => {
    const out = toBrowseTopics([
      topic({ content_code: "B", label: "Zêta" }),
      topic({ content_code: "A", label: "Alpha" }),
      topic({
        content_code: "C",
        subject_code: "tieng-viet",
        subject_name: "Tiếng Việt",
        label: "Âm vần",
      }),
    ]);
    // "Tiếng Việt" < "Toán" theo collation vi (Ti < To) nên khối môn đó lên trước.
    expect(out.map((t) => t.label)).toEqual(["Âm vần", "Alpha", "Zêta"]);
  });

  it("khoá gồm cả lớp/môn/chủ đề nên chủ đề trùng mã ở lớp khác không đụng nhau", () => {
    const out = toBrowseTopics([
      topic({ level: "1", content_code: "HINH_HOC" }),
      topic({ level: "2", content_code: "HINH_HOC" }),
    ]);
    expect(new Set(out.map((t) => t.key)).size).toBe(2);
  });

  it("giữ số câu khả dụng và suy màu bìa từ tông của môn", () => {
    const [out] = toBrowseTopics([topic({ question_available: 7 })]);
    expect(out.questionAvailable).toBe(7);
    expect(out.gradient).toBe("from-primary via-primary to-info");
    expect(out.pattern).toBe("grid");
  });

  it("mã môn lạ vẫn ra bìa hợp lệ, nhãn lấy theo tên từ API", () => {
    const [out] = toBrowseTopics([
      topic({ subject_code: "mon-la", subject_name: "Môn lạ" }),
    ]);
    expect(out.subjectLabel).toBe("Môn lạ");
    expect(out.gradient).toBe("from-primary via-primary to-info");
  });
});

describe("filterBrowseTopics", () => {
  const topics = toBrowseTopics([
    topic({ level: "1", subject_code: "toan", content_code: "A" }),
    topic({ level: "2", subject_code: "toan", content_code: "B" }),
    topic({
      level: "1",
      subject_code: "tieng-viet",
      subject_name: "Tiếng Việt",
      content_code: "C",
    }),
  ]);

  it('"all" + null cho qua hết', () => {
    expect(filterBrowseTopics(topics, "all", null)).toHaveLength(3);
  });

  it("lọc theo lớp", () => {
    expect(filterBrowseTopics(topics, "2", null).map((t) => t.level)).toEqual([
      "2",
    ]);
  });

  it("lọc theo môn", () => {
    expect(
      filterBrowseTopics(topics, "all", "tieng-viet").map((t) => t.subjectCode),
    ).toEqual(["tieng-viet"]);
  });

  it("lọc đồng thời hai chiều", () => {
    expect(filterBrowseTopics(topics, "1", "toan")).toHaveLength(1);
    expect(filterBrowseTopics(topics, "2", "tieng-viet")).toHaveLength(0);
  });
});

describe("subjectCodesForLevel", () => {
  const topics = toBrowseTopics([
    topic({ level: "1", subject_code: "toan", content_code: "A" }),
    topic({
      level: "1",
      subject_code: "tieng-viet",
      subject_name: "Tiếng Việt",
      content_code: "B",
    }),
    topic({ level: "2", subject_code: "toan", content_code: "C" }),
  ]);

  it("chỉ trả môn có bài ở khối đó", () => {
    expect([...subjectCodesForLevel(topics, "2")]).toEqual(["toan"]);
  });

  it('"all" gom môn của mọi khối', () => {
    expect([...subjectCodesForLevel(topics, "all")].sort()).toEqual([
      "tieng-viet",
      "toan",
    ]);
  });

  it("khối không có bài nào thì rỗng", () => {
    expect(subjectCodesForLevel(topics, "12").size).toBe(0);
  });

  it("không phụ thuộc môn đang chọn — vẫn trả đủ môn của khối", () => {
    // Nếu hàm lỡ lọc theo cả môn đang chọn thì sidebar chỉ còn đúng một dòng.
    expect(subjectCodesForLevel(topics, "1").size).toBe(2);
  });
});
