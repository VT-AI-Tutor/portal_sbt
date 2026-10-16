import { useState } from "react";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/lib/utils";
import type {
  FillBlankQ,
  ShortAnswerQ,
  EssayQ,
  MathInputQ,
  CodeInputQ,
} from "@/core/lib/types";
import { FeedbackBox, type InteractionProps } from "./shared";
import { Textarea } from "@/core/ui/textarea";
import { Input } from "@/core/ui/input";
import { Sparkles } from "lucide-react";

export function FillBlank({
  question,
  onAnswer,
}: InteractionProps<FillBlankQ>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const correct = question.blanks.every(
    (b) => (values[b.id] ?? "").trim().toLowerCase() === b.answer.toLowerCase(),
  );

  // Render template with inputs
  const parts = question.template.split(/(\{\{\d+\}\})/g);

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <Card className="p-5 leading-relaxed text-base">
        {parts.map((p, i) => {
          const m = p.match(/\{\{(\d+)\}\}/);
          if (m) {
            const id = m[1];
            const blank = question.blanks.find((b) => b.id === id);
            if (!blank) return null;
            const isRight =
              submitted &&
              (values[id] ?? "").trim().toLowerCase() ===
                blank.answer.toLowerCase();
            return (
              <select
                key={i}
                disabled={submitted}
                value={values[id] ?? ""}
                onChange={(e) => setValues({ ...values, [id]: e.target.value })}
                className={cn(
                  "mx-1 inline-block min-w-[180px] rounded-lg border-2 px-3 py-1.5 bg-card",
                  submitted &&
                    (isRight
                      ? "border-success bg-success/10"
                      : "border-destructive bg-destructive/10"),
                  !submitted && "border-primary",
                )}
              >
                <option value="">— chọn —</option>
                {blank.suggestions?.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            );
          }
          return <span key={i}>{p}</span>;
        })}
      </Card>
      {!submitted ? (
        <Button
          disabled={Object.keys(values).length < question.blanks.length}
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct, userAnswer: values });
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

export function ShortAnswer({
  question,
  onAnswer,
}: InteractionProps<ShortAnswerQ>) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const matched =
    question.keywords?.filter((k) =>
      text.toLowerCase().includes(k.toLowerCase()),
    ) ?? [];
  const score = matched.length / Math.max(1, question.keywords?.length ?? 1);
  const correct = score >= 0.5;

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitted}
        placeholder="Nhập câu trả lời của em..."
        className="min-h-32 rounded-2xl border-2 text-base p-4"
      />
      {!submitted ? (
        <Button
          disabled={text.trim().length < 5}
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({
              correct,
              partial: !correct && score > 0,
              userAnswer: text,
            });
          }}
        >
          Nộp bài
        </Button>
      ) : (
        <Card className="p-4 mt-4 border-2 border-info bg-info/10 animate-pop-in">
          <div className="flex items-start gap-3">
            <Sparkles className="text-info shrink-0 mt-1" />
            <div>
              <div className="font-display font-bold text-info">
                AI chấm bài
              </div>
              <div className="mt-1">
                Điểm: <strong>{Math.round(score * 100)}/100</strong> · Từ khoá
                đúng: {matched.length}/{question.keywords?.length}
              </div>
              <div className="mt-2 text-sm">
                <strong>Đáp án mẫu:</strong> {question.sampleAnswer}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export function Essay({ question, onAnswer }: InteractionProps<EssayQ>) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const meets = wordCount >= (question.minWords ?? 30);

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="text-xs text-muted-foreground mb-2">
        Yêu cầu tối thiểu: {question.minWords} từ · Hiện tại:{" "}
        <strong>{wordCount} từ</strong>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitted}
        placeholder="Viết bài văn của em..."
        className="min-h-48 rounded-2xl border-2 text-base p-4"
      />
      {!submitted ? (
        <Button
          disabled={!meets}
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct: true, userAnswer: text });
          }}
        >
          Nộp bài cho AI chấm
        </Button>
      ) : (
        <Card className="p-5 mt-4 border-2 border-fun bg-fun/10 animate-pop-in">
          <div className="font-display font-bold text-fun text-lg flex gap-2 items-center">
            <Sparkles /> AI đánh giá theo rubric
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {question.rubric.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="size-6 rounded-full bg-success text-success-foreground flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                {r} — <span className="text-muted-foreground">Đạt</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 font-bold">
            Điểm tổng: 8.5/10 — Bài viết tốt!
          </div>
        </Card>
      )}
    </div>
  );
}

export function MathInput({
  question,
  onAnswer,
}: InteractionProps<MathInputQ>) {
  const [val, setVal] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const num = parseFloat(val.replace(",", "."));
  const correct = !isNaN(num) && Math.abs(num - question.answer) < 0.01;

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="flex items-center gap-3">
        <Input
          type="text"
          inputMode="decimal"
          value={val}
          disabled={submitted}
          onChange={(e) => setVal(e.target.value)}
          className="h-14 text-2xl text-center font-display rounded-2xl border-2 border-primary max-w-[200px]"
          placeholder="?"
        />
        {question.unit && (
          <span className="text-2xl font-display">{question.unit}</span>
        )}
      </div>
      {!submitted ? (
        <Button
          disabled={!val}
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct, userAnswer: num });
          }}
        >
          Kiểm tra
        </Button>
      ) : (
        <FeedbackBox
          status={correct ? "correct" : "incorrect"}
          explanation={`Đáp án đúng: ${question.answer} ${question.unit ?? ""}`}
        />
      )}
    </div>
  );
}

export function CodeInput({
  question,
  onAnswer,
}: InteractionProps<CodeInputQ>) {
  const [code, setCode] = useState(question.starter);
  const [submitted, setSubmitted] = useState(false);
  const correct = code.trim().includes(question.expected.trim());

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="rounded-2xl overflow-hidden border-2 border-primary">
        <div className="bg-primary text-primary-foreground px-4 py-2 text-xs font-mono flex justify-between">
          <span>{question.language}</span>
          <span>main.{question.language === "python" ? "py" : "js"}</span>
        </div>
        <Textarea
          value={code}
          disabled={submitted}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono min-h-32 rounded-none border-0 focus-visible:ring-0 bg-muted/30"
        />
      </div>
      {!submitted ? (
        <Button
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct, userAnswer: code });
          }}
        >
          ▶ Chạy & Kiểm tra
        </Button>
      ) : (
        <FeedbackBox
          status={correct ? "correct" : "incorrect"}
          explanation={`Đáp án mong đợi:\n${question.expected}`}
        />
      )}
    </div>
  );
}
