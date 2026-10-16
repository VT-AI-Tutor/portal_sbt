/**
 * lcmsLogin phải dựng thông báo tiếng Việt dễ hiểu từ envelope lỗi LCMS
 * `{ errorCode, errors: ["<code>"] }` thay vì lộ chuỗi kỹ thuật
 * "Auth API error 400" (LCMS_AUTH_BASE_URL trả 400).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { lcmsLogin } from "@/core/api/lcmsAdapter";

function stubFetchJson(status: number, json: unknown) {
  const fn = vi.fn(
    async () =>
      ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => json,
      }) as unknown as Response,
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("lcmsLogin — thông báo lỗi khi LCMS trả 400", () => {
  it("map mã đã biết user-login-failed-n-times sang câu tiếng Việt", async () => {
    stubFetchJson(400, {
      timestamp: "1784626084873",
      errorCode: "INVALID_REQUEST",
      errors: ["security.authen.user-login-failed-n-times"],
    });
    await expect(lcmsLogin("admin", "wrong")).rejects.toThrow(
      /Sai tài khoản hoặc mật khẩu.*nhập sai nhiều lần/,
    );
  });

  it("mã security.authen.* chưa map → câu xác thực chung", async () => {
    stubFetchJson(400, {
      errorCode: "INVALID_REQUEST",
      errors: ["security.authen.some-new-code"],
    });
    await expect(lcmsLogin("admin", "x")).rejects.toThrow(
      /kiểm tra lại tài khoản và mật khẩu/,
    );
  });

  it("không phải chuỗi kỹ thuật 'Auth API error 400'", async () => {
    stubFetchJson(400, {
      errorCode: "INVALID_REQUEST",
      errors: ["security.authen.user-login-failed-n-times"],
    });
    await expect(lcmsLogin("admin", "wrong")).rejects.not.toThrow(
      /Auth API error/,
    );
  });

  it("ưu tiên message khi backend có gửi", async () => {
    stubFetchJson(400, { message: "Máy chủ đang bảo trì." });
    await expect(lcmsLogin("admin", "x")).rejects.toThrow("Máy chủ đang bảo trì.");
  });

  it("lỗi máy chủ 5xx → thông báo thân thiện, KHÔNG lộ mã HTTP", async () => {
    stubFetchJson(500, {});
    await expect(lcmsLogin("admin", "x")).rejects.toThrow(
      "Hệ thống đang bận. Vui lòng thử lại sau ít phút.",
    );
  });

  it("lỗi 4xx không rõ mã → thông báo thân thiện chung", async () => {
    stubFetchJson(400, { errorCode: "SOMETHING_ELSE" });
    await expect(lcmsLogin("admin", "x")).rejects.toThrow(
      "Đăng nhập không thành công. Vui lòng thử lại.",
    );
  });

  it("KHÔNG lộ mã HTTP/chuỗi kỹ thuật trong mọi fallback", async () => {
    for (const status of [400, 403, 500, 503]) {
      stubFetchJson(status, {});
      await expect(lcmsLogin("admin", "x")).rejects.not.toThrow(
        new RegExp(`mã ${status}|error ${status}|${status}`),
      );
    }
  });

  it("lỗi mạng (fetch ném) → thông báo thân thiện, KHÔNG lộ 'Failed to fetch'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(lcmsLogin("admin", "x")).rejects.toThrow(
      /Không kết nối được máy chủ/,
    );
    await expect(lcmsLogin("admin", "x")).rejects.not.toThrow(/Failed to fetch/);
  });
});
