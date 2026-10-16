// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSession,
  getStoredSession,
  saveSession,
  storageKeys,
} from "@/core/auth/storage";
import type { AuthTokenResponse } from "@/core/auth/types";

const keys = storageKeys("user");

function tokens(access: string, refresh?: string): AuthTokenResponse {
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "Bearer",
    expires_in: 3600,
  };
}

function cookieNames(): string[] {
  return document.cookie
    .split("; ")
    .filter(Boolean)
    .map((part) => part.split("=")[0]);
}

afterEach(() => {
  clearSession("user");
  clearSession("admin");
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("token lưu trong cookie, không trong localStorage", () => {
  it("saveSession ghi access/refresh token vào cookie và localStorage không còn token", () => {
    saveSession(tokens("at-1", "rt-1"));

    expect(cookieNames()).toEqual(
      expect.arrayContaining([keys.access, keys.refresh]),
    );
    expect(localStorage.getItem(keys.access)).toBeNull();
    expect(localStorage.getItem(keys.refresh)).toBeNull();
    expect(getStoredSession("user")).toMatchObject({
      accessToken: "at-1",
      refreshToken: "rt-1",
    });
  });

  it("cookie đặt SameSite=Strict, Path=/ và có hạn", () => {
    const setter = vi.spyOn(document, "cookie", "set");

    saveSession(tokens("at-1", "rt-1"));

    const written = setter.mock.calls.map(([value]) => value);
    expect(written).toHaveLength(2);
    for (const value of written) {
      expect(value).toContain("SameSite=Strict");
      expect(value).toContain("Path=/");
      expect(value).toMatch(/Max-Age=\d+/);
    }
  });

  it("phiên cũ trong localStorage được chuyển sang cookie ở lần đọc đầu", () => {
    localStorage.setItem(keys.access, "legacy-at");
    localStorage.setItem(keys.refresh, "legacy-rt");

    expect(getStoredSession("user")).toMatchObject({
      accessToken: "legacy-at",
      refreshToken: "legacy-rt",
    });
    expect(localStorage.getItem(keys.access)).toBeNull();
    expect(localStorage.getItem(keys.refresh)).toBeNull();
    expect(cookieNames()).toEqual(
      expect.arrayContaining([keys.access, keys.refresh]),
    );
  });

  it("clearSession xoá cả cookie lẫn localStorage cũ", () => {
    saveSession(tokens("at-1", "rt-1"));
    localStorage.setItem(keys.access, "stale");

    clearSession("user");

    expect(cookieNames()).not.toContain(keys.access);
    expect(cookieNames()).not.toContain(keys.refresh);
    expect(localStorage.getItem(keys.access)).toBeNull();
    expect(getStoredSession("user")).toEqual({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    });
  });

  it("phiên user và admin không đè cookie của nhau", () => {
    saveSession(tokens("user-at"), "user");
    saveSession(tokens("admin-at"), "admin");

    expect(getStoredSession("user").accessToken).toBe("user-at");
    expect(getStoredSession("admin").accessToken).toBe("admin-at");
  });

  it("cookie bị từ chối (vượt giới hạn) → vẫn giữ phiên bằng localStorage và báo lỗi", () => {
    vi.spyOn(document, "cookie", "set").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    saveSession(tokens("huge-at"));

    expect(localStorage.getItem(keys.access)).toBe("huge-at");
    expect(error).toHaveBeenCalled();
  });
});
