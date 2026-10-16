// @vitest-environment jsdom
/**
 * #25 — 403 khi tải hồ sơ: /api/security/user/current phải gọi host SECURITY
 * (getLcmsAuthBaseUrl), cùng host /api/security/auth/*; còn /api/system/* (tỉnh)
 * vẫn ở host catalog (getLcmsApiBaseUrl). Ở prod 2 host khác nhau nên gọi sai
 * host gây 403.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/api/config", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/core/api/config")>();
  return {
    ...mod,
    getLcmsApiBaseUrl: () => "http://catalog.example",
    getLcmsAuthBaseUrl: () => "http://security.example",
  };
});

import { lcmsGetCurrentUser, lcmsListProvinces } from "@/core/api/lcmsAdapter";

const env = (data: unknown) => ({ success: true, message: null, data, total: null });

function stubFetch(): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(String(url));
      return new Response(JSON.stringify(env({ id: 1, geoCode: "46", items: [] })), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return urls;
}

afterEach(() => vi.unstubAllGlobals());

describe("routing host hồ sơ (#25)", () => {
  it("current user gọi host SECURITY", async () => {
    const urls = stubFetch();
    await lcmsGetCurrentUser();
    expect(urls[0]).toBe("http://security.example/api/security/user/current");
  });

  it("danh sách tỉnh vẫn gọi host CATALOG", async () => {
    const urls = stubFetch();
    await lcmsListProvinces();
    expect(urls[0]).toBe("http://catalog.example/api/system/geo-location/search");
  });
});
