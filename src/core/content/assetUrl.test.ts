/**
 * resolveAssetUrl: absolute URLs are NEVER rewritten — the old behavior of
 * stripping the host and rebasing onto the catalog API broke LCMS media links
 * (absolute, sometimes presigned) into
 * http://localhost:13070/api/media/media/public/download/lcms/assets/….
 * Only host-relative paths get a base prepended, per API provider.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAssetUrl } from "./assetUrl";

function stubRuntimeConfig(config: Record<string, string>) {
  vi.stubGlobal("window", { __APP_CONFIG__: config });
}

afterEach(() => vi.unstubAllGlobals());

describe("resolveAssetUrl", () => {
  it("legacy: keeps absolute URLs untouched", () => {
    stubRuntimeConfig({
      API_PROVIDER: "legacy",
      CATALOG_API_BASE_URL: "http://legacy.test",
    });
    expect(resolveAssetUrl("http://media-host:9999/storage/img.png")).toBe(
      "http://media-host:9999/storage/img.png",
    );
  });

  it("legacy: prefixes host-relative paths with the catalog base", () => {
    stubRuntimeConfig({
      API_PROVIDER: "legacy",
      CATALOG_API_BASE_URL: "http://legacy.test",
    });
    expect(resolveAssetUrl("/storage/img.png")).toBe(
      "http://legacy.test/storage/img.png",
    );
  });

  it("lcms: keeps absolute URLs untouched (host and query intact)", () => {
    stubRuntimeConfig({
      API_PROVIDER: "lcms",
      LCMS_API_BASE_URL: "http://lcms.test",
      CATALOG_API_BASE_URL: "http://legacy.test",
    });
    const presigned =
      "http://lcms-host:8080/api/media/media/public/download/lcms/assets/images/6712d536.webp?sig=abc";
    expect(resolveAssetUrl(presigned)).toBe(presigned);
  });

  it("lcms: prefixes host-relative paths with the LCMS base, not the legacy one", () => {
    stubRuntimeConfig({
      API_PROVIDER: "lcms",
      LCMS_API_BASE_URL: "http://lcms.test",
      CATALOG_API_BASE_URL: "http://legacy.test",
    });
    expect(
      resolveAssetUrl("/api/media/media/public/download/lcms/assets/i.webp"),
    ).toBe(
      "http://lcms.test/api/media/media/public/download/lcms/assets/i.webp",
    );
  });

  it("returns empty string for missing input", () => {
    expect(resolveAssetUrl(undefined)).toBe("");
    expect(resolveAssetUrl("")).toBe("");
  });

  it("keeps /digitized-content/ paths same-origin (no API base prefix)", () => {
    // Nội dung tự số hóa (folder 57/, ...) copy asset vào public/ lúc build,
    // URL runtime là /digitized-content/<book>/assets/... — cùng origin với
    // portal. KHÔNG được prefix API base, nếu không sẽ 404.
    stubRuntimeConfig({
      API_PROVIDER: "lcms",
      LCMS_API_BASE_URL: "http://lcms.test",
    });
    expect(
      resolveAssetUrl("/digitized-content/57/assets/images/x.png"),
    ).toBe("/digitized-content/57/assets/images/x.png");
  });
});
