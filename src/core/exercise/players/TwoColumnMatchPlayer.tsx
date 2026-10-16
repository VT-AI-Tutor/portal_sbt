/**
 * P22 — Matching / "columns".
 * Click a left item to select it, then click a right item to pair them.
 * Pairs render as colored badges AND connecting SVG lines between the two
 * columns. "Kiểm tra" grades leftId → rightId.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, MEDIA_MATCH_ITEM_MAX_HEIGHT, MatchItemBody, MatchPairsReveal, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { MatchingColumnLabel, hasMatchingColumnTitle } from "./MatchingColumnLabel";
import {
  MatchingTargetColumn,
  TARGET_ENDPOINT_HEX,
} from "./MatchingTargetColumn";
import type { RichContent } from "@/core/question-schema";
import { useSkin } from "@/core/exercise/skin";
import { cn } from "@/core/utils";
import { clampMatchEdges, matchCardinalityFromKey, matchEdgeKey, matchTargets, normalizeMatchEdges, sameMatchEdgeSet, toggleMatchEdge, type MatchCardinality, type MatchEdge } from "@/core/question-schema/matching";
import {
  MATCH_ENDPOINT_CLASS,
  MATCH_EXAMPLE_CHIP_CLASS,
  MATCH_EXAMPLE_LINE_DASH,
  MATCH_EXAMPLE_LINE_HEX,
  MATCH_IDLE_SOURCE_ENDPOINT_HEX,
  MATCH_PENDING_LINE_DASH,
} from "./matching-visuals";
import { useMatchingExample } from "./useMatchingExample";

export interface TwoColumnMatchPlayerProps extends PlayerProps {
  leftItems: { id: string; text: string; imageUrl?: string; imageWidth?: string; content?: RichContent }[];
  rightItems: { id: string; text: string; imageUrl?: string; imageWidth?: string; content?: RichContent }[];
  /** Column headers — fall back to the A/B badges when the payload has none. */
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

// Hex equivalents of PAIR_COLORS, keyed by the same index — used for the SVG
// connection lines (which can't take Tailwind classes).
const LINE_HEX = ["#d946ef", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#f97316"];

export const TwoColumnMatchPlayer: React.FC<TwoColumnMatchPlayerProps> = ({
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
  // Hai cột chia CHUNG hàng lưới, nên hàng dành cho nhãn cột chỉ được bỏ khi CẢ
  // HAI cột đều không khai nhãn — bỏ theo từng cột thì hai bên lệch nhau một
  // hàng và đầu nối không còn thẳng hàng. Hàng 1 để trống vẫn ăn trọn một nhịp
  // `gap-y`, nên không có nhãn thì item phải bắt đầu ngay từ hàng 1.
  const itemRowOffset =
    hasMatchingColumnTitle(leftTitle, leftTitleContent) ||
    hasMatchingColumnTitle(rightTitle, rightTitleContent)
      ? 2
      : 1;
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
  // web#706 — cặp nối mẫu. Hook gom cả ba bẫy của khối hydrate cũ:
  // hasInvalidEdges tính từ bài làm TRƯỚC khi ghép cặp mẫu, hydrationKey tính
  // từ mảng ĐÃ GỘP (nếu không cặp mẫu nhấp nháy biến mất sau lần click đầu),
  // và effectiveCorrectEdges để chấm đối xứng hai đầu.
  const example = useMatchingExample({
    answer,
    exampleEdges,
    exampleLocked,
    validItems,
    validTargets,
    correctEdges,
    clampEdges,
  });
  const {
    hydratedEdges,
    hydrationKey,
    hasInvalidEdges: hydratedAnswerHasInvalidEdges,
    effectiveCorrectEdges,
    excludeLockedSources,
  } = example;
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
  // Item nguồn của cặp mẫu đã khoá được điền sẵn, không bao giờ do học sinh
  // chấm → loại khỏi tập phần tử chấm tức thời (progress.total giảm theo).
  const elementIds = useMemo(
    () => excludeLockedSources(leftItems.map((l) => l.id)),
    [excludeLockedSources, leftItems],
  );
  // Câu chỉ có đúng một cặp và cặp đó là mẫu → elementIds rỗng; useInstantGrading
  // coi total === 0 là done: false vĩnh viễn, nên phải chuyển sang recordOnly.
  const instantRecordOnly = recordOnly || elementIds.length === 0;
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
    recordOnly: instantRecordOnly,
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

  // Stable color index per left item.
  const colorIndex = (leftId: string) =>
    leftItems.findIndex((l) => l.id === leftId) % PAIR_COLORS.length;
  const colorOf = (leftId: string) => PAIR_COLORS[colorIndex(leftId)];

  // Verdict của MỘT nét nối — dùng chung cho đường kẻ và ô đích (WEB16), để ô
  // đích không còn kẹt ở màu cặp trung tính khi nét nối đã đỏ/xanh.
  // Instant reveal (theo item trái) thắng; nhánh sau giữ nguyên ngữ nghĩa
  // post-submit. `null` = chưa chấm.
  const edgeVerdict = (lid: string, rid: string): "wrong" | "correct" | null => {
    const edgeCorrect = effectiveCorrectEdges.some(
      (edge) => matchEdgeKey(edge) === matchEdgeKey({ item: lid, target: rid }),
    );
    const rv = instant.reveal(lid);
    if (rv) return edgeCorrect ? "correct" : "wrong";
    if (submitted && edgeCorrect) return "correct";
    if ((submitted || errored) && !edgeCorrect) return "wrong";
    return null;
  };

  // ── Connection-line anchors (right edge of a left item → left edge of a right
  // item), measured relative to the container so an SVG overlay can draw lines.
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [anchors, setAnchors] = useState<Record<string, { x: number; y: number }>>({});
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);

  const updateAnchors = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cb = c.getBoundingClientRect();
    const next: Record<string, { x: number; y: number }> = {};
    for (const l of leftItems) {
      const el = leftRefs.current[l.id];
      if (el) {
        const b = el.getBoundingClientRect();
        next[`L:${l.id}`] = { x: b.right - cb.left, y: b.top + b.height / 2 - cb.top };
      }
    }
    for (const r of rightItems) {
      const el = rightRefs.current[r.id];
      if (el) {
        const b = el.getBoundingClientRect();
        next[`R:${r.id}`] = { x: b.left - cb.left, y: b.top + b.height / 2 - cb.top };
      }
    }
    setAnchors(next);
  }, [leftItems, rightItems]);

  useLayoutEffect(() => {
    updateAnchors();
    const obs = new ResizeObserver(() => requestAnimationFrame(updateAnchors));
    if (containerRef.current) obs.observe(containerRef.current);
    // Text can reflow independently inside either button (for example after a
    // viewport resize or a late-loading font). Observe each anchor too, so the
    // SVG endpoints follow its new vertical centre immediately.
    Object.values(leftRefs.current).forEach((element) => {
      if (element) obs.observe(element);
    });
    Object.values(rightRefs.current).forEach((element) => {
      if (element) obs.observe(element);
    });
    window.addEventListener("resize", updateAnchors);
    const timers = [100, 300].map((ms) => setTimeout(updateAnchors, ms));
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", updateAnchors);
      timers.forEach(clearTimeout);
    };
  }, [updateAnchors, edges]);

  // leftIds paired to a given right item. Many left items may map to the SAME
  // right (many-to-one) — the schema's correctAnswer is Record<leftId, rightId>
  // with no uniqueness constraint on the right side.
  const rightOwners = (rightId: string) =>
    leftItems.filter((l) => edges.some((edge) => edge.item === l.id && edge.target === rightId)).map((l) => l.id);

  const clickLeft = (id: string) => {
    if (locked) return;
    // Cặp mẫu đã khoá: không cho chọn item nguồn, nên nó cũng không thể bị nối
    // lại hay xoá đi. Ngoại lệ: khoá đáp án còn đích đúng khác cho chính item
    // đó thì item vẫn phải chọn được để nối nốt cạnh còn lại.
    if (example.isLockedSource(id) && !example.canSelectSource(id)) return;
    setCursorPoint(null);
    setSelectedLeft((cur) => (cur === id ? null : id));
  };

  const clickRight = (rightId: string) => {
    if (locked || !selectedLeft) return;
    if (example.isLockedSource(selectedLeft) && !example.canSelectSource(selectedLeft)) return;
    // Chính cạnh mẫu đang khoá thì bỏ qua thao tác — nối lại hay xoá đều không được.
    if (example.isLockedExampleEdge({ item: selectedLeft, target: rightId })) {
      setSelectedLeft(null);
      setCursorPoint(null);
      return;
    }
    // `protectedKeys` khiến cạnh mẫu được đếm vào bậc nhưng không bị trần đẩy
    // ra, nên không cần bọc `withExample` để nhặt lại mẫu bị rơi nữa.
    const next = toggleMatchEdge(edges, selectedLeft, rightId, {
      ...cardinality,
      protectedKeys: example.protectedKeys,
    });
    setDraft({ hydrationKey, edges: next, hasInvalidEdges: false });
    setSelectedLeft(null);
    setCursorPoint(null);
    onAnswerChange?.(next);
    // Changing a pair after a wrong self-check clears the error for the retry.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    // Instant: grade this left item against its expected target set right away.
    // Toggling the last edge off leaves it unanswered (idle), not wrong.
    edgesRef.current = next;
    // Item của cặp mẫu không nằm trong elementIds nên cũng không được chấm —
    // chấm nó sẽ đẩy progress vượt quá total.
    if (elementIds.includes(selectedLeft)) {
      const selectedT = matchTargets(next, selectedLeft);
      if (selectedT.length === 0) {
        instant.clear(selectedLeft);
      } else {
        const ok = sameMatchEdgeSet(
          selectedT.map((target) => ({ item: selectedLeft, target })),
          matchTargets(effectiveCorrectEdges, selectedLeft).map((target) => ({ item: selectedLeft, target })),
          validItems,
          validTargets,
        );
        instant.grade(selectedLeft, ok ? "correct" : "incorrect");
      }
    }
  };

  const trackCursor = (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked || !selectedLeft || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    setCursorPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  };

  const clearCursorPreview = () => setCursorPoint(null);

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
    // effectiveCorrectEdges, không phải correctEdges: cặp mẫu đã nằm sẵn trong
    // edges nên so với đáp án thiếu cặp mẫu sẽ báo "incomplete" oan một cặp.
    if (edges.length < effectiveCorrectEdges.length) {
      report(edges, "incomplete");
      return;
    }
    const validItems = new Set(leftItems.map((item) => item.id));
    const validTargets = new Set(rightItems.map((item) => item.id));
    report(edges, sameMatchEdgeSet(edges, effectiveCorrectEdges, validItems, validTargets) ? "correct" : "incorrect");
  };

  // Allow parent-driven submit.
  useEffect(() => {
    if (submitted && status === "idle") grade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div
        ref={containerRef}
        data-matching-canvas="true"
        className="relative w-full min-w-0"
        onPointerMove={trackCursor}
        onPointerLeave={clearCursorPreview}
        onPointerCancel={clearCursorPreview}
      >
        {/* SVG overlay: one line per pair (right edge of left → left edge of right). */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          {edges.map(({ item: lid, target: rid }) => {
            const from = anchors[`L:${lid}`];
            const to = anchors[`R:${rid}`];
            if (!from || !to) return null;
            const lineVerdict = edgeVerdict(lid, rid);
            const okLine = lineVerdict === "correct";
            const wrongLine = lineVerdict === "wrong";
            // web#706: xám + nét đứt là style NGHỈ của cặp mẫu; khi đã chấm thì
            // nhánh xanh/đỏ vẫn thắng, giống hệt scene player.
            const isExample = example.isExampleEdge({ item: lid, target: rid });
            const isLockedExample = isExample && example.isLockedSource(lid);
            const stroke = wrongLine
              ? "#ef4444"
              : okLine
                ? "#22c55e"
                : isExample
                  ? MATCH_EXAMPLE_LINE_HEX
                  : LINE_HEX[colorIndex(lid)];
            return (
              <React.Fragment key={`${lid}-${rid}`}>
                {!submitted && !isExample && (
                  <line
                    data-line-role="guide"
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={stroke}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray={MATCH_PENDING_LINE_DASH}
                    className="opacity-35"
                  />
                )}
                <motion.line
                  data-line-role="fill"
                  data-matching-edge={`${lid}->${rid}`}
                  data-edge-locked={isLockedExample ? "true" : undefined}
                  // Cạnh mẫu KHÔNG chạy hoạt ảnh vẽ-dần: `pathLength` được motion
                  // hiện thực bằng chính `stroke-dasharray`, nên nó ghi đè nét đứt
                  // "3 2" ("0 1" lúc đầu, "1 1" lúc xong) và mẫu luôn ra nét LIỀN.
                  // Mẫu vốn là nét in sẵn trên trang giấy — vẽ dần nó cũng sai nghĩa.
                  initial={isExample ? false : { pathLength: 0 }}
                  animate={isExample ? undefined : { pathLength: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={stroke}
                  strokeWidth={isExample ? 2 : 4}
                  strokeDasharray={isExample ? MATCH_EXAMPLE_LINE_DASH : undefined}
                  strokeLinecap="round"
                  className="opacity-80"
                />
              </React.Fragment>
            );
          })}
          {!locked && selectedLeft && cursorPoint && anchors[`L:${selectedLeft}`] && (
            <line
              data-line-role="cursor-preview"
              x1={anchors[`L:${selectedLeft}`].x}
              y1={anchors[`L:${selectedLeft}`].y}
              x2={cursorPoint.x}
              y2={cursorPoint.y}
              stroke={LINE_HEX[colorIndex(selectedLeft)]}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={MATCH_PENDING_LINE_DASH}
              className="opacity-60"
            />
          )}
        </svg>

        {/* Both sides share the same grid rows so image and text endpoints stay aligned. */}
        <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-2 sm:gap-x-12 sm:gap-y-3">
        {/* Left column */}
        <div className="contents">
          <MatchingColumnLabel title={leftTitle} titleContent={leftTitleContent} badgeTone="fuchsia" className="col-start-1 row-start-1 mb-1 w-full max-w-sm justify-self-start px-1" />
          {leftItems.map((l, index) => {
            const selectedTargets = matchTargets(edges, l.id);
            const expectedTargets = matchTargets(effectiveCorrectEdges, l.id);
            // Item nguồn của cặp mẫu — chip xám để học sinh nhìn ra "đây là mẫu".
            const isExampleItem = selectedTargets.some((target) =>
              example.isExampleEdge({ item: l.id, target }),
            );
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
                  leftRefs.current[l.id] = el;
                }}
                type="button"
                whileHover={!locked ? { scale: 1.03 } : undefined}
                whileTap={!locked ? { scale: 0.96 } : undefined}
                onClick={() => clickLeft(l.id)}
                disabled={locked || (example.isLockedSource(l.id) && !example.canSelectSource(l.id))}
                style={{ gridColumn: 1, gridRow: index + itemRowOffset }}
                className={cn(
                  // ponytail: ô hug chữ (min-h nhỏ + py gọn), chữ nhỏ hơn 1 bậc
                  `relative flex w-full min-w-0 max-w-sm justify-self-start min-h-[64px] items-center gap-2 px-4 py-2 font-bold text-left text-xs sm:text-sm md:text-base transition-all ${
                    !wrong && !right && isExampleItem && !isSel
                      ? MATCH_EXAMPLE_CHIP_CLASS
                      : skin.chip?.(
                      wrong ? "wrong" : right ? "correct" : isSel ? "selected" : paired ? "placed" : "idle",
                      "primary",
                    ) ??
                    `rounded-3xl border-4 ${
                      wrong
                        ? "bg-red-50  border-red-400 text-red-600"
                        : right
                          ? "bg-green-50  border-green-400 text-green-700 "
                          : isSel
                            ? "bg-yellow-100  border-yellow-400 text-yellow-800  scale-[1.02]"
                            : paired
                              ? colorOf(l.id)
                              : "bg-white border-slate-200 text-slate-800 hover:border-fuchsia-300  hover:bg-fuchsia-50 "
                    }`
                  }`,
                  // web-own: xem match-chip-radius.ts.
                  "rounded-[1rem]",
                )}
              >
                <span
                  className={`${MATCH_ENDPOINT_CLASS} -right-3`}
                  style={{
                    background: isExampleItem
                      ? MATCH_EXAMPLE_LINE_HEX
                      : paired
                        ? LINE_HEX[colorIndex(l.id)]
                        : MATCH_IDLE_SOURCE_ENDPOINT_HEX,
                  }}
                />
                <MatchItemBody
                  item={l}
                  labelClassName="min-w-0 flex-1 break-words [overflow-wrap:anywhere]"
                  imageMaxHeight={MEDIA_MATCH_ITEM_MAX_HEIGHT}
                />
              </motion.button>
            );
          })}
        </div>

        {/* web-own: Right column — bọc accent xanh: `targetSkin` là skin ĐÃ bind với accent
            đó nên tông cột B do chính hệ skin sinh ra, skin thường (studio/dark)
            giữ nguyên bảng màu của nó. */}
        <MatchingTargetColumn>
        {(targetSkin) => (
        <div className="contents">
          <MatchingColumnLabel title={rightTitle} titleContent={rightTitleContent} badgeTone="blue" className="col-start-2 row-start-1 mb-1 w-full max-w-sm justify-self-end px-1" />
          {rightItems.map((r, index) => {
            const owners = rightOwners(r.id);
            const hasOwner = owners.length > 0;
            // WEB16: ô đích lấy verdict từ chính các nét đổ vào nó (many-to-one
            // ⇒ một nét sai là cả ô sai), nên luôn khớp màu với đường nối.
            const targetVerdicts = owners.map((ownerId) => edgeVerdict(ownerId, r.id));
            const targetWrong = targetVerdicts.includes("wrong");
            const targetRight = hasOwner && targetVerdicts.every((v) => v === "correct");
            // Đích của cặp mẫu — xám cùng tông với đường nối mẫu.
            const isExampleTarget = owners.some((ownerId) =>
              example.isExampleEdge({ item: ownerId, target: r.id }),
            );
            // MỘT nguồn state cho cả ba thứ ăn theo nó: class ô, màu fallback và
            // màu chấm đầu nối. Suy lại state ở từng chỗ thì thêm một nhánh vào
            // đây là hai chỗ kia lặng lẽ lệch.
            const tgtState = targetWrong
              ? "wrong"
              : targetRight
                ? "correct"
                : hasOwner
                  ? "placed"
                  : selectedLeft
                    ? "selected"
                    : "idle";
            return (
              <motion.button
                key={r.id}
                ref={(el) => {
                  rightRefs.current[r.id] = el;
                }}
                type="button"
                whileHover={!locked && selectedLeft ? { scale: 1.03 } : undefined}
                whileTap={!locked ? { scale: 0.96 } : undefined}
                onClick={() => clickRight(r.id)}
                disabled={locked}
                style={{ gridColumn: 2, gridRow: index + itemRowOffset }}
                className={cn(
                  `relative flex w-full min-w-0 max-w-sm justify-self-end min-h-[64px] items-center gap-2 px-4 py-2 font-bold text-left text-xs sm:text-sm md:text-base transition-all ${
                    !targetWrong && !targetRight && isExampleTarget
                      ? MATCH_EXAMPLE_CHIP_CLASS
                      : targetSkin.chip?.(tgtState, "primary") ??
                    `rounded-3xl border-4 ${
                      tgtState === "wrong"
                        ? "bg-red-50  border-red-400 text-red-600"
                        : tgtState === "correct"
                          ? "bg-green-50  border-green-400 text-green-700 "
                          : tgtState === "placed"
                        ? colorOf(owners[0])
                        : tgtState === "selected"
                          ? "bg-white border-dashed border-fuchsia-300  text-slate-800 hover:border-fuchsia-500 hover:bg-fuchsia-50 "
                          : "bg-white border-slate-200 text-slate-800"
                    }`
                  }`,
                  // web-own: xem match-chip-radius.ts.
                  "rounded-[1rem]",
                )}
              >
                <span
                  data-matching-endpoint="target"
                  className={`${MATCH_ENDPOINT_CLASS} -left-3`}
                  style={{
                    // Ô ĐÃ NỐI giữ màu cặp (= màu đường nối) vì đó là thứ chỉ ra
                    // ô nào nối với ô nào; các state còn lại ăn theo màu viền.
                    background: isExampleTarget
                      ? MATCH_EXAMPLE_LINE_HEX
                      : hasOwner
                        ? LINE_HEX[colorIndex(owners[0])]
                        : TARGET_ENDPOINT_HEX[tgtState],
                  }}
                />
                <MatchItemBody
                  item={r}
                  labelClassName="min-w-0 flex-1 break-words [overflow-wrap:anywhere]"
                  imageMaxHeight={MEDIA_MATCH_ITEM_MAX_HEIGHT}
                />
              </motion.button>
            );
          })}
        </div>
        )}
        </MatchingTargetColumn>
        </div>
      </div>

      <PlayerErrorFeedback show={errored && !submitted} />

      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
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
