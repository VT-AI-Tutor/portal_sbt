import { Trophy, Medal, Star, Flame, Award, Target, CheckCircle2, Coins } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Skeleton } from "@/core/ui/skeleton";
import { useAchievements } from "@/modules/student/api/hooks";
import { getXpHistoryMeta, type XpHistoryIconKey } from "./xpHistoryMeta";

const BADGE_ICONS = [Star, Flame, Award, Trophy, Target, Medal] as const;

function badgeIcon(index: number) {
  return BADGE_ICONS[index % BADGE_ICONS.length];
}

const XP_HISTORY_ICONS: Record<XpHistoryIconKey, React.ComponentType<{ className?: string }>> = {
  correct: CheckCircle2,
  session: Trophy,
  coins: Coins,
  default: Star,
};

const numberFormatter = new Intl.NumberFormat("vi-VN");

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function StudentAchievementsPage() {
  const { data, isLoading, isError } = useAchievements();

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Trophy className="text-warning" /> Thành tích
        </h1>
        <p className="text-muted-foreground">Bộ sưu tập huy hiệu của em</p>
      </div>

      {isLoading && (
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="p-5 border-2 text-center text-muted-foreground">
          Không tải được thành tích. Vui lòng thử lại sau.
        </Card>
      )}

      {!isLoading && !isError && data && (
        <>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {data.badges.map((b, idx) => {
              const Icon = badgeIcon(idx);
              return (
                <Card
                  key={b.code}
                  className={`p-5 border-2 text-center ${
                    b.earned
                      ? "border-warning bg-warning/5"
                      : "border-border opacity-40 grayscale"
                  }`}
                >
                  <div className="size-16 rounded-full bg-warning/20 mx-auto flex items-center justify-center mb-2">
                    <Icon className="size-8 text-warning" />
                  </div>
                  <div className="font-bold text-sm">{b.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {b.earned
                      ? (b.earned_at ? formatDateTime(b.earned_at) : "Đã đạt")
                      : b.description}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="p-5 border-2">
            <div className="font-display font-bold text-lg mb-3">📜 Lịch sử XP</div>
            {data.xp_history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có hoạt động nào được ghi nhận.
              </p>
            ) : (
              <div className="space-y-2">
                {data.xp_history.map((entry, idx) => {
                  const meta = getXpHistoryMeta(entry.type);
                  const Icon = XP_HISTORY_ICONS[meta.icon];
                  return (
                    <div
                      key={`${entry.type}-${entry.created_at}-${idx}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card border"
                    >
                      <div className="size-9 rounded-full bg-fun/15 flex items-center justify-center shrink-0">
                        <Icon className="size-4 text-fun" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{meta.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(entry.created_at)}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-success shrink-0">
                        +{numberFormatter.format(entry.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5 border-2 border-fun bg-fun/5 text-center">
            <div className="font-display font-bold text-fun">
              📊 Bảng xếp hạng sắp ra mắt
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
