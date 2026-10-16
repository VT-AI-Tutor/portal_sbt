import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { MoveArea } from '@/core/exercise/field-resize-context';
import { displayLayoutKey, type LayoutInput } from '@/core/exercise/display-layout';
import {
  CorrectAnswerReveal,
  PlayerHeader,
  PlayerTextValue,
  sameSet,
  useGradeMode,
  useGrading,
  useInstantGrading,
} from '../players/shared';
import type { ContentBlock, InstantProgress, ElementVerdict } from '../players/shared';
import type { TaskStatus } from './types';

// WEB19 — điểm dạng CHỮ phải đọc được và bấm được ngang ngửa điểm dạng ẢNH
// (ảnh cao `max-h-12 sm:max-h-14` ≈ 48–56px, cộng viền ≈ 56–64px).
//
// Trước đây điểm chữ bị nhốt cứng trong `w-10 h-10` (40×40) + `text-sm` bất kể
// nhãn dài bao nhiêu: `g` thì vừa, nhưng `i   e   ê` của `22-tieng-viet-1/bai29`
// (b29_q1) bị bóp méo và nhỏ hẳn so với phần còn lại của vùng nối.
//
// - Bề RỘNG nở theo nhãn (`min-w` + `px-3` + `whitespace-pre`): nhãn ngắn vẫn
//   tròn đúng 40px, nhãn dài giãn thành viên thuốc thay vì bị bóp. Dùng
//   `whitespace-pre` chứ không phải `-nowrap` để GIỮ khoảng trắng tác giả gõ:
//   nhãn `i   e   ê` cách nhau 3 dấu cách là chủ ý tách ba chữ, HTML mặc định
//   gộp lại thành `i e ê` (Tầng 1 — render đúng thứ tác giả khai).
// - Bề CAO chỉ nới từ `sm:` trở lên. Toạ độ điểm là PHÂN SỐ của khung, nên chỗ
//   trống dọc co theo bề rộng khung: khung cao = 60% bề rộng, b29_q1 có bước y
//   0,167 → ở 375px khung cao ~225px, bước chỉ ~37px (đã sát 40px hiện tại, nới
//   nữa là chồng điểm — Tầng 4 lấy mobile làm sàn); từ 640px khung cao ~355px,
//   bước ~59px nên 48px vẫn còn khe hở.
const TEXT_POINT_CLASS =
  // Dùng giá trị tuỳ chỉnh cho `min-w` vì studio còn Tailwind v3 (thang spacing
  // của `min-w-*` chỉ có ở v4) — evo-books-web v4 hiểu y hệt chuỗi này.
  'min-w-[2.5rem] h-10 sm:min-w-[3rem] sm:h-12 px-3 rounded-full whitespace-pre leading-none text-base sm:text-lg';

// Nét đứt dùng đơn vị SVG cố định để mỗi gạch và mỗi khoảng hở giữ nguyên cỡ,
// bất kể hai điểm cách nhau bao xa (giống hệt ConnectLinesPlayer).
const PENDING_LINE_DASH = '8 8';

// ── Layout `dots` (§5.15, GAP-251) ───────────────────────────────────────────
// Bản in trong vở là bài nối-số: chấm tròn ĐEN, NHỎ. Ba hằng số dưới đây phải đi
// cùng nhau, và luật bất di bất dịch là: TÂM chấm nằm đúng x/y tác giả khai.
//
// Vùng chạm 44px (WCAG 2.5.5) bao ĐỐI XỨNG quanh tâm chấm — nút là hộp 44×44 với
// chấm căn giữa, nên phóng vùng chạm không đẩy chấm lệch một pixel nào. Nét nối
// vẫn lấy toạ độ từ `dims` (= x/y), tức là từ đúng tâm chấm.
const DOT_HIT_AREA_CLASS = 'h-11 w-11 flex items-center justify-center';
// Chấm là VÒNG TRÒN RỖNG (ruột trắng + viền dày), không phải đĩa đặc: đặt lên nét vẽ
// của trang sách thì vòng rỗng vẫn nhìn xuyên qua được, còn đĩa đặc che mất nét.
const DOT_CLASS = 'h-3.5 w-3.5 rounded-full border-[3px] bg-white shadow-none transition-all';
// Nhãn nằm CẠNH chấm (bản in cũng vậy), neo tuyệt đối nên không kéo tâm chấm đi.
const DOT_LABEL_CLASS =
  'pointer-events-none absolute left-full top-1/2 ml-0.5 -translate-y-1/2 whitespace-pre text-sm font-black leading-none text-slate-900';

interface Point {
  id: string;
  label: string;
  imageUrl?: string;
  x: number; // 0-1 fraction
  y: number;
}

interface ConnectPointsTaskProps {
  title: string;
  instruction?: string;
  /**
   * Full authored content (paragraphs + images). When present, PlayerHeader
   * renders every block in order instead of just the plain-text `title` — so a
   * multi-paragraph stem is not truncated to its first line (issue #558).
   */
  richContent?: { blocks?: ContentBlock[] };
  /**
   * Optional scan the points sit on top of (spec §5.15). Point `x`/`y` are
   * fractions of this image, so the canvas takes the image's natural aspect
   * ratio instead of the default 5:3 box — otherwise the authored coordinates
   * would not land where the book draws them. Falls back to the plain canvas
   * when the url fails to load; never blocks the interaction.
   */
  backgroundImage?: string;
  points: Point[];
  correctConnections: Array<{ from: string; to: string }>;
  /**
   * Nét nối MẪU vẽ sẵn cho học sinh bắt chước (dạng đề "Nối (theo mẫu)").
   *
   * Mang đúng hình dạng phần tử `correctAnswer` của chính loại này — `{from,to}` —
   * chứ KHÔNG mượn `{item,target}` của `matching`: §9.1 quy định answer key hai
   * loại khác nhau, và `example` chỉ là con TRỎ vào `correctAnswer` nên phải nói
   * cùng vốn từ với nó. Nhận `unknown` vì payload câu hỏi là dict tự do.
   */
  example?: unknown;
  onComplete: () => void;
  onAnswerChange?: (answer: unknown) => void;
  submitted?: boolean;
  onStatusChange?: (status: TaskStatus) => void;
  /** Bài làm đã lưu — `[{from,to}]`. Vẽ lại các nét đã nối khi quay lại câu. */
  answer?: unknown;
  /** Câu tự đánh giá: chỉ ghi nhận, không chấm. */
  selfAssessment?: boolean;
  /** Chấm ngay từng nét khi học sinh nối (mặc định bật) — xem ghi chú ở đầu file. */
  instantFeedback?: boolean;
  onElementGraded?: (id: string, verdict: ElementVerdict, meta?: unknown) => void;
  onProgress?: (progress: InstantProgress) => void;
  /** `display.layout` — `dots` vẽ điểm thành chấm đen nhỏ (§5.15). Mặc định `list`. */
  layout?: LayoutInput;
}

type Edge = { from: string; to: string };

/** Khoá KHÔNG PHÂN HƯỚNG của một nét: `p1-p3` và `p3-p1` là một (spec §5.15). */
const edgeKey = (from: string, to: string) => [from, to].sort().join('|');

const isEdge = (value: unknown): value is Edge =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Edge).from === 'string' &&
  typeof (value as Edge).to === 'string';

type ExampleEdge = Edge & { locked: boolean };

/** `example` thô → nét mẫu. `locked` mặc định `true` (spec §5.9). */
const readExample = (raw: unknown): ExampleEdge | null => {
  if (!isEdge(raw) || Array.isArray(raw)) return null;
  const { from, to } = raw;
  if (!from || !to) return null;
  return { from, to, locked: (raw as { locked?: unknown }).locked !== false };
};

// Nét mẫu vẽ bằng mực xám nhạt + nét đứt: học sinh phải đọc ra ngay "cái này cho
// sẵn để bắt chước", không nhầm với nét vừa chấm đúng (xanh) hay nét đang vẽ.
const EXAMPLE_LINE_STROKE = '#64748b';
const EXAMPLE_LINE_DASH = '3 2';

export const ConnectPointsTask: React.FC<ConnectPointsTaskProps> = ({
  title, instruction, richContent, backgroundImage, points, correctConnections,
  example: exampleInput,
  onComplete, onAnswerChange, submitted = false, onStatusChange,
  answer, selfAssessment, instantFeedback = true, onElementGraded, onProgress,
  layout,
}) => {
  const dots = displayLayoutKey(layout) === 'dots';
  const validIds = useMemo(() => new Set(points.map((p) => p.id)), [points]);
  // Chỉ giữ nét đáp án trỏ tới điểm CÓ THẬT: một nét trỏ id lạ mà vẫn tính vào
  // tập đúng thì học sinh không bao giờ nối đủ — câu treo vĩnh viễn ở "chưa xong".
  const expectedEdges = useMemo(
    () => correctConnections.filter((c) => validIds.has(c.from) && validIds.has(c.to)),
    [correctConnections, validIds],
  );
  const expectedKeys = useMemo(
    () => new Set(expectedEdges.map((c) => edgeKey(c.from, c.to))),
    [expectedEdges],
  );
  /** Các nét đáp án cắm vào một điểm — "tập đúng" của riêng điểm đó. */
  const expectedIncident = useCallback(
    (id: string) =>
      expectedEdges.filter((e) => e.from === id || e.to === id).map((e) => edgeKey(e.from, e.to)),
    [expectedEdges],
  );

  // ── Nét nối mẫu ────────────────────────────────────────────────────────────
  // Chỉ nhận nét mẫu trỏ tới điểm CÓ THẬT — cùng luật lọc với `expectedEdges`.
  const example = useMemo(() => {
    const parsed = readExample(exampleInput);
    return parsed && validIds.has(parsed.from) && validIds.has(parsed.to) ? parsed : null;
  }, [exampleInput, validIds]);
  const exampleKey = example ? edgeKey(example.from, example.to) : null;
  // Bất biến §5.9: cạnh mẫu PHẢI có trong `correctAnswer`. Nếu tác giả khai lệch,
  // vẫn vẽ sẵn nét đó nhưng không khoá/không loại khỏi chấm — đối xử như nét
  // thường còn hơn là âm thầm bỏ hai điểm ra khỏi phần học sinh phải làm.
  const exampleGiven = example !== null && exampleKey !== null && expectedKeys.has(exampleKey);
  const exampleLocked = exampleGiven && example.locked;

  // Bài làm đã lưu vẽ lại được (runner tự lưu đáp án mỗi lần điều hướng). Khoá
  // hydrate tính theo NỘI DUNG nên đáp án cha dội ngược về không xoá nét đang vẽ.
  const hydrated = useMemo(
    () => {
      const saved = (Array.isArray(answer) ? answer : []).filter(
        (e): e is Edge => isEdge(e) && validIds.has(e.from) && validIds.has(e.to),
      );
      if (!example) return saved;
      // Nét mẫu luôn có mặt ngay từ đầu, kể cả khi bài làm đã lưu chưa mang nó
      // (câu vừa được đặt mẫu sau khi học sinh đã làm dở).
      return [
        { from: example.from, to: example.to },
        ...saved.filter((e) => edgeKey(e.from, e.to) !== exampleKey),
      ];
    },
    [answer, validIds, example, exampleKey],
  );
  const hydrationKey = useMemo(
    () => hydrated.map((c) => edgeKey(c.from, c.to)).sort().join(','),
    [hydrated],
  );
  const [draft, setDraft] = useState(() => ({ hydrationKey, edges: hydrated }));
  const connections = draft.hydrationKey === hydrationKey ? draft.edges : hydrated;

  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  // Nét đứt bám con trỏ sau khi chọn điểm đầu — cùng chỉ dẫn thị giác của câu nối.
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
  const { status, setStatus, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || expectedEdges.length === 0;
  // Phần tử chấm là ĐIỂM (đúng vai "item cột trái" của câu nối): một điểm đúng
  // khi TẬP nét cắm vào nó khớp tập nét của đáp án. Khai cả điểm nhiễu vào
  // `elementIds` để nối bừa hai điểm nằm ngoài đáp án cũng bị tính là sai —
  // nếu chỉ khai điểm có trong đáp án thì nét thừa đó không ai đếm, và cả câu
  // vẫn báo đúng dù tập cạnh đã lệch (spec §5.15 chấm bằng BẰNG NHAU TẬP CẠNH).
  /**
   * Điểm được CHO SẴN: mọi nét đáp án cắm vào nó đều nằm trong nét mẫu.
   *
   * Spec §5.9: cặp mẫu bị loại khỏi phần học sinh phải hoàn thành và khỏi tiến độ
   * chấm. Đây không phải chuyện thẩm mỹ — `useInstantGrading` ở chế độ tập chốt
   * "xong" bằng `correct === expectedIds.length`, mà chỉ điểm ĐƯỢC CHẠM mới sinh
   * verdict. Nét mẫu đã khoá thì hai đầu của nó không bao giờ được chạm, nên nếu
   * vẫn đếm chúng thì câu KẸT VĨNH VIỄN ở "chưa xong" dù học sinh đã nối đúng hết.
   *
   * Chỉ loại điểm được PHỦ HẾT bởi nét mẫu: `connect_points` cho phép một điểm
   * mang nhiều nét, nên điểm còn nét đáp án khác vẫn là việc của học sinh.
   */
  const givenIds = useMemo(() => {
    if (!exampleLocked || !example) return new Set<string>();
    return new Set(
      [example.from, example.to].filter((id) =>
        expectedEdges
          .filter((e) => e.from === id || e.to === id)
          .every((e) => edgeKey(e.from, e.to) === exampleKey),
      ),
    );
  }, [exampleLocked, example, exampleKey, expectedEdges]);

  const elementIds = useMemo(
    () => points.map((p) => p.id).filter((id) => !givenIds.has(id)),
    [points, givenIds],
  );
  // Điểm KHÔNG có trong đáp án thì "để yên" mới là trả lời đúng — chế độ tập
  // của useInstantGrading xử đúng ca này (xem ghi chú `expectedIds` ở hook).
  const expectedIds = useMemo(
    () =>
      Array.from(new Set(expectedEdges.flatMap((e) => [e.from, e.to]))).filter(
        (id) => !givenIds.has(id),
      ),
    [expectedEdges, givenIds],
  );
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const instant = useInstantGrading({
    elementIds,
    expectedIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => connectionsRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  // Chấm ngay bật: nối xong vẫn sửa được (đúng như câu nối). Không có chấm ngay
  // thì "đúng cả câu" là chốt cuối, khoá lại như trước.
  const locked = submitted || (!instant.active && status === 'success');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<Record<string, { x: number; y: number }>>({});
  const [failedBackground, setFailedBackground] = useState<string>();
  const [imageRatio, setImageRatio] = useState<{ src?: string; ratio: number }>({ ratio: 5 / 3 });
  // Edit-preview geometry: stable per-point RefObjects for the MoveArea drag origin.
  const pointRefObjects = useRef<Record<string, React.MutableRefObject<HTMLSpanElement | null>>>({});
  const pointRefObject = (id: string) => (pointRefObjects.current[id] ??= { current: null });

  const updateDims = useCallback(() => {
    if (!containerRef.current) return;
    const cb = containerRef.current.getBoundingClientRect();
    const newDims: Record<string, { x: number; y: number }> = {};
    for (const p of points) {
      newDims[p.id] = {
        x: p.x * cb.width,
        y: p.y * cb.height,
      };
    }
    setDims(newDims);
  }, [points]);

  useLayoutEffect(() => {
    updateDims();
    const observer = new ResizeObserver(() => requestAnimationFrame(updateDims));
    if (containerRef.current) observer.observe(containerRef.current);
    const timers = [100, 300].map(ms => setTimeout(updateDims, ms));
    return () => { observer.disconnect(); timers.forEach(clearTimeout); };
  }, [updateDims, connections]);

  // Chấm ngay đúng HAI đầu của nét vừa đổi: một điểm đúng khi tập nét cắm vào
  // nó khớp tập đáp án của nó. Bỏ hết nét khỏi một điểm = điểm đó chưa trả lời
  // (`clear`), không phải trả lời sai.
  const gradePoints = (next: Edge[], touched: string[]) => {
    for (const id of touched) {
      const actual = next
        .filter((c) => c.from === id || c.to === id)
        .map((c) => edgeKey(c.from, c.to));
      if (actual.length === 0) instant.clear(id);
      else instant.grade(id, sameSet(actual, expectedIncident(id)) ? 'correct' : 'incorrect');
    }
  };

  const commit = (next: Edge[], touched: string[]) => {
    setDraft({ hydrationKey, edges: next });
    // Chấm đọc đáp án của TƯƠNG TÁC HIỆN TẠI, không phải closure của lần render
    // trước — `buildAnswer` chạy ngay trong `gradePoints` bên dưới.
    connectionsRef.current = next;
    onAnswerChange?.(next);
    // Sửa nét sau khi bị chấm sai (luồng có nút "Kiểm tra") thì xoá trạng thái đỏ.
    if (status === 'error') {
      setStatus('idle');
      onStatusChange?.('idle');
    }
    gradePoints(next, touched);
  };

  const handlePointClick = (id: string) => {
    if (locked) return;
    // Điểm cho sẵn không mở nét mới, không nhận nét mới, không gỡ nét mẫu.
    if (givenIds.has(id)) return;
    setCursorPoint(null);
    if (!selectedPoint) {
      // Điểm đã tìm được bạn của nó thì không mở nét mới — xem `canStartFrom`.
      if (!canStartFrom(id)) return;
      setSelectedPoint(id);
      return;
    }
    if (selectedPoint === id) {
      setSelectedPoint(null);
      return;
    }
    const key = edgeKey(selectedPoint, id);
    // Nét mẫu đã khoá: không gỡ được từ ĐẦU NÀO. Chặn ở mức CẠNH (không phải ở
    // mức điểm) vì `edgeKey` không phân hướng — bấm đích trước rồi bấm nguồn vẫn
    // ra đúng cạnh đó, và một điểm của connect_points còn có thể mang nét khác
    // hoàn toàn hợp lệ nên khoá cả điểm sẽ chặn nhầm.
    if (exampleLocked && key === exampleKey) {
      setSelectedPoint(null);
      return;
    }
    const exists = connections.some((c) => edgeKey(c.from, c.to) === key);
    const touched = new Set([selectedPoint, id]);
    let next: Edge[];
    if (exists) {
      next = connections.filter((c) => edgeKey(c.from, c.to) !== key);
    } else {
      // Mở lại nét từ một điểm đang mang nét SAI: nét mới THAY nét cũ chứ không
      // chồng thêm — mỗi điểm vẫn chỉ mở đúng một nét (cùng luật
      // `singleTargetPerItem` của câu nối). Nét mẫu không bao giờ bị thay.
      const stale = connections.filter(
        (c) => c.from === selectedPoint && !(exampleLocked && edgeKey(c.from, c.to) === exampleKey),
      );
      for (const c of stale) touched.add(c.to);
      next = [...connections.filter((c) => !stale.includes(c)), { from: selectedPoint, to: id }];
    }
    commit(next, [...touched]);
    setSelectedPoint(null);
  };

  // Chọn xong điểm đầu thì kéo một nét đứt theo con trỏ tới khi bấm điểm thứ
  // hai — học sinh thấy mình đang nối từ đâu, không phải đoán.
  const trackCursor = (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked || !selectedPoint || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    setCursorPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  };

  const clearCursorPreview = () => setCursorPoint(null);

  // Luồng CÓ nút "Kiểm tra" / nộp bài (chế độ chơi game, xem đáp án, và mọi
  // trường hợp chấm-ngay bị tắt): chấm cả câu bằng đúng luật của spec §5.15 —
  // bằng nhau tập cạnh không phân hướng.
  const checkResults = () => {
    if (recordOnly) {
      report(connections, 'incomplete');
      return;
    }
    const actual = new Set(connections.map((c) => edgeKey(c.from, c.to)));
    const isCorrect =
      actual.size === expectedKeys.size && [...expectedKeys].every((k) => actual.has(k));
    report(connections, isCorrect ? 'correct' : 'incorrect');
  };

  // Trigger check when parent sets submitted=true
  useEffect(() => {
    if (submitted && status === 'idle') checkResults();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  /**
   * Verdict của MỘT NÉT. Chấm ngay: nét được chấm ngay khi một trong hai đầu đã
   * có verdict — đúng/sai của chính nét đó tra thẳng từ tập đáp án, nên một điểm
   * nối nhiều nét vẫn xanh nét đúng, đỏ nét thừa.
   */
  const edgeVerdict = (edge: Edge): 'correct' | 'wrong' | null => {
    // Nét mẫu là dữ kiện đề bài, không phải bài làm — không bao giờ tô xanh/đỏ.
    if (exampleGiven && edgeKey(edge.from, edge.to) === exampleKey) return null;
    if (recordOnly) return null;
    const correct = expectedKeys.has(edgeKey(edge.from, edge.to));
    const graded =
      instant.reveal(edge.from) !== undefined || instant.reveal(edge.to) !== undefined;
    if (graded || submitted) return correct ? 'correct' : 'wrong';
    // Luồng nút "Kiểm tra": chỉ nét SAI đỏ lên; nét đúng giữ nguyên màu để
    // không lộ đáp án khi học sinh còn được làm lại.
    if (status === 'error') return correct ? null : 'wrong';
    return null;
  };

  /**
   * Màu của MỘT ĐIỂM suy từ CÁC NÉT của nó, không phải từ verdict tổng hợp —
   * đúng cách `ConnectLinesPlayer` tô chip. Điểm phải nối hai nét (ví dụ điểm
   * giữa của một chuỗi) mà mới nối đúng một nét thì verdict tổng hợp là "sai"
   * (chưa đủ tập), nhưng tô đỏ lúc đó là báo động giả: nét vừa nối ĐÚNG. Chờ
   * đủ nét rồi mới kết luận cả câu — việc đó do `useInstantGrading` lo.
   */
  const pointVerdict = (id: string): ElementVerdict | undefined => {
    const verdicts = connections
      .filter((c) => c.from === id || c.to === id)
      .map((c) => edgeVerdict(c));
    if (verdicts.includes('wrong')) return 'incorrect';
    if (verdicts.length > 0 && verdicts.every((v) => v === 'correct')) return 'correct';
    return undefined;
  };

  /**
   * Điểm nào được phép MỞ một nét mới.
   *
   * Luật chuỗi: mỗi điểm chỉ mở được MỘT nét. Nối 1→2 xong là điểm 1 đã tìm được
   * bạn của nó — bấm tiếp vào 1 không mở nét mới nữa; còn điểm 2 (đầu ĐƯỢC nối
   * tới) vẫn chọn được để nối tiếp sang 3. Nét cũ vẫn gỡ được từ đầu kia: chọn
   * điểm 2 rồi bấm điểm 1 là bỏ nét 1–2. Điểm đã khoá vẫn NHẬN được nét mới —
   * khoá là "không mở thêm nét", không phải "không đụng vào được".
   *
   * Ngoại lệ: nét đang bị chấm SAI thì đầu mở nét vẫn chọn lại được và nét mới
   * THAY nét sai đó. Khoá luôn thì học sinh nối nhầm phải mò cách gỡ từ đầu bên
   * kia mới sửa được — đúng luật nhưng không ai đoán ra.
   */
  const canStartFrom = (id: string): boolean => {
    if (givenIds.has(id)) return false;
    const outgoing = connections.filter((c) => c.from === id);
    if (outgoing.length === 0) return true;
    // Nét mẫu không có verdict nên không rơi vào nhánh "mở lại nét sai" — điểm
    // nào đang giữ nó vẫn bị coi là đã dùng xong, đúng ý "cho sẵn".
    return outgoing.every((c) => edgeVerdict(c) === 'wrong');
  };

  // Khối "Đáp án đúng" cho màn XEM LẠI. Task này tự dựng shell (không qua
  // PlayerShell) nên phải tự đọc `revealCorrect` và tự render — vẫn dùng chung
  // <CorrectAnswerReveal> để trông giống hệt 36 player còn lại.
  // (upstream từ evo-books-web 72365cb)
  const { revealCorrect } = useGradeMode();
  const labelOf = (id: string) => points.find((p) => p.id === id)?.label || id;
  const answerReveal =
    correctConnections.length > 0
      ? correctConnections
          .map((c) => `${labelOf(c.from)} — ${labelOf(c.to)}`)
          .join("\n")
      : null;

  const showBackground = Boolean(backgroundImage) && failedBackground !== backgroundImage;
  // Only the loaded image's own ratio may drive the canvas; a stale ratio from a
  // previous src would misplace every point.
  const aspectRatio = showBackground && imageRatio.src === backgroundImage ? imageRatio.ratio : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-2">
        <div className="max-w-5xl mx-auto">
          <PlayerHeader title={title} richContent={richContent} instruction={instruction} />

          <div className="bg-white/60 rounded-3xl border-4 border-white shadow-lg overflow-hidden">
            <div
              ref={containerRef}
              data-connect-points-background={
                backgroundImage ? (showBackground ? 'image' : 'fallback') : 'none'
              }
              className="relative w-full select-none"
              style={aspectRatio ? { aspectRatio } : { paddingBottom: '60%' /* 5:3 aspect ratio */ }}
              onPointerMove={trackCursor}
              onPointerLeave={clearCursorPreview}
              onPointerCancel={clearCursorPreview}
            >
              {showBackground && (
                <img
                  src={backgroundImage}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-fill"
                  onError={() => setFailedBackground(backgroundImage)}
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                      setImageRatio({ src: backgroundImage, ratio: image.naturalWidth / image.naturalHeight });
                    }
                  }}
                />
              )}

              {/* SVG connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
                {connections.map((c, i) => {
                  const from = dims[c.from];
                  const to = dims[c.to];
                  if (!from || !to) return null;
                  const verdict = edgeVerdict(c);
                  const isExample = exampleGiven && edgeKey(c.from, c.to) === exampleKey;
                  // Cùng bảng màu với câu nối (ConnectLinesPlayer): xanh đúng,
                  // đỏ sai, còn lại giữ màu nét đang vẽ.
                  // Layout `dots`: nét chờ chấm vẽ màu mực đen như bản in nối-số;
                  // xanh/đỏ khi đã chấm vẫn giữ nguyên cho cả hai layout.
                  // Nét mẫu đứng ngoài bảng màu đó — nó là dữ kiện đề, không phải
                  // bài làm, nên phải khác cả nét đang vẽ lẫn nét đã chấm.
                  const stroke = isExample
                    ? EXAMPLE_LINE_STROKE
                    : verdict === 'wrong'
                      ? '#ef4444'
                      : verdict === 'correct'
                        ? '#22c55e'
                        : dots
                          ? '#f59e0b'
                          : '#d946ef';
                  return (
                    <React.Fragment key={i}>
                      {/* Nét dẫn: nét chính chạy pathLength 0→1 nên trong lúc vẽ
                          chưa nối tới đích; nét đứt mờ cho thấy ngay hai điểm đã
                          được nối với nhau (giống ConnectLinesPlayer). Nét mẫu
                          không cần nét dẫn: nó có sẵn từ đầu, không có pha vẽ. */}
                      {!submitted && !isExample && (
                        <line
                          data-line-role="guide"
                          x1={from.x} y1={from.y}
                          x2={to.x} y2={to.y}
                          stroke={stroke}
                          strokeWidth={dots ? 3 : 4}
                          strokeLinecap="round"
                          strokeDasharray={PENDING_LINE_DASH}
                          className="opacity-35"
                        />
                      )}
                      {isExample ? (
                        /* Nét mẫu KHÔNG dùng motion: `pathLength` chiếm quyền ghi
                           `stroke-dasharray` (nó animate bằng đơn vị chuẩn hoá,
                           chốt ở "1 1") nên nét đứt khai ở đây sẽ bị đè mất — đo
                           trên app thật, jsdom không chạy animation nên test
                           không thấy. Mà nét mẫu vốn KHÔNG nên có pha "đang vẽ":
                           nó có sẵn từ đầu, không phải thao tác của học sinh. */
                        <line
                          data-line-role="fill"
                          data-connect-edge={`${c.from}->${c.to}`}
                          data-connect-edge-example="true"
                          x1={from.x} y1={from.y}
                          x2={to.x} y2={to.y}
                          stroke={stroke} strokeWidth={dots ? 3 : 4} strokeLinecap="round"
                          strokeDasharray={EXAMPLE_LINE_DASH}
                          className="opacity-80"
                        />
                      ) : (
                        <motion.line
                          data-line-role="fill"
                          data-connect-edge={`${c.from}->${c.to}`}
                          data-edge-verdict={verdict ?? undefined}
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          x1={from.x} y1={from.y}
                          x2={to.x} y2={to.y}
                          stroke={stroke} strokeWidth={dots ? 3 : 4} strokeLinecap="round"
                          className={verdict ? 'opacity-90' : 'opacity-70'}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
                {!locked && selectedPoint && cursorPoint && dims[selectedPoint] && (
                  <line
                    data-line-role="cursor-preview"
                    x1={dims[selectedPoint].x}
                    y1={dims[selectedPoint].y}
                    x2={cursorPoint.x}
                    y2={cursorPoint.y}
                    stroke={dots ? '#f59e0b' : '#d946ef'}
                    strokeWidth={dots ? 3 : 4}
                    strokeLinecap="round"
                    strokeDasharray={PENDING_LINE_DASH}
                    className="opacity-60"
                  />
                )}
              </svg>

              {/* Points. The wrapper (not the button) carries the positioning so
                  the edit-preview MoveArea can cover the point; layout unchanged. */}
              {points.map(p => {
                const verdict = pointVerdict(p.id);
                // Điểm đã mở nét xong: hết vai "mở nét", nhưng khi đang có điểm
                // được chọn thì nó vẫn là đích bấm được (nhận nét / gỡ nét).
                const spent = !canStartFrom(p.id);
                const given = givenIds.has(p.id);
                const clickable = !locked && !given && (selectedPoint !== null || !spent);
                return (
                <span
                  key={p.id}
                  ref={pointRefObject(p.id)}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 z-20"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  <button
                    onClick={() => handlePointClick(p.id)}
                    data-point-verdict={verdict ?? undefined}
                    data-point-spent={spent ? 'true' : undefined}
                    data-point-example={given ? 'true' : undefined}
                    data-display-layout={dots ? 'dots' : undefined}
                    className={`relative flex items-center justify-center transition-all ${
                      dots ? DOT_HIT_AREA_CLASS : 'flex-col gap-1'
                    } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {dots ? (
                      <>
                        {/* Chấm: hình tròn đặc, tâm trùng x/y. Không dùng `scale-*`
                            cho state chọn — ở cỡ 12px phóng to đọc như rung; dùng
                            vòng `ring` bao ngoài, không đổi hộp nên tâm đứng yên. */}
                        <span
                          data-point-dot="true"
                          className={`${DOT_CLASS} ${
                            given
                              ? 'border-slate-400'
                              : selectedPoint === p.id
                                ? 'border-amber-400 ring-4 ring-amber-200'
                                : verdict === 'correct'
                                  ? 'border-green-500'
                                  : verdict === 'incorrect'
                                    ? 'border-red-500'
                                    : clickable
                                      ? 'border-sky-500 group-hover:ring-4 group-hover:ring-sky-100'
                                      : 'border-sky-500'
                          }`}
                        />
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.label}
                            draggable={false}
                            className="pointer-events-none absolute left-full top-1/2 ml-0.5 max-h-8 w-auto -translate-y-1/2 object-contain"
                          />
                        ) : p.label ? (
                          // Nhãn nằm CẠNH chấm như bản in; vẫn đi qua PlayerTextValue
                          // để công thức TeX dựng đúng (#931).
                          <span className={DOT_LABEL_CLASS}>
                            <PlayerTextValue value={p.label} />
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <div className={`${
                        p.imageUrl ? 'p-1 rounded-2xl' : TEXT_POINT_CLASS
                      } border-4 flex items-center justify-center font-black transition-all shadow-md ${
                        given
                          ? 'border-slate-400 bg-slate-50 text-slate-600'
                          : selectedPoint === p.id
                            ? 'border-yellow-400 bg-yellow-100 scale-125'
                            : verdict === 'correct'
                              ? 'border-green-400 bg-green-50 text-green-700'
                              : verdict === 'incorrect'
                                ? 'border-red-400 bg-red-50 text-red-600'
                                : clickable
                                  ? 'border-fuchsia-400 bg-white hover:border-fuchsia-500 hover:scale-110'
                                  : 'border-fuchsia-400 bg-white'
                      }`}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.label} draggable={false} className="max-h-12 sm:max-h-14 w-auto object-contain rounded-md" />
                        ) : (
                          // #931: nhãn điểm là nội dung soạn — TeX phải dựng công thức.
                          <PlayerTextValue value={p.label} />
                        )}
                      </div>
                    )}
                  </button>
                  {/* Edit-preview only: renders null without a FieldResizeController. */}
                  <MoveArea
                    fieldId={p.id}
                    unit="fraction"
                    anchor="center"
                    targetRef={pointRefObject(p.id)}
                    containerRef={containerRef}
                  />
                </span>
                );
              })}
            </div>
          </div>

          {submitted && answerReveal && revealCorrect !== false && (
            <CorrectAnswerReveal>{answerReveal}</CorrectAnswerReveal>
          )}
        </div>
      </div>

    </div>
  );
};
