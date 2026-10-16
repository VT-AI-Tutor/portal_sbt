/**
 * P66 — Matching / "chain", and P76 — Matching / "triad".
 * Three-column match (col 1 → col 2 → col 3), e.g. animal → food →
 * habitat. Click an item in any column, then click an item in an ADJACENT
 * column to pair; the stored edge is always normalized left-first
 * (`left→middle` or `middle→right`). `correctPairs` keeps the standard
 * Record<fromId, toId> shape — left→middle and middle→right pairs live in the
 * same record (ids must be unique across all three columns). Grading walks the
 * KEYS of correctPairs, so it never assumes keys belong to leftItems.
 *
 * `triad` (§5.9.3) reuses this renderer wholesale — same columns, same edge
 * direction, same grading. It only changes the *presentation*: the middle
 * column is the centre of the question, so it is emphasised and the hint tells
 * the student to start there. Cardinality follows the ANSWER KEY, exactly like
 * the two-column players: one outgoing link per source node, unless the key
 * itself maps a source to several targets (`isOneToManyMatch`) — which is the
 * normal shape of a `triad` centre.
 */
import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, MEDIA_MATCH_ITEM_MAX_HEIGHT, MatchItemBody, MatchPairsReveal, hasItemLabel, matchItemsHaveMedia, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import {
  MatchingColumnLabel,
  matchingColumnLabelShape,
  type MatchingColumnLabelShape,
} from "./MatchingColumnLabel";
import {
  MATCH_CHAIN_ACCENTS,
  MatchingColumnAccent,
  matchEndpointHex,
  type MatchEndpointState,
} from "./MatchingTargetColumn";
import type { RichContent } from "@/core/question-schema";
import { matchColumnItemsAlign, matchColumnItemsClass } from "@/core/exercise/display-layout";
import { useSkin, type QuestionPlayerSkin } from "@/core/exercise/skin";
import { cn } from "@/core/utils";
import { clampMatchEdgesByHop, matchCardinalityByHop, matchEdgeKey, matchTargets, normalizeMatchEdges, sameMatchEdgeSet, toggleMatchEdge, triadCentreFanOutCeiling, type MatchCardinality, type MatchEdge } from "@/core/question-schema/matching";
import {
  MATCH_ENDPOINT_CLASS,
  MATCH_EXAMPLE_CHIP_CLASS,
  MATCH_EXAMPLE_LINE_DASH,
  MATCH_EXAMPLE_LINE_HEX,
  MATCH_IDLE_SOURCE_ENDPOINT_HEX,
  MATCH_PENDING_LINE_DASH,
} from "./matching-visuals";
import { useMatchingExample } from "./useMatchingExample";

export interface ChainMatchPlayerProps extends PlayerProps {
  leftItems: { id: string; text: string; imageUrl?: string; imageWidth?: string; content?: RichContent }[];
  middleItems: { id: string; text: string; imageUrl?: string; imageWidth?: string; content?: RichContent }[];
  rightItems: { id: string; text: string; imageUrl?: string; imageWidth?: string; content?: RichContent }[];
  /** Column headers — only rendered when non-empty; never auto-generated. */
  leftTitle?: string;
  middleTitle?: string;
  rightTitle?: string;
  leftTitleContent?: RichContent;
  middleTitleContent?: RichContent;
  rightTitleContent?: RichContent;
  /** fromId (col 1 or col 2) → toId (next column) */
  correctEdges?: MatchEdge[];
  correctPairs?: Record<string, string>;
  /**
   * Link ceiling PER HOP. Dispatch reads it from the raw answer key and knows
   * whether that key is a fan-out-losing `Record`. Omitted — demo page, tests —
   * it is derived from `correctEdges`.
   */
  cardinality?: { leftToMiddle: MatchCardinality; middleToRight: MatchCardinality };
  /**
   * web#706: pre-drawn sample edges ("cặp nối mẫu"). Chuỗi ba cột nên một mẫu
   * là HAI cạnh (trái→giữa và giữa→phải), ví dụ `24 → Gấp 2 lần → 48`.
   */
  exampleEdges?: MatchEdge[];
  /** web#706: false only when the payload declared `locked: false`. */
  exampleLocked?: boolean;
  /**
   * §5.9.3 — `display.interactionType: "triad"`. Presentation only: emphasises
   * the middle column as the centre and swaps the hint. Columns, edge
   * direction and grading are identical to `chain`.
   */
  triad?: boolean;
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
 * Trần cao ẢNH của item được ĐO từ chỗ trống thật, không phải hằng số.
 *
 * Hằng số cũ ({@link MEDIA_MATCH_ITEM_MAX_HEIGHT} = 128px) suy ra từ một
 * viewport 720px giả định; đo thật trên runner sách (SubmissionRunner) ở đúng
 * 720px thì vùng cuộn chỉ còn 544px, đề bài ăn 90px và chân bài (gợi ý + nút
 * "Kiểm tra") ăn ~100px → chỉ còn ~354px cho lưới, trong khi ba hàng ảnh 128px
 * cần 492px. Tức là trần hằng số KHÔNG bao giờ đạt được mục tiêu "ba hàng lọt
 * một màn": thứ thay đổi nhiều nhất không phải viewport mà là chiều cao ĐỀ BÀI
 * (một dòng chữ hay ba dòng kèm ảnh), nên `vh`/% viewport cũng sai y hệt.
 *
 * Vậy nên đo: chỗ trống = chiều cao vùng cuộn − phần chiếm phía trên lưới −
 * chân bài − {@link NEXT_ROW_PEEK}, rồi chia cho số hàng cần thấy.
 */
const MATCH_ROWS_IN_VIEW = 3;
/**
 * Dải hàng kế tiếp cố tình chừa lại khi còn hàng chưa hiện. Nếu ba hàng lấp
 * vừa khít tới mép, học sinh lớp 1 đọc màn hình là "hết ba item" và không bao
 * giờ cuộn xuống item thứ tư — chỗ hở là affordance cuộn, không phải thừa.
 */
const NEXT_ROW_PEEK = 28;
/**
 * Sàn 96px: dưới mức này ảnh (cảnh lớp học nhiều chi tiết) nhỏ tới mức hỏng
 * chính nhiệm vụ "nhìn tranh mà nối". Màn thấp (≤720px) chạm sàn và chấp nhận
 * cuộn nhẹ — đổi lại ảnh vẫn nhìn được. Trần 176px chặn màn 4K thổi ảnh to quá.
 */
const IMAGE_CAP_MIN = 96;
const IMAGE_CAP_MAX = 176;
/** Biến CSS mang trần đo được; fallback = hằng số cũ khi chưa đo kịp. */
const IMAGE_CAP_VAR = "--match-img-max-h";

/**
 * Ô cuộn DỌC gần nhất bao `el` — vùng mà ba hàng phải lọt vào.
 *
 * BỎ QUA ô cuộn ngang của chính player: `overflow-x-auto` làm `overflow-y`
 * tính ra "auto" (CSS: một trục khác `visible` thì trục kia không còn
 * `visible`), nên nó trông y như ô cuộn dọc — mà chiều cao của nó lại do NỘI
 * DUNG quyết định. Lấy nó làm mốc thì phép đo tự tham chiếu chính mình và trần
 * ảnh luôn rơi xuống sàn. Mốc đúng là ô cuộn của PlayerShell (`flex-1`), nơi
 * chiều cao đến từ bên ngoài.
 */
function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    if (p.hasAttribute("data-matching-chain-scroll")) continue;
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.clientHeight > 0) return p;
  }
  return null;
}

/**
 * Mép dưới THẬT SỰ nhìn thấy của ô cuộn.
 *
 * `clientHeight` nói ô cuộn cao bao nhiêu, KHÔNG nói học sinh thấy được bao
 * nhiêu: runner sách phủ lên đáy một thanh nổi (bọ ong nhắc bài + "Câu trước /
 * Câu tiếp"), và ô cuộn còn có thể thò xuống dưới đáy cửa sổ. Lấy `clientHeight`
 * làm chỗ trống thì hàng thứ ba luôn bị thanh đó cắt ngang — đúng triệu chứng
 * đã thấy.
 *
 * Dò bằng `elementFromPoint` ngay trên mép dưới: nếu thứ nằm trên cùng ở điểm
 * đó KHÔNG thuộc ô cuộn thì nó đang che, lùi mép lên đỉnh của nó. Lặp vài lần
 * cho trường hợp xếp chồng nhiều thanh; rẻ hơn nhiều so với quét cả cây DOM
 * tìm phần tử `fixed`.
 */
function visibleBottomOf(scroller: HTMLElement): number {
  const r = scroller.getBoundingClientRect();
  let bottom = Math.min(r.bottom, window.innerHeight);
  const cx = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
  for (let guard = 0; guard < 4; guard++) {
    const probe = document.elementFromPoint(cx, bottom - 1);
    if (!probe || scroller.contains(probe)) break;
    const top = probe.getBoundingClientRect().top;
    if (top <= r.top || top >= bottom) break;
    bottom = top;
  }
  return bottom;
}

type Item = { id: string; text: string; imageUrl?: string; imageWidth?: string; content?: RichContent };

/** Item chỉ có tranh, không nhãn chữ — thẻ của nó ôm sát ảnh và canh giữa cột. */
const isPictureOnly = (item: Item) => !!item.imageUrl && !hasItemLabel(item);

const COLUMN_ARIA_LABEL: Record<"left" | "middle" | "right", (triad: boolean) => string> = {
  left: () => "Cột trái",
  middle: (triad) => (triad ? "Cột giữa (trung tâm)" : "Cột giữa"),
  right: () => "Cột phải",
};

/**
 * Chỗ chừa cho hàng nhãn khi payload khai THIẾU (chỉ một hai cột có tiêu đề).
 * Ba cột là ba lưới con rời nhau nên không tự cân như bản hai cột chia chung
 * hàng lưới (`itemRowOffset` của TwoColumnMatch): cột không nhãn sẽ kéo ô của
 * nó lên cao hơn hai cột kia, hàng ô gãy so le và nét nối xiên.
 *
 * Chừa theo hình CAO NHẤT đang dựng; cả ba cùng trống ⇒ không chừa gì. Đây là
 * bản vá theo HẰNG SỐ nên chỉ đúng với nhãn một dòng — nhãn dài xuống hai dòng
 * vẫn lệch. Hướng dứt điểm là cho ba nhãn chung một hàng lưới (subgrid), chờ
 * số liệu corpus + trình duyệt; xem ghi chú trong detokenize-players.mjs.
 */
export function reservedChainLabelShape(
  shapes: readonly MatchingColumnLabelShape[],
): "badge" | "text" | null {
  if (shapes.includes("badge")) return "badge";
  return shapes.includes("text") ? "text" : null;
}

/**
 * Ghép danh sách cạnh PHẲNG thành các CHUỖI trọn vẹn `trái → giữa → phải` cho
 * khối "Đáp án đúng".
 *
 * Khoá đáp án không lưu chuỗi, nó lưu từng cạnh rời; `a → m` và `m → r` chỉ
 * dính nhau ở chỗ dùng chung ô giữa `m`. In thẳng từng cạnh ra hai hàng bắt
 * học sinh tự ghép lại mới hiểu — NXB ghi nhận ở TV4 tập 1 bài 2 và bài 28
 * ("chia rối").
 *
 * Gom theo Ô GIỮA, vì chính nó quyết định hàng đó có phải một chuỗi hay không:
 *
 *  - Một vào một ra (dáng `chain`) → đúng một chuỗi `a → m → r`.
 *  - NHIỀU vào NHIỀU ra (dáng `triad`: ô giữa là một NHÓM như "NÊN" /
 *    "KHÔNG NÊN") → KHÔNG ghép. Ghép chéo đẻ ra k×j hàng và BỊA ra liên kết mà
 *    khoá không hề khai: khoá chỉ nói "a thuộc nhóm NÊN" và "e thuộc nhóm NÊN",
 *    chứ không nói a đi với e. Nhóm kiểu này in lại từng cạnh như câu hai cột.
 *  - Một bên chỉ có MỘT (một vào nhiều ra, hoặc ngược lại) → vẫn ghép: mọi hàng
 *    đều đi qua đúng một mắt xích có thật, không có gì để bịa.
 *  - Khuyết hẳn một bên (khoá khai thiếu) → in đúng phần có, thành hàng hai ô.
 *    Đáp án khuyết còn hơn đáp án biến mất.
 *
 * `edges` đã qua `normalizeChainEdges` nên mọi cạnh là (trái→giữa) hoặc
 * (giữa→phải) — vì thế "không phải ô trái" đủ để nhận ra cạnh đuôi.
 */
export function chainRevealPaths(edges: MatchEdge[], leftIds: ReadonlySet<string>): string[][] {
  const heads = edges.filter((e) => leftIds.has(e.item));
  const tails = edges.filter((e) => !leftIds.has(e.item));
  // Thứ tự ô giữa theo lần xuất hiện đầu trong khoá → thứ tự hàng bám theo thứ
  // tự tác giả khai, không phải thứ tự cột. Nói cho đủ: ô giữa có cạnh ĐẦU xếp
  // trước, rồi mới tới ô giữa chỉ có cạnh ĐUÔI — hai nhóm chỉ lệch nhau khi
  // khoá khai khuyết một bên.
  const middles = [...new Set([...heads.map((e) => e.target), ...tails.map((e) => e.item)])];
  const paths: string[][] = [];
  for (const middle of middles) {
    const into = heads.filter((e) => e.target === middle);
    const outOf = tails.filter((e) => e.item === middle);
    const isHub = into.length > 1 && outOf.length > 1;
    if (into.length === 0 || outOf.length === 0 || isHub) {
      for (const h of into) paths.push([h.item, middle]);
      for (const t of outOf) paths.push([middle, t.target]);
      continue;
    }
    for (const h of into) for (const t of outOf) paths.push([h.item, middle, t.target]);
  }
  return paths;
}

export const ChainMatchPlayer: React.FC<ChainMatchPlayerProps> = ({
  leftItems,
  middleItems,
  rightItems,
  leftTitle,
  middleTitle,
  rightTitle,
  leftTitleContent,
  middleTitleContent,
  rightTitleContent,
  correctEdges: correctEdgesProp,
  cardinality: cardinalityProp,
  correctPairs,
  exampleEdges,
  exampleLocked,
  triad = false,
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
  const hideHint = skin.presentation?.hideChainMatchHint === true;
  const reservedLabelShape = reservedChainLabelShape([
    matchingColumnLabelShape(leftTitle, leftTitleContent, MATCH_CHAIN_ACCENTS.left),
    matchingColumnLabelShape(middleTitle, middleTitleContent, MATCH_CHAIN_ACCENTS.middle),
    matchingColumnLabelShape(rightTitle, rightTitleContent, MATCH_CHAIN_ACCENTS.right),
  ]);
  const scrollHintId = useId();
  // Cửa canh-giữa-theo-trục-dọc: chỉ mở khi CÂU có media (xem
  // `matchColumnItemsClass`), và vẫn gate sau `autoMediaSizing` như mọi hành vi
  // smart theo media — tắt cờ là mọi cột dồn lên đầu đúng kiểu studio.
  const autoMediaSizing = skin.presentation?.autoMediaSizing === true;
  const centreColumnItems =
    autoMediaSizing && matchItemsHaveMedia(leftItems, middleItems, rightItems);
  const columnItemsClass = matchColumnItemsClass(centreColumnItems);
  const columnItemsAlign = matchColumnItemsAlign(centreColumnItems);
  // web#706: mẫu chỉ "khoá" khi payload KHÔNG khai báo `locked: false`.
  const exampleIsLocked = exampleLocked !== false;
  const sources = useMemo(() => [...leftItems, ...middleItems], [leftItems, middleItems]);
  const leftIds = useMemo(() => new Set(leftItems.map((item) => item.id)), [leftItems]);
  const middleIds = useMemo(() => new Set(middleItems.map((item) => item.id)), [middleItems]);
  const rightIds = useMemo(() => new Set(rightItems.map((item) => item.id)), [rightItems]);
  const validItems = useMemo(() => new Set([...leftIds, ...middleIds]), [leftIds, middleIds]);
  const validTargets = useMemo(() => new Set([...middleIds, ...rightIds]), [middleIds, rightIds]);
  const normalizeChainEdges = useCallback(
    (value: unknown) => normalizeMatchEdges(value, validItems, validTargets).filter(
      ({ item, target }) =>
        (leftIds.has(item) && middleIds.has(target)) ||
        (middleIds.has(item) && rightIds.has(target)),
    ),
    [leftIds, middleIds, rightIds, validItems, validTargets],
  );
  const correctEdges = useMemo(
    () => normalizeChainEdges(correctEdgesProp ?? correctPairs),
    [correctEdgesProp, correctPairs, normalizeChainEdges],
  );
  // Trần tính RIÊNG cho từng chặng. Một cờ cho cả câu không diễn đạt nổi một ô
  // giữa vừa nhận nhiều nét từ trái vừa toả nhiều nét sang phải — hình dạng
  // chuẩn của `triad` (§5.9.3) — nên trước đây triad phải tắt trần cho cả câu và
  // ô trái rải được nét sang mọi ô giữa. Giờ chỉ đúng chiều toả của tâm mới đổi
  // trần, và đổi sang trần đếm theo ô — xem `triadCentreFanOutCeiling`.
  const columnIds = useMemo(
    () => ({ leftIds, middleIds, rightIds }),
    [leftIds, middleIds, rightIds],
  );
  // Không có `cardinality` từ dispatch thì khoá vào bằng prop nào chính là dấu
  // hiệu: `correctPairs` là `Record` nên đánh rơi một-nhiều, `correctEdges` thì
  // không. Chỉ ca Record mới cần trần đếm theo ô cột phải.
  const keyIsRecord = correctEdgesProp == null && correctPairs != null;
  const cardinality = useMemo(
    () => cardinalityProp ?? matchCardinalityByHop(
      correctEdges,
      columnIds,
      triad && keyIsRecord
        ? { centreFanOutCeiling: triadCentreFanOutCeiling(correctEdges, columnIds) }
        : undefined,
    ),
    [cardinalityProp, columnIds, correctEdges, keyIsRecord, triad],
  );
  const hopCardinality = useCallback(
    (fromId: string): MatchCardinality => (
      leftIds.has(fromId) ? cardinality.leftToMiddle : cardinality.middleToRight
    ),
    [cardinality, leftIds],
  );
  const clampEdges = useCallback(
    (edges: MatchEdge[], protectedKeys: ReadonlySet<string>) =>
      clampMatchEdgesByHop(edges, cardinality, columnIds, protectedKeys),
    [cardinality, columnIds],
  );
  // web#706 — cặp nối mẫu của chuỗi là MỘT MẢNG hai cạnh (trái→giữa, giữa→phải).
  // Truyền `normalizeChainEdges` làm `filterEdges` để mẫu đi qua đúng luật cấu
  // trúc như mọi cạnh khác; hook giữ `hasInvalidEdges` tính từ mảng trước khi
  // ghép mẫu và `hydrationKey` tính từ mảng đã ghép.
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
    filterEdges: normalizeChainEdges,
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
  const [selected, setSelected] = useState<string | null>(null);
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const hasKey = correctEdges.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  // Element = each link's SOURCE position (col 1 or col 2 node); making/
  // changing that link grades it right away.
  // buildAnswer must see the edges of the CURRENT interaction, not the
  // render closure — clickTarget updates the ref before grading.
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  // web#706: mẫu hai cạnh khoá HAI nguồn (nút cột trái VÀ nút cột giữa) — cả hai
  // đã nối sẵn nên bị loại khỏi danh sách phần tử chấm ngay.
  const elementIds = useMemo(
    () => excludeLockedSources(sources.map((s) => s.id)),
    [excludeLockedSources, sources],
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
    // Chuỗi chỉ có đúng một mắt xích và đó là mẫu → không còn phần tử nào để
    // chấm; `useInstantGrading` coi total === 0 là done:false mãi mãi.
    recordOnly: recordOnly || elementIds.length === 0,
    buildAnswer: () => edgesRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  // Lượt "Kiểm tra" trong player vừa chấm sai — tô đỏ các liên kết sai
  // (KHÔNG tô xanh cặp đúng để không lộ đáp án khi còn được thử lại).
  const errored = status === "error";
  const allChainItems = [...leftItems, ...middleItems, ...rightItems];
  const chainItem = (id: string) => allChainItems.find((x) => x.id === id) ?? { text: "" };
  // Chuỗi ba cột hiện MỘT hàng `a → m → r` cho mỗi liên kết trọn vẹn — khoá
  // đáp án là danh sách cạnh rời nên phải ghép lại trước khi in (xem
  // `chainRevealPaths`).
  // Nguồn là `effectiveCorrectEdges` chứ KHÔNG phải `correctEdges`: cạnh MẪU
  // (web#706) có thể không nằm trong khoá, mà thiếu đúng mắt xích đó thì chuỗi
  // đứt làm hai mảnh cụt.
  //
  // Hệ quả CỐ Ý, và là chỗ player này khác bốn player nối hai cột: chuỗi nào
  // mẫu vẽ trọn vẹn thì nay cũng có một hàng trong khối đáp án, trong khi
  // TwoColumn/Rows/Radial/ConnectLines vẫn đọc `correctEdges` nên bỏ hẳn cặp
  // mẫu. Ở đây không tách được: mẫu của chuỗi là MỘT MẢNG hai cạnh, lọc nửa
  // vời thì hàng cụt. Cặp mẫu vốn đã vẽ sẵn trên đề nên in lại không lộ gì
  // thêm. Muốn năm player thống nhất thì sửa ở bốn player kia, đừng lùi cái
  // này về `correctEdges`.
  // Kèm theo: `prependMissing` đẩy cạnh mẫu lên đầu, nên câu có mẫu thì hàng
  // mẫu đứng trước chứ không theo thứ tự tác giả khai — đúng thứ tự học sinh
  // thấy trên đề.
  // web-own: chưa upstream lên studio — xem WEB-OWN PATCHES trong
  // apps/learner/scripts/detokenize-players.mjs.
  const reveal = recordOnly ? undefined : (
    <MatchPairsReveal
      rows={chainRevealPaths(effectiveCorrectEdges, leftIds).map((ids) => ids.map(chainItem))}
    />
  );

  // Stable color per source item.
  const colorIndex = (fromId: string) =>
    sources.findIndex((s) => s.id === fromId) % PAIR_COLORS.length;
  const colorOf = (fromId: string) => PAIR_COLORS[colorIndex(fromId)];
  /**
   * Màu nét chờ của ô ĐANG ĐƯỢC CHỌN. Ô cột phải không nằm trong `sources` nên
   * `colorIndex` trả -1 cho nó (nét chờ mất màu), mà chuỗi ba cột cho phép bấm
   * từ phải sang trái — nên nút ngoài `sources` lấy vị trí trong cột của nó.
   */
  const selectionColorIndex = (id: string) => {
    const asSource = sources.findIndex((s) => s.id === id);
    if (asSource >= 0) return asSource % PAIR_COLORS.length;
    const asRight = rightItems.findIndex((r) => r.id === id);
    // `selected` luôn là id của một nút đã render nên nhánh -1 không tới được;
    // trả 0 cho nó là để nét chờ có màu chứ không phải để giấu id lạ.
    return (asRight < 0 ? 0 : asRight) % PAIR_COLORS.length;
  };

  // ── Connection-line anchors (right edge of source → left edge of target).
  const containerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const capRef = useRef(0);
  const [anchors, setAnchors] = useState<Record<string, { xL: number; xR: number; y: number }>>({});

  /** Số hàng ảnh của cột nhiều tranh nhất — cột quyết định chiều cao lưới. */
  const pictureRows = Math.max(
    ...[leftItems, middleItems, rightItems].map((col) => col.filter((it) => it.imageUrl).length),
  );

  /**
   * Đo chỗ trống thật rồi phát trần ảnh qua biến CSS (xem MATCH_ROWS_IN_VIEW).
   *
   * Đo thay vì tính từ hằng số vì mọi số hạng đều đổi theo câu hỏi và theo
   * runner: chiều cao vùng cuộn, chiều cao đề bài phía trên, chân bài (chế độ
   * phụ huynh không có nút "Kiểm tra"), và cả `chrome` của thẻ (padding +
   * viền + khoảng cách) vốn khác nhau giữa breakpoint. `chrome` lấy từ một thẻ
   * đang render (cao thẻ − cao ảnh) nên không phụ thuộc chính trần đang đặt →
   * vòng đo lại hội tụ, không dao động.
   */
  const updateImageCap = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const scroller = scrollParentOf(c);
    // Ảnh mẫu: không có tranh nào thì không cần trần.
    const sampleImg = c.querySelector<HTMLImageElement>("[data-match-picture-card] img");
    const card = sampleImg?.closest("button");
    // Lớp bọc item (`[data-matching-chain-items]`), KHÔNG phải cả cột: tiêu đề
    // cột nằm ngoài nó, nên `rowGap` ở đây đúng là khoảng cách giữa hai thẻ.
    const itemList = card?.parentElement;
    const firstCard = itemList?.querySelector("button");
    if (!scroller || !sampleImg || !card || !itemList || !firstCard) return;

    // Runner sách mở bài bằng `animate-pop-in` (scale 0.7 → 1), và nó LỒNG
    // NHAU nên giữa animation getBoundingClientRect() trả về số nhân 0.49.
    // Trần tính từ đó sẽ sai rồi mới tự sửa ở lần đo lại → ảnh nhảy một nhịp.
    // Quy mọi số đo từ rect về px layout bằng tỉ lệ đo được (offsetWidth KHÔNG
    // chịu transform), thay vì rình animation kết thúc.
    const scale = c.getBoundingClientRect().width / (c.offsetWidth || 1) || 1;
    const layout = (v: number) => v / scale;

    // offsetHeight: px layout, miễn nhiễm transform.
    const chrome = card.offsetHeight - sampleImg.offsetHeight;
    const gap = parseFloat(getComputedStyle(itemList).rowGap) || 0;
    const sRect = scroller.getBoundingClientRect();
    // `scrollTop` bù lại: đo phải độc lập với việc học sinh đã cuộn tới đâu,
    // nếu không thì cuộn xuống là ảnh phình ra.
    const above = layout(firstCard.getBoundingClientRect().top - sRect.top) + scroller.scrollTop;
    const footer = footerRef.current
      ? layout(footerRef.current.getBoundingClientRect().bottom - c.getBoundingClientRect().bottom)
      : 0;

    const rows = Math.min(MATCH_ROWS_IN_VIEW, pictureRows);
    const peek = pictureRows > rows ? NEXT_ROW_PEEK : 0;
    // Chiều cao NHÌN THẤY (đã trừ thanh nổi che đáy), không phải clientHeight.
    const boxH = layout(visibleBottomOf(scroller) - sRect.top);
    const free = boxH - above - footer - peek;
    const cap = Math.min(
      IMAGE_CAP_MAX,
      Math.max(IMAGE_CAP_MIN, (free - rows * chrome - (rows - 1) * gap) / rows),
    );

    if (Math.abs(cap - capRef.current) > 1) {
      capRef.current = cap;
      c.style.setProperty(IMAGE_CAP_VAR, `${Math.round(cap)}px`);
    }
  }, [pictureRows]);

  const updateAnchors = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cb = c.getBoundingClientRect();
    const next: Record<string, { xL: number; xR: number; y: number }> = {};
    for (const it of [...sources, ...rightItems]) {
      const el = nodeRefs.current[it.id];
      if (el) {
        const b = el.getBoundingClientRect();
        next[it.id] = { xL: b.left - cb.left, xR: b.right - cb.left, y: b.top + b.height / 2 - cb.top };
      }
    }
    setAnchors(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftItems, middleItems, rightItems]);

  // Trần ảnh TRƯỚC, mỏ neo SAU: đặt biến CSS làm ảnh (và thẻ) đổi cao, đo mỏ
  // neo sau đó trong cùng một frame mới ra đúng vị trí cuối cùng của đường nối.
  const updateLayout = useCallback(() => {
    updateImageCap();
    updateAnchors();
  }, [updateImageCap, updateAnchors]);

  useLayoutEffect(() => {
    updateLayout();
    const obs = new ResizeObserver(() => requestAnimationFrame(updateLayout));
    if (containerRef.current) obs.observe(containerRef.current);
    const scroller = scrollParentOf(containerRef.current);
    // Vùng cuộn co lại (bàn phím ảo, chia đôi màn) mà lưới chưa đổi kích thước
    // thì ResizeObserver trên lưới không bắn — theo dõi cả ô cuộn.
    if (scroller) obs.observe(scroller);
    window.addEventListener("resize", updateLayout);
    const timers = [100, 300].map((ms) => setTimeout(updateLayout, ms));
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", updateLayout);
      timers.forEach(clearTimeout);
    };
  }, [updateLayout, edges]);

  const columnOf = (id: string) =>
    leftIds.has(id) ? 0 : middleIds.has(id) ? 1 : rightIds.has(id) ? 2 : -1;

  /**
   * True when clicking `targetId` while `selected` is held forms (or removes) a
   * legal edge: two DIFFERENT items in ADJACENT columns. Either click order is
   * allowed — the edge is normalized left-first below — so the student can start
   * from the middle column and fan out both ways, which is how a `triad` centre
   * is meant to be worked. The stored direction never changes.
   */
  const validTarget = (targetId: string) => {
    if (!selected || selected === targetId) return false;
    const from = columnOf(selected);
    const to = columnOf(targetId);
    if (from < 0 || to < 0 || Math.abs(from - to) !== 1) return false;
    // web#706: cạnh mẫu bị khoá — nút NGUỒN của nó (ô ở cột trái hơn) không nối
    // lại/xoá được. Ngoại lệ: khoá đáp án còn cạnh đúng khác cho chính nút đó
    // thì nút vẫn làm nguồn được cho cạnh còn lại.
    return canSelectSource(from < to ? selected : targetId);
  };

  const clickNode = (id: string) => {
    if (locked) return;
    setCursorPoint(null);
    if (selected === id) {
      setSelected(null);
      return;
    }
    if (validTarget(id)) {
      connect(id);
      return;
    }
    setSelected(id);
  };

  /** Nét chờ bám con trỏ trong lúc đang giữ một ô — nói "giờ bấm ô cột kề". */
  const trackCursor = (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked || !selected || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    setCursorPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  };

  const clearCursorPreview = () => setCursorPoint(null);

  function connect(otherId: string) {
    if (!selected) return;
    // Cạnh luôn lưu xuôi trái→phải, bất kể bấm ô nào trước.
    const forward = columnOf(selected) < columnOf(otherId);
    const fromId = forward ? selected : otherId;
    const targetId = forward ? otherId : selected;
    // Chính cạnh mẫu đang khoá thì bỏ qua thao tác — mẫu bất biến.
    if (isLockedExampleEdge({ item: fromId, target: targetId })) {
      setSelected(null);
      return;
    }
    // Trần của CHẶNG mà cạnh này thuộc về; `protectedKeys` giữ cạnh mẫu khỏi bị
    // trần đẩy ra, nên không cần bọc `withExample` để nhặt lại mẫu bị rơi nữa.
    const next = toggleMatchEdge(edges, fromId, targetId, {
      ...hopCardinality(fromId),
      protectedKeys,
    });
    setDraft({ hydrationKey, edges: next, hasInvalidEdges: false });
    setSelected(null);
    setCursorPoint(null);
    onAnswerChange?.(next);
    // Đổi liên kết sau khi bị chấm sai → xoá trạng thái sai để thử lại.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    // Instant: grade this source's link against its expected target set
    // right away. Toggling the last link off leaves it unanswered (idle).
    edgesRef.current = next;
    const outgoing = matchTargets(next, fromId);
    if (outgoing.length === 0) {
      instant.clear(fromId);
    } else {
      const ok = sameMatchEdgeSet(
        outgoing.map((target) => ({ item: fromId, target })),
        matchTargets(effectiveCorrectEdges, fromId).map((target) => ({ item: fromId, target })),
        validItems,
        validTargets,
      );
      instant.grade(fromId, ok ? "correct" : "incorrect");
    }
  }

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
    // web#706: so với `effectiveCorrectEdges` — mẫu hai cạnh khiến học sinh bị
    // báo thiếu HAI mắt xích nếu vẫn so với `correctEdges` gốc.
    if (edges.length < effectiveCorrectEdges.length) {
      report(edges, "incomplete");
      return;
    }
    report(edges, sameMatchEdgeSet(edges, effectiveCorrectEdges, new Set(sources.map((item) => item.id)), new Set([...middleItems, ...rightItems].map((item) => item.id))) ? "correct" : "incorrect");
  };

  useEffect(() => {
    if (submitted && status === "idle") grade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  /** Sources currently linking INTO this node (for coloring targets). */
  const ownersOf = (targetId: string) =>
    sources.filter((s) => edges.some((edge) => edge.item === s.id && edge.target === targetId)).map((s) => s.id);

  /**
   * Verdict của MỘT cạnh nối — dùng chung cho đường kẻ và cho CẢ HAI đầu.
   *
   * `instant.reveal` chỉ được ghi theo id của NÚT NGUỒN (xem `instant.grade`
   * bên dưới), nên nút chỉ đóng vai ĐÍCH (cả cột phải, và ô giữa không có cạnh
   * đi ra) tra `reveal` bằng id của chính nó thì luôn ra `undefined` → không
   * bao giờ vào được state "correct" và kẹt lại ở màu cặp. Đó chính là lỗi
   * "nối đúng hết mà chỉ vài ô xanh, số còn lại hồng/vàng".
   *
   * Cách sửa giống `TwoColumnMatchPlayer`/`ConnectLinesPlayer`: verdict tính
   * MỘT LẦN cho mỗi cạnh, theo id nguồn của cạnh đó, rồi cả hai đầu cùng đọc.
   * `null` = chưa chấm.
   */
  const edgeVerdict = (fromId: string, toId: string): "wrong" | "correct" | null => {
    const edgeCorrect = effectiveCorrectEdges.some(
      (edge) => matchEdgeKey(edge) === matchEdgeKey({ item: fromId, target: toId }),
    );
    const rv = instant.reveal(fromId);
    if (rv) return edgeCorrect ? "correct" : "wrong";
    if (submitted && edgeCorrect) return "correct";
    if ((submitted || errored) && !edgeCorrect) return "wrong";
    return null;
  };

  const renderNode = (item: Item, kind: "left" | "middle" | "right", columnSkin: QuestionPlayerSkin) => {
    // middle nodes act as BOTH target (of col 1) and source (to col 3).
    const isSource = kind !== "right";
    const isTarget = kind !== "left";
    const isSel = selected === item.id;
    const outgoingTargets = isSource ? matchTargets(edges, item.id) : [];
    const outgoing = outgoingTargets[0];
    const owners = isTarget ? ownersOf(item.id) : [];
    const paired = !!outgoing || owners.length > 0;
    // Verdict của MỌI cạnh chạm vào nút — cả cạnh ĐI RA (vai nguồn) lẫn cạnh
    // ĐỔ VÀO (vai đích). Nhờ vế thứ hai, ô cột phải và ô giữa không có cạnh đi
    // ra cũng xanh khi nối đúng, thay vì kẹt ở màu cặp.
    const verdicts = [
      ...outgoingTargets.map((target) => edgeVerdict(item.id, target)),
      ...owners.map((ownerId) => edgeVerdict(ownerId, item.id)),
    ];
    // Sai theo TẬP: nút nguồn nối thiếu/thừa so với đáp án thì từng cạnh có thể
    // vẫn "đúng" mà cả cụm vẫn sai — giữ nguyên phép so tập cũ để không nới
    // lỏng chấm điểm. Chỉ tính sau khi chấm ("Kiểm tra"/nộp), như trước.
    const setWrong =
      (submitted || errored) &&
      isSource &&
      outgoingTargets.length > 0 &&
      !sameMatchEdgeSet(
        outgoingTargets.map((target) => ({ item: item.id, target })),
        matchTargets(effectiveCorrectEdges, item.id).map((target) => ({ item: item.id, target })),
      );
    const wrong = verdicts.some((v) => v === "wrong") || setWrong;
    const right = !wrong && verdicts.length > 0 && verdicts.every((v) => v === "correct");
    // web#706: ô chạm vào cạnh mẫu mặc kiểu XÁM-ĐỨT lúc chưa chấm, y như bản hai
    // cột — trước đây chuỗi ép verdict cạnh mẫu thành "correct" nên ô mẫu xanh
    // lá ngay từ đầu và nét mẫu không bao giờ đi vào nhánh xám-đứt của nó.
    const isExampleOut = outgoingTargets.some((target) => isExampleEdge({ item: item.id, target }));
    const isExampleIn = owners.some((ownerId) => isExampleEdge({ item: ownerId, target: item.id }));
    // web#706: nút giữa vừa là đích của cột trái vừa là nguồn sang cột phải.
    // Khi nó là nguồn của cạnh mẫu thì bị khoá vai trò NGUỒN, nhưng vẫn có thể
    // nhận liên kết từ một nút cột trái khác — nên chỉ vô hiệu hoá khi nó cũng
    // không thể làm đích của lượt chọn hiện tại.
    const pictureOnly = isPictureOnly(item);
    const lockedSource = isLockedSource(item.id);
    const canBeTarget = validTarget(item.id);
    // Ô nguồn của cạnh mẫu vẫn bấm được khi nó đang là đích hợp lệ của lượt
    // chọn hiện tại, hoặc để bỏ chọn chính nó.
    const disabled = locked || (lockedSource && !canSelectSource(item.id) && !canBeTarget && !isSel);
    const clickable = !disabled;

    const state: MatchEndpointState = wrong
      ? "wrong"
      : right
        ? "correct"
        : isSel
          ? "selected"
          : paired
            ? "placed"
            : selected && validTarget(item.id)
              ? "selected"
              : "idle";

    const fallback = `rounded-3xl border-4 ${
      wrong
        ? "bg-red-50  border-red-400 text-red-600"
        : right
          ? "bg-green-50  border-green-400 text-green-700 "
          : isSel
            ? "bg-yellow-100  border-yellow-400 text-yellow-800  scale-[1.02]"
            : paired
              ? colorOf(outgoing ? item.id : owners[0])
              : selected && validTarget(item.id)
                ? "bg-white border-dashed border-fuchsia-300  text-slate-800 hover:border-fuchsia-500 hover:bg-fuchsia-50 "
                : "bg-white border-slate-200 text-slate-800 hover:border-fuchsia-300  hover:bg-fuchsia-50 "
    }`;

    return (
      <motion.button
        key={item.id}
        ref={(el) => {
          nodeRefs.current[item.id] = el;
        }}
        type="button"
        whileHover={clickable ? { scale: 1.03 } : undefined}
        whileTap={clickable ? { scale: 0.96 } : undefined}
        onClick={() => clickNode(item.id)}
        disabled={disabled}
        data-match-picture-card={pictureOnly ? "true" : undefined}
        className={cn(
          `relative flex items-center gap-2 px-3 py-2.5 font-bold text-left text-sm sm:text-base transition-all ${
            !wrong && !right && (isExampleOut || isExampleIn)
              ? MATCH_EXAMPLE_CHIP_CLASS
              : columnSkin.chip?.(state, "primary") ?? fallback
          }`,
          // web-own: xem match-chip-radius.ts.
          "rounded-[1rem]",
          // Thẻ chỉ có tranh: `self-center` vừa bỏ stretch của cột (thẻ ôm sát
          // ảnh) vừa canh giữa theo trục ngang — một lớp làm cả hai. `min-w`
          // giữ mỏ neo đường nối khỏi răng cưa khi các ảnh lệch tỉ lệ. Ô chữ
          // (cột giữa) GIỮ full-width: đó là vùng bấm chữ, ôm sát sẽ thành dãy
          // pill so le và nhỏ đi vô cớ.
          //
          // `p-1.5` đè `px-3 py-2.5`: đệm của thẻ chữ là để chữ không dính
          // viền, tranh thì không cần — viền ôm sát mép ảnh, và mỗi hàng bớt
          // 8px giúp ba hàng lọt màn dễ hơn. Bo 16px với đệm 6px vẫn không cắt
          // vào góc ảnh.
          pictureOnly && "min-w-[8rem] justify-center self-center p-1.5",
        )}
      >
        {/* Đầu VÀO (mép trái) — chỉ ô nhận cạnh mới có; ô đã nối giữ màu cặp vì
            đó là thứ chỉ ra ô nào nối với ô nào, còn lúc trống thì ăn theo TÔNG
            CỘT để ba cột tự phân biệt. */}
        {isTarget && (
          <span
            data-matching-endpoint="target"
            className={`${MATCH_ENDPOINT_CLASS} -left-3`}
            style={{
              background: isExampleIn
                ? MATCH_EXAMPLE_LINE_HEX
                : owners.length > 0
                  ? LINE_HEX[colorIndex(owners[0])]
                  // Chấm đầu nối đọc CÙNG một `state` với ô — không thể lệch màu viền.
                  : matchEndpointHex(MATCH_CHAIN_ACCENTS[kind], state),
            }}
          />
        )}
        <MatchItemBody
          item={item}
          labelClassName="flex-1"
          imageMaxHeight={`var(${IMAGE_CAP_VAR}, ${MEDIA_MATCH_ITEM_MAX_HEIGHT})`}
        />
        {/* Đầu RA (mép phải) — chỉ ô có thể phát cạnh; xám khi còn trống. */}
        {isSource && (
          <span
            data-matching-endpoint="source"
            className={`${MATCH_ENDPOINT_CLASS} -right-3`}
            style={{
              background: isExampleOut
                ? MATCH_EXAMPLE_LINE_HEX
                : outgoing
                  ? LINE_HEX[colorIndex(item.id)]
                  : MATCH_IDLE_SOURCE_ENDPOINT_HEX,
            }}
          />
        )}
      </motion.button>
    );
  };

  /**
   * web-own: chưa upstream lên studio — xem WEB-OWN PATCHES trong
   * apps/learner/scripts/detokenize-players.mjs.
   *
   * Một cột = một accent. Bọc NGOÀI thẻ cột (`AccentProvider` render một lớp
   * `display: contents`) để thẻ cột vẫn là con trực tiếp của lưới và tiêu đề
   * vẫn là `firstElementChild` của nó.
   */
  const renderColumn = (
    kind: "left" | "middle" | "right",
    items: Item[],
    title: string | undefined,
    titleContent: RichContent | undefined,
  ) => (
    <MatchingColumnAccent accent={MATCH_CHAIN_ACCENTS[kind]}>
      {(columnSkin) => (
        // web-own: cột giữa của `triad` KHÔNG còn khung nét đứt + nền tím.
        // NXB 09/2026 (Đạo đức, TV, LS&ĐL): khung ăn mất chỗ nối và làm cột
        // giữa trông rỗng, trong khi nó chỉ chứa nhãn nhóm ngắn. Dấu "trung
        // tâm" vẫn còn ở `data-matching-triad-centre` cho QA.
        // Xem WEB-OWN PATCHES trong apps/learner/scripts/detokenize-players.mjs.
        <div
          className="flex min-w-0 flex-col gap-2 sm:gap-3"
          data-matching-chain-column={kind}
          data-matching-triad-centre={kind === "middle" && triad ? "true" : undefined}
          aria-label={COLUMN_ARIA_LABEL[kind](triad)}
        >
          {matchingColumnLabelShape(title, titleContent, MATCH_CHAIN_ACCENTS[kind]) !==
            "none" || reservedLabelShape === null ? (
            <MatchingColumnLabel
              title={title}
              titleContent={titleContent}
              badgeTone={MATCH_CHAIN_ACCENTS[kind]}
              className="mb-1 px-1"
            />
          ) : (
            <div
              aria-hidden
              data-matching-col-title-spacer={reservedLabelShape}
              className={cn("mb-1 px-1", reservedLabelShape === "badge" ? "h-11" : "h-5")}
            />
          )}
          <div className={columnItemsClass} data-matching-chain-items data-matching-items-align={columnItemsAlign}>
            {items.map((item) => renderNode(item, kind, columnSkin))}
          </div>
        </div>
      )}
    </MatchingColumnAccent>
  );

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <p id={scrollHintId} className="sr-only">
        Trên màn hình hẹp, dùng phím mũi tên hoặc thao tác cuộn ngang để xem đủ ba cột.
      </p>
      <div
        role="region"
        aria-label={triad ? "Bài nối ba cột lấy giữa làm trung tâm" : "Bài nối chuỗi ba cột"}
        aria-describedby={scrollHintId}
        tabIndex={0}
        data-matching-chain-scroll
        // `px-2 pt-0.5`: CHỪA CHỖ CHO HIỆU ỨNG, không phải để trang trí. Vùng
        // cuộn cắt mọi thứ vẽ ra ngoài padding-box, mà thẻ chọn mang
        // `scale-[1.02]` nên phình đều bốn phía — đo trên `95131076/bai2` câu 1:
        // thẻ sát mép trái (L0) bị xén đúng nét viền.
        //
        // Con số lấy từ mức phình = 1% bề rộng thẻ mỗi bên: thẻ 157px cần 1,6px,
        // thẻ 550px cần 5,5px → 8px phủ tới thẻ ~800px, rộng hơn mọi cột ba-cột
        // thực tế. Chiều dọc chỉ cần 1% chiều cao (0,4–1,2px) nên 2px là đủ.
        className="w-full min-w-0 overflow-x-auto px-2 pt-0.5 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2"
      >
      <div
        ref={containerRef}
        data-matching-canvas="true"
        className="relative min-w-[42rem]"
        onPointerMove={trackCursor}
        onPointerLeave={clearCursorPreview}
        onPointerCancel={clearCursorPreview}
      >
        {/* SVG overlay: one line per link (source right edge → target left edge). */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          {edges.map(({ item: fromId, target: toId }) => {
            const from = anchors[fromId];
            const to = anchors[toId];
            if (!from || !to) return null;
            // Cùng một `edgeVerdict` với hai đầu nút: đường kẻ và hai ô nó nối
            // không thể lệch màu nhau nữa.
            const verdict = edgeVerdict(fromId, toId);
            const okLine = verdict === "correct";
            // Wrong lines turn red after an in-player "Kiểm tra" too (errored);
            // correct lines keep their pair color until submit/success.
            const wrongLine = verdict === "wrong";
            // web#706: CẢ HAI cạnh mẫu đều vẽ xám đứt nét khi đang làm bài; lúc
            // đã chấm thì màu đúng/sai vẫn thắng (giống scene player).
            const sample = isExampleEdge({ item: fromId, target: toId });
            const restingSample = sample && !wrongLine && !okLine;
            const stroke = wrongLine ? "#ef4444" : okLine ? "#22c55e" : restingSample ? MATCH_EXAMPLE_LINE_HEX : LINE_HEX[colorIndex(fromId)];
            return (
              <React.Fragment key={`${fromId}-${toId}`}>
                {!submitted && !sample && (
                  <line
                    data-line-role="guide"
                    x1={from.xR}
                    y1={from.y}
                    x2={to.xL}
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
                  data-matching-edge={`${fromId}->${toId}`}
                  data-edge-locked={sample && exampleIsLocked ? "true" : undefined}
                  // Cạnh mẫu KHÔNG chạy hoạt ảnh vẽ-dần: `pathLength` được motion
                  // hiện thực bằng chính `stroke-dasharray`, nên nó ghi đè nét đứt
                  // "3 2" ("0 1" lúc đầu, "1 1" lúc xong) và mẫu luôn ra nét LIỀN.
                  // Mẫu vốn là nét in sẵn trên trang giấy — vẽ dần nó cũng sai nghĩa.
                  initial={restingSample ? false : { pathLength: 0 }}
                  animate={restingSample ? undefined : { pathLength: 1 }}
                  transition={{ duration: 0.3 }}
                  x1={from.xR}
                  y1={from.y}
                  x2={to.xL}
                  y2={to.y}
                  stroke={stroke}
                  strokeWidth={restingSample ? 2 : 4}
                  strokeDasharray={restingSample ? MATCH_EXAMPLE_LINE_DASH : undefined}
                  strokeLinecap="round"
                  className="opacity-80"
                />
              </React.Fragment>
            );
          })}
          {/* Nét chờ: bám con trỏ từ mép GẦN nó nhất, vì chuỗi cho nối cả sang
              trái lẫn sang phải — neo cứng một mép thì nét vắt ngang qua ô. */}
          {!locked && selected && cursorPoint && anchors[selected] && (
            <line
              data-line-role="cursor-preview"
              x1={
                cursorPoint.x >= (anchors[selected].xL + anchors[selected].xR) / 2
                  ? anchors[selected].xR
                  : anchors[selected].xL
              }
              y1={anchors[selected].y}
              x2={cursorPoint.x}
              y2={cursorPoint.y}
              stroke={LINE_HEX[selectionColorIndex(selected)]}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={MATCH_PENDING_LINE_DASH}
              className="opacity-60"
            />
          )}
        </svg>

        {/* `gap-6` chứ không `gap-4`: chấm đầu nối thò ra 12px mỗi bên, hai cột
            kề nhau cần ít nhất 24px để hai chấm không chồng lên nhau. */}
        <div className="grid grid-cols-3 gap-6 sm:gap-8" data-matching-chain-grid>
          {/* HAI điều kiện, cả hai đều bắt buộc (58086b6 dặn lại sau khi #92 bị gỡ):

              1. Tiêu đề cột NẰM YÊN trên đỉnh, chỉ các ô nối mới dịch. Ba tiêu đề
                 là một hàng đọc ngang ("Đặc điểm ngoại hình | Nhân vật | Hình
                 ảnh…"); canh giữa cả cột thì mỗi tiêu đề trôi tới một cao độ khác
                 nhau theo số item của cột — hàng tiêu đề gãy so le. Nên tách: cột
                 giữ `flex-col` thường (tiêu đề dính đỉnh), lớp bọc item nhận hết
                 chỗ còn lại và canh giữa TRONG ĐÓ.
              2. Chỉ canh giữa khi CÂU có media — `matchColumnItemsClass` giữ lý do.
                 Câu toàn chữ dồn lên đầu như studio.

              Khi cửa mở: cột ít ô hơn (ví dụ cột phải 2 tranh so với 3 bên trái)
              cân quanh cột giữa, đường nối toả ra từ tâm thay vì chúc xuống. Cột
              cao nhất tự quyết chiều cao lưới nên nó không bị cắt. */}
          {renderColumn("left", leftItems, leftTitle, leftTitleContent)}
          {/* Triad: cột giữa là TRUNG TÂM của câu hỏi, nhưng KHÔNG đánh dấu
              bằng khung nữa — NXB 09/2026 bắt bỏ, xem `renderColumn`. Dấu còn
              lại là `data-matching-triad-centre` (cho QA) và dòng gợi ý riêng
              "bấm ô cột giữa trước". Bản `.match-col--triad` của
              nxbgd-sbt-digital và bản studio vẫn vẽ khung — đừng thấy lệch mà
              dựng lại. */}
          {renderColumn("middle", middleItems, middleTitle, middleTitleContent)}
          {renderColumn("right", rightItems, rightTitle, rightTitleContent)}
        </div>
      </div>
      </div>

      {/* Chân bài gom một khối để đo được: trần ảnh phải trừ đúng phần này, và
          nó đổi theo chế độ (phụ huynh không có nút "Kiểm tra"). Băng "Đáp án
          đúng"/kết quả nằm NGOÀI khối — chúng chỉ hiện sau khi chấm, tính vào
          trần thì ảnh co lại ngay lúc học sinh đang xem kết quả. */}
      <div ref={footerRef}>
      {/* web-own: `hideChainMatchHint` (sách Đạo đức) bỏ hai câu HƯỚNG DẪN
          nhưng giữ câu phản hồi lúc đang giữ một ô — xem WEB-OWN PATCHES trong
          apps/learner/scripts/detokenize-players.mjs.

          Thẻ LUÔN render, ẩn thì thay bằng một khoảng trắng: nó nằm trong
          `footerRef` mà `updateImageCap` đo để tính trần ảnh, nên cho nó
          mọc/biến theo thao tác là ảnh co giãn ngay lúc học sinh đang bấm. */}
      {!locked && (
        <p
          className="mt-2 text-center text-xs text-slate-500"
          data-matching-chain-hint
          aria-hidden={hideHint && !selected ? true : undefined}
        >
          {selected
            ? "Đã chọn 1 ô → bấm ô ở cột kề để nối."
            : hideHint
              ? "\u00A0"
              : triad
                ? "Bấm ô cột giữa rồi bấm ô ở cột kề để nối (mỗi ô giữa nối được nhiều ô)."
                : "Bấm ô ở một cột rồi bấm ô ở cột kề để nối thành chuỗi."}
        </p>
      )}

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
      </div>
    </PlayerShell>
  );
};
