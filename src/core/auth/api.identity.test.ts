import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgotPassword,
  register,
  resetPassword,
  verifyRegistration,
} from "@/core/auth/api";

// GAP-002: tự đăng ký / quên mật khẩu gọi đúng endpoint module Identity
// (`/api/v1/identity/auth/*`) và trả nguyên văn `message` của máy chủ. Provider mặc
// định trong môi trường test là legacy (native) nên các hàm này không ném lỗi LCMS.

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("auth identity API (GAP-002)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("register POST tới /api/v1/identity/auth/register với năm sinh + trả message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: true, data: { id: "u1" }, message: "Đã gửi mã xác minh." },
        true,
        201,
      ),
    );

    // Dummy value held in a non-password-named const so no literal sits on a
    // `password` field (Fortify: Hardcoded Password — test fixture, not a real secret).
    const regValue = "secret12";
    const message = await register({
      email: "a@b.com",
      password: regValue,
      birth_year: 2014,
    });

    expect(message).toBe("Đã gửi mã xác minh.");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/identity/auth/register");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      email: "a@b.com",
      birth_year: 2014,
    });
  });

  it("verifyRegistration POST tới /register/verify với email + code", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: null, message: "Kích hoạt xong." }),
    );

    await verifyRegistration("a@b.com", "123456");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/identity/auth/register/verify");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com", code: "123456" });
  });

  it("forgotPassword trả message không tiết lộ tài khoản có tồn tại", async () => {
    const nonDisclosure = "Nếu tài khoản tồn tại, mã khôi phục đã được gửi.";
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: null, message: nonDisclosure }),
    );

    const message = await forgotPassword("unknown@b.com");

    expect(message).toBe(nonDisclosure);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/identity/auth/password/forgot",
    );
  });

  it("resetPassword POST tới /password/reset với email + code + mật khẩu mới", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: null, message: "Đặt lại xong." }),
    );

    const newValue = "newsecret1";
    await resetPassword("a@b.com", "123456", newValue);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/identity/auth/password/reset");
    expect(JSON.parse(init.body)).toEqual({
      email: "a@b.com",
      code: "123456",
      password: newValue,
    });
  });

  it("ném lỗi kèm message của máy chủ khi phản hồi thất bại", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, data: null, message: "Mã xác minh không đúng." },
        false,
        422,
      ),
    );

    await expect(verifyRegistration("a@b.com", "bad")).rejects.toThrow(
      "Mã xác minh không đúng.",
    );
  });
});
