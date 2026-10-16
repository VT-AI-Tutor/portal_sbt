/**
 * Dialog tạo/sửa buổi học cho giáo viên (GAP-132).
 * Form controlled bằng useState; submit gọi createSession/updateSession tuỳ initial.id.
 * start_at/end_at nhập bằng <input type="datetime-local">, đổi sang ISO khi submit.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/core/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { Switch } from "@/core/ui/switch";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type {
  DeliveryMode,
  SessionFormValues,
  SessionSummary,
} from "@/modules/teacher/api/classTypes";

const inputClass =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm";

interface SessionFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classId: string;
  token: string;
  initial?: SessionSummary;
  /** GV chủ nhiệm lớp — BE yêu cầu instructor_id khi tạo buổi không phải draft. */
  defaultInstructorId?: string;
  onSaved: () => void;
}

/** Đổi giá trị ISO/khác về dạng datetime-local (yyyy-MM-ddTHH:mm) cho input. */
function toLocalInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

interface FormState {
  title: string;
  start_at: string; // datetime-local
  end_at: string; // datetime-local
  timezone: string;
  session_type: string;
  delivery_mode: DeliveryMode;
  location_name: string;
  meeting_url: string;
  attendance_required: boolean;
  notes: string;
}

function toState(initial?: SessionSummary): FormState {
  return {
    title: initial?.title ?? "",
    start_at: toLocalInput(initial?.start_at),
    end_at: toLocalInput(initial?.end_at),
    timezone: initial?.timezone ?? "",
    session_type: initial?.session_type ?? "",
    delivery_mode: (initial?.delivery_mode as DeliveryMode) ?? "online",
    location_name: initial?.location_name ?? "",
    meeting_url: initial?.meeting_url ?? "",
    attendance_required: initial?.attendance_required ?? true,
    notes: (initial?.notes as string) ?? "",
  };
}

export function SessionFormDialog({
  open,
  onOpenChange,
  classId,
  token,
  initial,
  defaultInstructorId,
  onSaved,
}: SessionFormDialogProps) {
  const [state, setState] = useState<FormState>(() => toState(initial));
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(initial?.id);

  // Nạp lại giá trị mỗi khi mở dialog hoặc đổi buổi đang sửa.
  useEffect(() => {
    if (open) {
      setState(toState(initial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề buổi học.");
      return;
    }
    if (!state.start_at || !state.end_at) {
      toast.error("Vui lòng nhập thời gian bắt đầu và kết thúc.");
      return;
    }

    const values: SessionFormValues = {
      title: state.title.trim(),
      start_at: new Date(state.start_at).toISOString(),
      end_at: new Date(state.end_at).toISOString(),
      timezone: state.timezone || undefined,
      session_type: state.session_type || undefined,
      delivery_mode: state.delivery_mode,
      location_name: state.location_name || undefined,
      meeting_url: state.meeting_url || undefined,
      attendance_required: state.attendance_required,
      notes: state.notes || undefined,
      instructor_id: defaultInstructorId || undefined,
    };

    setSaving(true);
    try {
      if (initial?.id) {
        await teacherClassesApi.updateSession(classId, initial.id, values, token);
      } else {
        await teacherClassesApi.createSession(classId, values, token);
      }
      toast.success("Đã lưu buổi học.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không lưu được buổi học. Vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa buổi học" : "Tạo buổi học"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">Tiêu đề *</span>
              <input
                className={inputClass}
                value={state.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="VD: Buổi 1 - Giới thiệu"
                required
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Bắt đầu *</span>
              <input
                type="datetime-local"
                className={inputClass}
                value={state.start_at}
                onChange={(e) => setField("start_at", e.target.value)}
                required
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Kết thúc *</span>
              <input
                type="datetime-local"
                className={inputClass}
                value={state.end_at}
                onChange={(e) => setField("end_at", e.target.value)}
                required
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Hình thức</span>
              <select
                className={inputClass}
                value={state.delivery_mode}
                onChange={(e) =>
                  setField("delivery_mode", e.target.value as DeliveryMode)
                }
              >
                <option value="online">Trực tuyến</option>
                <option value="offline">Trực tiếp</option>
                <option value="blended">Kết hợp</option>
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Loại buổi</span>
              <input
                className={inputClass}
                value={state.session_type}
                onChange={(e) => setField("session_type", e.target.value)}
                placeholder="VD: Lý thuyết, Ôn tập..."
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Địa điểm</span>
              <input
                className={inputClass}
                value={state.location_name}
                onChange={(e) => setField("location_name", e.target.value)}
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Múi giờ</span>
              <input
                className={inputClass}
                value={state.timezone}
                onChange={(e) => setField("timezone", e.target.value)}
                placeholder="VD: Asia/Ho_Chi_Minh"
              />
            </label>

            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">Link phòng học trực tuyến</span>
              <input
                className={inputClass}
                value={state.meeting_url}
                onChange={(e) => setField("meeting_url", e.target.value)}
                placeholder="https://..."
              />
            </label>

            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">Ghi chú</span>
              <textarea
                className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={state.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </label>

            <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2 text-sm md:col-span-2">
              <span className="font-medium">Yêu cầu điểm danh</span>
              <Switch
                checked={state.attendance_required}
                onCheckedChange={(v) => setField("attendance_required", v)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                "Lưu buổi học"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
