/**
 * RosterTab — quản lý danh sách học viên của lớp (GAP-132 / teacher stack).
 * Ba khối: HỌC VIÊN, GHI DANH CHỜ DUYỆT, MÃ THAM GIA LỚP.
 * Fetch cục bộ (useEffect) rồi refetch sau mỗi thao tác + gọi reload() để làm tươi chi tiết lớp.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Trash2,
  UserCheck,
  UserX,
  KeyRound,
  RefreshCw,
  Power,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Badge } from "@/core/ui/badge";
import { Skeleton } from "@/core/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/core/ui/table";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type {
  TabProps,
  RosterRow,
  PendingEnrollment,
  JoinCodeInfo,
} from "@/modules/teacher/api/classTypes";

const STATUS_LABEL: Record<RosterRow["status"], string> = {
  active: "Đang học",
  waitlisted: "Chờ chỗ",
  completed: "Hoàn thành",
  dropped: "Đã rời",
};

const STATUS_VARIANT: Record<
  RosterRow["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  waitlisted: "secondary",
  completed: "outline",
  dropped: "destructive",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("vi-VN");
}

export function RosterTab({ classId, token, reload }: TabProps) {
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [pending, setPending] = useState<PendingEnrollment[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [newLearnerId, setNewLearnerId] = useState("");
  const [joinCode, setJoinCode] = useState<JoinCodeInfo | null>(null);

  const fetchRoster = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const rows = await teacherClassesApi.getRoster(classId, token);
      setRoster(rows);
    } catch (err) {
      toast.error("Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setLoadingRoster(false);
    }
  }, [classId, token]);

  const fetchPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const rows = await teacherClassesApi.pendingEnrollments(classId, token);
      setPending(rows);
    } catch (err) {
      toast.error("Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setLoadingPending(false);
    }
  }, [classId, token]);

  useEffect(() => {
    void fetchRoster();
    void fetchPending();
  }, [fetchRoster, fetchPending]);

  // ── HỌC VIÊN ────────────────────────────────────────────────────────────
  async function handleAddLearner() {
    const learnerId = newLearnerId.trim();
    if (!learnerId) {
      toast.error("Nhập mã học viên (learner_user_id).");
      return;
    }
    setIsBusy(true);
    try {
      await teacherClassesApi.addLearner(classId, learnerId, token);
      toast.success("Đã thêm học viên.");
      setNewLearnerId("");
      await fetchRoster();
      reload();
    } catch (err) {
      toast.error("Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemoveLearner(row: RosterRow) {
    if (!window.confirm(`Xoá học viên "${row.name}" khỏi lớp?`)) return;
    const reasonInput = window.prompt("Lý do xoá (không bắt buộc):") ?? "";
    const reason = reasonInput.trim() || undefined;
    setIsBusy(true);
    try {
      await teacherClassesApi.removeLearner(classId, row.id, reason, token);
      toast.success("Đã xoá học viên.");
      await fetchRoster();
      reload();
    } catch (err) {
      toast.error("Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setIsBusy(false);
    }
  }

  // ── GHI DANH CHỜ DUYỆT ──────────────────────────────────────────────────
  async function handleApprove(e: PendingEnrollment) {
    setIsBusy(true);
    try {
      await teacherClassesApi.approveEnrollment(classId, e.enrollment_id, token);
      toast.success("Đã duyệt ghi danh.");
      await Promise.all([fetchRoster(), fetchPending()]);
      reload();
    } catch (err) {
      toast.error("Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReject(e: PendingEnrollment) {
    const reasonInput = window.prompt("Lý do từ chối (không bắt buộc):") ?? "";
    const reason = reasonInput.trim() || undefined;
    setIsBusy(true);
    try {
      await teacherClassesApi.rejectEnrollment(
        classId,
        e.enrollment_id,
        reason,
        token,
      );
      toast.success("Đã từ chối ghi danh.");
      await Promise.all([fetchRoster(), fetchPending()]);
      reload();
    } catch (err) {
      toast.error("Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setIsBusy(false);
    }
  }

  // ── MÃ THAM GIA LỚP ─────────────────────────────────────────────────────
  async function handleRegenerateCode() {
    setIsBusy(true);
    try {
      const info = await teacherClassesApi.regenerateJoinCode(classId, token);
      setJoinCode(info);
      toast.success(`Đã tạo mã mới: ${info.join_code}`);
    } catch (err) {
      toast.error("Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleCode() {
    const nextEnabled = !(joinCode?.join_via_code_enabled ?? false);
    setIsBusy(true);
    try {
      const info = await teacherClassesApi.toggleJoinCode(
        classId,
        nextEnabled,
        token,
      );
      setJoinCode(info);
      toast.success(
        info.join_via_code_enabled
          ? "Đã bật nhận học viên qua mã."
          : "Đã tắt nhận học viên qua mã.",
      );
    } catch (err) {
      toast.error("Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1) HỌC VIÊN */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Học viên
          </CardTitle>
          <CardDescription>
            Danh sách học viên trong lớp và tiến độ học tập.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium" htmlFor="add-learner-id">
                Thêm học viên (mã học viên)
              </label>
              <Input
                id="add-learner-id"
                value={newLearnerId}
                onChange={(ev) => setNewLearnerId(ev.target.value)}
                placeholder="learner_user_id"
                disabled={isBusy}
              />
            </div>
            <Button onClick={handleAddLearner} disabled={isBusy}>
              <UserPlus className="mr-2 h-4 w-4" /> Thêm
            </Button>
          </div>

          {loadingRoster ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có học viên.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Học viên</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Tiến độ</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {Math.round(row.progress ?? 0)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLearner(row)}
                        disabled={isBusy}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Xoá
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 2) GHI DANH CHỜ DUYỆT */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" /> Ghi danh chờ duyệt
          </CardTitle>
          <CardDescription>
            Yêu cầu tham gia lớp đang chờ giáo viên xét duyệt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có ghi danh chờ.
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.map((e) => (
                <li
                  key={e.enrollment_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{e.learner_user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Gửi lúc: {formatDate(e.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(e)}
                      disabled={isBusy}
                    >
                      <UserCheck className="mr-1 h-4 w-4" /> Duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(e)}
                      disabled={isBusy}
                    >
                      <UserX className="mr-1 h-4 w-4" /> Từ chối
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 3) MÃ THAM GIA LỚP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Mã tham gia lớp
          </CardTitle>
          <CardDescription>
            Mã hiện tại chỉ hiện sau khi tạo lại.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {joinCode ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Mã hiện tại</p>
              <p className="font-mono text-3xl font-bold tracking-widest">
                {joinCode.join_code}
              </p>
              <p className="text-sm">
                Trạng thái nhận mã:{" "}
                <Badge
                  variant={
                    joinCode.join_via_code_enabled ? "default" : "secondary"
                  }
                >
                  {joinCode.join_via_code_enabled ? "Đang bật" : "Đang tắt"}
                </Badge>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Chưa có mã để hiển thị. Nhấn "Tạo lại mã" để sinh mã mới.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRegenerateCode} disabled={isBusy}>
              <RefreshCw className="mr-2 h-4 w-4" /> Tạo lại mã
            </Button>
            <Button
              variant="outline"
              onClick={handleToggleCode}
              disabled={isBusy}
            >
              <Power className="mr-2 h-4 w-4" />
              {joinCode?.join_via_code_enabled ? "Tắt nhận mã" : "Bật nhận mã"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
