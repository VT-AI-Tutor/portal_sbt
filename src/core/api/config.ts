import { getBrandDefault } from '@/core/brand/brand';

/** Strip trailing slashes so `${base}${path}` stays valid when path starts with `/`. */
function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

type RuntimeConfigKey =
  | 'API_BASE_URL'
  | 'CATALOG_API_BASE_URL'
  | 'API_PROVIDER'
  | 'CATALOG_API_PROVIDER' // deprecated: old name of API_PROVIDER
  | 'LCMS_API_BASE_URL'
  | 'LCMS_AUTH_BASE_URL'
  | 'LCMS_MASTERY_API_BASE_URL'
  | 'LCMS_DEFAULT_PASSWORD';

/** Read a trimmed, non-empty runtime config string; despite the name, not URL-specific. */
function getRuntimeConfigUrl(key: RuntimeConfigKey): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const value = window.__APP_CONFIG__?.[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Authenticated LMS API (auth, admin books, AI, etc.).
 * Uses `API_BASE_URL` from `/config.js` when set; otherwise `VITE_API_BASE_URL` in `.env.local`.
 * Empty string = same origin as the web app.
 */
export function getAuthenticatedApiBaseUrl(): string {
  const runtime = getRuntimeConfigUrl('API_BASE_URL');
  const brand = getBrandDefault('API_BASE_URL');
  const env = import.meta.env.VITE_API_BASE_URL;
  return normalizeBaseUrl(runtime ?? brand ?? env ?? '');
}

/**
 * Public catalog API (book list, detail, lessons).
 * Uses `CATALOG_API_BASE_URL` from `/config.js` when set; otherwise `VITE_CATALOG_API_BASE_URL`,
 * then falls back to the authenticated API base URL.
 */
export function getCatalogApiBaseUrl(): string {
  const runtimeCatalog = getRuntimeConfigUrl('CATALOG_API_BASE_URL');
  if (runtimeCatalog !== undefined) {
    return normalizeBaseUrl(runtimeCatalog);
  }
  const brand = getBrandDefault('CATALOG_API_BASE_URL');
  if (brand !== undefined) {
    return normalizeBaseUrl(brand);
  }
  const catalog = import.meta.env.VITE_CATALOG_API_BASE_URL;
  if (catalog !== undefined && catalog !== '') {
    return normalizeBaseUrl(catalog);
  }
  return getAuthenticatedApiBaseUrl();
}

export type ApiProvider = 'legacy' | 'lcms';
/** @deprecated Use {@link ApiProvider}. */
export type CatalogApiProvider = ApiProvider;

/**
 * Which backend serves the app (catalog, student flow, auth). The legacy API
 * is the primary, native contract; 'lcms' switches those modules to the NXB
 * LCMS API (adapted client-side to the legacy shapes in lcmsAdapter).
 * Anything else means 'legacy'.
 * Reads `API_PROVIDER`, falling back to the deprecated `CATALOG_API_PROVIDER`.
 */
export function getApiProvider(): ApiProvider {
  const value =
    getRuntimeConfigUrl('API_PROVIDER') ??
    getRuntimeConfigUrl('CATALOG_API_PROVIDER') ?? // deprecated fallback
    getBrandDefault('API_PROVIDER') ??
    import.meta.env.VITE_API_PROVIDER ??
    import.meta.env.VITE_CATALOG_API_PROVIDER ?? // deprecated fallback
    '';
  return value.trim().toLowerCase() === 'lcms' ? 'lcms' : 'legacy';
}

/** @deprecated Use {@link getApiProvider}. */
export const getCatalogApiProvider = getApiProvider;

/**
 * LCMS API origin (only used when the API provider is 'lcms').
 * Uses `LCMS_API_BASE_URL` from `/config.js` when set; otherwise
 * `VITE_LCMS_API_BASE_URL`, then falls back to the catalog API base URL.
 */
export function getLcmsApiBaseUrl(): string {
  const runtime = getRuntimeConfigUrl('LCMS_API_BASE_URL');
  if (runtime !== undefined) {
    return normalizeBaseUrl(runtime);
  }
  const brand = getBrandDefault('LCMS_API_BASE_URL');
  if (brand !== undefined) {
    return normalizeBaseUrl(brand);
  }
  const env = import.meta.env.VITE_LCMS_API_BASE_URL;
  if (env !== undefined && env !== '') {
    return normalizeBaseUrl(env);
  }
  return getCatalogApiBaseUrl();
}

/**
 * LCMS auth/security origin (login, refresh, Google sign-in). The auth service
 * lives on its own host (e.g. `http://security.nxbgd.vn`), separate from the
 * catalog API, so it has a dedicated key.
 * Uses `LCMS_AUTH_BASE_URL` from `/config.js` when set; otherwise
 * `VITE_LCMS_AUTH_BASE_URL`, then falls back to the LCMS API base URL.
 */
export function getLcmsAuthBaseUrl(): string {
  const runtime = getRuntimeConfigUrl('LCMS_AUTH_BASE_URL');
  if (runtime !== undefined) {
    return normalizeBaseUrl(runtime);
  }
  const brand = getBrandDefault('LCMS_AUTH_BASE_URL');
  if (brand !== undefined) {
    return normalizeBaseUrl(brand);
  }
  const env = import.meta.env.VITE_LCMS_AUTH_BASE_URL;
  if (env !== undefined && env !== '') {
    return normalizeBaseUrl(env);
  }
  return getLcmsApiBaseUrl();
}

/** Built-in default password khi cấp tài khoản LCMS — dùng khi không cấu hình. */
const LCMS_DEFAULT_PASSWORD_FALLBACK = 'qazXSW@123';

/**
 * Mật khẩu mặc định khi cấp tài khoản LCMS — điền sẵn làm "mật khẩu hiện tại" ở
 * modal ép đổi mật khẩu lần đầu (chỉ dùng khi provider là 'lcms').
 * Uses `LCMS_DEFAULT_PASSWORD` from `/config.js` when set; otherwise
 * `VITE_LCMS_DEFAULT_PASSWORD`, then the built-in fallback.
 */
export function getLcmsDefaultPassword(): string {
  const runtime = getRuntimeConfigUrl('LCMS_DEFAULT_PASSWORD');
  if (runtime !== undefined) {
    return runtime;
  }
  const env = import.meta.env.VITE_LCMS_DEFAULT_PASSWORD;
  if (env !== undefined && env !== '') {
    return env;
  }
  return LCMS_DEFAULT_PASSWORD_FALLBACK;
}

/**
 * Mật khẩu bài tập 4 số (chỉ áp dụng khi provider là 'lcms'): 1/4 số bài đầu
 * mỗi cuốn sách làm tự do, từ bài kế tiếp trở đi học sinh phải nhập đúng mật
 * khẩu này một lần để mở nốt cuốn đó. Một mật khẩu dùng chung cho mọi sách.
 * Chỉ cấu hình qua `.env` (`VITE_EXERCISE_PASS`) — KHÔNG đọc từ config.js.
 * Không đặt/để trống = trả null → BỎ QUA gate (không hỏi mật khẩu).
 */
export function getExercisePass(): string | null {
  const env = import.meta.env.VITE_EXERCISE_PASS;
  return env !== undefined && env !== '' ? env : null;
}

/**
 * Hash SHA-256 hex của mật khẩu bài tập nâng cao (chỉ dùng cho nội dung tự
 * số hóa). So sánh hash thay vì plain text để mật khẩu KHÔNG xuất hiện trong
 * bundle JS — người dùng mở DevTools/grep source chỉ thấy hash hex.
 *
 * LƯU Ý BẢO MẬT: gate ở frontend vẫn bypass được (DevTools, sửa hàm so sánh,
 * gọi thẳng component runner). Hash chỉ ngăn tìm mật khẩu bằng cách đọc
 * source, không phải bảo mật thực sự. Nếu cần bảo mật thật, validate ở server.
 *
 * Cách dùng: tính hash trước rồi đặt vào `.env`:
 *   echo -n "1234" | sha256sum
 *   → 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
 *   VITE_DIGITIZED_EXERCISE_PASS_HASH=03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
 *
 * Không đặt/để trống = trả null → BỎ QUA gate (không hỏi mật khẩu).
 */
export function getDigitizedExercisePassHash(): string | null {
  const env = import.meta.env.VITE_DIGITIZED_EXERCISE_PASS_HASH;
  if (env === undefined || env === '') return null;
  // Chuẩn hoá: lowercase, bỏ khoảng trắng — chấp nhận cả "AB CD..." lẫn "abcd..."
  return env.toLowerCase().replace(/\s+/g, "");
}

/**
 * Base URL cho asset của nội dung tự số hóa (folder 57/, ...). Mặc định rỗng
 * = cùng origin với portal (asset copy vào public/digitized-content/<book>/
 * lúc build, URL runtime là /digitized-content/<book>/assets/...).
 *
 * Set khi muốn serve asset ở domain khác (vd "https://hoclieu.nxbgd.vn"):
 *   VITE_DIGITIZED_CONTENT_BASE_URL=https://hoclieu.nxbgd.vn
 * → assetUrl() trả về URL tuyệt đối, resolveAssetUrl giữ nguyên (đã là
 * http(s)://).
 *
 * KHÔNG đặt trailing slash — loader tự thêm "/".
 */
export function getDigitizedContentBaseUrl(): string {
  const env = import.meta.env.VITE_DIGITIZED_CONTENT_BASE_URL;
  if (env === undefined || env === '') return '';
  return env.replace(/\/+$/, '');
}

/**
 * Cờ chuyển nguồn dữ liệu bài tập nâng cao:
 * - `1` → gọi API `?is_advanced=true` (luồng mới).
 * - mọi giá trị khác (kể cả không set, `0`, `true`, `yes`...) → đọc từ
 *   `public/digitized-content/<bookId>/content.json` (luồng cũ).
 *
 * Mặc định TẮT (false) vì API chưa ổn định ở mọi môi trường — opt-in bằng
 * cách set `VITE_LOADER_ADVANCE_QUESTION_API=1` trong `.env`. Khi API lên
 * đầy đủ thì đổi mặc định thành `true`.
 *
 *   VITE_LOADER_ADVANCE_QUESTION_API=1
 */
export function getLoaderAdvanceQuestionApi(): boolean {
  const env = import.meta.env.VITE_LOADER_ADVANCE_QUESTION_API;
  // Strict: chỉ "1" mới bật. Mọi giá trị khác (kể cả undefined, "", "0",
  // "true", "yes"...) đều tắt — tránh bật nhầm khi env bị set lung tung.
  return env === '1';
}

/**
 * Override base URL riêng cho nhóm endpoint Mastery (`/mastery/...`).
 * Lý do: trong quá trình phát triển màn "Năng lực AI" các endpoint này
 * chạy thử ở `localhost:8080` trong khi toàn bộ LCMS còn lại vẫn trỏ về
 * server nxbgd. Tách hẳn thành 1 biến env để các API khác KHÔNG bị ảnh
 * hưởng; mặc định trỏ về server mastery riêng (`http://10.60.109.46:8012`)
 * thay vì fallback về `getLcmsApiBaseUrl()` — 3 endpoint mastery chạy
 * trên host ĐỘC LẬP với phần còn lại của LCMS.
 */
const LCMS_MASTERY_API_BASE_URL_FALLBACK = 'http://10.60.109.46:8012';

export function getLcmsMasteryApiBaseUrl(): string {
  const runtime = getRuntimeConfigUrl('LCMS_MASTERY_API_BASE_URL');
  if (runtime !== undefined) {
    return normalizeBaseUrl(runtime);
  }
  const env = import.meta.env.VITE_LCMS_MASTERY_API_BASE_URL;
  if (env !== undefined && env !== '') {
    return normalizeBaseUrl(env);
  }
  return normalizeBaseUrl(LCMS_MASTERY_API_BASE_URL_FALLBACK);
}
