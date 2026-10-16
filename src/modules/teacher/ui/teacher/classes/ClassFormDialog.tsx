/**
 * Dialog tạo/sửa lớp học cho giáo viên (GAP-132).
 * Form controlled bằng useState; submit gọi createClass/updateClass tuỳ initial.id.
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
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type {
  ClassFormValues,
  ClassSummary,
} from "@/modules/teacher/api/classTypes";

/** Initial có thể là bản tóm tắt lớp (ClassSummary) từ danh sách, hoặc form values. */
type ClassFormInitial =
  | (Partial<ClassFormValues> & { id?: string })
  | ClassSummary;

const inputClass =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm";

type DeliveryMode = "online" | "offline" | "blended";
type Visibility = "internal" | "public" | "private";

interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  token: string;
  initial?: ClassFormInitial;
  onSaved: () => void;
}

function toValues(initial?: ClassFormInitial): ClassFormValues {
  return {
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    display_name: initial?.display_name ?? "",
    delivery_mode: initial?.delivery_mode ?? "online",
    visibility: initial?.visibility ?? "internal",
    capacity: initial?.capacity ?? undefined,
    class_start_at: initial?.class_start_at ?? "",
    class_end_at: initial?.class_end_at ?? "",
    location_name: initial?.location_name ?? "",
    meeting_url: initial?.meeting_url ?? "",
    internal_notes: initial?.internal_notes ?? "",
  };
}

export function ClassFormDialog({
  open,
  onOpenChange,
  token,
  initial,
  onSaved,
}: ClassFormDialogProps) {
  const [values, setValues] = useState<ClassFormValues>(() => toValues(initial));
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(initial?.id);

  // Nạp lại giá trị mỗi khi mở dialog hoặc đổi lớp đang sửa.
  useEffect(() => {
    if (open) {
      setValues(toValues(initial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  function setField<K extends keyof ClassFormValues>(key: K, value: ClassFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.code.trim() || !values.name.trim()) {
      toast.error("Vui lòng nhập Mã lớp và Tên lớp.");
      return;
    }
    setSaving(true);
    try {
      const payload: ClassFormValues = {
        ...values,
        capacity:
          values.capacity === undefined || values.capacity === null
            ? undefined
            : Number(values.capacity),
      };
      if (initial?.id) {
        await teacherClassesApi.updateClass(initial.id, payload, token);
      } else {
        await teacherClassesApi.createClass(payload, token);
      }
      toast.success("Đã lưu lớp.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không lưu được lớp. Vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa lớp học" : "Tạo lớp học"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Mã lớp *</span>
              <input
                className={inputClass}
                value={values.code}
                onChange={(e) => setField("code", e.target.value)}
                placeholder="VD: TOAN-10A"
                required
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Tên lớp *</span>
              <input
                className={inputClass}
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="VD: Toán 10A"
                required
              />
            </label>

            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">Tên hiển thị</span>
              <input
                className={inputClass}
                value={values.display_name ?? ""}
                onChange={(e) => setField("display_name", e.target.value)}
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Hình thức</span>
              <select
                className={inputClass}
                value={values.delivery_mode ?? "online"}
                onChange={(e) => setField("delivery_mode", e.target.value as DeliveryMode)}
              >
                <option value="online">Trực tuyến</option>
                <option value="offline">Trực tiếp</option>
                <option value="blended">Kết hợp</option>
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Phạm vi</span>
              <select
                className={inputClass}
                value={values.visibility ?? "internal"}
                onChange={(e) => setField("visibility", e.target.value as Visibility)}
              >
                <option value="internal">Nội bộ</option>
                <option value="public">Công khai</option>
                <option value="private">Riêng tư</option>
              </select>
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Sĩ số tối đa</span>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={values.capacity ?? ""}
                onChange={(e) =>
                  setField(
                    "capacity",
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Địa điểm</span>
              <input
                className={inputClass}
                value={values.location_name ?? ""}
                onChange={(e) => setField("location_name", e.target.value)}
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Ngày bắt đầu</span>
              <input
                type="date"
                className={inputClass}
                value={values.class_start_at ?? ""}
                onChange={(e) => setField("class_start_at", e.target.value)}
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Ngày kết thúc</span>
              <input
                type="date"
                className={inputClass}
                value={values.class_end_at ?? ""}
                onChange={(e) => setField("class_end_at", e.target.value)}
              />
            </label>

            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">Link phòng học trực tuyến</span>
              <input
                className={inputClass}
                value={values.meeting_url ?? ""}
                onChange={(e) => setField("meeting_url", e.target.value)}
                placeholder="https://..."
              />
            </label>

            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">Ghi chú nội bộ</span>
              <textarea
                className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={values.internal_notes ?? ""}
                onChange={(e) => setField("internal_notes", e.target.value)}
              />
            </label>
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
                "Lưu lớp"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
