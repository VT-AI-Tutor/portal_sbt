import { useState } from "react";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { SingleChoiceQ, MultipleChoiceQ, TrueFalseQ } from "@/core/lib/types";
import { FeedbackBox, HintButton, type InteractionProps } from "./shared";

export function SingleChoice({
  question,
  onAnswer,
}: InteractionProps<SingleChoiceQ>) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const correct = selected === question.correct;

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="grid gap-3">
        {question.options.map((opt) => {
          const isSelected = selected === opt.id;
          const showCorrect = submitted && opt.id === question.correct;
          const showWrong = submitted && isSelected && !correct;
          return (
            <button
              key={opt.id}
              disabled={submitted}
              onClick={() => setSelected(opt.id)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all",
                "hover:border-primary hover:bg-primary/5",
                isSelected && !submitted && "border-primary bg-primary/10",
                showCorrect && "border-success bg-success/15 animate-pop-in",
                showWrong &&
                  "border-destructive bg-destructive/15 animate-shake",
                !isSelected && !showCorrect && "border-border bg-card",
              )}
            >
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2 font-bold",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                  showCorrect &&
                    "border-success bg-success text-success-foreground",
                )}
              >
                {opt.id}
              </div>
              <span className="flex-1">{opt.text}</span>
              {showCorrect && <Check className="size-5 text-success" />}
            </button>
          );
        })}
      </div>
      <HintButton hint={question.hint} />
      {!submitted ? (
        <Button
          disabled={!selected}
          className="btn-pop mt-5 rounded-full px-8 h-12 text-base"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct, userAnswer: selected });
          }}
        >
          Kiểm tra
        </Button>
      ) : (
        <FeedbackBox
          status={correct ? "correct" : "incorrect"}
          explanation={question.explanation}
        />
      )}
    </div>
  );
}

export function MultipleChoice({
  question,
  onAnswer,
}: InteractionProps<MultipleChoiceQ>) {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const correct =
    selected.length === question.correct.length &&
    selected.every((s) => question.correct.includes(s));

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="grid gap-3">
        {question.options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const isCorrectAns = question.correct.includes(opt.id);
          const showCorrect = submitted && isCorrectAns;
          const showWrong = submitted && isSelected && !isCorrectAns;
          return (
            <button
              key={opt.id}
              disabled={submitted}
              onClick={() => toggle(opt.id)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all",
                "hover:border-primary hover:bg-primary/5",
                isSelected && !submitted && "border-primary bg-primary/10",
                showCorrect && "border-success bg-success/15",
                showWrong &&
                  "border-destructive bg-destructive/15 animate-shake",
              )}
            >
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border-2",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                  showCorrect &&
                    "border-success bg-success text-success-foreground",
                )}
              >
                {isSelected && <Check className="size-4" />}
              </div>
              <span className="flex-1">{opt.text}</span>
            </button>
          );
        })}
      </div>
      {!submitted ? (
        <Button
          disabled={selected.length === 0}
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct, userAnswer: selected });
          }}
        >
          Kiểm tra
        </Button>
      ) : (
        <FeedbackBox
          status={correct ? "correct" : "incorrect"}
          explanation={question.explanation}
        />
      )}
    </div>
  );
}

export function TrueFalse({
  question,
  onAnswer,
}: InteractionProps<TrueFalseQ>) {
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const allAnswered = question.statements.every(
    (s) => answers[s.id] !== undefined && answers[s.id] !== null,
  );
  const correct =
    allAnswered && question.statements.every((s) => answers[s.id] === s.answer);

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="space-y-3">
        {question.statements.map((s, i) => {
          const userAns = answers[s.id];
          const isRight = submitted && userAns === s.answer;
          const isWrong =
            submitted && userAns !== undefined && userAns !== s.answer;
          return (
            <Card
              key={s.id}
              className={cn(
                "p-4 flex items-center gap-4 border-2",
                isRight && "border-success bg-success/10",
                isWrong && "border-destructive bg-destructive/10",
              )}
            >
              <div className="font-display font-bold text-primary text-xl w-8">
                {i + 1}.
              </div>
              <div className="flex-1">{s.text}</div>
              <div className="flex gap-2">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    disabled={submitted}
                    onClick={() => setAnswers({ ...answers, [s.id]: val })}
                    className={cn(
                      "size-12 rounded-xl border-2 font-display font-bold text-lg transition-all",
                      userAns === val
                        ? val
                          ? "border-success bg-success text-success-foreground"
                          : "border-destructive bg-destructive text-destructive-foreground"
                        : "border-border bg-card hover:border-primary",
                    )}
                  >
                    {val ? "Đ" : "S"}
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      {!submitted ? (
        <Button
          disabled={!allAnswered}
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct, userAnswer: answers });
          }}
        >
          Kiểm tra
        </Button>
      ) : (
        <FeedbackBox
          status={correct ? "correct" : "incorrect"}
          explanation={question.explanation}
        />
      )}
    </div>
  );
}
