import { useState, useEffect } from "react";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/lib/utils";
import type {
  KahootQ,
  SpeedQ,
  FlashcardQ,
  LeaderboardQ,
  LevelQ,
  PuzzleQ,
  StoryQ,
} from "@/core/lib/types";
import { FeedbackBox, type InteractionProps } from "./shared";
import { Trophy, Zap, Crown, Star, RotateCw } from "lucide-react";

const KAHOOT_COLORS = {
  red: "bg-destructive text-destructive-foreground",
  blue: "bg-info text-info-foreground",
  yellow: "bg-warning text-warning",
  green: "bg-success text-success-foreground",
};
const KAHOOT_SHAPES = { red: "â–²", blue: "â—†", yellow: "â—", green: "â– " };

export function Kahoot({ question, onAnswer }: InteractionProps<KahootQ>) {
  const [time, setTime] = useState(question.timeLimit);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (picked) return;
    if (time <= 0) {
      setPicked("__TIMEOUT__");
      return;
    }
    const t = setTimeout(() => setTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [time, picked]);

  const submitted = picked !== null;
  const correct = picked === question.correct;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-lg font-medium flex-1">{question.prompt}</p>
        <div
          className={cn(
            "size-16 rounded-full bg-fun text-fun-foreground flex items-center justify-center font-display text-2xl font-bold shrink-0",
            time <= 5 && "animate-pulse bg-destructive",
          )}
        >
          {time}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {question.options.map((opt) => {
          const isPicked = picked === opt.id;
          const showCorrect = submitted && opt.id === question.correct;
          const showWrong = submitted && isPicked && !correct;
          return (
            <button
              key={opt.id}
              disabled={submitted}
              onClick={() => setPicked(opt.id)}
              className={cn(
                "rounded-2xl p-6 text-left font-display font-bold text-lg transition-all border-4",
                KAHOOT_COLORS[opt.color],
                "border-transparent hover:scale-[1.02]",
                showCorrect && "ring-8 ring-card scale-105 animate-pop-in",
                showWrong && "opacity-50 animate-shake",
                submitted && !showCorrect && !showWrong && "opacity-60",
              )}
            >
              <div className="text-3xl mb-2">{KAHOOT_SHAPES[opt.color]}</div>
              {opt.text}
            </button>
          );
        })}
      </div>
      {submitted &&
        (picked === "__TIMEOUT__" ? (
          <FeedbackBox
            status="incorrect"
            explanation="Háº¿t giá»! ÄÃ¡p Ã¡n Ä‘Ãºng lÃ  "
          />
        ) : (
          <FeedbackBox
            status={correct ? "correct" : "incorrect"}
            explanation={question.explanation}
            onNext={() => onAnswer({ correct, userAnswer: picked })}
          />
        ))}
    </div>
  );
}

export function Speed({ question, onAnswer }: InteractionProps<SpeedQ>) {
  const [time, setTime] = useState(question.timeLimit);
  const [picked, setPicked] = useState<string | null>(null);
  const [start] = useState(Date.now());

  useEffect(() => {
    if (picked) return;
    if (time <= 0) {
      setPicked("__TIMEOUT__");
      return;
    }
    const t = setTimeout(() => setTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [time, picked]);

  const submitted = picked !== null;
  const correct = picked === question.correct;
  const timeUsed = ((Date.now() - start) / 1000).toFixed(1);
  const speedBonus = correct
    ? Math.max(0, Math.round(question.timeLimit - parseFloat(timeUsed)) * 5)
    : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Zap className="text-fun size-8 animate-pulse" />
        <p className="text-lg font-bold flex-1">âš¡ {question.prompt}</p>
        <div className="font-display text-4xl text-fun font-bold">{time}s</div>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden mb-4">
        <div
          className="h-full bg-fun transition-all"
          style={{ width: `${(time / question.timeLimit) * 100}%` }}
        />
      </div>
      <div className="space-y-2">
        {question.options.map((opt) => {
          const isPicked = picked === opt.id;
          const showCorrect = submitted && opt.id === question.correct;
          const showWrong = submitted && isPicked && !correct;
          return (
            <button
              key={opt.id}
              disabled={submitted}
              onClick={() => setPicked(opt.id)}
              className={cn(
                "w-full text-left rounded-2xl border-2 p-4 transition-all hover:scale-[1.01]",
                showCorrect && "border-success bg-success/15",
                showWrong && "border-destructive bg-destructive/15",
                !submitted && "border-border bg-card hover:border-fun",
              )}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
      {submitted && (
        <Card className="mt-4 p-4 border-2 border-fun bg-fun/10 animate-pop-in">
          <div className="font-display font-bold text-fun text-xl">
            {correct
              ? `ðŸš€ ÄÃºng! +${question.points} +${speedBonus} (tá»‘c Ä‘á»™)`
              : "ðŸ’¥ Sai rá»“i!"}
          </div>
          <div className="text-sm">Thá»i gian: {timeUsed}s</div>
          <Button
            onClick={() => onAnswer({ correct, userAnswer: picked })}
            className="btn-pop mt-3"
          >
            Tiáº¿p â†’
          </Button>
        </Card>
      )}
    </div>
  );
}

export function Flashcard({
  question,
  onAnswer,
}: InteractionProps<FlashcardQ>) {
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(false);

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div
        className="mx-auto max-w-md aspect-[4/3] cursor-pointer"
        style={{ perspective: 1000 }}
        onClick={() => {
          setFlipped(!flipped);
          setSeen(true);
        }}
      >
        <div
          className="relative w-full h-full transition-transform duration-700"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0)",
          }}
        >
          <Card
            className="absolute inset-0 flex items-center justify-center p-8 text-center font-display text-2xl font-bold border-4 border-primary bg-gradient-to-br from-primary/10 to-accent/30"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2">
                Máº·t trÆ°á»›c
              </div>
              {question.front}
              <div className="text-xs text-muted-foreground mt-4 italic">
                Nháº¥n Ä‘á»ƒ láº­t
              </div>
            </div>
          </Card>
          <Card
            className="absolute inset-0 flex items-center justify-center p-6 text-center border-4 border-fun bg-gradient-to-br from-fun/10 to-secondary"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2">
                ÄÃ¡p Ã¡n
              </div>
              <div className="text-base">{question.back}</div>
            </div>
          </Card>
        </div>
      </div>
      <div className="text-center mt-5">
        <Button
          disabled={!seen}
          className="btn-pop rounded-full px-8 h-12"
          onClick={() => onAnswer({ correct: true })}
        >
          ÄÃ£ thuá»™c âœ“
        </Button>
      </div>
    </div>
  );
}

export function LeaderboardChallenge({
  question,
  onAnswer,
}: InteractionProps<LeaderboardQ>) {
  const [picked, setPicked] = useState<string | null>(null);
  const submitted = picked !== null;
  const correct = picked === question.correct;
  const leaders = [
    { name: "Minh Anh 4A", score: 980, you: false },
    { name: "Báº¡n (em)", score: correct ? 950 : 800, you: true },
    { name: "Nam 4B", score: 920, you: false },
    { name: "HÃ  4C", score: 870, you: false },
    { name: "An 4A", score: 800, you: false },
  ].sort((a, b) => b.score - a.score);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="text-warning" />
        <p className="text-lg font-medium flex-1">{question.prompt}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {question.options.map((opt) => {
            const isPicked = picked === opt.id;
            const showCorrect = submitted && opt.id === question.correct;
            return (
              <button
                key={opt.id}
                disabled={submitted}
                onClick={() => setPicked(opt.id)}
                className={cn(
                  "w-full text-left rounded-2xl border-2 p-4",
                  showCorrect && "border-success bg-success/15",
                  submitted &&
                    isPicked &&
                    !showCorrect &&
                    "border-destructive bg-destructive/15",
                  !submitted && "border-border bg-card hover:border-warning",
                )}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
        <Card className="p-4 border-2 border-warning bg-warning/5">
          <div className="font-display font-bold text-warning mb-2 flex items-center gap-2">
            <Crown /> Báº£ng xáº¿p háº¡ng lá»›p
          </div>
          {leaders.map((l, i) => (
            <div
              key={l.name}
              className={cn(
                "flex items-center gap-3 py-2 px-3 rounded-lg",
                l.you && "bg-primary/10 border border-primary",
              )}
            >
              <div
                className={cn(
                  "size-8 rounded-full flex items-center justify-center font-bold",
                  i === 0
                    ? "bg-warning text-warning"
                    : i === 1
                      ? "bg-secondary"
                      : i === 2
                        ? "bg-accent"
                        : "bg-muted",
                )}
              >
                {i + 1}
              </div>
              <div className="flex-1 text-sm font-medium">{l.name}</div>
              <div className="font-mono font-bold">{l.score}</div>
            </div>
          ))}
        </Card>
      </div>
      {submitted && (
        <Button
          onClick={() => onAnswer({ correct, userAnswer: picked })}
          className="btn-pop mt-4 rounded-full px-8 h-12"
        >
          Tiáº¿p â†’
        </Button>
      )}
    </div>
  );
}

export function LevelProgression({
  question,
  onAnswer,
}: InteractionProps<LevelQ>) {
  const [current, setCurrent] = useState(0);

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="flex items-center justify-between mb-6">
        {question.levels.map((lv, i) => (
          <div key={i} className="flex items-center flex-1">
            <div
              className={cn(
                "size-12 rounded-full border-4 flex items-center justify-center font-display font-bold",
                i < current &&
                  "bg-success text-success-foreground border-success",
                i === current &&
                  "bg-primary text-primary-foreground border-primary animate-pulse",
                i > current && "bg-card border-border text-muted-foreground",
              )}
            >
              {i < current ? "âœ“" : i + 1}
            </div>
            {i < question.levels.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-1 mx-2",
                  i < current ? "bg-success" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>
      <Card className="p-6 text-center border-4 border-primary bg-gradient-to-br from-accent/30 to-primary/10">
        <Star className="text-warning mx-auto mb-2" size={48} />
        <div className="font-display font-bold text-2xl">
          {question.levels[current]?.name}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          HoÃ n thÃ nh mÃ n nÃ y Ä‘á»ƒ má»Ÿ khoÃ¡ tiáº¿p theo!
        </div>
        <Button
          className="btn-pop mt-4 rounded-full px-8 h-12"
          onClick={() => {
            if (current < question.levels.length - 1) setCurrent(current + 1);
            else onAnswer({ correct: true });
          }}
        >
          {current < question.levels.length - 1
            ? `HoÃ n thÃ nh mÃ n ${current + 1}`
            : "HoÃ n thÃ nh táº¥t cáº£ ðŸ†"}
        </Button>
      </Card>
    </div>
  );
}

export function Puzzle({ question, onAnswer }: InteractionProps<PuzzleQ>) {
  const [solved, setSolved] = useState<number[]>([]);
  const total = question.pieces;
  const cols = Math.ceil(Math.sqrt(total));

  const reveal = (i: number) => {
    if (!solved.includes(i)) setSolved([...solved, i]);
  };

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="text-sm text-muted-foreground mb-3">
        Tráº£ lá»i Ä‘Ãºng Ä‘á»ƒ má»Ÿ dáº§n cÃ¡c máº£nh ghÃ©p ({solved.length}/{total})
      </div>
      <div className="relative max-w-md mx-auto aspect-[3/2] rounded-2xl overflow-hidden border-2 border-primary">
        <img
          src={question.imageUrl}
          className="absolute inset-0 w-full h-full object-cover"
          alt="puzzle"
        />
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => reveal(i)}
              className={cn(
                "border border-card transition-all",
                solved.includes(i)
                  ? "bg-transparent"
                  : "bg-primary/95 hover:bg-primary text-primary-foreground font-bold text-2xl",
              )}
            >
              {!solved.includes(i) && "?"}
            </button>
          ))}
        </div>
      </div>
      <div className="text-center mt-5">
        <Button
          disabled={solved.length < total}
          onClick={() => onAnswer({ correct: true })}
          className="btn-pop rounded-full px-8 h-12"
        >
          HoÃ n thÃ nh ghÃ©p hÃ¬nh
        </Button>
        <Button variant="ghost" onClick={() => setSolved([])} className="ml-2">
          <RotateCw className="size-4 mr-1" /> ChÆ¡i láº¡i
        </Button>
      </div>
    </div>
  );
}

export function Story({ question, onAnswer }: InteractionProps<StoryQ>) {
  const [scene, setScene] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const cur = question.scenes[scene];

  const next = () => {
    setPicked(null);
    if (scene < question.scenes.length - 1) setScene(scene + 1);
    else onAnswer({ correct: true });
  };

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="text-xs text-muted-foreground mb-2">
        Cáº£nh {scene + 1}/{question.scenes.length}
      </div>
      <Card className="p-6 border-2 border-fun bg-gradient-to-br from-fun/5 to-card">
        <div className="text-base leading-relaxed mb-4 italic">
          ðŸ“– {cur.narrator}
        </div>
        {cur.choice && (
          <div className="space-y-2">
            {cur.choice.options.map((opt) => {
              const isPicked = picked === opt.id;
              const showCorrect = picked && opt.id === cur.choice!.correct;
              return (
                <button
                  key={opt.id}
                  disabled={!!picked}
                  onClick={() => setPicked(opt.id)}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-3 transition-all",
                    showCorrect && "border-success bg-success/15",
                    picked &&
                      isPicked &&
                      !showCorrect &&
                      "border-destructive bg-destructive/15",
                    !picked && "border-border hover:border-fun bg-card",
                  )}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>
        )}
        {(!cur.choice || picked) && (
          <Button onClick={next} className="btn-pop mt-5 rounded-full">
            {scene < question.scenes.length - 1 ? "Tiáº¿p tá»¥c â†’" : "Káº¿t thÃºc âœ¨"}
          </Button>
        )}
      </Card>
    </div>
  );
}
