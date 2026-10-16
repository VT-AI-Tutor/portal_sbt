/**
 * P62 — Image Color Classify / "image_color".
 * schema: classification · interactionType: "image_color"
 *
 * Học sinh chọn màu (category) từ palette, sau đó bấm vào vùng (item) trên
 * hình để tô màu đó vào vùng. Mỗi vùng được định nghĩa bằng shape "circle"
 * (x, y là tâm + radius) hoặc "rect" (x, y là góc trên trái + width, height).
 * Tất cả tọa độ chuẩn hóa 0–1 theo chiều rộng/chiều cao của ảnh.
 *
 * Hình học đó chỉ dùng để BẮT CLICK. Phần màu nhìn thấy đi theo mặt nạ dựng từ
 * chính nét vẽ của bức tranh (`region-ink-overlay`): tô kín hình được nét vẽ
 * bao quanh, không tràn ra nền. Vùng nào không dựng được mặt nạ thì mới tô
 * theo đúng hình học khai báo như trước.
 *
 * Nhóm nào khai `mark` (✓ / ✗ / …) thì vùng KHÔNG tô màu nữa: vẽ một ô vuông
 * trắng viền màu nhóm, dấu nằm giữa ô — đúng dạng NXB đòi ("tạo ô vuông trên
 * mỗi học sinh để đánh dấu v, x"), và tranh bên dưới không bị mảng màu che.
 * Không khai `mark` thì mọi thứ y như cũ.
 *
 * correctAnswer = Record<itemId, categoryId>
 */
import React, { useMemo, useRef, useState } from "react";
import { PlayerInlineFeedback, PlayerShell, useGrading, useInstantGrading, useHydratedRecordAnswer, CORRECT_COLOR, WRONG_COLOR, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { MoveArea, RadiusHandle, ResizeHandle, useFieldResize } from "@/core/exercise/field-resize-context";
import { InkRegionOverlay, useInkRegionMasks, type InkPaintLayer } from "./region-ink-overlay";
import { parseColorString, toRgbOr, type Rgb } from "./cssColor";
// web-own: chưa upstream lên studio — xem WEB-OWN PATCHES trong
// apps/learner/scripts/detokenize-players.mjs. Phần tính toán của ô đánh dấu ở
// tệp riêng nên copy đè từ studio không xoá được; chỉ phải nối lại các chỗ gọi.
import {
  DEFAULT_CIRCLE_RADIUS,
  DEFAULT_RECT_SIDE,
  EMPTY_MARK_COLOR,
  MARK_BORDER_PX,
  MARK_BORDER_THIN_BELOW_PX,
  MARK_BORDER_THIN_PX,
  MARK_FILL,
  MARK_GHOST_OPACITY,
  MARK_GLYPH_SCALE,
  MARK_RADIUS_RATIO,
  markBoxSize,
  markGlyph,
  polygonBounds,
  regionCenter,
} from "./image-color-mark";
import { nameOrOrdinal } from "./answer-name";

export interface ColorCategory {
  id: string;
  label: string;
  /** CSS color string, e.g. "#ef4444". */
  color?: string;
  /**
   * Dấu vẽ vào giữa vùng thay cho mảng màu — một ký tự người soạn khai ("✓",
   * "✗", "?"…). Bỏ trống = giữ lối tô màu cũ, nên 93 câu image_color đang chạy
   * không xê dịch. Để tự do một ký tự chứ không enum: nhãn "v"/"x" viết tay hay
   * một dấu khác NXB đòi sau này đều dùng được mà không phải sửa schema lần nữa.
   * Khai cả một chữ dài thì ô cắt bớt (overflow hidden) chứ không tràn ra tranh.
   */
  mark?: string;
}

export interface ImageRegionItem {
  id: string;
  label?: string;
  shape: "circle" | "rect" | "polygon";
  /** Normalized 0–1. For circle: center. For rect: top-left corner. Polygon: unused. */
  x?: number;
  y?: number;
  /** Circle only — normalized 0–1 relative to image width. */
  radius?: number;
  /** Rect only — normalized 0–1. */
  width?: number;
  /** Rect only — normalized 0–1. */
  height?: number;
  /** Polygon only — vertices as normalized 0–1 `[x, y]` pairs (needs ≥ 3). */
  points?: Array<[number, number]>;
}

export interface ImageColorClassifyPlayerProps extends PlayerProps {
  imageUrl: string;
  imageAlt?: string;
  categories: ColorCategory[];
  items: ImageRegionItem[];
  /** correctAnswer already coerced to Record<itemId, categoryId>. */
  correctMappings: Record<string, string>;
}

const FALLBACK_COLOR = "#94a3b8";

// Hex alpha suffixes for this player, appended to a #rrggbb colour: FILL_ALPHA
// (~33%) tints a painted-region fill, RING_ALPHA (~27%) the verdict feedback ring.
const FILL_ALPHA = "55";
const RING_ALPHA = "44";

// Alpha 0–255 dùng cho lớp tô theo nét vẽ (canvas nhận số, không nhận hậu tố hex).
const FILL_ALPHA_VALUE = parseInt(FILL_ALPHA, 16);
// Bản [r,g,b] của các màu cố định, tính sẵn ở mức module (parseColorString là
// hàm thuần, không đụng document — an toàn khi import phía server).
const FALLBACK_RGB = parseColorString(FALLBACK_COLOR)!;
const CORRECT_RGB = parseColorString(CORRECT_COLOR)!;
const WRONG_RGB = parseColorString(WRONG_COLOR)!;
// Rê chuột lên vùng chưa tô: hiện nhạt phần sắp được tô, thay cho khung nét đứt
// cũ — học sinh vẫn biết bấm vào đâu mà tranh không bị vẽ đè hình chữ nhật.
const HOVER_ALPHA_VALUE = 0x2e;

// web-own: ba trạng thái của ô đánh dấu. "empty" = ô rỗng chờ bấm, "preview" =
// đang rê chuột nên hiện mờ dấu sắp đánh, "marked" = đã đánh (và chỉ trạng thái
// này mới mang màu đúng/sai).
type MarkState = "empty" | "preview" | "marked";

interface MarkLayer {
  item: ImageRegionItem;
  /** Dấu vẽ trong ô; chuỗi rỗng = ô còn trống. */
  glyph: string;
  /** Màu viền + màu dấu: màu nhóm, màu đúng/sai, hoặc xám khi còn trống. */
  color: string;
  /** Cạnh ô (px), đã chặn trên chặn dưới. */
  size: number;
  state: MarkState;
}

/**
 * Cỡ ảnh ĐANG HIỂN THỊ (px) để quy cỡ dấu ra pixel thật. Không đo được (SSR,
 * jsdom, trình duyệt cũ không có ResizeObserver) thì trả 0 — cỡ dấu rơi về chặn
 * dưới, vẫn vẽ ra dấu chứ không biến mất.
 */
function useRenderedSize(ref: React.RefObject<HTMLElement | null>): {
  size: { w: number; h: number };
  measure: () => void;
} {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const measure = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setSize((prev) =>
      prev.w === el.clientWidth && prev.h === el.clientHeight
        ? prev
        : { w: el.clientWidth, h: el.clientHeight },
    );
  }, [ref]);
  React.useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Khung co theo bề ngang màn hình (xoay máy, mở/đóng cột bên) — quan sát
    // liên tục chứ không đo mỗi lần mount. Lúc mount thì ảnh thường CHƯA tải
    // xong nên khung cao 0; cỡ thật đến từ `onLoad` của ảnh, xem chỗ gọi.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, measure]);
  return { size, measure };
}

export const ImageColorClassifyPlayer: React.FC<ImageColorClassifyPlayerProps> = ({
  imageUrl,
  imageAlt,
  categories,
  items,
  correctMappings,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment = false,
  answer,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  ...shell
}) => {
  const skin = useSkin();
  // Studio edit-preview mode (false for students); polygons stop painting so
  // they don't swallow the studio's pointer events.
  const geometryEditing = Boolean(useFieldResize()?.onGeometry);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(
    categories[0]?.id ?? null,
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Mặt nạ tô ôm sát nét vẽ, dựng từ pixel của chính bức tranh. null ở chế độ
  // sửa hình học (tác giả cần thấy đúng rect/circle đang kéo) và ở mọi trường
  // hợp không đọc được pixel — khi đó vùng nào cũng rơi về lối tô hình học cũ.
  const inkMasks = useInkRegionMasks(imageUrl, items, !geometryEditing);
  // Kênh khôi phục: Record<itemId, categoryId> đã lưu hydrate lại các vùng đã tô.
  const [assignments, setAssignments] = useHydratedRecordAnswer(answer);
  // buildAnswer (useInstantGrading) đọc bản assignments MỚI NHẤT — ref tránh
  // closure cũ, giống pickedRef ở MultiChoicePlayer.
  const assignmentsRef = useRef(assignments);
  assignmentsRef.current = assignments;

  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const hasKeyEarly = Object.keys(correctMappings).length > 0;
  const recordOnlyEarly = selfAssessment === true || !hasKeyEarly;
  const instantActive = instantFeedback && !recordOnlyEarly;
  // CHẤM NGAY không khoá câu khi đúng (giống MultiChoice/TileSelect): học sinh
  // vẫn tô lại được. Chỉ đường chấm-khi-hoàn-thành cũ mới khoá sau khi đúng.
  const locked = submitted || (!instantActive && status === "success");

  // CHẤM NGAY từng vùng: tô đúng màu key → xanh ✓, tô sai (hoặc tô vùng không
  // thuộc đáp án) → đỏ, bỏ tô → xoá verdict. onElementGraded đẩy mascot mừng/
  // nhắc theo TỪNG thao tác; verdict CẢ CÂU do handleRegionClick tự báo khi
  // assignments khớp CHÍNH XÁC correctMappings (giống sameSet ở MultiChoice).
  const elementIds = useMemo(() => items.map((it) => it.id), [items]);
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly: recordOnlyEarly,
    buildAnswer: () => assignmentsRef.current,
    report,
    onElementGraded,
    onProgress,
  });

  // Geometry editing (studio edit preview only — the context is null everywhere
  // else, so MoveArea/handles render nothing for students).
  const geometryContainerRef = useRef<HTMLDivElement>(null);
  // Stable per-region RefObjects, for MoveArea / handle targetRefs.
  const regionRefObjects = useRef<Record<string, React.MutableRefObject<HTMLDivElement | null>>>({});
  const regionRefObject = (id: string) => (regionRefObjects.current[id] ??= { current: null });
  // Khung ảnh đang hiển thị — chỉ dùng để quy cỡ ô đánh dấu ra pixel.
  const { size: containerSize, measure: measureContainer } = useRenderedSize(geometryContainerRef);

  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  // Câu "đánh dấu" (có ít nhất một nhóm khai `mark`) đi lối ô vuông; câu còn
  // lại giữ nguyên lối tô màu.
  const hasMarks = categories.some((cat) => markGlyph(cat));
  const hasKey = hasKeyEarly;
  const recordOnly = recordOnlyEarly;
  const reveal = !recordOnly
    ? items
        .filter((item) => correctMappings[item.id])
        .map((item) => {
          const ci = categories.findIndex((c) => c.id === correctMappings[item.id]);
          return `${nameOrOrdinal(item, items.indexOf(item), "Vùng")} → ${nameOrOrdinal(categories[ci], ci, "Nhóm")}`;
        })
        .join("\n")
    : null;

  // ── Interaction ──────────────────────────────────────────────────────────

  const handleRegionClick = (itemId: string) => {
    if (locked || !selectedCatId) return;

    const next = { ...assignments };
    // Toggle: bấm lại vùng đang tô đúng màu đang chọn thì xoá tô;
    // vùng đang tô màu KHÁC thì tô đè bằng màu đang chọn.
    if (next[itemId] === selectedCatId) delete next[itemId];
    else next[itemId] = selectedCatId;
    setAssignments(next);
    assignmentsRef.current = next;

    // CHẤM NGAY: chấm riêng vùng vừa thao tác, mascot phản hồi theo từng bước.
    if (instant.active) {
      if (next[itemId]) {
        // tô vùng có key → so màu; tô vùng KHÔNG key (phải để trống) → luôn sai.
        instant.grade(itemId, correctMappings[itemId] === next[itemId] ? "correct" : "incorrect");
      } else {
        instant.clear(itemId);
      }
      // Cả câu đúng khi mọi vùng khớp CHÍNH XÁC: vùng có key đúng màu, vùng
      // không key để trống. (instant.grade đã emit "incomplete" cho bước dở.)
      if (items.every((item) => (next[item.id] ?? undefined) === (correctMappings[item.id] ?? undefined))) {
        report(next, "correct");
      }
      return;
    }

    // A partial answer map is valid for image_color: regions without a key in
    // correctAnswer are intentionally left unpainted. Only wait for every
    // keyed region before grading; otherwise one-color exercises with only a
    // subset of target regions can never be completed.
    const requiredItems = items.filter((item) => correctMappings[item.id]);
    const allRequiredDone = requiredItems.every((item) => next[item.id]);
    const allItemsDone = items.every((item) => next[item.id]);
    if ((!hasKey && !allItemsDone) || (hasKey && !allRequiredDone)) {
      onAnswerChange?.(next);
      return;
    }

    if (selfAssessment || !hasKey) {
      report(next, "incomplete");
      return;
    }

    // Exact match: keyed regions must have their expected color and regions
    // without a key must remain unpainted.
    const isCorrect = items.every((item) => next[item.id] === correctMappings[item.id]);
    report(next, isCorrect ? "correct" : "incorrect");
  };

  // ── Region style helpers ─────────────────────────────────────────────────

  /** Vùng này tô theo nét vẽ (canvas) chứ không tô theo hình học khai báo. */
  const inkPainted = (itemId: string) => Boolean(inkMasks?.byId[itemId]);

  // Verdict per-element: CHẤM NGAY thắng (instant.reveal), nếu không thì rơi
  // về đường chấm-khi-khoá cũ. reveal trả undefined ở chế độ parent (chấm kín).
  function verdictFor(itemId: string) {
    const assignedCatId = assignments[itemId];
    return (
      instant.reveal(itemId) ??
      (locked && hasKey && assignedCatId
        ? correctMappings[itemId] === assignedCatId
          ? "correct"
          : "incorrect"
        : undefined)
    );
  }

  function regionStyle(item: ImageRegionItem): React.CSSProperties {
    const style: React.CSSProperties = {
      position: "absolute",
      cursor: locked ? "default" : selectedCatId ? "pointer" : "not-allowed",
      transition: "background-color 0.18s, border-color 0.18s, box-shadow 0.18s",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };

    // Box shapes always carry x/y; `?? 0` only satisfies the now-optional type
    // (polygons never reach here — they render as SVG).
    const x = item.x ?? 0;
    const y = item.y ?? 0;
    if (item.shape === "circle") {
      const r = item.radius ?? DEFAULT_CIRCLE_RADIUS;
      style.left = `${(x - r) * 100}%`;
      style.top = `${(y - r) * 100}%`;
      style.width = `${r * 200}%`;
      style.height = `${r * 200}%`;
      style.borderRadius = "50%";
    } else {
      style.left = `${x * 100}%`;
      style.top = `${y * 100}%`;
      style.width = `${(item.width ?? DEFAULT_RECT_SIDE) * 100}%`;
      style.height = `${(item.height ?? DEFAULT_RECT_SIDE) * 100}%`;
    }

    // Vùng có mặt nạ nét vẽ: cái <div> này chỉ còn là vùng bắt click, phần
    // nhìn thấy do canvas vẽ — không nền, không viền, không đè lên tranh.
    if (inkPainted(item.id)) return style;

    const assignedCatId = assignments[item.id];
    const cat = assignedCatId ? catById[assignedCatId] : null;
    // web-own: câu đánh dấu — ô vuông ở lớp phủ là toàn bộ phần nhìn thấy (kể
    // cả viền đúng/sai), div này lui về làm vùng bắt click. Kể cả vùng chưa
    // đánh, nếu không ô rỗng sẽ nằm trong một vòng nét đứt thừa. Câu TRỘN (có
    // nhóm khai dấu, có nhóm không) thì nhóm không khai vẫn tô màu. Trừ chế độ
    // sửa hình học: tác giả cần thấy ranh giới vùng đang kéo, mà ô dấu bé hơn
    // vùng nên không thay được vai đó.
    if (!geometryEditing && hasMarks && (!assignedCatId || markGlyph(cat))) return style;

    const color = cat?.color ?? null;
    const verdict = verdictFor(item.id);

    // Correct/incorrect feedback overrides color
    if (verdict) {
      const verdictColor = verdict === "correct" ? CORRECT_COLOR : WRONG_COLOR;
      style.border = `3px solid ${verdictColor}`;
      style.boxShadow = `0 0 0 3px ${verdictColor}${RING_ALPHA}`;
      style.backgroundColor = color ? color + FILL_ALPHA : "rgba(255,255,255,0.2)";
    } else if (color) {
      style.backgroundColor = color + FILL_ALPHA;
      style.border = `3px solid ${color}`;
    } else {
      style.backgroundColor = "rgba(255,255,255,0.18)";
      style.border = "2.5px dashed rgba(255,255,255,0.65)";
    }

    return style;
  }

  // SVG fill for a painted polygon = its category colour; idle stays transparent
  // so the printed artwork underneath shows through (a transparent fill still
  // receives clicks via pointer-events: all).
  function polygonPaint(item: ImageRegionItem): { fill: string; stroke: string; strokeWidth: number } {
    const assignedCatId = assignments[item.id];
    const cat = assignedCatId ? catById[assignedCatId] : null;
    const color = markGlyph(cat) ? null : cat?.color ?? null;
    // Có mặt nạ nét vẽ thì canvas lo phần màu; <polygon> chỉ còn bắt click.
    if (color && !inkPainted(item.id)) return { fill: color + FILL_ALPHA, stroke: color, strokeWidth: 3 };
    return { fill: "transparent", stroke: "transparent", strokeWidth: 0 };
  }

  /**
   * Màu category quy về [r, g, b] cho canvas. `color` là chuỗi CSS người soạn
   * nhập nên có thể là tên màu hay rgb(…); đọc không ra thì dùng màu trung tính
   * chứ không tô đen.
   */
  const paintRgb = (color: string | undefined): Rgb => toRgbOr(color, FALLBACK_RGB);

  /**
   * Lớp tô gửi cho canvas: vùng đã tô lấy màu category (kèm viền đúng/sai),
   * vùng đang rê chuột mà chưa tô thì xem trước màu đang chọn.
   */
  function inkLayers(): InkPaintLayer[] {
    if (!inkMasks) return [];
    const layers: InkPaintLayer[] = [];
    for (const item of items) {
      if (!inkMasks.byId[item.id]) continue;
      const assignedCatId = assignments[item.id];
      if (assignedCatId) {
        // Nhóm có dấu thì không tô nét vẽ nữa — ô dấu nói thay, kể cả đúng/sai.
        if (markGlyph(catById[assignedCatId])) continue;
        const verdict = verdictFor(item.id);
        layers.push({
          id: item.id,
          rgb: paintRgb(catById[assignedCatId]?.color),
          alpha: FILL_ALPHA_VALUE,
          ringRgb: verdict ? (verdict === "correct" ? CORRECT_RGB : WRONG_RGB) : undefined,
        });
      } else if (!locked && selectedCatId && hoveredId === item.id) {
        // Xem trước của nhóm có dấu là ô dấu mờ (lớp phủ), không phải lớp tô.
        if (markGlyph(catById[selectedCatId])) continue;
        layers.push({
          id: item.id,
          rgb: paintRgb(catById[selectedCatId]?.color),
          alpha: HOVER_ALPHA_VALUE,
        });
      }
    }
    return layers;
  }

  // Renders as SVG only with a drawable ring: ≥ 3 vertices, all finite. A NaN
  // coordinate would break the SVG points string into an invisible shape, so
  // malformed polygons fall back to the positioned-box path instead of vanishing.
  // web-own: cùng một luật với chỗ đặt ô dấu (`polygonBounds`) — tách hai luật
  // ra thì polygon hỏng vẽ theo lối hộp mà ô dấu vẫn tính theo `points`.
  const isSvgPolygon = (it: ImageRegionItem): boolean => polygonBounds(it) !== null;
  const polygonItems = items.filter(isSvgPolygon);
  const boxItems = items.filter((it) => !isSvgPolygon(it));

  /** Nhãn đọc-được của một vùng trong câu đánh dấu: tên vùng + đã đánh dấu gì. */
  function regionMarkLabel(item: ImageRegionItem): string {
    const glyph = markGlyph(catById[assignments[item.id]]);
    const name = item.label?.trim() || "Vùng";
    return glyph ? `${name}: đã đánh dấu ${glyph}` : `${name}: chưa đánh dấu`;
  }

  /**
   * Phần nhìn của một ô đánh dấu. Ô CHƯA đánh chỉ có viền, nền trong suốt — ô
   * nằm ngay trên mặt từng bạn, tô trắng sẵn là xoá mất mặt. Đánh rồi mới tô
   * trắng để dấu nổi hẳn khỏi tranh; ô rỗng bù lại bằng một sợi trắng quanh
   * viền cho khỏi chìm vào tranh nhiều màu.
   */
  function markBoxStyle({ color, size, state }: MarkLayer): React.CSSProperties {
    const marked = state !== "empty";
    return {
      width: size,
      height: size,
      transform: "translate(-50%, -50%)",
      borderRadius: Math.round(size * MARK_RADIUS_RATIO),
      backgroundColor: marked ? MARK_FILL : "transparent",
      border: `${size >= MARK_BORDER_THIN_BELOW_PX ? MARK_BORDER_PX : MARK_BORDER_THIN_PX}px solid ${color}`,
      boxShadow: marked ? "0 1px 3px rgba(15,23,42,0.25)" : "0 0 0 1px rgba(255,255,255,0.75)",
      color,
      fontSize: Math.round(size * MARK_GLYPH_SCALE),
      transition: "border-color 0.18s, color 0.18s",
    };
  }

  /**
   * Ô đánh dấu của các vùng — một lớp phủ chung cho CẢ BA lối vẽ (hộp, polygon,
   * mặt nạ nét vẽ), thay vì nhét vào từng lối. Vẽ theo tâm hình học người soạn
   * kéo nên chỗ đứng của dấu không đổi khi mặt nạ nét vẽ bắt hụt hay bắt thừa.
   */
  function markLayers(): MarkLayer[] {
    if (!hasMarks) return [];
    const layers: MarkLayer[] = [];
    for (const item of items) {
      const assignedCatId = assignments[item.id];
      const cat = assignedCatId ? catById[assignedCatId] : null;
      // Câu trộn: vùng đã tô bằng nhóm KHÔNG khai dấu thì để mảng màu lo, đừng
      // úp thêm một ô rỗng lên trên.
      if (assignedCatId && !markGlyph(cat)) continue;

      // Chưa đánh: ô vẫn hiện nhưng RỖNG — NXB đòi "tạo ô vuông trên mỗi học
      // sinh để đánh dấu", nên ô là cái đích bấm chứ không phải phần thưởng sau
      // khi bấm. Rê chuột lên ô rỗng thì hiện mờ dấu sắp đánh.
      const previewCat =
        !locked && hoveredId === item.id && selectedCatId ? catById[selectedCatId] : null;
      const state: MarkState = assignedCatId ? "marked" : markGlyph(previewCat) ? "preview" : "empty";
      const glyph = (state === "marked" ? markGlyph(cat) : markGlyph(previewCat)) ?? "";

      // Đúng/sai thắng màu nhóm — ô dấu là chỗ DUY NHẤT còn báo được, vì vùng
      // có dấu đã bỏ cả nền lẫn viền. Ô chưa đánh dùng màu trung tính, không
      // mượn màu nhóm đang chọn (đỏ/xanh sẵn trên mọi ô trông như đã chấm).
      const verdict = state === "marked" ? verdictFor(item.id) : undefined;
      const color = verdict
        ? verdict === "correct"
          ? CORRECT_COLOR
          : WRONG_COLOR
        : state === "marked"
          ? cat?.color ?? FALLBACK_COLOR
          : EMPTY_MARK_COLOR;

      layers.push({ item, glyph, color, size: markBoxSize(item, containerSize.w, containerSize.h), state });
    }
    return layers;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>

      {/* ── Color palette ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => {
          const isActive = selectedCatId === cat.id;
          const color = cat.color ?? FALLBACK_COLOR;
          const glyph = markGlyph(cat);
          return (
            <button
              key={cat.id}
              type="button"
              disabled={locked}
              onClick={() => !locked && setSelectedCatId(cat.id)}
              className={[
                "flex items-center gap-2 rounded-xl px-3 py-2 border-2 font-bold text-sm",
                "transition-all select-none",
                locked
                  ? "opacity-60 cursor-default"
                  : isActive
                    ? "scale-105 shadow-md"
                    : "opacity-75 hover:opacity-100 hover:scale-102",
              ].join(" ")}
              style={{
                backgroundColor: color + "22",
                borderColor: isActive ? color : "transparent",
                color: isActive ? color : "#475569",
              }}
            >
              {/* Nhóm có dấu: chấm màu đổi thành chính cái ô sắp đánh lên tranh,
                  để học sinh thấy trước mình đang cầm dấu gì. */}
              {glyph ? (
                <span
                  className="w-5 h-5 rounded shadow-sm flex-shrink-0 flex items-center justify-center text-xs font-black leading-none"
                  style={{ backgroundColor: "#ffffff", border: `2px solid ${color}`, color }}
                >
                  {glyph}
                </span>
              ) : (
                <span
                  className="w-5 h-5 rounded-full shadow-sm flex-shrink-0 border-2 border-white/60"
                  style={{ backgroundColor: color }}
                />
              )}
              <RichTextValue value={cat.label} />
            </button>
          );
        })}
      </div>

      {/* ── Image + regions ── */}
      <div
        ref={geometryContainerRef}
        className={`relative select-none overflow-hidden rounded-2xl shadow-lg bg-slate-100 ${skin.panel?.("media") ?? "border-4 border-white"}`}
      >
        <img
          src={imageUrl}
          alt={imageAlt ?? "Hình bài tập"}
          className="w-full block"
          draggable={false}
          // Lúc mount ảnh chưa tải xong nên khung còn cao 0 và ô đánh dấu rơi
          // về cỡ chặn dưới; tải xong mới có cỡ thật để tính lại.
          onLoad={measureContainer}
        />

        {/* Overlay layer */}
        <div className="absolute inset-0" onMouseLeave={() => setHoveredId(null)}>
          {/* Lớp tô ôm sát nét vẽ — nằm dưới các vùng bắt click (vốn trong suốt
              khi đã có mặt nạ), pointer-events-none nên không chắn click. */}
          {inkMasks && <InkRegionOverlay masks={inkMasks} layers={inkLayers()} />}
          {/* Polygon regions — SVG hit + fill. viewBox 0..100 with
              preserveAspectRatio="none" maps normalized points onto the image at
              any aspect ratio. (Box shapes stay as positioned <div>s below.) */}
          {polygonItems.length > 0 && (
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {polygonItems.map((item) => {
                const paint = polygonPaint(item);
                return (
                  <polygon
                    key={item.id}
                    data-region-id={item.id}
                    points={item.points!.map(([x, y]) => `${x * 100},${y * 100}`).join(" ")}
                    fill={paint.fill}
                    stroke={paint.stroke}
                    strokeWidth={paint.strokeWidth}
                    vectorEffect="non-scaling-stroke"
                    style={{
                      cursor: locked ? "default" : selectedCatId ? "pointer" : "not-allowed",
                      pointerEvents: geometryEditing ? "none" : "all",
                      transition: "fill 0.18s, stroke 0.18s",
                    }}
                    onClick={geometryEditing ? undefined : () => handleRegionClick(item.id)}
                    onMouseEnter={() => setHoveredId(item.id)}
                  >
                    {item.label && <title>{item.label}</title>}
                  </polygon>
                );
              })}
            </svg>
          )}
          {boxItems.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                regionRefObject(item.id).current = el;
              }}
              className="group"
              style={regionStyle(item)}
              onClick={() => handleRegionClick(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              title={item.label}
              // web-own: câu đánh dấu bỏ mảng màu, nên dấu ✓/✗ là thứ DUY NHẤT
              // nói lên học sinh đã chọn gì — mà nó nằm ở lớp phủ aria-hidden.
              // Gắn trạng thái vào chính vùng bấm để trình đọc màn hình đọc được.
              aria-label={hasMarks ? regionMarkLabel(item) : undefined}
            >
              {/* Edit-preview geometry affordances (null without a controller).
                  MoveArea swallows pointerdown, so a plain click in edit mode
                  no longer paints the region — intended. Circle x/y is the
                  CENTER; rect x/y is the TOP-LEFT corner. */}
              <MoveArea
                fieldId={item.id}
                unit="fraction"
                anchor={item.shape === "circle" ? "center" : "topleft"}
                targetRef={regionRefObject(item.id)}
                containerRef={geometryContainerRef}
              />
              {item.shape === "circle" ? (
                <RadiusHandle
                  fieldId={item.id}
                  targetRef={regionRefObject(item.id)}
                  containerRef={geometryContainerRef}
                />
              ) : (
                <ResizeHandle
                  fieldId={item.id}
                  unit="fraction"
                  axis="xy"
                  targetRef={regionRefObject(item.id)}
                  containerRef={geometryContainerRef}
                />
              )}
            </div>
          ))}
          {/* Ô đánh dấu — lớp trên cùng, pointer-events-none để vùng bắt click
              bên dưới vẫn nhận được cú bấm ngay giữa ô. */}
          {markLayers().map((layer) => {
            const { cx, cy } = regionCenter(layer.item);
            return (
              <div
                key={layer.item.id}
                data-region-mark={layer.item.id}
                // Trạng thái đọc được đã gắn vào vùng bấm bên dưới (aria-label),
                // nên ô này chỉ còn là phần nhìn — đọc hai lần là thừa.
                aria-hidden
                className="absolute pointer-events-none flex items-center justify-center overflow-hidden font-black leading-none"
                style={{ ...markBoxStyle(layer), left: `${cx * 100}%`, top: `${cy * 100}%` }}
              >
                {/* Ô luôn rõ (nó là cái đích bấm); chỉ dấu XEM TRƯỚC mới mờ. */}
                <span style={{ opacity: layer.state === "preview" ? MARK_GHOST_OPACITY : 1 }}>
                  {layer.glyph}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Hint ── */}
      {!locked && !selectedCatId && (
        <p className={`mt-3 text-center text-sm italic ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500"}`}>
          {hasMarks
            ? "Chọn dấu trước, rồi bấm vào ô trên bạn cần đánh dấu."
            : "Chọn màu trước, rồi bấm vào vùng cần tô."}
        </p>
      )}

      {/* ── Result row (self-grade) ── */}
      {status === "success" && (
        // Dựa vào status (không phải `locked`): CHẤM NGAY không khoá câu khi đúng
        // nên banner phải bám status, không thì mất ở chế độ instant. Surface học
        // sinh vẫn ẩn banner qua presentation.hideInlineFeedback.
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-center text-green-600 font-black text-lg">Chính xác! 🎉</PlayerInlineFeedback>
      )}
      {locked && status === "error" && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-center text-red-500 font-black text-lg">Chưa đúng, thử lại nhé! 🤔</PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
