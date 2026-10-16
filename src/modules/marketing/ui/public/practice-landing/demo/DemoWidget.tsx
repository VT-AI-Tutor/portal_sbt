import { useEffect, useMemo, useRef, useState } from "react";
import {
  advance,
  buildResultRows,
  createDemoState,
  gradeChoice,
  gradeSort,
  type DemoQuestion,
  type DemoState,
} from "./demoEngine";
import type { DemoSet } from "./demoSets";
import {
  createPlacement,
  isComplete,
  placeItem,
  toGradeArray,
  type Placement,
} from "./sortPlacement";

const FEEDBACK_MS = 1300;

interface DemoWidgetProps {
  set: DemoSet;
  onDemoStart?: () => void;
  onDemoComplete?: (correctCount: number) => void;
  onTrialClick: () => void;
  onRegisterClick: () => void;
}

type Feedback = { correct: boolean; text: string } | null;

export function DemoWidget({
  set,
  onDemoStart,
  onDemoComplete,
  onTrialClick,
  onRegisterClick,
}: DemoWidgetProps) {
  const [state, setState] = useState<DemoState>(createDemoState);
  const [placement, setPlacement] = useState<Placement>([]);
  const [pickedItem, setPickedItem] = useState<number | null>(null); // tap-để-đặt
  const [chosen, setChosen] = useState<number | null>(null); // trắc nghiệm đã chọn
  const [feedback, setFeedback] = useState<Feedback>(null);
  const startedRef = useRef(false);
  // onDemoComplete bắn đúng 1 lần mỗi lượt chơi (mẫu firedRef ở useCountdown —
  // StrictMode double-invoke không được phép gọi callback 2 lần).
  const completedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const total = set.questions.length;
  const question: DemoQuestion | undefined = set.questions[state.index];

  const resultRows = useMemo(
    () => buildResultRows(state.outcomes),
    [state.outcomes],
  );

  // Đổi bộ đề (Lớp/Môn) giữa chừng → reset sạch lượt chơi; cleanup dọn
  // timeout đang chờ cả khi đổi set lẫn khi unmount.
  useEffect(() => {
    setState(createDemoState());
    setChosen(null);
    setPlacement([]);
    setPickedItem(null);
    setFeedback(null);
    startedRef.current = false;
    completedRef.current = false;
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [set]);

  function markStarted() {
    if (!startedRef.current) {
      startedRef.current = true;
      onDemoStart?.();
    }
  }

  function settle(correct: boolean, correctText: string) {
    if (!question) return;
    setFeedback({
      correct,
      text: correct
        ? "🎉 Chính xác! +10 XP"
        : `😅 Chưa đúng — đáp án là ${correctText}`,
    });
    // advance() thuần → tính `next` NGOÀI updater; side effect (onDemoComplete)
    // nằm ngoài setState nên StrictMode double-invoke không nhân đôi nó.
    const next = advance(state, question, correct, total);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setState(next);
      setChosen(null);
      setPlacement([]);
      setPickedItem(null);
      setFeedback(null);
      if (next.finished && !completedRef.current) {
        completedRef.current = true;
        onDemoComplete?.(next.outcomes.filter((o) => o.correct).length);
      }
    }, FEEDBACK_MS);
  }

  function answerChoice(k: number) {
    if (!question || question.kind !== "choice" || feedback || chosen !== null)
      return;
    markStarted();
    setChosen(k);
    settle(gradeChoice(question, k), question.options[question.correctIndex]);
  }

  function dropOnGroup(itemIndex: number, group: 0 | 1) {
    if (!question || question.kind !== "sort" || feedback) return;
    markStarted();
    const base = placement.length
      ? placement
      : createPlacement(question.items.length);
    const next = placeItem(base, itemIndex, group);
    setPlacement(next);
    setPickedItem(null);
    if (isComplete(next)) {
      const answerKey = question.items
        .map((it) => `${it.text} → ${question.groups[it.group]}`)
        .join(", ");
      settle(gradeSort(question, toGradeArray(next)), answerKey);
    }
  }

  function restart() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    completedRef.current = false;
    setState(createDemoState());
    setChosen(null);
    setPlacement([]);
    setPickedItem(null);
    setFeedback(null);
  }

  if (!question) {
    return (
      <div
        className="relative rotate-2 rounded-2xl border-2 border-border bg-card p-5 shadow-card"
        data-testid="demo-result"
      >
        <p className="font-display text-lg font-bold text-foreground mb-4">
          Bản đồ năng lực mini của em 🗺️
        </p>
        {resultRows.map((r) => (
          <div
            key={r.skill}
            className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0 text-sm"
          >
            <span className="font-medium text-foreground/80">{r.skill}</span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-24 rounded-full bg-muted overflow-hidden align-middle">
                <i
                  style={{ width: `${r.percent}%` }}
                  data-ok={r.percent >= 90}
                  className={`block h-full rounded-full ${
                    r.percent >= 90 ? "bg-success" : "bg-warning"
                  }`}
                />
              </span>
              <span className="font-bold text-foreground">{r.label}</span>
            </span>
          </div>
        ))}
        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-soft transition hover:opacity-90 cursor-pointer"
            onClick={onTrialClick}
          >
            Luyện thử 10 câu
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border-2 border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary cursor-pointer"
            onClick={onRegisterClick}
          >
            Tạo tài khoản
          </button>
        </div>
        <button
          type="button"
          className="mt-3 w-full text-center text-xs font-bold text-muted-foreground hover:text-primary transition cursor-pointer"
          onClick={restart}
        >
          Chơi lại
        </button>
      </div>
    );
  }

  const currentPlacement = placement.length
    ? placement
    : createPlacement(question.kind === "sort" ? question.items.length : 0);

  return (
    <div className="relative rotate-2 rounded-2xl border-2 border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <span className="rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
          Câu {state.index + 1} / {total}
        </span>
        <span className="text-xs font-bold text-muted-foreground">
          {question.kind === "sort" ? "🧩 Kéo thả" : "✏️ Trắc nghiệm"}
        </span>
      </div>
      <p className="font-display text-lg font-bold text-foreground mt-2 mb-4">
        {question.prompt}
      </p>

      {question.kind === "choice" &&
        question.options.map((opt, k) => {
          const optionState =
            feedback && k === question.correctIndex
              ? "right"
              : feedback && k === chosen
                ? "wrong"
                : undefined;
          return (
            <button
              key={opt}
              type="button"
              className={`w-full text-left rounded-xl border-2 px-4 py-3 mb-2 text-sm font-semibold transition cursor-pointer ${
                optionState === "right"
                  ? "border-success bg-success/10 text-foreground"
                  : optionState === "wrong"
                    ? "border-destructive bg-destructive/10 text-foreground"
                    : "border-border bg-card text-foreground hover:border-primary"
              }`}
              data-state={optionState}
              onClick={() => answerChoice(k)}
            >
              {opt}
            </button>
          );
        })}

      {question.kind === "sort" && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {question.items.map(
              (it, i) =>
                currentPlacement[i] === null && (
                  <button
                    key={it.text}
                    type="button"
                    className={`cursor-grab select-none rounded-full border-2 px-3 py-1.5 text-sm font-bold text-foreground transition active:cursor-grabbing ${
                      pickedItem === i
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary"
                    }`}
                    data-picked={pickedItem === i || undefined}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", String(i))
                    }
                    onClick={() => setPickedItem(i)}
                  >
                    {it.text}
                  </button>
                ),
            )}
          </div>
          {question.groups.map((g, gi) => (
            <div
              key={g}
              className="min-h-16 rounded-xl border-2 border-dashed border-border bg-muted/40 px-3 py-2 mb-2 flex items-center justify-between gap-2 text-sm"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                dropOnGroup(
                  Number(e.dataTransfer.getData("text/plain")),
                  gi as 0 | 1,
                );
              }}
              onClick={() => {
                if (pickedItem !== null) dropOnGroup(pickedItem, gi as 0 | 1);
              }}
            >
              <span className="font-bold text-foreground">{g}</span>
              <span className="text-muted-foreground">
                {question.items
                  .map((it, i) => (currentPlacement[i] === gi ? it.text : null))
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-1">
            Kéo thẻ vào nhóm — hoặc chạm thẻ rồi chạm nhóm.
          </p>
        </>
      )}

      <div
        className={`mt-4 min-h-6 text-sm font-bold ${
          feedback
            ? feedback.correct
              ? "text-success"
              : "text-destructive"
            : ""
        }`}
        data-tone={feedback ? (feedback.correct ? "ok" : "bad") : undefined}
      >
        {feedback?.text ?? " "}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60 text-xs font-bold text-muted-foreground">
        <span>⭐ {state.xp} XP</span>
        <span>🦊 Cozzy đang cổ vũ…</span>
      </div>
    </div>
  );
}
