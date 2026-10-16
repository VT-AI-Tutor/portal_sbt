/**
 * Unit tests for the shared hotspot hit-testing util (issues #423 / #435).
 *
 * Semantics under test: circle x/y = center (+ radius ?? 0.05); rect x/y =
 * TOP-LEFT corner (+ width/height) — the whole declared rectangle is hittable.
 * Also mounts the players (jsdom) to assert the marker covers the picked
 * hotspot's declared area.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  findHitHotspot,
  hitTestHotspot,
  hotspotCenter,
  hotspotMarkerBox,
  type HotspotShape,
} from "./hotspot-hit";
import { HotspotSinglePlayer } from "./HotspotSinglePlayer";
import { HotspotMultiPlayer } from "./HotspotMultiPlayer";

describe("hitTestHotspot — circle (x/y is the CENTER)", () => {
  const circle: HotspotShape = { id: "c1", shape: "circle", x: 0.5, y: 0.5, radius: 0.1 };

  it("hits inside the declared radius", () => {
    expect(hitTestHotspot(circle, 0.5, 0.5)).toBe(true);
    expect(hitTestHotspot(circle, 0.5, 0.599)).toBe(true);
  });

  it("misses outside the declared radius", () => {
    expect(hitTestHotspot(circle, 0.5, 0.601)).toBe(false);
    expect(hitTestHotspot(circle, 0.61, 0.5)).toBe(false);
  });

  it("defaults to radius 0.05 when radius is absent", () => {
    const noRadius: HotspotShape = { id: "c2", shape: "circle", x: 0.3, y: 0.3 };
    expect(hitTestHotspot(noRadius, 0.3, 0.349)).toBe(true);
    expect(hitTestHotspot(noRadius, 0.3, 0.351)).toBe(false);
  });

  it("treats a hotspot without shape as a circle (legacy data)", () => {
    const legacy: HotspotShape = { id: "c3", x: 0.2, y: 0.2 };
    expect(hitTestHotspot(legacy, 0.2, 0.24)).toBe(true);
    expect(hitTestHotspot(legacy, 0.2, 0.26)).toBe(false);
  });
});

describe("hitTestHotspot — rect (x/y is the TOP-LEFT corner)", () => {
  // Span: x [0.4 .. 0.6], y [0.45 .. 0.55].
  const rect: HotspotShape = { id: "r1", shape: "rect", x: 0.4, y: 0.45, width: 0.2, height: 0.1 };

  it("hits at the declared top-left corner", () => {
    expect(hitTestHotspot(rect, 0.4, 0.45)).toBe(true);
  });

  it("hits at the visual center of the rectangle", () => {
    expect(hitTestHotspot(rect, 0.5, 0.5)).toBe(true);
  });

  it("hits just inside every edge", () => {
    expect(hitTestHotspot(rect, 0.4 + 0.001, 0.5)).toBe(true); // left
    expect(hitTestHotspot(rect, 0.6 - 0.001, 0.5)).toBe(true); // right
    expect(hitTestHotspot(rect, 0.5, 0.45 + 0.001)).toBe(true); // top
    expect(hitTestHotspot(rect, 0.5, 0.55 - 0.001)).toBe(true); // bottom
  });

  it("hits exactly on the edges (inclusive bounds)", () => {
    // Binary-exact dims so the boundary comparison is free of FP noise.
    const exact: HotspotShape = { id: "r2", shape: "rect", x: 0.25, y: 0.25, width: 0.25, height: 0.25 };
    expect(hitTestHotspot(exact, 0.25, 0.25)).toBe(true); // top-left corner
    expect(hitTestHotspot(exact, 0.5, 0.375)).toBe(true); // right edge (x + w)
    expect(hitTestHotspot(exact, 0.375, 0.5)).toBe(true); // bottom edge (y + h)
    expect(hitTestHotspot(exact, 0.5, 0.5)).toBe(true); // bottom-right corner
  });

  it("misses just outside every edge", () => {
    expect(hitTestHotspot(rect, 0.4 - 0.001, 0.5)).toBe(false); // left of x
    expect(hitTestHotspot(rect, 0.6 + 0.001, 0.5)).toBe(false); // right of x + w
    expect(hitTestHotspot(rect, 0.5, 0.45 - 0.001)).toBe(false); // above y
    expect(hitTestHotspot(rect, 0.5, 0.55 + 0.001)).toBe(false); // below y + h
  });

  it("does NOT hit the old center-anchored region left/above the declared corner", () => {
    // Under the old (buggy) center semantics, (x - w/4, y - h/4) was a hit.
    expect(hitTestHotspot(rect, 0.4 - 0.05, 0.5)).toBe(false);
    expect(hitTestHotspot(rect, 0.5, 0.45 - 0.025)).toBe(false);
  });
});

describe("hitTestHotspot — polygon (ray-cast)", () => {
  // Diamond centered at (0.5, 0.5).
  const diamond: HotspotShape = {
    id: "p1",
    shape: "polygon",
    points: [
      { x: 0.5, y: 0.3 },
      { x: 0.7, y: 0.5 },
      { x: 0.5, y: 0.7 },
      { x: 0.3, y: 0.5 },
    ],
  };

  it("hits inside the polygon", () => {
    expect(hitTestHotspot(diamond, 0.5, 0.5)).toBe(true);
    expect(hitTestHotspot(diamond, 0.55, 0.5)).toBe(true);
  });

  it("misses outside the polygon (including the bounding-box corners)", () => {
    expect(hitTestHotspot(diamond, 0.9, 0.9)).toBe(false);
    // Inside the bounding box but outside the diamond.
    expect(hitTestHotspot(diamond, 0.32, 0.32)).toBe(false);
  });

  it("never hits with fewer than 3 points", () => {
    const degenerate: HotspotShape = {
      id: "p2",
      shape: "polygon",
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.9 },
      ],
    };
    expect(hitTestHotspot(degenerate, 0.5, 0.5)).toBe(false);
    expect(hitTestHotspot({ id: "p3", shape: "polygon" }, 0.5, 0.5)).toBe(false);
  });
});

describe("findHitHotspot", () => {
  it("returns null when the click misses every hotspot", () => {
    const hotspots: HotspotShape[] = [
      { id: "a", x: 0.1, y: 0.1, radius: 0.05 },
      { id: "b", shape: "rect", x: 0.8, y: 0.8, width: 0.1, height: 0.1 },
    ];
    expect(findHitHotspot(hotspots, 0.5, 0.5)).toBeNull();
  });

  it("keeps the nearest-center tie-break for overlapping circles (legacy behavior)", () => {
    const hotspots: HotspotShape[] = [
      { id: "far", x: 0.5, y: 0.5, radius: 0.2 },
      { id: "near", x: 0.56, y: 0.5, radius: 0.2 },
    ];
    // Click at 0.55 is inside both; "near" center (0.56) is closer than "far" (0.5).
    expect(findHitHotspot(hotspots, 0.55, 0.5)?.id).toBe("near");
    // Click at 0.51 flips the winner.
    expect(findHitHotspot(hotspots, 0.51, 0.5)?.id).toBe("far");
  });

  it("tie-breaks across mixed shapes by VISUAL center distance (rect: x + w/2)", () => {
    const hotspots: HotspotShape[] = [
      // Top-left (0.3, 0.3) + 0.4×0.4 → visual center (0.5, 0.5).
      { id: "rect", shape: "rect", x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      { id: "circle", shape: "circle", x: 0.6, y: 0.5, radius: 0.1 },
    ];
    // Inside both; circle center (0.6) is nearer to the click at 0.58.
    expect(findHitHotspot(hotspots, 0.58, 0.5)?.id).toBe("circle");
    // Inside both; rect visual center (0.5) is nearer to the click at 0.52.
    expect(findHitHotspot(hotspots, 0.52, 0.5)?.id).toBe("rect");
  });

  it("preserves the concrete hotspot type of the input array", () => {
    type Rich = HotspotShape & { extra: number };
    const hotspots: Rich[] = [{ id: "a", x: 0.5, y: 0.5, radius: 0.1, extra: 7 }];
    const hit = findHitHotspot(hotspots, 0.5, 0.5);
    expect(hit?.extra).toBe(7);
  });
});

describe("hotspotCenter", () => {
  it("uses declared x/y verbatim for circles and shapeless points", () => {
    expect(hotspotCenter({ id: "a", x: 0.2, y: 0.8 })).toEqual({ x: 0.2, y: 0.8 });
    expect(hotspotCenter({ id: "c", shape: "circle", x: 0.3, y: 0.4, radius: 0.1 })).toEqual({ x: 0.3, y: 0.4 });
  });

  it("returns the visual center for rects (top-left + half size)", () => {
    const c = hotspotCenter({ id: "r", shape: "rect", x: 0.2, y: 0.4, width: 0.2, height: 0.1 });
    expect(c.x).toBeCloseTo(0.3);
    expect(c.y).toBeCloseTo(0.45);
  });

  it("falls back to the polygon vertex centroid", () => {
    const c = hotspotCenter({
      id: "p",
      shape: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    });
    expect(c.x).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.5);
  });
});

describe("regression — b22_q1a h_77 fixture (issue #423)", () => {
  // Top-left semantics: span x [0.1242 .. 0.3378], y [0.3646 .. 0.8646].
  const h77: HotspotShape = {
    id: "h_77",
    label: "77",
    shape: "rect",
    x: 0.1242,
    y: 0.3646,
    width: 0.2136,
    height: 0.5,
  };

  it("clicking the declared top-left corner selects h_77", () => {
    expect(hitTestHotspot(h77, 0.1242, 0.3646)).toBe(true);
    expect(findHitHotspot([h77], 0.1242, 0.3646)?.id).toBe("h_77");
  });

  it("clicking the visual center selects h_77", () => {
    expect(findHitHotspot([h77], 0.1242 + 0.2136 / 2, 0.3646 + 0.25)?.id).toBe("h_77");
  });

  it("clicking just inside the right edge (x + w) still hits", () => {
    expect(hitTestHotspot(h77, 0.1242 + 0.2136 - 0.001, 0.3646)).toBe(true);
  });

  it("clicking just outside the right edge (x + w) misses", () => {
    expect(hitTestHotspot(h77, 0.1242 + 0.2136 + 0.001, 0.3646)).toBe(false);
    expect(findHitHotspot([h77], 0.1242 + 0.2136 + 0.001, 0.3646)).toBeNull();
  });

  it("clicking just outside the bottom edge (y + h) misses", () => {
    expect(hitTestHotspot(h77, 0.1242, 0.3646 + 0.5 + 0.001)).toBe(false);
  });

  it("clicking above the declared y misses (rect does not extend upward)", () => {
    expect(hitTestHotspot(h77, 0.2, 0.3646 - 0.001)).toBe(false);
  });
});

/**
 * b33_q3 fixture (books_verified/13-toan-1-tap-2/data/bai13.json) — four
 * rect hotspots around houses; correctAnswer "nha2". Issue #435: only clicks
 * near the top-left corner used to register.
 */
const B33_Q3_HOTSPOTS: HotspotShape[] = [
  { id: "nha1", shape: "rect", x: 0.6399, y: 0.0133, width: 0.1671, height: 0.1916 },
  { id: "nha2", shape: "rect", x: 0.7502, y: 0.2277, width: 0.1671, height: 0.1904 },
  { id: "nha3", shape: "rect", x: 0.6959, y: 0.4735, width: 0.1671, height: 0.1904 },
  { id: "nha4", shape: "rect", x: 0.7661, y: 0.7446, width: 0.1662, height: 0.1904 },
];

describe("regression — b33_q3 fixture (issue #435)", () => {
  it.each(B33_Q3_HOTSPOTS.map((hs) => [hs.id, hs] as const))(
    "%s: clicks at the corner, middle and bottom of the rect all select it",
    (_id, hs) => {
      const x = hs.x ?? 0;
      const y = hs.y ?? 0;
      const w = hs.width ?? 0;
      const h = hs.height ?? 0;
      // Just inside the top-left corner.
      expect(findHitHotspot(B33_Q3_HOTSPOTS, x + 0.001, y + 0.001)?.id).toBe(hs.id);
      // Middle of the rect.
      expect(findHitHotspot(B33_Q3_HOTSPOTS, x + w / 2, y + h / 2)?.id).toBe(hs.id);
      // Near the bottom edge.
      expect(findHitHotspot(B33_Q3_HOTSPOTS, x + w / 2, y + h - 0.001)?.id).toBe(hs.id);
    },
  );

  it("clicks in the middle and lower part of nha2 select nha2", () => {
    expect(findHitHotspot(B33_Q3_HOTSPOTS, 0.83, 0.32)?.id).toBe("nha2");
    expect(findHitHotspot(B33_Q3_HOTSPOTS, 0.8, 0.4)?.id).toBe("nha2");
  });

  it("clicks outside every hotspot select nothing", () => {
    expect(findHitHotspot(B33_Q3_HOTSPOTS, 0.7, 0.21)).toBeNull(); // between nha1 and nha2
    expect(findHitHotspot(B33_Q3_HOTSPOTS, 0.3, 0.5)).toBeNull(); // far left
    expect(findHitHotspot(B33_Q3_HOTSPOTS, 0.95, 0.05)).toBeNull(); // top right, past nha1
  });

  it("nha1's region near the top image edge (y=0.0133) is clickable", () => {
    // Impossible under center semantics (rect would extend above the image).
    expect(findHitHotspot(B33_Q3_HOTSPOTS, 0.72, 0.02)?.id).toBe("nha1");
    expect(findHitHotspot(B33_Q3_HOTSPOTS, 0.72, 0.19)?.id).toBe("nha1");
  });
});

describe("hotspotMarkerBox — the marker covers the declared area", () => {
  it("a rect spans its top-left corner and declared size", () => {
    const box = hotspotMarkerBox({ id: "r1", shape: "rect", x: 0.4, y: 0.45, width: 0.2, height: 0.1 });
    expect(box).toMatchObject({ left: "40%", top: "45%", width: "20%", height: "10%", x: "0%", y: "0%" });
  });

  it("a circle spans its diameter, anchored on the center", () => {
    const box = hotspotMarkerBox({ id: "c1", shape: "circle", x: 0.5, y: 0.5, radius: 0.1 });
    expect(box).toMatchObject({ left: "50%", top: "50%", width: "20%", aspectRatio: "1 / 1", x: "-50%", y: "-50%" });
  });

  it("a shapeless legacy hotspot falls back to the default radius", () => {
    expect(hotspotMarkerBox({ id: "c2", x: 0.2, y: 0.2 }).width).toBe("10%");
  });

  it("a polygon spans its bounding box and clips to its outline", () => {
    const box = hotspotMarkerBox({
      id: "p1",
      shape: "polygon",
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.2 },
        { x: 0.3, y: 0.6 },
      ],
    });
    expect(box).toMatchObject({ left: "10%", top: "20%", width: "40%", height: "40%" });
    expect(box.clipPath).toBe("polygon(0% 0%, 100% 0%, 50% 100%)");
  });

  it("degenerate geometry falls back to a circle so the pick stays visible", () => {
    const flatRect = hotspotMarkerBox({ id: "r2", shape: "rect", x: 0.3, y: 0.3, width: 0.2, height: 0 });
    expect(flatRect).toMatchObject({ width: "10%", aspectRatio: "1 / 1" });
    const twoPoints = hotspotMarkerBox({
      id: "p2",
      shape: "polygon",
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.4, y: 0.4 },
      ],
    });
    expect(twoPoints).toMatchObject({ left: "25%", top: "25%", aspectRatio: "1 / 1" });
  });
});

// ---------------------------------------------------------------------------
// Player DOM tests — the marker must COVER THE HOTSPOT'S DECLARED AREA.
// ---------------------------------------------------------------------------

describe("hotspot players — marker covers the hotspot area", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  /** Stub the clickable surface to a 100×100 box and click at (rx, ry). */
  const clickAt = (rx: number, ry: number) => {
    const surface = container.querySelector<HTMLDivElement>("div.relative.select-none");
    expect(surface).toBeTruthy();
    surface!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    act(() => {
      surface!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: rx * 100, clientY: ry * 100 }),
      );
    });
  };

  it("Single: marker spans the picked hotspot, answer stays id-only", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        createElement(HotspotSinglePlayer, {
          title: "Chọn ngôi nhà",
          imageUrl: "bai13_t1q3_cho.png",
          hotspots: B33_Q3_HOTSPOTS,
          correctId: "nha2",
          onAnswerChange,
        }),
      );
    });

    // Click the lower-middle part of nha2 — far from its top-left corner.
    clickAt(0.83, 0.38);

    const marker = container.querySelector<HTMLElement>("[data-hotspot-marker]");
    expect(marker?.getAttribute("data-hotspot-marker")).toBe("nha2");
    const nha2 = B33_Q3_HOTSPOTS[1];
    expect(parseFloat(marker!.style.left)).toBeCloseTo((nha2.x ?? 0) * 100);
    expect(parseFloat(marker!.style.top)).toBeCloseTo((nha2.y ?? 0) * 100);
    expect(parseFloat(marker!.style.width)).toBeCloseTo((nha2.width ?? 0) * 100);
    expect(parseFloat(marker!.style.height)).toBeCloseTo((nha2.height ?? 0) * 100);
    expect(onAnswerChange).toHaveBeenLastCalledWith("nha2");
  });

  it("Single: a click outside every hotspot renders no marker and reports nothing", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        createElement(HotspotSinglePlayer, {
          title: "Chọn ngôi nhà",
          imageUrl: "bai13_t1q3_cho.png",
          hotspots: B33_Q3_HOTSPOTS,
          correctId: "nha2",
          onAnswerChange,
        }),
      );
    });

    clickAt(0.3, 0.5);

    expect(container.querySelector("[data-hotspot-marker]")).toBeNull();
    expect(onAnswerChange).not.toHaveBeenCalled();
  });

  it("Multi: every ring spans its own hotspot, clicked or not", () => {
    const onAnswerChange = vi.fn();
    act(() => {
      root.render(
        createElement(HotspotMultiPlayer, {
          title: "Chọn các ngôi nhà",
          imageUrl: "bai13_t1q3_cho.png",
          hotspots: B33_Q3_HOTSPOTS,
          correctIds: ["nha2"],
          instantFeedback: false,
          onAnswerChange,
        }),
      );
    });

    clickAt(0.8, 0.4); // lower part of nha2

    const spans = (id: string, hs: HotspotShape) => {
      const ring = container.querySelector<HTMLElement>(`[data-hotspot-marker="${id}"]`);
      expect(parseFloat(ring!.style.left)).toBeCloseTo((hs.x ?? 0) * 100);
      expect(parseFloat(ring!.style.top)).toBeCloseTo((hs.y ?? 0) * 100);
      expect(parseFloat(ring!.style.width)).toBeCloseTo((hs.width ?? 0) * 100);
      expect(parseFloat(ring!.style.height)).toBeCloseTo((hs.height ?? 0) * 100);
    };

    spans("nha2", B33_Q3_HOTSPOTS[1]);
    expect(onAnswerChange).toHaveBeenLastCalledWith(["nha2"]);
    spans("nha1", B33_Q3_HOTSPOTS[0]);
  });

  /**
   * A circle's left/top is its CENTER, so its marker must be pulled back by
   * half a box. motion.div writes an inline `transform` for the pop animation
   * which (Tailwind v3 routes translate utilities through the same property)
   * clobbers `-translate-x-1/2 -translate-y-1/2` — hence motion's own x/y
   * (#435). Rect/polygon markers anchor on their corner and must NOT shift.
   */
  const CIRCLES: HotspotShape[] = [
    { id: "c1", shape: "circle", x: 0.3, y: 0.4, radius: 0.1 },
    { id: "c2", shape: "circle", x: 0.7, y: 0.6, radius: 0.05 },
  ];
  const expectCentered = (marker: HTMLElement) => {
    expect(marker.style.transform).toContain("translateX(-50%)");
    expect(marker.style.transform).toContain("translateY(-50%)");
  };

  it("Single: a circle marker keeps its center on the hotspot despite the scale animation", () => {
    act(() => {
      root.render(
        createElement(HotspotSinglePlayer, {
          title: "Chọn hình tròn",
          imageUrl: "bai13_t1q3_cho.png",
          hotspots: CIRCLES,
          correctId: "c1",
        }),
      );
    });

    clickAt(0.33, 0.42);

    const marker = container.querySelector<HTMLElement>("[data-hotspot-marker]");
    expectCentered(marker!);
    // Diameter = 2 * radius of the container WIDTH; aspect-ratio keeps it round.
    expect(parseFloat(marker!.style.width)).toBeCloseTo(20);
    expect(marker!.style.aspectRatio).toBe("1 / 1");
  });

  it("Multi: circle rings (idle, selected, toggled-off) stay center-anchored", () => {
    act(() => {
      root.render(
        createElement(HotspotMultiPlayer, {
          title: "Chọn các hình tròn",
          imageUrl: "bai13_t1q3_cho.png",
          hotspots: CIRCLES,
          correctIds: ["c1"],
          instantFeedback: false,
        }),
      );
    });

    for (const hs of CIRCLES) {
      expectCentered(container.querySelector<HTMLElement>(`[data-hotspot-marker="${hs.id}"]`)!);
    }

    clickAt(0.33, 0.42); // select c1 → pop animation writes an inline transform
    expectCentered(container.querySelector<HTMLElement>('[data-hotspot-marker="c1"]')!);

    clickAt(0.27, 0.38); // toggle c1 off — still anchored on the hotspot center
    const c1 = container.querySelector<HTMLElement>('[data-hotspot-marker="c1"]')!;
    expectCentered(c1);
    const c1Center = hotspotCenter(CIRCLES[0]);
    expect(parseFloat(c1.style.left)).toBeCloseTo(c1Center.x * 100);
    expect(parseFloat(c1.style.top)).toBeCloseTo(c1Center.y * 100);
  });

  it("Multi: a polygon ring is clipped to its own outline inside the bounding box", () => {
    const polygon: HotspotShape = {
      id: "p1",
      shape: "polygon",
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.4 },
        { x: 0.2, y: 0.6 },
      ],
    };
    act(() => {
      root.render(
        createElement(HotspotMultiPlayer, {
          title: "Chọn vùng",
          imageUrl: "bai13_t1q3_cho.png",
          hotspots: [polygon],
          correctIds: ["p1"],
          instantFeedback: false,
        }),
      );
    });

    const ring = container.querySelector<HTMLElement>('[data-hotspot-marker="p1"]')!;
    expect(parseFloat(ring.style.left)).toBeCloseTo(20);
    expect(parseFloat(ring.style.top)).toBeCloseTo(20);
    expect(parseFloat(ring.style.width)).toBeCloseTo(40);
    expect(parseFloat(ring.style.height)).toBeCloseTo(40);
    expect(ring.style.clipPath).toBe(hotspotMarkerBox(polygon).clipPath);
    expect(ring.style.clipPath).toContain("polygon(0% 0%, 100% 50%, 0% 100%)");
  });
});

/**
 * Guard: the corpus authors polygon vertices as PAIRS `[[x, y], ...]`, while
 * this module was typed for `[{x, y}, ...]` only. Nothing caught that for a
 * month because every polygon case above feeds object form, and the two player
 * tests that DO feed pair form only assert the edit overlay — which happens to
 * be the one reader that normalized. A pair-form polygon therefore reported a
 * clean miss on every click, indistinguishable from clicking outside it.
 *
 * Real geometry: books_verified/13-toan-1-tap-2/data/bai8.json, `duong_tren`.
 */
describe("hitTestHotspot — pair-form points (corpus JSON)", () => {
  const square = [
    [0.1, 0.1],
    [0.9, 0.1],
    [0.9, 0.9],
    [0.1, 0.9],
  ];

  it("hits a pair-form polygon exactly like its object-form twin", () => {
    const pair = { id: "p", shape: "polygon", points: square } as unknown as HotspotShape;
    const object = {
      id: "o",
      shape: "polygon",
      points: square.map(([x, y]) => ({ x, y })),
    } as HotspotShape;
    expect(hitTestHotspot(pair, 0.5, 0.5)).toBe(true);
    expect(hitTestHotspot(object, 0.5, 0.5)).toBe(true);
    expect(hitTestHotspot(pair, 0.95, 0.5)).toBe(false);
  });

  it("centres a pair-form polygon instead of returning NaN", () => {
    const c = hotspotCenter({ id: "p", shape: "polygon", points: square } as unknown as HotspotShape);
    expect(c.x).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.5);
  });

  it("hit-tests a real pair-form road region", () => {
    const road = {
      id: "duong_tren",
      shape: "polygon",
      points: [
        [0.1802, 0.3705],
        [0.6332, 0.351],
        [0.6332, 0.42],
        [0.1802, 0.44],
      ],
    } as unknown as HotspotShape;
    expect(hitTestHotspot(road, 0.4, 0.39)).toBe(true);
    expect(hitTestHotspot(road, 0.4, 0.2)).toBe(false);
  });
});

describe("hitTestHotspot — line (band of `thickness` around a polyline)", () => {
  const road: HotspotShape = {
    id: "duong_tren",
    shape: "line",
    points: [
      { x: 0.2, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.8, y: 0.8 },
    ],
    thickness: 0.1,
  };

  it("hits on the centreline and within half the thickness of it", () => {
    expect(hitTestHotspot(road, 0.35, 0.5)).toBe(true);
    expect(hitTestHotspot(road, 0.35, 0.54)).toBe(true); // 0.04 < 0.05
  });

  it("misses beyond half the thickness, and past the ends", () => {
    expect(hitTestHotspot(road, 0.35, 0.57)).toBe(false); // 0.07 > 0.05
    expect(hitTestHotspot(road, 0.05, 0.5)).toBe(false); // before the first vertex
  });

  it("follows the bend rather than the straight line between endpoints", () => {
    expect(hitTestHotspot(road, 0.65, 0.65)).toBe(true); // on the bent leg
    expect(hitTestHotspot(road, 0.65, 0.5)).toBe(false); // on the chord, off the path
  });

  it("accepts pair-form vertices too", () => {
    const pair = {
      id: "r",
      shape: "line",
      points: [
        [0.2, 0.5],
        [0.8, 0.5],
      ],
      thickness: 0.1,
    } as unknown as HotspotShape;
    expect(hitTestHotspot(pair, 0.5, 0.52)).toBe(true);
    expect(hitTestHotspot(pair, 0.5, 0.6)).toBe(false);
  });

  it("needs at least 2 vertices, and survives a missing or zero thickness", () => {
    expect(hitTestHotspot({ id: "x", shape: "line", points: [{ x: 0.5, y: 0.5 }] }, 0.5, 0.5)).toBe(false);
    expect(hitTestHotspot({ id: "x", shape: "line" }, 0.5, 0.5)).toBe(false);
    // No thickness / a non-positive one falls back to the default band rather
    // than producing a region no click can ever reach.
    const noThickness: HotspotShape = {
      id: "x",
      shape: "line",
      points: [
        { x: 0.2, y: 0.5 },
        { x: 0.8, y: 0.5 },
      ],
    };
    expect(hitTestHotspot(noThickness, 0.5, 0.51)).toBe(true);
    expect(hitTestHotspot({ ...noThickness, thickness: 0 }, 0.5, 0.51)).toBe(true);
  });

  it("centres a line by ARC LENGTH, not by the middle vertex", () => {
    // Vertices bunched at the start; the midpoint must still land mid-path.
    const c = hotspotCenter({
      id: "r",
      shape: "line",
      points: [
        { x: 0.0, y: 0.5 },
        { x: 0.05, y: 0.5 },
        { x: 1.0, y: 0.5 },
      ],
      thickness: 0.05,
    });
    expect(c.x).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.5);
  });

  it("gives the marker a band-shaped clip covering the stroke", () => {
    const box = hotspotMarkerBox(road);
    expect(box.clipPath).toMatch(/^polygon\(/);
    // Band spans the polyline plus half the thickness on each side.
    expect(parseFloat(box.left)).toBeCloseTo(15, 0);
    expect(parseFloat(box.width)).toBeCloseTo(70, 0);
  });
});
