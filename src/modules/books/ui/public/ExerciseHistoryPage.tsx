/**
 * ExerciseHistoryPage — Step 8: Lịch sử bài đã nộp.
 * Route: /lich-su-bai-tap  (optionally ?bookId=N)
 */
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  listHistory,
  type HistoryItem,
  type HistoryResult,
} from "@/modules/books/api/assessmentApi";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";

const PAGE_SIZE = 20;

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
    return iso ?? "—";
  }
}

function ScoreBadge({ item }: { item: HistoryItem }) {
  if (item.gradingStatus === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning">
        <Clock className="size-3" />
        Chờ chấm
      </span>
    );
  }
  if (item.score !== null) {
    const pct =
      item.maxScore && item.maxScore > 0
        ? Math.round((item.score / item.maxScore) * 100)
        : null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
        <CheckCircle2 className="size-3" />
        {item.score}/{item.maxScore ?? "?"} {pct !== null ? `(${pct}%)` : ""}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">—</span>
  );
}

function HistoryCard({ item }: { item: HistoryItem }) {
  return (
    <Card className="p-4 flex items-start justify-between gap-3 hover:shadow-md transition-shadow">
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-semibold text-sm leading-snug truncate">
          {item.exerciseTitle || "Bài tập"}
        </p>
        {item.bookTitle && (
          <p className="text-xs text-muted-foreground truncate">
            {item.bookTitle}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <ScoreBadge item={item} />
          <span className="text-xs text-muted-foreground">
            {formatDate(item.submittedAt)}
          </span>
        </div>
      </div>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="shrink-0 rounded-xl gap-1.5"
      >
        <Link to={`/ket-qua/${item.submissionId}`}>
          Xem điểm
          <ExternalLink className="size-3.5" />
        </Link>
      </Button>
    </Card>
  );
}

export function ExerciseHistoryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookId = searchParams.get("bookId")
    ? Number(searchParams.get("bookId"))
    : undefined;
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery<HistoryResult>({
    queryKey: ["exercise-history", bookId, page],
    queryFn: () => listHistory({ bookId, page, limit: PAGE_SIZE }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const totalPages = data
    ? Math.ceil(data.pagination.total / PAGE_SIZE)
    : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="space-y-1">
        {/* Vào từ trong bài (link "Xem tất cả lịch sử") thì Quay lại phải về
            bài học, không nhảy về trang chủ. Truy cập trực tiếp → fallback "/". */}
        <Button
          variant="outline"
          size="sm"
          className="mb-2"
          onClick={() =>
            window.history.length > 1 ? navigate(-1) : navigate("/")
          }
        >
          <ArrowLeft className="size-4 mr-1.5" />
          Quay lại
        </Button>
        <h1 className="text-xl font-black">Lịch sử làm bài</h1>
        <p className="text-sm text-muted-foreground">
          {bookId
            ? "Lịch sử các bài đã nộp trong sách này."
            : "Tất cả bài đã nộp của em."}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-sm">Đang tải lịch sử…</span>
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-destructive text-sm font-medium">
          {(error as Error)?.message ?? "Không thể tải lịch sử. Vui lòng thử lại."}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-semibold">Chưa có bài nào được nộp.</p>
          <p className="text-sm mt-1">
            Hãy vào một bài học và làm bài tập để xem kết quả ở đây.
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="space-y-3">
            {data.items.map((item) => (
              <HistoryCard key={item.submissionId} item={item} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
                Trang trước
              </Button>
              <span className="text-sm font-medium text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Tổng: {data.pagination.total} bài đã nộp
          </p>
        </>
      )}
    </div>
  );
}
