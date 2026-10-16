import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, fetchMe } from "@/core/auth/api";

/**
 * GAP-008: lỗi auth phải mang status thì AuthContext mới phân biệt được "token hết hiệu lực"
 * (401 → dọn phiên) với "mạng lỗi tạm thời" (giữ phiên). Trước đây chỉ ném Error trơn.
 */
describe("AuthApiError (GAP-008)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("mang status 401 khi token hết hiệu lực", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, message: "Unauthenticated." }),
    } as unknown as Response);

    await expect(fetchMe("dead-token")).rejects.toMatchObject({
      name: "AuthApiError",
      status: 401,
    });
  });

  it("lỗi mạng mang status 0 — KHÔNG được nhầm thành 401", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const err = await fetchMe("good-token").catch((e) => e);

    expect(err).toBeInstanceOf(AuthApiError);
    expect((err as AuthApiError).status).toBe(0);
  });

  it("lỗi validation 400 chỉ có `errors` → hiện message field, KHÔNG lộ 'Auth API error 400'", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        errors: { identifier: ["Vui lòng nhập email hoặc số điện thoại."] },
      }),
    } as unknown as Response);

    const err = (await fetchMe("t").catch((e) => e)) as AuthApiError;
    expect(err).toBeInstanceOf(AuthApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe("Vui lòng nhập email hoặc số điện thoại.");
  });

  it("lỗi không message, không errors → thông báo tiếng Việt thân thiện (không phải 'Auth API error N')", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false }),
    } as unknown as Response);

    const err = (await fetchMe("t").catch((e) => e)) as AuthApiError;
    expect(err.message).not.toContain("Auth API error");
    expect(err.message).toContain("Vui lòng thử lại");
  });

  it("lỗi máy chủ giữ nguyên status (không phải 401 → phiên vẫn được giữ)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, message: "Service unavailable" }),
    } as unknown as Response);

    await expect(fetchMe("good-token")).rejects.toMatchObject({ status: 503 });
  });
});
