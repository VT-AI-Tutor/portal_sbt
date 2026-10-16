import {
  getAuthenticatedApiBaseUrl,
  getApiProvider,
  getLcmsAuthBaseUrl,
} from "@/core/api/config";
import { safeExternalUrl } from "@/core/lib/security";
import type {
  AuthApiEnvelope,
  AuthMeResponse,
  AuthTokenResponse,
} from "@/core/auth/types";
// Intentional layering inversion (core → modules), per owner decision
// 2026-07-14: ALL LCMS calls — auth included — live in lcmsAdapter so nothing
// else depends on LCMS wire shapes. No import cycle: lcmsAdapter pulls only
// types from this layer.
import {
  lcmsCompleteGoogleLogin,
  lcmsFetchMe,
  lcmsGetGoogleLoginUrl,
  lcmsLogin,
  lcmsLogout,
  lcmsRecoveryPassword,
  lcmsRefresh,
  type LcmsGoogleCallbackParams,
} from "@/core/api/lcmsAdapter";

const API_BASE = getAuthenticatedApiBaseUrl();

/** True when the secondary LCMS provider is enabled via config. */
function isLcms(): boolean {
  return getApiProvider() === "lcms";
}

/**
 * GAP-008: lỗi auth phải mang STATUS thì caller mới phân biệt được "token hết hiệu lực" (401 →
 * đăng xuất thật) với "mạng lỗi tạm thời" (giữ phiên). Trước đây chỉ ném Error trơn nên không
 * cách nào biết, dẫn tới giữ trạng thái "đã đăng nhập" với hồ sơ rỗng.
 * `status = 0` nghĩa là request không tới được máy chủ (mất mạng/CORS/DNS).
 */
export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

/**
 * Dựng thông báo lỗi cho người dùng từ envelope auth.
 * Ưu tiên `message`; nếu không có (lỗi validation 400/422 chỉ có `errors`) thì
 * lấy thông báo field đầu tiên — tránh lộ chuỗi kỹ thuật "Auth API error 400".
 */
function authErrorMessage(
  body: AuthApiEnvelope<unknown>,
  status: number,
): string {
  if (body.message) return body.message;

  const firstFieldMessage = Object.values(body.errors ?? {})
    .flat()
    .find((m): m is string => typeof m === "string" && m.trim() !== "");
  if (firstFieldMessage) return firstFieldMessage;

  return `Đã xảy ra lỗi khi đăng nhập (mã ${status}). Vui lòng thử lại.`;
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers: initHeaders, ...restInit } = init ?? {};

  // Tải tệp (FormData) PHẢI để trình duyệt tự đặt Content-Type — nó cần kèm
  // `boundary` do chính nó sinh. Ép "application/json" ở đây là server không
  // tách nổi multipart, mà lỗi lại rất khó đoán từ phía client.
  const isFormData =
    typeof FormData !== "undefined" && restInit.body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...restInit,
      headers: {
        Accept: "application/json",
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(initHeaders as Record<string, string>),
      },
    });
  } catch (e) {
    throw new AuthApiError(
      e instanceof Error ? e.message : "Không kết nối được máy chủ.",
      0,
    );
  }

  const body = (await res.json().catch(() => ({}))) as AuthApiEnvelope<T>;

  if (!res.ok || body.success === false) {
    throw new AuthApiError(authErrorMessage(body, res.status), res.status);
  }

  if (body.data === undefined) {
    throw new Error("Auth API returned no data.");
  }

  return body.data;
}

export async function login(
  identifier: string,
  password: string,
): Promise<AuthTokenResponse> {
  if (isLcms()) return lcmsLogin(identifier, password);
  return authFetch<AuthTokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      identifier,
      password,
      client_type: "web",
    }),
  });
}

export async function googleLogin(
  credential: string,
): Promise<AuthTokenResponse> {
  if (isLcms()) {
    throw new Error("Đăng nhập Google chưa được hỗ trợ trên hệ thống này.");
  }
  return authFetch<AuthTokenResponse>("/api/v1/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential, client_type: "web" }),
  });
}

/**
 * True when Google sign-in uses the LCMS full-page redirect flow
 * (login/google → Google consent → back to /google/authen) instead of the
 * legacy Google Identity Services credential POST.
 */
export function usesGoogleRedirectLogin(): boolean {
  return isLcms();
}

/** Where to send the user after the Google redirect round-trip completes. */
const GOOGLE_RETURN_TO_KEY = "evo_google_login_return_to";

/**
 * Starts the LCMS Google redirect flow: remembers the page to come back to,
 * resolves the Google consent URL, and navigates the whole window there.
 */
export async function beginGoogleLoginRedirect(
  returnTo?: string,
): Promise<void> {
  if (!isLcms()) {
    throw new Error(
      "Đăng nhập Google qua chuyển hướng chỉ dùng cho hệ thống LCMS.",
    );
  }
  try {
    if (returnTo) sessionStorage.setItem(GOOGLE_RETURN_TO_KEY, returnTo);
    else sessionStorage.removeItem(GOOGLE_RETURN_TO_KEY);
  } catch {
    // storage unavailable — callback just lands on the home page
  }
  const url = await lcmsGetGoogleLoginUrl();
  // Open-redirect guard: the destination is either our own LCMS auth origin or
  // Google's consent screen. Reject anything else before a full-page navigation.
  const lcmsHost = new URL(getLcmsAuthBaseUrl()).hostname;
  window.location.assign(safeExternalUrl(url, [lcmsHost, "google.com"]));
}

/** Reads and clears the page remembered by {@link beginGoogleLoginRedirect}. */
export function consumeGoogleLoginReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(GOOGLE_RETURN_TO_KEY);
    sessionStorage.removeItem(GOOGLE_RETURN_TO_KEY);
    return value;
  } catch {
    return null;
  }
}

export type GoogleRedirectCallbackParams = LcmsGoogleCallbackParams;

/** Turns the /google/authen query params into a normal token session. */
export function completeGoogleLoginRedirect(
  params: GoogleRedirectCallbackParams,
): AuthTokenResponse {
  if (!isLcms()) {
    throw new Error(
      "Đăng nhập Google qua chuyển hướng chỉ dùng cho hệ thống LCMS.",
    );
  }
  return lcmsCompleteGoogleLogin(params);
}

// GAP-001: refresh token là single-use (IDENT-R8) — hai nơi cùng xin gia hạn cùng lúc
// (StrictMode mount đôi trong dev, nhiều nơi cùng phát hiện sắp hết hạn) phải dùng CHUNG
// một lượt gọi, nếu không request sau dùng token đã tiêu → 401 → huỷ oan phiên vừa gia hạn.
const refreshInFlight = new Map<string, Promise<AuthTokenResponse>>();

export function refresh(refreshToken: string): Promise<AuthTokenResponse> {
  const existing = refreshInFlight.get(refreshToken);
  if (existing) {
    return existing;
  }

  const inFlight = (async () => {
    try {
      if (isLcms()) return await lcmsRefresh(refreshToken);
      return await authFetch<AuthTokenResponse>("/api/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } finally {
      refreshInFlight.delete(refreshToken);
    }
  })();

  refreshInFlight.set(refreshToken, inFlight);
  return inFlight;
}

export async function fetchMe(accessToken: string): Promise<AuthMeResponse> {
  if (isLcms()) return lcmsFetchMe();
  return authFetch<AuthMeResponse>("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function logout(accessToken: string): Promise<void> {
  if (isLcms()) return lcmsLogout();
  await authFetch<{ message?: string }>("/api/v1/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Tự đăng ký / quên mật khẩu (IDENT-R16/R17). Các endpoint này thuộc module Identity
 * (`/api/v1/identity/auth/*`), tách khỏi đăng nhập (`/api/v1/auth/*`). Trả về `message`
 * của máy chủ để hiển thị nguyên văn (đặc biệt với quên mật khẩu — không tiết lộ tài
 * khoản có tồn tại hay không). Chưa hỗ trợ trên provider LCMS, trừ quên mật khẩu
 * (LCMS có cửa riêng — xem `forgotPassword`).
 */
async function postIdentity(
  path: string,
  body: unknown,
): Promise<string | undefined> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const env = (await res.json().catch(() => ({}))) as AuthApiEnvelope<unknown>;
  if (!res.ok || env.success === false) {
    throw new Error(env.message ?? `Auth API error ${res.status}`);
  }
  return env.message;
}

const LCMS_UNSUPPORTED = "Chức năng này chưa được hỗ trợ trên hệ thống này.";

export interface RegisterPayload {
  email: string;
  password: string;
  birth_year: number;
  full_name?: string;
  phone?: string;
}

export async function register(
  payload: RegisterPayload,
): Promise<string | undefined> {
  if (isLcms()) throw new Error(LCMS_UNSUPPORTED);
  return postIdentity("/api/v1/identity/auth/register", payload);
}

export async function verifyRegistration(
  email: string,
  code: string,
): Promise<string | undefined> {
  if (isLcms()) throw new Error(LCMS_UNSUPPORTED);
  return postIdentity("/api/v1/identity/auth/register/verify", { email, code });
}

/**
 * True khi quên mật khẩu chỉ có MỘT bước: LCMS tự đặt lại và gửi MẬT KHẨU MỚI vào
 * hộp thư, không cấp mã cho web nhập, nên không có bước `resetPassword` — người
 * dùng quay lại đăng nhập bằng mật khẩu vừa nhận. Provider native vẫn là mã khôi
 * phục + tự chọn mật khẩu mới.
 */
export function forgotPasswordEmailsNewPassword(): boolean {
  return isLcms();
}

export async function forgotPassword(
  email: string,
): Promise<string | undefined> {
  if (isLcms()) {
    // Máy chủ trả 200 thân rỗng — không có `message` để hiện nguyên văn.
    await lcmsRecoveryPassword(email);
    return undefined;
  }
  return postIdentity("/api/v1/identity/auth/password/forgot", { email });
}

export async function resetPassword(
  email: string,
  code: string,
  password: string,
): Promise<string | undefined> {
  if (isLcms()) throw new Error(LCMS_UNSUPPORTED);
  return postIdentity("/api/v1/identity/auth/password/reset", {
    email,
    code,
    password,
  });
}

/**
 * Đặt mật khẩu lần đầu cho tài khoản do quản trị tạo (IDENT-R12). Mã một lần do quản trị cấp
 * (hạn 72 giờ); mật khẩu tối thiểu 12 ký tự — server kiểm lại, đây chỉ là đường gọi.
 */
export async function setInitialPassword(
  email: string,
  code: string,
  password: string,
): Promise<string | undefined> {
  if (isLcms()) throw new Error(LCMS_UNSUPPORTED);
  return postIdentity("/api/v1/identity/auth/password/set-initial", {
    email,
    code,
    password,
  });
}

export interface UpdateProfilePayload {
  province?: string;
  school_name?: string;
  level?: string;
  class_name?: string;
  /** Url ảnh đại diện (từ `uploadAvatar`). `null` = gỡ ảnh. */
  avatar?: string | null;
}

/** Provider hiện tại có hỗ trợ đổi ảnh đại diện không. */
export function supportsAvatarUpload(): boolean {
  return !isLcms();
}

/**
 * POST /api/v1/auth/avatar — tải ảnh, trả url để gắn vào hồ sơ ở bước sau.
 *
 * LCMS chưa có cửa tương ứng (chờ NXB bổ sung). Giữ đúng khuôn `isLcms()` như
 * các hàm khác trong file để lúc LCMS có API thì chỉ thay thân hàm, mọi nơi gọi
 * không phải sửa.
 */
export async function uploadAvatar(
  accessToken: string,
  file: File,
): Promise<string> {
  if (isLcms()) {
    throw new Error("Đổi ảnh đại diện chưa được hỗ trợ trên hệ thống này.");
  }
  const form = new FormData();
  form.append("file", file);
  // KHÔNG tự đặt Content-Type: trình duyệt phải tự sinh boundary cho multipart.
  const res = await authFetch<{ fileUrl: string }>("/api/v1/auth/avatar", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  return res.fileUrl;
}

export async function updateProfile(
  accessToken: string,
  payload: UpdateProfilePayload,
): Promise<AuthMeResponse> {
  if (isLcms()) {
    throw new Error(
      "Chức năng cập nhật hồ sơ chưa được hỗ trợ trên hệ thống này.",
    );
  }
  return authFetch<AuthMeResponse>("/api/v1/auth/profile", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}
