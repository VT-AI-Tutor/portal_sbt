import { useMemo } from "react";
import { Brain, BookOpen, CheckCircle2, Loader2, Target } from "lucide-react";
import { Card } from "@/core/ui/card";
import { getSubjectDisplay, useSubjects } from "@/core/reference";
import {
  useSbtBookExerciseTotals,
  useSbtCompetencyDashboard,
} from "@/modules/student-sbt/api/hooks";
import {
  bookProgressPercent,
  type BookProgress,
} from "@/modules/student-sbt/api/competencyApi";

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4 border-2">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}

function BookProgressRow({
  book,
  subjectLabel,
  progressPercent,
}: {
  book: BookProgress;
  subjectLabel: string | null;
  progressPercent: number | null;
}) {
  const pct = progressPercent ?? 0;
  return (
    <Card className="p-4 border-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display font-bold truncate">
            {book.bookTitle}
          </div>
          {subjectLabel && (
            <div className="text-xs text-muted-foreground">
              {subjectLabel}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-lg font-bold text-primary">
            {progressPercent != null ? `${progressPercent}%` : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {book.doneCount} bài đã làm
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  );
}

export function StudentSbtCompetencyPage() {
  const { data, isLoading, isError, error } = useSbtCompetencyDashboard();
  const { data: subjects } = useSubjects();
  const bookIds = useMemo(
    () => data?.books.map((b) => b.bookId) ?? [],
    [data],
  );
  const totalsByBook = useSbtBookExerciseTotals(bookIds);

  const subjectLabelFor = (book: BookProgress): string | null => {
    if (!book.subjectCode) return book.subjectName;
    const apiLabel = subjects?.find((s) => s.code === book.subjectCode)?.label;
    // subjectName từ LCMS có thể chỉ là slug lặp lại subjectCode — khi đó bỏ qua.
    const responseLabel =
      book.subjectName && book.subjectName !== book.subjectCode
        ? book.subjectName
        : undefined;
    return getSubjectDisplay(book.subjectCode, apiLabel ?? responseLabel).label;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <p className="text-destructive">
          {(error as Error)?.message ?? "Không tải được dữ liệu năng lực."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Brain className="text-primary" /> Năng lực của tôi
        </h1>
        <p className="text-muted-foreground">
          Tổng quan tiến độ học tập của em qua các cuốn sách bài tập.
        </p>
      </div>

      {/* Dashboard chung */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          icon={<BookOpen className="size-4" />}
          label="Số sách đang học"
          value={String(data.totalBooks)}
        />
        <SummaryCard
          icon={<Target className="size-4" />}
          label="Bài tập đã nộp"
          value={String(data.totalDone)}
        />
        <SummaryCard
          icon={<CheckCircle2 className="size-4" />}
          label="Tỉ lệ điểm"
          value={data.scorePercent != null ? `${data.scorePercent}%` : "—"}
        />
      </div>

      {/* Tiến độ hoàn thành theo sách */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="size-5 text-primary" />
          <h2 className="font-display text-xl font-bold">
            Tiến độ hoàn thành theo sách
          </h2>
        </div>

        {data.books.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground border-2 border-dashed">
            Chưa có dữ liệu. Hãy làm một vài bài tập để xem tiến độ của em ở
            đây.
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {data.books.map((b) => (
              <BookProgressRow
                key={b.bookId}
                book={b}
                subjectLabel={subjectLabelFor(b)}
                progressPercent={bookProgressPercent(
                  b,
                  totalsByBook.get(b.bookId),
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
