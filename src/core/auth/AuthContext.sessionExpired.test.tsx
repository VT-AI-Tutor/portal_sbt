// @vitest-environment jsdom
/**
 * SBT line 49 — cầu nối hết phiên: lớp fetch 401 (lcmsAdapter) phát
 * SESSION_EXPIRED_EVENT; AuthContext nghe để dọn NGAY state React trong bộ nhớ
 * (accessToken/user) → cổng gác chuyển về đăng nhập không cần F5. Test bên NGHE:
 * phát event → isAuthenticated lật false + phiên localStorage bị dọn.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import {
  saveSession,
  getStoredSession,
  SESSION_EXPIRED_EVENT,
} from "./storage";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/core/auth/api", () => ({
  fetchMe: vi.fn(async () => ({ user: { id: "1", name: "Học sinh" } })),
  refresh: vi.fn(),
  login: vi.fn(),
  googleLogin: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  completeGoogleLoginRedirect: vi.fn(),
  usesGoogleRedirectLogin: () => false,
  beginGoogleLoginRedirect: vi.fn(),
  AuthApiError: class AuthApiError extends Error {
    status: number;
    constructor(status: number, message?: string) {
      super(message);
      this.status = status;
    }
  },
}));

function Probe() {
  const { isAuthenticated } = useAuth();
  return <div>{isAuthenticated ? "IN" : "OUT"}</div>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("AuthContext — cầu nối SESSION_EXPIRED_EVENT (SBT line 49)", () => {
  it("phát event → isAuthenticated lật false + phiên localStorage bị dọn", async () => {
    // Phiên hợp lệ (token chưa hết hạn) → sau restore là đã đăng nhập.
    saveSession(
      {
        access_token: "t",
        refresh_token: "r",
        expires_in: 3600,
        token_type: "Bearer",
      },
      "user",
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await screen.findByText("IN");

    // Lớp fetch 401 phát tín hiệu hết phiên.
    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });

    // Không cần F5: state trong bộ nhớ bị dọn ngay.
    await screen.findByText("OUT");
    expect(getStoredSession("user").accessToken).toBeNull();
  });
});
