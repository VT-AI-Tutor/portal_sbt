/**
 * P64 — Matching / "rows".
 * Same data + grading as P22 (columns), but laid out as two horizontal ROWS:
 * leftItems across the top, rightItems across the bottom, with vertical
 * connecting SVG lines. Click a top item, then a bottom item to pair them.
 * Useful when items are wide images/cards that would cramp two columns.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { MediaCapProvider, PlayerShell, PlayerErrorFeedback, MEDIA_MATCH_ITEM_MAX_HEIGHT, MatchItemBody, MatchPairsReveal, useGrading, useInstantGrading, useMobileViewport, type PlayerProps } from "./shared";
import { MatchingColumnLabel } from "./MatchingColumnLabel";
import type { RichContent } from "@/core/question-schema";
import { useSkin } from "@/core/exercise/skin";
import { cn } from "@/core/utils";
import { clampMatchEdges, matchCardinalityFromKey, matchEdgeKey, matchTargets, normalizeMatchEdges, sameMatchEdgeSet, toggleMatchEdge, type MatchCardinality, type MatchEdge } from "@/core/question-schema/matching";
import { useMatchingExample } from "./useMatchingExample";

export interface MatchRowsPlayerProps extends PlayerProps {
  leftItems: { id: string; text: string; imageUrl?: string; imageWidth?: string; content?: RichContent }[];
  rightItems: { id: string; text: string; imageUrl?: string; imageWidth?: string; content?: RichContent }[];
  /** Row headers — only rendered when non-empty; never auto-generated. */
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

// Hex equivalents of PAIR_COLORS, keyed by the same index (SVG lines).
const LINE_HEX = ["#d946ef", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#f97316"];

export const MatchRowsPlayer: React.FC<MatchRowsPlayerProps> = ({
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

  // MOBILE (Owner 12/8): hai hàng flex-wrap trên màn hẹp gãy thành MỘT cột dài
  // 4-5 màn — hai đầu cặp nối cách nhau mấy màn cuộn. Trên mobile đổi sang HAI
  // CỘT cạnh nhau (nguồn trái, đích phải) như bố cục P22, đường nối NGANG giữa
  // hai cột — neo đổi từ đáy/đỉnh sang mép phải/mép trái (xem updateAnchors).
  // Ảnh co trần 7rem để thẻ vừa nửa cột. Desktop giữ từng pixel như cũ.
  const mobile = useMobileViewport();

  // ── Connection-line anchors: bottom edge of a top item → top edge of a
  // bottom item (mobile: right edge → left edge), measured relative to the
  // container for the SVG overlay.
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [anchors, setAnchors] = useState<Record<string, { x: number; y: number }>>({});

  const updateAnchors = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cb = c.getBoundingClientRect();
    const next: Record<string, { x: number; y: number }> = {};
    for (const l of leftItems) {
      const el = leftRefs.current[l.id];
      if (el) {
        const b = el.getBoundingClientRect();
        // Mobile xếp 2 CỘT: nguồn neo ở MÉP PHẢI giữa thẻ (đường nối ngang);
        // desktop giữ neo đáy thẻ như cũ.
        next[`L:${l.id}`] = mobile
          ? { x: b.right - cb.left, y: b.top + b.height / 2 - cb.top }
          : { x: b.left + b.width / 2 - cb.left, y: b.bottom - cb.top };
      }
    }
    for (const r of rightItems) {
      const el = rightRefs.current[r.id];
      if (el) {
        const b = el.getBoundingClientRect();
        next[`R:${r.id}`] = mobile
          ? { x: b.left - cb.left, y: b.top + b.height / 2 - cb.top }
          : { x: b.left + b.width / 2 - cb.left, y: b.top - cb.top };
      }
    }
    setAnchors(next);
  }, [leftItems, rightItems, mobile]);

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

  // Many-to-one allowed (schema: no uniqueness constraint on the right side).
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

  // Verdict của MỘT nét nối. Dùng chung cho đường kẻ SVG và cho ô đích, để hai
  // thứ không bao giờ lệch nhau (web#WEB16: ô chữ đích giữ màu cặp trung tính
  // trong khi đường nối và ô nguồn đã đỏ/xanh).
  // `null` = chưa chấm.
  const edgeVerdict = (lid: string, rid: string): "wrong" | "correct" | null => {
    const edgeCorrect = effectiveCorrectEdges.some(
      (edge) => matchEdgeKey(edge) === matchEdgeKey({ item: lid, target: rid }),
    );
    // Instant reveal (theo item trái) thắng; nhánh sau giữ nguyên ngữ nghĩa
    // post-submit. Nét sai cũng đỏ ngay sau khi bấm "Kiểm tra" trong player.
    const rv = instant.reveal(lid);
    if (rv) return edgeCorrect ? "correct" : "wrong";
    if (submitted && edgeCorrect) return "correct";
    if ((submitted || errored) && !edgeCorrect) return "wrong";
    return null;
  };

  const chipClass = (state: "wrong" | "correct" | "selected" | "placed" | "idle", leftId?: string) =>
    skin.chip?.(state, "primary") ??
    `rounded-3xl border-4 ${
      state === "wrong"
        ? "bg-red-50  border-red-400 text-red-600"
        : state === "correct"
          ? "bg-green-50  border-green-400 text-green-700 "
          : state === "selected"
            ? "bg-yellow-100  border-yellow-400 text-yellow-800  scale-[1.02]"
            : state === "placed" && leftId
              ? colorOf(leftId)
              : "bg-white border-slate-200 text-slate-800 hover:border-fuchsia-300  hover:bg-fuchsia-50 "
    }`;

  // Mobile bọc thêm MediaCapProvider: `width` tác giả dạng % trên ảnh item
  // (khâu sinh hay gán đại trà) qua mặt trần cao của ContentImage — trong ô
  // nửa cột thì % mất nghĩa gốc, cùng triết lý ô lưới của nhóm (Owner 8/8).
  // Width tuyệt đối (px — icon cỡ chủ ý, #783) vẫn thắng như cũ.
  const itemBody = (item: { text: string; imageUrl?: string; imageWidth?: string; content?: RichContent }) =>
    mobile ? (
      <MediaCapProvider maxHeight="7rem">
        <MatchItemBody item={item} imageMaxHeight="7rem" />
      </MediaCapProvider>
    ) : (
      <MatchItemBody item={item} imageMaxHeight={MEDIA_MATCH_ITEM_MAX_HEIGHT} />
    );

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      {/* Scroll OUTSIDE the anchor container, as in TwoColumnMatchPlayer — anchors
          are measured against the container's own rect, so a scrollport inside it
          would offset every connector line.
          No `w-max` here, unlike the column players: these rows are `flex-wrap`,
          and max-content sizing would resolve to "every item on one line", forcing
          permanent horizontal scroll instead of letting rows wrap. The container
          stays fluid and the wrapper only catches a single over-wide card. */}
      {/* `px-2 py-0.5`: chừa chỗ cho hiệu ứng phóng của thẻ sát mép — vùng cuộn
          cắt mọi thứ vẽ ra ngoài padding-box (xem ChainMatchPlayer). */}
      <div className="overflow-x-auto px-2 py-0.5">
      <div ref={containerRef} className="relative min-w-full">
        {/* SVG overlay: vertical line per pair (bottom of top item → top of bottom item). */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          {edges.map(({ item: lid, target: rid }) => {
            const from = anchors[`L:${lid}`];
            const to = anchors[`R:${rid}`];
            if (!from || !to) return null;
            const verdict = edgeVerdict(lid, rid);
            // web#706: nét mẫu vẽ xám đứt nét khi đang làm bài; lúc đã chấm thì
            // màu đúng/sai vẫn thắng (giống scene player).
            const sample = isExampleEdge({ item: lid, target: rid });
            const restingSample = sample && !verdict;
            const stroke = verdict === "wrong" ? "#ef4444" : verdict === "correct" ? "#22c55e" : restingSample ? "#64748b" : LINE_HEX[colorIndex(lid)];
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

        <div className={mobile ? "flex flex-row justify-center gap-4" : "flex flex-col gap-14 sm:gap-20"}>
          {/* Top row (left items) */}
          {/* web-own: gap item giãn hơn bản studio (cả hai hàng) — xem WEB-OWN PATCHES. */}
          <div className={mobile ? "flex min-w-0 flex-1 flex-col gap-2" : "flex flex-col items-center gap-2 sm:gap-3"}>
            <MatchingColumnLabel title={leftTitle} titleContent={leftTitleContent} className="mb-1 w-full text-center" />
            <div className={mobile ? "flex flex-col items-stretch gap-4" : "flex flex-wrap justify-center gap-4 sm:gap-6"}>
            {leftItems.map((l) => {
              const selectedTargets = matchTargets(edges, l.id);
              const expectedTargets = matchTargets(effectiveCorrectEdges, l.id);
              const paired = selectedTargets.length > 0;
              const isSel = selectedLeft === l.id;
              const rv = instant.reveal(l.id);
              const pairCorrect = sameMatchEdgeSet(selectedTargets.map((target) => ({ item: l.id, target })), expectedTargets.map((target) => ({ item: l.id, target })));
              const right = rv ? rv === "correct" : submitted && pairCorrect;
              // Wrong notation also right after an in-player "Kiểm tra" (errored);
              // correctly-paired items stay uncolored so no answer is leaked.
              const wrong = rv ? rv === "incorrect" : (submitted || errored) && paired && !pairCorrect;
              const state = wrong ? "wrong" : right ? "correct" : isSel ? "selected" : paired ? "placed" : "idle";
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
                  disabled={locked || (isLockedSource(l.id) && !canSelectSource(l.id))}
                  className={cn(
                    `relative flex items-center gap-2 px-4 py-3 font-bold text-center text-sm sm:text-base md:text-lg transition-all ${chipClass(state, l.id)}`,
                    mobile && "justify-center",
                    // web-own: xem match-chip-radius.ts.
                    "rounded-[1rem]",
                  )}
                >
                  {itemBody(l)}
                </motion.button>
              );
            })}
            </div>
          </div>

          {/* Bottom row (right items) */}
          <div className={mobile ? "flex min-w-0 flex-1 flex-col gap-2" : "flex flex-col items-center gap-2 sm:gap-3"}>
            <MatchingColumnLabel title={rightTitle} titleContent={rightTitleContent} className="mb-1 w-full text-center" />
            <div className={mobile ? "flex flex-col items-stretch gap-4" : "flex flex-wrap justify-center gap-4 sm:gap-6"}>
            {rightItems.map((r) => {
              const owners = rightOwners(r.id);
              const hasOwner = owners.length > 0;
              // WEB16: ô đích phải phản ánh trạng thái nối, không chỉ "đã nối".
              // Verdict lấy từ chính các nét đang đổ vào ô này (many-to-one ⇒
              // chỉ cần một nét sai là cả ô sai), nên ô luôn khớp màu đường nối.
              const verdicts = owners.map((ownerId) => edgeVerdict(ownerId, r.id));
              const state = verdicts.includes("wrong")
                ? "wrong"
                : hasOwner && verdicts.every((v) => v === "correct")
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
                  className={cn(
                    `relative flex items-center gap-2 px-4 py-3 font-bold text-center text-sm sm:text-base md:text-lg transition-all ${
                      skin.chip?.(state, "primary") ??
                      // Không dùng thẳng `chipClass`: "selected" ở cột đích nghĩa
                      // là "đang có nguồn được chọn, nhả vào đây được" (viền nét
                      // đứt), khác với "selected" ở hàng nguồn (vàng).
                      `rounded-3xl border-4 ${
                        state === "wrong"
                          ? "bg-red-50  border-red-400 text-red-600"
                          : state === "correct"
                            ? "bg-green-50  border-green-400 text-green-700 "
                            : state === "placed"
                              ? colorOf(owners[0])
                              : state === "selected"
                                ? "bg-white border-dashed border-fuchsia-300  text-slate-800 hover:border-fuchsia-500 hover:bg-fuchsia-50 "
                                : "bg-white border-slate-200 text-slate-800"
                      }`
                    }`,
                    mobile && "justify-center",
                    // web-own: xem match-chip-radius.ts.
                    "rounded-[1rem]",
                  )}
                >
                  {itemBody(r)}
                </motion.button>
              );
            })}
            </div>
          </div>
        </div>
      </div>
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
