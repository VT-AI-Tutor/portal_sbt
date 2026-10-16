/**
 * Tab "Tổng quan" của TeacherClassDetailPage (khu GV / lát 4).
 * Hiển thị bảng số vận hành (roster / buổi học / điểm danh / học liệu / bài giao)
 * + các thao tác vòng đời lớp (xuất bản, mở ghi danh, lưu trữ, huỷ, đổi trạng thái).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  CalendarDays,
  ClipboardCheck,
  BookOpen,
  FileText,
  RefreshCw,
  Rocket,
  DoorOpen,
  Archive,
  Ban,
  Loader2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import type { TabProps, OperationalSummary } from "@/modules/teacher/api/classTypes";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";

const STATUS_OPTIONS = [
  "draft",
  "scheduled",
  "published",
  "cancelled",
  "archived",
] as const;

/** Một ô số trong lưới thống kê. */
function StatCard({
  icon,
  title,
  primary,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  primary: string;
  rows: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{primary}</div>
        <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between">
              <dt>{r.label}</dt>
              <dd className="font-medium text-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function OverviewTab({ classId, token, cls, reload }: TabProps) {
  const [summary, setSummary] = useState<OperationalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // ── Trạng thái cho form "Đổi trạng thái" ──────────────────────────────────
  const [nextStatus, setNextStatus] = useState<string>(
    (cls.status as string) ?? "draft",
  );
  const [statusReason, setStatusReason] = useState("");

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await teacherClassesApi.operationalSummary(classId, token);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được số liệu.");
    } finally {
      setLoading(false);
    }
  }, [classId, token]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  /** Bọc chung 1 thao tác vòng đời: khoá nút → gọi API → toast → làm tươi. */
  const runAction = useCallback(
    async (
      label: string,
      action: () => Promise<unknown>,
    ): Promise<void> => {
      if (isBusy) return;
      setIsBusy(true);
      try {
        await action();
        toast.success(`${label} thành công.`);
        reload();
        await fetchSummary();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `${label} thất bại.`);
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, reload, fetchSummary],
  );

  const handlePublish = () =>
    runAction("Xuất bản", () => teacherClassesApi.publish(classId, token));

  const handleOpenEnrollment = () =>
    runAction("Mở ghi danh", () =>
      teacherClassesApi.openEnrollment(classId, token),
    );

  const handleArchive = () =>
    runAction("Lưu trữ", () => teacherClassesApi.archive(classId, token));

  const handleCancel = () => {
    const reason = window.prompt("Lý do huỷ?")?.trim();
    if (!reason) return;
    void runAction("Huỷ lớp", () =>
      teacherClassesApi.cancelClass(classId, reason, token),
    );
  };

  const handleChangeStatus = () =>
    runAction("Đổi trạng thái", () =>
      teacherClassesApi.changeStatus(
        classId,
        nextStatus,
        statusReason.trim() || undefined,
        token,
      ),
    );

  return (
    <div className="space-y-6">
      {/* Trạng thái hiện tại + làm tươi */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Trạng thái:</span>
        <span className="rounded-md bg-secondary px-2 py-0.5 text-sm font-medium">
          {(cls.status as string) ?? "—"}
        </span>
        {cls.publish_status ? (
          <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-medium text-muted-foreground">
            Xuất bản: {cls.publish_status}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void fetchSummary()}
          disabled={loading || isBusy}
        >
          <RefreshCw className="size-4" />
          Làm mới
        </Button>
      </div>

      {/* Lưới số liệu vận hành */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchSummary()}>
              <RefreshCw className="size-4" />
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={<Users className="size-4" />}
            title="Học viên"
            primary={String(summary.roster.active)}
            rows={[
              { label: "Đang học", value: summary.roster.active },
              { label: "Chờ chỗ", value: summary.roster.waitlisted },
              { label: "Đã rời", value: summary.roster.dropped },
              { label: "Hoàn thành", value: summary.roster.completed },
            ]}
          />
          <StatCard
            icon={<CalendarDays className="size-4" />}
            title="Buổi học"
            primary={String(summary.sessions.total)}
            rows={[
              { label: "Đã lên lịch", value: summary.sessions.scheduled },
              { label: "Đang diễn ra", value: summary.sessions.ongoing },
              { label: "Hoàn thành", value: summary.sessions.completed },
              { label: "Đã huỷ", value: summary.sessions.cancelled },
            ]}
          />
          <StatCard
            icon={<ClipboardCheck className="size-4" />}
            title="Điểm danh"
            primary={`${Math.round(summary.attendance.attendance_rate)}%`}
            rows={[
              { label: "Có mặt", value: summary.attendance.present },
              { label: "Đi muộn", value: summary.attendance.late },
              { label: "Vắng", value: summary.attendance.absent },
            ]}
          />
          <StatCard
            icon={<BookOpen className="size-4" />}
            title="Học liệu"
            primary={String(summary.materials_count)}
            rows={[{ label: "Đã đính kèm", value: summary.materials_count }]}
          />
          <StatCard
            icon={<FileText className="size-4" />}
            title="Bài giao"
            primary={String(summary.assignments_count)}
            rows={[{ label: "Đã giao", value: summary.assignments_count }]}
          />
        </div>
      ) : null}

      {/* Thao tác vòng đời */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thao tác vòng đời lớp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePublish} disabled={isBusy}>
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              Xuất bản
            </Button>
            <Button
              variant="secondary"
              onClick={handleOpenEnrollment}
              disabled={isBusy}
            >
              <DoorOpen className="size-4" />
              Mở ghi danh
            </Button>
            <Button variant="outline" onClick={handleArchive} disabled={isBusy}>
              <Archive className="size-4" />
              Lưu trữ
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isBusy}
            >
              <Ban className="size-4" />
              Huỷ lớp
            </Button>
          </div>

          {/* Đổi trạng thái tuỳ ý */}
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              disabled={isBusy}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Lý do (không bắt buộc)"
              disabled={isBusy}
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              variant="outline"
              onClick={handleChangeStatus}
              disabled={isBusy}
            >
              Đổi trạng thái
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
