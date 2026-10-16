/**
 * Establishes the auth session for an `/embed/*` page rendered inside the
 * native WebView (or a plain browser, for testing).
 *
 * Token sources, in priority order:
 *  0. `window.__EMBED_AUTH__` — set by the host via RN
 *     `injectedJavaScriptBeforeContentLoaded` (recommended initial injection;
 *     no token in the URL, no boot-timing handshake).
 *  1. `?token=` (+ optional `?refresh=` / `?expires=`) — browser testing and
 *     simple URL-based native injection.
 *  2. An already-stored session (same-origin browser already logged in).
 *  3. A `postMessage` `{type:'auth'}` from the host — also the live
 *     re-injection path after an `authExpired` event.
 *
 * On live re-injection (a refreshed token arriving after the page is already
 * `ready`), the new token is persisted and all queries are invalidated so
 * fetches that failed on a 401 retry with it.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getStoredSession,
  isAccessTokenValid,
  saveSession,
} from "@/core/auth/storage";
import {
  onNativeMessage,
  postToNative,
  resetAuthExpiredGuard,
  type EmbedAuthMessage,
} from "./bridge";

export type EmbedAuthStatus = "waiting" | "ready" | "error";

/** Fallback access-token lifetime (seconds) when the host omits `expiresIn`. */
const DEFAULT_EXPIRES_IN = 3600;
/** Give up waiting for a token after this long and surface an error state. */
const WAIT_TIMEOUT_MS = 15_000;

function persist(msg: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}): void {
  saveSession(
    {
      access_token: msg.accessToken,
      refresh_token: msg.refreshToken,
      token_type: "Bearer",
      expires_in: msg.expiresIn ?? DEFAULT_EXPIRES_IN,
    },
    "user",
  );
}

export function useEmbedAuth(): EmbedAuthStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<EmbedAuthStatus>("waiting");
  const readyRef = useRef(false);

  useEffect(() => {
    const markReady = () => {
      readyRef.current = true;
      setStatus("ready");
      postToNative({ type: "ready" });
    };

    // 0. Pre-content native injection (highest priority).
    const injected = window.__EMBED_AUTH__;
    if (injected?.accessToken) {
      persist(injected);
    }

    // 1. Query-param token (browser testing / URL-based injection) — lower
    //    priority than the injected token, so only used when none was injected.
    const params = new URLSearchParams(window.location.search);
    const qpToken = params.get("token");
    if (!injected?.accessToken && qpToken) {
      const qpExpires = Number(params.get("expires"));
      persist({
        accessToken: qpToken,
        refreshToken: params.get("refresh") ?? undefined,
        // Missing / non-numeric / non-positive `expires` → fall back to the
        // default lifetime rather than storing a NaN or already-expired stamp.
        expiresIn:
          Number.isFinite(qpExpires) && qpExpires > 0 ? qpExpires : undefined,
      });
    }

    // Scrub credentials from the URL so the bearer token doesn't linger in
    // browser history or leak via the Referer header.
    if (qpToken || params.has("refresh") || params.has("expires")) {
      params.delete("token");
      params.delete("refresh");
      params.delete("expires");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname +
          (query ? `?${query}` : "") +
          window.location.hash,
      );
    }

    // 2. Ready only when we hold a still-valid token (just injected/persisted
    //    above, or a pre-existing same-origin session). An expired stored token
    //    must wait for a fresh (re-)injection rather than firing dead requests.
    const stored = getStoredSession();
    if (stored.accessToken && isAccessTokenValid(stored.expiresAt)) {
      markReady();
    }

    // 3. Listen for native (re-)injection via postMessage.
    const unsubscribe = onNativeMessage((msg: EmbedAuthMessage) => {
      if (msg.type !== "auth") return;
      // Validate BEFORE persisting so an unusable re-injection can't clobber a
      // still-valid stored session and re-open the 401 → authExpired loop. Use
      // the same `?? DEFAULT_EXPIRES_IN` fallback persist() applies, so a literal
      // expiresIn:0 is treated as already-expired rather than defaulted.
      const expiresAt =
        Date.now() + (msg.expiresIn ?? DEFAULT_EXPIRES_IN) * 1000;
      // Number.isFinite mirrors getStoredSession's guard — an overflowed
      // (Infinity) stamp reads back as null there, so reject it here too.
      if (!Number.isFinite(expiresAt) || !isAccessTokenValid(expiresAt)) return;
      persist(msg);
      // Fresh, valid token → the pending refresh completed; re-arm authExpired.
      resetAuthExpiredGuard();
      if (readyRef.current) {
        // Refreshed token mid-session — retry everything that 401'd.
        void queryClient.invalidateQueries();
      } else {
        markReady();
      }
    });

    const timer = window.setTimeout(() => {
      if (!readyRef.current) setStatus("error");
    }, WAIT_TIMEOUT_MS);

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [queryClient]);

  return status;
}
