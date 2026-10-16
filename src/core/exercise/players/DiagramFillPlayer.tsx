/**
 * Diagram fill — fixed diagram structure with fillable nodes.
 * schema: diagram_fill
 *
 * The diagram is a fixed set of nodes connected by edges. Static nodes render
 * their `label`; fillable nodes render a text <input>. "Kiểm tra" grades AUTO:
 * every fillable node's text must match one of its acceptedAnswers (normalized
 * trim + lowercase, any accepted). Emit = Record<nodeId, string>.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "motion/react";
import { PlayerShell, PlayerErrorFeedback, useGrading, useInstantGrading, type PlayerProps } from "./shared";
import { authoredName } from "./answer-name";
// web-own: tải ảnh bài làm — xem khối web-own: bên dưới nút "Tải ảnh bài làm".
import {
  answerImageFileName,
  DiagramFillDownloadError,
  renderDiagramFillAnswerImage,
} from "./diagram-fill-download";
import { useSkin } from "@/core/exercise/skin";
import {
  EdgeResizeHandle,
  MoveArea,
  ResizeHandle,
  isDeleteKey,
  useFieldResize,
  useFieldSelection,
} from "@/core/exercise/field-resize-context";
import { RichTextValue } from "@/core/rich-text/RichTextValue";

/**
 * Edge (leader line) styling — one shared look for both the coordinate and the
 * measured-fallback branch, matching how SGK/VBT print diagram callouts:
 * a neutral grey hairline with no arrowhead. Paired with
 * `vector-effect="non-scaling-stroke"` at the call sites so the width stays
 * identical whatever the background image aspect ratio does to the viewBox.
 */
/**
 * Trần chiều cao của sơ đồ điền theo TOẠ ĐỘ (Owner 12/8, ca `89186079/bai33`
 * câu 3). 70svh = 70% chiều cao cửa sổ: sơ đồ vẫn chiếm phần lớn tầm nhìn (ô
 * nhập nằm TRÊN ảnh nên cần đủ to để bấm) nhưng luôn chừa chỗ cho đề + nút,
 * không còn ca khung cao 721px nuốt trọn màn.
 */
export const DIAGRAM_COORD_MAX_HEIGHT = "70svh";

/** web-own: giữ objectURL của ảnh bài làm đủ lâu cho Safari tải xong mới thu hồi. */
const OBJECT_URL_TTL_MS = 60_000;

const DIAGRAM_EDGE_WIDTH = 1.5; // px, pinned by non-scaling-stroke
const DIAGRAM_EDGE_OPACITY = 0.8;
/**
 * Connector colour follows the same light-pinned vs theme-aware split the
 * nodes use (see `overlayInput` below). Edges drawn over a background scan sit
 * on an always-light book image, so they stay pinned to a neutral grey; edges
 * on a diagram with no scan sit on the app surface and must track the theme,
 * or they wash out in light mode and glare in dark mode. Both are applied as a
 * text colour on the <svg> so the lines can use `stroke="currentColor"`.
 */
const DIAGRAM_EDGE_ON_SCAN_CLASS = "text-slate-400"; // #94a3b8 — pinned, scan is always light
const DIAGRAM_EDGE_THEMED_CLASS = "text-slate-500"; // follows light/dark

export interface DiagramFillNode {
  id: string;
  label?: string;
  /** Center coordinate: normalized 0..1 (preferred), or legacy percent 0..100. */
  x?: number;
  y?: number;
  /**
   * Optional node width as a normalized 0..1 fraction of the diagram image
   * width (same convention as x/y). Rendering-only hint — never influences
   * grading. Falls back to the player default when absent.
   */
  width?: number;
  /**
   * Optional node height as a normalized 0..1 fraction of the diagram canvas
   * height (same convention as x/y). Rendering-only hint — never influences
   * grading. Absent height keeps the content-driven height.
   */
  height?: number;
  fillable?: boolean;
  acceptedAnswers?: string[];
}

export interface DiagramFillEdge {
  from: string;
  to: string;
}

export interface DiagramFillPlayerProps extends PlayerProps {
  nodes: DiagramFillNode[];
  edges: DiagramFillEdge[];
  /** Complete alternative answer maps for questions with more than one valid solution. */
  acceptedAnswerSets?: Record<string, string>[];
  backgroundImage?: string;
  /** Read-only mode without implying submission or grading. */
  disabled?: boolean;
  /** web-own: bật nút "Tải ảnh bài làm" — dispatch quyết theo isAnswerImageDownloadable. */
  answerImageDownload?: boolean;
}

const DIGITS_ONLY = /^\d+$/;

/**
 * web-own: bảng đáp án nối nhãn với đáp án bằng "=" thay cho ":" khi đáp án
 * THỰC SỰ là phân tích của nhãn — nhãn toàn chữ số, đáp án là một tổng, và tổng
 * đó đúng bằng nhãn ("361 = 300 + 60 + 1", dạng "viết số thành tổng các trăm,
 * chục, đơn vị").
 *
 * Phải cộng thật chứ không thể chỉ xét "hai vế đều là số". Id node phần lớn là
 * số THỨ TỰ, nên một nhãn toàn chữ số tự nó không nói lên điều gì. Đối chiếu 53
 * sách đã export: 66 node fillable có nhãn toàn chữ số, chỉ 12 là phân tích
 * thật; 54 ca còn lại là id thứ tự với đáp án rời (`n_17` đáp án `9`), nối bằng
 * "=" sẽ thành "17 = 9" — một khẳng định SAI, tệ hơn hẳn cái xấu mã
 * "n_17: 9" mà nó thay thế. Mọi ca không khớp rơi về ":" — giống hệt hành vi cũ.
 */
const isDecomposition = (label: string, answer: string): boolean => {
  if (!DIGITS_ONLY.test(label)) return false;
  const terms = answer.split("+");
  if (terms.length < 2) return false;
  let total = 0;
  for (const term of terms) {
    const t = term.trim();
    if (!DIGITS_ONLY.test(t)) return false;
    total += Number(t);
  }
  return total === Number(label);
};

const norm = (s: string) => s.trim().toLowerCase();
const coordinatePercent = (value: number | undefined): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  return percent >= 0 && percent <= 100 ? percent : undefined;
};
/** Node width as a percent of the image; invalid/out-of-range values fall back to the default. */
const nodeWidthPercent = (value: number | undefined): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value <= 0 || value > 1) return undefined;
  return Math.max(value, 0.03) * 100;
};
/** Node height as a percent of the canvas; invalid/out-of-range values keep the content-driven height. */
const nodeHeightPercent = (value: number | undefined): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value <= 0 || value > 1) return undefined;
  return Math.max(value, 0.02) * 100;
};
/**
 * A node accepts input when explicitly flagged fillable OR when it carries
 * acceptedAnswers. Real data often omits the flag but keys correctAnswer by
 * node id (dispatch derives acceptedAnswers from it) — without this the
 * question would render no inputs at all.
 */
const isFillableNode = (n: DiagramFillNode): boolean =>
  n.fillable === true || (n.acceptedAnswers?.length ?? 0) > 0;

function initialAnswer(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (answer, [key, entry]) => {
      if (typeof entry === "string") answer[key] = entry;
      return answer;
    },
    {},
  );
}

function answersEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
}

export const DiagramFillPlayer: React.FC<DiagramFillPlayerProps> = ({
  nodes,
  edges,
  acceptedAnswerSets = [],
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  backgroundImage,
  disabled = false,
  answerImageDownload = false,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  ...shell
}) => {
  const skin = useSkin();
  // Edit-preview geometry controller (null outside the question editor).
  // When onGeometry is present the MoveArea layer owns pointer events over
  // each node, so inputs (disabled there anyway) drop pointer handling.
  const geometryEditing = Boolean(useFieldResize()?.onGeometry);
  // Editor-only: click a node to select it (highlights its row in the form),
  // then Delete/Backspace removes it.
  const selection = useFieldSelection();
  const [values, setValues] = useState<Record<string, string>>(() => initialAnswer(answer));
  const [previousAnswer, setPreviousAnswer] = useState(answer);
  const [failedBackgroundImage, setFailedBackgroundImage] = useState<string>();
  const [imageMetrics, setImageMetrics] = useState<{ src?: string; ratio: number }>({ ratio: 4 / 3 });
  // web-own: trạng thái của nút "Tải ảnh bài làm" (chưa upstream lên studio).
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const backgroundImageRef = useRef<HTMLImageElement>(null);
  // Khoá đồng bộ: `downloading` chỉ cập nhật ở lần render sau, nên hai cú bấm
  // sát nhau đều thấy `false` và xuất ra hai file giống hệt.
  const downloadingRef = useRef(false);
  /**
   * web-own: ảnh nền nào KHÔNG nhận cờ CORS. Player xin `crossOrigin` để canvas
   * đọc được pixel; host không trả header thì ảnh hỏng HẲN, nên lần lỗi đầu ta
   * hạ cờ và nạp lại — ảnh hiện bình thường, chỉ mất nút tải.
   */
  const [corsBlockedImage, setCorsBlockedImage] = useState<string>();
  /** web-own: ảnh nền nào trình duyệt đã tải xong, kể cả khi không đo được cỡ. */
  const [settledImage, setSettledImage] = useState<string>();
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  const fillableNodes = nodes.filter(isFillableNode);
  // Số thứ tự "Chỗ trống N" — dùng chung cho aria-label của ô và khối "Đáp án đúng".
  // Tra theo id: ô có toạ độ được render từ bản sao node, không phải chính phần tử này.
  const blankOrdinal = (n: DiagramFillNode) => fillableNodes.findIndex((f) => f.id === n.id) + 1;
  const hasKey = fillableNodes.some((n) => (n.acceptedAnswers?.length ?? 0) > 0);
  const recordOnly = selfAssessment === true || !hasKey;
  const instant = useInstantGrading({
    elementIds: useMemo(
      () => fillableNodes.map((n) => n.id),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [nodes],
    ),
    instantFeedback,
    recordOnly,
    buildAnswer: () => ({ ...values }),
    report,
    onElementGraded,
    onProgress,
  });
  const locked = disabled || submitted || (!instant.active && status === "success");
  // In-player "Kiểm tra" just graded incorrect — wrong inputs turn red (correct
  // ones stay uncolored so no answer is leaked while retrying).
  const errored = status === "error";

  if (!Object.is(previousAnswer, answer)) {
    setPreviousAnswer(answer);
    const next = initialAnswer(answer);
    if (!answersEqual(values, next)) setValues(next);
  }

  // Simple layered (tree/flow) layout: assign a depth to each node via BFS over
  // edges, then position nodes in rows by depth.
  const containerRef = useRef<HTMLDivElement>(null);
  // Coordinate mode has its own container ref so ResizeHandle can convert px → fraction.
  const coordinateContainerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Stable per-node RefObjects mirroring nodeRefs, for ResizeHandle's targetRef.
  const nodeRefObjects = useRef<Record<string, React.MutableRefObject<HTMLDivElement | null>>>({});
  const nodeRefObject = (id: string) => (nodeRefObjects.current[id] ??= { current: null });
  const [anchors, setAnchors] = useState<Record<string, { x: number; y: number }>>({});

  const depths = (() => {
    const depthMap: Record<string, number> = {};
    const childrenOf: Record<string, string[]> = {};
    const incoming = new Set(edges.map((e) => e.to));
    for (const e of edges) {
      (childrenOf[e.from] ??= []).push(e.to);
    }
    const roots = nodes.filter((n) => !incoming.has(n.id)).map((n) => n.id);
    const queue: Array<{ id: string; d: number }> = (roots.length ? roots : nodes.map((n) => n.id)).map(
      (id) => ({ id, d: 0 }),
    );
    const seen = new Set<string>();
    while (queue.length) {
      const { id, d } = queue.shift()!;
      if (seen.has(id)) {
        depthMap[id] = Math.max(depthMap[id] ?? 0, d);
        continue;
      }
      seen.add(id);
      depthMap[id] = Math.max(depthMap[id] ?? 0, d);
      for (const c of childrenOf[id] ?? []) queue.push({ id: c, d: d + 1 });
    }
    for (const n of nodes) depthMap[n.id] ??= 0;
    return depthMap;
  })();

  const maxDepth = Math.max(0, ...Object.values(depths));
  const rows: string[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (const n of nodes) rows[depths[n.id]].push(n.id);

  const coordinateNodes = nodes.map((node) => ({
    ...node,
    left: coordinatePercent(node.x),
    top: coordinatePercent(node.y),
  }));
  const hasCoordinates = nodes.length > 0 && coordinateNodes.every(
    (node) => node.left !== undefined && node.top !== undefined,
  );

  const backgroundImageFailed = Boolean(backgroundImage && failedBackgroundImage === backgroundImage);
  // web-own: ảnh nền đang hiện ở chế độ không-CORS → canvas không đọc được pixel.
  const corsBlocked = Boolean(backgroundImage && corsBlockedImage === backgroundImage);
  // web-own: chỉ câu có nút tải mới xin CORS; câu khác nạp ảnh y như studio.
  const requestCors = answerImageDownload && !corsBlocked;
  const imageAspectRatio = imageMetrics.src === backgroundImage ? imageMetrics.ratio : 4 / 3;
  /**
   * web-own: HAI trạng thái khác nhau, đừng gộp.
   *  - `settled`: trình duyệt tải xong — hết lý do hiện "Đang tải phiếu…".
   *  - `exportable`: tải xong VÀ đo được cỡ, tức canvas vẽ được.
   *
   * Gộp làm một thì ảnh không có cỡ nội tại (SVG thiếu width/height) sẽ kẹt
   * nhãn "Đang tải phiếu…" vĩnh viễn dù phiếu hiện đủ trên màn. Máy chủ ảnh đo
   * được 4,9 KB/s ngày 22/09/2026 nên khoảng "đang tải" là có thật, phải khoá
   * nút thay vì để bấm rồi mới báo lỗi.
   */
  const backgroundImageSettled = settledImage === backgroundImage;
  const backgroundImageExportable = imageMetrics.src === backgroundImage;

  /**
   * web-own: nút chỉ có nghĩa ở nhánh toạ độ (nhánh `flow` không có ảnh nền để
   * vẽ lên) và bị ẩn trong trình soạn vì ở đó `values` là dữ liệu mẫu. Ảnh đã
   * tải xong mà vẫn không xuất được thì ẩn luôn, đừng treo nút chết trước mặt
   * học sinh.
   */
  const showDownloadButton =
    answerImageDownload &&
    hasCoordinates &&
    Boolean(backgroundImage) &&
    !backgroundImageFailed &&
    !corsBlocked &&
    !geometryEditing &&
    (!backgroundImageSettled || backgroundImageExportable);
  const downloadEnabled = backgroundImageExportable && !downloading;
  const downloadButtonLabel = !backgroundImageExportable
    ? "Đang tải phiếu…"
    : downloading
      ? "Đang tạo ảnh…"
      : "Tải ảnh bài làm";

  // web-own: `onLoad` có thể không nổ khi ảnh đã nằm sẵn trong cache lúc thẻ
  // gắn handler. Đọc lại từ chính thẻ sau mỗi lần commit để nút không kẹt.
  useEffect(() => {
    const image = backgroundImageRef.current;
    if (!image || !backgroundImage || !image.complete) return;
    // So `currentSrc` (ảnh THỰC SỰ đang nằm trong thẻ) với `src` (ảnh vừa yêu
    // cầu): đổi `backgroundImage` thì React dùng lại cùng thẻ <img>, và có một
    // nhịp `complete` còn true kèm kích thước ảnh CŨ trong khi `src` đã là ảnh
    // mới. Ghi {src mới, tỉ lệ cũ} vào imageMetrics sẽ đặt sai aspectRatio —
    // ảnh object-fill bị kéo méo và mọi ô nhập lệch khỏi hình vẽ.
    // So bằng `getAttribute("src")` KHÔNG chặn được: thuộc tính đó đã đổi rồi.
    if (!image.currentSrc || image.currentSrc !== image.src) return;
    if (!backgroundImageSettled) setSettledImage(backgroundImage);
    if (!backgroundImageExportable && image.naturalWidth > 0 && image.naturalHeight > 0) {
      setImageMetrics({ src: backgroundImage, ratio: image.naturalWidth / image.naturalHeight });
    }
  });

  /**
   * web-own: tải phiếu về dưới dạng ảnh, KÈM những gì học sinh đã gõ.
   *
   * Chưa điền gì thì file ra đúng phiếu trắng — nhà có máy in thì in ra viết
   * tay, nhà không có máy in thì gõ trên màn rồi tải bản đã điền. Một nút phục
   * vụ cả hai, nên không gắn điều kiện "phải điền xong mới cho tải".
   */
  const downloadAnswerImage = async () => {
    const image = backgroundImageRef.current;
    if (!image || downloadingRef.current) return;
    downloadingRef.current = true;
    setDownloading(true);
    setDownloadError("");
    let objectUrl: string | undefined;
    try {
      // fillableNodes chứ không phải nodes: bài đã lưu có thể còn khoá của một
      // node nay là nhãn tĩnh, vẽ ra sẽ lệch với những gì học sinh đang thấy.
      const blob = await renderDiagramFillAnswerImage(image, fillableNodes, values);
      objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = answerImageFileName(shell.title);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      // Ảnh nền về chậm là chuyện TẠM — bảo "thử lại" ở đây là sai, bấm lại
      // ngay cũng hỏng y hệt; phải nói cho học sinh biết là ĐỢI.
      const notReady =
        error instanceof DiagramFillDownloadError && error.code === "image-not-ready";
      setDownloadError(
        notReady
          ? "Phiếu đang tải xong, em đợi một chút rồi bấm lại nhé!"
          : "Chưa tạo được ảnh. Em thử lại nhé!",
      );
    } finally {
      // Thu hồi MUỘN: Safari huỷ tải dở nếu URL mất ngay sau click.
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), OBJECT_URL_TTL_MS);
      downloadingRef.current = false;
      setDownloading(false);
    }
  };

  const updateAnchors = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const cb = c.getBoundingClientRect();
    const next: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      const el = nodeRefs.current[n.id];
      if (el) {
        const b = el.getBoundingClientRect();
        next[n.id] = {
          x: b.left + b.width / 2 - cb.left,
          y: b.top + b.height / 2 - cb.top,
        };
      }
    }
    setAnchors(next);
  }, [nodes]);

  useLayoutEffect(() => {
    if (hasCoordinates) return;
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
  }, [hasCoordinates, updateAnchors, values]);

  const setVal = (id: string, v: string) => {
    if (locked) return;
    const next = { ...values, [id]: v };
    setValues(next);
    // Editing after a wrong self-check clears the error for the retry.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    if (recordOnly) report(next, "incomplete");
    else onAnswerChange?.(next);
  };

  const isNodeCorrect = (n: DiagramFillNode) => {
    const accepted = (n.acceptedAnswers ?? []).map(norm);
    return accepted.includes(norm(values[n.id] ?? ""));
  };

  const isAnswerSetCorrect = (candidate: Record<string, string>) =>
    acceptedAnswerSets.some((set) =>
      fillableNodes.every((n) => norm(candidate[n.id] ?? "") === norm(set[n.id] ?? "")),
    );

  const gradeNode = (n: DiagramFillNode) => {
    if (!isFillableNode(n)) return;
    const hasAnswerKey = (n.acceptedAnswers?.length ?? 0) > 0;
    if (!hasAnswerKey) return;
    const v = (values[n.id] ?? "").trim();
    if (v === "") {
      instant.clear(n.id);
      return;
    }
    instant.grade(n.id, isNodeCorrect(n) ? "correct" : "incorrect");
  };

  const grade = () => {
    if (locked) return;
    if (recordOnly) {
      report(values, "incomplete");
      return;
    }
    const allFilled = fillableNodes.every((n) => (values[n.id] ?? "").trim().length > 0);
    if (!allFilled) {
      report(values, "incomplete");
      return;
    }
    const correct = acceptedAnswerSets.length > 0
      ? isAnswerSetCorrect(values)
      : fillableNodes.every(isNodeCorrect);
    report(values, correct ? "correct" : "incorrect");
  };

  useEffect(() => {
    if (submitted && status === "idle") grade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const reveal = !recordOnly
    ? fillableNodes
        // Ô chưa có đáp án thì bỏ dòng, không in "Chỗ trống N: " cụt. Lọc trước
        // khi đặt tên vẫn an toàn vì số lấy từ blankOrdinal, không từ vị trí ở đây.
        .filter((n) => (n.acceptedAnswers?.length ?? 0) > 0)
        .map((n) => {
          const label = authoredName(n);
          const accepted = n.acceptedAnswers ?? [];
          const answers = accepted.join(" / ");
          if (!label) return `Chỗ trống ${blankOrdinal(n)}: ${answers}`;
          // web-own: studio và mono luôn dùng ":".
          const equation = accepted.some((a) => isDecomposition(label, String(a)));
          return equation ? `${label} = ${answers}` : `${label}: ${answers}`;
        })
        .join("\n")
    : undefined;

  const renderNode = (n: DiagramFillNode, coordinate?: { left?: number; top?: number }) => {
    const fillable = isFillableNode(n);
    const rv = fillable ? instant.reveal(n.id) : undefined;
    const showCorrect = rv
      ? rv === "correct"
      : !recordOnly && submitted && fillable && isNodeCorrect(n);
    // Wrong notation also right after an in-player "Kiểm tra" (errored).
    const showWrong = rv
      ? rv === "incorrect"
      : !recordOnly && (submitted || errored) && fillable && !isNodeCorrect(n);
    const inputState = showCorrect ? "correct" : showWrong ? "wrong" : "idle";
    const skinnedField = fillable ? skin.input?.(inputState) : undefined;
    const skinnedStatic = !fillable ? skin.chip?.("placed", "primary") : undefined;
    // ponytail: positioned fillable nodes sit ON the scan, which already draws
    // the blank's box — a chip border/fill just double-draws it and overflows.
    // So overlay inputs render bare; feedback stays as text colour.
    // Colours are pinned light-theme (no dark: variants): the ink sits on the
    // book scan, which is always a light image, so theme-reactive `text-slate-800`
    // would turn white and vanish in dark mode.
    const overlayInput = coordinate !== undefined && fillable;
    const overlayNode = `px-0.5 font-bold text-center transition-colors ${
      showCorrect ? "text-green-700" : showWrong ? "text-red-600" : "text-slate-900"
    }`;
    const defaultNode = `px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border-2 font-bold text-center shadow-sm transition-all
      ${
        fillable
          ? showCorrect
            ? "bg-green-50  border-green-400 text-green-700 "
            : showWrong
              ? "bg-red-50  border-red-400 text-red-600"
              : "bg-white border-teal-300  text-slate-800"
          : "bg-teal-50  border-teal-400 text-teal-800 "
      }`;
    // JSON width (0..1 fraction of image width) wins over the default; no maxWidth clamp then.
    const widthPercent = nodeWidthPercent(n.width);
    // JSON height (0..1 fraction of canvas height) is optional; absent → content-driven height.
    const heightPercent = nodeHeightPercent(n.height);
    const hasFixedHeight = coordinate !== undefined && heightPercent !== undefined;
    const coordinateStyle = coordinate
      ? ({
          ...(widthPercent !== undefined
            ? { width: `${widthPercent}%` }
            : { width: "20%", maxWidth: "9rem" }),
          ...(heightPercent !== undefined ? { height: `${heightPercent}%` } : {}),
          left: `${coordinate.left}%`,
          top: `${coordinate.top}%`,
        } as React.CSSProperties)
      : undefined;
    const selectable = geometryEditing && selection != null;
    const selected = selectable && selection.selectedFieldId === n.id;
    return (
      <div
        key={n.id}
        ref={(el) => {
          nodeRefs.current[n.id] = el;
          nodeRefObject(n.id).current = el;
        }}
        style={coordinateStyle}
        data-diagram-node={n.id}
        data-selected={selected ? "true" : undefined}
        // Capture: MoveArea stops propagation on pointerdown, so selection has
        // to run before it.
        {...(selectable
          ? {
              tabIndex: 0,
              onPointerDownCapture: (e: React.PointerEvent<HTMLDivElement>) => {
                selection.select(n.id);
                e.currentTarget.focus({ preventScroll: true });
              },
              onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                if (!isDeleteKey(e) || !selection.remove) return;
                e.preventDefault();
                selection.remove(n.id);
              },
            }
          : {})}
        data-coordinate-x={coordinate?.left}
        data-coordinate-y={coordinate?.top}
        className={`${
          coordinate
            ? `group absolute z-10 -translate-x-1/2 -translate-y-1/2 min-w-0 max-w-full${
                // Fixed height: let the inner content fill the box, vertically centered.
                hasFixedHeight ? " flex flex-col justify-center" : ""
              }`
            : "w-full min-w-0 max-w-[14rem] sm:w-auto sm:min-w-[7rem]"
        } break-words text-center text-xs sm:text-sm md:text-base ${
          overlayInput ? overlayNode : (skinnedField ?? skinnedStatic ?? defaultNode)
        }${selected ? " outline-none ring-2 ring-primary-500 ring-offset-1" : ""}`}
      >
        {fillable ? (
          <input
            type="text"
            value={values[n.id] ?? ""}
            onChange={(e) => setVal(n.id, e.target.value)}
            onBlur={() => gradeNode(n)}
            disabled={locked}
            placeholder="..."
            aria-label={`Chỗ trống ${authoredName(n) ?? blankOrdinal(n)}`}
            className={`block w-full min-w-0 bg-transparent text-center text-[1.5em] outline-none disabled:cursor-not-allowed disabled:opacity-100 ${
              // Overlay inputs sit on the light scan — pin the placeholder light-theme too.
              overlayInput ? "placeholder:text-slate-400" : "placeholder:text-slate-500"
            }${hasFixedHeight ? " h-full" : ""}${geometryEditing ? " pointer-events-none" : ""}`}
          />
        ) : (
          <RichTextValue value={n.label} />
        )}
        {coordinate && (
          // Edit-preview only: every positioned node (fillable inputs, static
          // label chips, bare placeholder nodes) gets geometry affordances.
          // All render null when no FieldResizeController is in scope. With a
          // v2 controller (onGeometry) the box is pullable from all FOUR edges
          // (opposite edge stays pinned); a v1-only controller falls back to
          // the legacy symmetric right-edge width handle.
          <>
            <MoveArea
              fieldId={n.id}
              unit="fraction"
              anchor="center"
              targetRef={nodeRefObject(n.id)}
              containerRef={coordinateContainerRef}
            />
            {geometryEditing ? (
              (["left", "right", "top", "bottom"] as const).map((side) => (
                <EdgeResizeHandle
                  key={side}
                  side={side}
                  fieldId={n.id}
                  targetRef={nodeRefObject(n.id)}
                  containerRef={coordinateContainerRef}
                />
              ))
            ) : (
              <ResizeHandle
                unit="fraction"
                fieldId={n.id}
                targetRef={nodeRefObject(n.id)}
                containerRef={coordinateContainerRef}
              />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      {/* Lớp GIỚI HẠN CHIỀU CAO của sơ đồ toạ độ (Owner 12/8): khung sơ đồ khai
          `aspectRatio` + `w-full` nên chiều cao suy ra từ bề rộng cột — cột
          820px cho khung cao 721px, gần trọn một màn; không trần ảnh nào chạm
          tới được vì ảnh ở đây là NỀN `absolute inset-0`, không qua ContentImage.

          Chặn bằng `max-width` ở lớp NGOÀI chứ KHÔNG đặt `max-height` lên chính
          khung: khung đã bị `w-full` ép bề rộng, thêm max-height vào đó là cả
          hai chiều cùng xác định → `aspect-ratio` bị bỏ qua, ảnh `object-fill`
          kéo méo và ô nhập neo theo % lệch khỏi hình vẽ. Giới hạn bề rộng thì
          chiều cao tự co đúng tỉ lệ: maxWidth = trần_cao × tỉ_lệ_ảnh. Chỉ áp
          cho nhánh toạ độ; nhánh `flow` không có ảnh nền phủ nên giữ nguyên. */}
      <div
        className="mx-auto w-full"
        style={
          hasCoordinates
            ? { maxWidth: `calc(${DIAGRAM_COORD_MAX_HEIGHT} * ${imageAspectRatio})` }
            : undefined
        }
      >
      <div
        ref={hasCoordinates ? coordinateContainerRef : containerRef}
        data-diagram-layout={hasCoordinates ? "coordinates" : "flow"}
        data-diagram-background={backgroundImageFailed ? "fallback" : backgroundImage ? "image" : "none"}
        className={hasCoordinates
          ? "relative isolate w-full min-w-0 max-w-full overflow-visible rounded-2xl border-2 border-teal-200 bg-slate-100/30 select-none"
          : "relative w-full min-w-0 max-w-full overflow-visible py-2 select-none"}
        style={hasCoordinates ? { aspectRatio: imageAspectRatio } : undefined}
      >
        {backgroundImage && !backgroundImageFailed && (
          <img
            // web-own: key theo trạng thái CORS để React nạp LẠI thẻ khi phải
            // hạ cờ — đổi mỗi thuộc tính crossOrigin không chắc kích hoạt
            // request mới trên mọi trình duyệt.
            key={requestCors ? "cors" : "no-cors"}
            ref={backgroundImageRef}
            src={backgroundImage}
            // web-own: xin quyền đọc pixel để nút "Tải ảnh bài làm" xuất được
            // file; thất bại thì onError hạ cờ và nạp lại (xem corsBlockedImage).
            crossOrigin={requestCors ? "anonymous" : undefined}
            alt=""
            aria-hidden="true"
            className={hasCoordinates
              ? "absolute inset-0 h-full w-full rounded-2xl object-fill"
              : "relative z-0 mx-auto mb-6 block h-auto max-w-full rounded-2xl object-contain"}
            onError={() => {
              // web-own: lỗi ĐẦU khi đang bật CORS → nhiều khả năng do header,
              // thử lại không cờ trước khi kết luận ảnh hỏng.
              if (requestCors) setCorsBlockedImage(backgroundImage);
              else setFailedBackgroundImage(backgroundImage);
            }}
            onLoad={(event) => {
              const image = event.currentTarget;
              // web-own: đánh dấu "đã tải xong" TRƯỚC guard kích thước — ảnh
              // không đo được cỡ vẫn là đã tải xong, chỉ là không xuất được.
              setSettledImage(backgroundImage);
              if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                setImageMetrics({
                  src: backgroundImage,
                  ratio: image.naturalWidth / image.naturalHeight,
                });
              }
            }}
          />
        )}

        {/* SVG edges connecting coordinate nodes or measured fallback nodes.
            Book diagrams draw these as plain hairlines: no arrowheads, neutral
            grey, one uniform thickness. The coordinate branch stretches a
            0–100 viewBox with preserveAspectRatio="none", so the stroke must be
            pinned with vector-effect="non-scaling-stroke" — otherwise the same
            strokeWidth renders thicker (and unevenly per axis) on wide scans.

            The entrance animation fades opacity and must NOT use motion's
            `pathLength`: motion implements pathLength by writing
            `pathLength="1"` + `stroke-dasharray="1 1"`, and non-scaling-stroke
            makes the browser resolve that dash pattern in device space instead
            of the normalized path space — which shatters the line into visible
            dashes. Opacity carries no such coupling. */}
        <svg
          className={`absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible ${
            backgroundImage && !backgroundImageFailed
              ? DIAGRAM_EDGE_ON_SCAN_CLASS
              : DIAGRAM_EDGE_THEMED_CLASS
          }`}
          viewBox={hasCoordinates ? "0 0 100 100" : undefined}
          preserveAspectRatio={hasCoordinates ? "none" : undefined}
        >
          {edges.map((e, i) => {
            const fromCoordinate = coordinateNodes.find((node) => node.id === e.from);
            const toCoordinate = coordinateNodes.find((node) => node.id === e.to);
            if (hasCoordinates && fromCoordinate?.left !== undefined && fromCoordinate.top !== undefined && toCoordinate?.left !== undefined && toCoordinate.top !== undefined) {
              return (
                <motion.line
                  key={`${e.from}-${e.to}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: DIAGRAM_EDGE_OPACITY }}
                  transition={{ duration: 0.35 }}
                  x1={fromCoordinate.left}
                  y1={fromCoordinate.top}
                  x2={toCoordinate.left}
                  y2={toCoordinate.top}
                  stroke="currentColor"
                  strokeWidth={DIAGRAM_EDGE_WIDTH}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            const from = anchors[e.from];
            const to = anchors[e.to];
            if (!from || !to) return null;
            return (
              <motion.line
                key={`${e.from}-${e.to}-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: DIAGRAM_EDGE_OPACITY }}
                transition={{ duration: 0.35 }}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="currentColor"
                strokeWidth={DIAGRAM_EDGE_WIDTH}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {hasCoordinates ? (
          <div className="absolute inset-0">
            {coordinateNodes.map((node) => renderNode(node, { left: node.left, top: node.top }))}
          </div>
        ) : (
          <div className="relative z-10 flex flex-col gap-10 sm:gap-12">
            {rows.map((row, ri) => (
              <div key={ri} className="flex flex-wrap justify-center gap-6 sm:gap-10">
                {row.map((id) => renderNode(nodes.find((node) => node.id === id)!))}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* web-own (22/09/2026, CHƯA upstream): nút tải phiếu đã điền về máy. */}
      {showDownloadButton && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <motion.button
            type="button"
            whileHover={{ scale: downloadEnabled ? 1.05 : 1 }}
            whileTap={{ scale: downloadEnabled ? 0.94 : 1 }}
            onClick={() => void downloadAnswerImage()}
            disabled={!downloadEnabled}
            className={
              skin.actionButton?.(downloadEnabled, "secondary") ??
              "px-6 py-2.5 rounded-full border-4 border-violet-300 bg-white font-black text-violet-600 shadow-md transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {downloadButtonLabel}
          </motion.button>
          {downloadError && <p className="text-sm font-bold text-red-500">{downloadError}</p>}
        </div>
      )}

      <PlayerErrorFeedback show={errored && !submitted} />

      {/* mode "parent": ẩn nút tự-chấm — cha chấm; đáp án đã emit từng ô. */}
      {!instant.active && !locked && !recordOnly && mode !== "parent" && (
        <div className="flex justify-center mt-8">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={grade}
            className={
              skin.actionButton?.(true, "primary") ??
              "px-8 py-3 rounded-full border-4 border-teal-500 bg-teal-400 text-white font-black text-lg shadow-md hover:bg-teal-500 transition-colors"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}
    </PlayerShell>
  );
};
