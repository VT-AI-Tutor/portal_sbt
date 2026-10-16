/**
 * Landing variant tại `/`. Thứ tự ưu tiên (như getConfiguredTheme): runtime
 * window.__APP_CONFIG__.LANDING (per-deploy) > mặc định của BRAND preset >
 * VITE_LANDING (baseline build-time) > 'catalog'. Brand đứng trên VITE để chọn
 * BRAND trong config.js là đủ, không cần đặt thêm LANDING.
 */
import { getBrandDefault } from "@/core/brand/brand";

export type LandingVariant = "catalog" | "practice";

const DEFAULT_VARIANT: LandingVariant = "catalog";

export function getLandingVariant(): LandingVariant {
  let runtime: string | undefined;
  if (typeof window !== "undefined") {
    const raw = window.__APP_CONFIG__?.LANDING;
    if (typeof raw === "string" && raw.trim() !== "") runtime = raw;
  }
  const value = (
    runtime ??
    getBrandDefault("LANDING") ??
    import.meta.env.VITE_LANDING ??
    ""
  )
    .trim()
    .toLowerCase();
  return value === "practice" ? "practice" : DEFAULT_VARIANT;
}
