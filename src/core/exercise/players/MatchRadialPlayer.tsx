/**
 * P65 — Matching / "radial".
 * Same data + grading as P22 (columns), laid out around a center row:
 * rightItems (targets) sit in a horizontal row across the middle, leftItems
 * split into a top half and a bottom half around them. Click an outer item,
 * then a center target to draw a connecting line. Position math mirrors the
 * nxbgd-sbt-digital engine's `layout: "row"` connect renderer so both
 * platforms look alike.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, ExerciseImage, MatchItemBody, MatchPairsReveal, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { MatchingColumnLabel } from "./MatchingColumnLabel";
import type { RichContent } from "@/core/question-schema";
import { useSkin } from "@/core/exercise/skin";
import { cn } from "@/core/utils";
import { clampMatchEdges, matchCardinalityFromKey, matchEdgeKey, matchTargets, normalizeMatchEdges, sameMatchEdgeSet, toggleMatchEdge, type MatchCardinality, type MatchEdge } from "@/core/question-schema/matching";
import { useMatchingExample } from "./useMatchingExample";

export interface MatchRadialPlayerProps extends PlayerProps {
  leftItems: { id: string; text: string; imageUrl?: string; content?: RichContent }[];
  rightItems: { id: string; text: string; imageUrl?: string; content?: RichContent }[];
  /** Column headers — only rendered when non-empty; never auto-generated. The
   * radial layout has no discrete columns, so both render as a small caption
   * strip above the diagram (outer ring / center axis). */
  leftTitle?: string;
  rightTitle?: string;
  leftTitleContent?: RichContent;
  rightTitleContent?: RichContent;
  /** leftId → rightId */
  correctEdges?: MatchEdge[];
  correctPairs?: Record<string, string>;
  /**
   * Link ceiling for this question. Dispatch reads it from the RAW answer key
   * (before dangling ids are filtered out), so a broken key cannot silently
   * tighten the ceiling. Omitted — as on the demo page and in tests — it is
   * derived from `correctEdges`.
   */
  cardinality?: MatchCardinality;
  /** web#706: pre-drawn sample edges ("cặp nối mẫu"). */
  exampleEdges?: MatchEdge[];
  /** web#706: false only when the payload declared `locked: false`. */
  exampleLocked?: boolean;
}

const PAIR_COLORS = [
  "bg-fuchsia-100  border-fuchsia-400 text-fuchsia-700 ",
  "bg-amber-100  border-amber-400 text-amber-700 ",
  "bg-emerald-100  border-emerald-400 text-emerald-700 ",
  "bg-sky-100  border-sky-400 text-sky-700 ",
  "bg-violet-100  border-violet-400 text-violet-700 ",
  "bg-orange-100  border-orange-400 text-orange-700 ",
];

const LINE_HEX = ["#d946ef", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#f97316"];

/**
 * Ảnh trong chip của vòng tròn nối: khung vuông cố định, không theo kích thước
 * gốc — hình học của chip là load-bearing ở layout radial (các chip nằm trên
 * quỹ đạo tính sẵn), nên ảnh ở đây giữ frame thay vì `ContentImage`.
 */
const radialImage = ({ src, alt }: { src: string; alt?: string }) => (
  <ExerciseImage
    variant="frame"
    src={src}
    alt={alt}
    className="w-[3.75rem] h-[3.75rem] sm:w-[4.5rem] sm:h-[4.5rem] max-w-none shrink-0 rounded-xl"
  />
);

export const MatchRadialPlayer: React.FC<MatchRadialPlayerProps> = ({
  leftItems,
  rightItems,
  leftTitle,
  rightTitle,
  leftTitleContent,
  rightTitleContent,
  correctEdges: correctEdgesProp,
  cardinality: cardinalityProp,
  correctPairs,
  exampleEdges,
  exampleLocked,
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
  // web#706: mẫu chỉ "khoá" khi payload KHÔNG khai báo `locked: false`.
  const exampleIsLocked = exampleLocked !== false;
  // leftId → rightId
  const validItems = useMemo(() => new Set(leftItems.map((item) => item.id)), [leftItems]);
  const validTargets = useMemo(() => new Set(rightItems.map((item) => item.id)), [rightItems]);
  const correctEdges = useMemo(
    () => normalizeMatchEdges(correctEdgesProp ?? correctPairs, validItems, validTargets),
    [correctEdgesProp, correctPairs, validItems, validTargets],
  );
  // One target per left item unless the answer key is genuinely one-to-many
  // (a left mapping to several rights) — those questions keep multi-connect.
  // Trần nối suy từ khoá: bao nhiêu nét được ĐI RA khỏi một ô trái và bao nhiêu
  // nét được ĐI VÀO một ô phải. Trước đây chỉ có một cờ một-hay-nhiều cho chiều
  // ra, nên khoá song ánh vẫn cho dồn cả cột trái vào cùng một ô phải.
  const cardinality = useMemo(
    () => cardinalityProp ?? matchCardinalityFromKey(correctEdges),
    [cardinalityProp, correctEdges],
  );
  const clampEdges = useCallback(
    (edges: MatchEdge[], protectedKeys: ReadonlySet<string>) =>
      clampMatchEdges(edges, cardinality, protectedKeys),
    [cardinality],
  );
  // web#706 — cặp nối mẫu: hook gộp mẫu vào đáp án học sinh (vẽ sẵn khi vào bài),
  // giữ `hasInvalidEdges` tính từ mảng TRƯỚC khi ghép mẫu và `hydrationKey`
  // tính từ mảng ĐÃ ghép, nên "Làm lại" vẫn giữ nguyên nét mẫu.
  const {
    hydratedEdges,
    hydrationKey,
    hasInvalidEdges: hydratedAnswerHasInvalidEdges,
    effectiveCorrectEdges,
    isLockedSource,
    canSelectSource,
    isExampleEdge,
    isLockedExampleEdge,
    excludeLockedSources,
    protectedKeys,
  } = useMatchingExample({
    answer,
    exampleEdges,
    exampleLocked,
    validItems,
    validTargets,
    correctEdges,
    clampEdges,
  });
  const [draft, setDraft] = useState(() => ({
    hydrationKey,
    edges: hydratedEdges,
    hasInvalidEdges: hydratedAnswerHasInvalidEdges,
  }));
  const edges = draft.hydrationKey === hydrationKey ? draft.edges : hydratedEdges;
  const hasInvalidEdges = draft.hydrationKey === hydrationKey
    ? draft.hasInvalidEdges
    : hydratedAnswerHasInvalidEdges;
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const hasKey = correctEdges.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  // buildAnswer must see the edges of the CURRENT interaction, not the render
  // closure — clickRight updates the ref before grading.
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  // web#706: item nguồn của cặp mẫu đã được nối sẵn, không bao giờ do học sinh
  // làm → loại khỏi danh sách phần tử chấm ngay (tổng tiến độ giảm tương ứng).
  // Chỉ loại item mẫu đã ĐỦ đáp án; item mẫu còn đích đúng khác vẫn phải chấm.
  const elementIds = useMemo(
    () => excludeLockedSources(leftItems.map((l) => l.id)),
    [excludeLockedSources, leftItems],
  );
  // Câu nối cũng là câu CHỌN-MỘT-TẬP: mục KHÔNG có cặp đúng nào (mục nhiễu) thì
  // "để yên, không nối" chính là câu trả lời đúng — mà để yên thì không sinh
  // verdict, nên luật "chấm hết mọi mục" không bao giờ đạt. Khai tập mục BẮT
  // BUỘC phải nối để useInstantGrading chuyển sang so khớp tập (Owner 9/8, ca
  // `96858876/bai1` — nối con vật với ô "a", thỏ và hươu cố ý không nối).
  const expectedIds = useMemo(
    () => excludeLockedSources(Array.from(new Set(correctEdges.map((e) => e.item)))),
    [excludeLockedSources, correctEdges],
  );
  const instant = useInstantGrading({
    elementIds,
    expectedIds,
    instantFeedback,
    // Câu chỉ có đúng một cặp và cặp đó là mẫu → không còn phần tử nào để chấm;
    // `useInstantGrading` coi total === 0 là done:false mãi mãi nên phải
    // chuyển sang record-only (guard này scene player đã có, 4 player kia thiếu).
    recordOnly: recordOnly || elementIds.length === 0,
    buildAnswer: () => edgesRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  // In-player "Kiểm tra" just graded incorrect — wrong pairs turn red (correct
  // pairs keep their color so no answer is leaked while retrying).
  const errored = status === "error";
  // web-own: chưa upstream lên studio — xem WEB-OWN PATCHES trong
  // apps/learner/scripts/detokenize-players.mjs.
  const reveal = recordOnly ? undefined : (
    <MatchPairsReveal
      pairs={correctEdges.map(({ item: lid, target: rid }) => ({
        item: leftItems.find((x) => x.id === lid) ?? { text: lid },
        target: rightItems.find((x) => x.id === rid) ?? { text: rid },
      }))}
    />
  );

  const colorIndex = (leftId: string) =>
    leftItems.findIndex((l) => l.id === leftId) % PAIR_COLORS.length;
  const colorOf = (leftId: string) => PAIR_COLORS[colorIndex(leftId)];

  // ── Percent positions (0–100), same math as the sbt-digital engine's
  // Targets form a vertical center axis; source items occupy an outer ring.
  const NT = rightItems.length || 1;
  const NI = leftItems.length || 1;
  const tpos: Record<string, { x: number; y: number }> = {};
  rightItems.forEach((t, i) => {
    tpos[t.id] = { x: 50, y: NT === 1 ? 50 : 25 + i * (50 / (NT - 1)) };
  });
  const ipos: Record<string, { x: number; y: number }> = {};
  leftItems.forEach((it, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / NI;
    ipos[it.id] = { x: 50 + Math.cos(angle) * 40, y: 50 + Math.sin(angle) * 38 };
  });

  // ── Connection-line anchors: button CENTERS measured in pixels relative to
  // the container (lines sit under the chips, so center-to-center reads fine).
  // Pixel-space SVG like the other match players — a percent viewBox stretched
  // by preserveAspectRatio="none" breaks the pathLength dash animation.
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [anchors, setAnchors] = useState<Record<string, { x: number; y: number }>>({});

  const updateAnchors = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cb = c.getBoundingClientRect();
    const next: Record<string, { x: number; y: number }> = {};
    for (const it of [...leftItems, ...rightItems]) {
      const el = nodeRefs.current[it.id];
      if (el) {
        const b = el.getBoundingClientRect();
        next[it.id] = { x: b.left + b.width / 2 - cb.left, y: b.top + b.height / 2 - cb.top };
      }
    }
    setAnchors(next);
  }, [leftItems, rightItems]);

  useLayoutEffect(() => {
    updateAnchors();
    const obs = new ResizeObserver(() => requestAnimationFrame(updateAnchors));
    if (containerRef.current) obs.observe(containerRef.current);
    window.addEventListener("resize", updateAnchors);
    const timers = [100, 300].map((ms) => setTimeout(updateAnchors, ms));
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", updateAnchors);
      timers.forEach(clearTimeout);
    };
  }, [updateAnchors, edges]);

  const rightOwners = (rightId: string) =>
    leftItems.filter((l) => edges.some((edge) => edge.item === l.id && edge.target === rightId)).map((l) => l.id);

  const clickLeft = (id: string) => {
    // web#706: item của cặp mẫu bị khoá — không cho chọn để nối lại/xoá. Ngoại lệ:
    // khoá đáp án còn đích đúng khác cho chính item đó thì vẫn cho chọn tiếp.
    if (locked || (isLockedSource(id) && !canSelectSource(id))) return;
    setSelectedLeft((cur) => (cur === id ? null : id));
  };

  const clickRight = (rightId: string) => {
    if (locked || !selectedLeft || (isLockedSource(selectedLeft) && !canSelectSource(selectedLeft))) return;
    const leftId = selectedLeft;
    // Chính cạnh mẫu đang khoá thì bỏ qua thao tác — nối lại hay xoá đều không được.
    if (isLockedExampleEdge({ item: leftId, target: rightId })) {
      setSelectedLeft(null);
      return;
    }
    // `protectedKeys` khiến cạnh mẫu được đếm vào bậc nhưng không bị trần đẩy
    // ra, nên không cần bọc `withExample` để nhặt lại mẫu bị rơi nữa.
    const next = toggleMatchEdge(edges, leftId, rightId, {
      ...cardinality,
      protectedKeys,
    });
    setDraft({ hydrationKey, edges: next, hasInvalidEdges: false });
    setSelectedLeft(null);
    onAnswerChange?.(next);
    // Changing a pair after a wrong self-check clears the error for the retry.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    // Instant: grade this left item against its expected target set right away.
    // Toggling the last edge off leaves it unanswered (idle), not wrong.
    edgesRef.current = next;
    const selectedT = matchTargets(next, leftId);
    if (selectedT.length === 0) {
      instant.clear(leftId);
    } else {
      const ok = sameMatchEdgeSet(
        selectedT.map((target) => ({ item: leftId, target })),
        matchTargets(effectiveCorrectEdges, leftId).map((target) => ({ item: leftId, target })),
        validItems,
        validTargets,
      );
      instant.grade(leftId, ok ? "correct" : "incorrect");
    }
  };

  const grade = () => {
    if (locked) return;
    if (recordOnly) {
      report(edges, "incomplete");
      return;
    }
    if (hasInvalidEdges) {
      report(edges, "incorrect");
      return;
    }
    // web#706: so với `effectiveCorrectEdges` — nếu vẫn so với `correctEdges`
    // gốc thì học sinh bị báo thiếu đúng một cặp (chính là cặp mẫu).
    if (edges.length < effectiveCorrectEdges.length) {
      report(edges, "incomplete");
      return;
    }
    report(edges, sameMatchEdgeSet(edges, effectiveCorrectEdges, new Set(leftItems.map((item) => item.id)), new Set(rightItems.map((item) => item.id))) ? "correct" : "incorrect");
  };

  useEffect(() => {
    if (submitted && status === "idle") grade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  // Center each chip on its percent anchor via framer's x/y (NOT Tailwind
  // -translate-* classes — framer overwrites `transform` on hover/tap, which
  // would drop the centering translate and make chips jump).
  const chipBase =
    "absolute max-w-[30%] flex flex-col items-center gap-1 px-3 py-2 font-bold text-center text-xs sm:text-sm transition-colors";
  const centerXY = { x: "-50%", y: "-50%" } as const;

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      {(leftTitle || rightTitle) && (
        <div className="mb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <MatchingColumnLabel title={leftTitle} titleContent={leftTitleContent} />
          <MatchingColumnLabel title={rightTitle} titleContent={rightTitleContent} />
        </div>
      )}
      <div ref={containerRef} className="relative w-full max-w-2xl mx-auto aspect-[16/9] select-none">
        {/* SVG overlay in PIXEL space: one line per pair, center-to-center. */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          {edges.map(({ item: lid, target: rid }) => {
            const from = anchors[lid];
            const to = anchors[rid];
            if (!from || !to) return null;
            const edgeCorrect = effectiveCorrectEdges.some((edge) => matchEdgeKey(edge) === matchEdgeKey({ item: lid, target: rid }));
            const lineRv = instant.reveal(lid);
            const okLine = lineRv ? edgeCorrect : submitted && edgeCorrect;
            // Wrong lines also turn red right after an in-player "Kiểm tra".
            const wrongLine = lineRv ? !edgeCorrect : (submitted || errored) && !edgeCorrect;
            // web#706: nét mẫu vẽ xám đứt nét khi đang làm bài; lúc đã chấm thì
            // màu đúng/sai vẫn thắng (giống scene player).
            const sample = isExampleEdge({ item: lid, target: rid });
            const restingSample = sample && !wrongLine && !okLine;
            const stroke = wrongLine ? "#ef4444" : okLine ? "#22c55e" : restingSample ? "#64748b" : LINE_HEX[colorIndex(lid)];
            return (
              <motion.line
                key={`${lid}-${rid}`}
                data-matching-edge={`${lid}->${rid}`}
                data-edge-locked={sample && exampleIsLocked ? "true" : undefined}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3 }}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={stroke}
                strokeWidth={restingSample ? 2 : 4}
                strokeDasharray={restingSample ? "3 2" : undefined}
                strokeLinecap="round"
                className="opacity-80"
              />
            );
          })}
        </svg>

        {/* Center targets */}
        {rightItems.map((r) => {
          const owners = rightOwners(r.id);
          const hasOwner = owners.length > 0;
          return (
            <motion.button
              key={r.id}
              ref={(el) => {
                nodeRefs.current[r.id] = el;
              }}
              type="button"
              whileHover={!locked && selectedLeft ? { scale: 1.05 } : undefined}
              whileTap={!locked ? { scale: 0.95 } : undefined}
              onClick={() => clickRight(r.id)}
              disabled={locked}
              style={{ left: `${tpos[r.id].x}%`, top: `${tpos[r.id].y}%`, ...centerXY }}
              // web-own: xem match-chip-radius.ts. Chỉ class skin đi qua `cn()`
              // — gộp cả `chipBase` thì twMerge nuốt cỡ chữ/đệm của nó.
              className={`${chipBase} z-10 ${cn(
                skin.chip?.(hasOwner ? "placed" : selectedLeft ? "selected" : "idle", "primary") ??
                `rounded-2xl border-4 ${
                  hasOwner
                    ? colorOf(owners[0])
                    : selectedLeft
                      ? "bg-white border-dashed border-fuchsia-300  text-slate-800 hover:border-fuchsia-500 hover:bg-fuchsia-50 "
                      : "bg-white border-slate-200 text-slate-800"
                }`,
                "rounded-[1rem]",
              )}`}
            >
              <MatchItemBody item={r} renderImage={radialImage} />
            </motion.button>
          );
        })}

        {/* Outer ring items */}
        {leftItems.map((l) => {
          const selectedTargets = matchTargets(edges, l.id);
          const expectedTargets = matchTargets(effectiveCorrectEdges, l.id);
          const paired = selectedTargets.length > 0;
          const isSel = selectedLeft === l.id;
          const rv = instant.reveal(l.id);
          const pairCorrect = sameMatchEdgeSet(selectedTargets.map((target) => ({ item: l.id, target })), expectedTargets.map((target) => ({ item: l.id, target })));
          const right = rv ? rv === "correct" : submitted && paired && pairCorrect;
          // Wrong notation also right after an in-player "Kiểm tra" (errored);
          // correctly-paired items stay uncolored so no answer is leaked.
          const wrong = rv ? rv === "incorrect" : (submitted || errored) && paired && !pairCorrect;
          return (
            <motion.button
              key={l.id}
              ref={(el) => {
                nodeRefs.current[l.id] = el;
              }}
              type="button"
              whileHover={!locked ? { scale: 1.05 } : undefined}
              whileTap={!locked ? { scale: 0.95 } : undefined}
              onClick={() => clickLeft(l.id)}
              disabled={locked || (isLockedSource(l.id) && !canSelectSource(l.id))}
              style={{ left: `${ipos[l.id].x}%`, top: `${ipos[l.id].y}%`, ...centerXY }}
              // web-own: xem chú thích ở thẻ tâm phía trên.
              className={`${chipBase} z-10 ${cn(
                skin.chip?.(
                  wrong ? "wrong" : right ? "correct" : isSel ? "selected" : paired ? "placed" : "idle",
                  "primary",
                ) ??
                `rounded-2xl border-4 ${
                  wrong
                    ? "bg-red-50  border-red-400 text-red-600"
                    : right
                      ? "bg-green-50  border-green-400 text-green-700 "
                      : isSel
                        ? "bg-yellow-100  border-yellow-400 text-yellow-800 "
                        : paired
                          ? colorOf(l.id)
                          : "bg-white border-slate-200 text-slate-800 hover:border-fuchsia-300  hover:bg-fuchsia-50 "
                }`,
                "rounded-[1rem]",
              )}`}
            >
              <MatchItemBody item={l} renderImage={radialImage} />
            </motion.button>
          );
        })}
      </div>

      <PlayerErrorFeedback show={errored && !submitted} />

      {/* Gate như web — KHÔNG thêm `!recordOnly`: câu không có key (record-only)
          vẫn có nút "Kiểm tra" ở self mode (grade() tự report incomplete).
          Parent mode vẫn ẩn. */}
      {!instant.active && !locked && mode !== "parent" && (
        <div className="flex justify-center mt-6">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={grade}
            className={
              skin.actionButton?.(true, "primary") ??
              "px-8 py-3 rounded-full border-4 border-fuchsia-500 bg-fuchsia-400 text-white font-black text-lg shadow-md hover:bg-fuchsia-500 transition-colors"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}
    </PlayerShell>
  );
};
