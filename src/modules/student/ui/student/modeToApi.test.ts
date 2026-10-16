import { describe, expect, it } from "vitest";
import { modeToApi } from "./modeToApi";

describe("modeToApi", () => {
  it("giữ nguyên 'practice'", () => {
    expect(modeToApi("practice")).toBe("practice");
  });

  it("giữ nguyên 'game'", () => {
    expect(modeToApi("game")).toBe("game");
  });

  it("đổi 'test' thành 'timed'", () => {
    expect(modeToApi("test")).toBe("timed");
  });
});
