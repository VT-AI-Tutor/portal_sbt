/**
 * Chuẩn hoá biên cho `getCompetencySubject`.
 *
 * `components` là trường do một nhánh BACKEND KHÁC thêm; API đang chạy chưa
 * trả nó. Trường mới của BE về sau cũng phải đi đường này: khai optional ở kiểu
 * wire, chuẩn hoá MỘT lần ở fetcher — để UI không phải rải `?.` và không nổ khi
 * API chạy sau frontend một nhịp deploy.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { getCompetencySubject } from "./practiceApi";

const mock = (body: unknown, ok = true) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce({ ok, json: async () => body } as Response);

const BASE_DETAIL = {
  subject_code: "toan",
  subject_name: "Toán",
  target_percent: 80,
  framework: { key: "bloom", levels: [] },
  cognitive_levels: [],
  topics: [],
  ai_analysis: {
    text: "",
    source: "template",
    generated_at: "2026-08-07T00:00:00Z",
    upsell: false,
  },
  suggestions: [],
};

afterEach(() => vi.restoreAllMocks());

describe("getCompetencySubject — chuẩn hoá components", () => {
  it("BE chưa có trường components -> trả mảng rỗng, không undefined", async () => {
    mock({ success: true, data: BASE_DETAIL });
    const detail = await getCompetencySubject("toan");
    expect(Array.isArray(detail.components)).toBe(true);
    expect(detail.components).toEqual([]);
  });

  it("BE có components -> giữ nguyên, không nuốt dữ liệu", async () => {
    const components = [
      {
        code: "tu-duy",
        label: "Tư duy và lập luận",
        attempted: 12,
        correct: 9,
        percent: 75,
        question_available: 40,
      },
    ];
    mock({ success: true, data: { ...BASE_DETAIL, components } });
    const detail = await getCompetencySubject("toan");
    expect(detail.components).toEqual(components);
  });

  it("components null (BE trả null thay vì bỏ trường) -> vẫn là mảng rỗng", async () => {
    mock({ success: true, data: { ...BASE_DETAIL, components: null } });
    const detail = await getCompetencySubject("toan");
    expect(detail.components).toEqual([]);
  });
});
