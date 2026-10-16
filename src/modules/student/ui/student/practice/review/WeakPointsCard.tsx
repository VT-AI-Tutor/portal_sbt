/**
 * YÃªu cáº§u 3 (pháº§n nÃªu tÃªn) â€” gá»i Ä‘Ãºng tÃªn pháº§n kiáº¿n thá»©c Ä‘ang yáº¿u.
 * Pha 3 gáº¯n thÃªm má»¥c lÃ½ thuyáº¿t vÃ o tá»«ng dÃ²ng qua `weakPoint.theory`.
 */
import { AlertCircle } from "lucide-react";
import { Card } from "@/core/ui/card";
import type { WeakPoint } from "@/modules/student/api/practiceApi";
import { TheoryCard } from "./TheoryCard";

export function WeakPointsCard({ weakPoints }: { weakPoints: WeakPoint[] }) {
  if (weakPoints.length === 0) return null;

  return (
    <Card className="p-4 border-2 space-y-3">
      <h3 className="font-display font-bold flex items-center gap-2">
        <AlertCircle className="size-4 text-warning" />
        Cáº§n cáº£i thiá»‡n
      </h3>
      <div className="space-y-2">
        {weakPoints.map((w) => (
          <div
            key={`${w.dimension}-${w.code}`}
            className="rounded-lg bg-muted/40 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{w.label}</span>
              <span className="text-xs font-semibold text-muted-foreground shrink-0">
                sai {w.wrong}/{w.total} cÃ¢u
              </span>
            </div>
            {/* LÃ½ thuyáº¿t khá»›p theo mÃ£ thÃ nh tá»‘ â€” khÃ´ng cÃ³ má»¥c nÃ o thÃ¬ chá»‰ cÃ²n dÃ²ng nÃªu tÃªn. */}
            {w.theory.map((t) => (
              <TheoryCard key={t.id} entry={t} />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
