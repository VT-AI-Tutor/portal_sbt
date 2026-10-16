export interface AuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  session_id?: string;
}

export interface AuthApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  /** Field-level validation errors (Laravel shape) returned on 400/422. */
  errors?: Record<string, string[]>;
}

/**
 * Tư cách quản trị do backend tính từ chính gốc phạm vi nó dùng để gác cổng:
 *
 *   "global"   — quản trị toàn hệ, thấy mọi màn quản trị
 *   "org_unit" — quản trị một địa bàn (tỉnh/phường-xã/trường), chỉ thấy màn tổ
 *                chức và người dùng
 *
 * Vắng mặt (undefined) nghĩa là không phải quản trị, HOẶC phiên đăng nhập cũ
 * dựng trước khi backend trả trường này — hai trường hợp đó phân biệt bằng cách
 * lùi về `roles` (xem `hasAdminRole`).
 */
export type AdminScope = "global" | "org_unit";

export interface AuthUser {
  id?: string;
  email?: string;
  name?: string;
  full_name?: string;
  status?: string;
  class_name?: string;
  role?: string;
  roles?: unknown;
  admin_scope?: AdminScope;
  [key: string]: unknown;
}

export interface AuthMeResponse {
  actor_type?: string;
  admin_scope?: AdminScope | null;
  user?: AuthUser;
}
