import { useMemo } from "react";
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Flame,
  Target,
  ListChecks,
  Dumbbell,
  Swords,
  Timer,
} from "lucide-react";
import { Card } from "@/core/ui/card";
import { Skeleton } from "@/core/ui/skeleton";
import {
  usePracticeActivity,
  usePracticeTimeline,
} from "@/modules/student/api/hooks";
import type {
  TimelineEntry,
  TimelineItem,
} from "@/modules/student/api/practiceApi";
import { ContributionHeatmap } from "./activity/ContributionHeatmap";

const numberFormatter = new Intl.NumberFormat("vi-VN");

const MODE_META: Record<
  TimelineEntry["mode"],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  practice: { label: "Luyện tập", icon: Dumbbell },
  game: { label: "Chơi game", icon: Swords },
  timed: { label: "Tính giờ", icon: Timer },
};

function formatTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function dayKey(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <Card className="p-4 border-2 flex items-center gap-3">
      <div
        className={`size-10 rounded-full flex items-center justify-center shrink-0 ${tone}`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="font-display font-bold text-xl leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </Card>
  );
}

function ItemChip({ item }: { item: TimelineItem }) {
  const state =
    item.is_correct === true
      ? {
          Icon: CheckCircle2,
          cls: "border-success/40 bg-success/10 text-success",
        }
      : item.is_correct === false
        ? { Icon: XCircle, cls: "border-destructive/40 bg-destructive/10 text-destructive" }
        : {
            Icon: MinusCircle,
            cls: "border-border bg-muted text-muted-foreground",
          };
  const { Icon, cls } = state;
  const competency = item.competency ?? item.outcome_label ?? item.outcome_code;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${cls}`}
      title={`${competency}${item.content_label ? ` · ${item.content_label}` : ""}`}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate max-w-[16rem]">
        <span className="font-semibold">Câu {item.order + 1}</span>
        {competency ? <span className="opacity-80"> · {competency}</span> : null}
      </span>
      {item.level_label ? (
        <span className="ml-auto shrink-0 rounded bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {item.level_label}
        </span>
      ) : null}
    </div>
  );
}

function SessionCard({ entry }: { entry: TimelineEntry }) {
  const mode = MODE_META[entry.mode] ?? MODE_META.practice;
  const ModeIcon = mode.icon;
  const accuracy =
    entry.gradable > 0 ? Math.round((entry.correct / entry.gradable) * 100) : null;

  return (
    <Card className="p-4 border-2">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <ModeIcon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold text-sm">{entry.subject_name}</span>
            <span className="text-xs text-muted-foreground">· {mode.label}</span>
            <span className="text-xs text-muted-foreground">
              · {formatTime(entry.completed_at)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {entry.correct}/{entry.gradable} câu đúng
            {accuracy !== null ? ` · ${accuracy}%` : ""}
          </div>
        </div>
        {accuracy !== null ? (
          <div
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
              accuracy >= 75
                ? "bg-success/15 text-success"
                : accuracy >= 50
                  ? "bg-warning/15 text-warning"
                  : "bg-destructive/15 text-destructive"
            }`}
          >
            {accuracy}%
          </div>
        ) : null}
      </div>

      {entry.items.length > 0 ? (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {entry.items.map((item) => (
            <ItemChip key={item.question_id} item={item} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export function StudentActivityPage() {
  const activity = usePracticeActivity();
  const timeline = usePracticeTimeline();

  const groupedByDay = useMemo(() => {
    const groups: { day: string; entries: TimelineEntry[] }[] = [];
    const byDay = new Map<string, TimelineEntry[]>();
    for (const entry of timeline.data?.entries ?? []) {
      const key = dayKey(entry.completed_at);
      if (!byDay.has(key)) {
        byDay.set(key, []);
        groups.push({ day: key, entries: byDay.get(key)! });
      }
      byDay.get(key)!.push(entry);
    }
    return groups;
  }, [timeline.data]);

  const overallAccuracy =
    activity.data && activity.data.total_attempted > 0
      ? Math.round(
          (activity.data.total_correct / activity.data.total_attempted) * 100,
        )
      : null;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <CalendarClock className="text-primary" /> Nhật ký học tập
        </h1>
        <p className="text-muted-foreground">
          Toàn bộ hành trình luyện tập của em — làm bài gì, thuộc năng lực nào,
          đúng hay sai.
        </p>
      </div>

      {/* Stat tiles */}
      {activity.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : activity.data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            icon={ListChecks}
            label="Tổng câu đã làm"
            value={numberFormatter.format(activity.data.total_attempted)}
            tone="bg-primary/15 text-primary"
          />
          <StatTile
            icon={Target}
            label="Độ chính xác"
            value={overallAccuracy !== null ? `${overallAccuracy}%` : "—"}
            tone="bg-success/15 text-success"
          />
          <StatTile
            icon={Flame}
            label="Số ngày hoạt động"
            value={numberFormatter.format(activity.data.active_days)}
            tone="bg-warning/15 text-warning"
          />
          <StatTile
            icon={CheckCircle2}
            label="Số câu đúng"
            value={numberFormatter.format(activity.data.total_correct)}
            tone="bg-fun/15 text-fun"
          />
        </div>
      ) : null}

      {/* Contribution heatmap */}
      <Card className="p-5 border-2">
        <div className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          📅 Lịch hoạt động 1 năm qua
        </div>
        {activity.isLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : activity.isError ? (
          <p className="text-sm text-muted-foreground">
            Không tải được lịch hoạt động. Vui lòng thử lại sau.
          </p>
        ) : activity.data ? (
          <ContributionHeatmap
            days={activity.data.days}
            maxDayCount={activity.data.max_day_count}
          />
        ) : null}
      </Card>

      {/* Timeline */}
      <Card className="p-5 border-2">
        <div className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          🕒 Dòng thời gian làm bài
        </div>

        {timeline.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : timeline.isError ? (
          <p className="text-sm text-muted-foreground">
            Không tải được dòng thời gian. Vui lòng thử lại sau.
          </p>
        ) : groupedByDay.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Em chưa hoàn thành phiên luyện tập nào. Hãy bắt đầu luyện tập để ghi
            dấu hành trình của mình!
          </p>
        ) : (
          <div className="space-y-6">
            {groupedByDay.map((group) => (
              <div key={group.day}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold capitalize">{group.day}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-3">
                  {group.entries.map((entry) => (
                    <SessionCard key={entry.session_id} entry={entry} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
