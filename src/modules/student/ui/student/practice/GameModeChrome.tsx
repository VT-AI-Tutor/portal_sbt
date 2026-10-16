/**
 * Visual "skin" for game-mode practice — a combo streak bar, a border flash
 * on each check result, and a milestone toast. Purely presentational: all
 * combo bookkeeping lives in `comboLogic.ts` and is owned by the caller
 * (`PracticeRunner`), which feeds `flashResult`/`combo` in as props and
 * renders `children` (the question card) inside `<GameModeChrome>`.
 */
import { useEffect } from "react";
import { motion } from "motion/react";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/core/lib/utils";
import type { ComboState } from "./comboLogic";
import { estimateXp, SESSION_COMPLETED_XP } from "./xpEstimate";

const MILESTONE_MESSAGES: Record<3 | 5 | 10, string> = {
  3: "Tuyệt! Combo x3 🎉",
  5: "Bốc lửa! Combo x5 🔥",
  10: "Không thể cản! Combo x10 🚀",
};

interface GameModeChromeProps {
  combo: ComboState;
  /** Correct answers checked so far this session, for the XP counter. */
  correctCount: number;
  /** Result of the most recent check — drives the border flash. `null` = no check yet for the current question. */
  flashResult: "correct" | "incorrect" | null;
  /**
   * The value the caller's `nextCombo()` returned on the most recent check
   * — `null` on every non-landing check. Because reaching the same milestone
   * twice always passes back through smaller (non-milestone) streak values
   * in between, this prop necessarily cycles through `null` between any two
   * hits of the same number, so a plain value-change effect below is enough
   * to fire once per landing without extra de-dupe bookkeeping.
   */
  milestone: 3 | 5 | 10 | null;
  children: React.ReactNode;
}

export function GameModeChrome({
  combo,
  correctCount,
  flashResult,
  milestone,
  children,
}: GameModeChromeProps) {
  useEffect(() => {
    if (milestone == null) return;
    toast.success(MILESTONE_MESSAGES[milestone]);
  }, [milestone]);

  const xp = estimateXp(correctCount);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-border/70 bg-card px-4 py-2">
        {/* Key mang tiền tố vai trò — combo.streak và xp là hai con số có thể
            trùng nhau (đầu phiên cả hai = 0), key số trần làm hai sibling va
            key → React log "two children with the same key" mỗi lần render. */}
        <motion.div
          key={`combo-${combo.streak}`}
          initial={{ scale: 1 }}
          animate={combo.streak > 0 ? { scale: [1, 1.25, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-black tabular-nums",
            combo.streak > 0 ? "text-orange-500" : "text-muted-foreground",
          )}
        >
          <Flame
            className={cn("size-4", combo.streak > 0 && "fill-orange-500")}
          />
          Combo x{combo.streak}
          {combo.best > 0 && (
            <span className="text-xs font-semibold text-muted-foreground">
              (kỷ lục x{combo.best})
            </span>
          )}
        </motion.div>

        <motion.div
          key={`xp-${xp}`}
          initial={{ opacity: 0.4, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-right text-sm font-bold text-primary tabular-nums"
          title={`Ước tính theo câu đúng, chưa gồm +${SESSION_COMPLETED_XP} XP hoàn thành phiên`}
        >
          Dự kiến +{xp} XP
          <span className="ml-1 text-xs font-medium text-muted-foreground">
            (+{SESSION_COMPLETED_XP} khi hoàn thành)
          </span>
        </motion.div>
      </div>

      <motion.div
        key={flashResult ? `${flashResult}-${combo.streak}` : "idle"}
        initial={false}
        animate={
          flashResult === "correct"
            ? { boxShadow: "0 0 0 3px rgba(34,197,94,0.6)" }
            : flashResult === "incorrect"
              ? { boxShadow: "0 0 0 3px rgba(239,68,68,0.6)" }
              : { boxShadow: "0 0 0 0px rgba(0,0,0,0)" }
        }
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-2xl"
      >
        {children}
      </motion.div>
    </div>
  );
}
