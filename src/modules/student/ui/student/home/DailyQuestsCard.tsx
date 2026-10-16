import { Target, CheckCircle2, Coins } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Progress } from "@/core/ui/progress";
import { Skeleton } from "@/core/ui/skeleton";
import { useDailyQuests } from "@/modules/student/api/hooks";

/**
 * Card "Nhiệm vụ hôm nay" trên trang chủ học sinh (GAME-R15/R16). Read-only —
 * tiến độ tự tăng khi luyện tập. Lỗi tải thì ẩn gọn, không phá trang chủ.
 */
export function DailyQuestsCard() {
  const { data, isLoading, isError } = useDailyQuests();

  if (isError) return null;

  return (
    <Card className="p-5 border-2">
      <div className="flex items-center gap-2 mb-3">
        <Target className="text-primary" />
        <h2 className="font-display font-bold text-lg">Nhiệm vụ hôm nay</h2>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      )}

      {data && (
        <>
          <ul className="space-y-3">
            {data.quests.map((q) => (
              <li key={q.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span
                    className={`font-medium flex items-center gap-1.5 ${
                      q.completed ? "text-success" : ""
                    }`}
                  >
                    {q.completed && <CheckCircle2 className="size-4" />}
                    {q.title}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {Math.min(q.progress, q.target)}/{q.target}
                  </span>
                </div>
                <Progress
                  value={
                    q.target > 0
                      ? Math.min(100, (q.progress / q.target) * 100)
                      : 0
                  }
                  className="h-2"
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
            <Coins className="size-3.5" />+{data.coins_per_quest} xu mỗi nhiệm vụ
            · trọn bộ +{data.coins_full_set} xu
          </div>
        </>
      )}
    </Card>
  );
}
