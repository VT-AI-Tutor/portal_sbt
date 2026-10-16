/**
 * YÃªu cáº§u 4 â€” hÆ°á»›ng dáº«n giáº£i cho cÃ¢u lÃ m sai, do TÃC GIáº¢ soáº¡n trong Studio.
 *
 * Æ¯u tiÃªn `payload.explanation` (RichContent â€” Ä‘Æ°á»ng chÃ­nh tá»« Studio, áº£nh
 * náº±m ngay trong blocks), rÆ¡i vá» `solution` (chá»¯ pháº³ng, cÃ¢u nháº­p tá»« Excel/QTI).
 * KhÃ´ng cÃ³ gÃ¬ thÃ¬ áº©n háº³n: bá»‹a lá»i giáº£i tá»« Ä‘Ã¡p Ã¡n Ä‘Ãºng lÃ  cÃ¡ch lá»™ mÃ£ thÃ´ cho há»c
 * sinh (bÃ i há»c web #132).
 */
import { Lightbulb } from "lucide-react";
import {
  ContentBlocksView,
  type RichContent,
} from "@/core/content/ContentBlocksView";
import {
  sessionPayload,
  type ReviewQuestion,
} from "@/modules/student/api/practiceApi";

export function SolutionBlock({ question }: { question: ReviewQuestion }) {
  const rich = (sessionPayload(question) as { explanation?: RichContent })
    .explanation;
  const hasRich = (rich?.blocks?.length ?? 0) > 0;
  const plain = (question.solution ?? "").trim();

  if (!hasRich && plain === "") return null;

  return (
    <div className="rounded-xl border-2 border-warning/30 bg-warning/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Lightbulb className="size-4 text-warning" />
        HÆ°á»›ng dáº«n giáº£i
      </div>
      {hasRich ? (
        <ContentBlocksView content={rich} className="text-sm space-y-2" />
      ) : (
        <p className="text-sm whitespace-pre-line">{plain}</p>
      )}
    </div>
  );
}
