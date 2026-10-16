/**
 * Khai báo global DÙNG CHUNG cho mọi app trong monorepo.
 *
 * Trước đây khối này nằm trong `apps/learner/src/vite-env.d.ts`, nhưng chính
 * `packages/core` mới là nơi đọc `window.__APP_CONFIG__`, `gtag`, `dataLayer`
 * và `import.meta.env.VITE_*`. Hệ quả: learner typecheck sạch còn admin đỏ 24
 * lỗi trên cùng một dòng code core — chỉ vì admin không nạp file khai báo của
 * learner. Đặt ở đây thì app nào include `packages/core/src` cũng thấy.
 */

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Authenticated LMS API origin (no trailing slash). Empty = same origin. */
  readonly VITE_API_BASE_URL?: string;
  /** Public catalog API origin. Falls back to VITE_API_BASE_URL when unset. */
  readonly VITE_CATALOG_API_BASE_URL?: string;
  /** API provider: 'legacy' (default) or 'lcms'. Overridden by config.js when set. */
  readonly VITE_API_PROVIDER?: string;
  /** @deprecated Old name of VITE_API_PROVIDER; still read as fallback. */
  readonly VITE_CATALOG_API_PROVIDER?: string;
  /** LCMS API origin. Falls back to VITE_CATALOG_API_BASE_URL when unset. */
  readonly VITE_LCMS_API_BASE_URL?: string;

  readonly VITE_LCMS_MASTERY_API_BASE_URL?: string;
  /** LCMS auth/security origin (login, refresh, Google). Falls back to VITE_LCMS_API_BASE_URL. */
  readonly VITE_LCMS_AUTH_BASE_URL?: string;
  /** Mật khẩu mặc định LCMS (điền sẵn ở modal đổi MK lần đầu). Overridden by config.js. */
  readonly VITE_LCMS_DEFAULT_PASSWORD?: string;
  /** Mật khẩu bài tập 4 số (gate trước khi làm bài, chỉ hệ LCMS). Chỉ đặt qua .env; không đặt = tắt gate. */
  readonly VITE_EXERCISE_PASS?: string;
  /** Google Tag measurement ID (e.g. G-XXXXXXXX). Overridden by config.js when set. */
  readonly VITE_GOOGLE_TAG_ID?: string;
  /** UI theme: 'playful' (default), 'corporate', or 'warm'. Overridden by config.js when set. */
  readonly VITE_THEME?: string;
  /** Landing tại '/': 'catalog' (mặc định) hoặc 'practice' (landing luyện tập). */
  readonly VITE_LANDING?: string;
  /** Brand (logo header + title tab + favicon): 'nxbgd' (mặc định) hoặc 'dehoctot'. */
  readonly VITE_BRAND?: string;
  /** Bật/tắt khu học sinh (`/student`). Mặc định bật; 'false'/'0'/'off'/'no' để tắt. */
  readonly VITE_STUDENT_PAGE_ENABLED?: string;
  /** Nguồn dữ liệu bài tập nâng cao: '1' = API `?is_advanced=true`, khác (mặc định) = JSON cũ. */
  readonly VITE_LOADER_ADVANCE_QUESTION_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Values from `public/config.js`, loaded in `index.html` before the app bundle. */
interface AppRuntimeConfig {
  API_BASE_URL?: string;
  CATALOG_API_BASE_URL?: string;
  /** API provider: 'legacy' (default) or 'lcms'. */
  API_PROVIDER?: string;
  /** @deprecated Old name of API_PROVIDER; still read as fallback. */
  CATALOG_API_PROVIDER?: string;
  /** LCMS API origin. Falls back to CATALOG_API_BASE_URL when unset. */
  LCMS_API_BASE_URL?: string;

  LCMS_MASTERY_API_BASE_URL?: string;
  /** LCMS auth/security origin (login, refresh, Google). Falls back to LCMS_API_BASE_URL. */
  LCMS_AUTH_BASE_URL?: string;
  /** Mật khẩu mặc định LCMS (điền sẵn ở modal đổi MK lần đầu). Bỏ trống = built-in. */
  LCMS_DEFAULT_PASSWORD?: string;
  /** Google Tag measurement ID (e.g. G-XXXXXXXX). Leave empty to disable. */
  GOOGLE_TAG_ID?: string;
  /** UI theme: 'playful' (default), 'corporate', or 'warm'. */
  THEME?: string;
  /** Landing tại '/': 'catalog' (mặc định) hoặc 'practice' (landing luyện tập). */
  LANDING?: string;
  /** Brand đang chọn: 'nxbgd' (mặc định) | 'dehoctot' | 'dehoctot-hcm'. */
  BRAND?: string;
  /**
   * Giá trị tunable từng brand — SỬA TRỰC TIẾP ở đây. Key con trùng tên với các
   * key phẳng (THEME/LANDING/API_*). Brand đang chọn (BRAND) sẽ đọc từ đây;
   * key phẳng tường minh ở trên vẫn đè lên nếu đặt. Bỏ trống/'' = dùng built-in.
   */
  BRANDS?: Record<
    string,
    Partial<
      Record<
        | 'THEME'
        | 'LANDING'
        | 'API_PROVIDER'
        | 'API_BASE_URL'
        | 'CATALOG_API_BASE_URL'
        | 'LCMS_API_BASE_URL'
        | 'LCMS_AUTH_BASE_URL'
        | 'STUDENT_PAGE_ENABLED'
        | 'GOOGLE_TAG_ID'
        | 'TITLE'
        | 'FAVICON'
        | 'LOGO'
        | 'LOGO_2X',
        string
      >
    >
  >;
  /** Bật/tắt khu học sinh (`/student`). Mặc định bật; 'false'/'0'/'off'/'no' để tắt. */
  STUDENT_PAGE_ENABLED?: string;
}

interface Window {
  __APP_CONFIG__?: AppRuntimeConfig;
  /** Auth session injected by the native WebView host before content loads (embed pages). */
  __EMBED_AUTH__?: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  /** Present only inside a React Native WebView — the bridge to the native host. */
  ReactNativeWebView?: { postMessage: (message: string) => void };
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}
