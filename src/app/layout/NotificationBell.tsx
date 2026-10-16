import {
  Bell,
  Clock,
  FileText,
  GraduationCap,
  CheckCircle2,
  Sparkles,
  Info,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/ui/popover";
import { Skeleton } from "@/core/ui/skeleton";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/modules/student/api/hooks";
import type {
  AppNotification,
  NotificationType,
} from "@/modules/student/api/notificationsApi";

const TYPE_ICON: Record<
  NotificationType,
  React.ComponentType<{ className?: string }>
> = {
  deadline: Clock,
  exam: FileText,
  class: GraduationCap,
  result: CheckCircle2,
  ai: Sparkles,
  general: Info,
};

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

function NotificationRow({
  n,
  onRead,
}: {
  n: AppNotification;
  onRead: (id: string) => void;
}) {
  const Icon = TYPE_ICON[n.type] ?? Info;
  return (
    <button
      type="button"
      onClick={() => !n.read && onRead(n.id)}
      className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-secondary transition-colors ${
        n.read ? "" : "bg-primary/5"
      }`}
    >
      <div className="mt-0.5 shrink-0 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm truncate ${n.read ? "text-foreground" : "font-bold"}`}
        >
          {n.title}
        </div>
        <div className="text-xs text-muted-foreground line-clamp-2">
          {n.description}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {relativeTime(n.created_at)}
        </div>
      </div>
      {!n.read && (
        <span className="mt-1.5 size-2 rounded-full bg-primary shrink-0" />
      )}
    </button>
  );
}

/** Chuông thông báo trên header (mọi vai trò) — panel dropdown. */
export function NotificationBell() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const unread = data?.unread_count ?? 0;
  const items = data?.data ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Thông báo"
          className="relative flex items-center justify-center size-10 rounded-xl hover:bg-secondary transition-colors"
        >
          <Bell className="size-5 text-foreground" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-bold">Thông báo</span>
          <button
            type="button"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
            className="text-xs font-semibold text-primary disabled:opacity-40"
          >
            Đánh dấu đã đọc hết
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y">
          {isLoading && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Chưa có thông báo
            </div>
          )}
          {!isLoading &&
            items.map((n) => (
              <NotificationRow key={n.id} n={n} onRead={markRead.mutate} />
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
