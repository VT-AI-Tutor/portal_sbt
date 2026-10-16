import { useEffect, useState } from "react";
import { useTeacherPapers } from "@/modules/teacher/hooks/useTeacherPaper";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/ui/select";
import { Send, Plus, Calendar, Users, ClipboardList } from "lucide-react";
import { AssignWizard } from "@/modules/teacher/ui/shared/AssignWizard";
import { Link } from "react-router-dom";
import {
  useTeacherClasses,
  useClassAssignments,
} from "@/modules/teacher/hooks/useTeacherClasses";

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "Không hạn";
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return deadline;
  return d.toLocaleDateString("vi-VN");
}

/** `status` ở đây là vòng đời của liên kết giao bài (ClassAssignmentLink),
 * KHÁC với `submission_status` từng học sinh ở trang tiến độ — chỉ có 2 giá
 * trị: "assigned" (đang mở) | "closed" (đã đóng). */
function linkStatusLabel(status: string): string {
  if (status === "closed") return "Đã đóng";
  if (status === "assigned") return "Đang mở";
  return status;
}

export function TeacherAssignPage() {
  // Phiếu THẬT của giáo viên. Trước đây khối này liệt kê phiếu mẫu từ
  // `mock-papers`: bấm "Giao" mở trình giao bài đọc phiếu thật (lúc đó rỗng),
  // nên màn hình trông như hỏng — một bên bày bảy phiếu, một bên bảo "chưa có
  // phiếu nào".
  const { data: papers = [], isLoading: papersLoading } = useTeacherPapers();
  const worksheets = papers.filter((p) => p.kind === "worksheet");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [classId, setClassId] = useState<string>("");

  const { data: classes = [], isLoading: classesLoading } = useTeacherClasses();
  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    isError: assignmentsError,
  } = useClassAssignments(classId || undefined);

  useEffect(() => {
    if (!classId && classes.length > 0) setClassId(classes[0].id);
  }, [classId, classes]);

  return (
    <>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">📤 Giao bài tập</h1>
            <p className="text-muted-foreground">
              Giao <strong>phiếu bài tập</strong> đã tạo cho các lớp em phụ
              trách.
            </p>
          </div>
          <Button
            className="btn-pop rounded-full"
            onClick={() => setWizardOpen(true)}
          >
            <Plus className="size-4 mr-1" />
            Giao bài mới
          </Button>
        </div>

        <Card className="p-5 border-2 border-primary bg-primary/5">
          <div className="flex items-start gap-3">
            <Send className="text-primary size-6 mt-1" />
            <div className="flex-1">
              <div className="font-display font-bold">
                Giao nhanh từ phiếu bài tập
              </div>
              <p className="text-sm text-muted-foreground">
                Chọn 1 phiếu (đã tạo từ{" "}
                <Link to="/teacher/exam" className="text-primary underline">
                  Tạo đề/phiếu
                </Link>
                ), lớp và thời hạn — hệ thống tự gửi thông báo cho học sinh.
              </p>
            </div>
          </div>
          {papersLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Đang tải phiếu…</p>
          ) : worksheets.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {"Chưa có phiếu bài tập nào. Vào "}
              <Link to="/teacher/exam" className="text-primary underline">
                Tạo đề/phiếu
              </Link>
              {" để tạo phiếu trước, rồi quay lại giao cho lớp."}
            </p>
          ) : (
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            {worksheets.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-card border-2 flex items-center justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="text-xs uppercase font-bold text-primary flex items-center gap-1">
                    <ClipboardList className="size-3" /> Phiếu bài tập
                  </div>
                  <div className="font-bold text-sm">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {`${p.questions.length} câu`}
                    {p.duration_minutes ? ` · ~${p.duration_minutes} phút` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setWizardOpen(true)}
                >
                  Giao
                </Button>
              </div>
            ))}
          </div>
          )}
        </Card>

        <div>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <h2 className="font-display text-xl font-bold">📋 Bài đã giao</h2>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-56 rounded-full">
                <SelectValue placeholder="Chọn lớp" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {classesLoading ? (
            <div className="text-sm text-muted-foreground">
              Đang tải danh sách lớp…
            </div>
          ) : classes.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
              Bạn chưa phụ trách lớp nào.
            </div>
          ) : assignmentsLoading ? (
            <div className="text-sm text-muted-foreground">
              Đang tải bài đã giao…
            </div>
          ) : assignmentsError ? (
            <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              Không tải được danh sách bài giao. Thử lại sau.
            </div>
          ) : assignments.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
              Chưa có bài giao nào cho lớp này.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {assignments.map((a) => (
                <Card key={a.id} className="p-4 border-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-bold">{a.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="size-3" /> {a.class_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" /> Hạn{" "}
                          {formatDeadline(a.deadline)}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        a.status === "closed"
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {linkStatusLabel(a.status)}
                    </span>
                  </div>
                  <div className="flex justify-end gap-3 text-xs mt-3">
                    {/* Lát 3: đọc kết quả lớp theo đúng bảng ma trận đã ra đề. */}
                    <Link
                      to={`/teacher/outcome/${classId}/${a.id}`}
                      className="text-primary hover:underline"
                    >
                      Đọc theo ma trận →
                    </Link>
                    <Link
                      to="/teacher/progress"
                      className="text-primary hover:underline"
                    >
                      Xem chi tiết →
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <AssignWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}
