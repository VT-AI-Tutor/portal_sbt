/**
 * Result screen shown right after an Arena attempt is submitted (Task 13).
 * Score count-up + correct/total + duration + current rank, with a Top-10
 * congrats block. Motion/count-up patterns cloned from
 * `practice/SessionResult.tsx` â€” no confetti dependency added, per brief.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Clock3,
  Trophy,
  ArrowRight,
  Mountain,
} from "lucide-react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import type { ArenaSubmitResult } from "@/modules/student/api/arenaApi";
import { formatArenaDuration } from "./arenaFormat";

/** Count 0 â†’ target with an ease-out tween â€” a tasteful score reveal. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // Guarantee final value lands even when rAF is throttled (e.g., hidden tabs)
    const timeout = setTimeout(() => {
      setValue(target);
      cancelAnimationFrame(raf);
    }, durationMs + 100);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [target, durationMs]);

  return value;
}

interface ArenaResultProps {
  result: ArenaSubmitResult;
}

export function ArenaResult({ result }: ArenaResultProps) {
  const navigate = useNavigate();
  const score = useCountUp(result.score);
  const isTop10 = result.rank != null && result.rank <= 10;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <Card className="p-6 border-2 text-center space-y-2">
          <div className="text-xs uppercase font-bold text-muted-foreground">
            Káº¿t quáº£ lÆ°á»£t thi
          </div>
          <div className="font-display text-5xl font-black text-foreground tabular-nums">
            {score}Ä‘
          </div>
          {result.is_best && (
            <div className="text-xs font-bold text-success">
              Äiá»ƒm tá»‘t nháº¥t cá»§a em!
            </div>
          )}
        </Card>
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 border-2 text-center space-y-1">
          <CheckCircle2 className="size-5 text-success mx-auto" />
          <div className="font-display text-lg font-bold tabular-nums">
            {result.correct_count}/{result.question_count}
          </div>
          <div className="text-[11px] text-muted-foreground">Sá»‘ cÃ¢u Ä‘Ãºng</div>
        </Card>
        <Card className="p-4 border-2 text-center space-y-1">
          <Clock3 className="size-5 text-info mx-auto" />
          <div className="font-display text-lg font-bold tabular-nums">
            {formatArenaDuration(result.duration_seconds)}
          </div>
          <div className="text-[11px] text-muted-foreground">Thá»i gian</div>
        </Card>
        <Card className="p-4 border-2 text-center space-y-1">
          <Trophy className="size-5 text-warning mx-auto" />
          <div className="font-display text-lg font-bold tabular-nums">
            {result.rank != null ? `#${result.rank}` : "â€”"}
          </div>
          <div className="text-[11px] text-muted-foreground">Háº¡ng hiá»‡n táº¡i</div>
        </Card>
      </div>

      {isTop10 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="p-5 border-2 border-fun/40 bg-fun/5 flex items-center gap-3">
            <Trophy className="size-8 text-fun shrink-0" />
            <div>
              <div className="font-display font-bold">Em Ä‘Ã£ vÃ o Top 10! ðŸŽ‰</div>
              <div className="text-xs text-muted-foreground">
                Giá»¯ vá»¯ng phong Ä‘á»™ Ä‘á»ƒ trá»¥ háº¡ng nhÃ©!
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <Button
        className="w-full gap-2 btn-pop"
        size="lg"
        onClick={() => navigate("/student/arena")}
      >
        <Mountain className="size-4" />
        Vá» Äáº¥u trÆ°á»ng
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
