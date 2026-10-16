/**
 * Tab quản lý buổi học trong TeacherClassDetailPage (GAP-132).
 * Liệt kê buổi học + thao tác: tạo/sửa/xoá/dời/huỷ/nhân bản/điểm danh.
 * Sau mỗi mutation: toast + refetch danh sách + reload() chi tiết lớp.
 */
import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Skeleton } from "@/core/ui/skeleton";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type {
  SessionSummary,
  TabProps,
} from "@/modules/teacher/api/classTypes";

import { AttendanceDialog } from "../AttendanceDialog";
import { SessionFormDialog } from "../SessionFormDialog";

/** Đổi ISO → datetime-local cho prompt gợi ý (yyyy-MM-ddTHH:mm). */
function toLocalInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(
  status?: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "secondary";
    case "cancelled":
      return "destructive";
    case "ongoing":
    case "scheduled":
      return "default";
    default:
      return "outline";
  }
}

/** Đọc datetime-local từ prompt và trả ISO; rỗng/không hợp lệ → null. */
function promptIso(message: string, defaultLocal: string): string | null {
  const raw = window.prompt(message, defaultLocal);
  if (raw === null) return null; // người dùng bấm Huỷ
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    toast.error("Thời gian không hợp lệ.");
    return null;
  }
  return d.toISOString();
}

export function SessionsTab({ classId, token, cls, reload }: TabProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SessionSummary | undefined>(undefined);

  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceSession, setAttendanceSession] =
    useState<SessionSummary | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await teacherClassesApi.getSessions(classId, token);
      setSessions(rows);
    } catch {
      toast.error("Không tải được danh sách buổi học.");
    } finally {
      setLoading(false);
    }
  }, [classId, token]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  /** Sau mọi mutation: refetch + reload chi tiết lớp. */
  const afterMutate = useCallback(async () => {
    await fetchSessions();
    reload();
  }, [fetchSessions, reload]);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(session: SessionSummary) {
    setEditing(session);
    setFormOpen(true);
  }

  function openAttendance(session: SessionSummary) {
    setAttendanceSession(session);
    setAttendanceOpen(true);
  }

  async function handleDelete(session: SessionSummary) {
    if (!window.confirm(`Xoá buổi học "${session.title}"? Không thể hoàn tác.`)) {
      return;
    }
    setBusyId(session.id);
    try {
      await teacherClassesApi.deleteSession(classId, session.id, token);
      toast.success("Đã xoá buổi học.");
      await afterMutate();
    } catch {
      toast.error("Không xoá được buổi học.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReschedule(session: SessionSummary) {
    const start = promptIso(
      "Thời gian bắt đầu mới (VD: 2026-08-01T09:00):",
      toLocalInput(session.start_at),
    );
    if (start === null) return;
    const end = promptIso(
      "Thời gian kết thúc mới (VD: 2026-08-01T10:30):",
      toLocalInput(session.end_at),
    );
    if (end === null) return;
    const reason = window.prompt("Lý do dời buổi:", "");
    if (reason === null) return;

    setBusyId(session.id);
    try {
      await teacherClassesApi.rescheduleSession(
        classId,
        session.id,
        { start_at: start, end_at: end, reason: reason.trim() },
        token,
      );
      toast.success("Đã dời buổi học.");
      await afterMutate();
    } catch {
      toast.error("Không dời được buổi học.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(session: SessionSummary) {
    const reason = window.prompt("Lý do huỷ buổi:", "");
    if (reason === null) return;

    setBusyId(session.id);
    try {
      await teacherClassesApi.cancelSession(
        classId,
        session.id,
        { reason: reason.trim() },
        token,
      );
      toast.success("Đã huỷ buổi học.");
      await afterMutate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // Buổi có ràng buộc → BE yêu cầu force. Xác nhận rồi thử lại.
      if (/force|session_cancel_needs_force/i.test(msg)) {
        if (
          window.confirm(
            "Buổi học có dữ liệu liên quan (điểm danh/bài tập). Vẫn huỷ?",
          )
        ) {
          try {
            await teacherClassesApi.cancelSession(
              classId,
              session.id,
              { reason: reason.trim(), force: true },
              token,
            );
            toast.success("Đã huỷ buổi học.");
            await afterMutate();
          } catch {
            toast.error("Không huỷ được buổi học.");
          }
        }
      } else {
        toast.error("Không huỷ được buổi học.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDuplicate(session: SessionSummary) {
    const start = promptIso(
      "Thời gian bắt đầu cho bản sao (VD: 2026-08-08T09:00):",
      toLocalInput(session.start_at),
    );
    if (start === null) return;
    const end = promptIso(
      "Thời gian kết thúc cho bản sao (VD: 2026-08-08T10:30):",
      toLocalInput(session.end_at),
    );
    if (end === null) return;

    setBusyId(session.id);
    try {
      await teacherClassesApi.duplicateSession(
        classId,
        session.id,
        { start_at: start, end_at: end },
        token,
      );
      toast.success("Đã nhân bản buổi học.");
      await afterMutate();
    } catch {
      toast.error("Không nhân bản được buổi học.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Buổi học</h3>
          <p className="text-sm text-muted-foreground">
            Quản lý lịch buổi học, điểm danh và các thao tác liên quan.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Tạo buổi
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Chưa có buổi học nào. Bấm "Tạo buổi" để thêm mới.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Tiêu đề</th>
                <th className="px-4 py-3 font-medium">Thời gian</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Điểm danh (CM/Muộn/Vắng)</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const busy = busyId === s.id;
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{s.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(s.start_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(s.status)}>
                        {s.status ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.present_count ?? 0} / {s.late_count ?? 0} /{" "}
                      {s.absent_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {busy && (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Điểm danh"
                          disabled={busy}
                          onClick={() => openAttendance(s)}
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Sửa"
                          disabled={busy}
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Dời"
                          disabled={busy}
                          onClick={() => handleReschedule(s)}
                        >
                          <CalendarClock className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Nhân bản"
                          disabled={busy}
                          onClick={() => handleDuplicate(s)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Huỷ"
                          disabled={busy}
                          onClick={() => handleCancel(s)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Xoá"
                          disabled={busy}
                          onClick={() => handleDelete(s)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <SessionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        classId={classId}
        token={token}
        initial={editing}
        defaultInstructorId={
          (cls.lead_instructor_id ??
            (cls.instructor_user_id as string | undefined)) ||
          undefined
        }
        onSaved={afterMutate}
      />

      <AttendanceDialog
        open={attendanceOpen}
        onOpenChange={setAttendanceOpen}
        classId={classId}
        token={token}
        session={attendanceSession}
        onDone={afterMutate}
      />
    </div>
  );
}
