/**
 * BRAND — chọn 1 thương hiệu là áp cả cụm: theme, landing, API, logo, title,
 * favicon, cờ khu học sinh, Google Tag. Deploy đặt `BRAND` trong public/config.js
 * (hoặc VITE_BRAND).
 *
 * SỬA GIÁ TRỊ Ở ĐÂU:
 * - Giá trị mỗi brand → SỬA TRỰC TIẾP trong `public/config.js` object `BRANDS`
 *   (runtime, per-deploy). Key con: THEME, LANDING, API_PROVIDER, API_BASE_URL,
 *   CATALOG_API_BASE_URL, LCMS_API_BASE_URL, LCMS_AUTH_BASE_URL,
 *   STUDENT_PAGE_ENABLED, GOOGLE_TAG_ID, TITLE, FAVICON, LOGO, LOGO_2X.
 * - File brand.ts CHỈ giữ BUILT-IN DEFAULT dự phòng (kể cả file asset logo mặc
 *   định) khi config.js không khai báo.
 *
 * Ưu tiên mỗi key: key phẳng TƯỜNG MINH trong config.js runtime > giá trị brand
 * trong `config.js.BRANDS[brand]` > built-in (dưới) > VITE_* build-time > mặc
 * định hệ thống. Field undefined/'' = KHÔNG đặt → rơi xuống tầng dưới.
 */
export type BrandName = 'nxbgd' | 'dehoctot' | 'dehoctot-hcm';

export interface BrandLogo {
  src: string;
  srcSet: string;
  alt: string;
  width?: number;
  height?: number;
}

/** API backend của brand. Mọi field optional — bỏ trống thì dùng config.js/VITE. */
export interface BrandApi {
  /** 'legacy' (API evo-books gốc) hoặc 'lcms' (API NXB LCMS, có adapter). */
  provider?: 'legacy' | 'lcms';
  /** API xác thực/admin/AI (API_BASE_URL). '' hoặc bỏ = same-origin. */
  authBaseUrl?: string;
  /** API catalog công khai (CATALOG_API_BASE_URL). Bỏ = dùng authBaseUrl. */
  catalogBaseUrl?: string;
  /** Gốc API LCMS (LCMS_API_BASE_URL) — chỉ dùng khi provider='lcms'. */
  lcmsBaseUrl?: string;
  /** Gốc auth/security LCMS (LCMS_AUTH_BASE_URL). */
  lcmsAuthBaseUrl?: string;
}

export interface Brand {
  /** Tiêu đề tab + tên thương hiệu (document.title). */
  title: string;
  /** href của `<link rel="icon">`. */
  favicon: string;
  /** UI theme: 'playful' | 'corporate' | 'warm'. Bỏ = 'playful' (hệ thống). */
  theme?: string;
  /** Landing tại '/': 'catalog' | 'practice'. Bỏ = 'catalog' (hệ thống). */
  landing?: string;
  /** Logo header khu đăng nhập. Bỏ → header kiểu cũ mascot + wordmark NXBGDVN. */
  logo?: BrandLogo;
  /** Backend API của brand. */
  api?: BrandApi;
  /** Cờ bật khu học sinh ('true'/'false'). Bỏ = mặc định BẬT. */
  studentPageEnabled?: string;
  /** Google Tag measurement ID. Bỏ = mặc định hệ thống. */
  googleTagId?: string;
}

const DEFAULT_BRAND: BrandName = 'nxbgd';

/** Brand chọn được ngoài mặc định. Giá trị lạ rơi về DEFAULT_BRAND. */
const BRAND_NAMES: readonly BrandName[] = ['dehoctot', 'dehoctot-hcm'];

const DEHOCTOT_LOGO: BrandLogo = {
  src: '/images/logos/logo-dehoctot.webp',
  srcSet:
    '/images/logos/logo-dehoctot.webp 1x, /images/logos/logo-dehoctot@2x.webp 2x',
  alt: 'Để học tốt — vững nền tảng, chắc tương lai',
  width: 247,
  height: 80,
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILT-IN DEFAULT — dự phòng khi public/config.js không khai báo brand đó, và
// là nơi giữ asset logo mặc định (file .webp phải tồn tại trong public/). Giá
// trị THẬT để sửa nằm trong public/config.js → BRANDS[brand].
// ─────────────────────────────────────────────────────────────────────────────
export const BRANDS: Record<BrandName, Brand> = {
  // NXB Giáo dục — header kiểu cũ (mascot + wordmark), mặc định hệ thống.
  nxbgd: {
    title: 'Nhà Xuất bản Giáo dục Việt Nam - Sách bài tập',
    favicon: '/favicon.ico',
    theme: 'playful',
    landing: 'catalog',
    logo: undefined,
    // provider undefined = giữ 'legacy' hệ thống (backward-compat deploy cũ
    // không-BRAND). NXB thật khai lcms + LCMS_* trong config.js.BRANDS.nxbgd.
    api: { provider: undefined },
    studentPageEnabled: undefined,
    googleTagId: undefined,
  },

  // Để học tốt.
  dehoctot: {
    title: 'Để học tốt – vững nền tảng, chắc tương lai',
    favicon: '/favicon-dehoctot.png',
    theme: 'corporate',
    landing: 'practice',
    logo: DEHOCTOT_LOGO,
    api: { provider: 'legacy' },
    studentPageEnabled: undefined,
    googleTagId: undefined,
  },

  // Để học tốt · TP.HCM — như dehoctot, theme warm.
  'dehoctot-hcm': {
    title: 'Để học tốt – vững nền tảng, chắc tương lai',
    favicon: '/favicon-dehoctot.png',
    theme: 'warm',
    landing: 'practice',
    logo: DEHOCTOT_LOGO,
    api: { provider: 'legacy' },
    studentPageEnabled: undefined,
    googleTagId: undefined,
  },
};

/** Các key config con brand có thể đặt mặc định (trùng tên AppRuntimeConfig). */
export type BrandDefaultKey =
  | 'THEME'
  | 'LANDING'
  | 'API_PROVIDER'
  | 'API_BASE_URL'
  | 'CATALOG_API_BASE_URL'
  | 'LCMS_API_BASE_URL'
  | 'LCMS_AUTH_BASE_URL'
  | 'STUDENT_PAGE_ENABLED'
  | 'GOOGLE_TAG_ID';

/** Đọc giá trị runtime config từ `window.__APP_CONFIG__`, trim; '' → undefined. */
function getRuntimeConfigValue(key: 'BRAND'): string | undefined {
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
 * Đọc 1 key trong `public/config.js` → `BRANDS[brand][key]` (chỗ Owner sửa).
 * Trim; '' → undefined (coi như "chưa đặt", rơi built-in).
 */
function getConfigBrandRaw(brand: BrandName, key: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const entry = window.__APP_CONFIG__?.BRANDS?.[brand] as
    | Record<string, string>
    | undefined;
  const value = entry?.[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Brand đang cấu hình. Runtime `BRAND` trước, rồi `VITE_BRAND`; giá trị lạ
 * rơi về 'nxbgd' (cùng kiểu fallback an toàn với getConfiguredTheme).
 */
export function getConfiguredBrand(): BrandName {
  const value = (getRuntimeConfigValue('BRAND') ?? import.meta.env.VITE_BRAND ?? '')
    .trim()
    .toLowerCase();
  return BRAND_NAMES.find((b) => b === value) ?? DEFAULT_BRAND;
}

/** Logo resolve từ config.js (LOGO/LOGO_2X) đè built-in; alt/size lấy built-in. */
function resolveLogo(name: BrandName, base: Brand): BrandLogo | undefined {
  const src = getConfigBrandRaw(name, 'LOGO');
  if (src === undefined) {
    return base.logo;
  }
  const src2x = getConfigBrandRaw(name, 'LOGO_2X');
  return {
    src,
    srcSet: src2x ? `${src} 1x, ${src2x} 2x` : src,
    alt: base.logo?.alt ?? base.title,
    width: base.logo?.width,
    height: base.logo?.height,
  };
}

/**
 * Brand đang cấu hình cho phần NHẬN DIỆN (title/favicon/logo). Ưu tiên giá trị
 * config.js.BRANDS[brand] (TITLE/FAVICON/LOGO) rồi tới built-in.
 */
export function getBrand(): Brand {
  const name = getConfiguredBrand();
  const base = BRANDS[name];
  return {
    ...base,
    title: getConfigBrandRaw(name, 'TITLE') ?? base.title,
    favicon: getConfigBrandRaw(name, 'FAVICON') ?? base.favicon,
    logo: resolveLogo(name, base),
  };
}

/**
 * Mặc định của brand cho một config con — tầng fallback nằm GIỮA key phẳng
 * tường minh (config.js) và VITE/hệ thống. Đọc `config.js.BRANDS[brand][key]`
 * (chỗ Owner sửa) trước, rồi mới đến built-in trong file này.
 */
export function getBrandDefault(key: BrandDefaultKey): string | undefined {
  const name = getConfiguredBrand();
  const fromConfig = getConfigBrandRaw(name, key);
  if (fromConfig !== undefined) {
    return fromConfig;
  }
  const brand = BRANDS[name];
  switch (key) {
    case 'THEME':
      return brand.theme;
    case 'LANDING':
      return brand.landing;
    case 'API_PROVIDER':
      return brand.api?.provider;
    case 'API_BASE_URL':
      return brand.api?.authBaseUrl;
    case 'CATALOG_API_BASE_URL':
      return brand.api?.catalogBaseUrl;
    case 'LCMS_API_BASE_URL':
      return brand.api?.lcmsBaseUrl;
    case 'LCMS_AUTH_BASE_URL':
      return brand.api?.lcmsAuthBaseUrl;
    case 'STUDENT_PAGE_ENABLED':
      return brand.studentPageEnabled;
    case 'GOOGLE_TAG_ID':
      return brand.googleTagId;
    default:
      return undefined;
  }
}

/**
 * Áp title tab + favicon theo brand. An toàn ngoài browser. Phủ kênh build-time
 * VITE_BRAND; kênh runtime đã được inline script index.html áp trước first paint.
 */
export function applyBrand(brand: Brand = getBrand()): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.title = brand.title;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = brand.favicon;
}
