/**
 * getApiProvider: the renamed API_PROVIDER key must win over the deprecated
 * CATALOG_API_PROVIDER fallback, and anything that is not "lcms" is legacy.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getApiProvider,
  getCatalogApiProvider,
  getLcmsApiBaseUrl,
  getLcmsAuthBaseUrl,
  getLcmsDefaultPassword,
} from "./config";

function stubRuntimeConfig(config: Record<string, string>) {
  vi.stubGlobal("window", { __APP_CONFIG__: config });
}

afterEach(() => vi.unstubAllGlobals());

describe("getApiProvider", () => {
  it("reads the new API_PROVIDER runtime key", () => {
    stubRuntimeConfig({ API_PROVIDER: "lcms" });
    expect(getApiProvider()).toBe("lcms");
  });

  it("falls back to the deprecated CATALOG_API_PROVIDER key", () => {
    stubRuntimeConfig({ CATALOG_API_PROVIDER: "lcms" });
    expect(getApiProvider()).toBe("lcms");
  });

  it("prefers API_PROVIDER when both keys are set", () => {
    stubRuntimeConfig({ API_PROVIDER: "legacy", CATALOG_API_PROVIDER: "lcms" });
    expect(getApiProvider()).toBe("legacy");
  });

  it("normalizes case/whitespace and treats unknown values as legacy", () => {
    stubRuntimeConfig({ API_PROVIDER: "  LCMS  " });
    expect(getApiProvider()).toBe("lcms");
    stubRuntimeConfig({ API_PROVIDER: "something-else" });
    expect(getApiProvider()).toBe("legacy");
  });

  it("defaults to legacy without any config (no window in this env)", () => {
    expect(getApiProvider()).toBe("legacy");
  });

  it("keeps the deprecated getCatalogApiProvider alias working", () => {
    stubRuntimeConfig({ API_PROVIDER: "lcms" });
    expect(getCatalogApiProvider()).toBe("lcms");
  });
});

describe("getLcmsAuthBaseUrl", () => {
  it("reads the dedicated LCMS_AUTH_BASE_URL runtime key", () => {
    stubRuntimeConfig({
      LCMS_API_BASE_URL: "http://10.60.109.46:8080",
      LCMS_AUTH_BASE_URL: "http://security.nxbgd.vn",
    });
    expect(getLcmsAuthBaseUrl()).toBe("http://security.nxbgd.vn");
    // Catalog API stays on its own host — the two are independent.
    expect(getLcmsApiBaseUrl()).toBe("http://10.60.109.46:8080");
  });

  it("strips a trailing slash", () => {
    stubRuntimeConfig({ LCMS_AUTH_BASE_URL: "http://security.nxbgd.vn/" });
    expect(getLcmsAuthBaseUrl()).toBe("http://security.nxbgd.vn");
  });

  it("falls back to the LCMS API base URL when the auth key is unset", () => {
    stubRuntimeConfig({ LCMS_API_BASE_URL: "http://10.60.109.46:8080" });
    expect(getLcmsAuthBaseUrl()).toBe("http://10.60.109.46:8080");
  });
});

describe("getLcmsDefaultPassword", () => {
  it("reads the LCMS_DEFAULT_PASSWORD runtime key", () => {
    stubRuntimeConfig({ LCMS_DEFAULT_PASSWORD: "  custom-pass  " });
    expect(getLcmsDefaultPassword()).toBe("custom-pass");
  });

  it("falls back to the built-in default when unset", () => {
    expect(getLcmsDefaultPassword()).toBe("qazXSW@123");
  });

  it("ignores an empty runtime value and uses the built-in default", () => {
    stubRuntimeConfig({ LCMS_DEFAULT_PASSWORD: "   " });
    expect(getLcmsDefaultPassword()).toBe("qazXSW@123");
  });
});
