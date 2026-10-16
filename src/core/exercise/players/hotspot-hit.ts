/**
 * Shared hotspot hit-testing for HotspotSinglePlayer / HotspotMultiPlayer.
 *
 * Coordinate semantics: every value is normalized 0..1 relative to the image.
 * Anchor conventions follow the authored corpus and the ImageColorClassifyPlayer
 * §5.12.1 convention (circle x/y = center; rect x/y = TOP-LEFT corner):
 *   - circle  (default when `shape` is absent): `x`/`y` is the CENTER; hit when
 *     the click is within `radius ?? 0.05` of it.
 *   - rect: `x`/`y` is the TOP-LEFT corner; hit when
 *     x <= rx <= x + width && y <= ry <= y + height.
 *   - polygon: ray-cast point-in-polygon over `points` (needs >= 3 vertices).
 *   - line: band of width `thickness` around the OPEN polyline `points` (needs
 *     >= 2 vertices); hit when the click is within `thickness / 2` of it.
 *
 * `radius` and `thickness` are fractions of container WIDTH (not height), which
 * is why the circle marker below pairs a width with `aspect-ratio: 1 / 1`.
 *
 * `points` accepts BOTH authored forms — the corpus pair form `[[x, y], ...]`
 * and the object form `[{x, y}, ...]`. Reading only one of them is what made
 * every pair-form polygon silently un-clickable: `p.x` on `[0.1, 0.2]` is
 * `undefined`, `undefined > ry` is false for every edge, so the ray-cast counted
 * zero crossings and reported "outside" — indistinguishable from a real miss.
 * Keep `normalizePoints` on every read path; do not narrow the union.
 */

/** A vertex as authored: object form, or the corpus's positional pair. */
export type HotspotPoint = { x: number; y: number } | number[];

export interface HotspotShape {
  id: string;
  label?: string;
  shape?: "circle" | "rect" | "polygon" | "line";
  x?: number; // 0..1 — circle: center; rect: TOP-LEFT corner
  y?: number; // 0..1 — circle: center; rect: TOP-LEFT corner
  radius?: number; // circle: 0..1 of WIDTH, default 0.05
  width?: number; // rect: 0..1
  height?: number; // rect: 0..1
  points?: HotspotPoint[]; // polygon/line vertices, 0..1
  thickness?: number; // line: band width, 0..1 of WIDTH, default 0.04
}

const DEFAULT_RADIUS = 0.05;
const DEFAULT_THICKNESS = 0.04;

/** Accept both `[x, y]` pairs (corpus JSON) and `{x, y}` objects; drop garbage. */
export const normalizePoints = (points: HotspotPoint[] | undefined): Array<{ x: number; y: number }> => {
  const out: Array<{ x: number; y: number }> = [];
  for (const p of points ?? []) {
    if (Array.isArray(p)) {
      if (Number.isFinite(p[0]) && Number.isFinite(p[1])) out.push({ x: p[0], y: p[1] });
    } else if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      out.push({ x: p.x, y: p.y });
    }
  }
  return out;
};

/** Shortest distance from (rx, ry) to an open polyline. */
const distanceToPolyline = (pts: Array<{ x: number; y: number }>, rx: number, ry: number): number => {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len2 = dx * dx + dy * dy;
    // Degenerate segment (repeated vertex) collapses to the point distance.
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((rx - p.x) * dx + (ry - p.y) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(rx - (p.x + t * dx), ry - (p.y + t * dy)));
  }
  return best;
};

/** Ray-cast (even-odd) point-in-polygon test. */
const pointInPolygon = (points: Array<{ x: number; y: number }>, rx: number, ry: number): boolean => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const crosses = (yi > ry) !== (yj > ry) && rx < ((xj - xi) * (ry - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
};

/**
 * Representative VISUAL center of a hotspot — rect: top-left + half the
 * declared size; circle/point: `x`/`y` verbatim; polygon: vertex centroid.
 * Used for the nearest-wins tie-break and by the players as a marker
 * fallback (e.g. reveal-correct-on-lock of unclicked hotspots).
 */
export const hotspotCenter = (hs: HotspotShape): { x: number; y: number } => {
  if (hs.shape === "rect" && typeof hs.x === "number" && typeof hs.y === "number") {
    return { x: hs.x + (hs.width ?? 0) / 2, y: hs.y + (hs.height ?? 0) / 2 };
  }
  if (hs.shape === "line") {
    // Midpoint by ARC LENGTH, not the middle vertex: a road's vertices bunch up
    // on its bends, so the middle vertex sits wherever the tracer was densest.
    const line = normalizePoints(hs.points);
    if (line.length >= 2) {
      const seg = line.slice(1).map((p, i) => Math.hypot(p.x - line[i].x, p.y - line[i].y));
      const half = seg.reduce((a, b) => a + b, 0) / 2;
      let run = 0;
      for (let i = 0; i < seg.length; i++) {
        if (run + seg[i] >= half) {
          const t = seg[i] > 0 ? (half - run) / seg[i] : 0;
          return {
            x: line[i].x + t * (line[i + 1].x - line[i].x),
            y: line[i].y + t * (line[i + 1].y - line[i].y),
          };
        }
        run += seg[i];
      }
      return line[line.length - 1];
    }
  }
  if (typeof hs.x === "number" && typeof hs.y === "number") return { x: hs.x, y: hs.y };
  const pts = normalizePoints(hs.points);
  if (pts.length > 0) {
    let sx = 0;
    let sy = 0;
    for (const p of pts) {
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / pts.length, y: sy / pts.length };
  }
  return { x: 0.5, y: 0.5 };
};

/** Does the normalized click (rx, ry) fall inside the hotspot's declared shape? */
export const hitTestHotspot = (hs: HotspotShape, rx: number, ry: number): boolean => {
  if (hs.shape === "rect") {
    // x/y is the TOP-LEFT corner — hit anywhere over the declared rectangle.
    const x = hs.x ?? 0;
    const y = hs.y ?? 0;
    const w = hs.width ?? 0;
    const h = hs.height ?? 0;
    return rx >= x && rx <= x + w && ry >= y && ry <= y + h;
  }
  if (hs.shape === "polygon") {
    const pts = normalizePoints(hs.points);
    if (pts.length < 3) return false;
    return pointInPolygon(pts, rx, ry);
  }
  if (hs.shape === "line") {
    const pts = normalizePoints(hs.points);
    if (pts.length < 2) return false;
    const thickness = hs.thickness ?? DEFAULT_THICKNESS;
    // A non-positive thickness would make the band unhittable; fall back rather
    // than silently producing a region no click can ever reach.
    const half = (thickness > 0 ? thickness : DEFAULT_THICKNESS) / 2;
    return distanceToPolyline(pts, rx, ry) <= half;
  }
  // circle — also the default when `shape` is absent (legacy data).
  const cx = hs.x ?? 0;
  const cy = hs.y ?? 0;
  return Math.hypot(rx - cx, ry - cy) <= (hs.radius ?? DEFAULT_RADIUS);
};

/**
 * Find the hotspot hit by the click. When several overlap, the one whose
 * center is nearest to the click wins — preserving the historical
 * nearest-wins behavior of the circle-only implementation.
 */
export const findHitHotspot = <T extends HotspotShape>(hotspots: T[], rx: number, ry: number): T | null => {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const hs of hotspots) {
    if (!hitTestHotspot(hs, rx, ry)) continue;
    const c = hotspotCenter(hs);
    const dist = Math.hypot(rx - c.x, ry - c.y);
    if (dist < bestDist) {
      best = hs;
      bestDist = dist;
    }
  }
  return best;
};

/** Percent string without float noise (2 * 0.1 * 100 → "20%" not "20.000…4%"). */
const pct = (v: number) => `${Number((v * 100).toFixed(4))}%`;

/** Points along the half-circle cap at `centre`, sweeping from `from` to `to`. */
const capArc = (
  centre: { x: number; y: number },
  from: number,
  to: number,
  half: number,
  steps = 6,
): Array<{ x: number; y: number }> => {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 1; i < steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push({ x: centre.x + Math.cos(a) * half, y: centre.y + Math.sin(a) * half });
  }
  return out;
};

/**
 * Closed outline of a polyline stroked to `half` on each side: walk one side
 * forward, round the far cap, walk the other side back, round the near cap.
 * Each vertex is offset along the AVERAGE of its adjacent segment normals so
 * bends stay closed (no mitre — at the curvature of a traced road the
 * difference is sub-pixel, and a mitre would spike outward on a hairpin).
 *
 * The caps are ROUND because `distanceToPolyline` clamps its projection to the
 * segment, so the hit area is a capsule. A flat-capped outline would draw a
 * marker that fails to cover clicks the hit-test accepts just past each end.
 */
const strokeOutline = (line: Array<{ x: number; y: number }>, half: number): Array<{ x: number; y: number }> => {
  const normals = line.map((p, i) => {
    const prev = line[i - 1] ?? p;
    const next = line[i + 1] ?? p;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    return len > 0 ? { x: -dy / len, y: dx / len } : { x: 0, y: 0 };
  });
  const left = line.map((p, i) => ({ x: p.x + normals[i].x * half, y: p.y + normals[i].y * half }));
  const right = line.map((p, i) => ({ x: p.x - normals[i].x * half, y: p.y - normals[i].y * half }));
  const last = line.length - 1;
  const angleAt = (i: number) => Math.atan2(normals[i].y, normals[i].x);
  return [
    ...left,
    ...capArc(line[last], angleAt(last), angleAt(last) - Math.PI, half),
    ...right.reverse(),
    // Sweep DOWN from the right side back to the left, so the arc passes
    // through the outward direction; sweeping up would bulge back into the band.
    ...capArc(line[0], angleAt(0) + Math.PI, angleAt(0), half),
  ];
};

/** Where and how big a hotspot's marker is — its declared area, not a fixed dot. */
export interface HotspotMarkerBox {
  left: string;
  top: string;
  width: string;
  height?: string;
  aspectRatio?: string;
  /** Fed to motion's x/y — a circle's left/top is its CENTER, a box's its corner. */
  x: string;
  y: string;
  borderRadius: string;
  clipPath?: string;
}

/**
 * CSS box covering the hotspot's declared area, so the marker drawn after a
 * pick has the size and outline of the region itself. Degenerate rect/polygon
 * geometry falls back to the default circle so a pick is never invisible.
 */
export const hotspotMarkerBox = (
  hs: HotspotShape,
  defaultRadius = DEFAULT_RADIUS,
  defaultThickness = DEFAULT_THICKNESS,
): HotspotMarkerBox => {
  if (hs.shape === "rect") {
    const width = hs.width ?? 0;
    const height = hs.height ?? 0;
    if (width > 0 && height > 0) {
      return {
        left: pct(hs.x ?? 0),
        top: pct(hs.y ?? 0),
        width: pct(width),
        height: pct(height),
        x: "0%",
        y: "0%",
        borderRadius: "0.5rem",
      };
    }
  }

  if (hs.shape === "line") {
    const line = normalizePoints(hs.points);
    const thickness = hs.thickness ?? defaultThickness;
    if (line.length >= 2 && thickness > 0) {
      const band = strokeOutline(line, thickness / 2);
      const minX = Math.min(...band.map((p) => p.x));
      const maxX = Math.max(...band.map((p) => p.x));
      const minY = Math.min(...band.map((p) => p.y));
      const maxY = Math.max(...band.map((p) => p.y));
      const width = maxX - minX;
      const height = maxY - minY;
      if (width > 0 && height > 0) {
        const vertices = band
          .map((p) => `${pct((p.x - minX) / width)} ${pct((p.y - minY) / height)}`)
          .join(", ");
        return {
          left: pct(minX),
          top: pct(minY),
          width: pct(width),
          height: pct(height),
          x: "0%",
          y: "0%",
          borderRadius: "0",
          clipPath: `polygon(${vertices})`,
        };
      }
    }
  }

  if (hs.shape === "polygon") {
    const points = normalizePoints(hs.points);
    if (points.length >= 3) {
      const minX = Math.min(...points.map((p) => p.x));
      const maxX = Math.max(...points.map((p) => p.x));
      const minY = Math.min(...points.map((p) => p.y));
      const maxY = Math.max(...points.map((p) => p.y));
      const width = maxX - minX;
      const height = maxY - minY;
      if (width > 0 && height > 0) {
        const vertices = points
          .map((p) => `${pct((p.x - minX) / width)} ${pct((p.y - minY) / height)}`)
          .join(", ");
        return {
          left: pct(minX),
          top: pct(minY),
          width: pct(width),
          height: pct(height),
          x: "0%",
          y: "0%",
          borderRadius: "0",
          clipPath: `polygon(${vertices})`,
        };
      }
    }
  }

  // circle — also the default when `shape` is absent (legacy data). Radius is a
  // fraction of container WIDTH, so aspect-ratio keeps it round without pixels.
  const center = hotspotCenter(hs);
  return {
    left: pct(center.x),
    top: pct(center.y),
    width: pct(2 * (hs.radius ?? defaultRadius)),
    aspectRatio: "1 / 1",
    x: "-50%",
    y: "-50%",
    borderRadius: "9999px",
  };
};
