import { describe, expect, it } from "vitest";
import { maskScale, normalizedBounds, normalizedHitTest } from "./region-ink-overlay";

describe("normalizedBounds", () => {
  it("boxes a rect from its top-left corner", () => {
    expect(normalizedBounds({ id: "r", shape: "rect", x: 0.1, y: 0.2, width: 0.3, height: 0.4 })).toEqual({
      x0: 0.1,
      y0: 0.2,
      x1: 0.4,
      y1: 0.6000000000000001,
    });
  });

  it("boxes a circle around its centre", () => {
    expect(normalizedBounds({ id: "c", shape: "circle", x: 0.5, y: 0.5, radius: 0.1 })).toEqual({
      x0: 0.4,
      y0: 0.4,
      x1: 0.6,
      y1: 0.6,
    });
  });

  it("boxes a polygon by its vertex extremes, and rejects a malformed one", () => {
    expect(
      normalizedBounds({ id: "p", shape: "polygon", points: [[0.2, 0.1], [0.8, 0.3], [0.5, 0.9]] }),
    ).toEqual({ x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.9 });
    expect(normalizedBounds({ id: "p", shape: "polygon", points: [[0.1, 0.1]] })).toBeNull();
  });
});

describe("normalizedHitTest", () => {
  it("treats circle radius as normalised on BOTH axes, matching regionStyle", () => {
    const hit = normalizedHitTest({ id: "c", shape: "circle", x: 0.5, y: 0.5, radius: 0.1 });
    expect(hit(0.5, 0.5)).toBe(true);
    expect(hit(0.59, 0.5)).toBe(true);
    expect(hit(0.5, 0.59)).toBe(true); // trục dọc cùng bán kính, không bị bóp
    expect(hit(0.62, 0.5)).toBe(false);
  });

  it("hits inside a rect and misses outside", () => {
    const hit = normalizedHitTest({ id: "r", shape: "rect", x: 0.1, y: 0.1, width: 0.2, height: 0.2 });
    expect(hit(0.2, 0.2)).toBe(true);
    expect(hit(0.05, 0.2)).toBe(false);
    expect(hit(0.35, 0.2)).toBe(false);
  });

  it("hits inside a polygon and misses outside", () => {
    const hit = normalizedHitTest({
      id: "p",
      shape: "polygon",
      points: [[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]],
    });
    expect(hit(0.5, 0.3)).toBe(true);
    expect(hit(0.12, 0.8)).toBe(false);
  });

  it("never hits on degenerate geometry", () => {
    expect(normalizedHitTest({ id: "c", shape: "circle", x: 0.5, y: 0.5, radius: 0 })(0.5, 0.5)).toBe(false);
    expect(normalizedHitTest({ id: "p", shape: "polygon", points: [] })(0.5, 0.5)).toBe(false);
  });
});

describe("maskScale", () => {
  it("giữ khổ gốc cho ảnh dưới trần, kể cả ảnh dài mà thấp", () => {
    // Dải sáu quả táo của VBT Tiếng Việt 1 (bài "B b `"): cạnh dài 1146px vượt
    // trần-theo-cạnh cũ, nhưng cả ảnh chỉ 0,22 MP. Thu nhỏ ở đây là làm nhạt nét
    // viền 1px cho tới khi nền loang thủng ruột quả và mặt nạ trả null.
    expect(maskScale(1146, 190)).toBe(1);
    expect(maskScale(800, 800)).toBe(1);
  });

  it("thu ảnh vượt trần về đúng số pixel trần, giữ tỉ lệ", () => {
    const scale = maskScale(1600, 1600);
    expect(scale).toBeCloseTo(0.5, 5);
    expect(Math.round(1600 * scale) * Math.round(1600 * scale)).toBe(800 * 800);
  });

  it("không phóng to ảnh nhỏ và không chia cho 0", () => {
    expect(maskScale(100, 80)).toBe(1);
    expect(maskScale(0, 0)).toBe(1);
  });
});
