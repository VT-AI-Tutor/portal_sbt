import { afterEach, describe, expect, it, vi } from "vitest";
import { trackLandingEvent } from "./analytics";

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("trackLandingEvent", () => {
  it('gọi gtag("event", name, params) khi có gtag', () => {
    const gtag = vi.fn();
    (globalThis as { window?: unknown }).window = { gtag };
    trackLandingEvent("demo_complete", { correct: 4 });
    expect(gtag).toHaveBeenCalledWith("event", "demo_complete", { correct: 4 });
  });
  it("không throw khi thiếu window/gtag (fire-and-forget)", () => {
    expect(() => trackLandingEvent("landing_view")).not.toThrow();
  });
  it("không throw khi có window nhưng thiếu gtag", () => {
    (globalThis as { window?: unknown }).window = {};
    expect(() => trackLandingEvent("landing_view")).not.toThrow();
  });
});
