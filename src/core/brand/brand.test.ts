import { afterEach, describe, expect, it } from 'vitest';
import { BRANDS, getBrand, getBrandDefault, getConfiguredBrand } from './brand';
import { getConfiguredTheme } from '@/core/theme/theme';
import { getLandingVariant } from '@/core/landing/variant';

// window có sẵn trong môi trường test của repo (như theme/variant); stub globalThis.
type Cfg =
  | {
      BRAND?: string;
      THEME?: string;
      LANDING?: string;
      GOOGLE_TAG_ID?: string;
      STUDENT_PAGE_ENABLED?: string;
      BRANDS?: Record<string, Record<string, string>>;
    }
  | undefined;
function setRuntimeConfig(cfg: Cfg) {
  (globalThis as { window?: { __APP_CONFIG__?: Cfg } }).window = {
    __APP_CONFIG__: cfg,
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('getConfiguredBrand', () => {
  it('mặc định là nxbgd khi không có config', () => {
    setRuntimeConfig(undefined);
    expect(getConfiguredBrand()).toBe('nxbgd');
  });

  it('đọc runtime BRAND=dehoctot (trim + lowercase)', () => {
    setRuntimeConfig({ BRAND: '  Dehoctot ' });
    expect(getConfiguredBrand()).toBe('dehoctot');
  });

  it('đọc runtime BRAND=dehoctot-hcm', () => {
    setRuntimeConfig({ BRAND: 'DEHOCTOT-HCM' });
    expect(getConfiguredBrand()).toBe('dehoctot-hcm');
  });

  it('giá trị lạ rơi về nxbgd', () => {
    setRuntimeConfig({ BRAND: 'evobooks' });
    expect(getConfiguredBrand()).toBe('nxbgd');
  });
});

describe('BRANDS registry', () => {
  it('mỗi brand có đủ title + favicon', () => {
    for (const brand of Object.values(BRANDS)) {
      expect(brand.title).not.toBe('');
      expect(brand.favicon).toMatch(/^\//);
    }
  });

  it('dehoctot và dehoctot-hcm dùng chung logo; nxbgd không có logo (wordmark cũ)', () => {
    expect(BRANDS.dehoctot.logo).toBeDefined();
    expect(BRANDS['dehoctot-hcm'].logo).toEqual(BRANDS.dehoctot.logo);
    expect(BRANDS.nxbgd.logo).toBeUndefined();
  });
});

describe('brand preset — tầng fallback giữa config tường minh và mặc định hệ thống', () => {
  it('BRAND=dehoctot kéo theo theme corporate + landing practice', () => {
    setRuntimeConfig({ BRAND: 'dehoctot' });
    expect(getConfiguredTheme()).toBe('corporate');
    expect(getLandingVariant()).toBe('practice');
  });

  it('BRAND=dehoctot-hcm chỉ khác theme: warm', () => {
    setRuntimeConfig({ BRAND: 'dehoctot-hcm' });
    expect(getConfiguredTheme()).toBe('warm');
    expect(getLandingVariant()).toBe('practice');
    expect(getBrand().title).toBe(BRANDS.dehoctot.title);
  });

  it('key phẳng tường minh thắng cả brand', () => {
    setRuntimeConfig({ BRAND: 'dehoctot', THEME: 'warm', LANDING: 'catalog' });
    expect(getConfiguredTheme()).toBe('warm');
    expect(getLandingVariant()).toBe('catalog');
  });

  it('config.js.BRANDS[brand] override giá trị built-in (Owner sửa ở config.js)', () => {
    setRuntimeConfig({
      BRAND: 'dehoctot',
      BRANDS: { dehoctot: { THEME: 'warm', LANDING: 'catalog' } },
    });
    expect(getConfiguredTheme()).toBe('warm');
    expect(getLandingVariant()).toBe('catalog');
    expect(getBrandDefault('THEME')).toBe('warm');
  });

  it('key phẳng tường minh còn thắng cả config.js.BRANDS[brand]', () => {
    setRuntimeConfig({
      BRAND: 'dehoctot',
      THEME: 'playful',
      BRANDS: { dehoctot: { THEME: 'warm' } },
    });
    expect(getConfiguredTheme()).toBe('playful');
  });

  it('BRANDS[brand] để trống → rơi về built-in của brand', () => {
    setRuntimeConfig({ BRAND: 'dehoctot', BRANDS: { dehoctot: { THEME: '' } } });
    expect(getConfiguredTheme()).toBe('corporate');
  });

  it('đọc API provider từ config.js.BRANDS', () => {
    setRuntimeConfig({
      BRAND: 'nxbgd',
      BRANDS: { nxbgd: { API_PROVIDER: 'lcms' } },
    });
    expect(getBrandDefault('API_PROVIDER')).toBe('lcms');
  });

  it('STUDENT_PAGE_ENABLED + GOOGLE_TAG_ID ăn theo brand (config.js.BRANDS)', () => {
    setRuntimeConfig({
      BRAND: 'dehoctot',
      BRANDS: {
        dehoctot: { STUDENT_PAGE_ENABLED: 'false', GOOGLE_TAG_ID: 'G-DEHOCTOT' },
      },
    });
    expect(getBrandDefault('STUDENT_PAGE_ENABLED')).toBe('false');
    expect(getBrandDefault('GOOGLE_TAG_ID')).toBe('G-DEHOCTOT');
  });

  it('TITLE + FAVICON ăn theo brand (getBrand đọc config.js.BRANDS)', () => {
    setRuntimeConfig({
      BRAND: 'dehoctot',
      BRANDS: { dehoctot: { TITLE: 'Thương hiệu X', FAVICON: '/x.png' } },
    });
    expect(getBrand().title).toBe('Thương hiệu X');
    expect(getBrand().favicon).toBe('/x.png');
  });

  it('LOGO + LOGO_2X ăn theo brand → srcSet dựng từ config.js', () => {
    setRuntimeConfig({
      BRAND: 'nxbgd',
      BRANDS: { nxbgd: { LOGO: '/a.webp', LOGO_2X: '/a@2x.webp' } },
    });
    const logo = getBrand().logo;
    expect(logo?.src).toBe('/a.webp');
    expect(logo?.srcSet).toBe('/a.webp 1x, /a@2x.webp 2x');
  });

  it('BRANDS[brand] để trống TITLE → rơi về built-in', () => {
    setRuntimeConfig({ BRAND: 'dehoctot', BRANDS: { dehoctot: { TITLE: '' } } });
    expect(getBrand().title).toBe(BRANDS.dehoctot.title);
  });

  it('không BRAND → brand nxbgd, theme playful + landing catalog (như hệ thống)', () => {
    setRuntimeConfig(undefined);
    expect(getConfiguredTheme()).toBe('playful');
    expect(getLandingVariant()).toBe('catalog');
    // nxbgd khai báo tường minh trong registry (self-documenting), khớp default hệ thống.
    expect(getBrandDefault('THEME')).toBe('playful');
    expect(getBrandDefault('LANDING')).toBe('catalog');
  });

  it('mỗi brand có khối api trong registry — một chỗ nhìn thấy backend', () => {
    for (const brand of Object.values(BRANDS)) {
      expect(brand.api).toBeDefined();
    }
    // dehoctot/hcm khai báo legacy tường minh; nxbgd để undefined (giữ default
    // hệ thống 'legacy', xem comment backward-compat trong brand.ts).
    expect(BRANDS.dehoctot.api?.provider).toBe('legacy');
    expect(BRANDS['dehoctot-hcm'].api?.provider).toBe('legacy');
    expect(BRANDS.nxbgd.api?.provider).toBeUndefined();
  });
});
