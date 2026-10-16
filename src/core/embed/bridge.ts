/**
 * WebView embed bridge — the `postMessage` contract between the
 * `evo-books-web` `/embed/*` pages (running inside a React Native WebView) and
 * the native host (`evo-books-mobile`).
 *
 * Native → web: the host injects the auth session and can re-inject a
 * refreshed token (see `useEmbedAuth`).
 * Web → native: the embed emits lifecycle events the host reacts to — the
 * WebView stays open on `submit` (the result screen renders in-WebView) and is
 * closed/routed on a result-screen `navigate`; `authExpired` triggers a token
 * refresh, etc.
 *
 * Every web→native call is a no-op when NOT running inside a WebView
 * (`window.ReactNativeWebView` absent), so `postToNative` is safe to call from
 * shared code paths (API clients, the practice runner) that also run in the
 * normal browser app.
 */

/** Tags outbound messages so the native side can filter foreign traffic. */
export const EMBED_MESSAGE_SOURCE = "evo-books-embed";

/** Native screens the host can be told to open from the result-screen CTAs. */
export type EmbedNavTarget = "practice" | "competency";

/** Events the embed emits to the native host. */
export type EmbedOutboundEvent =
  | { type: "ready" }
  | { type: "progress"; current: number; total: number }
  | { type: "autosave" }
  | { type: "submit"; sessionId: string; score: number; maxScore: number }
  /**
   * Post-result CTA: the host should close the WebView and route to the given
   * native screen — `practice` = back to the practice home, `competency` = the
   * competency screen. The web fires this instead of navigating in-app because
   * the `/student/*` routes have no chrome-less embed equivalent.
   */
  | { type: "navigate"; target: EmbedNavTarget }
  | { type: "authExpired" }
  | { type: "error"; message: string };

/** Auth session the native host pushes into the embed. `expiresIn` is seconds. */
export interface EmbedAuthMessage {
  type: "auth";
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export type EmbedInboundMessage = EmbedAuthMessage;

function getWebView(): { postMessage: (message: string) => void } | undefined {
  if (typeof window === "undefined") return undefined;
  return window.ReactNativeWebView;
}

/** True when the page is running inside the native WebView host. */
export function isEmbedded(): boolean {
  return getWebView() !== undefined;
}

/** Emit a lifecycle event to the native host. No-op outside the WebView. */
export function postToNative(event: EmbedOutboundEvent): void {
  const webView = getWebView();
  if (!webView) return;
  try {
    webView.postMessage(
      JSON.stringify({ source: EMBED_MESSAGE_SOURCE, ...event }),
    );
  } catch {
    // A serialization/host failure must never break the embed UI.
  }
}

/**
 * `authExpired` fires from every 401 across parallel requests and retries, so a
 * single token expiry would otherwise fan out into a burst of refreshes on the
 * host — and loop if the refreshed token still 401s. Emit at most one
 * `authExpired` until a fresh token is (re-)injected: `useEmbedAuth` calls
 * {@link resetAuthExpiredGuard} when new auth arrives, re-arming the next expiry.
 */
let awaitingReauth = false;

/** Signal the host that auth expired — deduped to one in-flight refresh. */
export function notifyAuthExpired(): void {
  // Only latch when actually embedded — outside the WebView postToNative is a
  // no-op, so arming the guard there would strand it `true` for the page's life.
  if (awaitingReauth || !isEmbedded()) return;
  awaitingReauth = true;
  postToNative({ type: "authExpired" });
}

/** Re-arm {@link notifyAuthExpired} after a fresh token lands. */
export function resetAuthExpiredGuard(): void {
  awaitingReauth = false;
}

function parseInbound(data: unknown): EmbedInboundMessage | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data) as Partial<EmbedAuthMessage> & {
      type?: string;
    };
    if (parsed?.type === "auth" && typeof parsed.accessToken === "string") {
      return {
        type: "auth",
        accessToken: parsed.accessToken,
        refreshToken:
          typeof parsed.refreshToken === "string"
            ? parsed.refreshToken
            : undefined,
        expiresIn:
          typeof parsed.expiresIn === "number" ? parsed.expiresIn : undefined,
      };
    }
  } catch {
    // Ignore non-JSON / foreign postMessage traffic.
  }
  return null;
}

/**
 * Subscribe to messages from the native host. RN's injected JS dispatches to
 * `window` (iOS + modern Android); older Android RN used `document`, so we
 * listen on both. Returns an unsubscribe fn.
 */
export function onNativeMessage(
  handler: (msg: EmbedInboundMessage) => void,
): () => void {
  // Because we listen on both window and document (see below), a host that
  // dispatches a message to both would invoke the handler twice for one native
  // message; dedupe on the raw payload within the same tick.
  let lastData: string | null = null;
  const listener = (event: Event) => {
    const messageEvent = event as MessageEvent;
    // Reject cross-origin injection: allow same-origin and the empty-origin
    // native channel (RN WebView messages carry no web origin), block others.
    if (messageEvent.origin && messageEvent.origin !== window.location.origin) {
      return;
    }
    const data = messageEvent.data;
    if (typeof data === "string") {
      if (data === lastData) return; // window+document double-dispatch
      lastData = data;
      queueMicrotask(() => {
        if (lastData === data) lastData = null;
      });
    }
    const msg = parseInbound(data);
    if (msg) handler(msg);
  };
  window.addEventListener("message", listener);
  document.addEventListener("message", listener as EventListener);
  return () => {
    window.removeEventListener("message", listener);
    document.removeEventListener("message", listener as EventListener);
  };
}
