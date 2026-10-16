import { describe, expect, it } from "vitest";
import {
  computeRefreshDelay,
  getStoredSession,
  storageKeys,
} from "@/core/auth/storage";

// Note: vitest runs in the default `node` environment for this project (no
// jsdom/happy-dom configured), so `window`/`localStorage` are unavailable.
// We test the pure key-resolution logic directly, and confirm the
// window-less fallback of getStoredSession stays safe under that environment.

describe("storageKeys", () => {
  it("resolves user-scope keys to the original (legacy) key names", () => {
    expect(storageKeys("user")).toEqual({
      access: "evo_auth_access_token",
      refresh: "evo_auth_refresh_token",
      expires: "evo_auth_expires_at",
    });
  });

  it("resolves admin-scope keys to a distinct, prefixed key set", () => {
    expect(storageKeys("admin")).toEqual({
      access: "evo_admin_auth_access_token",
      refresh: "evo_admin_auth_refresh_token",
      expires: "evo_admin_auth_expires_at",
    });
  });

  it("defaults to user scope when no scope is given", () => {
    expect(storageKeys()).toEqual(storageKeys("user"));
  });

  it("produces disjoint key sets between scopes", () => {
    const user = storageKeys("user");
    const admin = storageKeys("admin");
    expect(user.access).not.toBe(admin.access);
    expect(user.refresh).not.toBe(admin.refresh);
    expect(user.expires).not.toBe(admin.expires);
  });
});

describe("computeRefreshDelay (GAP-001 tự gia hạn trước hạn)", () => {
  const now = 1_000_000;

  it("lên lịch gia hạn trước hạn đúng bằng skew (mặc định 60s)", () => {
    // Token còn 5 phút → gia hạn sau 4 phút (5' - 60s).
    expect(computeRefreshDelay(now + 300_000, now)).toBe(240_000);
  });

  it("trả 0 (gia hạn ngay) khi đã trong vùng skew hoặc quá hạn", () => {
    expect(computeRefreshDelay(now + 30_000, now)).toBe(0); // trong 60s skew
    expect(computeRefreshDelay(now - 10_000, now)).toBe(0); // đã quá hạn
  });

  it("không lên lịch khi không có hạn", () => {
    expect(computeRefreshDelay(null, now)).toBeNull();
  });

  it("tôn trọng skew tuỳ biến", () => {
    expect(computeRefreshDelay(now + 100_000, now, 10_000)).toBe(90_000);
  });
});

describe("getStoredSession (no window/localStorage in this test environment)", () => {
  it("returns an empty session instead of throwing when window is undefined", () => {
    expect(getStoredSession("user")).toEqual({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    });
    expect(getStoredSession("admin")).toEqual({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    });
  });
});
