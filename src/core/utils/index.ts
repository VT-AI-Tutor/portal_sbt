/**
 * Shim tương thích cho code port từ evo-books-studio-web (import "@/core/utils").
 * Web resolve media qua resolveAssetUrl (biết API_PROVIDER lcms/catalog) — KHÔNG
 * dùng getApiOrigin kiểu studio. blob:/data:/http(s) pass-through sẵn trong
 * resolveAssetUrl (URL không bắt đầu bằng "/" được trả nguyên vẹn).
 */
export { cn } from "@/core/lib/utils";
import { resolveAssetUrl } from "@/core/content/assetUrl";

/** Turn stored `/uploads/...` paths into a browser-loadable URL. */
export function resolveUploadMediaSrc(fileUrl: string): string {
  return resolveAssetUrl(fileUrl.trim());
}

export function getUploadFileUrl(fileUrl?: string | null): string | null {
  if (!fileUrl?.trim()) return null;
  return resolveUploadMediaSrc(fileUrl);
}
