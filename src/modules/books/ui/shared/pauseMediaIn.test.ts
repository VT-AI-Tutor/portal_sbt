// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { pauseMediaIn } from "./pauseMediaIn";

describe("pauseMediaIn", () => {
  it("dừng mọi audio/video lồng bên trong, kể cả của player", () => {
    const root = document.createElement("div");
    root.innerHTML = "<div><audio></audio><video></video></div>";
    const media = [...root.querySelectorAll<HTMLMediaElement>("audio, video")];
    media.forEach((el) => (el.pause = vi.fn()));

    pauseMediaIn(root);

    media.forEach((el) => expect(el.pause).toHaveBeenCalled());
  });

  it("không có gốc thì không nổ", () => {
    expect(() => pauseMediaIn(null)).not.toThrow();
  });
});
