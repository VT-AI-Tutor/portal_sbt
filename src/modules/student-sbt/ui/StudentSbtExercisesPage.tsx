import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Clock,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { useSbtMyExercises } from "@/modules/student-sbt/api/hooks";
import type { CompletedExercise } from "@/modules/student-sbt/api/exercisesApi";

type StatusFilter = "all" | "in_progress" | "completed";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "in_progress", label: "Đang làm" },
  { value: "completed", label: "Đã hoàn thành" },
];

// Dựng formatter MỘT lần ở module scope — tránh tạo mới Intl.DateTimeFormat mỗi
// lần render thẻ (đắt; gây giật khi gõ tìm kiếm trên danh sách nhiều thẻ).
const DATE_FMT = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_FMT.format(d);
}

const selectClass =
  "h-9 rounded-md border-2 border-border bg-card px-3 text-sm font-medium focus:outline-none focus:border-primary";

function ScoreBadge({ item }: { item: CompletedExercise }) {
  // Trạng thái tiến độ theo attempt MỚI NHẤT của bài (từ latestInProgress).
  if (item.latestInProgress) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning-foreground">
        <Clock className="size-3" /> Đang làm
      </span>
    );
  }
  if (item.submittedAt == null) return null;
  if (item.score == null) {
    // Đã nộp nhưng chưa có điểm.
    return (
      <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
        <CheckCircle2 className="size-3" /> Đã nộp
      </span>
    );
  }
  const pct =
    item.maxScore && item.maxScore > 0
      ? Math.round((item.score / item.maxScore) * 100)
      : null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
      <CheckCircle2 className="size-3" />
      {item.score}/{item.maxScore ?? "?"} {pct != null ? `(${pct}%)` : ""}
    </span>
  );
}

function CompletedCard({
  item,
  onContinue,
}: {
  item: CompletedExercise;
  onContinue: (item: CompletedExercise) => void;
}) {
  return (
    <Card className="p-5 border-2 hover:border-primary transition-all">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-primary/15 text-primary">
          <ClipboardList className="size-3" /> {item.subjectName ?? "Bài tập"}
        </span>
        <ScoreBadge item={item} />
      </div>
      <div className="font-display font-bold mt-2">{item.exerciseTitle}</div>
      <div className="text-xs text-muted-foreground mt-1">{item.bookTitle}</div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" /> {formatDate(item.lastActivityAt)}
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        {/* Chỉ 1 nút theo trạng thái attempt mới nhất của bài. */}
        {item.latestInProgress ? (
          <Button
            variant="outline"
            className="flex-1 rounded-full"
            onClick={() => onContinue(item)}
          >
            Tiếp tục làm bài
          </Button>
        ) : (
          item.bookId !== "?" &&
          item.exerciseId && (
            <Button asChild className="flex-1 rounded-full">
              {/* LCMS: route /sach-bai-tap/:bookCode/:lessonCode nhận bookId + exerciseId. */}
              <Link to={`/sach-bai-tap/${item.bookId}/${item.exerciseId}`}>
                Làm lại từ đầu
              </Link>
            </Button>
          )
        )}
      </div>
    </Card>
  );
}

/** Picker các attempt đang làm dở — đọc thẳng từ dữ liệu đã tải (exercise-list). */
function ContinueDialog({
  item,
  onClose,
}: {
  item: CompletedExercise | null;
  onClose: () => void;
}) {
  const open = !!item;
  const data = item?.inProgressAttempts ?? [];
  const canContinue = !!item && item.bookId !== "?" && !!item.exerciseId;
  const continueTo = canContinue
    ? `/sach-bai-tap/${item!.bookId}/${item!.exerciseId}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tiếp tục bài đang làm</DialogTitle>
          <DialogDescription>{item?.exerciseTitle}</DialogDescription>
        </DialogHeader>

        {data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Không có bài đang làm dở. Dùng &quot;Làm lại từ đầu&quot; để làm lại
            bài này.
          </p>
        ) : !continueTo ? (
          <p className="py-4 text-sm text-muted-foreground">
            Không mở được bài để tiếp tục.
          </p>
        ) : (
          <div className="space-y-2 py-2">
            {/* Chỉ cho tiếp tục lượt mới nhất (data đã sort mới-nhất-trước); resume
                luôn vào lượt gần nhất nên liệt kê nhiều lượt dở chỉ gây rối (row 50). */}
            {data.slice(0, 1).map((a) => (
              <Link
                key={a.attemptId}
                to={continueTo}
                onClick={onClose}
                className="flex items-center justify-between gap-2 rounded-lg border-2 p-3 hover:border-primary transition-colors no-underline"
              >
                <span className="flex items-center gap-1.5 text-sm">
                  <Clock className="size-3.5 text-muted-foreground" /> Bắt đầu{" "}
                  {formatDate(a.startedAt)}
                </span>
                <span className="text-sm font-bold text-primary">
                  Tiếp tục →
                </span>
              </Link>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StudentSbtExercisesPage() {
  const { data, isLoading, isError, error } = useSbtMyExercises();

  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [continueFor, setContinueFor] = useState<CompletedExercise | null>(
    null,
  );

  const completed = useMemo(() => {
    let items = data?.completed ?? [];
    if (subject !== "all")
      items = items.filter((i) => i.subjectCode === subject);
    if (status !== "all")
      items = items.filter(
        (i) => (i.latestInProgress ? "in_progress" : "completed") === status,
      );
    const q = query.trim().toLowerCase();
    if (q)
      items = items.filter((i) => i.exerciseTitle.toLowerCase().includes(q));
    return items;
  }, [data, subject, status, query]);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <h1 className="font-display text-3xl font-bold mb-1 flex items-center gap-2">
        <ClipboardList className="text-primary" /> Bài tập của tôi
      </h1>
      <p className="text-muted-foreground mb-5">
        Tìm, lọc, tiếp tục hoặc làm lại các bài tập của em.
      </p>

      {/* Bộ lọc: tìm kiếm + môn + trạng thái */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên bài…"
          className="h-9 max-w-xs"
        />
        <select
          className={selectClass}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="all">Tất cả môn</option>
          {(data?.subjects ?? []).map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Card className="p-8 flex items-center justify-center gap-2 border-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> Đang tải bài
          tập…
        </Card>
      ) : isError ? (
        <Card className="p-8 text-center border-2 border-dashed">
          <p className="text-destructive font-medium">
            {(error as Error)?.message ?? "Không tải được bài tập."}
          </p>
        </Card>
      ) : completed.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground border-2 border-dashed">
          Không có bài tập nào khớp bộ lọc.
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {completed.map((i) => (
            <CompletedCard
              key={i.exerciseId}
              item={i}
              onContinue={setContinueFor}
            />
          ))}
        </div>
      )}

      <ContinueDialog item={continueFor} onClose={() => setContinueFor(null)} />
    </div>
  );
}
