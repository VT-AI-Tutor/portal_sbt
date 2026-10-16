import { AlertCircle, Flame, Star, Coins } from "lucide-react";
import { Skeleton } from "@/core/ui/skeleton";
import { useGamificationSummary } from "@/modules/student/api/hooks";

const numberFormatter = new Intl.NumberFormat("vi-VN");

/**
 * Cá»¥m 3 pill (streak / xp / coins) trÃªn header â€” chá»‰ Ä‘Æ°á»£c `AppShell` mount
 * khi `showStats` (há»c sinh), nÃªn hook `useGamificationSummary` chá»‰ fire khi
 * component nÃ y thá»±c sá»± render. CÃ¡c shell khÃ¡c (teacher/manager/admin) khÃ´ng
 * bao giá» mount component nÃ y â†’ khÃ´ng cÃ³ request thá»«a.
 */
export function GamificationStats() {
  const { data, isLoading, isError, error } = useGamificationSummary();

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 sm:gap-3">
        <Skeleton className="h-8 w-10 sm:w-14 rounded-full" />
        <Skeleton className="h-8 w-12 sm:w-16 rounded-full" />
        <Skeleton className="h-8 w-10 sm:w-14 rounded-full" />
      </div>
    );
  }

  // GAP-088: trÆ°á»›c Ä‘Ã¢y lá»—i vÃ  "chÆ°a cÃ³ dá»¯ liá»‡u" Ä‘á»u `return null` â†’ cá»¥m chá»‰ sá»‘ biáº¿n máº¥t khÃ´ng
  // má»™t lá»i giáº£i thÃ­ch, há»c sinh khÃ´ng phÃ¢n biá»‡t Ä‘Æ°á»£c há»‡ thá»‘ng lá»—i hay mÃ¬nh chÆ°a cÃ³ gÃ¬. BE luÃ´n
  // tráº£ object (HS má»›i cÃ³ xp=0), nÃªn rÆ¡i vÃ o Ä‘Ã¢y gáº§n nhÆ° cháº¯c cháº¯n lÃ  Lá»–I â†’ nÃ³i rÃµ, kÃ¨m tooltip
  // nguyÃªn nhÃ¢n Ä‘á»ƒ há»— trá»£ cháº©n Ä‘oÃ¡n.
  if (isError) {
    return (
      <div
        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted text-muted-foreground font-medium text-xs"
        title={error?.message ?? "KhÃ´ng táº£i Ä‘Æ°á»£c chá»‰ sá»‘"}
      >
        <AlertCircle className="size-3.5" /> ChÆ°a táº£i Ä‘Æ°á»£c chá»‰ sá»‘
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 sm:gap-3">
      <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-warning/20 text-warning font-bold text-xs sm:text-sm">
        <Flame className="size-3.5 sm:size-4" />{" "}
        {numberFormatter.format(data.streak_current)}
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-fun/20 text-fun font-bold text-xs sm:text-sm">
        <Star className="size-3.5 sm:size-4" /> {numberFormatter.format(data.xp)}
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-success/20 text-success font-bold text-xs sm:text-sm">
        <Coins className="size-3.5 sm:size-4" /> {numberFormatter.format(data.coins)}
      </div>
    </div>
  );
}
