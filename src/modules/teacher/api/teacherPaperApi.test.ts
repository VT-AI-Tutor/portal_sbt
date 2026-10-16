import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teacherPaperApi } from "@/modules/teacher/api/teacherPaperApi";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("teacherPaperApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("list(token) GET tới /api/v1/teacher/papers", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: [{ id: "p1" }] }),
    );
    const rows = await teacherPaperApi.list("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/papers");
    expect(init?.headers?.["Authorization"]).toBe("Bearer tok");
    expect(rows).toEqual([{ id: "p1" }]);
  });

  it("create POST tới /api/v1/teacher/papers với body đúng", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { id: "p1" } }, true, 201),
    );
    await teacherPaperApi.create(
      {
        kind: "exam",
        title: "Đề kiểm tra giữa kỳ",
        question_ids: ["q1", "q2"],
      },
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/papers");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      kind: "exam",
      title: "Đề kiểm tra giữa kỳ",
      question_ids: ["q1", "q2"],
    });
  });

  it("update PUT tới /api/v1/teacher/papers/{id} với body đúng", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: {} }));
    await teacherPaperApi.update(
      "p1",
      {
        kind: "worksheet",
        title: "Phiếu bài tập",
        question_ids: ["q1"],
      },
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/papers/p1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toMatchObject({
      title: "Phiếu bài tập",
    });
  });

  it("remove DELETE tới /api/v1/teacher/papers/{id}", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: {} }));
    await teacherPaperApi.remove("p1", "tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/papers/p1");
    expect(init.method).toBe("DELETE");
  });

  it("throws với message khi PUT paper đã giao lớp (422)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          message: "Đề/phiếu đã được giao cho lớp — không sửa được nữa...",
        },
        false,
        422,
      ),
    );
    await expect(
      teacherPaperApi.update(
        "p1",
        { kind: "exam", title: "X", question_ids: [] },
        "tok",
      ),
    ).rejects.toThrow(/đã được giao cho lớp/i);
  });

  it("throws khi success=false", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, message: "not allowed" }, false, 403),
    );
    await expect(teacherPaperApi.list("tok")).rejects.toThrow(/not allowed/i);
  });
});
