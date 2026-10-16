/**
 * P23 — Matching / "lines".
 * Same data as P22, but pairs are drawn as actual SVG lines between the two
 * columns. Click a left item then a right item to draw a line. "Kiểm tra"
 * grades leftId → rightId; wrong lines turn red after submit.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, MatchItemBody, MatchPairsReveal, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { MatchingColumnLabel, hasMatchingColumnTitle } from "./MatchingColumnLabel";
import {
  MatchingTargetColumn,
  TARGET_ENDPOINT_HEX,
} from "./MatchingTargetColumn";
import type { RichContent } from "@/core/question-schema";
import { useSkin, type QuestionPlayerSkin } from "@/core/exercise/skin";
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

export interface ConnectLinesPlayerProps extends PlayerProps {
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

const LINE_COLORS = [
  "#d946ef",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#f97316",
];

// Chips hug their content — the pair alignment comes from the shared grid row
// (left/right of a pair sit on the same row and stretch to the taller one), not
// from a fixed height. This floor only guards the tap target for short labels.
const MATCH_ROW_HEIGHT = "min-h-[3rem]";
const MATCH_IMAGE_MAX_HEIGHT = "6rem";
// web#706 — cặp nối mẫu ("theo mẫu"): xám + nét đứt mảnh, đúng bảng màu của
// MatchingScenePlayer để sáu player nhìn giống nhau.

// web#706: state thứ tư — item/đích thuộc cặp nối mẫu. skin.chip không có
// state "example" nên nhánh này bỏ qua skin thay vì đổi hợp đồng skin.
// `hasImage`: item mang ẢNH → ô ôm sát ảnh thay vì slab full width.
// WEB16: state đã chấm (wrong/correct) thắng nhánh "mẫu" — trước đây cả hai
// đầu chỉ có idle/placed/selected nên ô chữ không bao giờ đổi màu theo kết quả.
//
// Hàm ở tầng module (nhận `skin` qua tham số) chứ không phải closure trong
// component: cột đích tính class BÊN TRONG <MatchingTargetColumn>, nơi useSkin()
// đã bind với accent xanh — closure của cha sẽ mang nhầm accent của cột nguồn.
type MatchChipState = "wrong" | "correct" | "selected" | "placed" | "idle";

const matchChipClass = (
  skin: QuestionPlayerSkin,
  state: MatchChipState,
  isExample = false,
  hasImage = false,
) =>
  cn(
    `relative w-full max-w-sm ${MATCH_ROW_HEIGHT} flex items-center px-4 py-3 text-left text-sm sm:text-base md:text-lg transition-all font-bold ${
      isExample && state !== "wrong" && state !== "correct" && state !== "selected"
        ? MATCH_EXAMPLE_CHIP_CLASS
        : skin.chip?.(state, "primary") ??
      `rounded-3xl border-4 ${
        state === "wrong"
          ? "bg-red-50  border-red-400 text-red-600"
          : state === "correct"
            ? "bg-green-50  border-green-400 text-green-700 "
            : state === "selected"
              ? "bg-yellow-100  border-yellow-400 text-yellow-800 "
              : state === "placed"
                ? "bg-white border-fuchsia-400 text-slate-800"
                : "bg-white border-slate-200 text-slate-800 hover:border-fuchsia-300  hover:bg-fuchsia-50 "
      }`
    }`,
    // Ô chỉ có ảnh thì ôm sát ảnh (w-auto) thay vì slab full width — minh hoạ
    // nhỏ trong VBT để lại mảng trắng lớn. Căn ngang KHÔNG khoá ở đây: mỗi cột
    // tự quyết (trái sát mép trái, phải sát mép phải) nên ô ảnh nằm cùng mép
    // với ô chữ trong cùng cột.
    hasImage && "w-auto max-w-full justify-center px-2 py-2",
    // web-own: xem match-chip-radius.ts.
    "rounded-[1rem]",
  );

export const ConnectLinesPlayer: React.FC<ConnectLinesPlayerProps> = ({
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
  // buildAnswer must see the edges of the CURRENT interaction, not the
  // render closure — clickRight updates the ref before grading.
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  // Item nguồn của cặp mẫu đã khoá được vẽ sẵn, không bao giờ do học sinh nối
  // → loại khỏi tập phần tử chấm tức thời (progress.total giảm theo).
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
  // In-player "Kiểm tra" just graded incorrect — wrong lines turn red (correct
  // lines keep their pair color so no answer is leaked while retrying).
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

  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [anchors, setAnchors] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);

  const colorIndex = (leftId: string) =>
    leftItems.findIndex((l) => l.id === leftId) % LINE_COLORS.length;

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
    window.addEventListener("resize", updateAnchors);
    const timers = [100, 300].map((ms) => setTimeout(updateAnchors, ms));
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", updateAnchors);
      timers.forEach(clearTimeout);
    };
  }, [updateAnchors, edges]);

  // Many-to-one được phép (schema không ràng buộc duy nhất ở cột phải), nên thu
  // TẤT CẢ nguồn đổ vào một đích — `find` cũ chỉ lấy nguồn đầu tiên, làm ô đích
  // hiển thị sai chủ khi có nhiều nét (và nuốt mất nét của học sinh khi cặp mẫu
  // được ghép lên trước).
  const rightOwners = (rightId: string) =>
    leftItems.filter((l) => edges.some((edge) => edge.item === l.id && edge.target === rightId)).map((l) => l.id);

  // Verdict của MỘT nét nối — dùng chung cho đường kẻ và ô đích (WEB16).
  // `instant.reveal(lid)` là verdict theo leftId: một item nguồn nhiều đích có
  // thể đúng nét này sai nét kia, nên chấm theo `edgeCorrect` của từng nét.
  // `null` = chưa chấm.
  const edgeVerdict = (lid: string, rid: string): "wrong" | "correct" | null => {
    const edgeCorrect = effectiveCorrectEdges.some(
      (edge) => matchEdgeKey(edge) === matchEdgeKey({ item: lid, target: rid }),
    );
    const rv = instant.reveal(lid);
    if (rv !== undefined) return edgeCorrect ? "correct" : "wrong";
    if (submitted && edgeCorrect) return "correct";
    if ((submitted || errored) && !edgeCorrect) return "wrong";
    return null;
  };

  const clickLeft = (id: string) => {
    if (locked) return;
    // Cặp mẫu đã khoá: không cho chọn item nguồn, nên đường nối mẫu cũng không
    // thể bị nối lại hay xoá đi. Ngoại lệ: khoá đáp án còn đích đúng khác cho
    // chính item đó thì item vẫn phải chọn được để nối nốt cạnh còn lại.
    if (example.isLockedSource(id) && !example.canSelectSource(id)) return;
    setCursorPoint(null);
    setSelectedLeft((cur) => (cur === id ? null : id));
  };

  const clickRight = (rightId: string) => {
    if (locked || !selectedLeft) return;
    const leftId = selectedLeft;
    if (example.isLockedSource(leftId) && !example.canSelectSource(leftId)) return;
    // Bấm lại chính cạnh mẫu là thao tác rỗng: mẫu bất biến, còn đích đúng khác
    // của cùng item nguồn thì vẫn nối được.
    if (example.isLockedExampleEdge({ item: leftId, target: rightId })) {
      setSelectedLeft(null);
      setCursorPoint(null);
      return;
    }
    // `protectedKeys` khiến cạnh mẫu được đếm vào bậc nhưng không bị trần đẩy
    // ra, nên không cần bọc `withExample` để nhặt lại mẫu bị rơi nữa.
    const next = toggleMatchEdge(edges, leftId, rightId, {
      ...cardinality,
      protectedKeys: example.protectedKeys,
    });
    setDraft({ hydrationKey, edges: next, hasInvalidEdges: false });
    setSelectedLeft(null);
    setCursorPoint(null);
    onAnswerChange?.(next);
    // Changing a line after a wrong self-check clears the error for the retry.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    // Instant: grade this left item against its expected target set right
    // away. Toggling the last edge off leaves it unanswered (idle), not wrong.
    edgesRef.current = next;
    // Item của cặp mẫu không nằm trong elementIds nên cũng không được chấm —
    // chấm nó sẽ đẩy progress vượt quá total.
    if (elementIds.includes(leftId)) {
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
    report(edges, sameMatchEdgeSet(edges, effectiveCorrectEdges, new Set(leftItems.map((item) => item.id)), new Set(rightItems.map((item) => item.id))) ? "correct" : "incorrect");
  };

  useEffect(() => {
    if (submitted && status === "idle") grade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const itemClass = (state: MatchChipState, isExample = false, hasImage = false) =>
    matchChipClass(skin, state, isExample, hasImage);


  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      {/* Scroll OUTSIDE the anchor container — see TwoColumnMatchPlayer.
          `px-2 py-0.5` chừa chỗ cho hiệu ứng: vùng cuộn cắt mọi thứ vẽ ra ngoài
          padding-box, mà thẻ chọn phóng `scale-[1.02]` (1% bề rộng mỗi bên) nên
          thẻ sát mép bị xén đúng nét viền — xem ghi chú ở ChainMatchPlayer. */}
      <div className="overflow-x-auto px-2 py-0.5">
      <div
        ref={containerRef}
        data-matching-canvas="true"
        // Bỏ w-max (hug-content) — cột chia đều cần container full width như
        // web; min-w-full giữ SVG overlay phủ đúng vùng anchor.
        className="relative select-none min-w-full"
        onPointerMove={trackCursor}
        onPointerLeave={clearCursorPreview}
        onPointerCancel={clearCursorPreview}
      >
        {/* SVG overlay drawing the connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          {edges.map(({ item: lid, target: rid }) => {
            const from = anchors[`L:${lid}`];
            const to = anchors[`R:${rid}`];
            if (!from || !to) return null;
            const lineVerdict = edgeVerdict(lid, rid);
            const ok = lineVerdict === "correct";
            const wrong = lineVerdict === "wrong";
            // web#706: xám + nét đứt là style NGHỈ của đường nối mẫu; khi đã
            // chấm thì nhánh xanh/đỏ vẫn thắng, giống hệt scene player.
            const isExample = example.isExampleEdge({ item: lid, target: rid });
            const isLockedExample = isExample && example.isLockedSource(lid);
            const stroke = wrong
              ? "#ef4444"
              : ok
                ? "#22c55e"
                : isExample
                  ? MATCH_EXAMPLE_LINE_HEX
                  : LINE_COLORS[colorIndex(lid)];
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
              stroke={LINE_COLORS[colorIndex(selectedLeft)]}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={MATCH_PENDING_LINE_DASH}
              className="opacity-60"
            />
          )}
        </svg>

        {/* 2 cột chia đều bề rộng (grid-cols-2) như web — pill rộng thoáng full
            cột; max-content dồn pill hug-content vào giữa. Chấm endpoint +
            MatchEdge behavior giữ nguyên. */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:gap-x-16 sm:gap-y-3">
          <div className="contents">
            <MatchingColumnLabel title={leftTitle} titleContent={leftTitleContent} badgeTone="fuchsia" className="col-start-1 row-start-1 mb-1 w-full max-w-sm justify-self-start px-1" />
            {leftItems.map((l, index) => {
              const dot = LINE_COLORS[colorIndex(l.id)];
              const targets = matchTargets(edges, l.id);
              const paired = targets.length > 0;
              // Item nguồn của cặp mẫu — chip xám để học sinh nhìn ra "đây là mẫu".
              const isExampleItem = targets.some((target) =>
                example.isExampleEdge({ item: l.id, target }),
              );
              // Verdict của item nguồn = tổng hợp các nét đi ra từ nó.
              const srcVerdicts = targets.map((target) => edgeVerdict(l.id, target));
              const srcState = srcVerdicts.includes("wrong")
                ? "wrong"
                : paired && srcVerdicts.every((v) => v === "correct")
                  ? "correct"
                  : selectedLeft === l.id
                    ? "selected"
                    : paired
                      ? "placed"
                      : "idle";
              return (
                <button
                  key={l.id}
                  ref={(el) => {
                    leftRefs.current[l.id] = el;
                  }}
                  type="button"
                  onClick={() => clickLeft(l.id)}
                  disabled={locked || (example.isLockedSource(l.id) && !example.canSelectSource(l.id))}
                  className={cn(itemClass(srcState, isExampleItem, !!l.imageUrl), "justify-self-start")}
                  style={{ gridColumn: 1, gridRow: index + itemRowOffset }}
                >
                  <MatchItemBody item={l} labelClassName="flex-1" imageClassName="mr-2 max-w-[10rem]" imageMaxHeight={MATCH_IMAGE_MAX_HEIGHT} />
                  <span
                    className={`${MATCH_ENDPOINT_CLASS} -right-3`}
                    style={{
                      background: isExampleItem ? MATCH_EXAMPLE_LINE_HEX : paired ? dot : MATCH_IDLE_SOURCE_ENDPOINT_HEX,
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* web-own: cột đích bọc trong accent xanh: `targetSkin` là skin ĐÃ bind với
              accent đó, nên tông cột B do chính hệ skin sinh ra — skin thường
              (studio/dark) giữ nguyên bảng màu của nó. */}
          <MatchingTargetColumn>
          {(targetSkin) => (
          <div className="contents">
            <MatchingColumnLabel title={rightTitle} titleContent={rightTitleContent} badgeTone="blue" className="col-start-2 row-start-1 mb-1 w-full max-w-sm justify-self-end px-1" />
            {rightItems.map((r, index) => {
              const owners = rightOwners(r.id);
              const hasOwner = owners.length > 0;
              // Đích của cặp mẫu — xám cùng tông với đường nối mẫu.
              const isExampleTarget = owners.some((ownerId) => example.isExampleEdge({ item: ownerId, target: r.id }));
              // WEB16: ô đích lấy verdict từ chính các nét đổ vào nó, nên màu ô
              // luôn khớp màu đường nối thay vì kẹt ở "đã nối".
              const tgtVerdicts = owners.map((ownerId) => edgeVerdict(ownerId, r.id));
              const tgtState = tgtVerdicts.includes("wrong")
                ? "wrong"
                : hasOwner && tgtVerdicts.every((v) => v === "correct")
                  ? "correct"
                  // Không thêm nhánh "selected" cho ô đích ở biến thể này: fallback
                  // "selected" là vàng (nghĩa "tôi đang được chọn"), không phải gợi ý
                  // thả — thêm vào sẽ làm cả cột phải vàng khi chọn một nguồn.
                  : hasOwner
                    ? "placed"
                    : "idle";
              return (
                <button
                  key={r.id}
                  ref={(el) => {
                    rightRefs.current[r.id] = el;
                  }}
                  type="button"
                  onClick={() => clickRight(r.id)}
                  disabled={locked}
                  className={cn(matchChipClass(targetSkin, tgtState, isExampleTarget, !!r.imageUrl), "justify-self-end")}
                  style={{ gridColumn: 2, gridRow: index + itemRowOffset }}
                >
                  <span
                    data-matching-endpoint="target"
                    className={`${MATCH_ENDPOINT_CLASS} -left-3`}
                    style={{
                      background: isExampleTarget
                        ? MATCH_EXAMPLE_LINE_HEX
                        : TARGET_ENDPOINT_HEX[tgtState],
                    }}
                  />
                  <MatchItemBody item={r} labelClassName="flex-1" imageClassName="mr-2 max-w-[10rem]" imageMaxHeight={MATCH_IMAGE_MAX_HEIGHT} />
                </button>
              );
            })}
          </div>
          )}
          </MatchingTargetColumn>
        </div>
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
