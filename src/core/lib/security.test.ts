import { describe, expect, it } from "vitest";
import { safeInternalUrl, safeExternalUrl, safeHttpUrl, secureRandomInt } from "./security";

describe("safeInternalUrl", () => {
  it("passes through rooted internal paths and fragments", () => {
    expect(safeInternalUrl("/sach-bai-tap/abc/1")).toBe("/sach-bai-tap/abc/1");
    expect(safeInternalUrl("#top")).toBe("#top");
  });

  it("collapses anything that could leave the origin to '#'", () => {
    expect(safeInternalUrl("//evil.com")).toBe("#"); // protocol-relative
    expect(safeInternalUrl("https://evil.com")).toBe("#"); // absolute URL
    expect(safeInternalUrl("javascript:alert(1)")).toBe("#"); // scheme
    expect(safeInternalUrl("mailto:a@b.com")).toBe("#");
    expect(safeInternalUrl("foo/bar")).toBe("#"); // non-rooted
    expect(safeInternalUrl("")).toBe("#");
    expect(safeInternalUrl(null)).toBe("#");
    expect(safeInternalUrl(undefined)).toBe("#");
  });
});

describe("safeExternalUrl", () => {
  const allow = ["security.nxbgd.vn", "google.com"];

  it("allows an allow-listed host and its subdomains", () => {
    expect(safeExternalUrl("https://accounts.google.com/o/oauth2/v2/auth", allow)).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(safeExternalUrl("http://security.nxbgd.vn/api/security/auth/login/google", allow)).toBe(
      "http://security.nxbgd.vn/api/security/auth/login/google",
    );
  });

  it("rejects off-allowlist hosts, lookalikes, and dangerous schemes", () => {
    expect(() => safeExternalUrl("https://evil.com", allow)).toThrow();
    // suffix lookalike must NOT match "google.com"
    expect(() => safeExternalUrl("https://google.com.evil.com", allow)).toThrow();
    expect(() => safeExternalUrl("javascript:alert(1)", allow)).toThrow();
    expect(() => safeExternalUrl("not a url", allow)).toThrow();
  });
});

describe("safeHttpUrl", () => {
  it("returns http(s) URLs unchanged", () => {
    expect(safeHttpUrl("https://pay.example.com/checkout?id=1")).toBe(
      "https://pay.example.com/checkout?id=1",
    );
    expect(safeHttpUrl("http://cdn.example.com/file.pdf")).toBe(
      "http://cdn.example.com/file.pdf",
    );
  });

  it("returns undefined for dangerous schemes, relative, or empty input", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("data:text/html,<script>")).toBeUndefined();
    expect(safeHttpUrl("/relative/path")).toBeUndefined();
    expect(safeHttpUrl("")).toBeUndefined();
    expect(safeHttpUrl(null)).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });
});

describe("secureRandomInt", () => {
  it("returns an integer in [0, maxExclusive) for the shuffle's inputs", () => {
    // Fisher-Yates only ever calls it with i + 1 (>= 2).
    for (const n of [1, 2, 5, 52, 1000]) {
      for (let i = 0; i < 200; i++) {
        const v = secureRandomInt(n);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(n);
      }
    }
  });
});
