/**
 * Small security helpers backed by the Web Crypto API and simple path checks —
 * the single chokepoints static analysis (Fortify) can recognize.
 */

/**
 * A crypto-strong integer in `[0, maxExclusive)` — a drop-in for
 * `Math.floor(Math.random() * maxExclusive)` that avoids the predictable PRNG
 * `Math.random()` (Fortify: Insecure Randomness). Used for shuffling quiz tiles.
 */
export function secureRandomInt(maxExclusive: number): number {
  const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  return Math.floor(rand * maxExclusive);
}

/**
 * Constrain a navigation target to a same-origin, relative path.
 *
 * Anything that could leave the site — an absolute URL, a `scheme:` prefix, or a
 * protocol-relative `//host` — collapses to `"#"`. Wrap react-router `to=` /
 * `navigate()` targets built from route params or API data (Fortify: Open
 * Redirect). In-app fragments (`"#"`) and rooted paths (`"/..."`) pass through.
 */
export function safeInternalUrl(path: string | null | undefined): string {
  if (!path) return "#";
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return "#"; // has a URL scheme
  if (path.startsWith("//")) return "#"; // protocol-relative
  if (!path.startsWith("/") && !path.startsWith("#")) return "#";
  return path;
}

/**
 * Validate a FULL url before a full-page navigation (`window.location.assign`,
 * `window.open`) whose destination comes from an API response.
 *
 * Returns the url only if its scheme is http(s) AND its host is in the caller's
 * allowlist (exact host or a subdomain of it); otherwise THROWS so the caller
 * aborts instead of sending the user off-site (Fortify: Open Redirect). Note the
 * allowlist is by host only — the LCMS origin is legitimately `http://` and may
 * be an IP:port, so scheme is not pinned to https beyond blocking
 * `javascript:` / `data:` and friends.
 */
export function safeExternalUrl(rawUrl: string, allowedHosts: string[]): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL đích không hợp lệ.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Giao thức URL đích không được phép.");
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = allowedHosts.some((h) => {
    const a = h.toLowerCase();
    return host === a || host.endsWith(`.${a}`);
  });
  if (!allowed) throw new Error("Đích chuyển hướng không được phép.");
  return rawUrl;
}

/**
 * Coerce an API-provided URL to one safe for `window.open` / an `href`: returns
 * it only when it parses as `http(s)`, else `undefined`. Blocks `javascript:` /
 * `data:` scheme injection from response data (payment links, upload URLs).
 */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url);
    if (protocol === "https:" || protocol === "http:") return url;
  } catch {
    // not a valid absolute URL
  }
  return undefined;
}
