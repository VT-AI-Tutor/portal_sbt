/**
 * Dialog "Kết quả bài nộp" + danh sách lịch sử bài đã nộp của một bài tập.
 *
 * Tách ra khỏi SubmissionRunner.tsx (vốn 1219 dòng): hai thành phần này là bề mặt
 * ĐỌC KẾT QUẢ, độc lập hoàn toàn với vòng đời làm bài, và trước đây là function
 * private nên không test đơn lẻ được.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Eye,
  History,
  Loader2,
  Share2,
  Trophy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { useAuth } from "@/core/auth/AuthContext";
import {
  getSubmission,
  getSubmissionReview,
  listHistory,
  type SubmissionDetail,
  type SubmissionReview,
  type HistoryItem,
} from "@/modules/books/api/assessmentApi";
import { SubmissionReviewQuestions } from "./SubmissionReviewQuestions";
import { ShareCompletionDialog } from "./ShareCompletionDialog";

function formatHistoryDate(iso: string | null | undefined): string {
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
    return iso ?? "—";
  }
}

export function InlineHistory({
  exerciseId,
  showHeader = true,
}: {
  exerciseId: string;
  /** Ẩn tiêu đề nội bộ khi màn ngoài đã có tiêu đề "Lịch sử làm bài" riêng. */
  showHeader?: boolean;
}) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listHistory({ limit: 10 });
        if (cancelled) return;
        const filtered = res.items.filter((i) => i.exerciseId === exerciseId);
        setItems(filtered);
      } catch {
        if (!cancelled) setError("Không thể tải lịch sử.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="text-xs">Đang tải lịch sử…</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-destructive text-center py-2">{error}</p>;
  }

  if (!items || items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-3">
        Chưa có bài nào được nộp.
      </p>
    );
  }

  return (
    <>
      <div className="w-full max-w-sm mx-auto space-y-3">
        {showHeader && (
          <p className="text-sm font-semibold text-slate-500 text-center flex items-center justify-center gap-1.5">
            <History className="size-4" />
            Lịch sử bài đã nộp
          </p>
        )}
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.submissionId}
              type="button"
              onClick={() => setSelectedSubmissionId(item.submissionId)}
              className="w-full flex items-center justify-between gap-3 rounded-2xl border-2 border-white bg-white/80 p-4 hover:shadow-lg transition-shadow text-left cursor-pointer"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  {formatHistoryDate(item.submittedAt)}
                </p>
                <div className="flex items-center gap-2">
                  {item.gradingStatus === "pending" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning">
                      <Clock className="size-3" />
                      Chờ chấm
                    </span>
                  ) : item.score !== null ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                      <CheckCircle2 className="size-3" />
                      {item.score}/{item.maxScore ?? "?"}
                      {item.maxScore && item.maxScore > 0
                        ? ` (${Math.round((item.score / item.maxScore) * 100)}%)`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <Eye className="size-3.5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
        {/* GAP-068: đường dẫn sang trang lịch sử đầy đủ (không chỉ 10 bài của bài này). */}
        <Link
          to="/lich-su-bai-tap"
          className="block text-center text-xs font-semibold text-primary hover:underline"
        >
          Xem tất cả lịch sử làm bài →
        </Link>
      </div>
      <SubmissionDetailDialog
        submissionId={selectedSubmissionId}
        exerciseTitle={
          items?.find((i) => i.submissionId === selectedSubmissionId)
            ?.exerciseTitle
        }
        open={selectedSubmissionId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSubmissionId(null);
        }}
      />
    </>
  );
}

export function SubmissionDetailDialog({
  submissionId,
  open,
  onOpenChange,
  exerciseTitle,
  shareUrl,
  reviewFallback,
  preloadedReview,
  forcePending = false,
}: {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tên bài để in lên thẻ chia sẻ (SubmissionDetail không mang title). */
  exerciseTitle?: string | null;
  /** Link công khai của bài để chia sẻ; mặc định URL hiện tại. */
  shareUrl?: string;
  /**
   * Danh sách câu để "Xem lại bài làm" khi backend KHÔNG có cửa review
   * (`getSubmissionReview` trả null trên LCMS). Runner dựng sẵn từ đề + đáp án
   * học sinh ngay sau khi nộp, nên vẫn xem lại được dù chưa có review từ server.
   */
  reviewFallback?: Pick<SubmissionReview, "questions" | "revealAnswers"> | null;
  /**
   * Review server mà runner ĐÃ lấy ngay sau khi nộp — truyền xuống để dialog
   * khỏi gọi lại đúng cửa đó lần nữa cho cùng một lượt. Bỏ trống (undefined) =
   * chưa ai hỏi, dialog tự hỏi như cũ.
   */
  preloadedReview?: SubmissionReview | null;
  /**
   * Ép "chờ chấm" bất kể `gradingStatus`: runner đã biết bài còn câu GV chấm tay,
   * tính lại ở đây thì cùng một lần nộp lại ra hai trạng thái khác nhau.
   */
  forcePending?: boolean;
}) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [review, setReview] = useState<SubmissionReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    // Đổi bài / đóng dialog thì tắt luôn màn chia sẻ — nếu không, share của bài
    // trước còn bật sẽ bung lại khi mở kết quả bài khác.
    setShareOpen(false);
    if (!open || !submissionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    setReview(null);
    // Điểm là bắt buộc; phần xem lại là BEST-EFFORT (getSubmissionReview tự nuốt
    // lỗi và trả null trên LCMS / khi BE chưa lên) — hỏng nó không được kéo theo
    // cả dialog, màn vẫn phải ra điểm như trước.
    Promise.all([
      getSubmission(submissionId),
      preloadedReview !== undefined
        ? Promise.resolve(preloadedReview)
        : getSubmissionReview(submissionId),
    ])
      .then(([d, r]) => {
        if (cancelled) return;
        setDetail(d);
        setReview(r ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Không thể tải kết quả.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, submissionId, preloadedReview]);

  // Ưu tiên review thật từ server; nếu không có (LCMS) dùng bản runner dựng sẵn.
  const effectiveReview = review ?? reviewFallback ?? null;
  const isGraded = detail?.gradingStatus === "graded" && !forcePending;
  const scorePercent =
    isGraded && detail && detail.maxScore > 0
      ? Math.round(((detail.score ?? 0) / detail.maxScore) * 100)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Rộng tới max-w-5xl cho danh sách câu xem lại, luôn chừa lề ≥16px mỗi
          bên; phần tóm tắt điểm vẫn tự bó về max-w-md bên trong. */}
      <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kết quả bài nộp</DialogTitle>
          <DialogDescription className="sr-only">
            Điểm số và chi tiết từng câu của bài đã nộp
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm">Đang tải kết quả…</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center py-4">{error}</p>
        )}

        {detail && !loading && (
          <div className="flex flex-col items-center gap-5 text-center w-full max-w-md mx-auto">
            {isGraded ? (
              <>
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Trophy className="size-7 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    Đã chấm điểm
                  </p>
                  <p className="text-4xl font-black tabular-nums text-foreground">
                    {detail.score ?? 0}
                    <span className="text-lg font-medium text-muted-foreground">
                      {" "}
                      / {detail.maxScore}
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
                <div className="size-14 rounded-2xl bg-warning/10 flex items-center justify-center">
                  <Clock className="size-7 text-warning" />
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
                <p className="text-sm text-muted-foreground font-medium">
                  Ngày nộp
                </p>
                <p className="font-semibold">
                  {formatHistoryDate(detail.submittedAt)}
                </p>
              </div>
              {isGraded && detail.gradedAt && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium">
                    Ngày chấm
                  </p>
                  <p className="font-semibold">
                    {formatHistoryDate(detail.gradedAt)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Điểm tối đa
                </p>
                <p className="font-semibold">{detail.maxScore}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Trạng thái
                </p>
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

            {detail.teacherComment && (
              <div className="w-full text-left space-y-1">
                <p className="text-sm text-muted-foreground font-medium">
                  Nhận xét của giáo viên
                </p>
                <p className="text-sm bg-muted/40 rounded-xl p-3 whitespace-pre-line">
                  {detail.teacherComment}
                </p>
              </div>
            )}

            {/* BUG-F/G: chia sẻ kết quả lần làm này ngay từ màn kết quả — vào lại
                bài / đăng nhập lại vẫn mở Lịch sử làm bài rồi Chia sẻ được. */}
            <Button
              type="button"
              variant="outline"
              className="w-full max-w-xs gap-2 rounded-full font-bold"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="size-4" />
              Chia sẻ
            </Button>
            <ShareCompletionDialog
              open={shareOpen}
              onOpenChange={setShareOpen}
              title={exerciseTitle || review?.exerciseTitle || "Bài tập"}
              studentName={user?.full_name ?? user?.name ?? null}
              submittedAt={detail.submittedAt}
              score={detail.score}
              maxScore={detail.maxScore}
              pending={!isGraded}
              shareUrl={
                shareUrl ??
                (typeof window !== "undefined" ? window.location.href : "")
              }
            />
          </div>
        )}

        {effectiveReview && !loading && !error && (
          <SubmissionReviewQuestions
            questions={effectiveReview.questions}
            revealAnswers={effectiveReview.revealAnswers}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
