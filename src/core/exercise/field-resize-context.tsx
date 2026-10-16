/**
 * Per-field geometry editing support for the studio edit-mode preview.
 *
 * The context is null everywhere except inside the question editor's preview
 * pane — players render drag affordances on their positioned fields ONLY when
 * a controller is present, so the student embed and QA/review surfaces are
 * untouched. Geometry is a rendering-only concern and never influences
 * grading (the one exception is documented in the mapper: none today).
 *
 * v1 shipped width-only resize (`onResize`). v2 adds `onGeometry` — move
 * (x/y), rect resize (width/height) and radius — behind the same context so
 * v1 consumers keep working unchanged.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import {
  extendFieldScope,
  FIELD_SCOPE_SEPARATOR,
  scopeFieldId,
} from "@/core/exercise/field-scope";

/** Partial geometry write, in the NATIVE unit of the field's question type. */
export interface FieldGeometryPatch {
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  radius?: number;
}

export interface FieldGeometryController {
  /** Legacy width path — receives the new width for a field, continuously during drag. */
  onResize: (fieldId: string, width: string | number) => void;
  /** v2 path — move / rect resize / radius patches, continuously during drag. */
  onGeometry?: (fieldId: string, patch: FieldGeometryPatch) => void;
}

/** Back-compat alias for v1 consumers. */
export type FieldResizeController = FieldGeometryController;

export const FieldResizeContext = createContext<FieldGeometryController | null>(null);

export function useFieldResize(): FieldGeometryController | null {
  return useContext(FieldResizeContext);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Field SCOPE — React side. The rules, the id format and the parser live in
 * `field-scope.ts` (React-free so the payload mappers can import them); this
 * block only carries the scope down the tree and applies it to what the drag
 * handles report. See that module for WHY a bare id is ambiguous inside a
 * `question_group` (issue web#1113).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Current nested path, `""` at the top level. */
export const FieldScopeContext = createContext<string>("");

export function useFieldScope(): string {
  return useContext(FieldScopeContext);
}

/**
 * Declare that everything below renders the `segment` child of the surrounding
 * payload. Nests: the provider appends to whatever scope it is already in.
 */
export function FieldScopeProvider({
  segment,
  children,
}: {
  segment: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const parent = useFieldScope();
  const value = useMemo(() => extendFieldScope(parent, segment), [parent, segment]);
  return <FieldScopeContext.Provider value={value}>{children}</FieldScopeContext.Provider>;
}

/**
 * The id a drag handle must REPORT for a field it renders with the raw id
 * `fieldId`. DOM attributes keep the raw id — only what crosses the controller
 * boundary is scoped.
 */
export function useScopedFieldId(fieldId: string): string {
  const scope = useFieldScope();
  return useMemo(() => scopeFieldId(scope, fieldId), [scope, fieldId]);
}

/**
 * Which field the editor has selected, shared by BOTH edit surfaces — the
 * structured form and the live preview — so clicking a box in one highlights
 * its row in the other, and Delete/Backspace removes it from either side.
 * Null outside the question editor (student embed, QA/review): players then
 * render no selection affordance at all.
 */
export interface FieldSelection {
  selectedFieldId: string | null;
  select: (fieldId: string | null) => void;
  /** Remove the field from the payload. Absent → deletion not offered. */
  remove?: (fieldId: string) => void;
}

export const FieldSelectionContext = createContext<FieldSelection | null>(null);

/**
 * Scope-aware view of the selection: consumers keep speaking RAW ids while the
 * shared state stores scoped ones. Inside a sub-question, `selectedFieldId`
 * reports the id only when the selection belongs to THIS sub-question — so a
 * shared id like `f1` no longer lights up (or gets deleted from) every sibling
 * that happens to reuse it. Outside any scope this is the plain context.
 */
export function useFieldSelection(): FieldSelection | null {
  const raw = useContext(FieldSelectionContext);
  const scope = useFieldScope();
  return useMemo(() => {
    if (!raw || !scope) return raw;
    const prefix = `${scope}${FIELD_SCOPE_SEPARATOR}`;
    const selected = raw.selectedFieldId;
    const remove = raw.remove;
    return {
      selectedFieldId:
        selected && selected.startsWith(prefix) ? selected.slice(prefix.length) : null,
      select: (fieldId) => raw.select(fieldId === null ? null : scopeFieldId(scope, fieldId)),
      remove: remove ? (fieldId) => remove(scopeFieldId(scope, fieldId)) : undefined,
    };
  }, [raw, scope]);
}

/** True for Delete/Backspace pressed on the box itself, not inside a text field. */
export function isDeleteKey(e: React.KeyboardEvent): boolean {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return false;
  const tag = (e.target as HTMLElement | null)?.tagName;
  return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT';
}

const REM_PX = 16;

/** Round to a fixed number of decimals without float-noise. */
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/**
 * WHICH element a handle measures its drag origin from.
 *
 * Normally `targetRef.current`. But a player may hand several handles the SAME
 * ref object: a `Record<fieldId, RefObject>` collapses two entries that share an
 * id onto one ref, and the last-mounted element wins. Duplicate ids inside one
 * array are legal in real data (two `hotspots[]` rects covering the two segments
 * of one road grade as that one answer), and measuring the twin instead of the
 * box under the pointer made the field jump away from the cursor by the gap
 * between them before tracking it.
 *
 * So the ref is trusted only when it CONTAINS the handle that was actually
 * grabbed. Otherwise the DOM decides: every handle renders inside its own
 * positioned wrapper (the documented contract for these grips), so that wrapper
 * is the box being dragged. Correctly-keyed callers are unaffected.
 */
function dragOriginElement(
  handle: HTMLElement,
  target: HTMLElement | null,
): HTMLElement | null {
  if (target && target.contains(handle)) return target;
  return (handle.offsetParent as HTMLElement | null) ?? handle.parentElement ?? target;
}

/**
 * Shared drag-session runner: pointerdown starts it; window-level
 * pointermove/pointerup drive it, rAF-throttled like v1.
 */
function useDragSession(onFrame: (dx: number, dy: number) => void) {
  const frame = useRef<number | null>(null);
  return useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (frame.current != null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => onFrame(dx, dy));
      };
      const up = () => {
        if (frame.current != null) cancelAnimationFrame(frame.current);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onFrame],
  );
}

export interface ResizeHandleProps {
  fieldId: string;
  /**
   * "fraction": report width as a 0–1 number of `containerRef`'s width
   * (diagram nodes, scene nodes). "rem": report a CSS rem string like
   * "7.5rem" (cloze / fill_blank inputs).
   */
  unit: "fraction" | "rem";
  /** Element being resized — its rendered size at pointerdown is the drag origin. */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Required when unit="fraction": element whose width equals 1.0. */
  containerRef?: React.RefObject<HTMLElement | null>;
  min?: number;
  max?: number;
  className?: string;
  /**
   * 'x' (default): width-only, emitted through the legacy `onResize`.
   * 'xy': rect resize — emits `onGeometry({width, height})` in the selected
   * native unit. Fraction mode measures against the container; rem mode emits
   * only the dimensions whose pointer delta changed.
   */
  axis?: "x" | "xy";
}

/**
 * Right-edge (or corner, for axis="xy") drag handle for resizing a field in
 * the edit preview. Renders null when no controller is in scope. Place it
 * inside a positioned wrapper carrying the `group` class; it renders faint
 * and brightens on hover.
 */
export function ResizeHandle({
  fieldId,
  unit,
  targetRef,
  containerRef,
  min,
  max,
  className,
  axis = "x",
}: ResizeHandleProps): React.JSX.Element | null {
  const controller = useFieldResize();
  const reportedId = useScopedFieldId(fieldId);
  const start = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const onFrame = useCallback(
    (dx: number, dy: number) => {
      if (!controller) return;
      const widthPx = start.current.w + dx;
      if (axis === "xy") {
        const heightPx = start.current.h + dy;
        if (unit === "rem") {
          if (!controller.onGeometry) return;
          const patch: FieldGeometryPatch = {};
          if (dx !== 0) {
            patch.width = `${round(clamp(widthPx / REM_PX, min ?? 3, max ?? 20), 2)}rem`;
          }
          if (dy !== 0) {
            patch.height = `${round(clamp(heightPx / REM_PX, min ?? 3, max ?? 20), 2)}rem`;
          }
          if (patch.width !== undefined || patch.height !== undefined) {
            controller.onGeometry(reportedId, patch);
          }
          return;
        }
        const rect = containerRef?.current?.getBoundingClientRect();
        if (!rect || !rect.width || !rect.height || !controller.onGeometry) return;
        controller.onGeometry(reportedId, {
          width: round(clamp(widthPx / rect.width, min ?? 0.01, max ?? 1), 4),
          height: round(clamp(heightPx / rect.height, min ?? 0.01, max ?? 1), 4),
        });
        return;
      }
      if (unit === "fraction") {
        const containerWidth = containerRef?.current?.getBoundingClientRect().width;
        if (!containerWidth) return;
        controller.onResize(reportedId, round(clamp(widthPx / containerWidth, min ?? 0.05, max ?? 1), 4));
      } else {
        controller.onResize(reportedId, `${round(clamp(widthPx / REM_PX, min ?? 3, max ?? 20), 2)}rem`);
      }
    },
    [controller, reportedId, unit, axis, containerRef, min, max],
  );
  const startDrag = useDragSession(onFrame);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      const target = dragOriginElement(e.currentTarget, targetRef.current);
      if (!controller || !target) return;
      const rect = target.getBoundingClientRect();
      start.current = { w: rect.width, h: rect.height };
      startDrag(e);
    },
    [controller, targetRef, startDrag],
  );

  if (!controller) return null;
  if (axis === "xy" && !controller.onGeometry) return null;
  const label = axis === "xy"
    ? "Kéo để đổi độ rộng và chiều cao"
    : "Kéo để đổi độ rộng";
  return (
    <span
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : undefined}
      aria-label={label}
      title={label}
      data-resize-handle={fieldId}
      onPointerDown={onPointerDown}
      className={
        className ??
        (axis === "xy"
          ? "absolute -bottom-1 -right-1 z-20 h-3 w-3 cursor-nwse-resize rounded-sm bg-blue-500/70 opacity-40 transition-opacity hover:opacity-100 group-hover:opacity-100"
          : "absolute -right-1 top-1/2 z-20 h-4 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-blue-500/70 opacity-40 transition-opacity hover:opacity-100 group-hover:opacity-100")
      }
    />
  );
}

export type EdgeSide = "left" | "right" | "top" | "bottom";

export interface EdgeResizeHandleProps {
  fieldId: string;
  /** Which edge of the box this grip lives on. */
  side: EdgeSide;
  /** Element being resized — its rendered rect at pointerdown is the drag origin. */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Element whose box maps fractions to 1.0. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Clamp for the emitted width fraction (left/right sides). */
  minWidth?: number;
  maxWidth?: number;
  /** Clamp for the emitted height fraction (top/bottom sides). */
  minHeight?: number;
  maxHeight?: number;
  className?: string;
}

const EDGE_LABELS: Record<EdgeSide, string> = {
  left: "Kéo cạnh trái để đổi độ rộng",
  right: "Kéo cạnh phải để đổi độ rộng",
  top: "Kéo cạnh trên để đổi chiều cao",
  bottom: "Kéo cạnh dưới để đổi chiều cao",
};

const EDGE_CLASSES: Record<EdgeSide, string> = {
  left: "absolute -left-1 top-1/2 z-20 h-4 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-blue-500/70 opacity-40 transition-opacity hover:opacity-100 group-hover:opacity-100",
  right:
    "absolute -right-1 top-1/2 z-20 h-4 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-blue-500/70 opacity-40 transition-opacity hover:opacity-100 group-hover:opacity-100",
  top: "absolute -top-1 left-1/2 z-20 h-2 w-4 -translate-x-1/2 cursor-ns-resize rounded-sm bg-blue-500/70 opacity-40 transition-opacity hover:opacity-100 group-hover:opacity-100",
  bottom:
    "absolute -bottom-1 left-1/2 z-20 h-2 w-4 -translate-x-1/2 cursor-ns-resize rounded-sm bg-blue-500/70 opacity-40 transition-opacity hover:opacity-100 group-hover:opacity-100",
};

/**
 * Per-edge drag grip for CENTER-ANCHORED rect fields (diagram nodes): pulling
 * one edge keeps the OPPOSITE edge pinned — the dimension changes by the drag
 * delta and the stored center shifts by half of it. Left/right emit
 * `onGeometry({width, x})`, top/bottom `onGeometry({height, y})`, all as 0–1
 * fractions of the container. Renders null unless a v2 controller
 * (`onGeometry`) is in scope — v1 width-only consumers keep `ResizeHandle`.
 */
export function EdgeResizeHandle({
  fieldId,
  side,
  targetRef,
  containerRef,
  minWidth = 0.03,
  maxWidth = 1,
  minHeight = 0.02,
  maxHeight = 1,
  className,
}: EdgeResizeHandleProps): React.JSX.Element | null {
  const controller = useFieldResize();
  const reportedId = useScopedFieldId(fieldId);
  const start = useRef<{ w: number; h: number; cx: number; cy: number }>({
    w: 0,
    h: 0,
    cx: 0,
    cy: 0,
  });

  const onFrame = useCallback(
    (dx: number, dy: number) => {
      const onGeometry = controller?.onGeometry;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!onGeometry || !rect || !rect.width || !rect.height) return;
      const horizontal = side === "left" || side === "right";
      if (horizontal) {
        const sign = side === "right" ? 1 : -1;
        const rawWidthPx = start.current.w + sign * dx;
        const widthPx = clamp(rawWidthPx, minWidth * rect.width, maxWidth * rect.width);
        // Pin the opposite edge: the center moves by half the APPLIED delta.
        const appliedDelta = widthPx - start.current.w;
        const centerX = start.current.cx + (sign * appliedDelta) / 2 - rect.left;
        onGeometry(reportedId, {
          width: round(widthPx / rect.width, 4),
          x: round(clamp(centerX / rect.width, 0, 1), 4),
        });
      } else {
        const sign = side === "bottom" ? 1 : -1;
        const rawHeightPx = start.current.h + sign * dy;
        const heightPx = clamp(rawHeightPx, minHeight * rect.height, maxHeight * rect.height);
        const appliedDelta = heightPx - start.current.h;
        const centerY = start.current.cy + (sign * appliedDelta) / 2 - rect.top;
        onGeometry(reportedId, {
          height: round(heightPx / rect.height, 4),
          y: round(clamp(centerY / rect.height, 0, 1), 4),
        });
      }
    },
    [controller, reportedId, side, containerRef, minWidth, maxWidth, minHeight, maxHeight],
  );
  const startDrag = useDragSession(onFrame);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      const target = dragOriginElement(e.currentTarget, targetRef.current);
      if (!controller?.onGeometry || !target) return;
      const rect = target.getBoundingClientRect();
      start.current = {
        w: rect.width,
        h: rect.height,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
      };
      startDrag(e);
    },
    [controller, targetRef, startDrag],
  );

  if (!controller?.onGeometry) return null;
  const horizontal = side === "left" || side === "right";
  return (
    <span
      role="separator"
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-label={EDGE_LABELS[side]}
      title={EDGE_LABELS[side]}
      data-resize-handle={fieldId}
      data-resize-side={side}
      onPointerDown={onPointerDown}
      className={className ?? EDGE_CLASSES[side]}
    />
  );
}

export interface MoveAreaProps {
  fieldId: string;
  /** "fraction": emit x/y as 0–1 of the container; "percent": 0–100 (matching scene). */
  unit: "fraction" | "percent";
  /**
   * Which point of the target the stored x/y refers to: "center" (most
   * players, center-anchored via -translate-x-1/2) or "topleft" (hotspot /
   * classification rects).
   */
  anchor?: "center" | "topleft";
  /** Element being moved — its rendered rect at pointerdown is the drag origin. */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Element whose box maps x/y to 1.0 (or 100%). */
  containerRef: React.RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * Full-cover transparent layer that turns the field body into a move grip in
 * the edit preview: drag anywhere on the field to reposition it. Emits
 * `onGeometry({x, y})` in the native unit. Renders null unless a controller
 * with `onGeometry` is in scope. Deliberately swallows clicks so play-mode
 * click handlers underneath don't fire while editing geometry.
 */
export function MoveArea({
  fieldId,
  unit,
  anchor = "center",
  targetRef,
  containerRef,
  className,
}: MoveAreaProps): React.JSX.Element | null {
  const controller = useFieldResize();
  const reportedId = useScopedFieldId(fieldId);
  const start = useRef<{ ax: number; ay: number }>({ ax: 0, ay: 0 });

  const onFrame = useCallback(
    (dx: number, dy: number) => {
      const onGeometry = controller?.onGeometry;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!onGeometry || !rect || !rect.width || !rect.height) return;
      const ax = start.current.ax + dx - rect.left;
      const ay = start.current.ay + dy - rect.top;
      if (unit === "percent") {
        onGeometry(reportedId, {
          x: round(clamp((ax / rect.width) * 100, 0, 100), 2),
          y: round(clamp((ay / rect.height) * 100, 0, 100), 2),
        });
      } else {
        onGeometry(reportedId, {
          x: round(clamp(ax / rect.width, 0, 1), 4),
          y: round(clamp(ay / rect.height, 0, 1), 4),
        });
      }
    },
    [controller, reportedId, unit, containerRef],
  );
  const startDrag = useDragSession(onFrame);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      const target = dragOriginElement(e.currentTarget, targetRef.current);
      if (!controller?.onGeometry || !target) return;
      const rect = target.getBoundingClientRect();
      start.current =
        anchor === "topleft"
          ? { ax: rect.left, ay: rect.top }
          : { ax: rect.left + rect.width / 2, ay: rect.top + rect.height / 2 };
      startDrag(e);
    },
    [controller, targetRef, anchor, startDrag],
  );

  if (!controller?.onGeometry) return null;
  return (
    <span
      aria-label="Kéo để di chuyển"
      title="Kéo để di chuyển"
      data-move-area={fieldId}
      onPointerDown={onPointerDown}
      className={className ?? "absolute inset-0 z-10 cursor-move"}
    />
  );
}

export interface RadiusHandleProps {
  fieldId: string;
  /** Element whose CENTER is the circle center (the rendered circle). */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Element whose WIDTH normalizes the radius (corpus: radius is 0–1 of image width). */
  containerRef: React.RefObject<HTMLElement | null>;
  min?: number;
  max?: number;
  className?: string;
}

/**
 * Bottom-right radial grip for circle fields (hotspot circles, spot
 * differences). Emits `onGeometry({radius})` = pointer distance from the
 * circle center, as a fraction of the container width.
 */
export function RadiusHandle({
  fieldId,
  targetRef,
  containerRef,
  min,
  max,
  className,
}: RadiusHandleProps): React.JSX.Element | null {
  const controller = useFieldResize();
  const reportedId = useScopedFieldId(fieldId);
  const center = useRef<{ cx: number; cy: number }>({ cx: 0, cy: 0 });
  const startPointer = useRef<{ px: number; py: number }>({ px: 0, py: 0 });

  const onFrame = useCallback(
    (dx: number, dy: number) => {
      const onGeometry = controller?.onGeometry;
      const containerWidth = containerRef.current?.getBoundingClientRect().width;
      if (!onGeometry || !containerWidth) return;
      const px = startPointer.current.px + dx;
      const py = startPointer.current.py + dy;
      const dist = Math.hypot(px - center.current.cx, py - center.current.cy);
      onGeometry(reportedId, { radius: round(clamp(dist / containerWidth, min ?? 0.01, max ?? 1), 4) });
    },
    [controller, reportedId, containerRef, min, max],
  );
  const startDrag = useDragSession(onFrame);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      const target = dragOriginElement(e.currentTarget, targetRef.current);
      if (!controller?.onGeometry || !target) return;
      const rect = target.getBoundingClientRect();
      center.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
      startPointer.current = { px: e.clientX, py: e.clientY };
      startDrag(e);
    },
    [controller, targetRef, startDrag],
  );

  if (!controller?.onGeometry) return null;
  return (
    <span
      role="separator"
      aria-label="Kéo để đổi bán kính"
      title="Kéo để đổi bán kính"
      data-radius-handle={fieldId}
      onPointerDown={onPointerDown}
      className={
        className ??
        "absolute -bottom-1 -right-1 z-20 h-3 w-3 cursor-nwse-resize rounded-full bg-blue-500/70 opacity-40 transition-opacity hover:opacity-100 group-hover:opacity-100"
      }
    />
  );
}
