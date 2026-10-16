import { useState } from "react";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/lib/utils";
import type {
  StepHintQ,
  ExplanationQ,
  PeerCompareQ,
  AdaptiveQ,
} from "@/core/lib/types";
import { type InteractionProps, FeedbackBox } from "./shared";
import { Lightbulb, Eye, Users, Brain, ChevronRight } from "lucide-react";
import { SingleChoice } from "./basic-choice";

export function StepHint({ question, onAnswer }: InteractionProps<StepHintQ>) {
  const [revealed, setRevealed] = useState(0);
  const [showFinal, setShowFinal] = useState(false);

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.question}</p>
      <div className="space-y-3">
        {question.steps.map((s, i) => {
          const isOpen = i < revealed;
          return (
            <Card
              key={i}
              className={cn(
                "p-4 border-2 transition-all",
                isOpen
                  ? "border-info bg-info/5 animate-pop-in"
                  : "border-dashed border-muted",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-full bg-info text-info-foreground flex items-center justify-center font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{s.hint}</div>
                  {isOpen && (
                    <div className="mt-2 rounded-lg bg-card border p-3 text-sm flex items-start gap-2">
                      <Eye className="size-4 mt-0.5 shrink-0" />
                      <div>{s.reveal}</div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {revealed < question.steps.length ? (
        <Button
          onClick={() => setRevealed(revealed + 1)}
          variant="outline"
          className="mt-4 rounded-full"
        >
          <Lightbulb className="size-4 mr-1" /> Mở gợi ý {revealed + 1}
        </Button>
      ) : !showFinal ? (
        <Button
          onClick={() => setShowFinal(true)}
          className="btn-pop mt-4 rounded-full px-8 h-12"
        >
          Xem đáp án cuối cùng
        </Button>
      ) : (
        <Card className="mt-4 p-5 border-2 border-success bg-success/10 animate-pop-in">
          <div className="font-display font-bold text-success mb-2">
            🎯 Đáp án
          </div>
          <div>{question.finalAnswer}</div>
          <Button
            onClick={() => onAnswer({ correct: true })}
            className="btn-pop mt-3 rounded-full"
          >
            Đã hiểu ✓
          </Button>
        </Card>
      )}
    </div>
  );
}

export function Explanation({
  question,
  onAnswer,
}: InteractionProps<ExplanationQ>) {
  const [picked, setPicked] = useState<string | null>(null);
  const submitted = picked !== null;
  const correct = picked === question.correct;

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.question}</p>
      <div className="grid gap-2 mb-4">
        {question.options.map((opt) => {
          const isPicked = picked === opt.id;
          const showCorrect = submitted && opt.id === question.correct;
          return (
            <button
              key={opt.id}
              disabled={submitted}
              onClick={() => setPicked(opt.id)}
              className={cn(
                "rounded-2xl border-2 p-3 text-left",
                showCorrect && "border-success bg-success/15",
                submitted &&
                  isPicked &&
                  !showCorrect &&
                  "border-destructive bg-destructive/15",
                !submitted && "border-border bg-card hover:border-primary",
              )}
            >
              <strong className="mr-2">{opt.id}.</strong>
              {opt.text}
            </button>
          );
        })}
      </div>
      {submitted && (
        <>
          <Card className="p-5 border-2 border-info bg-info/10 animate-pop-in">
            <div className="font-display font-bold text-info mb-2 flex items-center gap-2">
              <Brain /> Giải thích chi tiết
            </div>
            <div className="text-sm leading-relaxed">
              {question.detailedExplanation}
            </div>
          </Card>
          <Button
            onClick={() => onAnswer({ correct, userAnswer: picked })}
            className="btn-pop mt-4 rounded-full"
          >
            Tiếp →
          </Button>
        </>
      )}
    </div>
  );
}

export function PeerCompare({
  question,
  onAnswer,
}: InteractionProps<PeerCompareQ>) {
  const [picked, setPicked] = useState<string | null>(null);
  const submitted = picked !== null;
  const correct = picked === question.correct;
  const total = Object.values(question.peerStats).reduce((a, b) => a + b, 0);

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="grid gap-2 mb-4">
        {question.options.map((opt) => {
          const isPicked = picked === opt.id;
          const showCorrect = submitted && opt.id === question.correct;
          const pct = Math.round((question.peerStats[opt.id] / total) * 100);
          return (
            <button
              key={opt.id}
              disabled={submitted}
              onClick={() => setPicked(opt.id)}
              className={cn(
                "relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all",
                showCorrect && "border-success bg-success/15",
                submitted &&
                  isPicked &&
                  !showCorrect &&
                  "border-destructive bg-destructive/15",
                !submitted && "border-border bg-card hover:border-primary",
              )}
            >
              {submitted && (
                <div
                  className="absolute inset-y-0 left-0 bg-info/20"
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span>
                  <strong className="mr-2">{opt.id}.</strong>
                  {opt.text}
                </span>
                {submitted && (
                  <span className="text-sm font-mono font-bold">{pct}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {submitted && (
        <Card className="p-4 border-2 border-info bg-info/10">
          <div className="font-display font-bold text-info flex items-center gap-2">
            <Users /> So sánh với bạn cùng lớp
          </div>
          <div className="text-sm mt-1">
            {correct
              ? `Em đã chọn đúng! ${Math.round((question.peerStats[question.correct] / total) * 100)}% bạn cũng chọn đúng câu này.`
              : `${Math.round((question.peerStats[question.correct] / total) * 100)}% bạn chọn đúng đáp án ${question.correct}.`}
          </div>
        </Card>
      )}
      {submitted && (
        <Button
          onClick={() => onAnswer({ correct, userAnswer: picked })}
          className="btn-pop mt-4 rounded-full"
        >
          Tiếp →
        </Button>
      )}
    </div>
  );
}

export function Adaptive({ question, onAnswer }: InteractionProps<AdaptiveQ>) {
  const [level, setLevel] = useState<"easy" | "medium" | "hard">("medium");
  const [history, setHistory] = useState<{ level: string; correct: boolean }[]>(
    [],
  );
  const [count, setCount] = useState(0);
  const MAX = 3;

  const current = question.pool.find((p) => p.difficulty === level)!;

  const handleSub = (res: { correct: boolean }) => {
    const newHistory = [...history, { level, correct: res.correct }];
    setHistory(newHistory);
    if (count + 1 >= MAX) {
      onAnswer({ correct: newHistory.filter((h) => h.correct).length >= 2 });
      return;
    }
    // Adapt next level
    if (res.correct && level !== "hard")
      setLevel(level === "easy" ? "medium" : "hard");
    else if (!res.correct && level !== "easy")
      setLevel(level === "hard" ? "medium" : "easy");
    setCount(count + 1);
  };

  return (
    <div>
      <Card className="p-3 mb-4 border-2 border-fun bg-fun/10 flex items-center gap-3">
        <Brain className="text-fun" />
        <div className="flex-1">
          <div className="text-xs uppercase font-bold text-fun">
            Adaptive AI
          </div>
          <div className="text-sm">
            Độ khó hiện tại:{" "}
            <strong>
              {level === "easy"
                ? "Dễ 🟢"
                : level === "medium"
                  ? "Vừa 🟡"
                  : "Khó 🔴"}
            </strong>{" "}
            · Câu {count + 1}/{MAX}
          </div>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: MAX }).map((_, i) => (
            <ChevronRight
              key={i}
              className={cn(
                "size-4",
                i < count ? "text-fun" : "text-muted-foreground/30",
              )}
            />
          ))}
        </div>
      </Card>
      <SingleChoice key={count} question={current.q} onAnswer={handleSub} />
    </div>
  );
}
