/**
 * Tests for the LCMS Google redirect login (partner spec 2026-07-17):
 * step 1 resolves the Google consent URL from GET /auth/login/google in
 * whatever shape the server answers (envelope, bare string, or 302); step 2
 * turns the /google/authen query params into the legacy AuthTokenResponse.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { lcmsCompleteGoogleLogin, lcmsGetGoogleLoginUrl } from "@/core/api/lcmsAdapter";

const GOOGLE_URL = "https://accounts.google.com/o/oauth2/v2/auth?client_id=x";

function stubFetchOnce(response: Response | { type: string; status: number }) {
  const fn = vi.fn(
    async (_url: string, _init?: RequestInit) => response as Response,
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

/** Unsigned JWT with the given payload — enough for client-side decoding. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64url({ alg: "RS256" })}.${b64url(payload)}.sig`;
}

afterEach(() => vi.unstubAllGlobals());

describe("lcmsGetGoogleLoginUrl", () => {
  it("requests login/google with redirectUri and tenantCode", async () => {
    const fetchMock = stubFetchOnce(
      new Response(JSON.stringify({ success: true, data: GOOGLE_URL }), {
        status: 200,
      }),
    );

    await lcmsGetGoogleLoginUrl();

    const requested = String(fetchMock.mock.calls[0]?.[0]);
    expect(requested).toContain("/api/security/auth/login/google?");
    expect(requested).toContain(
      `redirectUri=${encodeURIComponent("/api/security/auth/callback/google")}`,
    );
    expect(requested).toContain("tenantCode=NXB");
  });

  it("resolves the URL from a {success,data} envelope", async () => {
    stubFetchOnce(
      new Response(JSON.stringify({ success: true, data: GOOGLE_URL }), {
        status: 200,
      }),
    );
    await expect(lcmsGetGoogleLoginUrl()).resolves.toBe(GOOGLE_URL);
  });

  it("resolves the URL from a plain-text body", async () => {
    stubFetchOnce(new Response(GOOGLE_URL, { status: 200 }));
    await expect(lcmsGetGoogleLoginUrl()).resolves.toBe(GOOGLE_URL);
  });

  it("returns the endpoint itself when the server redirects (302)", async () => {
    stubFetchOnce({ type: "opaqueredirect", status: 0 });
    await expect(lcmsGetGoogleLoginUrl()).resolves.toContain(
      "/api/security/auth/login/google?",
    );
  });

  it("throws the server message on an error response", async () => {
    stubFetchOnce(
      new Response(
        JSON.stringify({ success: false, message: "tenant not found" }),
        {
          status: 400,
        },
      ),
    );
    await expect(lcmsGetGoogleLoginUrl()).rejects.toThrow("tenant not found");
  });

  it("throws when the body has no URL", async () => {
    stubFetchOnce(
      new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
      }),
    );
    await expect(lcmsGetGoogleLoginUrl()).rejects.toThrow();
  });
});

describe("lcmsCompleteGoogleLogin", () => {
  it("maps callback params to AuthTokenResponse using the JWT exp claim", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = fakeJwt({ username: "hs.nguyenvana", exp });

    const tokens = lcmsCompleteGoogleLogin({
      accessToken,
      refreshToken: "refresh-1",
      sessionId: "session-1",
    });

    expect(tokens.access_token).toBe(accessToken);
    expect(tokens.refresh_token).toBe("refresh-1");
    expect(tokens.session_id).toBe("session-1");
    expect(tokens.expires_in).toBeGreaterThan(3500);
    expect(tokens.expires_in).toBeLessThanOrEqual(3600);
    // Remembered for lcmsRefresh / lcmsFetchMe.
    expect(storage.getItem("evo_lcms_session_id")).toBe("session-1");
    expect(storage.getItem("evo_lcms_identifier")).toBe("hs.nguyenvana");
  });

  it("falls back to 30 minutes when the token is not decodable", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const tokens = lcmsCompleteGoogleLogin({
      accessToken: "opaque-token",
      refreshToken: "refresh-2",
      sessionId: null,
    });
    expect(tokens.expires_in).toBe(1800);
    expect(tokens.session_id).toBeUndefined();
  });
});
