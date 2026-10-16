/**
 * DraggableChip — the ONE draggable primitive every native-HTML5 drag player
 * must use for its drag source.
 *
 * Two independent Chrome behaviours cancel a native drag, and this repo has hit
 * both. They are cheap to reintroduce by accident, which is why the shape lives
 * here once instead of being copy-pasted per player:
 *
 * 1. REMOUNT (#563/#569 — the proven root cause). Defining the chip component
 *    *inside* a player body gives it a new function identity on every
 *    `setDragId` re-render, so React tears out and recreates every chip right
 *    after `dragstart`. That removes the native drag SOURCE node from the DOM
 *    mid-drag and Chrome silently cancels the drag: the chip only dims, no drag
 *    image appears, `dragend` never fires, and the dim latches forever.
 *    This component is module-scope, so its identity is stable.
 *
 * 2. TRANSFORM ON THE SOURCE (#533/#544). Chrome also cancels the drag if the
 *    source element's transform changes just after `dragstart`. Framer's
 *    `layout`, `whileHover`/`whileTap` and entrance `initial`/`animate` all
 *    write a transform on that same re-render. So every transform lives on the
 *    NON-draggable wrapper here, and `draggable` + the DnD handlers sit on a
 *    transform-free inner node. Note there is deliberately no `layout` prop at
 *    all: `layout={dragId !== id}` still flips true→false at `dragstart`, which
 *    is itself a projection teardown on the source's ancestor.
 *
 * `players/dnd-source-shape.regression.test.ts` fails the build if any player
 * reintroduces either shape. Do not hand-roll a drag source; extend this.
 */
import React from "react";
import { motion } from "motion/react";

export interface DraggableChipProps {
  /** True while THIS chip is the active drag source — drives the dim. */
  dragging?: boolean;
  /** Player is locked (submitted / graded): no drag, no click, no hover. */
  locked?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  /**
   * Tap-to-select fallback. When present the inner node renders as a `<button>`
   * so keyboard and touch users have a path that does not depend on native DnD.
   *
   * Native HTML5 drag does not fire AT ALL on iOS/iPadOS Safari or Chrome, so on
   * a tablet this is the ONLY way to answer a drag question. Every player whose
   * chip is a drag source must pass it — `dnd-tap-fallback.regression.test.ts`
   * fails the build otherwise.
   *
   * The handler receives the event because a placed chip usually renders INSIDE
   * its drop target, whose own tap handler would otherwise also fire on the same
   * click — reading a stale `selected` from the previous render's closure. Call
   * `event.stopPropagation()` when the chip fully handles the tap itself.
   */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  /** Skin/theme classes for the inner (draggable) node. */
  className?: string;
  /** Extra classes for the non-draggable wrapper. */
  wrapperClassName?: string;
  /** Hover scale applied to the wrapper. Pass `false` to opt out. */
  hoverScale?: number | false;
  /** Play the entrance scale on the wrapper. */
  entrance?: boolean;
  /** Escape hatch for players that must seed `dataTransfer` (WordBank). */
  onDragStartCapture?: React.DragEventHandler<HTMLElement>;
  /**
   * Reorder players (Rank, ReorderList, ProcessSequence, Timeline) make each row
   * both a drag source and a drop target. Those handlers go on the same inner
   * node as `draggable`, so they belong here rather than on the wrapper.
   */
  onDragOver?: React.DragEventHandler<HTMLElement>;
  onDragLeave?: React.DragEventHandler<HTMLElement>;
  onDrop?: React.DragEventHandler<HTMLElement>;
  role?: string;
  style?: React.CSSProperties;
  /** Accessible label for the button form. */
  ariaLabel?: string;
  children: React.ReactNode;
}

export const DraggableChip: React.FC<DraggableChipProps> = ({
  dragging = false,
  locked = false,
  onDragStart,
  onDragEnd,
  onClick,
  className = "",
  wrapperClassName = "inline-flex",
  hoverScale = 1.04,
  entrance = true,
  onDragStartCapture,
  onDragOver,
  onDragLeave,
  onDrop,
  role,
  style,
  ariaLabel,
  children,
}) => {
  const innerClass = `${className} select-none ${
    locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
  } ${dragging ? "opacity-50" : ""}`;

  // Every prop below is transform-free by construction — see the file docblock.
  const dragProps = {
    draggable: !locked,
    onDragStart,
    onDragEnd,
    onDragStartCapture,
    onDragOver,
    onDragLeave,
    onDrop,
    role,
    style,
    className: innerClass,
  };

  return (
    <motion.div
      whileHover={!locked && hoverScale !== false ? { scale: hoverScale } : undefined}
      initial={entrance ? { scale: 0 } : false}
      animate={entrance ? { scale: 1 } : undefined}
      className={wrapperClassName}
    >
      {onClick ? (
        <button type="button" onClick={onClick} disabled={locked} aria-label={ariaLabel} {...dragProps}>
          {children}
        </button>
      ) : (
        <div {...dragProps}>{children}</div>
      )}
    </motion.div>
  );
};
