import type { AuthTokenResponse } from "@/core/auth/types";

export type AuthScope = "user" | "admin";

interface StorageKeys {
  access: string;
  refresh: string;
  expires: string;
}

const USER_KEYS: StorageKeys = {
  access: "evo_auth_access_token",
  refresh: "evo_auth_refresh_token",
  expires: "evo_auth_expires_at",
};

const ADMIN_KEYS: StorageKeys = {
  access: "evo_admin_auth_access_token",
  refresh: "evo_admin_auth_refresh_token",
  expires: "evo_admin_auth_expires_at",
};

/** Resolves the storage keys for a given auth scope. Exported for testing. */
export function storageKeys(scope: AuthScope = "user"): StorageKeys {
  return scope === "admin" ? ADMIN_KEYS : USER_KEYS;
}

/**
 * Access/refresh token nằm trong cookie, không nằm trong localStorage. Cookie do JS ghi
 * nên KHÔNG thể HttpOnly — XSS vẫn đọc được qua document.cookie; muốn HttpOnly thì máy
 * chủ phải tự đặt cookie. Secure + SameSite=Strict để token không đi qua HTTP thường và
 * không theo request cross-site. Mốc hạn hiệu lực (`expires`) không phải bí mật nên vẫn ở
 * localStorage.
 */
const TOKEN_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60; // trần của trình duyệt; hạn thật do máy chủ quyết

function hasCookieJar(): boolean {
  return typeof document !== "undefined";
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

function setTokenCookie(name: string, value: string, maxAgeSeconds: number): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Strict${secure}`;
}

function readToken(key: string): string | null {
  if (!hasCookieJar()) return localStorage.getItem(key);
  const fromCookie = readCookie(key);
  if (fromCookie !== null) return fromCookie;
  // Phiên đăng nhập trước khi chuyển sang cookie: chuyển một lần rồi xoá khỏi localStorage.
  const legacy = localStorage.getItem(key);
  if (legacy !== null) writeToken(key, legacy);
  return legacy;
}

function writeToken(key: string, value: string): void {
  if (!hasCookieJar()) {
    localStorage.setItem(key, value);
    return;
  }
  setTokenCookie(key, value, TOKEN_COOKIE_MAX_AGE_SECONDS);
  if (readCookie(key) === value) {
    localStorage.removeItem(key);
    return;
  }
  // Trình duyệt từ chối cookie (vượt ~4KB, hoặc chặn cookie): giữ localStorage để
  // không đăng xuất người dùng, nhưng báo lớn để phát hiện.
  console.error(`[auth] Không lưu được ${key} vào cookie, tạm dùng localStorage.`);
  localStorage.setItem(key, value);
}

function removeToken(key: string): void {
  if (hasCookieJar()) setTokenCookie(key, "", 0);
  localStorage.removeItem(key);
}

export interface StoredSession {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

export function getStoredSession(scope: AuthScope = "user"): StoredSession {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, expiresAt: null };
  }

  const keys = storageKeys(scope);
  const expiresRaw = localStorage.getItem(keys.expires);
  const expiresAt = expiresRaw ? Number(expiresRaw) : null;

  return {
    accessToken: readToken(keys.access),
    refreshToken: readToken(keys.refresh),
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
  };
}

export function saveSession(
  tokens: AuthTokenResponse,
  scope: AuthScope = "user",
): void {
  const keys = storageKeys(scope);
  writeToken(keys.access, tokens.access_token);
  if (tokens.refresh_token) {
    writeToken(keys.refresh, tokens.refresh_token);
  }
  localStorage.setItem(
    keys.expires,
    String(Date.now() + tokens.expires_in * 1000),
  );
}

export function clearSession(scope: AuthScope = "user"): void {
  const keys = storageKeys(scope);
  removeToken(keys.access);
  removeToken(keys.refresh);
  localStorage.removeItem(keys.expires);
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function"
  ) {
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
  }
}

/** Window event báo phiên hết hạn (fetch 401); AuthContext nghe để dọn state
 *  React ngay, không đợi F5 (line 49). */
export const SESSION_EXPIRED_EVENT = "evo:session-expired";

/**
 * Phiên vừa bị xoá (đăng xuất, hết hạn, đổi mật khẩu). App nghe để dọn cache:
 * react-query KHÔNG xoá cache khi query bị `enabled: false`, nên người đăng
 * nhập kế tiếp trên cùng máy còn đọc được bài đang làm dở của người trước.
 * Đặt ở clearSession vì mọi đường kết thúc phiên đều đi qua đây.
 */
export const SESSION_CLEARED_EVENT = "evo:session-cleared";

/** True when access token exists and is not within 30s of expiry. */
export function isAccessTokenValid(expiresAt: number | null): boolean {
  if (expiresAt === null) {
    return false;
  }

  return Date.now() < expiresAt - 30_000;
}

/**
 * Số mili-giây tới thời điểm nên tự gia hạn token (trước hạn `skewMs`, mặc định 60s để
 * kịp trước ngưỡng hết hạn 30s của isAccessTokenValid). Đã quá hạn → 0 (gia hạn ngay);
 * không có hạn → null (không lên lịch). Tách hàm thuần để kiểm thử độc lập (GAP-001).
 */
export function computeRefreshDelay(
  expiresAt: number | null,
  now: number,
  skewMs = 60_000,
): number | null {
  if (expiresAt === null) {
    return null;
  }

  return Math.max(0, expiresAt - now - skewMs);
}
