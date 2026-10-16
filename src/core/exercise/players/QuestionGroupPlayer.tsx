/**
 * P — Question group wrapper.
 * type: question_group
 *
 * Hosts several child question players via a render-prop so it stays decoupled
 * from the dispatcher/registry. It does NOT grade — it aggregates child answers
 * into Record<childId, unknown> and reports with verdict "incomplete", injecting
 * presentation meta { order }.
 *
 * CHẤM NGAY: nhóm không chấm, nhưng phải LÀ ỐNG DẪN verdict của câu con lên
 * host (mascot) — mỗi con chấm xong là một "phần tử" của nhóm:
 * `onElementGraded(childId, verdict)`; chấm hết mà đúng cả thì báo
 * `onStatusChange("success")` để host khen cả câu. Trước đây câu con nhận
 * `onStatusChange: () => {}` nên mọi verdict bị nuốt tại đây.
 */
import React, { useCallback, useRef, useState } from "react";
import {
  MEDIA_GROUP_TILE_MAX_HEIGHT,
  MediaCapProvider,
  PlayerShell,
  RichContentBlocks,
  useGradeMode,
  useGrading,
  type ContentBlock,
  type PlayerProps,
} from "./shared";
import { useSkin } from "@/core/exercise/skin";
import {
  displayLayoutKey,
  isAuthoredLayout,
  layoutContainerClass,
  normalizeDisplayLayout,
  twoRowGridClass,
  twoRowGridColumns,
} from "@/core/exercise/display-layout";

interface ChildEntry {
  id: string;
  /** Schema type used to identify an unsupported child in the QA fallback. */
  type: string;
  /** Renders the inner question player. Provided by the caller. */
  render: (ctx: {
    onAnswerChange: (a: unknown) => void;
    submitted?: boolean;
    onStatusChange?: (s: "idle" | "success" | "error") => void;
  }) => React.ReactNode;
}

export interface QuestionGroupPlayerProps extends PlayerProps {
  children: ChildEntry[];
  /**
   * Mọi câu con là Ô TRANH (ảnh + nhãn ngắn) — dispatcher tính từ payload con
   * vì render-prop không cho player nhìn thấy nội dung. Bật thì lưới chia cột
   * để TỐI ĐA 2 HÀNG thay vì theo `display.layout` tác giả khai.
   */
  pictureChildren?: boolean[];
  /** Optional shared passage/content (text + images) rendered once above all children. */
  sharedContent?: string | { blocks?: ContentBlock[] };
}

/**
 * Đọc `answer` cha cấp về Record<childId, answer>. Cha có thể cấp theo CẢ HAI
 * hợp đồng: envelope `{answers, order}` (shape group tự emit) hoặc Record PHẲNG
 * `{childId: answer}` (hợp đồng cũ phía web). Shape phẳng lọc theo id con thật
 * để không nhặt nhầm khoá meta (`order`…) làm đáp án.
 */
function groupAnswerRecord(answer: unknown, children: ChildEntry[]): Record<string, unknown> {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return {};
  const record = answer as Record<string, unknown>;
  const nested = record.answers;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...(nested as Record<string, unknown>) };
  }
  const flat: Record<string, unknown> = {};
  for (const child of children) {
    if (child.id in record) flat[child.id] = record[child.id];
  }
  return flat;
}

export const QuestionGroupPlayer: React.FC<QuestionGroupPlayerProps> = ({
  children,
  sharedContent,
  pictureChildren = [],
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  onElementGraded,
  submitted = false,
  ...shell
}) => {
  const skin = useSkin();
  // Chấm kín (gradeMode "parent"): con đã nuốt verdict ở useGrading của chính
  // nó, nhưng chặn thêm ở đây để nhóm không bao giờ là đường rò verdict.
  const { mode } = useGradeMode();
  const sealed = mode === "parent";
  const { report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  // Seed từ `answer` khôi phục: lần emit đầu sau restore phải mang theo đáp án
  // các câu con anh em đã khôi phục — không seed thì sửa MỘT con làm rơi hết
  // đáp án các con còn lại khỏi envelope emit.
  const [, setAnswers] = useState<Record<string, unknown>>(() => groupAnswerRecord(answer, children));
  // Gương của `answers` để gộp đáp án con mà KHÔNG gọi report() (setState cha)
  // bên trong updater setAnswers — tránh "setState-in-render".
  const answersRef = useRef<Record<string, unknown> | null>(null);
  if (answersRef.current === null) answersRef.current = groupAnswerRecord(answer, children);

  const order = children.map((c) => c.id);

  // Verdict per câu con — ref vì chỉ dùng để bắn sự kiện lên host, không render.
  const verdictsRef = useRef<Record<string, "correct" | "incorrect">>({});

  const recordChildVerdict = useCallback(
    (childId: string, status: "idle" | "success" | "error") => {
      // "idle" là trạng thái nền (con đang làm dở / chấm kín) — bỏ qua để không
      // xoá verdict đã có và không cắt ngang phản hồi vừa hiện ở host.
      if (sealed || status === "idle") return;
      const verdict = status === "success" ? "correct" : "incorrect";
      verdictsRef.current = { ...verdictsRef.current, [childId]: verdict };
      onElementGraded?.(childId, verdict);

      // Chấm HẾT con → verdict của cả nhóm. Bắn thẳng onStatusChange thay vì
      // report(): report sẽ phát lại âm thanh + onComplete trong khi từng con
      // đã tự phát rồi (nhóm vốn KHÔNG chấm, chỉ dẫn tín hiệu).
      const graded = verdictsRef.current;
      const done = children.every((c) => graded[c.id] !== undefined);
      if (!done) return;
      const allCorrect = children.every((c) => graded[c.id] === "correct");
      onStatusChange?.(allCorrect ? "success" : "error");
    },
    [children, onElementGraded, onStatusChange, sealed],
  );

  const recordAnswer = useCallback(
    (childId: string, value: unknown) => {
      const next = { ...(answersRef.current ?? {}), [childId]: value };
      answersRef.current = next;
      setAnswers(next);
      report({ answers: next, order: children.map((c) => c.id) }, "incomplete");
    },
    [report, children],
  );

  /**
   * Ô con xếp CẠNH NHAU (lưới ≥2 cột) thì ảnh trong ô nhận trần cao — xem
   * {@link MEDIA_GROUP_TILE_MAX_HEIGHT}. Xếp DỌC (list) thì KHÔNG: ô chiếm trọn
   * bề ngang, ảnh đề là thứ học sinh phải đọc, và không có ô anh em nào bên
   * cạnh bị đẩy khỏi màn — đúng chính sách "ảnh đơn giữ nguyên khổ".
   *
   * Đi qua context chứ không phải prop: ảnh do player CON tự render sâu bên
   * trong render-prop của dispatcher, nối bằng prop sẽ phải xuyên qua dispatcher
   * và mọi player con.
   */
  const groupLayoutMode = normalizeDisplayLayout(displayLayoutKey(shell.layout)).mode;
  const pictureFlags = Array.isArray(pictureChildren) ? pictureChildren : [];
  const pictureCount = pictureFlags.filter(Boolean).length;
  const allChildrenArePictures =
    pictureFlags.length >= 2 && pictureCount === pictureFlags.length;

  /**
   * Nhóm TOÀN Ô TRANH chỉ NÂNG số cột khi layout hiện tại sẽ quá 2 hàng
   * (Owner 8/8): 5 ô khai `grid_2` thành 3 hàng, tràn khỏi vùng làm bài.
   * `grid_3`/`grid_4` mà đã cho 1–2 hàng giữ nguyên — hai hàng là TRẦN, không
   * phải đích buộc phải lấp. Ô mang CHỮ luôn giữ bố cục tác giả khai vì 3–4
   * cột chữ là chật không đọc nổi.
   */
  const groupLayout = normalizeDisplayLayout(displayLayoutKey(shell.layout));
  const minimumTwoRowColumns = twoRowGridColumns(children.length);
  const needsTwoRowCapReflow =
    allChildrenArePictures &&
    groupLayoutMode === "grid" &&
    typeof groupLayout.columns === "number" &&
    groupLayout.columns < minimumTwoRowColumns;

  /**
   * SÀN cho nhóm tác giả KHÔNG khai `display.layout` — tách hẳn khỏi
   * `needsTwoRowCapReflow` phía trên (đó là TRẦN cho lưới ĐÃ khai, giữ nguyên).
   *
   * Phải đọc cờ `authored` chứ không đọc key: `displayLayoutKey` chỉ trả `.key`
   * nên "tác giả khai list" và "tác giả không khai gì" cùng ra `'list'`.
   * `resolveDisplay` có phân biệt (đặt `authored: false` khi dùng fallback)
   * nhưng cờ rụng ngay khi qua `displayLayoutKey`. Tác giả khai `list` VẪN
   * thắng — Tầng 2 của `apps/learner/docs/PLAYER-LAYOUT-RULES.md`.
   * Mirror từ studio-web PR #1105.
   */
  const needsUnauthoredGrid =
    pictureCount >= 2 && groupLayoutMode === "list" && !isAuthoredLayout(shell.layout);

  const gridSeedCount = needsUnauthoredGrid ? pictureCount : children.length;
  const usesTwoRowGrid = needsTwoRowCapReflow || needsUnauthoredGrid;
  const tileMediaCap =
    groupLayoutMode === "list" && !needsUnauthoredGrid ? null : MEDIA_GROUP_TILE_MAX_HEIGHT;
  const childrenGridClass = usesTwoRowGrid
    ? twoRowGridClass(gridSeedCount, "gap-2 sm:gap-3")
    : layoutContainerClass(shell.layout);
  const childrenLayoutKey = usesTwoRowGrid
    ? (`grid_${twoRowGridColumns(gridSeedCount)}` as const)
    : displayLayoutKey(shell.layout);

  const sharedBlocks = typeof sharedContent === "object" ? sharedContent.blocks ?? [] : [];
  const sharedText = typeof sharedContent === "string" ? sharedContent : undefined;
  const hasShared = sharedBlocks.length > 0 || Boolean(sharedText);

  // The shared passage IS the group's heading. When it is present, suppress the
  // shell's own title/instruction chrome so the stem isn't rendered twice
  // (once by PlayerShell from `content`, once below from `sharedContent`).
  return (
    <PlayerShell {...shell} compact={hasShared || shell.compact} submitted={submitted}>
      {/* Đề bài của nhóm render TRƠN, y hệt PlayerHeader của câu đơn (mb-4
          md:mb-6 + flex gap-1, KHÔNG panel/padding). Trước đây nó nằm trong
          panel inset trắng p-3 md:p-4 — cùng một đề bài mà câu đơn thì trơn,
          câu nhóm lại có khung, vừa lệch nhau vừa tốn chỗ (Owner 8/8). */}
      {sharedBlocks.length > 0 ? (
        <div className="mb-4 md:mb-6">
          <div className="flex flex-col gap-1">
            <RichContentBlocks blocks={sharedBlocks} allowMediaGrid />
          </div>
        </div>
      ) : (
        sharedText && (
          <div className={`mb-4 md:mb-6 italic whitespace-pre-line text-base md:text-lg ${skin.emphasis?.("neutral", "medium") ?? "text-slate-800 font-bold"}`}>
            {sharedText}
          </div>
        )
      )}

      <MediaCapProvider maxHeight={tileMediaCap}>
        <div
          data-layout-region="question-group-children"
          data-display-layout={childrenLayoutKey}
          className={`${childrenGridClass} md:gap-6`}
        >
          {children.map((child, childIndex) => {
            // Ô KHÔNG phải ô tranh chiếm trọn bề ngang khi nhóm lên lưới: phần
            // chữ + ô điền nhét nửa cột còn chật hơn xếp dọc (67251341/bai1
            // phần b). Mirror từ studio-web PR #1105.
            const spanFull =
              usesTwoRowGrid && pictureFlags.length > 0 && !pictureFlags[childIndex]
                ? " col-span-full"
                : "";
            // Không tự sinh nhãn a/b/c cho câu hỏi con — nội dung tự đánh số.
            const renderedChild = child.render({
              submitted,
              onAnswerChange: (a) => recordAnswer(child.id, a),
              onStatusChange: (s) => recordChildVerdict(child.id, s),
            });
            const childType = child.type.trim() || "không xác định";
            return (
              <div
                key={child.id}
                // p-1.5 sm:p-2 ĐỀU 4 cạnh (Owner 12/8 giảm nửa từ p-3 sm:p-4):
                // câu con đã BỎ padding màn của PlayerShell (cờ `nested`) nên vỏ ô
                // là lớp padding duy nhất còn lại — giữ mỏng để ô lưới đỡ hao chỗ
                // làm bài. ĐỀU 4 cạnh là bắt buộc: từng bị đổi thành pt-0
                // (ce48878) làm câu con KHÔNG có header — bảng, ảnh — dính sát mép
                // trên ô (Owner 11/8, đo trên 89186079/bai6 câu 1), test cấm pt-0.
                // Studio-web giữ cùng con số — đừng để hai repo lệch nhau.
              className={`min-w-0 p-1.5 sm:p-2 shadow-sm${spanFull} ${skin.panel?.("card") ?? "rounded-3xl border-4 border-slate-200 bg-white/80"}`}
              >
                {renderedChild ?? (
                  <div
                    role="alert"
                    className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-700 "
                  >
                    <p className="font-bold">Lỗi hiển thị câu hỏi con</p>
                    <p className="mt-1">
                      Chưa có renderer cho loại: <code className="font-mono">{childType}</code>.
                    </p>
                    <p className="mt-2 text-xs">
                      Cần xử lý lỗi này trước khi duyệt nhóm câu hỏi.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </MediaCapProvider>

      <div className="sr-only" aria-hidden="true">
        {order.join(",")}
      </div>
    </PlayerShell>
  );
};
