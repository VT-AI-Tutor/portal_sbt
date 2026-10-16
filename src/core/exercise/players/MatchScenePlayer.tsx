import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ContentBlocksView } from "@/core/content/ContentBlocksView";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import { PlayerShell, PlayerErrorFeedback, PlayerTextValue, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import {
  matchTargets,
  normalizeMatchEdges,
  matchEdgeKey,
  resolveMatchingPayload,
  sameMatchEdgeSet,
  matchCardinalityFromKey,
  toggleMatchEdge,
  type MatchEdge,
  type MatchingItemInput,
} from "@/core/question-schema/matching";

interface ScenePayload extends Record<string, unknown> {
  aspect?: unknown;
  backgroundImage?: unknown;
  example?: unknown;
}

export interface MatchScenePlayerProps extends PlayerProps {
  payload: ScenePayload;
}

const clamp = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback;
};

const safeAspect = (value: unknown) =>
  typeof value === "string" && /^\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*$/.test(value)
    ? value
    : "16 / 9";

function SceneNode({ item, index }: { item: MatchingItemInput; index: number }) {
  if (item.content?.blocks?.length) {
    return <ContentBlocksView content={item.content} className="max-w-32 text-center" />;
  }
  const directImage = item.imageUrl ?? item.image?.url;
  if (directImage) {
    return <img src={resolveAssetUrl(directImage)} alt={item.text ?? item.label ?? ""} className="max-h-24 max-w-32 object-contain" />;
  }
  return <PlayerTextValue value={item.text ?? item.label ?? `Mục ${index + 1}`} />;
}

export const MatchScenePlayer: React.FC<MatchScenePlayerProps> = ({
  payload,
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
  const match = useMemo(() => resolveMatchingPayload(payload), [payload]);
  const itemIds = useMemo(() => new Set(match.leftItems.map((item) => item.id)), [match.leftItems]);
  const targetIds = useMemo(() => new Set(match.rightItems.map((item) => item.id)), [match.rightItems]);
  const example = useMemo(
    () => normalizeMatchEdges(payload.example, itemIds, targetIds)[0],
    [itemIds, payload.example, targetIds],
  );
  const exampleLocked = Boolean(example) && (payload.example as Record<string, unknown>).locked !== false;
  const effectiveCorrectEdges = useMemo(
    () => example && !match.correctEdges.some((edge) => matchEdgeKey(edge) === matchEdgeKey(example))
      ? [example, ...match.correctEdges]
      : match.correctEdges,
    [example, match.correctEdges],
  );
  const hydrated = useMemo(() => {
    const answerEdges = normalizeMatchEdges(answer);
    return example && !answerEdges.some((edge) => matchEdgeKey(edge) === matchEdgeKey(example))
      ? [example, ...answerEdges]
      : answerEdges;
  }, [answer, example]);
  const [edges, setEdges] = useState<MatchEdge[]>(hydrated);
  const [selected, setSelected] = useState<string | null>(null);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || effectiveCorrectEdges.length === 0;
  // Instant elements are left items the learner can still pair — the locked
  // example item is pre-filled, never user-graded.
  const elementIds = useMemo(
    () => match.leftItems.filter((item) => !(exampleLocked && example?.item === item.id)).map((item) => item.id),
    [match.leftItems, exampleLocked, example],
  );
  const instantRecordOnly = recordOnly || elementIds.length === 0;
  // buildAnswer must see the edges of the CURRENT interaction, not the render
  // closure — chooseTarget updates the ref before grading.
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
  const locked = submitted || (!instant.active && status === "success");
  // In-player "Kiểm tra" just graded incorrect — wrong edges/nodes turn red
  // (correct pairings stay uncolored so no answer is leaked while retrying).
  const errored = status === "error";

  // Rehydrate only when the parent supplies a semantically different edge set.
  // The parent echoing our own reported answer back (answer → prop) must NOT
  // reset local state — it used to clear the in-progress selection mid-pair.
  const hydrationKey = JSON.stringify(hydrated);
  const [syncedKey, setSyncedKey] = useState(hydrationKey);
  if (syncedKey !== hydrationKey) {
    setSyncedKey(hydrationKey);
    if (JSON.stringify(edges) !== hydrationKey) {
      setEdges(hydrated);
      setSelected(null);
    }
  }

  const chooseTarget = (target: string) => {
    if (locked || !selected) return;
    if (exampleLocked && example?.item === selected) return;
    const leftId = selected;
    const chosen: MatchEdge = { item: leftId, target };
    // Cùng trần với mọi biến thể matching khác — suy từ khoá, hai chiều.
    const next = toggleMatchEdge(edges, chosen.item, chosen.target, {
      ...matchCardinalityFromKey(effectiveCorrectEdges),
    });
    setEdges(next);
    setSelected(null);
    onAnswerChange?.(next);
    // Changing a pair after a wrong self-check clears the error for the retry.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    // Instant: grade this left item against its expected target set right
    // away. Toggling the last edge off leaves it unanswered (idle), not wrong.
    edgesRef.current = next;
    if (elementIds.includes(leftId)) {
      const selectedT = matchTargets(next, leftId);
      if (selectedT.length === 0) {
        instant.clear(leftId);
      } else {
        const ok = sameMatchEdgeSet(
          selectedT.map((t) => ({ item: leftId, target: t })),
          matchTargets(effectiveCorrectEdges, leftId).map((t) => ({ item: leftId, target: t })),
          itemIds,
          targetIds,
        );
        instant.grade(leftId, ok ? "correct" : "incorrect");
      }
    }
  };

  const grade = () => {
    if (locked) return;
    if (recordOnly || edges.length < effectiveCorrectEdges.length) return report(edges, "incomplete");
    report(edges, sameMatchEdgeSet(edges, effectiveCorrectEdges, itemIds, targetIds) ? "correct" : "incorrect");
  };

  useEffect(() => {
    if (submitted && status === "idle") grade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const byId = new Map([...match.leftItems, ...match.rightItems].map((item) => [item.id, item]));

  return (
    <PlayerShell {...shell} submitted={submitted}>
      <div
        data-matching-scene="true"
        className="relative mx-auto w-full overflow-hidden rounded-2xl border bg-white"
        style={{ aspectRatio: safeAspect(payload.aspect), backgroundImage: typeof payload.backgroundImage === "string" ? `url(${payload.backgroundImage})` : undefined, backgroundSize: "cover" }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          {edges.map((edge) => {
            const from = byId.get(edge.item);
            const to = byId.get(edge.target);
            if (!from || !to) return null;
            const lineRv = instant.reveal(edge.item);
            // Wrong edges also turn red right after an in-player "Kiểm tra"
            // (errored); correct edges keep their neutral color — no leak.
            const edgeWrong = errored && !effectiveCorrectEdges.some((e) => matchEdgeKey(e) === matchEdgeKey(edge));
            const stroke = lineRv
              ? lineRv === "correct" ? "#22c55e" : "#ef4444"
              : edgeWrong
                ? "#ef4444"
                : example && matchEdgeKey(edge) === matchEdgeKey(example) ? "#64748b" : "#d946ef";
            return <line key={matchEdgeKey(edge)} x1={clamp(from.x, 25)} y1={clamp(from.y, 50)} x2={clamp(to.x, 75)} y2={clamp(to.y, 50)} stroke={stroke} strokeWidth="0.7" strokeLinecap="round" />;
          })}
        </svg>
        {match.leftItems.map((item, index) => {
          const rv = instant.reveal(item.id);
          // Button path: after a wrong "Kiểm tra", mark wrongly-paired nodes
          // red (correct pairings stay neutral — the answer is not revealed).
          const pairedTargets = matchTargets(edges, item.id);
          const nodeWrong = !rv && errored && pairedTargets.length > 0 && !sameMatchEdgeSet(
            pairedTargets.map((t) => ({ item: item.id, target: t })),
            matchTargets(effectiveCorrectEdges, item.id).map((t) => ({ item: item.id, target: t })),
            itemIds,
            targetIds,
          );
          const stateClass = rv
            ? rv === "correct"
              ? "border-green-500 ring-2 ring-green-200"
              : "border-red-500 ring-2 ring-red-200"
            : nodeWrong
              ? "border-red-500 ring-2 ring-red-200"
              : selected === item.id
                ? "border-fuchsia-500 ring-2 ring-fuchsia-200"
                : "border-slate-200";
          return (
            <motion.button key={item.id} type="button" disabled={locked || (exampleLocked && example?.item === item.id)} onClick={() => !locked && setSelected((current) => current === item.id ? null : item.id)} style={{ left: `${clamp(item.x, 25)}%`, top: `${clamp(item.y, 50)}%`, x: "-50%", y: "-50%" }} className={`absolute z-10 rounded-xl border-2 bg-white p-2 ${stateClass}`}>
              <SceneNode item={item} index={index} />
            </motion.button>
          );
        })}
        {match.rightItems.map((item, index) => (
          <motion.button key={item.id} type="button" disabled={locked || !selected} onClick={() => chooseTarget(item.id)} style={{ left: `${clamp(item.x, 75)}%`, top: `${clamp(item.y, 50)}%`, x: "-50%", y: "-50%" }} className="absolute z-10 rounded-xl border-2 border-slate-200 bg-white p-2 disabled:opacity-100">
            <SceneNode item={item} index={index} />
          </motion.button>
        ))}
      </div>
      <PlayerErrorFeedback show={errored && !submitted} />
      {!instant.active && !locked && !recordOnly && mode !== "parent" && <div className="mt-5 flex justify-center"><button type="button" onClick={grade} className="rounded-full bg-fuchsia-500 px-7 py-3 font-bold text-white">Kiểm tra</button></div>}
    </PlayerShell>
  );
};
