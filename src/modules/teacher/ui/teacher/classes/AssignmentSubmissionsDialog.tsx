/**
 * "Bài nộp" của một bài giao — danh sách học sinh, và chi tiết bài làm của một em.
 *
 * Hai khung nhìn trong CÙNG một dialog (danh sách ⇄ chi tiết) chứ không lồng hai
 * dialog: mở chồng dialog trong Radix khoá cuộn hai lớp, và giáo viên soát bài
 * chủ yếu đi tới đi lui giữa các em nên nút "Danh sách" phải rẻ.
 *
 * Phần chi tiết dùng lại nguyên `SubmissionReviewQuestions` của màn kết quả học
 * sinh: cùng một use case `ReviewSubmission` phía server, khác đúng cổng quyền.
 * Khác biệt duy nhất người dùng thấy: giáo viên LUÔN được xem đáp án, kể cả bài
 * `hide_answers` (cờ đó chỉ giấu với học sinh).
 */
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import { SubmissionReviewQuestions } from "@/modules/books/ui/shared/SubmissionReviewQuestions";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type { AssignmentProgressRow } from "@/modules/teacher/api/teacherClassesApi";
import type { SubmissionReview } from "@/core/api/assessmentTypes";

const STATUS_META: Record<string, { label: string; tone: string }> = {
  da_cham: { label: "Đã chấm", tone: "bg-success/15 text-success" },
  da_nop: { label: "Đã nộp", tone: "bg-primary/15 text-primary" },
  nop_muon: { label: "Nộp muộn", tone: "bg-warning/15 text-warning" },
  chua_lam: { label: "Chưa làm", tone: "bg-muted text-muted-foreground" },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString("vi-VN");
}

export function AssignmentSubmissionsDialog({
  open,
  onOpenChange,
  classId,
  linkId,
  title,
  token,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  classId: string;
  /** id của ClassAssignmentLink (bài giao), không phải id bài tập. */
  linkId: string | null;
  title: string;
  token: string;
}) {
  const [rows, setRows] = useState<AssignmentProgressRow[] | null>(null);
  const [listError, setListError] = useState(false);
  const [picked, setPicked] = useState<AssignmentProgressRow | null>(null);
  const [review, setReview] = useState<SubmissionReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(false);

  useEffect(() => {
    if (!open || !linkId) return;
    let cancelled = false;
    setRows(null);
    setListError(false);
    setPicked(null);
    teacherClassesApi
      .assignmentProgress(classId, linkId, token)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setListError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, classId, linkId, token]);

  useEffect(() => {
    const submissionId = picked?.submission_id;
    if (!submissionId) return;
    let cancelled = false;
    setReview(null);
    setReviewError(false);
    setReviewLoading(true);
    teacherClassesApi
      .submissionReview(submissionId, token)
      .then((r) => {
        if (!cancelled) setReview(r);
      })
      .catch(() => {
        if (!cancelled) setReviewError(true);
      })
      .finally(() => {
        if (!cancelled) setReviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [picked, token]);

  const submitted = (rows ?? []).filter((r) => r.submission_id !== null).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {picked && (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2"
                onClick={() => setPicked(null)}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Danh sách
              </Button>
            )}
            {picked ? picked.name : `Bài nộp — ${title}`}
          </DialogTitle>
          <DialogDescription>
            {picked
              ? "Bài làm của học sinh, kèm đáp án đúng."
              : `${submitted}/${rows?.length ?? 0} học sinh đã nộp`}
          </DialogDescription>
        </DialogHeader>

        {picked === null ? (
          listError ? (
            <p className="py-6 text-center text-sm text-destructive">
              Không tải được danh sách bài nộp.
            </p>
          ) : rows === null ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm">Lớp chưa có học sinh nào.</p>
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {rows.map((r) => {
                const meta = STATUS_META[r.submission_status] ?? {
                  label: r.submission_status,
                  tone: "bg-muted text-muted-foreground",
                };
                return (
                  <div key={r.user_id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.tone}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="w-16 text-right text-sm font-bold tabular-nums">
                      {r.score === null
                        ? "—"
                        : `${r.score}/${r.max_score ?? "?"}`}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={r.submission_id === null}
                      onClick={() => setPicked(r)}
                    >
                      Xem bài
                    </Button>
                  </div>
                );
              })}
            </div>
          )
        ) : reviewLoading ? (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm">Đang tải bài làm…</p>
          </div>
        ) : reviewError ? (
          <p className="py-6 text-center text-sm text-destructive">
            Không tải được bài làm của học sinh.
          </p>
        ) : review ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-xl border p-3 text-sm">
              <div>
                <p className="text-muted-foreground">Điểm</p>
                <p className="font-bold tabular-nums">
                  {review.score ?? 0} / {review.maxScore}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Ngày nộp</p>
                <p className="font-semibold">{formatDate(review.submittedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Trạng thái</p>
                <p className="font-semibold">
                  {review.gradingStatus === "graded" ? "Đã chấm" : "Chờ chấm"}
                </p>
              </div>
            </div>
            {/* Giáo viên luôn xem được đáp án — server đã quyết ở `forTeacher()`,
                nhưng ép `revealAnswers` ở đây là chốt thứ hai cho bài kiểm tra. */}
            <SubmissionReviewQuestions
              questions={review.questions}
              revealAnswers
              teacherView
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
