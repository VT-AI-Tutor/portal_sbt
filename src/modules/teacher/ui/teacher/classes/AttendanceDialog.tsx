/**
 * Dialog điểm danh buổi học cho giáo viên (GAP-132).
 * Mở dialog → nạp roster; mỗi học viên chọn present/late/absent (mặc định present).
 * Lưu → markAttendance với danh sách AttendanceRecord.
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
import { Skeleton } from "@/core/ui/skeleton";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type {
  AttendanceRecord,
  AttendanceStatus,
  RosterRow,
  SessionSummary,
} from "@/modules/teacher/api/classTypes";

interface AttendanceDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classId: string;
  token: string;
  session: SessionSummary | null;
  onDone: () => void;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Có mặt" },
  { value: "late", label: "Đi muộn" },
  { value: "absent", label: "Vắng" },
];

function statusButtonClass(active: boolean, value: AttendanceStatus): string {
  const base =
    "rounded-md px-3 py-1 text-xs font-medium transition-colors border";
  if (!active) {
    return `${base} border-input bg-background text-muted-foreground hover:bg-muted`;
  }
  switch (value) {
    case "present":
      return `${base} border-emerald-500 bg-emerald-500 text-white`;
    case "late":
      return `${base} border-amber-500 bg-amber-500 text-white`;
    case "absent":
      return `${base} border-rose-500 bg-rose-500 text-white`;
    default:
      return base;
  }
}

export function AttendanceDialog({
  open,
  onOpenChange,
  classId,
  token,
  session,
  onDone,
}: AttendanceDialogProps) {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!open || !session) return;

    setLoading(true);
    teacherClassesApi
      .getRoster(classId, token)
      .then((rows) => {
        if (!alive) return;
        setRoster(rows);
        // Mặc định tất cả có mặt.
        const init: Record<string, AttendanceStatus> = {};
        for (const r of rows) init[r.id] = "present";
        setRecords(init);
      })
      .catch((err) => {
        if (!alive) return;
        toast.error(
          err instanceof Error
            ? err.message
            : "Không tải được danh sách học viên.",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, session, classId, token]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
  }

  async function handleSave() {
    if (!session) return;
    const payload: AttendanceRecord[] = roster.map((r) => ({
      student_id: r.id,
      status: records[r.id] ?? "present",
    }));
    setSaving(true);
    try {
      await teacherClassesApi.markAttendance(classId, session.id, payload, token);
      toast.success("Đã lưu điểm danh.");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không lưu được điểm danh. Vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Điểm danh{session?.title ? ` · ${session.title}` : ""}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : roster.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Lớp chưa có học viên nào để điểm danh.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {roster.map((r) => {
              const current = records[r.id] ?? "present";
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-input px-3 py-2"
                >
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  <div className="flex shrink-0 gap-1">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={statusButtonClass(
                          current === opt.value,
                          opt.value,
                        )}
                        onClick={() => setStatus(r.id, opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || roster.length === 0}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              "Lưu điểm danh"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
