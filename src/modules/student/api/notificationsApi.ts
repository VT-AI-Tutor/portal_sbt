/**
 * Trung tâm thông báo cá nhân + cài nhắc học (GAP-127 / NOTIF). Dùng lại
 * `apiFetch` (tự gắn token, bóc `{success,data}`). Thông báo theo user_id nên
 * dùng chung cho mọi vai trò.
 */
import { apiFetch } from "./practiceApi";

export type NotificationType =
  | "deadline"
  | "exam"
  | "class"
  | "result"
  | "ai"
  | "general";

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  type: NotificationType;
  read: boolean;
  class_id: string | null;
  created_at: string | null;
}

export interface NotificationList {
  data: AppNotification[];
  unread_count: number;
  pagination: {
    total: number;
    page: number;
    per_page: number;
    last_page: number;
  };
}

export interface ReminderPreferences {
  disabled_types: string[];
}

/** Loại nhắc học (StudyReminderService::TYPES) — thứ tự hiển thị. */
export const REMINDER_TYPES = [
  "keep_streak",
  "comeback",
  "assignment",
  "daily_quests",
] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export function getNotifications(page = 1): Promise<NotificationList> {
  // BE đặt unread_count + pagination CẠNH data (không lồng) → lấy nguyên body.
  return apiFetch<NotificationList>(
    `/api/v1/notifications?page=${page}`,
    undefined,
    { raw: true },
  );
}

export function markNotificationRead(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiFetch<void>("/api/v1/notifications/read-all", { method: "POST" });
}

export function getReminderPreferences(): Promise<ReminderPreferences> {
  return apiFetch<ReminderPreferences>(
    "/api/v1/notifications/reminder-preferences",
  );
}

export function updateReminderPreferences(
  disabledTypes: string[],
): Promise<ReminderPreferences> {
  return apiFetch<ReminderPreferences>(
    "/api/v1/notifications/reminder-preferences",
    { method: "PATCH", body: JSON.stringify({ disabled_types: disabledTypes }) },
  );
}
