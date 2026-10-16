import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/core/ui/card";
import { Switch } from "@/core/ui/switch";
import { Skeleton } from "@/core/ui/skeleton";
import {
  useReminderPreferences,
  useUpdateReminderPreferences,
} from "@/modules/student/api/hooks";
import {
  REMINDER_TYPES,
  type ReminderType,
} from "@/modules/student/api/notificationsApi";

const LABELS: Record<ReminderType, string> = {
  keep_streak: "Nhắc giữ chuỗi học",
  comeback: "Nhắc quay lại luyện tập",
  assignment: "Nhắc bài được giao sắp đến hạn",
  daily_quests: "Nhắc nhiệm vụ ngày chưa xong",
};

/** Cài đặt nhắc học — section trong Hồ sơ học sinh (NOTIF reminder-preferences). */
export function ReminderSettingsCard() {
  const { data, isLoading } = useReminderPreferences();
  const update = useUpdateReminderPreferences();

  const disabled = new Set(data?.disabled_types ?? []);

  const toggle = (type: ReminderType, on: boolean) => {
    const next = new Set(disabled);
    // Bật = KHÔNG nằm trong disabled_types.
    if (on) next.delete(type);
    else next.add(type);
    update.mutate([...next], {
      onSuccess: () => toast.success("Đã lưu cài đặt nhắc học."),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <Card className="p-6 border-2">
      <div className="flex items-center gap-2 mb-4">
        <BellRing className="text-primary" />
        <h2 className="font-display font-bold text-lg">Cài đặt nhắc học</h2>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && data && (
        <ul className="space-y-3">
          {REMINDER_TYPES.map((type) => (
            <li key={type} className="flex items-center justify-between gap-4">
              <span className="text-sm">{LABELS[type]}</span>
              <Switch
                checked={!disabled.has(type)}
                disabled={update.isPending}
                onCheckedChange={(on) => toggle(type, on)}
                aria-label={LABELS[type]}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
