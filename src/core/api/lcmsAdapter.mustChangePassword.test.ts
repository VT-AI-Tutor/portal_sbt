import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sau khi khôi phục mật khẩu, LCMS đặt tài khoản về ĐÚNG mật khẩu mặc định và
 * KHÔNG bật cờ `newUser` cho lượt đăng nhập kế tiếp — nên "đang dùng mật khẩu mặc
 * định" phải tự nó là lý do ép đổi, nếu không học sinh vào thẳng app với mật khẩu
 * ai cũng biết.
 */

const DEFAULT_PASSWORD = "qazXSW@123";
const AUTH_BASE = "https://security.test";

function stubBrowser() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    __APP_CONFIG__: {
      API_PROVIDER: "lcms",
      LCMS_AUTH_BASE_URL: AUTH_BASE,
      LCMS_DEFAULT_PASSWORD: DEFAULT_PASSWORD,
    },
  });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
}

/** Phản hồi đăng nhập LCMS hợp lệ; `newUser` mặc định TẮT (ca sau khôi phục). */
function loginResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      accessToken: "at",
      refreshToken: "rt",
      sessionId: "sid",
      locked: false,
      requiresTotp: false,
      expireDatetime: null,
      ...overrides,
    }),
  } as unknown as Response;
}

describe("ép đổi mật khẩu sau khi đăng nhập (LCMS)", () => {
  beforeEach(() => {
    stubBrowser();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("đăng nhập bằng mật khẩu mặc định (ca sau khôi phục) → còn nợ đổi mật khẩu", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => loginResponse()),
    );
    const { lcmsLogin, lcmsMustChangePassword } =
      await import("@/core/api/lcmsAdapter");

    await lcmsLogin("hoc-sinh@example.com", DEFAULT_PASSWORD);

    expect(lcmsMustChangePassword()).toBe(true);
  });

  it("newUser vẫn ép đổi như cũ dù mật khẩu không phải mặc định", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => loginResponse({ newUser: true })),
    );
    const { lcmsLogin, lcmsMustChangePassword } =
      await import("@/core/api/lcmsAdapter");

    await lcmsLogin("hoc-sinh@example.com", "matkhaurieng");

    expect(lcmsMustChangePassword()).toBe(true);
  });

  it("máy chủ tự khai mustChangePassword → ép đổi (hiện LCMS luôn trả false)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => loginResponse({ mustChangePassword: true })),
    );
    const { lcmsLogin, lcmsMustChangePassword } =
      await import("@/core/api/lcmsAdapter");

    await lcmsLogin("hoc-sinh@example.com", "matkhaurieng");

    expect(lcmsMustChangePassword()).toBe(true);
  });

  it("mật khẩu riêng + không newUser → KHÔNG ép đổi (tự sửa cờ cũ)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => loginResponse()),
    );
    const { lcmsLogin, lcmsMustChangePassword } =
      await import("@/core/api/lcmsAdapter");

    await lcmsLogin("hoc-sinh@example.com", DEFAULT_PASSWORD);
    await lcmsLogin("hoc-sinh@example.com", "matkhaurieng");

    expect(lcmsMustChangePassword()).toBe(false);
  });
});
