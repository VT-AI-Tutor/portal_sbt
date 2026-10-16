import { renderInteractionPlayer, type PlayerResult } from "./players/dispatch";
import type { TaskStatus } from "./tasks/types";
import { SkinProvider } from "./skin";
import type { QuestionPlayerSkin, SkinName } from "./skin";

export interface PlayerQuestion {
  id: string;
  question_type: string;
  payload: Payload;
}

// Payload is intentionally open — each question type uses its own fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Payload = Record<string, any>;

interface QuestionPlayerProps {
  question: PlayerQuestion;
  index: number;
  /** Current answer value — owned by the parent. */
  answer?: unknown;
  /** Called when the student changes their answer. */
  onAnswerChange?: (answer: unknown) => void;
  /**
   * Whether the question has been submitted.
   * When true: inputs are disabled and (for choice types) correct/wrong colours appear.
   */
  submitted?: boolean;
  /**
   * Read-only mode that does NOT imply submission or grading — inputs are
   * locked but no verdict/"đã nộp" chrome appears. Different from `submitted`:
   * use this for previews and frozen surfaces where the attempt is not over.
   * Dispatch wraps the player in a `<fieldset disabled>`. (parity studio)
   */
  disabled?: boolean;
  /** Called when the task's internal check changes status (success/error/idle). */
  onStatusChange?: (status: TaskStatus) => void;
  /**
   * Instant marking: fired for EACH element the moment it is graded, before the
   * whole-question status. The host uses it for per-action feedback (mascot).
   * Passthrough to the same handler on dispatch's PlayerHandlers.
   */
  onElementGraded?: (
    elementId: string,
    verdict: "correct" | "incorrect",
    meta?: unknown,
  ) => void;
  /** Instant marking progress (correct/wrong/total/done). Passthrough to dispatch. */
  onProgress?: (progress: {
    correct: number;
    wrong: number;
    total: number;
    done: boolean;
  }) => void;
  /** When true, hide title/header chrome (used inside question_group). */
  compact?: boolean;
  /**
   * "self" (default): the interaction player self-grades. "parent": it only
   * emits the answer; the caller grades (client gradeByType or the server) and
   * passes the verdict via `result`.
   */
  gradeMode?: "self" | "parent" | "silent";
  /**
   * Grade each element on the fly (client grade) vs only record the answer
   * (server grade). Leave undefined to keep today's behaviour — dispatch
   * defaults it to `true` before forwarding to every interaction player, and
   * question_group forwards the same flag to each child. (parity studio)
   */
  instantFeedback?: boolean;
  /**
   * Parent-supplied verdict for display in "parent" mode. A bare `PlayerResult`
   * grades the whole question; a `Record<childId, PlayerResult>` (optionally
   * wrapped in `{ results }`) grades each child of a question_group
   * individually — dispatch picks the child verdict via `nestedResult`.
   * (parity studio)
   */
  result?:
    | PlayerResult
    | Record<string, PlayerResult>
    | { results: Record<string, PlayerResult> };
  /** Ẩn ResultBanner mặc định của player khi host tự render verdict. */
  hideResultBanner?: boolean;
  /**
   * Chấm KÍN: nhận verdict player tự tính mà KHÔNG hiển thị gì (không status,
   * không âm thanh, không tô màu). Host dùng để ghi điểm mà khỏi chấm lại bằng
   * bộ chấm ngoài — xem GradeModeValue.onSilentVerdict.
   */
  onSilentVerdict?: (verdict: PlayerResult) => void;
  /**
   * false → chấm sai KHÔNG tô ô đúng chưa chọn (BUG-03). Web mặc định `false`
   * cho MỌI bề mặt đang làm bài: còn làm lại được thì lộ đáp án là hỏng bài học.
   * Studio/QA mặc định reveal (prop này đồng bộ từ studio-web).
   *
   * Chỉ bề mặt XEM LẠI bài ĐÃ NỘP mới truyền `true` — lúc đó lượt làm đã khoá,
   * và đây là cơ chế DUY NHẤT cho ra khối "Đáp án đúng" của một loại câu bất kỳ
   * (5 player choice tự tô ô đúng, 36 player còn lại qua PlayerShell.answerReveal).
   */
  revealCorrect?: boolean;
  /**
   * Visual skin. Pass a registered name ("studio") or a skin object to restyle
   * every player below. Omit to keep the default look. The skin flows down via
   * context, so nested sub-questions inherit it automatically.
   */
  skin?: QuestionPlayerSkin | SkinName;
  /**
   * web-own: upload file bài làm cho câu upload_answer — passthrough xuống
   * dispatch.PlayerHandlers.onUploadFile. Chưa upstream studio.
   */
  onUploadFile?: (file: File) => Promise<{ fileId: string; fileUrl: string }>;
}

/**
 * Public entry point. When a `skin` prop is supplied it wraps the renderer in a
 * <SkinProvider> so this player and all nested ones pick it up; otherwise it
 * renders the inner player directly and inherits any surrounding skin.
 */
export function QuestionPlayer({ skin, ...props }: QuestionPlayerProps) {
  const inner = <QuestionPlayerInner {...props} />;
  return skin ? <SkinProvider skin={skin}>{inner}</SkinProvider> : inner;
}

/**
 * Interaction players are the sole renderer, keyed by question `type`.
 * `display.interactionType` is an OPTIONAL refinement that picks a specific
 * variant; when it is absent the type's default player is used (see
 * manifest.resolvePlayer). Unknown types/interactions render a
 * RendererCapabilityDiagnostic inside dispatch — renderInteractionPlayer never
 * returns null, so the legacy per-type Task switch that used to live here was
 * unreachable and has been removed (chore: dọn Task legacy chết).
 */
function QuestionPlayerInner({
  question,
  answer,
  onAnswerChange,
  submitted = false,
  disabled = false,
  onStatusChange,
  onElementGraded,
  onProgress,
  compact = false,
  gradeMode,
  instantFeedback,
  result,
  hideResultBanner,
  onSilentVerdict,
  revealCorrect = false,
  onUploadFile,
}: Omit<QuestionPlayerProps, "skin">) {
  const { question_type: type, payload: p } = question;
  const setAnswer = onAnswerChange ?? (() => {});

  return (
    // Player root. `data-player-root` anchors the player's OWN typography
    // (--player-font-*), independent of the app theme's --font-body/--font-display.
    // Set once here so all ~40 players + nested groups inherit it (see styles.css).
    <div data-player-root>
      {renderInteractionPlayer(type, p, {
        // Hợp đồng dispatch mới (Bước A): kênh khôi phục là `answer` (parent-owned,
        // hydrate/remount) thay cho `initialAnswer` seed-at-mount cũ.
        questionId: question.id,
        onAnswerChange: setAnswer,
        answer,
        onStatusChange,
        onElementGraded,
        onProgress,
        submitted,
        disabled,
        compact,
        gradeMode,
        // Cố ý KHÔNG đặt mặc định ở facade: để undefined chảy xuống thì dispatch
        // tự `?? true` — mọi màn đang chạy giữ nguyên hành vi chấm-ngay hôm nay.
        instantFeedback,
        result,
        hideResultBanner,
        onSilentVerdict,
        // web-own: surface học sinh — chấm sai KHÔNG lộ ô đúng chưa chọn (BUG-03,
        // thay cho hack `selected &&` trong showCorrect trước đây). Studio/QA giữ
        // mặc định reveal sau submit; web mặc định TẮT và chỉ bề mặt xem lại bài
        // đã nộp mới bật lại qua prop.
        revealCorrect,
        // web-own: xem PlayerHandlers.onUploadFile.
        onUploadFile,
      })}
    </div>
  );
}
