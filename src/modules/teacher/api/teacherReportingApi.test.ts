import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teacherReportingApi } from "@/modules/teacher/api/teacherReportingApi";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("teacherReportingApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("dashboard GET tới /dashboard của lớp", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { student_count: 3 } }),
    );
    const d = await teacherReportingApi.dashboard("c1", "tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/classes/c1/dashboard");
    expect(init?.headers?.["Authorization"]).toBe("Bearer tok");
    expect(d.student_count).toBe(3);
  });

  it("progress đưa subject+period vào query", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { students: [], counts: {} } }),
    );
    await teacherReportingApi.progress(
      "c1",
      { subject: "toan", period: "hoc_ky_1" },
      "tok",
    );
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/classes/c1/progress");
    expect(String(url)).toContain("subject=toan");
    expect(String(url)).toContain("period=hoc_ky_1");
  });

  it("report GET tới /report", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { topics: [] } }),
    );
    await teacherReportingApi.report("c1", { period: "ca_nam" }, "tok");
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/teacher/classes/c1/report");
    expect(String(url)).toContain("period=ca_nam");
  });

  it("ném lỗi khi success=false", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, message: "Không có quyền với lớp này." },
        false,
        403,
      ),
    );
    await expect(teacherReportingApi.dashboard("c1", "tok")).rejects.toThrow(
      "Không có quyền với lớp này.",
    );
  });
});
