import { describe, expect, it } from "vitest";
import { resolveColoringConfig } from "./coloring";
import { toRenderableQuestion } from "./adapter";

describe("resolveColoringConfig", () => {
  it("prefers the canonical image block over the flat legacy url", () => {
    expect(
      resolveColoringConfig({
        image: { url: "/uploads/canonical.png", altText: "Lưới" },
        imageUrl: "/uploads/legacy.png",
      }).imageUrl,
    ).toBe("/uploads/canonical.png");

    expect(resolveColoringConfig({ imageUrl: "/uploads/legacy.png" }).imageUrl).toBe(
      "/uploads/legacy.png",
    );
    expect(resolveColoringConfig({}).imageUrl).toBeUndefined();
  });

  it("drops regions the player could not render, and keeps unknown keys", () => {
    const config = resolveColoringConfig({
      regions: [
        { id: "r1", label: "dép" },
        null,
        "r2",
        { label: "thiếu mã" },
        { id: "   " },
        { id: " r3 ", label: "kẹp", shape: { type: "polygon", points: [0, 1] } },
      ],
    });

    expect(config.regions).toEqual([
      { id: "r1", label: "dép" },
      // Geometry the payload already carries survives untouched for PROP-072 / GAP-191.
      { id: "r3", label: "kẹp", shape: { type: "polygon", points: [0, 1] } },
    ]);
  });

  it("keeps only usable palette strings and falls back to undefined", () => {
    expect(resolveColoringConfig({ colors: ["#facc15", 42, null, "  ", "#ef4444"] }).colors).toEqual([
      "#facc15",
      "#ef4444",
    ]);
    // No usable colors → undefined, so ColoringPlayer keeps its default palette
    // instead of rendering an empty picker the student cannot use.
    expect(resolveColoringConfig({ colors: [] }).colors).toBeUndefined();
    expect(resolveColoringConfig({ colors: "#facc15" }).colors).toBeUndefined();
  });

  it("never promotes an answer key — coloring is manual-graded (§5.26)", () => {
    const config = resolveColoringConfig({
      regions: [{ id: "r1" }],
      correctAnswer: { r1: "#facc15" },
    });
    expect(config).not.toHaveProperty("correctAnswer");
  });
});

describe("coloring render model vs player input", () => {
  it("gives the adapter and the player dispatcher the same fillable regions", () => {
    const payload = {
      id: "b56_q1_ep",
      type: "coloring",
      image: { url: "/uploads/canonical.png" },
      imageUrl: "/uploads/legacy.png",
      regions: [{ id: "ep-c1", label: "tem" }, null, { label: "thiếu mã" }],
      colors: ["#facc15", 42],
    };

    const rendered = toRenderableQuestion({ id: "b56_q1_ep", question_type: "coloring", payload });
    const forPlayer = resolveColoringConfig(payload);

    expect(rendered.regions).toEqual(forPlayer.regions);
    expect(rendered.imageUrl).toBe(forPlayer.imageUrl);
    expect(rendered.colors).toEqual(forPlayer.colors);
  });
});
