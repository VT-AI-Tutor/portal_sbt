/**
 * "HÀNH TRÌNH LEO ĐỈNH OLYMPIA" — 4 thẻ Tuần/Tháng/Quý/Năm dựa trên
 * `journeyState(overview)` (journeyLogic.ts). Thẻ active = viền primary +
 * badge "Đang thi"; locked = khóa + lý do; done = dấu xong; upcoming/none =
 * kỳ + ngày (hoặc "Chưa mở" khi chưa có vòng nào).
 */
import { Lock, CheckCircle2, Flame, CalendarClock } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Badge } from "@/core/ui/badge";
import { cn } from "@/core/lib/utils";
import type { ArenaOverview, ArenaTier } from "@/modules/student/api/arenaApi";
import { journeyState, type ArenaJourneyStateValue } from "./journeyLogic";
import { formatArenaDateRange } from "./arenaFormat";

const TIER_ORDER: ArenaTier[] = ["week", "month", "quarter", "year"];

const TIER_LABEL: Record<ArenaTier, string> = {
  week: "Vòng Tuần",
  month: "Vòng Tháng",
  quarter: "Vòng Quý",
  year: "Vòng Năm",
};

const STATE_CARD_CLASS: Record<ArenaJourneyStateValue, string> = {
  active: "border-primary bg-primary/5",
  locked: "border-border bg-muted/40 opacity-80",
  upcoming: "border-border",
  done: "border-success/40 bg-success/5",
  none: "border-dashed border-border bg-muted/20",
};

export function JourneyStrip({ overview }: { overview: ArenaOverview }) {
  const states = journeyState(overview);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {TIER_ORDER.map((tier, i) => {
        const round = overview.rounds[tier];
        const { state, reason } = states[tier];
        return (
          <Card
            key={tier}
            className={cn("p-4 border-2 relative", STATE_CARD_CLASS[state])}
          >
            <div className="text-[11px] uppercase font-bold text-muted-foreground">
              Bước {i + 1}
            </div>
            <div className="font-display font-bold text-base mt-0.5">
              {TIER_LABEL[tier]}
            </div>

            {state === "active" && (
              <Badge className="mt-2 bg-primary text-primary-foreground">
                Đang thi
              </Badge>
            )}

            {state === "locked" && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5 shrink-0 mt-0.5" />
                <span>{reason ?? "Đã khoá"}</span>
              </div>
            )}

            {state === "done" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-success font-bold">
                <CheckCircle2 className="size-3.5" />
                Đã xong
              </div>
            )}

            {state === "none" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                Chưa mở vòng thi
              </div>
            )}

            {state === "upcoming" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-info font-bold">
                <Flame className="size-3.5" />
                Sắp mở
              </div>
            )}

            {round && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                <div>{round.period_key}</div>
                <div>
                  {formatArenaDateRange(round.starts_at, round.ends_at)}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
