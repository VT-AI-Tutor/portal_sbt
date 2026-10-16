import { afterEach, describe, expect, it, vi } from "vitest";
import { loadImageViaBlob } from "./loadImage";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string | null = null;
  #src = "";
  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => (value.includes("fail") ? this.onerror?.() : this.onload?.()));
  }
  get src() {
    return this.#src;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("loadImageViaBlob", () => {
  it("loads the remote image directly with credentials", async () => {
    vi.stubGlobal("Image", FakeImage);

    const img = await loadImageViaBlob("https://api.test/uploads/a.png");

    expect(img.src).toBe("https://api.test/uploads/a.png");
    expect(img.crossOrigin).toBe("use-credentials");
  });

  it("throws when the image cannot be decoded", async () => {
    vi.stubGlobal("Image", FakeImage);
    await expect(loadImageViaBlob("https://api.test/fail.png")).rejects.toThrow();
  });
});
