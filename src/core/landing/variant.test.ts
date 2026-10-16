import { afterEach, describe, expect, it } from "vitest";
import { getLandingVariant } from "./variant";

// window có sẵn trong môi trường test của repo (như theme); nếu không, stub globalThis.
type Cfg = { LANDING?: string } | undefined;
function setRuntimeConfig(cfg: Cfg) {
  (globalThis as { window?: { __APP_CONFIG__?: Cfg } }).window = {
    __APP_CONFIG__: cfg,
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("getLandingVariant", () => {
  it("mặc định là catalog khi không có config", () => {
    setRuntimeConfig(undefined);
    expect(getLandingVariant()).toBe("catalog");
  });

  it("đọc runtime LANDING=practice (trim + lowercase)", () => {
    setRuntimeConfig({ LANDING: "  Practice " });
    expect(getLandingVariant()).toBe("practice");
  });

  it("giá trị lạ rơi về catalog", () => {
    setRuntimeConfig({ LANDING: "bookstore" });
    expect(getLandingVariant()).toBe("catalog");
  });
});
