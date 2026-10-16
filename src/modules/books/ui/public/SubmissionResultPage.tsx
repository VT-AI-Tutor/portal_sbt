/**
 * SubmissionResultPage — Step 9: Xem điểm 1 bài nộp.
 * Route: /ket-qua/:submissionId
 */
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Trophy,
} from "lucide-react";
import {
  getSubmission,
  getSubmissionReview,
} from "@/modules/books/api/assessmentApi";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { SubmissionReviewQuestions } from "@/modules/books/ui/shared/SubmissionReviewQuestions";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SubmissionResultPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => getSubmission(submissionId!),
    enabled: !!submissionId,
    staleTime: 30_000,
  });

  // Truy vấn RIÊNG, cố tình không gộp vào truy vấn điểm: phần xem lại là
  // best-effort (null trên LCMS / khi BE chưa lên) và không được kéo trang đổ.
  const { data: review } = useQuery({
    queryKey: ["submission-review", submissionId],
    queryFn: () => getSubmissionReview(submissionId!),
    enabled: !!submissionId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Đang tải kết quả…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <p className="text-sm text-destructive font-medium">
          {(error as Error)?.message ?? "Không thể tải kết quả bài nộp."}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/lich-su-bai-tap">
            <ArrowLeft className="size-4 mr-1.5" />
            Về lịch sử
          </Link>
        </Button>
      </div>
    );
  }

  const isGraded = data.gradingStatus === "graded";
  const scorePercent =
    isGraded && data.maxScore > 0
      ? Math.round(((data.score ?? 0) / data.maxScore) * 100)
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() =>
            window.history.length > 1
              ? navigate(-1)
              : navigate("/lich-su-bai-tap")
          }
        >
          <ArrowLeft className="size-4 mr-1.5" />
          Quay lại
        </Button>
        <h1 className="text-lg font-bold">Kết quả bài nộp</h1>
      </div>

      <Card className="mx-auto w-full max-w-xl p-6 flex flex-col items-center gap-6 text-center">
        {isGraded ? (
          <>
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Trophy className="size-8 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Đã chấm điểm
              </p>
              <p className="text-5xl font-black tabular-nums text-foreground">
                {data.score ?? 0}
                <span className="text-xl font-medium text-muted-foreground">
                  {" "}
                  / {data.maxScore}
                </span>
              </p>
              {scorePercent !== null && (
                <p className="text-sm text-muted-foreground">
                  Đạt {scorePercent}%
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="size-16 rounded-2xl bg-warning/10 flex items-center justify-center">
              <Clock className="size-8 text-warning" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-warning">
                Chờ chấm điểm
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Bài có câu tự luận, giáo viên sẽ chấm và cập nhật điểm sau.
              </p>
            </div>
          </>
        )}

        <div className="w-full border-t border-border/60" />

        <div className="w-full grid grid-cols-2 gap-4 text-left text-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Ngày nộp</p>
            <p className="font-semibold">{formatDate(data.submittedAt)}</p>
          </div>
          {isGraded && data.gradedAt && (
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Ngày chấm
              </p>
              <p className="font-semibold">{formatDate(data.gradedAt)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground font-medium">Điểm tối đa</p>
            <p className="font-semibold">{data.maxScore}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Trạng thái</p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                isGraded
                  ? "bg-success/15 text-success"
                  : "bg-warning/15 text-warning"
              }`}
            >
              {isGraded ? (
                <>
                  <CheckCircle2 className="size-3" /> Đã chấm
                </>
              ) : (
                <>
                  <Clock className="size-3" /> Chờ chấm
                </>
              )}
            </span>
          </div>
        </div>

        {data.teacherComment && (
          <div className="w-full text-left space-y-1">
            <p className="text-xs text-muted-foreground font-medium">
              Nhận xét của giáo viên
            </p>
            <p className="text-sm bg-muted/40 rounded-xl p-3 whitespace-pre-line">
              {data.teacherComment}
            </p>
          </div>
        )}
      </Card>

      {review && (
        <SubmissionReviewQuestions
          questions={review.questions}
          revealAnswers={review.revealAnswers}
        />
      )}

      <div className="flex justify-center">
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/lich-su-bai-tap">
            <ArrowLeft className="size-4 mr-1.5" />
            Xem tất cả lịch sử
          </Link>
        </Button>
      </div>
    </div>
  );
}
