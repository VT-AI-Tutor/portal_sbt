/**
 * The embed bridge's stateful bits: the `authExpired` single-flight guard (one
 * event per expiry until a fresh token re-arms it), the no-op-outside-WebView
 * contract, and `onNativeMessage`'s origin gate + window/document dedupe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isEmbedded,
  notifyAuthExpired,
  onNativeMessage,
  postToNative,
  resetAuthExpiredGuard,
} from "./bridge";

/** Stub a page running inside the RN WebView; returns the postMessage spy. */
function stubWebView() {
  const postMessage = vi.fn();
  vi.stubGlobal("window", {
    ReactNativeWebView: { postMessage },
    location: { origin: "https://app.test" },
  });
  return postMessage;
}

/** Stub a plain browser page (no native bridge). */
function stubBrowser() {
  vi.stubGlobal("window", { location: { origin: "https://app.test" } });
}

/** A native→web message event as RN delivers it (empty origin, string data). */
function messageEvent(data: string, origin = "") {
  const event = new Event("message") as Event & {
    data: string;
    origin: string;
  };
  event.data = data;
  event.origin = origin;
  return event;
}

// Explicit clean state per test — the single-flight guard is module-global.
beforeEach(() => resetAuthExpiredGuard());
afterEach(() => {
  vi.unstubAllGlobals();
  resetAuthExpiredGuard();
});

describe("isEmbedded", () => {
  it("is false in a plain browser", () => {
    stubBrowser();
    expect(isEmbedded()).toBe(false);
  });

  it("is true when the RN WebView bridge is present", () => {
    stubWebView();
    expect(isEmbedded()).toBe(true);
  });
});

describe("postToNative", () => {
  it("is a no-op outside the WebView", () => {
    stubBrowser();
    expect(() => postToNative({ type: "ready" })).not.toThrow();
  });

  it("posts a source-tagged JSON payload inside the WebView", () => {
    const postMessage = stubWebView();
    postToNative({ type: "submit", sessionId: "s1", score: 3, maxScore: 5 });
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
      source: "evo-books-embed",
      type: "submit",
      sessionId: "s1",
      score: 3,
      maxScore: 5,
    });
  });

  it("swallows a host postMessage failure so the embed UI never breaks", () => {
    const postMessage = vi.fn(() => {
      throw new Error("host gone");
    });
    vi.stubGlobal("window", {
      ReactNativeWebView: { postMessage },
      location: { origin: "https://app.test" },
    });
    expect(() => postToNative({ type: "ready" })).not.toThrow();
    // The throwing postMessage must actually be reached — otherwise a silent
    // no-op path would also "not throw" and mask a broken send.
    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});

describe("notifyAuthExpired single-flight", () => {
  it("emits at most one authExpired until re-armed", () => {
    const postMessage = stubWebView();
    notifyAuthExpired();
    notifyAuthExpired();
    notifyAuthExpired();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(postMessage.mock.calls[0][0]).type).toBe("authExpired");
  });

  it("fires again after resetAuthExpiredGuard (a fresh token landed)", () => {
    const postMessage = stubWebView();
    notifyAuthExpired();
    resetAuthExpiredGuard();
    notifyAuthExpired();
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it("does not latch the guard when called outside the WebView", () => {
    // Outside the WebView it is a no-op; the guard must NOT be armed, so a
    // later 401 that reaches an actual WebView still fires.
    stubBrowser();
    notifyAuthExpired();
    const postMessage = stubWebView();
    notifyAuthExpired();
    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});

describe("onNativeMessage", () => {
  const AUTH = JSON.stringify({ type: "auth", accessToken: "abc" });

  function stubTargets() {
    const win = Object.assign(new EventTarget(), {
      location: { origin: "https://app.test" },
    });
    const doc = new EventTarget();
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    return { win, doc };
  }

  it("ignores messages from a foreign origin", () => {
    const { win } = stubTargets();
    const handler = vi.fn();
    const off = onNativeMessage(handler);
    win.dispatchEvent(messageEvent(AUTH, "https://evil.test"));
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("accepts an empty-origin native message and parses it", () => {
    const { win } = stubTargets();
    const handler = vi.fn();
    const off = onNativeMessage(handler);
    win.dispatchEvent(messageEvent(AUTH, ""));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toEqual({
      type: "auth",
      accessToken: "abc",
      refreshToken: undefined,
      expiresIn: undefined,
    });
    off();
  });

  it("dedupes one native message dispatched to both window and document", () => {
    const { win, doc } = stubTargets();
    const handler = vi.fn();
    const off = onNativeMessage(handler);
    win.dispatchEvent(messageEvent(AUTH, ""));
    doc.dispatchEvent(messageEvent(AUTH, ""));
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("stops delivering after unsubscribe", () => {
    const { win } = stubTargets();
    const handler = vi.fn();
    onNativeMessage(handler)();
    win.dispatchEvent(messageEvent(AUTH, ""));
    expect(handler).not.toHaveBeenCalled();
  });

  it("re-delivers an identical payload dispatched in a later tick", async () => {
    const { win } = stubTargets();
    const handler = vi.fn();
    const off = onNativeMessage(handler);
    win.dispatchEvent(messageEvent(AUTH, ""));
    await Promise.resolve(); // let the microtask clear the dedupe key
    win.dispatchEvent(messageEvent(AUTH, ""));
    expect(handler).toHaveBeenCalledTimes(2);
    off();
  });

  it("ignores well-formed non-auth, non-JSON, and token-less messages", () => {
    const { win } = stubTargets();
    const handler = vi.fn();
    const off = onNativeMessage(handler);
    win.dispatchEvent(messageEvent(JSON.stringify({ type: "foo" }), ""));
    win.dispatchEvent(messageEvent("definitely not json", ""));
    win.dispatchEvent(messageEvent(JSON.stringify({ type: "auth" }), "")); // no accessToken
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("delivers a valid message arriving only on the document channel", () => {
    const { doc } = stubTargets();
    const handler = vi.fn();
    const off = onNativeMessage(handler);
    doc.dispatchEvent(messageEvent(AUTH, ""));
    expect(handler).toHaveBeenCalledTimes(1); // proves the document listener is wired
    off();
  });

  it("applies the origin gate on the document channel too", () => {
    const { doc } = stubTargets();
    const handler = vi.fn();
    const off = onNativeMessage(handler);
    doc.dispatchEvent(messageEvent(AUTH, "https://evil.test"));
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("unsubscribes the document channel too", () => {
    const { doc } = stubTargets();
    const handler = vi.fn();
    onNativeMessage(handler)();
    doc.dispatchEvent(messageEvent(AUTH, ""));
    expect(handler).not.toHaveBeenCalled();
  });
});
