import { useState } from "react";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/lib/utils";
import type {
  DragDropQ,
  MatchingQ,
  OrderingQ,
  ImageHotspotQ,
} from "@/core/lib/types";
import { FeedbackBox, type InteractionProps } from "./shared";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";

export function DragDrop({ question, onAnswer }: InteractionProps<DragDropQ>) {
  const [placement, setPlacement] = useState<Record<string, string>>({}); // itemId -> zoneId
  const [submitted, setSubmitted] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const correct = question.items.every((it) => {
    const z = placement[it.id];
    return (
      z && question.zones.find((zo) => zo.id === z)?.accepts.includes(it.id)
    );
  });

  const unplaced = question.items.filter((i) => !placement[i.id]);

  const moveTo = (zoneId: string | null) => {
    if (!dragId) return;
    setPlacement((p) => {
      const next = { ...p };
      if (zoneId === null) delete next[dragId];
      else next[dragId] = zoneId;
      return next;
    });
    setDragId(null);
  };

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <Card
        className="p-4 border-2 border-dashed mb-4 min-h-20"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => moveTo(null)}
      >
        <div className="text-xs text-muted-foreground mb-2">
          Kho vật phẩm (kéo xuống ô bên dưới):
        </div>
        <div className="flex flex-wrap gap-2">
          {unplaced.map((it) => (
            <div
              key={it.id}
              draggable={!submitted}
              onDragStart={() => setDragId(it.id)}
              onClick={() => setDragId(it.id)}
              className={cn(
                "cursor-grab active:cursor-grabbing rounded-xl px-4 py-2 bg-accent text-accent-foreground border-2 border-accent-foreground/20 font-medium",
                "hover:scale-105 transition-transform",
                dragId === it.id && "ring-4 ring-primary",
              )}
            >
              {it.text}
            </div>
          ))}
          {unplaced.length === 0 && (
            <div className="text-sm text-muted-foreground">Đã đặt hết!</div>
          )}
        </div>
      </Card>
      <div className="grid md:grid-cols-3 gap-3">
        {question.zones.map((z) => {
          const items = question.items.filter((i) => placement[i.id] === z.id);
          return (
            <Card
              key={z.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => moveTo(z.id)}
              onClick={() => dragId && moveTo(z.id)}
              className={cn(
                "p-4 min-h-32 border-2 cursor-pointer transition-all",
                dragId && "border-primary bg-primary/5",
              )}
            >
              <div className="font-display font-bold text-center mb-3 pb-2 border-b">
                {z.label}
              </div>
              <div className="space-y-2">
                {items.map((it) => {
                  const isOk = z.accepts.includes(it.id);
                  return (
                    <div
                      key={it.id}
                      draggable={!submitted}
                      onDragStart={() => setDragId(it.id)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm cursor-grab",
                        submitted
                          ? isOk
                            ? "bg-success/20 border border-success"
                            : "bg-destructive/20 border border-destructive"
                          : "bg-secondary",
                      )}
                    >
                      {it.text}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
      {!submitted ? (
        <Button
          disabled={unplaced.length > 0}
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct, userAnswer: placement });
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

export function Matching({ question, onAnswer }: InteractionProps<MatchingQ>) {
  const [pairs, setPairs] = useState<Record<string, string>>({}); // leftId -> rightId
  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const correct = question.left.every(
    (l) => pairs[l.id] === question.pairs[l.id],
  );

  const handleLeft = (id: string) => {
    if (submitted) return;
    setActiveLeft(id);
  };
  const handleRight = (id: string) => {
    if (!activeLeft || submitted) return;
    setPairs((p) => {
      // remove conflicts
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(p))
        if (v !== id && k !== activeLeft) next[k] = v;
      next[activeLeft] = id;
      return next;
    });
    setActiveLeft(null);
  };

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-xs uppercase font-bold text-muted-foreground">
            Cột A
          </div>
          {question.left.map((l) => {
            const matched = pairs[l.id];
            const right = question.right.find((r) => r.id === matched);
            const isRight = submitted && pairs[l.id] === question.pairs[l.id];
            const isWrong = submitted && pairs[l.id] !== question.pairs[l.id];
            return (
              <button
                key={l.id}
                onClick={() => handleLeft(l.id)}
                className={cn(
                  "w-full text-left rounded-2xl border-2 p-3 transition-all",
                  activeLeft === l.id &&
                    "border-primary bg-primary/10 ring-2 ring-primary",
                  matched && !submitted && "border-info bg-info/5",
                  isRight && "border-success bg-success/15",
                  isWrong && "border-destructive bg-destructive/15",
                  !matched &&
                    !activeLeft &&
                    "border-border bg-card hover:border-primary",
                )}
              >
                <div className="text-sm">{l.text}</div>
                {right && (
                  <div className="mt-1 text-xs italic text-info">
                    → {right.text}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          <div className="text-xs uppercase font-bold text-muted-foreground">
            Cột B
          </div>
          {question.right.map((r) => {
            const used = Object.values(pairs).includes(r.id);
            return (
              <button
                key={r.id}
                disabled={submitted}
                onClick={() => handleRight(r.id)}
                className={cn(
                  "w-full text-left rounded-2xl border-2 p-3 transition-all",
                  used
                    ? "border-info bg-info/10"
                    : "border-border bg-card hover:border-primary",
                  activeLeft && "ring-2 ring-primary/30",
                )}
              >
                <div className="text-sm">{r.text}</div>
              </button>
            );
          })}
        </div>
      </div>
      {!submitted ? (
        <Button
          disabled={Object.keys(pairs).length < question.left.length}
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct, userAnswer: pairs });
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

function cryptoShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  const buf = new Uint32Array(result.length);
  crypto.getRandomValues(buf);
  for (let i = result.length - 1; i > 0; i--) {
    const j = buf[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function Ordering({ question, onAnswer }: InteractionProps<OrderingQ>) {
  const [order, setOrder] = useState(() => cryptoShuffle(question.items));
  const [submitted, setSubmitted] = useState(false);
  const correct = order.every((it, i) => it.id === question.correctAnswer[i]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="space-y-2">
        {order.map((it, i) => {
          const isRight = submitted && it.id === question.correctAnswer[i];
          const isWrong = submitted && it.id !== question.correctAnswer[i];
          return (
            <Card
              key={it.id}
              className={cn(
                "p-3 flex items-center gap-3 border-2",
                isRight && "border-success bg-success/10",
                isWrong && "border-destructive bg-destructive/10",
              )}
            >
              <GripVertical className="text-muted-foreground" />
              <div className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                {i + 1}
              </div>
              <div className="flex-1">{it.text}</div>
              <div className="flex flex-col gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  disabled={submitted || i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  disabled={submitted || i === order.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      {!submitted ? (
        <Button
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct, userAnswer: order.map((o) => o.id) });
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

export function ImageHotspot({
  question,
  onAnswer,
}: InteractionProps<ImageHotspotQ>) {
  const [picked, setPicked] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const correctSpot = question.hotspots.find((h) => h.correct);
  const correct = picked === correctSpot?.id;

  return (
    <div>
      <p className="text-lg mb-4 font-medium">{question.prompt}</p>
      <div className="relative inline-block w-full max-w-xl rounded-2xl overflow-hidden border-2 border-primary">
        <img src={question.imageUrl} alt="hotspot" className="w-full block" />
        {question.hotspots.map((h) => {
          const isPicked = picked === h.id;
          const showRight = submitted && h.correct;
          const showWrong = submitted && isPicked && !h.correct;
          return (
            <button
              key={h.id}
              disabled={submitted}
              onClick={() => setPicked(h.id)}
              style={{
                position: "absolute",
                left: `${h.x}%`,
                top: `${h.y}%`,
                width: `${h.r * 2}%`,
                aspectRatio: "1",
                transform: "translate(-50%, -50%)",
              }}
              className={cn(
                "rounded-full border-4 transition-all",
                isPicked &&
                  !submitted &&
                  "border-primary bg-primary/30 animate-pulse",
                showRight && "border-success bg-success/40",
                showWrong && "border-destructive bg-destructive/40",
                !isPicked &&
                  !showRight &&
                  "border-card/60 bg-card/20 hover:bg-card/40",
              )}
              title={h.label}
            />
          );
        })}
      </div>
      {!submitted ? (
        <Button
          disabled={!picked}
          className="btn-pop mt-5 rounded-full px-8 h-12"
          onClick={() => {
            setSubmitted(true);
            onAnswer({ correct, userAnswer: picked });
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
