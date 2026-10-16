/**
 * UI theme selection, resolved from config the same way the API provider is
 * (see {@link file://../api/config.ts getApiProvider}): runtime `config.js`
 * (`window.__APP_CONFIG__.THEME`) takes priority over the build-time
 * `VITE_THEME`, falling back to the default. Switching themes is a pure config
 * change — no code edits — because every design token is a CSS custom property
 * scoped by `[data-theme="..."]` in `styles.css`.
 */
import { getBrandDefault } from '@/core/brand/brand';

export type ThemeName = 'playful' | 'corporate' | 'warm';

const DEFAULT_THEME: ThemeName = 'playful';

/** Selectable non-default themes. Anything else resolves to the default. */
const THEMES: readonly ThemeName[] = ['corporate', 'warm'];

/** Read a runtime config value from `window.__APP_CONFIG__`, trimmed; '' → undefined. */
function getRuntimeConfigValue(key: 'THEME'): string | undefined {
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
 * The configured theme. Priority: runtime `THEME` (per-deploy config.js) >
 * BRAND preset default (BRAND is also chosen in config.js) > build-time
 * `VITE_THEME` baseline > default 'playful'. Brand sits above VITE so that
 * picking a BRAND in config.js brings its theme without also pinning THEME.
 */
export function getConfiguredTheme(): ThemeName {
  const value = (
    getRuntimeConfigValue('THEME') ??
    getBrandDefault('THEME') ??
    import.meta.env.VITE_THEME ??
    ''
  )
    .trim()
    .toLowerCase();
  return THEMES.find((t) => t === value) ?? DEFAULT_THEME;
}

/** Apply the theme by setting `<html data-theme="...">`. Safe outside the browser. */
export function applyTheme(theme: ThemeName = getConfiguredTheme()): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.dataset.theme = theme;
}
