/**
 * Edit-mode geometry overlay shared by HotspotSinglePlayer, HotspotMultiPlayer
 * and SpotDifferencePlayer.
 *
 * These players' shapes are invisible at rest (pure hit-test targets). In the
 * studio edit preview — when a FieldGeometryController with `onGeometry` is in
 * scope — this overlay renders every shape as a dashed outline so the editor
 * can see and drag it. It renders null everywhere else, so student surfaces
 * are untouched.
 *
 * Coordinate semantics follow hotspot hit-testing (hotspot-hit.ts, spec §5.13
 * amendment): all values normalized 0..1 of the image box; circle `x`/`y` is
 * the CENTER, rect `x`/`y` is the TOP-LEFT corner (rect hit-test is
 * x <= rx <= x + width && y <= ry <= y + height). Outlines are anchored
 * exactly the same way so they cover the real hit zones, and rect drags emit
 * the TOP-LEFT so the geometry mapper stores what the hit-test reads.
 * Radius is a fraction of the
 * container WIDTH, so a circle's diameter is `radius * 200%` of the container
 * width with `aspect-ratio: 1/1` keeping it a true circle — no pixel
 * measurement needed (percent height would squash it instead).
 *
 * Two entries may carry the SAME `id` — that is real, gradable data (two rects
 * covering the two segments of one road both report that one answer id). Boxes
 * are therefore identified POSITIONALLY here: React keys and the per-box
 * RefObjects go by array index, and a duplicated id is reported across the
 * controller boundary as `id#<index>` so the write lands on the box being
 * dragged. `data-edit-outline` / `data-edit-shape` / `data-edit-polygon` always
 * carry the RAW id; the handles' own attributes (`data-move-area`, …) carry the
 * reported one, so twins stay individually addressable.
 *
 * Polygon shapes get a dashed SVG outline plus a bounding-box move grip only —
 * vertex editing is out of scope; a move emits the new bbox CENTER and the
 * geometry mapper translates every vertex by the delta.
 */
import React, { useRef } from "react";
import {
  MoveArea,
  RadiusHandle,
  ResizeHandle,
  useFieldResize,
} from "@/core/exercise/field-resize-context";
import { withFieldOccurrence } from "@/core/exercise/field-scope";
import { normalizePoints, type HotspotPoint } from "./hotspot-hit";

/**
 * Superset of the hotspot / spot-difference geometry entries. Polygon and line
 * points tolerate both the corpus pair form `[[x, y], ...]` and the object form
 * `[{x, y}, ...]` — see `normalizePoints` in `hotspot-hit.ts`, which this shares
 * so the overlay and the hit-test can never disagree about what a vertex is.
 */
export interface EditableHotspotShape {
  id: string;
  label?: string;
  shape?: "circle" | "rect" | "polygon" | "line";
  x?: number; // 0..1 — circle: CENTER; rect: TOP-LEFT corner
  y?: number; // 0..1 — circle: CENTER; rect: TOP-LEFT corner
  radius?: number; // circle: 0..1 of container width
  width?: number; // rect: 0..1
  height?: number; // rect: 0..1
  points?: HotspotPoint[]; // polygon/line vertices, 0..1
  thickness?: number; // line: band width, 0..1 of container width
}

export interface HotspotEditOverlayProps {
  shapes: EditableHotspotShape[];
  /** The positioned wrapper whose box maps x/y to 0..1 (the image container). */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Fallback circle radius (hotspot: 0.05, spot_difference: 0.06). */
  defaultRadius?: number;
}

/** Percent string without float noise (2 * 0.1 * 100 → "20%" not "20.000…4%"). */
const pct = (v: number) => `${Number((v * 100).toFixed(4))}%`;

// `normalizePoints` lives in hotspot-hit.ts — one copy, so a vertex means the
// same thing to the outline drawn here and to the click that grades it. Two
// copies is how the hit-test came to reject the very shapes this overlay drew.

/** Mirrors DEFAULT_THICKNESS in hotspot-hit.ts — a line with no declared band. */
const DEFAULT_LINE_THICKNESS = 0.04;

const OUTLINE_CLASS =
  "group absolute border-2 border-dashed border-blue-500/80 bg-blue-400/10 pointer-events-auto";

/** Small badge so the editor can tell shapes apart (Vietnamese labels ok). */
const ShapeBadge: React.FC<{ text: string }> = ({ text }) => (
  <span className="pointer-events-none absolute -top-5 left-1/2 z-20 -translate-x-1/2 select-none whitespace-nowrap rounded bg-blue-500/80 px-1 text-[10px] font-semibold text-white">
    {text}
  </span>
);

export const HotspotEditOverlay: React.FC<HotspotEditOverlayProps> = ({
  shapes,
  containerRef,
  defaultRadius = 0.05,
}) => {
  const controller = useFieldResize();
  const active = controller?.onGeometry != null;

  // Stable per-BOX RefObjects for MoveArea / handle targetRefs, keyed by array
  // INDEX — never by shape id. Two entries may legitimately carry the SAME id
  // (two rects covering the two segments of one road, both grading as that one
  // answer: the hit-test scans geometry and never counts entries). An id-keyed
  // map handed both boxes one ref object, the last-mounted element won, and
  // MoveArea then measured the WRONG box — the shape jumped away from the
  // cursor by the gap between the twins before tracking it.
  const boxRefObjects = useRef<Array<React.MutableRefObject<HTMLDivElement | null>>>([]);
  const boxRefObject = (index: number) => (boxRefObjects.current[index] ??= { current: null });

  if (!active) return null;

  // Ids that appear more than once in THIS array report `id#<index>` across the
  // controller boundary, so the geometry write lands on the entry actually being
  // dragged (grammar: `field-scope.ts`; resolution: `apply-field-geometry.ts`).
  // A unique id keeps reporting the bare id it always did, and the `data-edit-*`
  // attributes always carry the raw id.
  const idCounts = new Map<string, number>();
  for (const shape of shapes) idCounts.set(shape.id, (idCounts.get(shape.id) ?? 0) + 1);
  const reportedId = (shape: EditableHotspotShape, index: number) =>
    (idCounts.get(shape.id) ?? 0) > 1 ? withFieldOccurrence(shape.id, index) : shape.id;

  return (
    <div data-hotspot-edit-overlay className="pointer-events-none absolute inset-0 z-20">
      {shapes.map((shape, index) => {
        const badge = shape.label || shape.id;
        const fieldId = reportedId(shape, index);

        if (shape.shape === "line") {
          const points = normalizePoints(shape.points);
          if (points.length < 2) return null; // degenerate — hit-test ignores it too
          const thickness = shape.thickness ?? DEFAULT_LINE_THICKNESS;
          const xs = points.map((p) => p.x);
          const ys = points.map((p) => p.y);
          // Bounds include the band's half-width AND its round caps, matching
          // the capsule the hit-test actually grades.
          const half = thickness / 2;
          const minX = Math.min(...xs) - half;
          const maxX = Math.max(...xs) + half;
          const minY = Math.min(...ys) - half;
          const maxY = Math.max(...ys) + half;
          const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * 100} ${p.y * 100}`).join(" ");
          return (
            <React.Fragment key={index}>
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {/* Band first, centreline over it: the author needs to see both
                    the clickable width and the path they are editing. */}
                <path
                  data-edit-line-band={shape.id}
                  d={path}
                  fill="none"
                  stroke="rgba(96,165,250,0.28)"
                  strokeWidth={thickness * 100}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  data-edit-line={shape.id}
                  d={path}
                  fill="none"
                  stroke="rgba(59,130,246,0.9)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div
                ref={(el) => {
                  boxRefObject(index).current = el;
                }}
                data-edit-outline={shape.id}
                data-edit-shape="line"
                className="group pointer-events-auto absolute"
                style={{
                  left: pct(minX),
                  top: pct(minY),
                  width: pct(maxX - minX),
                  height: pct(maxY - minY),
                }}
              >
                <ShapeBadge text={badge} />
                <MoveArea
                  fieldId={fieldId}
                  unit="fraction"
                  anchor="center"
                  targetRef={boxRefObject(index)}
                  containerRef={containerRef}
                />
              </div>
            </React.Fragment>
          );
        }

        if (shape.shape === "polygon") {
          const points = normalizePoints(shape.points);
          if (points.length < 3) return null; // degenerate — hit-test ignores it too
          const xs = points.map((p) => p.x);
          const ys = points.map((p) => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const path = `${points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * 100} ${p.y * 100}`)
            .join(" ")} Z`;
          return (
            <React.Fragment key={index}>
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path
                  data-edit-polygon={shape.id}
                  d={path}
                  fill="rgba(96,165,250,0.12)"
                  stroke="rgba(59,130,246,0.8)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {/* Bounding-box grip — move only (no vertex editing). MoveArea
                  emits the new bbox CENTER; the mapper translates all points. */}
              <div
                ref={(el) => {
                  boxRefObject(index).current = el;
                }}
                data-edit-outline={shape.id}
                data-edit-shape="polygon"
                className="group pointer-events-auto absolute"
                style={{
                  left: pct(minX),
                  top: pct(minY),
                  width: pct(maxX - minX),
                  height: pct(maxY - minY),
                }}
              >
                <ShapeBadge text={badge} />
                <MoveArea
                  fieldId={fieldId}
                  unit="fraction"
                  anchor="center"
                  targetRef={boxRefObject(index)}
                  containerRef={containerRef}
                />
              </div>
            </React.Fragment>
          );
        }

        if (shape.shape === "rect") {
          // x/y is the rect TOP-LEFT (hit-test: x <= rx <= x + w) — outline
          // matches, and the move grip emits the top-left for the same reason.
          return (
            <div
              key={index}
              ref={(el) => {
                boxRefObject(index).current = el;
              }}
              data-edit-outline={shape.id}
              data-edit-shape="rect"
              className={OUTLINE_CLASS}
              style={{
                left: pct(shape.x ?? 0),
                top: pct(shape.y ?? 0),
                width: pct(shape.width ?? 0),
                height: pct(shape.height ?? 0),
              }}
            >
              <ShapeBadge text={badge} />
              <MoveArea
                fieldId={fieldId}
                unit="fraction"
                anchor="topleft"
                targetRef={boxRefObject(index)}
                containerRef={containerRef}
              />
              <ResizeHandle
                fieldId={fieldId}
                unit="fraction"
                axis="xy"
                targetRef={boxRefObject(index)}
                containerRef={containerRef}
              />
            </div>
          );
        }

        // circle — also the default when `shape` is absent (legacy data).
        // radius is a fraction of container WIDTH → diameter = radius*200% of
        // the width; aspect-ratio keeps the outline a true circle without
        // measuring pixels (a percent height would use the container HEIGHT).
        return (
          <div
            key={index}
            ref={(el) => {
              boxRefObject(index).current = el;
            }}
            data-edit-outline={shape.id}
            data-edit-shape="circle"
            className={`${OUTLINE_CLASS} -translate-x-1/2 -translate-y-1/2 rounded-full`}
            style={{
              left: pct(shape.x ?? 0),
              top: pct(shape.y ?? 0),
              width: pct(2 * (shape.radius ?? defaultRadius)),
              aspectRatio: "1 / 1",
            }}
          >
            <ShapeBadge text={badge} />
            <MoveArea
              fieldId={fieldId}
              unit="fraction"
              anchor="center"
              targetRef={boxRefObject(index)}
              containerRef={containerRef}
            />
            <RadiusHandle
              fieldId={fieldId}
              targetRef={boxRefObject(index)}
              containerRef={containerRef}
            />
          </div>
        );
      })}
    </div>
  );
};
