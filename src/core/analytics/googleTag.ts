import { getBrandDefault } from '@/core/brand/brand';

/**
 * Resolve the Google Tag measurement ID.
 * Priority: config.js flat key (runtime) → BRAND default (config.js.BRANDS or
 * built-in) → VITE_GOOGLE_TAG_ID (.env at build time) → hardcoded fallback.
 */
function getGoogleTagId(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const runtime = window.__APP_CONFIG__?.GOOGLE_TAG_ID;
  if (typeof runtime === 'string' && runtime.trim() !== '') {
    return runtime.trim();
  }

  const brand = getBrandDefault('GOOGLE_TAG_ID');
  if (brand !== undefined) {
    return brand;
  }

  const env = import.meta.env.VITE_GOOGLE_TAG_ID;
  if (typeof env === 'string' && env.trim() !== '') {
    return env.trim();
  }

  return 'G-GZKQG2Y1W0';
}

/**
 * Called from main.tsx as a fallback for environments where the inline
 * <head> snippet in index.html cannot run (e.g. SSR, tests).
 * In normal browser flow the snippet already set up dataLayer + gtag,
 * so this becomes a no-op thanks to the dataLayer existence check.
 */
export function initGoogleTag(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const tagId = getGoogleTagId();
  if (!tagId) {
    return;
  }

  // If the <head> inline snippet already ran, dataLayer and gtag are present.
  // Only initialize when they are missing (e.g. config.js was not served).
  if (typeof window.gtag === 'function') {
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', tagId);
}

/** Send a page_view hit when the SPA route changes. */
export function trackGoogleTagPageView(pagePath: string): void {
  const tagId = getGoogleTagId();
  if (!tagId || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('config', tagId, { page_path: pagePath });
}
