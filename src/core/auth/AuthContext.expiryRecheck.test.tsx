// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { saveSession, getStoredSession, storageKeys } from "./storage";
import * as authApi from "@/core/auth/api";

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

function expireStoredSession() {
  localStorage.setItem(storageKeys("user").expires, String(Date.now() - 1_000));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("AuthContext — soi lại hạn phiên khi tab quay lại", () => {
  it("token đã hết hạn + gia hạn thất bại ⇒ đăng xuất ngay khi focus, không cần F5", async () => {
    saveSession(
      { access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "Bearer" },
      "user",
    );
    vi.mocked(authApi.refresh).mockRejectedValue(new Error("refresh token hết hạn"));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("IN");

    expireStoredSession();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    await screen.findByText("OUT");
    expect(getStoredSession("user").accessToken).toBeNull();
  });

  it("token còn hạn ⇒ focus không đụng gì tới phiên", async () => {
    saveSession(
      { access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "Bearer" },
      "user",
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("IN");

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(screen.getByText("IN")).toBeTruthy();
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  it("hết hạn nhưng còn refresh token ⇒ gia hạn được thì giữ nguyên phiên", async () => {
    saveSession(
      { access_token: "t", refresh_token: "r", expires_in: 3600, token_type: "Bearer" },
      "user",
    );
    vi.mocked(authApi.refresh).mockResolvedValue({
      access_token: "t2",
      refresh_token: "r2",
      expires_in: 3600,
      token_type: "Bearer",
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("IN");

    expireStoredSession();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(screen.getByText("IN")).toBeTruthy();
    expect(getStoredSession("user").accessToken).toBe("t2");
  });
});
