/**
 * Runs an in-progress practice session â€” practice mode (no clock, NO
 * per-question check: results are revealed only on the post-submit result
 * screen), game mode (per-question "Kiá»ƒm tra" check driving the combo streak
 * chrome + auto-advance on a correct answer), and timed mode (countdown
 * header, no per-question check, auto-submits at 0). Answers
 * autosave (debounced 10s + flush on unmount/beforeunload/blur-navigation)
 * and survive reload via the server-persisted `session.answers`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Clock, Send, X, Zap } from "lucide-react";
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
  QUESTION_TYPE_LABELS,
  isKnownQuestionType,
} from "@/core/question-schema/question-types.generated";
import { canonicalQuestionType } from "@/core/question-schema/adapter";
import { PRACTICE_QUESTION_TYPE_LABEL_FALLBACK } from "@/core/reference/practiceLabels";
import {
  mapSessionQuestion,
  gradeSessionQuestion,
  serializeSessionAnswer,
  deserializeSessionAnswer,
} from "@/modules/student/api/mapSessionQuestion";
import { savePracticeAnswers } from "@/modules/student/api/practiceApi";
import { postToNative } from "@/core/embed/bridge";
import type {
  PracticeSession,
  SessionAnswer,
} from "@/modules/student/api/practiceApi";
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
import { useCountdown } from "./useCountdown";
import { GameModeChrome } from "./GameModeChrome";
import {
  INITIAL_COMBO_STATE,
  nextCombo,
  shouldScore,
  type ComboState,
} from "./comboLogic";

const GAME_AUTO_ADVANCE_MS = 800;

const AUTOSAVE_DEBOUNCE_MS = 10_000;

const MODE_LABEL: Record<PracticeSession["mode"], string> = {
  practice: "Luyá»‡n táº­p",
  game: "ChÆ¡i game",
  timed: "Thi thá»­",
};

const DIFFICULTY_META: Record<
  "easy" | "medium" | "hard",
  { label: string; dot: string; text: string }
> = {
  easy: { label: "Dá»…", dot: "bg-success", text: "text-success" },
  medium: { label: "Trung bÃ¬nh", dot: "bg-warning", text: "text-warning" },
  hard: { label: "KhÃ³", dot: "bg-destructive", text: "text-destructive" },
};

interface PracticeRunnerProps {
  session: PracticeSession;
  onSubmit: () => void;
  submitting: boolean;
  submitError?: string | null;
}

export function PracticeRunner({
  session,
  onSubmit,
  submitting,
  submitError,
}: PracticeRunnerProps) {
  const navigate = useNavigate();
  const questions = session.questions;
  const total = questions.length;
  const isTimed = session.mode === "timed";
  const isGame = session.mode === "game";

  const [current, setCurrent] = useState(0);
  // Once the student has reached the last question, "Ná»™p bÃ i" stays available
  // on every question â€” they can submit from wherever they are (a
  // single-question session qualifies from the start). Latched: never resets.
  const [reachedLast, setReachedLast] = useState(total <= 1);
  useEffect(() => {
    if (current >= total - 1) setReachedLast(true);
  }, [current, total]);
  // Sá»• nhá»› mÃ u cÃ¢u tÃ´ mÃ u (color_fill) suá»‘t lÆ°á»£t lÃ m â€” player unmount khi
  // chuyá»ƒn cÃ¢u, cÃ²n Ä‘Ã¡p Ã¡n chá»‰ mang id nÃªn quay láº¡i sáº½ máº¥t mÃ u Ä‘Ã£ tÃ´.
  const [colorFillMemory] = useState(createColorFillMemory);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const a of session.answers) {
      // Saved answers come back from the API in the persisted (BE) format â€”
      // e.g. multi_true_false as an array of true-statement ids. Convert
      // back to the Record<statementId,boolean> shape the player expects
      // before it lands in runner state (see deserializeSessionAnswer).
      const q = questions.find((qq) => qq.id === a.question_id);
      initial[a.question_id] = q
        ? deserializeSessionAnswer(q, a.answer)
        : a.answer;
    }
    return initial;
  });
  // Per-question "Ä‘Ã£ kiá»ƒm tra?" â€” remembered across navigation so going back
  // to a checked question still shows its verdict.
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Relay question navigation to the native WebView host (no-op in the browser).
  useEffect(() => {
    postToNative({ type: "progress", current: current + 1, total });
  }, [current, total]);

  // ---------------------------------------------------------------------
  // Game mode chrome â€” combo streak, XP counter, border flash, auto-advance.
  // Entirely additive: none of this state is read or touched when
  // `session.mode !== "game"`.
  // ---------------------------------------------------------------------
  const [combo, setCombo] = useState<ComboState>(INITIAL_COMBO_STATE);
  const [milestone, setMilestone] = useState<3 | 5 | 10 | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [flashResult, setFlashResult] = useState<
    "correct" | "incorrect" | null
  >(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Question ids that have already scored a correct check â€” a retry (correct
  // or incorrect) on one of these must not touch combo/correctCount again.
  // See `shouldScore` in comboLogic.ts for the once-only rule.
  const scoredRef = useRef<Set<string>>(new Set());

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  // Never leave a pending auto-advance timer running past unmount.
  useEffect(() => clearAutoAdvance, [clearAutoAdvance]);

  // ---------------------------------------------------------------------
  // Autosave â€” debounce 10s after the last answer change; flush immediately
  // on unmount and on `beforeunload` so nothing is lost on navigation/close.
  // ---------------------------------------------------------------------
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Báº­t sau khi lÆ°á»£t flush trÆ°á»›c-submit Ä‘Ã£ Ä‘i: phiÃªn sáº¯p/Ä‘Ã£ completed nÃªn má»i
  // flush sau Ä‘Ã³ (debounce Ä‘uÃ´i, cleanup unmount khi chuyá»ƒn sang SessionResult)
  // sáº½ bá»‹ BE 409 vÃ  lÃ m toast "ChÆ°a Ä‘á»“ng bá»™ Ä‘Æ°á»£c..." hiá»‡n oan â€” bá» qua háº¿t.
  // Submit Lá»–I thÃ¬ háº¡ cá» (effect submitError bÃªn dÆ°á»›i) Ä‘á»ƒ autosave cháº¡y láº¡i.
  const submittedRef = useRef(false);

  // Returns the in-flight save promise so callers that need the answers to
  // actually land (e.g. submit) can await it. `keepalive` lets the request
  // survive a page unload (unsupported/unnecessary for the debounced and
  // pre-submit saves, which happen while the page is still alive).
  const flush = useCallback(
    (opts?: { keepalive?: boolean }): Promise<void> => {
      if (submittedRef.current) return Promise.resolve();
      // Convert player-format answers (e.g. multi_true_false's
      // Record<statementId,boolean>) to the persisted (BE) format at the
      // save boundary â€” the player/runner keeps the Record for UI state and
      // client-side "Kiá»ƒm tra" grading; only the wire payload changes shape.
      const list: SessionAnswer[] = Object.entries(answersRef.current).map(
        ([question_id, answer]) => {
          const q = questions.find((qq) => qq.id === question_id);
          return {
            question_id,
            answer: q ? serializeSessionAnswer(q, answer) : answer,
          };
        },
      );
      if (list.length === 0) return Promise.resolve();
      // GAP-066: khÃ´ng nuá»‘t lá»—i Ä‘á»“ng bá»™ â€” bÃ¡o má»™t láº§n (id chung Ä‘á»ƒ sonner gá»™p, khÃ´ng spam
      // má»—i 10s). BÃ i váº«n giá»¯ cá»¥c bá»™; láº§n flush sau hoáº·c lÃºc ná»™p sáº½ thá»­ láº¡i.
      return savePracticeAnswers(session.id, list, opts).catch(() => {
        toast.error(
          "ChÆ°a Ä‘á»“ng bá»™ Ä‘Æ°á»£c bÃ i luyá»‡n táº­p lÃªn mÃ¡y chá»§. Em kiá»ƒm tra káº¿t ná»‘i nhÃ©.",
          { id: "practice-autosave-failed" },
        );
      });
    },
    [session.id, questions],
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
    // Wired once per session (`flush` only changes if session.id changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // ---------------------------------------------------------------------
  // Submit â€” guarded against double-submit (dialog click spam / slow network).
  // ---------------------------------------------------------------------
  const submitLockRef = useRef(false);
  useEffect(() => {
    // A submit error means the mutation settled without navigating away â€”
    // unlock so the student can retry, and re-arm autosave (the pre-submit
    // flush guard must not strand unsaved answers on a failed submit).
    if (submitError) {
      submitLockRef.current = false;
      submittedRef.current = false;
    }
  }, [submitError]);

  const confirmSubmit = useCallback(async () => {
    if (submitLockRef.current || submitting) return;
    submitLockRef.current = true;
    // Submit grades from SAVED answers (no answers payload on the submit
    // call), so the final flush MUST land before we submit â€” otherwise the
    // last-changed answers are silently ungraded. A failed save still falls
    // through to onSubmit(): stranding the student on the runner because the
    // network hiccuped is worse than grading on slightly stale answers.
    await flush();
    submittedRef.current = true;
    onSubmit();
  }, [flush, onSubmit, submitting]);

  // ---------------------------------------------------------------------
  // Countdown (timed mode only) â€” auto-submits once, on expiry.
  // ---------------------------------------------------------------------
  const countdown = useCountdown(
    isTimed ? session.started_at : null,
    session.time_limit_seconds,
    confirmSubmit,
  );

  // ---------------------------------------------------------------------
  // Current question
  // ---------------------------------------------------------------------
  const rawQ = questions[current];
  const question = useMemo(() => mapSessionQuestion(rawQ), [rawQ]);
  const isLast = current === total - 1;
  // Kiá»ƒm tra tá»©c thÃ¬ CHá»ˆ cÃ²n á»Ÿ cháº¿ Ä‘á»™ ChÆ¡i game (combo/XP/auto-advance lÃ  luáº­t
  // chÆ¡i). Luyá»‡n táº­p nay chá»‰ biáº¿t káº¿t quáº£ khi ná»™p; Thi thá»­ vá»‘n Ä‘Ã£ váº­y.
  const canCheck = isGame;
  const checked = canCheck && (checkedMap[rawQ.id] ?? false);
  const grade = checked ? gradeSessionQuestion(rawQ, answers[rawQ.id]) : null;

  function handleAnswerChange(answer: unknown) {
    setAnswers((prev) => ({ ...prev, [rawQ.id]: answer }));
  }

  function handleCheck() {
    setCheckedMap((prev) => ({ ...prev, [rawQ.id]: true }));

    if (!isGame) return;
    const result = gradeSessionQuestion(rawQ, answers[rawQ.id]);
    const isCorrect = result.gradable ? result.isCorrect : false;

    setFlashResult(isCorrect ? "correct" : "incorrect");

    // Retrying an already-scored question (e.g. re-checking after "LÃ m
    // láº¡i") must not inflate the streak/XP or fire a stale milestone toast â€”
    // a question can only ever score once, on its first correct check.
    const decision = shouldScore(scoredRef.current, rawQ.id, isCorrect);
    if (decision.score) {
      const nc = nextCombo(combo, isCorrect);
      setCombo({ streak: nc.streak, best: nc.best });
      setMilestone(nc.milestone);
      if (isCorrect) setCorrectCount((c) => c + 1);
    } else {
      setMilestone(null);
    }
    if (decision.addToScored) {
      scoredRef.current.add(rawQ.id);
    }

    if (isCorrect && !isLast) {
      clearAutoAdvance();
      const target = current + 1;
      autoAdvanceTimerRef.current = setTimeout(() => {
        autoAdvanceTimerRef.current = null;
        goTo(target);
      }, GAME_AUTO_ADVANCE_MS);
    }
  }

  function goTo(index: number) {
    clearAutoAdvance();
    if (isGame) setFlashResult(null);
    setCurrent(Math.max(0, Math.min(total - 1, index)));
  }

  return (
    /* Full-height runner: ná»™i dung cÃ¢u há»i cuá»™n trong vÃ¹ng giá»¯a, thanh Ä‘iá»u
       hÆ°á»›ng cÃ¢u ghim á»Ÿ ÄÃY mÃ n hÃ¬nh (dÆ°á»›i header dÃ­nh 4rem). á»ž mobile trá»« thÃªm
       ~4rem cho thanh Ä‘iá»u hÆ°á»›ng Ä‘Ã¡y cá»§a AppShell (lg áº©n nÃ³). */
    <div className="mx-auto flex h-[calc(100dvh-8rem)] w-full max-w-6xl flex-col lg:h-[calc(100dvh-4rem)]">
      {/* VÃ¹ng cuá»™n: header + tiáº¿n Ä‘á»™ + tháº» cÃ¢u há»i. flex-col Ä‘á»ƒ tháº» cÃ¢u há»i
          giÃ£n láº¥p khoáº£ng trá»‘ng (cÃ¢u ngáº¯n) mÃ  cÃ¢u dÃ i váº«n cuá»™n Ä‘Æ°á»£c. */}
      <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto p-4 md:p-8">
      {/* Header 1 dÃ²ng: breadcrumb + tiÃªu Ä‘á» bÃªn trÃ¡i; Ä‘á»“ng há»“ (thi thá»­) vÃ 
          nÃºt Dá»«ng bÃªn pháº£i. */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase font-bold tracking-wide text-primary">
            {session.subject_name ?? session.subject_code} Â· Lá»›p {session.level} Â·{" "}
            {MODE_LABEL[session.mode]}
          </div>
          <h1 className="font-display text-2xl font-bold truncate">
            {session.topic_label ?? "Luyá»‡n táº­p tá»•ng há»£p"}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isTimed && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black tabular-nums transition-colors",
                countdown.isDanger
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/10 text-primary",
              )}
            >
              <Clock className="size-4" />
              {countdown.label}
            </span>
          )}
          <button
            type="button"
            onClick={() => navigate("/student/practice")}
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
            Dá»«ng
          </button>
        </div>
      </div>

      {/* Progress n/N */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Progress value={((current + 1) / total) * 100} className="flex-1" />
          <span className="text-sm font-bold text-muted-foreground tabular-nums shrink-0">
            {current + 1} / {total}
          </span>
        </div>
        {submitError && (
          <p className="text-xs font-medium text-destructive">{submitError}</p>
        )}
      </div>

      {/* Question */}
      {(() => {
        const diff = DIFFICULTY_META[rawQ.difficulty ?? "medium"];
        // CÃ¹ng bá»™ alias vá»›i Ä‘Æ°á»ng chÃ­nh (adapter/dispatch): type thÃ´ `free_draw`
        // pháº£i gáº¥p vá» `drawing` TRÆ¯á»šC khi tra nhÃ£n, náº¿u khÃ´ng badge rÆ¡i fallback
        // vÃ  hiá»‡n slug thÃ´ cho há»c sinh.
        const canonicalType = canonicalQuestionType(rawQ.question_type);
        const typeLabel = isKnownQuestionType(canonicalType)
          ? QUESTION_TYPE_LABELS[canonicalType]
          : (PRACTICE_QUESTION_TYPE_LABEL_FALLBACK[canonicalType] ??
            canonicalType);
        const questionCard = (
          <div className="flex flex-1 flex-col rounded-2xl border-2 border-border/70 bg-card p-4 md:p-6">
            {/* Badge loáº¡i cÃ¢u Â· Ä‘iá»ƒm Â· Ä‘á»™ khÃ³ */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="rounded-full bg-info/15 text-info px-2.5 py-0.5 text-[11px] font-bold">
                {typeLabel}
              </span>
              <span className="rounded-full bg-warning/15 text-warning px-2.5 py-0.5 text-[11px] font-bold">
                +{(rawQ.points ?? 1).toLocaleString("vi-VN")} Ä‘iá»ƒm
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold",
                  diff.text,
                )}
              >
                <span className={cn("size-2 rounded-full", diff.dot)} />
                {diff.label}
              </span>
            </div>
            <ColorFillMemoryProvider store={colorFillMemory}>
              <QuestionPlayer
                key={rawQ.id}
                question={question}
                index={current}
                answer={answers[rawQ.id]}
                onAnswerChange={handleAnswerChange}
                submitted={checked}
                gradeMode="parent"
                hideResultBanner
                result={
                  checked && grade
                    ? grade.gradable
                      ? grade.isCorrect
                        ? "correct"
                        : "incorrect"
                      : "incomplete"
                    : undefined
                }
              />
            </ColorFillMemoryProvider>

            {/* Controls trong card (mockup 24/7): Kiá»ƒm tra/Ná»™p bÃ i to, náº±m trÃªn
                ná»n tráº¯ng cá»§a cÃ¢u há»i. Äiá»u hÆ°á»›ng báº±ng quick-nav bÃªn dÆ°á»›i; game
                (khÃ´ng cÃ³ quick-nav) giá»¯ riÃªng "CÃ¢u tiáº¿p" Ä‘á»ƒ khÃ´ng káº¹t khi sai. */}
            <div className="mt-auto pt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {canCheck && !checked && (
                  <Button
                    type="button"
                    size="lg"
                    className="btn-pop rounded-full h-12 px-8 text-base gap-2"
                    onClick={handleCheck}
                  >
                    Kiá»ƒm tra
                  </Button>
                )}
                {isGame && !isLast && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => goTo(current + 1)}
                  >
                    CÃ¢u tiáº¿p â†’
                  </Button>
                )}
              </div>

              {/* Ná»™p bÃ i hiá»‡n sau khi Há»ŒC SINH Ä‘Ã£ tá»›i cÃ¢u cuá»‘i má»™t láº§n, rá»“i
                  giá»¯ á»Ÿ má»i cÃ¢u (Ä‘iá»u hÆ°á»›ng qua TrÆ°á»›c/Sau + quick-nav) â€” timed
                  váº«n auto-submit khi háº¿t giá» qua confirmSubmit. */}
              {reachedLast && (
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size="lg"
                      className="btn-pop rounded-full h-12 px-8 text-base gap-2"
                      disabled={submitting}
                    >
                      <Send className="size-4" />
                      Ná»™p bÃ i
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Ná»™p bÃ i</AlertDialogTitle>
                      <AlertDialogDescription>
                        Em cháº¯c cháº¯n muá»‘n ná»™p bÃ i?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={submitting}>Huá»·</AlertDialogCancel>
                      <AlertDialogAction disabled={submitting} onClick={confirmSubmit}>
                        {submitting ? "Äang ná»™p..." : "Ná»™p bÃ i"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        );

        if (!isGame) return questionCard;

        return (
          <GameModeChrome
            combo={combo}
            correctCount={correctCount}
            flashResult={flashResult}
            milestone={milestone}
          >
            {questionCard}
          </GameModeChrome>
        );
      })()}

      </div>

      {/* Thanh Ä‘iá»u hÆ°á»›ng cÃ¢u â€” GHIM á»Ÿ Ä‘Ã¡y mÃ n hÃ¬nh; game giá»¯ tuáº§n tá»± (combo)
          nÃªn khÃ´ng cÃ³. TrÆ°á»›c/Sau náº±m CÃ™NG DÃ’NG vá»›i dÃ£y sá»‘. Giá»¯ ná»n trong suá»‘t
          (ná»n trang cÅ©), KHÃ”NG bg tráº¯ng: footer lÃ  anh em cá»§a vÃ¹ng cuá»™n nÃªn
          ná»™i dung khÃ´ng lá»t xuá»‘ng dÆ°á»›i nÃ³. */}
      {!isGame && total > 1 && (
        <div className="shrink-0 space-y-2 px-4 py-2.5 md:px-8">
          <div className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <Zap className="size-3.5" />
            Nháº£y nhanh tá»›i cÃ¢u khÃ¡c:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {questions.map((q, i) => {
              const isCurrent = i === current;
              const answered = answers[q.id] !== undefined;
              return (
                <button
                  key={q.id}
                  type="button"
                  aria-label={`Tá»›i cÃ¢u ${i + 1}`}
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
            {/* TrÆ°á»›c/Sau cáº¡nh nhau, Ä‘áº©y vá» bÃªn pháº£i dÃ£y sá»‘ (ml-auto). */}
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="TrÆ°á»›c"
                className="h-9 rounded-full gap-1 px-3"
                disabled={current === 0}
                onClick={() => goTo(current - 1)}
              >
                <ChevronLeft className="size-4" />
                TrÆ°á»›c
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Sau"
                className="h-9 rounded-full gap-1 px-3"
                disabled={isLast}
                onClick={() => goTo(current + 1)}
              >
                Sau
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
