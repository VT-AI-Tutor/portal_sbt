import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ContentBlocksView, type RichContent } from "@/core/content/ContentBlocksView";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import { MoveArea, ResizeHandle } from "@/core/exercise/field-resize-context";
import { useSkin } from "@/core/exercise/skin";
import {
  PlayerShell,
  PlayerTextValue,
  useGradeMode,
  useGrading,
  useInstantGrading,
  type PlayerProps,
} from "./shared";
import { plainTextFromAuthoredMath } from "@/core/math/plainTextFromAuthoredMath";
import {
  clampMatchEdges,
  matchCardinalityFromKey,
  toggleMatchEdge,
  type MatchCardinality,
} from "@/core/question-schema/matching";

/** Canonical matching answer shape. One item may appear in multiple edges. */
export interface MatchingSceneEdge {
  item: string;
  target: string;
}

export interface MatchingSceneImage {
  url: string;
  alt?: string;
  width?: CSSProperties["width"];
}

export interface MatchingSceneNode {
  id: string;
  /** Determines canonical edge orientation and prevents item-to-item links. */
  kind: "item" | "target";
  /** Percentage coordinates in the scene's 0–100 coordinate system. */
  x: number;
  y: number;
  label?: string;
  text?: string;
  content?: RichContent;
  image?: string | MatchingSceneImage;
  imageUrl?: string;
  /** CSS width, usually a percentage of the scene canvas. */
  width?: CSSProperties["width"];
  color?: string;
  ariaLabel?: string;
}

export interface MatchingSceneBackground {
  url: string;
  alt?: string;
  /** Width/height ratio. Overrides the top-level `aspect` when provided. */
  ratio?: number | string;
}

export interface MatchingScenePlayerProps extends PlayerProps {
  nodes: MatchingSceneNode[];
  correctEdges: MatchingSceneEdge[];
  /**
   * Link ceiling. `scene` (§5.9.1) kept its own edge-list logic and never went
   * through `toggleMatchEdge`, so it had no ceiling at all — a learner could
   * run every node into a single target. Omitted, it is derived from
   * `correctEdges`.
   */
  cardinality?: MatchCardinality;
  background?: MatchingSceneBackground;
  /** Canvas width/height ratio, e.g. `"5 / 2"`. */
  aspect?: number | string;
  /** Maximum canvas width, e.g. `"560px"` or `"100%"`. */
  maxWidth?: CSSProperties["maxWidth"];
  /** Pre-drawn canonical edge. It is included in answers and cannot be removed. */
  lockedExampleEdge?: MatchingSceneEdge;
  /** Legacy scene payloads lock the example source, not only the example edge. */
  lockExampleItem?: boolean;
  /** Read-only without implying that the answer has been submitted. */
  disabled?: boolean;
}

type SceneBlock = NonNullable<RichContent["blocks"]>[number];

const edgeKey = (edge: MatchingSceneEdge) => `${edge.item}\u0000${edge.target}`;

function canonicalEdges(value: unknown): MatchingSceneEdge[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const edges: MatchingSceneEdge[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = (candidate as { item?: unknown }).item;
    const target = (candidate as { target?: unknown }).target;
    if (typeof item !== "string" || typeof target !== "string" || !item || !target) continue;
    const edge = { item, target };
    const key = edgeKey(edge);
    if (!seen.has(key)) {
      seen.add(key);
      edges.push(edge);
    }
  }
  return edges;
}

function withLockedEdge(
  edges: MatchingSceneEdge[],
  lockedExampleEdge: MatchingSceneEdge | undefined,
): MatchingSceneEdge[] {
  if (!lockedExampleEdge) return edges;
  const lockedKey = edgeKey(lockedExampleEdge);
  return [lockedExampleEdge, ...edges.filter((edge) => edgeKey(edge) !== lockedKey)];
}

function edgeSetKey(edges: MatchingSceneEdge[]) {
  return edges.map(edgeKey).sort().join("\u0001");
}

function sameEdges(left: MatchingSceneEdge[], right: MatchingSceneEdge[]) {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map(edgeKey));
  return left.every((edge) => rightKeys.has(edgeKey(edge)));
}

function cssAspect(value: number | string | undefined): CSSProperties["aspectRatio"] {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? String(value) : undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.replace(":", " / ") : undefined;
}

function stripMarkup(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function blockText(block: SceneBlock) {
  return block.text ?? block.alt ?? block.latex ?? "";
}

function nodeAccessibleLabel(node: MatchingSceneNode, index: number) {
  // `|| undefined`: chuỗi rỗng sẽ chặn chuỗi `??` bên dưới trước khi tới alt của ảnh.
  const richLabel = (node.content?.blocks ?? []).map(blockText).filter(Boolean).join(" ") || undefined;
  const image = typeof node.image === "string" ? undefined : node.image;
  // #931: plain-text surface (aria-label + chuỗi "Đáp án đúng") — hạ TeX xuống
  // dạng đọc được thay vì đọc nguyên `\(\frac{1}{8}\)`.
  return (
    plainTextFromAuthoredMath(
      stripMarkup(node.ariaLabel ?? node.label ?? node.text ?? richLabel ?? image?.alt ?? ""),
    ) || `Mục ${index + 1}`
  );
}

function nodeImageWidth(node: MatchingSceneNode): CSSProperties["width"] {
  const imageBlock = node.content?.blocks?.find((block) => block.type === "image");
  const image = typeof node.image === "string" ? undefined : node.image;
  return node.width ?? imageBlock?.width ?? image?.width;
}

function normalizedNodeContent(node: MatchingSceneNode): RichContent | undefined {
  if (!node.content?.blocks?.length) return undefined;
  return {
    blocks: node.content.blocks.map((block) =>
      block.type === "image" ? { ...block, width: "100%" } : block,
    ),
  };
}

function nodeImage(node: MatchingSceneNode): MatchingSceneImage | undefined {
  if (typeof node.image === "string") return { url: node.image };
  if (node.image) return node.image;
  if (node.imageUrl) return { url: node.imageUrl };
  return undefined;
}

function curvePath(
  item: MatchingSceneNode,
  target: MatchingSceneNode,
) {
  const dx = target.x - item.x;
  const dy = target.y - item.y;
  const length = Math.hypot(dx, dy) || 1;
  const bow = Math.min(length * 0.16, 13);
  const cx = (item.x + target.x) / 2 + (-dy / length) * bow;
  const cy = (item.y + target.y) / 2 + (dx / length) * bow;
  return `M${item.x},${item.y} Q${cx.toFixed(1)},${cy.toFixed(1)} ${target.x},${target.y}`;
}

function SceneNodeVisual({
  node,
  selected,
  connected,
  evaluation,
  locked,
  onSelect,
  nodeRef,
  containerRef,
  index,
}: {
  node: MatchingSceneNode;
  selected: boolean;
  connected: boolean;
  evaluation: "correct" | "incorrect" | undefined;
  locked: boolean;
  onSelect: () => void;
  /** Stable RefObject so the edit-preview geometry handles can measure the node. */
  nodeRef: React.MutableRefObject<HTMLDivElement | null>;
  /** The aspect-ratio scene canvas — maps node x/y percentages to pixels. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Vị trí trong `nodes` — gọi tên nút khi tác giả không khai nhãn. */
  index: number;
}) {
  const content = normalizedNodeContent(node);
  const image = nodeImage(node);
  const width = nodeImageWidth(node);
  const label = nodeAccessibleLabel(node, index);
  const visualState = evaluation ?? (selected ? "selected" : connected ? "connected" : "idle");
  const stateClass =
    visualState === "correct"
      ? "bg-green-100/85 ring-2 ring-green-500"
      : visualState === "incorrect"
        ? "bg-red-100/85 ring-2 ring-red-500"
        : visualState === "selected"
          ? "bg-white/85 ring-4 ring-sky-400 shadow-lg"
          : "bg-white/15 hover:bg-white/55 focus-within:bg-white/55";
  const kindClass = node.kind === "item" ? "text-fuchsia-700" : "text-blue-800";

  return (
    <div
      ref={nodeRef}
      data-scene-node={node.id}
      data-node-kind={node.kind}
      data-node-state={visualState}
      className={`group absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-lg text-center font-bold leading-tight transition-colors ${kindClass} ${stateClass}`}
      style={{
        left: `${node.x}%`,
        top: `${node.y}%`,
        width,
        maxWidth: width == null ? "28%" : undefined,
        color: node.color,
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        disabled={locked}
        onClick={onSelect}
        className="absolute inset-0 z-10 min-h-11 min-w-11 rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-default"
      />
      <div className="pointer-events-none min-h-10 min-w-10 px-1 py-0.5 [&_img]:mx-auto [&_img]:block [&_img]:h-auto [&_img]:w-full [&_p]:m-0 [&_p]:leading-tight">
        {content ? (
          <ContentBlocksView content={content} />
        ) : (
          <>
            {image && (
              <img
                src={resolveAssetUrl(image.url)}
                alt={image.alt ?? node.label ?? node.text ?? ""}
                className="h-auto w-full object-contain"
              />
            )}
            {/* #931: nhãn node là nội dung soạn — TeX phải dựng công thức. */}
            {(node.label || node.text) && (
              <span>
                <PlayerTextValue value={node.label ?? node.text} />
              </span>
            )}
            {!image && !node.label && !node.text && <span>{node.id}</span>}
          </>
        )}
      </div>
      {/* Edit-preview only: both render null without a FieldResizeController.
          MoveArea sits after the selection button so it stacks above it and
          (by design) swallows selection clicks while editing geometry. */}
      <MoveArea
        fieldId={node.id}
        unit="percent"
        anchor="center"
        targetRef={nodeRef}
        containerRef={containerRef}
      />
      <ResizeHandle
        unit="fraction"
        fieldId={node.id}
        targetRef={nodeRef}
        containerRef={containerRef}
      />
    </div>
  );
}

export const MatchingScenePlayer: React.FC<MatchingScenePlayerProps> = ({
  nodes,
  correctEdges,
  cardinality: cardinalityProp,
  background,
  aspect,
  maxWidth = "560px",
  lockedExampleEdge,
  lockExampleItem = false,
  disabled = false,
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
  const { mode } = useGradeMode();
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const lockedEdgeKey = lockedExampleEdge ? edgeKey(lockedExampleEdge) : undefined;
  // Cạnh mẫu đã khoá: đếm vào bậc nhưng không bao giờ bị trần đẩy ra.
  const protectedKeys = useMemo(
    () => new Set(lockedEdgeKey ? [lockedEdgeKey] : []),
    [lockedEdgeKey],
  );
  const cardinality = useMemo(
    () => cardinalityProp ?? matchCardinalityFromKey(canonicalEdges(correctEdges)),
    [cardinalityProp, correctEdges],
  );
  // Siết cả lúc nạp lại: bài lưu từ trước khi có trần không được vẽ vượt trần.
  const hydratedEdges = clampMatchEdges(
    withLockedEdge(canonicalEdges(answer), lockedExampleEdge),
    cardinality,
    protectedKeys,
  );
  const incomingHydrationKey = edgeSetKey(hydratedEdges);
  const [hydrationKey, setHydrationKey] = useState(incomingHydrationKey);
  const [edges, setEdges] = useState<MatchingSceneEdge[]>(hydratedEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Edit-preview geometry: the scene canvas maps x/y percentages to pixels,
  // and each node gets a stable RefObject for the move/resize handles.
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const nodeRefObjects = useRef<Record<string, React.MutableRefObject<HTMLDivElement | null>>>({});
  const nodeRefObject = (id: string) => (nodeRefObjects.current[id] ??= { current: null });

  // React's render-time state adjustment keeps external hydration synchronous
  // without an effect that briefly paints stale lines.
  if (hydrationKey !== incomingHydrationKey) {
    setHydrationKey(incomingHydrationKey);
    setEdges(hydratedEdges);
    setSelectedNodeId(null);
  }

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node] as const)),
    [nodes],
  );
  const expectedEdges = useMemo(
    () => withLockedEdge(canonicalEdges(correctEdges), lockedExampleEdge),
    [correctEdges, lockedExampleEdge],
  );
  const expectedKeys = useMemo(() => new Set(expectedEdges.map(edgeKey)), [expectedEdges]);
  const hasAnswerKey = expectedEdges.length > 0;
  const recordOnly = selfAssessment === true || !hasAnswerKey;
  // Instant elements are the "item"-side nodes the learner actually pairs —
  // a locked example item is pre-filled, never user-graded.
  const elementIds = useMemo(
    () =>
      nodes
        .filter((n) => n.kind === "item" && !(lockExampleItem && n.id === lockedExampleEdge?.item))
        .map((n) => n.id),
    [nodes, lockExampleItem, lockedExampleEdge],
  );
  // A scene where every item is a pre-locked example has nothing left for the
  // learner to pair — fall back to the legacy button flow instead of hiding
  // it behind an instant path that can never complete. This only disables
  // the INSTANT path; `grade()`'s own recordOnly stays untouched.
  const instantRecordOnly = recordOnly || elementIds.length === 0;
  // buildAnswer must see the edges of the CURRENT interaction, not the render
  // closure — selectNode updates the ref before grading.
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly: instantRecordOnly,
    buildAnswer: () => edgesRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const interactionLocked = disabled || submitted || (!instant.active && status === "success");

  const grade = useCallback(() => {
    if (recordOnly) {
      report(edges, "incomplete");
      return;
    }
    if (edges.length < expectedEdges.length) {
      report(edges, "incomplete");
      return;
    }
    report(edges, sameEdges(edges, expectedEdges) ? "correct" : "incorrect");
  }, [edges, expectedEdges, recordOnly, report]);

  useEffect(() => {
    if (submitted) grade();
  }, [grade, submitted]);

  const selectNode = (node: MatchingSceneNode) => {
    if (interactionLocked) return;
    if (!selectedNodeId) {
      setSelectedNodeId(node.id);
      return;
    }
    if (selectedNodeId === node.id) {
      setSelectedNodeId(null);
      return;
    }
    const selected = nodeById.get(selectedNodeId);
    if (!selected) {
      setSelectedNodeId(node.id);
      return;
    }
    if (selected.kind === node.kind) {
      setSelectedNodeId(node.id);
      return;
    }

    const nextEdge = selected.kind === "item"
      ? { item: selected.id, target: node.id }
      : { item: node.id, target: selected.id };
    const nextKey = edgeKey(nextEdge);
    if (nextKey === lockedEdgeKey) {
      setSelectedNodeId(null);
      return;
    }
    const next = withLockedEdge(
      toggleMatchEdge(edges, nextEdge.item, nextEdge.target, {
        ...cardinality,
        protectedKeys,
      }),
      lockedExampleEdge,
    );
    setEdges(next);
    setSelectedNodeId(null);
    onAnswerChange?.(next);
    // Instant: grade the item side of this pair right away. Toggling its
    // last edge off leaves it unanswered (idle), not wrong.
    edgesRef.current = next;
    const itemId = nextEdge.item;
    if (elementIds.includes(itemId)) {
      const itemEdges = next.filter((edge) => edge.item === itemId);
      if (itemEdges.length === 0) {
        instant.clear(itemId);
      } else {
        const expectedForItem = expectedEdges.filter((edge) => edge.item === itemId);
        instant.grade(itemId, sameEdges(itemEdges, expectedForItem) ? "correct" : "incorrect");
      }
    }
  };

  const showElementEvaluation = mode === "self" && (submitted || status === "success" || status === "error");
  const answerReveal = recordOnly
    ? undefined
    : expectedEdges
        .map((edge) => {
          const ii = nodes.findIndex((node) => node.id === edge.item);
          const ti = nodes.findIndex((node) => node.id === edge.target);
          const name = (i: number) => (i >= 0 ? nodeAccessibleLabel(nodes[i], i) : "");
          return `${name(ii)} → ${name(ti)}`;
        })
        .join("\n");

  const nodeEvaluation = (node: MatchingSceneNode): "correct" | "incorrect" | undefined => {
    // Instant reveal (item-side only) wins; fallback keeps the exact
    // post-submit semantics, independent of GradeMode.
    if (node.kind === "item") {
      const rv = instant.reveal(node.id);
      if (rv) return rv;
    }
    if (!showElementEvaluation) return undefined;
    const touching = edges.filter((edge) => edge.item === node.id || edge.target === node.id);
    if (touching.length === 0) return undefined;
    const expectedTouching = expectedEdges.filter((edge) => edge.item === node.id || edge.target === node.id);
    return sameEdges(touching, expectedTouching) ? "correct" : "incorrect";
  };

  return (
    <PlayerShell
      {...shell}
      answer={answer}
      onAnswerChange={onAnswerChange}
      onComplete={onComplete}
      onStatusChange={onStatusChange}
      submitted={submitted}
      selfAssessment={selfAssessment}
      answerReveal={answerReveal}
    >
      <div
        ref={sceneContainerRef}
        data-matching-scene="true"
        className="relative mx-auto w-full select-none overflow-hidden rounded-lg border border-slate-200 bg-slate-100/30"
        style={{
          aspectRatio: cssAspect(background?.ratio) ?? cssAspect(aspect) ?? "7 / 5",
          maxWidth,
        }}
      >
        {background?.url && (
          <img
            data-scene-background="true"
            src={resolveAssetUrl(background.url)}
            alt={background.alt ?? ""}
            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          />
        )}

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {edges.map((edge) => {
            const item = nodeById.get(edge.item);
            const target = nodeById.get(edge.target);
            if (!item || !target) return null;
            const key = edgeKey(edge);
            const locked = key === lockedEdgeKey;
            const correct = expectedKeys.has(key);
            const lineRv = instant.reveal(edge.item);
            const showLineEvaluation = Boolean(lineRv) || showElementEvaluation;
            const lineCorrect = lineRv ? lineRv === "correct" : correct;
            const stroke = showLineEvaluation
              ? lineCorrect ? "#22c55e" : "#ef4444"
              : locked ? "#64748b" : "#0ea5e9";
            return (
              <path
                key={key}
                data-edge-key={`${edge.item}->${edge.target}`}
                data-edge-locked={locked ? "true" : undefined}
                data-edge-state={showLineEvaluation ? (lineCorrect ? "correct" : "incorrect") : "answer"}
                d={curvePath(item, target)}
                fill="none"
                stroke={stroke}
                strokeWidth={locked ? 2 : 2.5}
                strokeDasharray={locked ? "3 2" : undefined}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {nodes.map((node, index) => (
          <SceneNodeVisual
            key={node.id}
            node={node}
            index={index}
            selected={selectedNodeId === node.id}
            connected={edges.some((edge) => edge.item === node.id || edge.target === node.id)}
            evaluation={nodeEvaluation(node)}
            locked={interactionLocked || (lockExampleItem && node.id === lockedExampleEdge?.item)}
            onSelect={() => selectNode(node)}
            nodeRef={nodeRefObject(node.id)}
            containerRef={sceneContainerRef}
          />
        ))}
      </div>

      {/* mode "parent": ẩn nút tự-chấm — cha chấm; edges đã emit khi nối/gỡ. */}
      {!instant.active && !interactionLocked && mode !== "parent" && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={grade}
            className={
              skin.actionButton?.(true, "primary") ??
              "rounded-full border-4 border-fuchsia-500 bg-fuchsia-400 px-8 py-3 text-lg font-black text-white shadow-md transition-colors hover:bg-fuchsia-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-300"
            }
          >
            Kiểm tra
          </button>
        </div>
      )}
    </PlayerShell>
  );
};
