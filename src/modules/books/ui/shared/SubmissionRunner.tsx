/**
 * SubmissionRunner — exercise runner connected to the backend assessment API.
 *
 * Flow:
 *   intro → (POST attempts) → playing → (PUT answers autosave) → (POST submit)
 *   → graded → result
 *
 * `graded`: nộp xong KHÔNG nhảy thẳng ra điểm mà ở lại chính runner này — về câu
 * 1, mỗi câu tự tô đúng/sai + đáp án đúng như chấm ngay. Màn điểm chỉ tới khi
 * học sinh bấm "Hoàn thành"; soát lại là tuỳ ý. Đường khách
 * (`StandaloneExerciseRunner`) chạy đúng luồng này.
 *
 * CHÍNH SÁCH CHẤM (Owner 31/7, phương án B) — prop `marking`:
 *  - "instant" (mặc định): player self-grade từng thao tác (gradeMode "self" +
 *    instantFeedback) — không còn nút "Kiểm tra" per-câu.
 *  - "silent" (bài học trong sách, góp ý 2026-08): chấm CÂM — player VẪN tự
 *    chấm chính xác theo loại của nó nhưng không phản hồi tức thời (không tô
 *    màu, không âm thanh, không khoá câu, không mascot); verdict về runner qua
 *    `onSilentVerdict`, banner chỉ hiện sau khi Nộp bài.
 *  - "sealed" (bài GIÁO VIÊN GIAO): chấm KÍN — player nhận gradeMode="parent"
 *    (chỉ emit đáp án, KHÔNG tự chấm, không lộ verdict khi đang làm); điểm chỉ
 *    hiện sau khi Nộp bài. Autosave khi điều hướng vẫn chấm NGẦM (gradeByType)
 *    và gửi kèm results — server luôn cần verdict, chỉ KHÔNG hiển thị cho HS.
 * Cả hai chế độ: không nút Kiểm tra per-câu; khi Nộp bài toàn bộ kết quả được
 * chấm lại client-side (gradeByType) và gửi kèm submit — đường nộp/chấm tổng
 * KHÔNG đổi.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Paperclip,
  RotateCw,
  Share2,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { useAuth } from "@/core/auth/AuthContext";
import { safeHttpUrl } from "@/core/lib/security";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import { ShareCompletionDialog } from "./ShareCompletionDialog";
import { QuestionPlayer } from "@/core/exercise/QuestionPlayer";
import {
  ColorFillMemoryProvider,
  createColorFillMemory,
  forgetColorFill,
} from "@/core/exercise/players/color-fill-memory";
import { essayAnswerMeetsMinWords } from "@/core/exercise/players/EssayPlayer";
import { resolveQuestionType } from "@/core/exercise/questionType";
import { BusyBee } from "@/core/exercise/tasks/BusyBee";
import { mascotIdleMessage } from "@/core/exercise/mascotInstruction";
import { useMascotFeedback } from "@/core/exercise/useMascotFeedback";
import { mapBackendQuestions } from "./mapBackendQuestion";
import {
  QuestionCounter,
  QuestionSectionTitle,
  QuestionWithAudio,
} from "./QuestionLabelChrome";
import { resolveAudioSlots } from "./QuestionAudioButton";
import {
  isLineAnswered,
  READING_LINE,
  toNavMarks,
  type QuestionLabel,
} from "./lessonSections";
import {
  gradeByType,
  isAnswerEmpty,
  needsManualGrading,
  unwrapGroupAnswer,
} from "@/core/exercise/grading";
import type { SubmissionReview } from "@/core/api/assessmentTypes";
import {
  isPayloadTooLarge,
  PAYLOAD_TOO_LARGE_MESSAGE,
} from "@/core/api/uploadErrors";
import { UnansweredConfirmDialog } from "./UnansweredConfirmDialog";
import { ExplanationDialog, questionExplanation } from "./ExplanationDialog";
import { QuestionNavStrip } from "./QuestionNavStrip";
import { ExerciseEmptyState } from "./ExerciseEmptyState";
import { SubmissionDetailDialog } from "./SubmissionDetailDialog";
import {
  startAttempt,
  getCurrentAttempt,
  saveAnswers,
  submitAttempt,
  getExercise,
  getSubmission,
  getSubmissionReview,
  getSubmittedAttempt,
  uploadAttemptFile,
  type ExerciseDetail,
  type AnswerValue,
  type CurrentAttempt,
  type SubmitResult,
  type SubmissionDetail,
  type SubmissionReviewQuestion,
} from "@/modules/books/api/assessmentApi";
import { getApiProvider } from "@/core/api/config";
import { plainTextFromHtml } from "@/core/rich-text/html";
import { createPendingUploadGate } from "./pendingUploadGate";

// Provider is static per page load (same precedent as CATALOG_STALE_TIME).
// Ô "Đính kèm file" của essay/short_answer vẫn ẩn dưới lcms: kênh nộp của nó là
// `files:[{questionId,fileId}]` top-level mà lcmsSubmitAttempt không map (LCMS
// nhận file TRONG answer.files — hiện chỉ câu upload_answer đi đường đó).
const IS_LCMS = getApiProvider() === "lcms";

/**
 * Hai đáp án học sinh có "như nhau" không — để biết verdict player đã chấm có
 * còn ứng với đáp án hiện tại không. Mảng so không phụ thuộc thứ tự (chọn nhiều
 * đáp án), object so không phụ thuộc thứ tự khoá; còn lại so trực tiếp.
 */
function sameStudentAnswer(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): string => {
    if (Array.isArray(v)) return JSON.stringify([...v].map(String).sort());
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return JSON.stringify(
        Object.keys(o)
          .sort()
          .map((k) => [k, o[k]]),
      );
    }
    return JSON.stringify(v ?? null);
  };
  return norm(a) === norm(b);
}

// GAP-066: tự lưu bài làm thất bại phải báo cho học sinh, nhưng dùng CHUNG một id toast để
// sonner gộp — không spam mỗi lần lưu nền. Bài làm vẫn giữ cục bộ và nộp lại được.
/** 401 từ mọi provider (LcmsApiError/AssessmentApiError đều phơi `statusCode`). */
function isSessionExpired(err: unknown): boolean {
  return (err as { statusCode?: number } | null)?.statusCode === 401;
}

// Các wrapper emit envelope `{answers, ...meta}` — trước khi lưu phải phẳng hoá.
const WRAPPER_ENVELOPE_TYPES = new Set([
  "question_group",
  "timed_quiz",
  "lives_streak",
  "board_game",
]);

const AUTOSAVE_TOAST_ID = "answer-autosave-failed";
const AUTOSAVE_FAILED_MESSAGE =
  "Chưa lưu được bài làm lên máy chủ. Em kiểm tra kết nối nhé — bài vẫn được giữ trên máy.";

// Van an toàn: nếu lưu treo thì "Thoát" vẫn cho về hub (bài lưu nền).
const EXIT_SAVE_TIMEOUT_MS = 4000;

interface SubmissionRunnerProps {
  exerciseId: string;
  lessonTitle: string;
  /**
   * Bài học chứa bài tập này. LCMS dùng để thu hẹp việc tra trạng thái lượt về
   * đúng bài học — cùng phạm vi hub đang hỏi, để hai bên không kết luận ngược
   * nhau về CÙNG một lượt. Thiếu (bài GV giao, không có ngữ cảnh bài học) thì
   * tra toàn bộ như cũ.
   */
  lessonId?: number | string;
  /**
   * Tra mạch + số bài tập theo id câu hỏi. Phải truyền từ ngoài: đề ở đây lấy
   * từ student-portal, nơi không có tên phần — và tên trong danh sách bài tập
   * là tên BÀI, hiện lên là sai chỗ.
   */
  questionLabelById?: Record<string, QuestionLabel>;
  /** Ghi âm bài đọc của cả bài; chỉ hiện khi câu đang mở thuộc mạch ĐỌC. */
  readingAudioUrl?: string;
  onStart?: () => void;
  /** Gọi khi học sinh nhấn "Thoát" để cha thu lại layout bài tập (về màn hình sách). */
  onExit?: () => void;
  /**
   * Nút phụ đặt trong thanh đầu runner, ngay trước "Thoát".
   *
   * Có chỗ cắm này vì trang bài học cần thêm nút toàn màn hình mà KHÔNG được
   * phủ absolute lên runner: nút "Thoát" nằm trong thanh flex nên mọi nút nổi ở
   * góc trên bên phải đều đè lên nó.
   */
  headerAction?: ReactNode;
  /**
   * Gọi khi lượt làm đã KẾT THÚC (nộp xong, đang ở màn kết quả). Cha cần biết
   * để lần vào sau còn remount runner — nếu không, bấm vào bài tập từ hub sẽ ra
   * lại màn kết quả cũ thay vì lượt mới.
   */
  onFinish?: () => void;
  /** Gọi khi phiên hết hạn (401) giữa chừng — cha điều hướng về màn chi tiết sách. */
  onSessionExpired?: () => void;
  /** Link công khai tới bài học (để "Chia sẻ" gửi được cho người khác). */
  shareUrl?: string;
  /**
   * Chính sách chấm: "instant" (mặc định — player tự chấm từng thao tác) |
   * "sealed" (chấm kín, không lộ verdict khi đang làm; chấm chỉ xảy ra lúc Nộp
   * bài, autosave vẫn gửi results chấm ngầm cho server) | "silent" (chấm câm:
   * player vẫn tự chấm nên điểm chính xác như chấm ngay, chỉ không phản hồi
   * tức thời). Bài GV giao dùng "sealed" từ 31/7; bài học trong sách dùng
   * "silent" theo góp ý 2026-08 — chấm ngay từng thao tác khiến HS kéo thử
   * tới khi đúng.
   */
  marking?: "instant" | "sealed" | "silent";
  /**
   * Vào bài theo kiểu nào. Màn intro đã chuyển lên hub của BookLessonPage
   * (Owner 03/8) nên runner không còn hỏi lại — hub đã quyết rồi:
   * `"resume"` = đi thẳng tới câu dở, `"new"` = mở lượt mới từ câu 1.
   * Muốn "Làm lại từ đầu" thì cha đổi `key` để remount với `"new"`.
   * `"review"` = mở thẳng màn kết quả của lần nộp gần nhất (xem/chia sẻ lại).
   */
  startMode?: "new" | "resume" | "review";
  /** Lần nộp cần mở khi `startMode="review"` — hub truyền id từ lịch sử. */
  reviewSubmissionId?: string;
  /** Trạng thái chấm của lần nộp đó (hub đã biết từ lịch sử) — dùng khi lấy chi tiết lỗi. */
  reviewGradingStatus?: "graded" | "pending" | null;
  /**
   * Số câu hiện còn đáp án. Hub cần vì LCMS bỏ qua lệnh xoá ("Làm lại") nên
   * attempt phía server vẫn giữ câu đã xoá → "Đã làm X/Y câu" đếm dư.
   */
  onAnsweredCountChange?: (count: number) => void;
}

type Phase =
  | "loading"
  | "error"
  | "starting"
  | "playing"
  /**
   * Đã nộp và đã chấm, nhưng vẫn ở TRONG runner này: về câu 1, mỗi câu tự tô
   * dấu đúng/sai + đáp án đúng như chấm ngay. Màn điểm ("result") chỉ tới khi
   * học sinh chủ động bấm "Hoàn thành".
   */
  | "graded"
  | "submitting"
  | "result"
  | "result-loading";

/** Toast báo đã chấm xong. Câu chữ do Owner chốt. */
const FINISHED_MESSAGE = "Em đã làm xong tất cả câu hỏi. Xem kết quả nhé!";

export function SubmissionRunner({
  exerciseId,
  lessonTitle,
  lessonId,
  questionLabelById,
  readingAudioUrl,
  onStart,
  onExit,
  headerAction,
  onFinish,
  onSessionExpired,
  shareUrl,
  marking = "instant",
  startMode = "new",
  reviewSubmissionId,
  reviewGradingStatus,
  onAnsweredCountChange,
}: SubmissionRunnerProps) {
  // Chấm KÍN (bài GV giao): player chỉ emit đáp án, mọi verdict giữ ngầm tới lúc Nộp bài.
  const sealed = marking === "sealed";
  // CHẤM CÂM (bài học trong sách): player vẫn tự chấm chính xác theo loại của
  // nó, chỉ không phản hồi tức thời; điểm hiện sau khi Nộp bài.
  const silent = marking === "silent";
  const hidesVerdict = sealed || silent;
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  // Đã nộp + đã chấm, vẫn ở trong runner này để soát lại từng câu.
  const graded = phase === "graded";
  /**
   * Review server của lượt vừa nộp, lấy ngay sau khi nộp. `null` = chưa hỏi
   * được (LCMS không có cửa này, hoặc BE chưa lên) — khi đó mặc định LỘ đáp án,
   * vì lượt đã chốt thì giấu chỉ làm học sinh không biết mình sai ở đâu. Server
   * nói `revealAnswers: false` thì tôn trọng. Cũng truyền xuống
   * SubmissionDetailDialog để nó khỏi gọi lại cùng một cửa.
   */
  const [serverReview, setServerReview] = useState<SubmissionReview | null>(
    null,
  );
  const revealAnswers = serverReview?.revealAnswers ?? true;
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  // CHẤM NGAY: không còn checkResults per-câu — player self-grade từng thao tác;
  // kết quả tổng được chấm lại (gradeByType) lúc autosave-điều-hướng và lúc Nộp bài.
  // "Làm lại" phải xoá sạch đáp án cũ. Các player tương tác (nối, kéo-thả…) là
  // uncontrolled — chúng tự giữ state nội bộ và không nhận lại prop `answer`, nên
  // chỉ xoá `answers` không đủ; phải remount player bằng cách đổi key. Bộ đếm này
  // (theo questionId) tăng mỗi lần "Làm lại" và được ghép vào key của QuestionPlayer.
  const [resetNonce, setResetNonce] = useState<Record<string, number>>({});
  // Sổ nhớ màu câu tô màu (color_fill) suốt lượt làm — player unmount khi
  // chuyển câu, còn đáp án chỉ mang id nên quay lại sẽ mất màu đã tô.
  const [colorFillMemory] = useState(createColorFillMemory);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submissionDetail, setSubmissionDetail] =
    useState<SubmissionDetail | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Uploaded files per question: questionId → [{fileId, fileUrl, name}]
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, Array<{ fileId: string; fileUrl: string; name: string }>>
  >({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  // Cổng chặn "Nộp bài" khi upload_answer còn file đang tải — xem pendingUploadGate.
  const [uploadGate] = useState(createPendingUploadGate);
  const [resultDialogId, setResultDialogId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // Verdict CẢ CÂU do PLAYER tự chấm lúc làm (onStatusChange: success/error),
  // KÈM đáp án đúng lúc chấm. Màn "Xem lại bài làm" ưu tiên dùng verdict này
  // (khớp cái học sinh đã thấy, tránh gradeByType lệch với player) — NHƯNG chỉ
  // khi đáp án hiện tại vẫn đúng bản đã chấm; đổi/hạ đáp án sau đó thì verdict
  // cũ hết giá trị, phải chấm lại bằng gradeByType.
  const playerVerdictsRef = useRef<
    Record<string, { status: "success" | "error"; answer: AnswerValue }>
  >({});
  // Đáp án mới nhất mỗi câu (đọc đồng bộ ngay trong onStatusChange — report()
  // gọi onAnswerChange TRƯỚC onStatusChange nên ref đã cập nhật kịp).
  const latestAnswersRef = useRef<Record<string, AnswerValue>>({});
  // `beginReview` nạp đáp án ở chế độ nền — promise có thể về sau khi đã rời màn.
  const mountedRef = useRef(true);
  useEffect(() => {
    // Phải đặt lại `true` trong thân effect: StrictMode/reconnect chạy
    // mount → cleanup → mount lại mà ref sống xuyên remount — chỉ có cleanup
    // thì ref kẹt `false` vĩnh viễn và đáp án nạp về bị vứt bỏ.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Cảnh báo mềm "còn câu chưa làm" khi bấm Nộp bài.
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Đang lưu nốt câu dở khi bấm "Thoát" — khoá nút, tránh bấm dồn.
  const [exiting, setExiting] = useState(false);
  // Modal "Đáp án/ Gợi ý" của câu đang làm (nút "Xem lời giải").
  const [explanationOpen, setExplanationOpen] = useState(false);

  // Mascot: lời hướng dẫn theo (type × interaction) + phản hồi CHẤM NGAY.
  // Chấm KÍN (bài GV giao) tắt hẳn phản hồi — verdict không được lộ khi đang làm.
  // questionKey gồm nonce "Làm lại" để lời khen lượt trước không dính sang lượt mới.
  const currentRawQuestion = exercise?.questions[current];
  // useMemo: lời idle (có thể là mảng run) chỉ dựng lại khi đổi câu.
  const idleMessage = useMemo(
    () => mascotIdleMessage(currentRawQuestion?.type, currentRawQuestion?.payload),
    [currentRawQuestion?.type, currentRawQuestion?.payload],
  );
  const mascot = useMascotFeedback({
    questionKey: `${currentRawQuestion?.id ?? ""}:${resetNonce[currentRawQuestion?.id ?? ""] ?? 0}`,
    idleMessage,
    enabled: !hidesVerdict,
  });

  // ---------------------------------------------------------------------------
  // Load exercise on mount — component is keyed by exerciseId so remounts on change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getExercise(exerciseId),
      // Best-effort: current-attempt only decides "Tiếp tục" vs "Bắt đầu" —
      // a 404/500/network failure here must never block the exercise itself.
      getCurrentAttempt(exerciseId, lessonId).catch(() => null),
    ])
      .then(([data, current]) => {
        if (cancelled) return;
        setExercise(data);
        // Không dừng ở màn intro nữa — hub đã chọn hộ. Truyền thẳng giá trị vừa
        // fetch chứ KHÔNG đọc state: setState ở trên chưa kịp áp dụng trong cùng
        // lượt này, đọc state sẽ ra null và "Tiếp tục" hoá thành làm lại từ đầu.
        if (startMode === "review") {
          // Chỉ vào review khi có id lần nộp. Thiếu id (hiếm — lastSubmission bị
          // refetch về null giữa chừng) thì về hub, TUYỆT ĐỐI không mở lượt mới.
          if (reviewSubmissionId) void beginReview(reviewSubmissionId);
          else onExit?.();
        } else if (startMode === "resume" && current) {
          beginResume(current, data);
        } else {
          void beginNewAttempt();
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLoadError(err.message);
          setPhase("error");
        }
      });
    return () => {
      cancelled = true;
    };
    // exerciseId (and the lessonId that goes with it) is stable per mount:
    // the component is keyed by exerciseId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const beginNewAttempt = async () => {
    setPhase("starting");
    onStart?.();
    try {
      const att = await startAttempt(exerciseId);
      setAttemptId(att.attemptId);
      setCurrent(0);
      setAnswers({});
      colorFillMemory.clear();
      setPhase("playing");
    } catch (err) {
      setLoadError((err as Error).message);
      setPhase("error");
    }
  };

  /**
   * `startMode="review"`: mở thẳng màn kết quả của lần nộp gần nhất để xem lại +
   * Chia sẻ (vào lại bài đã nộp / đăng nhập lại), KHÔNG tạo lượt mới. Best-effort:
   * chi tiết lỗi vẫn hiện màn kết quả với trạng thái chấm đã biết.
   */
  const beginReview = async (submissionId: string) => {
    setPhase("result-loading");
    const detail = await getSubmission(submissionId).catch(() => null);
    // KHÔNG chặn màn điểm chờ nó: dưới LCMS là 2 round-trip nối tiếp mà học sinh
    // có thể không bấm "Xem lại" lần nào. Về sau `reviewFallback` tự dựng lại.
    void getSubmittedAttempt(exerciseId, submissionId).then(
      (submittedAttempt) => {
        if (!mountedRef.current) return;
        // Đáp án rỗng vẫn dựng review: câu đó hiển thị "chưa chọn đáp án" và chấm
        // sai. Chỉ khi không có bản ghi nào mới giữ nguyên màn tóm tắt điểm.
        if (!submittedAttempt || submittedAttempt.answers.length === 0) return;
        const submittedAnswers: Record<string, AnswerValue> = {};
        for (const savedAnswer of submittedAttempt.answers) {
          submittedAnswers[savedAnswer.questionId] = savedAnswer.answer;
        }
        // KHÔNG set `attemptId`: lượt đã nộp, không đường lưu nào được ghi đè lên.
        setAnswers(submittedAnswers);
      },
    );
    setResult({
      submissionId,
      status: "submitted",
      gradingStatus: detail?.gradingStatus ?? reviewGradingStatus ?? "graded",
    });
    if (detail) setSubmissionDetail(detail);
    setPhase("result");
  };

  /**
   * Nhận `attempt` + `ex` qua tham số (không đọc state) để gọi được ngay trong
   * lượt fetch đầu tiên, lúc setState chưa kịp áp dụng.
   */
  const beginResume = (attempt: CurrentAttempt, ex: ExerciseDetail) => {
    const restoredAnswers: Record<string, AnswerValue> = {};
    for (const a of attempt.answers) {
      restoredAnswers[a.questionId] = a.answer;
    }
    setAttemptId(attempt.attemptId);
    setAnswers(restoredAnswers);
    // CHẤM NGAY: không còn khôi phục trạng thái "đã kiểm tra" — player hydrate lại
    // đáp án qua prop `answer`; verdict tổng vẫn được chấm lại lúc Nộp bài.
    // Nhảy tới câu đang làm dở: câu ĐẦU TIÊN chưa có đáp án; nếu đã trả lời hết
    // thì về câu cuối. (BOOK-RESUME) — không phải luôn về câu 1.
    const firstUnanswered = ex.questions.findIndex(
      (q) => restoredAnswers[q.id] == null,
    );
    const total = ex.questions.length;
    setCurrent(firstUnanswered >= 0 ? firstUnanswered : Math.max(0, total - 1));
    onStart?.();
    setPhase("playing");
  };

  const handleAnswerChange = useCallback(
    (questionId: string, answer: unknown) => {
      latestAnswersRef.current[questionId] = answer as AnswerValue;
      setAnswers((prev) => ({
        ...prev,
        [questionId]: answer as AnswerValue,
      }));
    },
    [],
  );

  // Grade a single question client-side using correct answers from exercise data
  const gradeQuestion = useCallback(
    (
      rawQ: ExerciseDetail["questions"][number],
      answer: AnswerValue,
    ): { isCorrect: boolean; gradable: boolean; points: number } => {
      const points = rawQ.points ?? 1;
      const schema = rawQ.payload ?? {};
      const { isCorrect, gradable } = gradeByType(
        rawQ.type,
        schema,
        rawQ.correctAnswer,
        answer,
      );
      return { isCorrect, gradable, points };
    },
    [],
  );

  // Chấm 1 câu để gửi server: tin verdict player khi đáp án còn khớp, ngược lại
  // gradeByType. Dùng chung cho autosave + nộp bài để LCMS ghi đúng NGAY lần đầu
  // (LCMS bỏ qua cập nhật câu đã có bản ghi → autosave lệch thì nộp không sửa được).
  const gradeForSubmit = (
    rawQ: ExerciseDetail["questions"][number],
    answer: AnswerValue,
  ): { isCorrect: boolean; gradable: boolean; points: number } => {
    const g = gradeQuestion(rawQ, answer);
    const captured = playerVerdictsRef.current[rawQ.id];
    const trust = !!captured && sameStudentAnswer(captured.answer, answer);
    if (!trust) return g;
    const isCorrect = captured!.status === "success";
    return {
      isCorrect,
      gradable: true,
      points: isCorrect ? (rawQ.points ?? 1) : 0,
    };
  };

  // Save the current question's answer when navigating away. CHẤM NGAY: không còn
  // bước "Kiểm tra" trung gian nên kết quả per-câu được chấm lại (gradeByType) ngay
  // tại đây và gửi kèm autosave — server luôn có verdict mới nhất như luồng cũ.
  /**
   * Tự lưu đáp án câu ĐANG mở trước khi rời khỏi nó. Mọi đường điều hướng đều
   * phải đi qua đây — rời câu mà không lưu là mất bài làm của học sinh.
   */
  /**
   * Lưu (hoặc XOÁ, khi answer=null) đáp án một câu lên attempt, kèm verdict đã
   * chấm để server luôn có kết quả mới nhất. Nguồn chấm duy nhất cho cả autosave
   * lẫn "Làm lại" — cùng một hợp đồng lưu + cùng một cách báo lỗi.
   */
  const persistAnswer = (
    rawQ: ExerciseDetail["questions"][number],
    answer: AnswerValue,
  ): Promise<void> => {
    if (!attemptId) return Promise.resolve();
    const graded = gradeForSubmit(rawQ, answer);
    // Wire format của câu wrapper là Record phẳng `{childId: answer}` (như
    // serializeSessionAnswer bên practice) — không lưu envelope `{answers, ...meta}`.
    const wireAnswer =
      answer != null &&
      WRAPPER_ENVELOPE_TYPES.has(resolveQuestionType(rawQ.type, rawQ.payload))
        ? unwrapGroupAnswer(answer)
        : answer;
    return saveAnswers(
      attemptId,
      [{ questionId: rawQ.id, answer: wireAnswer }],
      [
        {
          questionId: rawQ.id,
          isCorrect: graded.isCorrect,
          points: graded.points,
          gradable: graded.gradable,
        },
      ],
    ).catch(() => {
      toast.error(AUTOSAVE_FAILED_MESSAGE, { id: AUTOSAVE_TOAST_ID });
    });
  };

  const persistCurrentAnswer = (): Promise<void> => {
    // Đã nộp thì điều hướng chỉ để SOÁT LẠI — không ghi gì lên lượt đã chốt.
    if (phase === "graded") return Promise.resolve();
    if (!attemptId || !exercise) return Promise.resolve();
    const rawQ = exercise.questions[current];
    const answer = answers[rawQ.id];
    if (answer === undefined) return Promise.resolve();
    return persistAnswer(rawQ, answer);
  };

  const handleNav = (direction: "prev" | "next") => {
    persistCurrentAnswer();
    // Kẹp TRONG updater: nút prev/next chỉ ẩn/hiện theo `current` của lượt
    // render hiện tại, nên bấm dồn trong cùng một tick sẽ cộng dồn và vượt khỏi
    // mảng câu hỏi → questions[i] undefined → trắng màn, mất sạch bài làm.
    const last = (exercise?.questions.length ?? 1) - 1;
    setCurrent((c) =>
      direction === "prev" ? Math.max(0, c - 1) : Math.min(c + 1, last),
    );
  };

  /** Nhảy thẳng tới một câu bất kỳ (I.6.13). Cùng hợp đồng lưu như prev/next. */
  const goTo = (index: number) => {
    if (index === current) return;
    persistCurrentAnswer();
    setCurrent(index);
  };

  /**
   * Câu này đã làm chưa. Câu essay/short_answer có thể trả lời bằng CÁCH ĐÍNH
   * KÈM FILE (không gõ chữ) — file nằm ở state `uploadedFiles` riêng và được nộp
   * độc lập → vẫn tính là đã làm.
   *
   * Dùng CHUNG cho cảnh báo "còn câu chưa làm" và chấm tròn nhảy nhanh: hai nơi
   * tự định nghĩa riêng thì sẽ có ngày dải chấm báo trống còn nút Nộp bài thì không.
   */
  const isQuestionAnswered = useCallback(
    (questionId: string) =>
      !isAnswerEmpty(answers[questionId]) ||
      (uploadedFiles[questionId]?.length ?? 0) > 0,
    [answers, uploadedFiles],
  );

  // Chỉ báo khi đang làm — màn kết quả không còn "lượt dở". Đếm bằng đúng
  // `isQuestionAnswered` ở trên, đừng chép định nghĩa "đã làm" lần thứ hai.
  useEffect(() => {
    if (phase !== "playing" || !exercise) return;
    onAnsweredCountChange?.(
      exercise.questions.filter((question) => isQuestionAnswered(question.id))
        .length,
    );
  }, [exercise, phase, isQuestionAnswered, onAnsweredCountChange]);

  /** Chỉ số các câu chưa làm — cảnh báo mềm + nhảy tới câu trống. */
  const getUnansweredIndexes = () =>
    (exercise?.questions ?? [])
      .map((rawQ, i) => (isQuestionAnswered(rawQ.id) ? -1 : i))
      .filter((i) => i >= 0);

  const handleSubmit = () => {
    // Check minWords của các câu tự luận dời về ĐÂY sau khi nút "Lưu câu trả
    // lời" trong player ẩn đi (Owner 8/8) — helper hiện luôn pass vì chưa bài
    // nào khai minWords; xem essayAnswerMeetsMinWords.
    const blockedByMinWords = (exercise?.questions ?? []).some(
      (rawQ) =>
        resolveQuestionType(rawQ.type, rawQ.payload) === "essay" &&
        !essayAnswerMeetsMinWords(
          (rawQ.payload ?? {}) as { minWords?: number },
          answers[rawQ.id],
        ),
    );
    if (blockedByMinWords) {
      toast.error("Có câu tự luận chưa đủ số từ tối thiểu. Em viết thêm nhé!");
      return;
    }
    // Cảnh báo mềm nếu còn câu chưa làm, nhưng vẫn cho nộp bài.
    if (getUnansweredIndexes().length > 0) {
      setConfirmOpen(true);
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {
    if (!attemptId) return;
    // Mọi đường nộp (nút, dialog xác nhận) đều qua đây — chặn MỘT chỗ: file
    // chỉ vào `answers` sau khi upload xong, nộp sớm là bài thiếu file.
    if (uploadGate.hasPending()) {
      toast.error("File đang được tải lên, em chờ chút rồi nộp bài nhé!");
      return;
    }
    setSubmitError(null);
    setPhase("submitting");

    // Collect all answers and file references to send atomically with submit
    const allAnswers = Object.entries(answers)
      .filter(([, answer]) => answer != null && answer !== "")
      .map(([questionId, answer]) => ({
        questionId,
        answer,
      }));

    const allFiles = Object.entries(uploadedFiles).flatMap(
      ([questionId, files]) =>
        files.map((f) => ({ questionId, fileId: f.fileId })),
    );

    // Vá "2 câu đúng nhưng nộp hiện 1/3" (SBT_4 #43): gradeForSubmit tin verdict
    // player khi đáp án còn khớp — cùng nguồn chấm với autosave.
    const allResults = exercise!.questions.map((rawQ) => ({
      questionId: rawQ.id,
      ...gradeForSubmit(rawQ, answers[rawQ.id] ?? null),
    }));

    const submitPayload = {
      answers: allAnswers.length > 0 ? allAnswers : undefined,
      files: allFiles.length > 0 ? allFiles : undefined,
      results: allResults,
      submittedAt: new Date().toISOString(),
    };
    try {
      const res = await submitAttempt(attemptId, submitPayload);
      setResult(res);
      setPhase("result-loading");

      // Fetch full submission detail (score, maxScore, etc.). LCMS may yield
      // an empty submissionId (history fallback missed) — render from
      // gradingStatus alone in that case.
      if (res.submissionId) {
        // AWAIT có chủ ý trước khi vào màn soát bài: `revealAnswers` mặc định
        // LỘ, nên hỏi server ở nền sẽ tô đáp án đúng ra rồi mới giấu đi khi
        // server kịp nói `false` — nháy đáp án ngay trước mắt học sinh.
        // Song song để không cộng dồn hai vòng chờ ở màn "Đang nộp bài…".
        const [detail, review] = await Promise.all([
          getSubmission(res.submissionId).catch(() => null),
          getSubmissionReview(res.submissionId).catch(() => null),
        ]);
        if (detail) setSubmissionDetail(detail);
        setServerReview(review);
      }
      // Ở LẠI runner này: về câu 1, mỗi câu tự tô đúng/sai + đáp án đúng. Màn
      // điểm chờ học sinh bấm "Hoàn thành" — soát lại là tuỳ ý, không ép.
      setCurrent(0);
      setPhase("graded");
      toast.success(FINISHED_MESSAGE);
      onFinish?.();
    } catch (err) {
      // Phiên hết hạn (vd đã đăng xuất ở tab khác) → KHÔNG hiện lỗi kỹ thuật thô;
      // báo mềm rồi để cha điều hướng về màn chi tiết sách.
      if (isSessionExpired(err)) {
        toast.error(
          "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại — bài làm đang dở vẫn được giữ trên thiết bị.",
          { id: "session-expired" },
        );
        setPhase("playing");
        onSessionExpired?.();
        return;
      }
      // 413: thân bài nộp vượt trần máy chủ (bài có câu vẽ tay nặng nhất — cả
      // tấm canvas đi theo answer dạng base64). Câu lỗi thô của gateway là chuỗi
      // kỹ thuật, không đưa ra màn hình học sinh.
      setSubmitError(
        isPayloadTooLarge(err)
          ? PAYLOAD_TOO_LARGE_MESSAGE
          : (err as Error).message,
      );
      setPhase("playing");
    }
  };

  const handleFileUpload = async (questionId: string, file: File) => {
    if (!attemptId) return;
    setUploadingId(questionId);
    try {
      // Cùng gate với upload_answer — doSubmit chặn một chỗ cho CẢ hai kênh.
      const res = await uploadGate.wrap(() => uploadAttemptFile(attemptId, file));
      setUploadedFiles((prev) => ({
        ...prev,
        [questionId]: [
          ...(prev[questionId] ?? []),
          { fileId: res.fileId, fileUrl: res.fileUrl, name: file.name },
        ],
      }));
    } catch (err) {
      // GAP-066: không nuốt lỗi — báo rõ để học sinh biết tệp CHƯA được đính kèm và thử lại.
      // 413 tách riêng: đổ tại kết nối là sai hẳn nguyên nhân, học sinh đi kiểm
      // tra mạng trong khi vấn đề là tệp quá nặng.
      toast.error(
        isPayloadTooLarge(err)
          ? PAYLOAD_TOO_LARGE_MESSAGE
          : "Tải tệp đính kèm lên thất bại. Em kiểm tra kết nối rồi thử lại nhé.",
      );
    } finally {
      setUploadingId(null);
    }
  };

  const handleRemoveFile = (questionId: string, fileId: string) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [questionId]: (prev[questionId] ?? []).filter((f) => f.fileId !== fileId),
    }));
  };

  // "Thoát" — về hub của trang bài học (KHÔNG khởi động lại bài). Runner vẫn
  // MOUNTED, chỉ bị cha ẩn đi, nên giữ nguyên phase "playing": quay lại là thấy
  // đúng chỗ đang dở, không tốn thêm lượt gọi API nào.
  // onExit báo cha đổi view + refetch "bài đang dở" để hub hiện đúng "Tiếp tục".
  const handleExit = () => {
    // Thoát khi file còn đang tải: persistCurrentAnswer sẽ lưu answer THIẾU
    // file, và kết quả upload về sau chỉ nằm trong state — đóng tab là mất.
    if (uploadGate.hasPending()) {
      toast.error("File đang được tải lên, em chờ chút rồi thoát nhé!");
      return;
    }
    setSubmitError(null);
    // Chỉ màn đang làm mới có câu dở cần lưu; màn kết quả đã nộp rồi, thoát luôn.
    if (phase !== "playing") {
      onExit?.();
      return;
    }
    if (exiting) return;
    // Lưu câu đang mở trước khi báo cha refetch, để hub đếm đúng "bài đang dở".
    // `finish` idempotent: lưu xong hoặc hết timeout, bên nào tới trước thì thoát.
    setExiting(true);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      setExiting(false);
      onExit?.();
    };
    const timer = setTimeout(finish, EXIT_SAVE_TIMEOUT_MS);
    void persistCurrentAnswer().finally(finish);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (
    phase === "loading" ||
    phase === "starting" ||
    phase === "result-loading"
  ) {
    const label =
      phase === "loading"
        ? "Đang tải bài tập…"
        : phase === "starting"
          ? "Đang tạo bài làm…"
          : "Đang lấy kết quả…";
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[280px] gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">{label}</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[280px] p-6 gap-4 text-center">
        <p className="text-sm text-destructive font-medium">
          {loadError ?? "Không thể tải bài tập."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          <RotateCw className="size-4 mr-1.5" />
          Thử lại
        </Button>
      </div>
    );
  }

  // Bài tập không có câu hỏi nào — hiển thị màn "không tìm thấy câu hỏi" thay vì
  // để nhánh playing truy cập questions[0] và trắng trang. Chỉ chặn ở phase
  // playing (nơi crash); giữ nguyên result để không mất phần xem lại của bài đã
  // từng nộp nhưng bị xoá hết câu hỏi.
  if (phase === "playing" && (exercise?.questions?.length ?? 0) === 0) {
    // onExit chứ không handleExit: không có câu nào để lưu.
    return <ExerciseEmptyState onClose={onExit} />;
  }

  if (phase === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[280px] gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Đang nộp bài và chấm điểm…</p>
      </div>
    );
  }

  if (phase === "result" && result) {
    // Tên bài dùng chung cho tiêu đề kết quả + 2 dialog. exercise.title (LCMS
    // data.name) hay rỗng nên lùi về lessonTitle; ĐẢM BẢO không rỗng để thẻ chia
    // sẻ không hiện tên trắng (line 49/52).
    // Thẻ chia sẻ và hai dialog đều nhận chuỗi trần, không vẽ HTML — tiêu đề
    // mang thẻ nghiêng phải bỏ thẻ ở đây chứ không hiện nguyên <em>.
    const displayTitle =
      plainTextFromHtml(exercise?.title ?? "").trim() ||
      plainTextFromHtml(lessonTitle).trim() ||
      "Bài tập";
    const effectiveShareUrl =
      shareUrl ?? (typeof window !== "undefined" ? window.location.href : "");
    // Server auto-chấm trắc nghiệm rồi trả "graded" ngay dù điểm chưa trọn vẹn.
    // Chỉ ép ở lượt vừa nộp; review phải hiện điểm thật khi GV đã chấm xong.
    const pendingTeacherGrading =
      startMode !== "review" &&
      !!exercise?.questions.some((q) =>
        needsManualGrading(
          resolveQuestionType(q.type, q.payload),
          q.payload ?? {},
        ),
      );
    const isGraded =
      result.gradingStatus === "graded" && !pendingTeacherGrading;
    const score = submissionDetail?.score ?? null;
    const maxScore = submissionDetail?.maxScore;
    const scorePercent =
      isGraded && score !== null && maxScore && maxScore > 0
        ? Math.round((score / maxScore) * 100)
        : null;

    // "Xem lại bài làm": dựng review NGAY từ đề + đáp án học sinh (runner còn giữ
    // đủ trong state), để không phụ thuộc `getSubmissionReview` — trên LCMS cửa
    // đó trả null nên dialog trước đây chỉ hiện lại phần điểm (SBT_3 #36).
    // Lượt vừa làm+nộp: luôn dựng (kể cả khi chưa trả lời câu nào — vẫn phải
    // thấy lại đề). Chế độ review chỉ dựng khi nạp được đáp án; không thì để
    // null cho dialog giữ hành vi cũ, hơn là dựng một bản review rỗng.
    const reviewFallback =
      exercise && (startMode !== "review" || Object.keys(answers).length > 0)
        ? {
            // Cùng chính sách với màn soát bài: theo cờ server khi có, không
            // thì lộ. Trước đây khoá cứng `false` vì chưa hỏi server bao giờ.
            revealAnswers,
            questions: exercise.questions.map(
              (rawQ, index): SubmissionReviewQuestion => {
                const answer = answers[rawQ.id] ?? null;
                // Tin verdict player đã chấm CHỈ khi đáp án hiện tại vẫn đúng bản
                // đã chấm (đổi/hạ đáp án sau đó → snapshot lệch → chấm lại bằng
                // gradeByType). Câu chưa từng được player chấm cũng dùng gradeByType.
                const capturedVerdict = playerVerdictsRef.current[rawQ.id];
                const trustCapturedVerdict =
                  !!capturedVerdict &&
                  sameStudentAnswer(capturedVerdict.answer, answer);
                const regraded = gradeQuestion(rawQ, answer);
                const gradable = trustCapturedVerdict
                  ? true
                  : regraded.gradable;
                const correct = trustCapturedVerdict
                  ? capturedVerdict!.status === "success"
                  : regraded.isCorrect;
                const maxPoints = rawQ.points ?? 1;
                return {
                  ...rawQ,
                  order: index,
                  studentAnswer: answer,
                  isCorrect: gradable ? correct : null,
                  gradable,
                  points: gradable && correct ? maxPoints : 0,
                  maxPoints,
                  teacherComment: null,
                  fileCount: uploadedFiles[rawQ.id]?.length ?? 0,
                };
              },
            ),
          }
        : null;

    return (
      <div className="relative flex flex-col items-center flex-1 min-h-0 overflow-y-auto p-6 md:p-10 text-center gap-6 bg-sky-50/60">
        {/* "Thoát" về bài học — màn ngoài (hub) mới có "Làm bài mới"/"Quay lại",
            nên màn kết quả chỉ cần một lối thoát gọn ở góc. Giữ `absolute`:
            khung này chỉ cuộn phần tóm tắt điểm (ngắn), còn bài làm chi tiết
            nằm trong SubmissionDetailDialog với vùng cuộn riêng — đổi sang
            sticky chỉ đẩy nội dung xuống và đè chữ khi cuộn. */}
        <button
          type="button"
          onClick={handleExit}
          aria-label="Thoát"
          className="absolute top-4 right-4 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="size-4 sm:size-3" />
          <span className="max-sm:hidden">Thoát</span>
        </button>
        <div className="size-20 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="size-10 text-success" />
        </div>

        <div className="space-y-1 max-w-sm">
          <p className="text-sm font-black uppercase tracking-widest text-success">
            Đã nộp bài!
          </p>
          <h2 className="font-display text-2xl font-black text-slate-800 leading-tight">
            {displayTitle}
          </h2>
        </div>

        {/* Score / grading status */}
        {isGraded && score !== null ? (
          <div className="flex flex-col items-center gap-2">
            <Trophy className="size-9 text-amber-500" />
            <p className="text-5xl font-black tabular-nums text-slate-800">
              {score}
              <span className="text-xl font-bold text-slate-400">
                {" "}
                / {maxScore ?? "?"}
              </span>
            </p>
            {scorePercent !== null && (
              <p className="text-sm font-semibold text-slate-500">
                Đạt {scorePercent}%
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <Clock className="size-9 text-amber-500" />
            <p className="text-base font-bold text-amber-500">
              Chờ giáo viên chấm
            </p>
            <p className="text-sm text-slate-500 max-w-[280px]">
              Bài có câu tự luận — GV sẽ chấm và cập nhật điểm sau.
            </p>
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <Button
            type="button"
            className="w-full gap-2 rounded-full font-bold h-12 text-base"
            onClick={() => setResultDialogId(result.submissionId)}
          >
            <Eye className="size-5" />
            Xem lại bài làm
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 rounded-full font-bold h-12 text-base"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="size-5" />
            Chia sẻ
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 rounded-full font-bold h-12 text-base"
            onClick={handleExit}
          >
            <ArrowLeft className="size-5" />
            Quay lại bài học
          </Button>
        </div>
        <SubmissionDetailDialog
          submissionId={resultDialogId}
          open={resultDialogId !== null}
          onOpenChange={(open) => {
            if (!open) setResultDialogId(null);
          }}
          reviewFallback={reviewFallback}
          preloadedReview={serverReview}
          exerciseTitle={displayTitle}
          shareUrl={effectiveShareUrl}
          forcePending={pendingTeacherGrading}
        />
        <ShareCompletionDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          title={displayTitle}
          studentName={user?.full_name ?? user?.name ?? null}
          submittedAt={
            submissionDetail?.submittedAt ?? new Date().toISOString()
          }
          score={submissionDetail?.score ?? null}
          maxScore={submissionDetail?.maxScore ?? null}
          pending={!isGraded}
          shareUrl={effectiveShareUrl}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------- PLAYING
  if (!exercise) return null;

  const questions = mapBackendQuestions(exercise.questions);
  const rawQ = exercise.questions[current];
  const q = questions[current];
  const total = questions.length;
  const isLast = current === total - 1;
  // Đánh số theo mạch là chuyện ĐƯỢC ĂN CẢ: thiếu nhãn dù một câu thì bộ đếm,
  // dải chấm và số trước câu lệnh đều lùi về đánh số cả bài. Bật lẻ từng chỗ là
  // cùng một câu mang ba con số chọi nhau (chấm "4", đầu màn "Bài 2/5", đề "2").
  const navMarks = toNavMarks(
    questions.map((question) => question.id),
    questionLabelById ?? {},
  );
  const questionLabel = navMarks ? questionLabelById?.[rawQ.id] : undefined;
  const supportsFileUpload =
    !IS_LCMS && (rawQ.type === "essay" || rawQ.type === "short_answer");
  const filesForCurrent = uploadedFiles[rawQ.id] ?? [];
  // "Xem lời giải": chỉ khi câu có lời giải. Bài chấm-server không gửi
  // explanation lúc đang làm → nút tự ẩn (không lộ đáp án cho bài kiểm tra).
  const explanation = questionExplanation(q.payload);
  // Lời giải mở khoá theo MẠCH: xong hết mạch ĐỌC là xem được lời giải các câu
  // ĐỌC, không phải chờ nộp cả bài.
  const explanationUnlocked =
    graded ||
    isLineAnswered(
      rawQ.id,
      questions.map((question) => question.id),
      questionLabelById ?? {},
      isQuestionAnswered,
    );
  const audioSlots = resolveAudioSlots({
    line: questionLabel?.line,
    questionType: q.question_type,
    payload: q.payload,
    lessonAudioUrl: readingAudioUrl,
  });

  return (
    <div className="flex flex-col h-full min-h-0 animate-pop-in">
      {/* Progress bar + counter. Dải nhảy nhanh nằm NGAY trên hàng header
          (I.6.13) để tiết kiệm chiều dọc — bài nhiều câu không phải cuộn. */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 space-y-2">
        <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
          <QuestionCounter
            label={questionLabel}
            current={current}
            total={total}
          />
          {/* Chấm tròn: câu đang mở / đã làm / chưa làm; ‹ › dịch cửa sổ khi tràn. */}
          <QuestionNavStrip
            className="flex-1"
            count={total}
            current={current}
            isAnswered={(i) => isQuestionAnswered(questions[i].id)}
            onGoTo={goTo}
            marks={navMarks}
          />
          {headerAction}
          <button
            type="button"
            onClick={handleExit}
            disabled={exiting}
            aria-label="Thoát"
            className="relative z-10 pointer-events-auto shrink-0 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {/* Mobile chỉ icon (Owner 12/8) — cùng luật với StandaloneExerciseRunner. */}
            {exiting ? (
              <Loader2 className="size-4 sm:size-3 animate-spin" />
            ) : (
              <X className="size-4 sm:size-3" />
            )}
            <span className="max-sm:hidden">
              {exiting ? "Đang lưu…" : "Thoát"}
            </span>
          </button>
        </div>
        <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
        {submitError && (
          <p className="text-xs text-destructive font-medium">{submitError}</p>
        )}
      </div>

      {/* Question */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-3">
        <QuestionSectionTitle
          line={questionLabel?.line}
          title={questionLabel?.sectionLabel}
          readingAudioUrl={audioSlots.readingAudioUrl}
        />
        {/* CHẤM NGAY (instant): gradeMode mặc định "self" — player tự chấm từng
            thao tác (instantFeedback), tự phát âm thanh + phản hồi đúng/sai;
            revealCorrect vẫn false qua facade (không lộ ô đúng khi sai). Runner
            không truyền submitted/result để tránh double-feedback với chrome.
            CHẤM KÍN (sealed, bài GV giao): gradeMode="parent" — player CHỈ emit
            đáp án, không tự chấm; runner cũng KHÔNG truyền submitted/result nên
            không verdict nào lộ ra khi đang làm — chấm chỉ xảy ra lúc Nộp bài. */}
        <ColorFillMemoryProvider store={colorFillMemory}>
          <QuestionWithAudio audioUrl={audioSlots.questionAudioUrl}>
            <QuestionPlayer
              key={`${q.id}:${resetNonce[rawQ.id] ?? 0}`}
              question={q}
              index={current}
              answer={answers[rawQ.id]}
              onAnswerChange={(ans) => handleAnswerChange(rawQ.id, ans)}
              // Câu upload_answer: file upload NGAY khi chọn (POST /attempt/upload-file),
              // answer thành {files:[{fileUrl,fileId,…}]} và tự chảy theo autosave/submit.
              // CHỈ dưới LCMS: wire format answer.files là hợp đồng của LCMS; provider
              // legacy nối file qua kênh files:[{questionId,fileId}] top-level riêng,
              // chưa ai xác nhận nó đọc answer.files — legacy giữ hành vi cũ (local).
              onUploadFile={
                IS_LCMS && attemptId
                  ? (file) =>
                      uploadGate.wrap(() => uploadAttemptFile(attemptId, file))
                  : undefined
              }
              // Đã chấm: `submitted` + `revealCorrect` để CHÍNH PLAYER tô dấu
              // đúng/sai + chỉ đáp án đúng ngay trong câu, `hideResultBanner` để
              // kết quả không thành một khung verdict riêng. Giống hệt đường khách.
              gradeMode={
                graded || sealed ? "parent" : silent ? "silent" : undefined
              }
              // `|| undefined` KHÔNG phải thừa: lúc đang làm, runner cố ý KHÔNG
              // truyền ba prop hiển thị này — hợp đồng "player tự chấm, runner
              // không can thiệp" mà SubmissionRunner.checkPersist ghim bằng
              // `submitted=undefined`. Truyền `false` tuy tương đương về hành vi
              // nhưng phá cái ghim đó.
              submitted={graded || undefined}
              revealCorrect={graded ? revealAnswers : undefined}
              hideResultBanner={graded || undefined}
              // CHẤM KÍN: player vẫn tự chấm đúng theo loại của nó, chỉ không được
              // hiển thị — kênh câm này đưa verdict đó về đây để ghi điểm, thay vì
              // chấm lại bằng gradeByType (bộ chấm ngoài không hiểu hết mọi loại).
              // Chấm ngay không dùng kênh này: player đi đường onStatusChange.
              onSilentVerdict={(verdict) => {
                if (verdict === "incomplete") return;
                playerVerdictsRef.current[rawQ.id] = {
                  status: verdict === "correct" ? "success" : "error",
                  answer: latestAnswersRef.current[rawQ.id] ?? null,
                };
              }}
              // CHẤM NGAY: mascot phản hồi từng thao tác (onElementGraded) và khen
              // khi cả câu đúng (onStatusChange). Chấm kín: hook tự bỏ qua verdict.
              onElementGraded={mascot.onElementGraded}
              onStatusChange={(s) => {
                // Ghi verdict cả-câu KÈM đáp án vừa chấm, để "Xem lại bài làm" chỉ
                // tin verdict khi đáp án chưa đổi. Bỏ qua idle: nó là "chưa hoàn
                // thành", không phải verdict — nhưng vì có kèm snapshot đáp án nên
                // đổi/hạ đáp án sau đó vẫn bị phát hiện (snapshot lệch → chấm lại).
                if (s === "success" || s === "error")
                  playerVerdictsRef.current[rawQ.id] = {
                    status: s,
                    answer: latestAnswersRef.current[rawQ.id] ?? null,
                  };
                mascot.onStatusChange(s);
              }}
            />
          </QuestionWithAudio>
        </ColorFillMemoryProvider>

        {/* File upload for essay/short_answer questions */}
        {supportsFileUpload && attemptId && (
          <div className="rounded-xl border border-dashed border-border/60 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Đính kèm file (tuỳ chọn, tối đa 20 MB/file):
            </p>

            {filesForCurrent.map((f) => (
              <div
                key={f.fileId}
                className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5"
              >
                <a
                  href={safeHttpUrl(resolveAssetUrl(f.fileUrl))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline truncate"
                >
                  {f.name}
                </a>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(rawQ.id, f.fileId)}
                  className="shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}

            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-muted/50 hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors">
              {uploadingId === rawQ.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Paperclip className="size-3.5" />
              )}
              {uploadingId === rawQ.id ? "Đang tải lên…" : "Chọn file"}
              <input
                type="file"
                className="sr-only"
                disabled={uploadingId === rawQ.id}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(rawQ.id, file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-border/60 bg-white/60 backdrop-blur-md shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
        <div className="px-3 py-1.5 sm:px-4 sm:py-2 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-3">
          <div className="min-w-0">
            {/* Player vẽ verdict trên từng phần tử; BusyBee nói lời tương ứng
                (đúng/sai từng thao tác, khen khi xong cả câu) rồi quay về hướng dẫn. */}
            <BusyBee status={mascot.status} message={mascot.message} />
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-center sm:justify-end">
            {/* "Làm lại" CHỈ hiện khi câu đã có đáp án (Owner 31/7) — xoá đáp án
                + remount player để dọn state nội bộ uncontrolled. */}
            {!graded && answers[rawQ.id] !== undefined && (
              <button
                type="button"
                onClick={() => {
                  setAnswers((prev) => {
                    const next = { ...prev };
                    delete next[rawQ.id];
                    return next;
                  });
                  forgetColorFill(colorFillMemory, rawQ.id);
                  setResetNonce((prev) => ({
                    ...prev,
                    [rawQ.id]: (prev[rawQ.id] ?? 0) + 1,
                  }));
                  // Đẩy việc XOÁ xuống server: autosave chỉ cộng thêm (bỏ qua đáp
                  // án undefined), nên không gửi thì attempt vẫn giữ đáp án cũ →
                  // vào lại hub đếm dư "đã làm". Gửi answer rỗng để câu về "chưa làm".
                  void persistAnswer(rawQ, null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <RotateCw className="size-3" />
                Làm lại
              </button>
            )}

            {explanation && explanationUnlocked && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl font-semibold"
                onClick={() => setExplanationOpen(true)}
              >
                <Eye className="size-4" />
                <span className="hidden sm:inline">Xem lời giải</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl font-semibold"
              disabled={current === 0 || exiting}
              onClick={() => handleNav("prev")}
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Câu trước</span>
            </Button>

            {/* Đã chấm thì soát lại là TUỲ Ý — lối tắt sang màn điểm, khỏi bấm
                hết từng câu. Ẩn ở câu cuối vì nút chính bên phải đã là nó. */}
            {graded && !isLast && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl font-semibold"
                onClick={() => setPhase("result")}
              >
                <CheckCircle2 className="size-4" />
                <span className="hidden sm:inline">Hoàn thành</span>
              </Button>
            )}

            {isLast ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 rounded-xl font-bold"
                disabled={exiting}
                onClick={graded ? () => setPhase("result") : handleSubmit}
              >
                <CheckCircle2 className="size-4" />
                <span className="hidden sm:inline">
                  {graded ? "Hoàn thành" : "Nộp bài"}
                </span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 rounded-xl font-semibold"
                disabled={exiting}
                onClick={() => handleNav("next")}
              >
                <span className="hidden sm:inline">Câu tiếp</span>
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {explanation && (
        <ExplanationDialog
          open={explanationOpen}
          onOpenChange={setExplanationOpen}
          explanation={explanation}
        />
      )}

      {/* Cảnh báo mềm: còn câu chưa làm khi bấm Nộp bài */}
      <UnansweredConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={getUnansweredIndexes().length}
        onStay={() => {
          const u = getUnansweredIndexes();
          setConfirmOpen(false);
          if (u.length > 0) setCurrent(u[0]);
        }}
        onProceed={() => {
          setConfirmOpen(false);
          doSubmit();
        }}
        proceedLabel="Vẫn nộp bài"
      />
    </div>
  );
}
