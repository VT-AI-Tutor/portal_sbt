import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgotPassword,
  forgotPasswordEmailsNewPassword,
} from "@/core/auth/api";

/**
 * Quên mật khẩu trên provider LCMS: một bước duy nhất tới
 * POST /api/security/user/recovery-password (host security), máy chủ tự đặt lại
 * mật khẩu về mặc định rồi gửi vào email.
 */

const AUTH_BASE = "https://security.test";

function stubRuntimeConfig() {
  vi.stubGlobal("window", {
    __APP_CONFIG__: {
      API_PROVIDER: "lcms",
      LCMS_AUTH_BASE_URL: AUTH_BASE,
    },
  });
}

/** Response giả: adapter đọc `res.text()` rồi mới tự parse. */
function response(status: number, body: unknown | "" = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === "" ? "" : JSON.stringify(body)),
  } as unknown as Response;
}

/** Nguyên văn thân lỗi LCMS trả về khi email không có trong tenant. */
const NOT_FOUND_BODY = {
  timestamp: "1787668494858",
  errorCode: "500",
  errors: [
    'Cannot invoke "com.viettel.dx.security.domain.model.User.getId()" because the return value of "com.viettel.dx.security.inf.service.impl.UserServiceImpl.fetchByEmail(long, String)" is null',
  ],
};

describe("forgotPassword (LCMS)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stubRuntimeConfig();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("là flow MỘT bước — không có bước nhập mã", () => {
    expect(forgotPasswordEmailsNewPassword()).toBe(true);
  });

  it("POST tới /api/security/user/recovery-password kèm tenantCode + email", async () => {
    fetchMock.mockResolvedValue(response(200));

    await forgotPassword("hoc-sinh@example.com");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${AUTH_BASE}/api/security/user/recovery-password`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      tenantCode: "NXB",
      email: "hoc-sinh@example.com",
    });
  });

  it("200 thân RỖNG = gửi thành công — không được ném lỗi", async () => {
    // Máy chủ trả content-length: 0 — parse thân rỗng phải ra "thành công".
    fetchMock.mockResolvedValue(response(200));

    await expect(
      forgotPassword("hoc-sinh@example.com"),
    ).resolves.toBeUndefined();
  });

  it("email chưa đăng ký (500 + NPE fetchByEmail) → câu lỗi chung, KHÔNG lộ email chưa đăng ký hay stack trace Java", async () => {
    fetchMock.mockResolvedValue(response(500, NOT_FOUND_BODY));

    const err = (await forgotPassword("khong-ton-tai@example.com").catch(
      (e) => e,
    )) as Error;

    expect(err.message).toBe(
      "Không gửi được yêu cầu đặt lại mật khẩu. Vui lòng thử lại.",
    );
    expect(err.message).not.toContain("chưa được đăng ký");
    expect(err.message).not.toContain("com.viettel");
  });

  it("500 thật (không phải email sai) → thông báo chung, không nhận nhầm là email chưa đăng ký", async () => {
    fetchMock.mockResolvedValue(
      response(500, { errorCode: "500", errors: ["connection refused"] }),
    );

    const err = (await forgotPassword("hoc-sinh@example.com").catch(
      (e) => e,
    )) as Error;

    expect(err.message).toBe(
      "Hệ thống đang bận. Vui lòng thử lại sau ít phút.",
    );
  });

  it("500 kèm `message` kỹ thuật → KHÔNG hiện nguyên văn (5xx hay là stack trace/lỗi SQL)", async () => {
    fetchMock.mockResolvedValue(
      response(500, {
        message: "could not execute statement; SQL [n/a]; constraint [null]",
      }),
    );

    const err = (await forgotPassword("hoc-sinh@example.com").catch(
      (e) => e,
    )) as Error;

    expect(err.message).toBe(
      "Hệ thống đang bận. Vui lòng thử lại sau ít phút.",
    );
  });

  it("404 (sai host/route) KHÔNG được đọc thành 'email chưa đăng ký'", async () => {
    fetchMock.mockResolvedValue(
      response(404, { errorCode: "404", errors: ["Not Found"] }),
    );

    const err = (await forgotPassword("hoc-sinh@example.com").catch(
      (e) => e,
    )) as Error;

    expect(err.message).toBe(
      "Không gửi được yêu cầu đặt lại mật khẩu. Vui lòng thử lại.",
    );
  });

  it("200 kèm {success:false} KHÔNG được đọc thành 'đã gửi'", async () => {
    fetchMock.mockResolvedValue(
      response(200, { success: false, message: "Tài khoản đang bị khóa." }),
    );

    const err = (await forgotPassword("hoc-sinh@example.com").catch(
      (e) => e,
    )) as Error;

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Tài khoản đang bị khóa.");
  });

  it("500 chỉ tình cờ có khung fetchByEmail trong stack → KHÔNG kết luận email chưa đăng ký", async () => {
    fetchMock.mockResolvedValue(
      response(500, {
        errorCode: "500",
        errors: [
          "org.springframework.mail.MailSendException: Mail server connection failed\n\tat …UserServiceImpl.fetchByEmail(UserServiceImpl.java:88)\n\tCaused by: javax.mail.AuthenticationFailedException: password is null",
        ],
      }),
    );

    const err = (await forgotPassword("hoc-sinh@example.com").catch(
      (e) => e,
    )) as Error;

    expect(err.message).toBe(
      "Hệ thống đang bận. Vui lòng thử lại sau ít phút.",
    );
  });

  it("mất mạng → thông báo thân thiện, không phải 'Failed to fetch'", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const err = (await forgotPassword("hoc-sinh@example.com").catch(
      (e) => e,
    )) as Error;

    expect(err.message).toBe(
      "Không kết nối được máy chủ. Vui lòng kiểm tra kết nối mạng rồi thử lại.",
    );
  });
});
