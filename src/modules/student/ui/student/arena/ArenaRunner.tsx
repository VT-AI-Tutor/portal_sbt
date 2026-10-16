/**
 * Runs an in-progress Arena attempt — a real-exam timed round (Task 13):
 * countdown header (auto-submits at 0, exactly once — see `useCountdown`),
 * NO per-question "Kiểm tra"/verdict (grading happens server-side at
 * submit), quick-nav to jump between questions, and an always-available
 * "Nộp bài" with a confirm dialog (warns about unanswered questions).
 *
 * Answers autosave (debounced 10s + flush on unmount/beforeunload/keepalive)
 * and survive reload via the server-persisted `attempt.answers`. Pattern
 * cloned from `PracticeRunner`'s `timed` mode — see that file's header
 * comment — but simpler: no practice/game modes, and the mutation
 * (`useSubmitArenaAttempt`) is owned here instead of by the parent page,
 * per this component's `{ attempt, onSubmitted }` contract.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Clock, Send, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/core/ui/button";
import { Progress } from "@/core/ui/progress";
import { cn } from "@/core/lib/utils";
import { QuestionPlayer } from "@/core/exercise/QuestionPlayer";
import {
  ColorFillMemoryProvider,
  createColorFillMemory,
} from "@/core/exercise/players/color-fill-memory";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/core/ui/alert-dialog";
import { useCountdown } from "../practice/useCountdown";
import {
  mapArenaQuestion,
  serializeArenaAnswer,
  deserializeArenaAnswer,
} from "./mapArenaQuestion";
import {
  saveArenaAnswers,
  ArenaApiError,
} from "@/modules/student/api/arenaApi";
import { useSubmitArenaAttempt } from "@/modules/student/api/arenaHooks";
import type {
  ArenaAttempt,
  ArenaSubmitResult,
} from "@/modules/student/api/arenaApi";

const AUTOSAVE_DEBOUNCE_MS = 10_000;

interface ArenaRunnerProps {
  attempt: ArenaAttempt;
  onSubmitted: (result: ArenaSubmitResult) => void;
}

export function ArenaRunner({ attempt, onSubmitted }: ArenaRunnerProps) {
  const navigate = useNavigate();
  const questions = attempt.questions;
  const total = questions.length;

  const limitSeconds = useMemo(
    () =>
      (Date.parse(attempt.expires_at) - Date.parse(attempt.started_at)) / 1000,
    [attempt.expires_at, attempt.started_at],
  );

  const [current, setCurrent] = useState(0);
  // Sổ nhớ màu câu tô màu (color_fill) suốt lượt làm — player unmount khi
  // chuyển câu, còn đáp án chỉ mang id nên quay lại sẽ mất màu đã tô.
  const [colorFillMemory] = useState(createColorFillMemory);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const [questionId, answer] of Object.entries(attempt.answers ?? {})) {
      const q = questions.find((qq) => qq.id === questionId);
      initial[questionId] = q ? deserializeArenaAnswer(q, answer) : answer;
    }
    return initial;
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submitMutation = useSubmitArenaAttempt();

  // ---------------------------------------------------------------------
  // Autosave — debounce 10s after the last answer change; flush immediately
  // on unmount and on `beforeunload` so nothing is lost on navigation/close.
  // ---------------------------------------------------------------------
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Set right before the pre-submit flush and on successful submit — every
  // flush after that (debounce tail, unmount cleanup when the page swaps to
  // ArenaResult) is skipped so it doesn't race a round that's already closed
  // server-side.
  const submittedRef = useRef(false);

  const flush = useCallback(
    (opts?: { keepalive?: boolean }): Promise<void> => {
      if (submittedRef.current) return Promise.resolve();
      const wire: Record<string, unknown> = {};
      for (const [questionId, answer] of Object.entries(answersRef.current)) {
        const q = questions.find((qq) => qq.id === questionId);
        wire[questionId] = q ? serializeArenaAnswer(q, answer) : answer;
      }
      if (Object.keys(wire).length === 0) return Promise.resolve();
      return saveArenaAnswers(attempt.attempt_id, wire, opts).catch((err) => {
        // ARENA_ATTEMPT_CLOSED (409): the round auto-closed (tick job) while
        // the student was still answering — nothing left to save to, and
        // there's nothing more this runner can do except send them back.
        if (
          err instanceof ArenaApiError &&
          err.errorCode === "ARENA_ATTEMPT_CLOSED"
        ) {
          submittedRef.current = true;
          toast.error(
            "Vòng đã đóng — bài của em đã được nộp với các câu đã lưu.",
            { id: "arena-attempt-closed" },
          );
          navigate("/student/arena");
          return;
        }
        toast.error(
          "Chưa đồng bộ được bài thi lên máy chủ. Em kiểm tra kết nối nhé.",
          { id: "arena-autosave-failed" },
        );
      });
    },
    [attempt.attempt_id, questions, navigate],
  );

  useEffect(() => {
    const timer = setTimeout(() => void flush(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [answers, flush]);

  useEffect(() => {
    const onBeforeUnload = () => void flush({ keepalive: true });
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush({ keepalive: true });
    };
    // Wired once per attempt (`flush` only changes if attempt id changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.attempt_id]);

  // ---------------------------------------------------------------------
  // Submit — guarded against double-submit (dialog click spam / auto-submit
  // racing a manual click / slow network).
  // ---------------------------------------------------------------------
  const submitLockRef = useRef(false);

  const doSubmit = useCallback(async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    // Submit grades from SAVED answers, so the final flush MUST land first —
    // otherwise the last-changed answers are silently ungraded.
    await flush();
    submittedRef.current = true;
    try {
      const result = await submitMutation.mutateAsync(attempt.attempt_id);
      onSubmitted(result);
    } catch (err) {
      submittedRef.current = false;
      submitLockRef.current = false;
      if (
        err instanceof ArenaApiError &&
        (err.errorCode === "ARENA_ATTEMPT_EXPIRED" ||
          err.errorCode === "ARENA_ALREADY_SUBMITTED")
      ) {
        // Round may have auto-closed (tick job) or another tab already
        // submitted this same attempt — nothing left to do here.
        toast.error("Lượt thi đã kết thúc — bài của em đã được ghi nhận.");
        navigate("/student/arena");
        return;
      }
      toast.error("Nộp bài thất bại, em thử lại nhé.");
    }
  }, [flush, submitMutation, attempt.attempt_id, onSubmitted, navigate]);

  // ---------------------------------------------------------------------
  // Countdown — auto-submits once, on expiry.
  // ---------------------------------------------------------------------
  const countdown = useCountdown(
    attempt.started_at,
    limitSeconds,
    () => void doSubmit(),
  );

  const unansweredCount = useMemo(
    () => questions.filter((q) => answers[q.id] === undefined).length,
    [questions, answers],
  );

  // `mapArenaQuestion` is a pure function of the raw question — memoize per
  // question id so a re-render from the countdown ticking every second
  // doesn't re-map/re-mount the current question's payload.
  const rawQ = questions[current];
  const question = useMemo(
    () => (rawQ ? mapArenaQuestion(rawQ) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawQ?.id],
  );

  function handleAnswerChange(questionId: string, answer: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  function goTo(index: number) {
    setCurrent(Math.max(0, Math.min(total - 1, index)));
  }

  if (total === 0 || !rawQ || !question) return null;


  return (
    <div className="mx-auto flex h-dvh max-w-6xl flex-col gap-3 p-4 md:gap-4 md:px-8 md:py-5">
      {/* Header — tiêu đề + đồng hồ đếm ngược to */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-bold">Đang thi đấu trường</h1>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-lg font-black tabular-nums transition-colors",
            countdown.isDanger
              ? "bg-destructive/15 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          <Clock className="size-5" />
          {countdown.label}
        </span>
      </div>

      {/* Progress n/N */}
      <div className="flex items-center gap-3">
        <Progress value={((current + 1) / total) * 100} className="flex-1" />
        <span className="text-sm font-bold text-muted-foreground tabular-nums shrink-0">
          {current + 1} / {total}
        </span>
      </div>

      {/* Question — chiếm hết chiều cao còn lại, scroll BÊN TRONG để
          header/đồng hồ + điều hướng/Nộp bài luôn hiển thị. */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border-2 border-border/70 bg-card p-4 md:p-6">
        <ColorFillMemoryProvider store={colorFillMemory}>
          <QuestionPlayer
            key={rawQ.id}
            question={question}
            index={current}
            answer={answers[rawQ.id]}
            onAnswerChange={(a) => handleAnswerChange(rawQ.id, a)}
            submitted={false}
            gradeMode="parent"
          />
        </ColorFillMemoryProvider>
      </div>

      {/* Nhảy nhanh tới câu — pattern PracticeRunner, highlight câu đã trả lời. */}
      {total > 1 && (
        <div className="space-y-2 pt-1">
          <div className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <Zap className="size-3.5" />
            Nhảy nhanh tới câu khác:
          </div>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, i) => {
              const isCurrent = i === current;
              const answered = answers[q.id] !== undefined;
              return (
                <button
                  key={q.id}
                  type="button"
                  aria-label={`Tới câu ${i + 1}`}
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={() => goTo(i)}
                  className={cn(
                    "size-9 rounded-full border-2 text-sm font-bold transition-all cursor-pointer",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : answered
                        ? "border-primary/60 bg-card text-primary hover:border-primary"
                        : "border-border bg-card hover:border-primary/60",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Điều hướng câu + Nộp bài — Nộp luôn hiện (không gate theo câu cuối,
          khác PracticeRunner: arena cho phép nộp bất cứ lúc nào vì có đồng hồ). */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full h-12 px-4 md:px-6 gap-1"
            disabled={current === 0}
            onClick={() => goTo(current - 1)}
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Câu trước</span>
          </Button>
          <Button
            type="button"
            variant={current === total - 1 ? "outline" : "default"}
            className={cn(
              "rounded-full h-12 px-4 md:px-6 gap-1",
              current < total - 1 && "btn-pop",
            )}
            disabled={current === total - 1}
            onClick={() => goTo(current + 1)}
          >
            <span className="hidden sm:inline">Câu tiếp</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              size="lg"
              variant={unansweredCount > 0 ? "outline" : "default"}
              className={cn(
                "rounded-full h-12 px-8 text-base gap-2",
                unansweredCount === 0 && "btn-pop",
              )}
              disabled={submitMutation.isPending}
            >
              <Send className="size-4" />
              Nộp bài
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Nộp bài</AlertDialogTitle>
              <AlertDialogDescription>
                {unansweredCount > 0
                  ? `Còn ${unansweredCount} câu chưa làm. Em có chắc muốn nộp bài không?`
                  : "Em chắc chắn muốn nộp bài?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitMutation.isPending}>
                Huỷ
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={submitMutation.isPending}
                onClick={() => void doSubmit()}
              >
                {submitMutation.isPending ? "Đang nộp..." : "Nộp bài"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
