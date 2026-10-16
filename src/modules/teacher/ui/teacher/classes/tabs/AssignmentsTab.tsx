/**
 * AssignmentsTab — danh sách bài giao của lớp + đóng/gỡ (GAP-132 teacher stack).
 * Giao bài mới thực hiện ở trang Giao bài; tab này chỉ quản lý bài đã giao.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Eye, Lock, Trash2 } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type { TabProps, AssignmentRow } from "@/modules/teacher/api/classTypes";
import { AssignmentSubmissionsDialog } from "../AssignmentSubmissionsDialog";

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "—";
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return deadline;
  return d.toLocaleString("vi-VN");
}

export function AssignmentsTab({ classId, token, reload }: TabProps) {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [viewing, setViewing] = useState<AssignmentRow | null>(null);

  async function refetch() {
    setLoading(true);
    try {
      const data = await teacherClassesApi.listAssignments(classId, token);
      setRows(data as AssignmentRow[]);
    } catch {
      toast.error("Không thực hiện được thao tác với bài tập.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, token]);

  async function handleClose(row: AssignmentRow) {
    setIsBusy(true);
    try {
      await teacherClassesApi.closeAssignment(classId, row.id, token);
      toast.success("Đã đóng bài giao.");
      await refetch();
      reload();
    } catch {
      toast.error("Không thực hiện được thao tác với bài tập.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUnassign(row: AssignmentRow) {
    if (!window.confirm(`Gỡ bài giao "${row.title}" khỏi lớp?`)) return;
    setIsBusy(true);
    try {
      await teacherClassesApi.unassign(classId, row.id, token);
      toast.success("Đã gỡ bài giao.");
      await refetch();
      reload();
    } catch {
      toast.error("Không thực hiện được thao tác với bài tập.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Giao bài mới thực hiện ở trang Giao bài.
      </p>

      <Card className="p-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <ClipboardList className="h-8 w-8" />
            <p className="text-sm">Lớp chưa có bài giao.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Tiêu đề</th>
                  <th className="px-2 py-2 font-medium">Hạn nộp</th>
                  <th className="px-2 py-2 font-medium">Trạng thái</th>
                  <th className="px-2 py-2 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-2 py-2">{row.title}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {formatDeadline(row.deadline)}
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewing(row)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          Bài nộp
                        </Button>
                        {row.status !== "closed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClose(row)}
                            disabled={isBusy}
                          >
                            <Lock className="mr-1 h-4 w-4" />
                            Đóng
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassign(row)}
                          disabled={isBusy}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Gỡ
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AssignmentSubmissionsDialog
        open={viewing !== null}
        onOpenChange={(o) => !o && setViewing(null)}
        classId={classId}
        linkId={viewing?.id ?? null}
        title={viewing?.title ?? ""}
        token={token}
      />
    </div>
  );
}
