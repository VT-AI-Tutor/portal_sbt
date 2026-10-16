/**
 * mapBackendQuestion must resolve question_type via the payload.type fallback:
 * some endpoints omit the top-level `type` while the v2 schema in `payload`
 * still declares it.
 */
import { describe, expect, it } from "vitest";
import { mapBackendQuestion } from "./mapBackendQuestion";
import type { StudentQuestion } from "@/modules/books/api/assessmentApi";

describe("mapBackendQuestion", () => {
  it("keeps the explicit top-level type when present", () => {
    const q = {
      id: "1",
      type: "single_choice",
      content: "",
      options: [],
      payload: { type: "matching" },
    } as StudentQuestion;
    expect(mapBackendQuestion(q).question_type).toBe("single_choice");
  });

  it("câu của giáo viên: payload rút gọn KHÔNG được nuốt đề bài và phương án", () => {
    // Hình dạng thật do khu Giáo viên sinh ra: payload chỉ có mảng chuỗi +
    // answer. Tin payload này thì player hiện đề trống và bốn nút A–D rỗng.
    const q = {
      id: "q1",
      type: "single_choice",
      content: "Số 45 678 có chữ số hàng nghìn là chữ số nào?",
      options: [
        { id: "0", content: "5" },
        { id: "1", content: "4" },
      ],
      payload: { options: ["5", "4"], answer: "5" },
    } as unknown as StudentQuestion;

    const out = mapBackendQuestion(q);
    const payload = out.payload as Record<string, unknown>;

    expect(JSON.stringify(payload.content)).toContain("hàng nghìn");
    expect(payload.options).toEqual([
      { id: "0", content: { blocks: [{ type: "paragraph", text: "5" }] } },
      { id: "1", content: { blocks: [{ type: "paragraph", text: "4" }] } },
    ]);
    // `answer` của payload rút gọn vẫn được giữ làm đáp án tự chấm.
    expect(payload.correctAnswer).toBe("5");
  });

  it("payload đầy đủ (Book module) vẫn được dùng thẳng, không bị dựng lại", () => {
    const rich = {
      content: { blocks: [{ type: "paragraph", text: "đề rich" }] },
      options: [{ id: "a", content: { blocks: [] } }],
      correctAnswer: "a",
    };
    const q = {
      id: "q2",
      type: "single_choice",
      content: "text phẳng KHÔNG được lấn át bản rich",
      options: [{ id: "a", content: "x" }],
      payload: rich,
    } as unknown as StudentQuestion;

    expect(mapBackendQuestion(q).payload).toMatchObject(rich);
  });

  it("nhóm câu không có `content` vẫn giữ nguyên payload, không mất câu con", () => {
    // Hình dạng thật (LCMS student-portal): đề ở sharedContent, câu con ở
    // children, không có khoá `content`. Dựng lại từ text phẳng thì nhóm rỗng.
    const group = {
      id: "b1_q6",
      type: "question_group",
      display: { layout: "list" },
      children: [
        {
          id: "b1_q6_r1",
          type: "hotspot",
          display: { interactionType: "multiple" },
          image: { url: "https://cdn.example/hang-1.png", altText: "Hàng 1" },
          hotspots: [{ id: "f1", shape: "rect", x: 0.2, y: 0, width: 0.15, height: 0.9 }],
          correctAnswer: { count: 2 },
        },
      ],
      sharedContent: {
        blocks: [
          {
            type: "paragraph",
            content: [{ text: "Chọn số bông hoa ở mỗi hàng theo số cho trước.", annotations: {} }],
          },
        ],
      },
      stem: "Tô màu số bông hoa ở mỗi hàng theo số cho trước.",
    };
    const q = {
      id: "101742",
      type: "question_group",
      content: "Tô màu số bông hoa ở mỗi hàng theo số cho trước.",
      options: [],
      payload: group,
    } as unknown as StudentQuestion;

    const out = mapBackendQuestion(q);
    expect(out.question_type).toBe("question_group");
    expect(out.payload).toMatchObject({
      children: group.children,
      sharedContent: group.sharedContent,
    });
  });

  it("nhóm câu để câu con ở `subQuestions` cũng giữ nguyên payload", () => {
    const subQuestions = [{ id: "c1", type: "single_choice", options: [] }];
    const q = {
      id: "g2",
      type: "question_group",
      content: "Đề phẳng",
      options: [],
      payload: { type: "question_group", subQuestions },
    } as unknown as StudentQuestion;

    expect(mapBackendQuestion(q).payload).toMatchObject({ subQuestions });
  });

  it("chỉ có `stem` (không content, không câu con) vẫn dựng lại từ text phẳng", () => {
    // `stem` có ở mọi payload LCMS nên không đủ làm bằng chứng payload chở đề:
    // dùng thẳng thì player đọc đề từ `payload.content` vắng mặt → đề trống.
    const q = {
      id: "s1",
      type: "single_choice",
      content: "Đề từ API",
      options: [{ id: "a", content: "1" }],
      payload: { type: "single_choice", stem: "Đề từ API" },
    } as unknown as StudentQuestion;

    const payload = mapBackendQuestion(q).payload as Record<string, unknown>;
    expect(JSON.stringify(payload.content)).toContain("Đề từ API");
    expect(payload.options).toEqual([
      { id: "a", content: { blocks: [{ type: "paragraph", text: "1" }] } },
    ]);
  });

  it("falls back to payload.type when the wire omits the top-level type", () => {
    const q = {
      id: "1989",
      content: "Viết tên bộ phận của thực vật…",
      options: [],
      payload: { type: "matching", leftItems: [], rightItems: [] },
    } as unknown as StudentQuestion;
    expect(mapBackendQuestion(q).question_type).toBe("matching");
  });
});
