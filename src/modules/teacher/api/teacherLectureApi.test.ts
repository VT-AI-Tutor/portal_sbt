import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teacherLectureApi } from "@/modules/teacher/api/teacherLectureApi";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("teacherLectureApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("list GET tới /api/v1/teacher/lectures với Authorization", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: [{ id: "l1", title: "Phân số" }] }),
    );
    const rows = await teacherLectureApi.list("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/lectures");
    expect(init?.headers?.["Authorization"]).toBe("Bearer tok");
    expect(rows).toEqual([{ id: "l1", title: "Phân số" }]);
  });

  it("create POST tới /api/v1/teacher/lectures với body đúng, trả 201", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { id: "l1" } }, true, 201),
    );
    await teacherLectureApi.create(
      {
        title: "Phân số bằng nhau",
        subject_code: "TOAN",
        subject: "Toán",
        level: "6",
        content_code: "PHANSO",
        class_context: { class_id: "lop-1", session_id: "tiet-1" },
      },
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/lectures");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      title: "Phân số bằng nhau",
      subject_code: "TOAN",
      subject: "Toán",
      level: "6",
      content_code: "PHANSO",
      class_context: { class_id: "lop-1", session_id: "tiet-1" },
    });
  });

  it("show GET tới /api/v1/teacher/lectures/{id}", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { id: "l1" } }),
    );
    await teacherLectureApi.show("l1", "tok");
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/lectures/l1");
  });

  it("outline POST tới /{id}/outline, trả {ai_disabled, lecture}", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { ai_disabled: false, lecture: { id: "l1" } },
      }),
    );
    const result = await teacherLectureApi.outline("l1", "tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/lectures/l1/outline");
    expect(init.method).toBe("POST");
    expect(result.ai_disabled).toBe(false);
    expect(result.lecture).toEqual({ id: "l1" });
  });

  it("generateSection POST tới /{id}/sections/{key}/generate, trả {ai_disabled, quiz, lecture}", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          ai_disabled: false,
          quiz: { count: 2, level_code: "biet" },
          lecture: { id: "l1" },
        },
      }),
    );
    const result = await teacherLectureApi.generateSection(
      "l1",
      "hinhthanh",
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "/api/v1/teacher/lectures/l1/sections/hinhthanh/generate",
    );
    expect(init.method).toBe("POST");
    expect(result.quiz).toEqual({ count: 2, level_code: "biet" });
    expect(result.lecture).toEqual({ id: "l1" });
  });

  it("updateSection PUT tới /{id}/sections/{key} với body đầy đủ", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { id: "l1" } }),
    );
    await teacherLectureApi.updateSection(
      "l1",
      "hinhthanh",
      {
        blocks: [{ type: "text", content: "Nội dung." }],
        slides: [{ layout: "title", title: "Slide" }],
        question_ids: [],
      },
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "/api/v1/teacher/lectures/l1/sections/hinhthanh",
    );
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      blocks: [{ type: "text", content: "Nội dung." }],
      slides: [{ layout: "title", title: "Slide" }],
      question_ids: [],
    });
  });

  it("updateSection chỉ gửi question_ids khi đó là khoá muốn đổi duy nhất — KHÔNG có blocks/slides trong thân yêu cầu", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { id: "l1" } }),
    );
    await teacherLectureApi.updateSection(
      "l1",
      "luyentap",
      { question_ids: ["q1", "q2"] },
      "tok",
    );
    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init.body);
    expect(sentBody).toEqual({ question_ids: ["q1", "q2"] });
    expect(sentBody).not.toHaveProperty("blocks");
    expect(sentBody).not.toHaveProperty("slides");
  });

  it("finalize POST tới /{id}/finalize", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { id: "l1", status: "ready" } }),
    );
    const lecture = await teacherLectureApi.finalize("l1", "tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/lectures/l1/finalize");
    expect(init.method).toBe("POST");
    expect(lecture.status).toBe("ready");
  });

  it("remove DELETE tới /api/v1/teacher/lectures/{id}", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: null }),
    );
    await teacherLectureApi.remove("l1", "tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/lectures/l1");
    expect(init.method).toBe("DELETE");
  });

  it("progress GET tới /{id}/progress?link_id=...", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            student_id: "s1",
            full_name: "Học sinh A",
            sections: {},
            completed_at: null,
          },
        ],
      }),
    );
    const rows = await teacherLectureApi.progress("l1", "link-1", "tok");
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "/api/v1/teacher/lectures/l1/progress?link_id=link-1",
    );
    expect(rows).toEqual([
      {
        student_id: "s1",
        full_name: "Học sinh A",
        sections: {},
        completed_at: null,
      },
    ]);
  });

  it("links GET tới /api/v1/teacher/lectures/{id}/links, trả mảng rỗng khi chưa gắn lớp nào", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));
    const rows = await teacherLectureApi.links("l1", "tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/lectures/l1/links");
    expect(init?.headers?.["Authorization"]).toBe("Bearer tok");
    expect(rows).toEqual([]);
  });

  it("links trả đúng các trường của mỗi liên kết", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            link_id: "link-1",
            class_id: "c1",
            class_name: "Lớp 6A",
            session_id: "s1",
            session_title: "Tiết 1",
            release_at: null,
            visibility: "enrolled_only",
          },
        ],
      }),
    );
    const rows = await teacherLectureApi.links("l1", "tok");
    expect(rows).toEqual([
      {
        link_id: "link-1",
        class_id: "c1",
        class_name: "Lớp 6A",
        session_id: "s1",
        session_title: "Tiết 1",
        release_at: null,
        visibility: "enrolled_only",
      },
    ]);
  });

  it("attach POST tới /{id}/attach với đúng thân yêu cầu, KHÔNG có khoá material_type, trả 201", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: true,
          data: {
            link_id: "link-9",
            class_id: "c1",
            class_name: "Lớp 6A",
            session_id: "s1",
            session_title: "Tiết 1",
            release_at: null,
            visibility: "enrolled_only",
          },
        },
        true,
        201,
      ),
    );
    const link = await teacherLectureApi.attach(
      "l1",
      { class_id: "c1", session_id: "s1" },
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/lectures/l1/attach");
    expect(init.method).toBe("POST");
    const sentBody = JSON.parse(init.body);
    expect(sentBody).toEqual({ class_id: "c1", session_id: "s1" });
    expect(sentBody).not.toHaveProperty("material_type");
    expect(link.link_id).toBe("link-9");
  });

  it("attach báo lỗi 409 'chưa hoàn tất' đúng thông điệp máy chủ trả về", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          message:
            'Bài giảng chưa hoàn tất — phải bấm "Hoàn tất" trước khi gắn vào lớp.',
        },
        false,
        409,
      ),
    );
    await expect(
      teacherLectureApi.attach(
        "l1",
        { class_id: "c1", session_id: "s1" },
        "tok",
      ),
    ).rejects.toThrow(/chưa hoàn tất/);
  });

  it("attach báo lỗi 409 'đã gắn vào tiết này rồi' đúng thông điệp máy chủ trả về", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, message: "Bài giảng đã được gắn vào tiết này rồi." },
        false,
        409,
      ),
    );
    await expect(
      teacherLectureApi.attach(
        "l1",
        { class_id: "c1", session_id: "s1" },
        "tok",
      ),
    ).rejects.toThrow(/đã được gắn vào tiết này rồi/);
  });

  it("throws khi success=false, mang thông điệp máy chủ", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, message: "Bài giảng đã hoàn tất — không sửa được nữa." },
        false,
        409,
      ),
    );
    await expect(
      teacherLectureApi.updateSection(
        "l1",
        "luyentap",
        { question_ids: ["q1"] },
        "tok",
      ),
    ).rejects.toThrow(/hoàn tất/);
  });
});
