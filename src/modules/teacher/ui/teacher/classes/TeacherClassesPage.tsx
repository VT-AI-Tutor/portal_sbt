/**
 * Trang quản lý lớp học của giáo viên (GAP-132).
 * Danh sách lớp + tạo/sửa/xoá + xuất bản/lưu trữ nhanh.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Skeleton } from "@/core/ui/skeleton";
import { useAccessToken } from "@/core/auth/AuthContext";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type { ClassSummary } from "@/modules/teacher/api/classTypes";

import { ClassFormDialog } from "./ClassFormDialog";

function publishBadgeVariant(status?: string) {
  if (status === "published") return "default" as const;
  if (status === "unpublished") return "secondary" as const;
  return "outline" as const;
}

export function TeacherClassesPage() {
  const token = useAccessToken();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassSummary | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await teacherClassesApi.listClassSummaries(token);
      setClasses(rows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tải được danh sách lớp. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(cls: ClassSummary) {
    setEditing(cls);
    setDialogOpen(true);
  }

  async function handleDelete(cls: ClassSummary) {
    if (!token) return;
    if (!window.confirm(`Xoá lớp "${cls.name}"? Thao tác không thể hoàn tác.`)) {
      return;
    }
    setBusyId(cls.id);
    try {
      await teacherClassesApi.deleteClass(cls.id, token);
      toast.success("Đã xoá lớp.");
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không xoá được lớp.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handlePublish(cls: ClassSummary) {
    if (!token) return;
    setBusyId(cls.id);
    try {
      await teacherClassesApi.publish(cls.id, token);
      toast.success("Đã xuất bản lớp.");
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không xuất bản được lớp.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(cls: ClassSummary) {
    if (!token) return;
    setBusyId(cls.id);
    try {
      await teacherClassesApi.archive(cls.id, token);
      toast.success("Đã lưu trữ lớp.");
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không lưu trữ được lớp.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Lớp học</h1>
        {token ? (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo lớp
          </Button>
        ) : null}
      </div>

      {!token ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Bạn cần đăng nhập để quản lý lớp học.
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card className="space-y-3 p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Thử lại
          </Button>
        </Card>
      ) : classes.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Chưa có lớp nào.
        </Card>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => {
            const busy = busyId === cls.id;
            return (
              <Card key={cls.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Link
                      to={`/teacher/classes/${cls.id}`}
                      className="text-base font-semibold text-primary hover:underline"
                    >
                      {cls.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{cls.code}</span>
                      {cls.status ? (
                        <Badge variant="outline">{cls.status}</Badge>
                      ) : null}
                      <Badge variant={publishBadgeVariant(cls.publish_status)}>
                        {cls.publish_status ?? "draft"}
                      </Badge>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {cls.roster_count ?? 0}
                        {cls.capacity ? `/${cls.capacity}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(cls)}
                      disabled={busy}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Sửa
                    </Button>
                    {cls.publish_status !== "published" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handlePublish(cls)}
                        disabled={busy}
                      >
                        <Upload className="mr-1.5 h-3.5 w-3.5" />
                        Xuất bản
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleArchive(cls)}
                        disabled={busy}
                      >
                        <Archive className="mr-1.5 h-3.5 w-3.5" />
                        Lưu trữ
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => void handleDelete(cls)}
                      disabled={busy}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Xoá
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {token ? (
        <ClassFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          token={token}
          initial={editing ?? undefined}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}
