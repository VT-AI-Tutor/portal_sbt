import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  RotateCw,
  X,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import {
  QuestionPlayer,
  type PlayerQuestion,
} from "@/core/exercise/QuestionPlayer";
import {
  ColorFillMemoryProvider,
  createColorFillMemory,
  forgetColorFill,
} from "@/core/exercise/players/color-fill-memory";
import { toast } from "sonner";
import { isAnswerEmpty } from "@/core/exercise/grading";
import { UnansweredConfirmDialog } from "./UnansweredConfirmDialog";
import { QuestionNavStrip } from "./QuestionNavStrip";
import { ExplanationDialog, questionExplanation } from "./ExplanationDialog";
import { BusyBee } from "@/core/exercise/tasks/BusyBee";
import { mascotIdleMessage } from "@/core/exercise/mascotInstruction";
import { useMascotFeedback } from "@/core/exercise/useMascotFeedback";
import {
  QuestionCounter,
  QuestionSectionTitle,
  QuestionWithAudio,
} from "./QuestionLabelChrome";
import { resolveAudioSlots } from "./QuestionAudioButton";
import { LessonTitleText } from "./LessonTitleText";
import {
  isLineAnswered,
  READING_LINE,
  toNavMarks,
  type QuestionLabel,
} from "./lessonSections";

interface StandaloneExerciseRunnerProps {
  lessonTitle: string;
  questions: PlayerQuestion[];
  /** Tra mạch + số bài tập theo id câu hỏi — nhãn của câu đang mở. */
  questionLabelById?: Record<string, QuestionLabel>;
  /** Ghi âm bài đọc của cả bài; chỉ hiện khi câu đang mở thuộc mạch ĐỌC. */
  readingAudioUrl?: string;
  onStart?: () => void;
  /** Gọi khi nhấn "Thoát" để cha thu lại layout bài tập (về màn hình sách). */
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
   * Gọi khi lượt làm đã KẾT THÚC (màn hoàn thành). Cha cần biết để lần vào sau
   * còn remount runner — nếu không, bấm vào bài tập từ hub sẽ ra lại màn hoàn
   * thành cũ thay vì làm từ câu 1.
   */
  onFinish?: () => void;
}

/**
 * "graded" = đã chấm, hiển thị NGAY TRONG runner đang chạy: học sinh đứng đâu ở
 * lại đó, câu hiện tại lập tức có đúng/sai + đáp án đúng như chấm ngay. Không
 * mở màn xem lại riêng, không nhảy về câu 1.
 */
type Phase = "playing" | "graded" | "done";

/** Toast báo đã chấm xong. Câu chữ do Owner chốt. */
const FINISHED_MESSAGE = "Em đã làm xong tất cả câu hỏi. Xem kết quả nhé!";

export function StandaloneExerciseRunner({
  lessonTitle,
  questions,
  questionLabelById,
  readingAudioUrl,
  onStart,
  onExit,
  headerAction,
  onFinish,
}: StandaloneExerciseRunnerProps) {
  // Màn intro đã chuyển lên hub của BookLessonPage (Owner 03/8) — mount là vào
  // làm ngay. Chế độ xem trước không mất thông tin: trang đã có PreviewBanner
  // riêng ở đầu; lời mời đăng nhập giờ nằm ở hub.
  const [phase, setPhase] = useState<Phase>("playing");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  // CHẤM CÂM (gradeMode "silent"): player vẫn tự chấm chính xác theo loại của
  // nó nhưng không phản hồi tức thời — đúng/sai chỉ hiện ở màn "Hoàn thành".
  // "Làm lại" phải xoá đáp án + remount player (uncontrolled tự giữ state nội bộ
  // như EssayPlayer.done). Bộ đếm theo questionId ghép vào key QuestionPlayer.
  const [resetNonce, setResetNonce] = useState<Record<string, number>>({});
  // Sổ nhớ màu câu tô màu (color_fill) suốt lượt làm — player unmount khi
  // chuyển câu, còn đáp án chỉ mang id nên quay lại sẽ mất màu đã tô.
  const [colorFillMemory] = useState(createColorFillMemory);
  // Cảnh báo mềm "còn câu chưa làm" khi bấm Hoàn thành ở câu cuối.
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Modal "Đáp án/ Gợi ý" của câu đang làm (nút "Xem lời giải").
  const [explanationOpen, setExplanationOpen] = useState(false);

  /**
   * Câu này đã làm chưa. Dùng CHUNG cho dải chấm, cảnh báo "còn câu chưa làm"
   * và khoá lời giải — ba nơi tự định nghĩa riêng thì sẽ có ngày dải chấm báo
   * trống còn nút Nộp bài thì không.
   */
  const isQuestionAnswered = useCallback(
    (questionId: string) => !isAnswerEmpty(answers[questionId]),
    [answers],
  );

  const total = questions.length;
  const graded = phase === "graded";
  const q = questions[current];
  const explanation = questionExplanation(q?.payload);
  // Lời giải mở khoá theo MẠCH: xong hết mạch ĐỌC là xem được lời giải các câu
  // ĐỌC, không phải chờ xong cả bài.
  const explanationUnlocked =
    graded ||
    isLineAnswered(
      q?.id ?? "",
      questions.map((question) => question.id),
      questionLabelById ?? {},
      isQuestionAnswered,
    );
  // Đánh số theo mạch là chuyện ĐƯỢC ĂN CẢ: thiếu nhãn dù một câu thì bộ đếm,
  // dải chấm và số trước câu lệnh đều lùi về đánh số cả bài. Bật lẻ từng chỗ là
  // cùng một câu mang ba con số chọi nhau (chấm "4", đầu màn "Bài 2/5", đề "2").
  const navMarks = toNavMarks(
    questions.map((question) => question.id),
    questionLabelById ?? {},
  );
  const questionLabel = navMarks ? questionLabelById?.[q?.id ?? ""] : undefined;

  // Mascot: lời hướng dẫn theo (type × interaction) + phản hồi CHẤM NGAY.
  // questionKey gồm cả nonce "Làm lại" để lời khen câu cũ không dính sang lượt mới.
  // useMemo: lời idle (có thể là mảng run) chỉ dựng lại khi đổi câu.
  const idleMessage = useMemo(
    () => mascotIdleMessage(q?.question_type, q?.payload),
    [q?.question_type, q?.payload],
  );
  const mascot = useMascotFeedback({
    questionKey: `${q?.id ?? ""}:${resetNonce[q?.id ?? ""] ?? 0}`,
    idleMessage,
    // Chấm câm: mascot chỉ còn dẫn dắt, không khen/nhắc đúng sai.
    enabled: false,
  });

  // Chỉ số các câu chưa làm (đáp án trống) — dùng cho cảnh báo mềm + nhảy tới câu trống.
  const unansweredIndexes = questions
    .map((q, i) => (isQuestionAnswered(q.id) ? -1 : i))
    .filter((i) => i >= 0);

  // Vào thẳng phase playing → báo cha ngay khi mount để cha thu layout lại.
  useEffect(() => {
    onStart?.();
    // Chỉ chạy 1 lần lúc mount; cha remount bằng key khi muốn làm lại từ đầu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Làm lại" ở màn hoàn thành — không còn màn intro để quay về, nên reset tại
  // chỗ. Phải bump resetNonce MỌI câu: player tương tác là uncontrolled, không
  // remount thì đáp án cũ còn nguyên trên màn hình.
  const handleRestart = () => {
    setCurrent(0);
    setAnswers({});
    colorFillMemory.clear();
    setResetNonce((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const q of questions) next[q.id] = (next[q.id] ?? 0) + 1;
      return next;
    });
    setPhase("playing");
  };

  // "Thoát" — về hub của trang bài học. Giữ nguyên câu đang làm: runner vẫn
  // mounted (cha chỉ ẩn), quay lại là thấy đúng chỗ dở.
  const handleExit = () => {
    onExit?.();
  };

  const doComplete = () => {
    // Về câu 1 để soát lại từ đầu cho dễ (Owner 19/08). Vẫn là CHÍNH runner này
    // chuyển sang trạng thái đã chấm, không mở màn xem lại nào khác.
    setCurrent(0);
    setPhase("graded");
    toast.success(FINISHED_MESSAGE);
    onFinish?.();
  };

  const handleNext = () => {
    if (graded && current === total - 1) {
      setPhase("done");
      return;
    }
    if (current < total - 1) {
      // Kẹp TRONG updater: guard ở trên đọc `current` của lượt render hiện tại,
      // nên bấm dồn nhiều lần trong cùng một tick sẽ cộng dồn và vượt quá số
      // câu → questions[i] undefined → trắng màn, mất sạch bài làm.
      setCurrent((c) => Math.min(c + 1, total - 1));
      return;
    }
    // Câu cuối → cảnh báo mềm nếu còn câu chưa làm, nhưng vẫn cho hoàn thành.
    if (unansweredIndexes.length > 0) {
      setConfirmOpen(true);
      return;
    }
    doComplete();
  };

  const handlePrev = () => {
    if (current > 0) setCurrent((c) => c - 1);
  };

  /**
   * Nhảy thẳng tới một câu bất kỳ (I.6.13) — đối xứng với SubmissionRunner để
   * hai runner không lệch UX (guest cũng có dải chấm tròn như học sinh đăng nhập).
   * Không có hợp đồng "lưu khi rời câu" như SubmissionRunner: đáp án ở đây cập
   * nhật liên tục vào `answers` qua onAnswerChange, nên chỉ cần đổi câu đang mở.
   */
  const goTo = (index: number) => {
    if (index !== current) setCurrent(index);
  };

  // ----------------------------------------------------------------- DONE
  if (phase === "done") {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] p-6 text-center gap-6 animate-pop-in">
        <div className="size-16 rounded-2xl bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="size-8 text-success" />
        </div>

        <div className="space-y-2 max-w-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-success">
            Hoàn thành!
          </p>
          <h2 className="font-display text-xl md:text-2xl font-black text-foreground leading-tight">
            Em đã làm xong bài tập
          </h2>
          <p className="text-sm text-muted-foreground">
            Chúc mừng em đã hoàn thành{" "}
            <span className="font-bold text-foreground">{total} câu hỏi</span>{" "}
            của bài{" "}
            <span className="font-semibold">
              <LessonTitleText title={lessonTitle} />
            </span>
            !
          </p>
        </div>

        {/* Làm xong là hết đường: trước đây màn này chỉ có "Làm lại từ đầu",
            không có lối về hub (nút "Thoát" chỉ nằm ở màn đang làm). */}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {/* `w-full` chứ không phải `flex-1`: xếp CỘT thì flex-basis 0 đè chết
              h-12 theo trục dọc — nút co về đúng chiều cao chữ (~36px), chính
              là ca "nút quá mảnh" Owner 12/8. */}
          <Button
            type="button"
            size="lg"
            className="w-full gap-2 rounded-xl font-bold shadow-soft"
            onClick={handleExit}
          >
            <ArrowLeft className="size-4" />
            Quay lại bài học
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full gap-2 rounded-xl font-bold"
            onClick={() => {
              setCurrent(0);
              setPhase("graded");
            }}
          >
            <Eye className="size-4" />
            Xem lại bài làm
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full gap-2 rounded-xl font-bold"
            onClick={handleRestart}
          >
            <RotateCw className="size-4" />
            Làm lại từ đầu
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- PLAYING
  const isLast = current === total - 1;
  const audioSlots = resolveAudioSlots({
    line: questionLabel?.line,
    questionType: q.question_type,
    payload: q.payload,
    lessonAudioUrl: readingAudioUrl,
  });

  return (
    <div className="flex flex-col h-full min-h-0 animate-pop-in">
      {/* Progress bar + counter. Dải nhảy nhanh nằm NGAY trên hàng header
          (I.6.13, đối xứng SubmissionRunner) để tiết kiệm chiều dọc. */}
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
            aria-label="Thoát"
            className="relative z-10 pointer-events-auto shrink-0 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
          >
            {/* Mobile chỉ icon (Owner 12/8) — thanh đầu chật, chữ "Thoát" nhường
                chỗ cho dải chấm câu; aria-label giữ ngữ nghĩa cho screen reader. */}
            <X className="size-4 sm:size-3" />
            <span className="max-sm:hidden">Thoát</span>
          </button>
        </div>
        {/* Progress track */}
        <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
        <QuestionSectionTitle
          line={questionLabel?.line}
          title={questionLabel?.sectionLabel}
          readingAudioUrl={audioSlots.readingAudioUrl}
        />
        {/* CHẤM CÂM: đang làm thì player không lộ gì — không tô màu, không âm
            thanh, không khoá câu. Làm xong (`reviewing`) mới bật `submitted` +
            `revealCorrect`: đúng/sai và ĐÁP ÁN ĐÚNG hiện ngay trên câu hỏi,
            đúng chỗ học sinh vừa làm. */}
        <ColorFillMemoryProvider store={colorFillMemory}>
          <QuestionWithAudio audioUrl={audioSlots.questionAudioUrl}>
            <QuestionPlayer
              key={`${q.id}:${resetNonce[q.id] ?? 0}`}
              question={q}
              index={current}
              answer={answers[q.id]}
              // Đang làm: chấm câm, không lộ gì. Chấm xong: `submitted` +
              // `revealCorrect` để CHÍNH PLAYER tô dấu đúng/sai lên từng phần tử và
              // chỉ ra đáp án đúng — giống hệt chấm ngay. `hideResultBanner` vì kết
              // quả phải nằm TRONG câu, không phải một khung verdict riêng.
              gradeMode={graded ? "parent" : "silent"}
              submitted={graded}
              revealCorrect={graded}
              hideResultBanner={graded}
              onAnswerChange={(a) =>
                setAnswers((prev) => ({ ...prev, [q.id]: a }))
              }
              onStatusChange={mascot.onStatusChange}
            />
          </QuestionWithAudio>
        </ColorFillMemoryProvider>
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
                + remount player để reset state nội bộ uncontrolled. */}
            {answers[q.id] !== undefined && (
              <button
                type="button"
                onClick={() => {
                  setAnswers((prev) => {
                    const next = { ...prev };
                    delete next[q.id];
                    return next;
                  });
                  forgetColorFill(colorFillMemory, q.id);
                  setResetNonce((prev) => ({
                    ...prev,
                    [q.id]: (prev[q.id] ?? 0) + 1,
                  }));
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
              disabled={current === 0}
              onClick={handlePrev}
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Câu trước</span>
            </Button>

            {/* Đã chấm thì soát lại là TUỲ Ý — không bắt bấm hết từng câu mới
                thoát được. Chỉ hiện khi chưa ở câu cuối, vì ở câu cuối nút
                chính bên phải đã là "Hoàn thành". */}
            {graded && !isLast && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl font-semibold"
                onClick={() => setPhase("done")}
              >
                <CheckCircle2 className="size-4" />
                <span className="hidden sm:inline">Hoàn thành</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              className="gap-1.5 rounded-xl font-bold"
              onClick={handleNext}
            >
              {isLast ? (
                <>
                  <CheckCircle2 className="size-4" />
                  <span className="hidden sm:inline">Hoàn thành</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Câu tiếp</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
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

      {/* Cảnh báo mềm: còn câu chưa làm khi bấm Hoàn thành */}
      <UnansweredConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={unansweredIndexes.length}
        onStay={() => {
          setConfirmOpen(false);
          if (unansweredIndexes.length > 0) setCurrent(unansweredIndexes[0]);
        }}
        onProceed={() => {
          setConfirmOpen(false);
          doComplete();
        }}
        proceedLabel="Vẫn hoàn thành"
      />
    </div>
  );
}
