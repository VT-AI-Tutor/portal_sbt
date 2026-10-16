/**
 * P27 — Labeling / "image".
 * schema: labeling · interactionType: "image"
 *
 * Student drags label chips from a tray onto target dots positioned on an image
 * (targets are normalized 0..1 coordinates). Native HTML5 drag-and-drop. Each
 * target holds one label; dropping a second label onto a filled target swaps the
 * previous one back to the tray. "Kiểm tra" grades labelId → targetId against
 * correctMappings. Answer = Record<labelId, targetId>.
 *
 * TOUCH: native HTML5 drag never fires on iOS/iPadOS, so every placement is
 * also reachable by tapping — chạm nhãn trong khay để chọn, chạm chấm đích để
 * gắn, chạm nhãn đã gắn để trả về khay. Same grammar as Categorize/CardSort.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, ContentImage, useGrading, useHydratedRecordAnswer, useInstantGrading, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { MoveArea } from "@/core/exercise/field-resize-context";
import { joinReveal, revealName } from "./answer-name";

export interface LabelDiagramPlayerProps extends PlayerProps {
  imageUrl: string;
  imageAlt?: string;
  labels: { id: string; text: string; imageUrl?: string; imageWidth?: string }[];
  /** normalized 0..1 positions */
  targets: { id: string; x: number; y: number }[];
  /** labelId → targetId */
  correctMappings: Record<string, string>;
}

type ChipReveal = ReturnType<ReturnType<typeof useInstantGrading>["reveal"]>;

interface LabelChipProps {
  id: string;
  text: string;
  imageUrl?: string;
  imageWidth?: string;
  onDot?: boolean;
  locked: boolean;
  dragId: string | null;
  /** True while this chip is the tap-to-select pick waiting for a target. */
  selected: boolean;
  reveal: ChipReveal;
  chipClass: ReturnType<typeof useSkin>["chip"];
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}

/**
 * A single draggable label chip. MUST be a stable module-scope component: when
 * it was defined inline inside LabelDiagramPlayer, every `setDragId` gave it a
 * new function identity, so React remounted (tore out + recreated) every chip
 * on the `dragstart` re-render. That removed the native drag SOURCE node from
 * the DOM mid-drag → Chrome cancelled the drag (chip only dimmed, no drag
 * image, drop never fired). Hoisting it keeps the node identity stable across
 * re-renders so the drag survives (#563; same "first drag fails" family as
 * #533/#544, but the cause here was the remount, not a transform).
 *
 * The entrance/hover scale (a CSS transform) lives on the NON-draggable wrapper
 * inside `DraggableChip`; `draggable` + the DnD handlers sit on a transform-free
 * inner node, so nothing mutates the source element's geometry after dragstart.
 * This component stays only to compute `chipState` — the drag source shape
 * itself is the shared `DraggableChip` primitive.
 */
const LabelChip: React.FC<LabelChipProps> = ({
  id,
  text,
  imageUrl,
  imageWidth,
  onDot,
  locked,
  dragId,
  selected,
  reveal: rv,
  chipClass,
  onDragStart,
  onDragEnd,
  onClick,
}) => {
  const chipState =
    rv === "correct"
      ? "correct"
      : rv === "incorrect"
        ? "wrong"
        : selected
          ? "selected"
          : onDot
            ? "placed"
            : "idle";
  return (
    <DraggableChip
      dragging={dragId === id}
      locked={locked}
      hoverScale={1.05}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      ariaLabel={text}
      className={`${
        chipClass?.(chipState, "primary") ??
        `px-3 py-2 rounded-2xl border-4 font-bold text-xs sm:text-sm shadow-md transition-colors whitespace-nowrap ${
          rv === "correct"
            ? "border-green-400 bg-green-50  text-green-700 "
            : rv === "incorrect"
              ? "border-red-400 bg-red-50  text-red-600"
              : selected
                ? "border-yellow-400 bg-yellow-100  text-yellow-800 "
                : onDot
                  ? "border-teal-400 bg-teal-100  text-teal-800 "
                  : "border-white bg-teal-50  text-slate-800 hover:border-teal-300 "
        }`
      }`}
    >
      {imageUrl ? (
        <ContentImage src={imageUrl} alt={text} width={imageWidth} draggable={false} />
      ) : (
        <RichTextValue value={text} />
      )}
    </DraggableChip>
  );
};

export const LabelDiagramPlayer: React.FC<LabelDiagramPlayerProps> = ({
  imageUrl,
  imageAlt,
  labels,
  targets,
  correctMappings,
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  ...shell
}) => {
  const skin = useSkin();
  // mappings: labelId → targetId. Hydrated in place from the parent-supplied
  // `answer` (the exact Record shape this player reports) — no key-remount.
  const [mappings, setMappings] = useHydratedRecordAnswer(answer);
  const [dragId, setDragId] = useState<string | null>(null);
  // Tap-to-select fallback: the label waiting for a target tap (touch/keyboard).
  const [selected, setSelected] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || Object.keys(correctMappings ?? {}).length === 0;
  const elementIds = useMemo(() => labels.map((l) => l.id), [labels]);
  // buildAnswer must see the mappings of the CURRENT interaction, not the
  // render closure — commit() updates the ref before grading.
  const mappingsRef = useRef(mappings);
  mappingsRef.current = mappings;
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => mappingsRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");

  // Geometry editing (studio edit preview only — the context is null everywhere
  // else, so MoveArea renders nothing for students and the HTML5 drag-and-drop
  // play interaction stays untouched). Targets carry x/y only — move, no size.
  const geometryContainerRef = useRef<HTMLDivElement>(null);
  // Stable per-target RefObjects, for MoveArea's targetRef.
  const targetRefObjects = useRef<Record<string, React.MutableRefObject<HTMLDivElement | null>>>({});
  const targetRefObject = (id: string) => (targetRefObjects.current[id] ??= { current: null });
  const answerReveal = recordOnly
    ? null
    : joinReveal(
        Object.entries(correctMappings).map(([labelId, targetId]) => {
          const li = labels.findIndex((l) => l.id === labelId);
          const targetIdx = targets.findIndex((t) => t.id === targetId);
          return [revealName(labels[li], li, "Nhãn"), targetIdx >= 0 ? ` → vị trí ${targetIdx + 1}` : " → "];
        }),
      );

  const labelOn = (targetId: string) =>
    Object.entries(mappings).find(([, t]) => t === targetId)?.[0] ?? null;
  const unplaced = labels.filter((l) => !mappings[l.id]);

  const commit = (next: Record<string, string>) => {
    setMappings(next);
    mappingsRef.current = next;
    onAnswerChange?.(next);
    // Rearranging after a wrong self-check clears the error so retry is clean.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
  };

  const clearPending = () => {
    setDragId(null);
    setSelected(null);
    setOverTarget(null);
  };

  /**
   * Pin `id` on a target dot. Both interactions land here: the native drag
   * (`dragId` on drop) and the tap fallback (`selected` on a dot tap).
   */
  const moveToTarget = (id: string, targetId: string) => {
    if (locked) return;
    const next = { ...mappings };
    const occ = labelOn(targetId);
    if (occ) delete next[occ]; // bump previous label back to tray
    next[id] = targetId;
    commit(next);
    if (occ) instant.clear(occ);
    instant.grade(id, next[id] === correctMappings[id] ? "correct" : "incorrect");
    clearPending();
  };

  const moveToTray = (id: string) => {
    if (locked || !mappings[id]) return;
    const next = { ...mappings };
    delete next[id];
    commit(next);
    instant.clear(id);
    clearPending();
  };

  const dropOnTarget = (targetId: string) => {
    const id = dragId ?? selected;
    if (!id) return;
    moveToTarget(id, targetId);
  };

  const dropOnTray = () => {
    const id = dragId ?? selected;
    if (!id) return;
    moveToTray(id);
  };

  /** Tray tap = pick up / put down; a tap on a pinned label returns it. */
  const tapLabel = (id: string, onDot: boolean) => {
    if (locked) return;
    if (onDot) moveToTray(id);
    else setSelected((cur) => (cur === id ? null : id));
  };

  const check = () => {
    if (locked) return;
    // No answer key (or self-assessment): record only, never fake a verdict.
    if (recordOnly) {
      report(mappings, "incomplete");
      return;
    }
    const keys = Object.keys(correctMappings);
    const ok =
      keys.every((k) => mappings[k] === correctMappings[k]) &&
      Object.keys(mappings).length === keys.length;
    report(mappings, ok ? "correct" : "incorrect");
  };

  const chip = (id: string, text: string, imageUrl?: string, imageWidth?: string, onDot?: boolean) => (
    <LabelChip
      key={id}
      id={id}
      text={text}
      imageUrl={imageUrl}
      imageWidth={imageWidth}
      onDot={onDot}
      locked={locked}
      dragId={dragId}
      selected={selected === id}
      reveal={instant.reveal(id)}
      chipClass={skin.chip}
      onDragStart={() => setDragId(id)}
      onDragEnd={() => { setDragId(null); setOverTarget(null); }}
      onClick={(e) => { e.stopPropagation(); tapLabel(id, !!onDot); }}
    />
  );

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      {/* Image with target dots */}
      <div className={`shadow-lg overflow-hidden ${skin.panel?.("media") ?? "bg-white/60 rounded-3xl border-4 border-white"}`}>
        <div ref={geometryContainerRef} className="relative select-none">
          <img src={imageUrl} alt={imageAlt || "Hình minh họa bài tập"} className="w-full" draggable={false} />

          {targets.map((t) => {
            const placedLabel = labelOn(t.id);
            const label = placedLabel ? labels.find((l) => l.id === placedLabel) : null;
            const active = overTarget === t.id && !!dragId;
            return (
              <div
                key={t.id}
                ref={(el) => {
                  targetRefObject(t.id).current = el;
                }}
                onDragOver={(e) => { if (!locked) { e.preventDefault(); setOverTarget(t.id); } }}
                onDragLeave={() => setOverTarget((o) => (o === t.id ? null : o))}
                onDrop={() => dropOnTarget(t.id)}
                onClick={() => { if (selected) moveToTarget(selected, t.id); }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${
                  selected ? "cursor-pointer" : ""
                }`}
                style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%` }}
              >
                <div
                  className={`transition-all rounded-full ${
                    active || selected ? "w-7 h-7 scale-110" : "w-5 h-5"
                  } ${
                    skin.marker?.(active ? "active" : label ? "filled" : "idle") ??
                    `border-4 ${
                      active
                        ? "border-teal-500 bg-teal-300"
                        : label
                          ? "border-teal-500 bg-teal-400"
                          : "border-white bg-teal-400/70 shadow"
                    }`
                  }`}
                />
                {label && (
                  <div className="mt-1">
                    {chip(label.id, label.text, label.imageUrl, label.imageWidth, true)}
                  </div>
                )}
                {/* Edit-preview drag-to-move (null without a controller). Uses
                    pointer events, so play mode's HTML5 drag-and-drop never
                    routes through it. Target x/y is the dot CENTER. */}
                <MoveArea
                  fieldId={t.id}
                  unit="fraction"
                  anchor="center"
                  targetRef={targetRefObject(t.id)}
                  containerRef={geometryContainerRef}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Tray */}
      <div
        onDragOver={(e) => { if (!locked) e.preventDefault(); }}
        onDrop={dropOnTray}
        className={`flex flex-wrap gap-2 mt-5 min-h-[64px] p-3 transition-colors ${
          skin.panel?.("tray", dragId || selected ? "active" : "idle") ??
          `rounded-3xl border-dashed ${dragId || selected ? "border-4 border-teal-300  bg-teal-50/60" : "border-4 border-slate-200 bg-white/40"}`
        }`}
      >
        <AnimatePresence>
          {unplaced.map((l) => chip(l.id, l.text, l.imageUrl, l.imageWidth))}
        </AnimatePresence>
        {unplaced.length === 0 && (
          <span className={`italic text-sm self-center px-2 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
            Đã gắn hết các nhãn rồi! 👍
          </span>
        )}
      </div>

      {/* Parent-graded flows own the verdict — never show the self-check button. */}
      {mode !== "parent" && !instant.active && !locked && !recordOnly && (
        <div className="mt-6 flex justify-center">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={check}
            className={
              skin.actionButton?.(true, "primary") ??
              "px-8 py-3 rounded-full border-4 border-teal-500 bg-teal-400 text-white font-black text-lg shadow-md hover:bg-teal-500 transition-all"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-center text-green-600 font-black text-lg md:text-xl">
          Gắn nhãn chính xác! 🎯
        </PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-center text-red-500 font-black text-lg md:text-xl">
          Có nhãn chưa đúng, thử lại nhé! 🤔
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
