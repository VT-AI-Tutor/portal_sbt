import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teacherBankApi } from "@/modules/teacher/api/teacherBankApi";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("teacherBankApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("list('personal', token) GET tới /question-bank/questions?source=personal", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: [{ id: "q1" }] }),
    );
    const rows = await teacherBankApi.list("personal", "tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "/api/v1/teacher/question-bank/questions?source=personal",
    );
    expect(init?.headers?.["Authorization"]).toBe("Bearer tok");
    expect(rows).toEqual([{ id: "q1" }]);
  });

  it("list('ai', token) GET với ?source=ai", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));
    await teacherBankApi.list("ai", "tok");
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "/api/v1/teacher/question-bank/questions?source=ai",
    );
  });

  it("create POST tới /question-bank/questions với body đúng", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { id: "q1" } }, true, 201),
    );
    await teacherBankApi.create(
      {
        question_type: "single_choice",
        topic: "Nước",
        question_text: "Nước sôi ở bao nhiêu độ?",
        difficulty: "easy",
      },
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/question-bank/questions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      question_type: "single_choice",
      topic: "Nước",
      question_text: "Nước sôi ở bao nhiêu độ?",
      difficulty: "easy",
    });
  });

  it("update PUT tới /question-bank/questions/{id} với body đúng", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: {} }));
    await teacherBankApi.update(
      "q1",
      {
        question_type: "single_choice",
        topic: "Nước",
        question_text: "Sửa lại nội dung",
      },
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/question-bank/questions/q1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toMatchObject({
      question_text: "Sửa lại nội dung",
    });
  });

  it("remove DELETE tới /question-bank/questions/{id}", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: {} }));
    await teacherBankApi.remove("q1", "tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/question-bank/questions/q1");
    expect(init.method).toBe("DELETE");
  });

  it("saveFromAi POST tới /questions/from-ai với body {questions}", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { saved: [{ id: "q1" }], rejected: [] },
      }),
    );
    const result = await teacherBankApi.saveFromAi(
      [{ question_type: "single_choice", topic: "Nước", question_text: "Q1" }],
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      "/api/v1/teacher/question-bank/questions/from-ai",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      questions: [{ question_type: "single_choice", topic: "Nước" }],
    });
    expect(result.saved).toEqual([{ id: "q1" }]);
    expect(result.rejected).toEqual([]);
  });

  it("throws khi success=false", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, message: "not allowed" }, false, 403),
    );
    await expect(teacherBankApi.list("personal", "tok")).rejects.toThrow(
      /not allowed/i,
    );
  });
});
