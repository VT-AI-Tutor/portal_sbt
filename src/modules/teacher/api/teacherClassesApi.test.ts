import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("teacherClassesApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("listClasses GET tới /api/v1/classes và trả data", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: [{ id: "c1", name: "10A1" }] }),
    );
    const classes = await teacherClassesApi.listClasses("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/classes");
    expect(init?.headers?.["Authorization"]).toBe("Bearer tok");
    expect(classes).toEqual([{ id: "c1", name: "10A1" }]);
  });

  it("listClasses lọc theo instructor_user_id khi truyền", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));
    await teacherClassesApi.listClasses("tok", "teacher-9");
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/classes?instructor_user_id=teacher-9");
  });

  it("listAssignments GET tới /classes/{id}/assignments", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));
    await teacherClassesApi.listAssignments("c1", "tok");
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/classes/c1/assignments");
  });

  it("assignmentProgress GET tới /classes/{id}/assignments/{linkId}/progress", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            user_id: "u1",
            name: "Học sinh A",
            submission_status: "da_cham",
            score: 8,
            max_score: 10,
          },
        ],
      }),
    );
    const rows = await teacherClassesApi.assignmentProgress("c1", "l1", "tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/classes/c1/assignments/l1/progress");
    expect(init?.method ?? "GET").toBe("GET");
    expect(rows[0].user_id).toBe("u1");
  });

  it("assign POST tới /classes/{id}/assignments với body đúng", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { id: "l1" } }, true, 201),
    );
    await teacherClassesApi.assign(
      "c1",
      { assignment_id: "ex-1", title_snapshot: "Phiếu", due_at: "2026-08-01" },
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/classes/c1/assignments");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      assignment_id: "ex-1",
      title_snapshot: "Phiếu",
    });
  });

  it("pendingSubmissions GET tới /teacher/classes/{id}/submissions", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));
    await teacherClassesApi.pendingSubmissions("c1", "tok");
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/classes/c1/submissions");
  });

  it("grade POST tới /teacher/submissions/{id}/grade với body đúng (trường points, khớp validate BE)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: {} }));
    await teacherClassesApi.grade(
      "sub-1",
      { grades: [{ question_id: "q1", points: 1 }], teacher_comment: "Tốt" },
      "tok",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/submissions/sub-1/grade");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      grades: [{ question_id: "q1", points: 1 }],
      teacher_comment: "Tốt",
    });
  });

  it("getSubmission GET tới /teacher/submissions/{id} và trả data", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          id: "sub-1",
          results: [{ question_id: "e1", gradable: false }],
        },
      }),
    );
    const detail = await teacherClassesApi.getSubmission("sub-1", "tok");
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/submissions/sub-1");
    expect(String(url)).not.toContain("/grade");
    expect(detail.id).toBe("sub-1");
  });

  it("throws khi success=false", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, message: "not allowed" }, false, 403),
    );
    await expect(teacherClassesApi.listClasses("tok")).rejects.toThrow(
      /not allowed/i,
    );
  });
});
