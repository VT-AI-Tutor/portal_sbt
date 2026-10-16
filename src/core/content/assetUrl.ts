import {
  getApiProvider,
  getCatalogApiBaseUrl,
  getLcmsApiBaseUrl,
} from "@/core/api/config";

/**
 * Resolve a stored asset URL for the learner view.
 *
 * Absolute URLs are NEVER rewritten — LCMS media-gateway links (sometimes
 * presigned) and any other full URL must be used exactly as stored; the old
 * strip-and-rebase behavior turned them into
 * http://localhost:13070/api/media/…/lcms/assets/… and broke every image.
 *
 * Host-relative paths ("/storage/…") are served by the active backend, so
 * they get the provider's base prepended: LCMS origin under
 * API_PROVIDER=lcms, catalog API base otherwise.
 *
 * Same-origin paths under "/digitized-content/…" (nội dung tự số hóa — folder
 * 57/, ...) are served by the portal itself (assets copied to public/ lúc
 * build), KHÔNG prefix API base — nếu không sẽ thành
 * http://localhost:13070/digitized-content/57/... và 404.
 */
export function resolveAssetUrl(url: string | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  if (!url.startsWith("/")) return url;
  // Same-origin: asset của nội dung tự số hóa đã được copy vào public/ lúc build.
  if (url.startsWith("/digitized-content/")) return url;
  const base =
    getApiProvider() === "lcms" ? getLcmsApiBaseUrl() : getCatalogApiBaseUrl();
  return `${base}${url}`;
}
