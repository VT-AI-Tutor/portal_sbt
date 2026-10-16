/**
 * "Bảng xếp hạng Top 10 — Khối {grade}" — Tabs Tuần/Tháng/Quý/Năm (chỉ tab có
 * vòng thi), mỗi tab gọi `useArenaLeaderboard(roundId)`. Hàng của em highlight
 * viền primary + "(em)"; em ngoài top 10 → hàng riêng "#{rank}".
 */
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Skeleton } from "@/core/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/core/ui/tabs";
import { cn } from "@/core/lib/utils";
import type { ArenaRoundCard, ArenaTier } from "@/modules/student/api/arenaApi";
import { useArenaLeaderboard } from "@/modules/student/api/arenaHooks";
import { formatArenaDuration } from "./arenaFormat";

const TIER_ORDER: ArenaTier[] = ["week", "month", "quarter", "year"];

const TIER_LABEL: Record<ArenaTier, string> = {
  week: "Tuần",
  month: "Tháng",
  quarter: "Quý",
  year: "Năm",
};

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderboardCard({
  rounds,
  grade,
}: {
  rounds: Record<ArenaTier, ArenaRoundCard | null>;
  grade: string;
}) {
  const availableTiers = TIER_ORDER.filter((t) => rounds[t] !== null);
  const [tab, setTab] = useState<ArenaTier | null>(availableTiers[0] ?? null);

  // Nếu tab hiện tại không còn hợp lệ (vd overview đổi), rơi về tab đầu tiên.
  useEffect(() => {
    if (tab && !availableTiers.includes(tab)) {
      setTab(availableTiers[0] ?? null);
    }
  }, [tab, availableTiers]);

  const activeRoundId = tab ? rounds[tab]?.id : undefined;
  const { data: leaderboard, isLoading } = useArenaLeaderboard(activeRoundId);

  return (
    <Card className="p-5 border-2">
      <div className="font-display font-bold text-lg flex items-center gap-2 mb-3">
        <Trophy className="text-warning" />
        Bảng xếp hạng Top 10 — Khối {grade}
      </div>

      {availableTiers.length === 0 || !tab ? (
        <p className="text-sm text-muted-foreground">
          Chưa có vòng thi nào để xếp hạng.
        </p>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as ArenaTier)}>
          <TabsList>
            {availableTiers.map((t) => (
              <TabsTrigger key={t} value={t}>
                {TIER_LABEL[t]}
              </TabsTrigger>
            ))}
          </TabsList>

          {availableTiers.map((t) => (
            <TabsContent key={t} value={t} className="mt-3">
              {t !== tab ? null : isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !leaderboard || leaderboard.top.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có ai xếp hạng ở vòng này.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {leaderboard.top.map((row) => (
                    <div
                      key={`${row.rank}-${row.student_name}`}
                      className={cn(
                        "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border",
                        row.is_me
                          ? "border-primary bg-primary/5"
                          : "border-transparent",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 text-center font-bold text-sm shrink-0">
                          {MEDALS[row.rank] ?? `#${row.rank}`}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">
                            {row.student_name}
                            {row.is_me && (
                              <span className="text-primary"> (em)</span>
                            )}
                          </div>
                          {row.school_name && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {row.school_name}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-bold shrink-0 text-right">
                        {row.score}đ
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {formatArenaDuration(row.duration_seconds)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {leaderboard.me && !leaderboard.top.some((r) => r.is_me) && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-primary bg-primary/5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center font-bold text-sm shrink-0">
                          #{leaderboard.me.rank}
                        </span>
                        <div className="font-bold text-sm text-primary">Em</div>
                      </div>
                      <div className="text-sm font-bold shrink-0 text-right">
                        {leaderboard.me.score}đ
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {formatArenaDuration(leaderboard.me.duration_seconds)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </Card>
  );
}
