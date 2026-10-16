/**
 * Màn "Năng lực AI" — `/hoc-sinh/nang-luc-v2`.
 *
 * Drill-down 3 cấp trên CÙNG một trang (không nested route):
 *   1. Sách      — GET /mastery/me/books
 *   2. Chương    — GET /mastery/me/chapters  (lọc theo bookId)
 *   3. Bài học   — GET /mastery/me/overview  (lọc theo chapterId)
 *
 * Server tự lấy user từ JWT Authorization header — FE không truyền userId,
 * tránh lỗi mất precision khi id > Number.MAX_SAFE_INTEGER.
 */
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ListChecks,
  Loader2,
  Target,
} from "lucide-react";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { Progress } from "@/core/ui/progress";
import { useAuth } from "@/core/auth/AuthContext";
import {
  useBookMastery,
  useChapterMastery,
  useLessonOverview,
} from "@/modules/student-sbt/api/hooks";
import type { BookMastery } from "@/modules/student-sbt/api/masteryApi";
import { LessonRedoPopover } from "@/modules/student-sbt/ui/LessonRedoPopover";

// ---------------------------------------------------------------------------
// Helpers — view-model nhỏ, không phụ thuộc vào cách BE trả data
// ---------------------------------------------------------------------------

const pct = (rate: number) => Math.round((rate ?? 0) * 100);

/** Màu thanh tiến độ theo completion_rate (0..1). */
function progressTone(rate: number): string {
  if (rate >= 0.8) return "bg-success";
  if (rate >= 0.5) return "bg-primary";
  if (rate >= 0.25) return "bg-warning";
  return "bg-destructive";
}

/** Label confidence_level cho gọn. */
function confidenceLabel(level: string): string {
  switch (level) {
    case "high":
      return "Cao";
    case "medium":
      return "Trung bình";
    case "low":
      return "Thấp";
    default:
      return level || "—";
  }
}

/** Badge recommendation (mastered / ok / practice / redo). */
function recommendationBadge(rec: string) {
  if (rec === "mastered") {
    return (
      <Badge variant="default" className="bg-success/15 text-success border-success/30">
        <CheckCircle2 className="size-3 mr-1" /> Đã thông thạo
      </Badge>
    );
  }
  if (rec === "ok") {
    return (
      <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
        <CheckCircle2 className="size-3 mr-1" /> Tốt
      </Badge>
    );
  }
  if (rec === "practice") {
    return (
      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
        <CircleAlert className="size-3 mr-1" /> Nên luyện thêm
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning">
      <CircleAlert className="size-3 mr-1" /> Cần luyện lại
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLoader({ label }: { label: string }) {
  return (
    <Card className="p-6 border-2 flex items-center gap-2 text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-primary" /> {label}
    </Card>
  );
}

function SectionError({ message }: { message: string }) {
  return (
    <Card className="p-6 border-2 border-destructive/40 text-destructive">
      {message}
    </Card>
  );
}

function Breadcrumb({
  items,
  onJump,
}: {
  items: { label: string; onClick: () => void }[];
  onJump: () => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {last ? (
              <span className="font-bold text-foreground">{item.label}</span>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-primary hover:underline"
              >
                {item.label}
              </button>
            )}
            {!last && <ChevronRight className="size-3.5" />}
          </span>
        );
      })}
      {/* Luôn có nút "Về đầu" ở cuối breadcrumb khi đã đi sâu. */}
      {items.length > 1 && (
        <button
          type="button"
          onClick={onJump}
          className="ml-2 inline-flex items-center gap-1 text-xs font-medium hover:text-primary"
        >
          <ArrowLeft className="size-3" /> Về danh sách sách
        </button>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Level 1 — Sách
// ---------------------------------------------------------------------------

function BooksLevel({
  accessToken,
  onSelectBook,
}: {
  accessToken: string;
  onSelectBook: (bookId: string) => void;
}) {
  const { data, isLoading, isError, error } = useBookMastery(accessToken);

  const summary = useMemo(() => {
    if (!data) return { books: 0, avgCompletion: 0, masteredKc: 0, totalKc: 0 };
    const books = data.books.length;
    const totalKc = data.books.reduce((s, b) => s + b.kcTotal, 0);
    const masteredKc = data.books.reduce((s, b) => s + b.masteredCount, 0);
    const avgCompletion =
      books > 0
        ? data.books.reduce((s, b) => s + b.completionRate, 0) / books
        : 0;
    return { books, avgCompletion, masteredKc, totalKc };
  }, [data]);

  if (isLoading) return <SectionLoader label="Đang tải tiến độ sách…" />;
  if (isError || !data)
    return (
      <SectionError
        message={
          (error as Error)?.message ?? "Không tải được tiến độ sách."
        }
      />
    );

  if (data.books.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground border-2 border-dashed">
        Em chưa có dữ liệu thông thạo cho sách nào. Hãy làm một vài bài tập để
        hệ thống ghi nhận tiến độ.
      </Card>
    );
  }

  return (
    <>
      {/* Tóm tắt nhanh */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 border-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="size-4" /> Số sách
          </div>
          <div className="font-display text-2xl font-bold mt-1">
            {summary.books}
          </div>
        </Card>
        <Card className="p-4 border-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Target className="size-4" /> Kiến thức cần nắm đã thông thạo
          </div>
          <div className="font-display text-2xl font-bold mt-1">
            {summary.masteredKc}/{summary.totalKc}
          </div>
        </Card>
        <Card className="p-4 border-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Brain className="size-4" /> TB hoàn thành
          </div>
          <div className="font-display text-2xl font-bold mt-1">
            {pct(summary.avgCompletion)}%
          </div>
        </Card>
        <Card className="p-4 border-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-4" /> Sách ≥ 80%
          </div>
          <div className="font-display text-2xl font-bold mt-1">
            {data.books.filter((b) => b.completionRate >= 0.8).length}
          </div>
        </Card>
      </div>

      {/* Danh sách sách */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="size-5 text-primary" />
          <h2 className="font-display text-xl font-bold">
            Tiến độ thông thạo theo sách
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {data.books.map((b) => {
            const cp = pct(b.completionRate);
            return (
              <Card
                key={b.bookId}
                role="button"
                tabIndex={0}
                onClick={() => onSelectBook(b.bookId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectBook(b.bookId);
                  }
                }}
                className="p-4 border-2 hover:border-primary cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-bold truncate">
                      {b.bookName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {b.masteredCount}/{b.kcTotal} kiến thức cần nắm đã thông thạo ·{" "}
                      {b.touchedKcCount} đã chạm
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-lg font-bold text-primary">
                      {cp}%
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground ml-auto" />
                  </div>
                </div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressTone(
                      b.completionRate,
                    )}`}
                    style={{ width: `${cp}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Level 2 — Chương (của 1 sách)
// ---------------------------------------------------------------------------

function ChaptersLevel({
  accessToken,
  bookId,
  bookName,
  onBack,
  onSelectChapter,
}: {
  accessToken: string;
  bookId: string;
  bookName: string;
  onBack: () => void;
  onSelectChapter: (chapterId: string, chapterName: string) => void;
}) {
  const { data, isLoading, isError, error } = useChapterMastery(accessToken);

  // Lọc client-side theo bookId — backend trả ALL chương của user; FE
  // giữ nguyên cache để back/forward không tốn request mới.
  const chapters = useMemo(
    () => data?.chapters.filter((c) => c.bookId === bookId) ?? [],
    [data, bookId],
  );

  if (isLoading)
    return <SectionLoader label={`Đang tải chương của "${bookName}"…`} />;
  if (isError || !data)
    return (
      <SectionError
        message={
          (error as Error)?.message ?? "Không tải được danh sách chương."
        }
      />
    );

  if (chapters.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground border-2 border-dashed">
        Sách này chưa có dữ liệu chương nào.
        <div className="mt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4 mr-2" /> Quay lại
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack} className="rounded-full">
          <ArrowLeft className="size-4 mr-2" /> Danh sách sách
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="size-5 text-primary" />
          <h2 className="font-display text-xl font-bold">
            Chương của sách: {bookName}
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {chapters.map((c) => {
            const cp = pct(c.completionRate);
            return (
              <Card
                key={c.chapterId}
                role="button"
                tabIndex={0}
                onClick={() => onSelectChapter(c.chapterId, c.chapterName)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectChapter(c.chapterId, c.chapterName);
                  }
                }}
                className="p-4 border-2 hover:border-primary cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-bold truncate">
                      {c.chapterName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.masteredCount}/{c.kcTotal} kiến thức cần nắm đã thông thạo
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-lg font-bold text-primary">
                      {cp}%
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground ml-auto" />
                  </div>
                </div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressTone(
                      c.completionRate,
                    )}`}
                    style={{ width: `${cp}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Level 3 — Bài học (của 1 chương) + chi tiết kiến thức cần nắm
// ---------------------------------------------------------------------------

function LessonDetailCard({
  lesson,
}: {
  lesson: import("@/modules/student-sbt/api/masteryApi").LessonMastery;
}) {
  const meanPct = pct(lesson.masteryMean);
  return (
    <Card className="p-5 border-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-display font-bold">{lesson.lessonName}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {lesson.kcCount} kiến thức cần nắm · {lesson.evidenceTotal} lượt luyện · độ tin cậy{" "}
            {confidenceLabel(lesson.confidenceLevel)}
          </div>
        </div>
        {recommendationBadge(lesson.recommendation)}
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-muted/40 px-2 py-1">
          TB thông thạo:{" "}
          <span className="font-bold text-primary">{meanPct}%</span>
        </div>
        {lesson.correctRate != null ? (
          <div className="rounded-md bg-muted/40 px-2 py-1">
            Tỉ lệ đúng:{" "}
            <span className="font-bold">{pct(lesson.correctRate)}%</span>
            <span className="text-muted-foreground">
              {" "}
              ({lesson.correctCount}/{lesson.totalCount})
            </span>
          </div>
        ) : (
          <div className="rounded-md bg-muted/40 px-2 py-1 text-muted-foreground">
            Chưa có câu trả lời
          </div>
        )}
        <div className="rounded-md bg-muted/40 px-2 py-1">
          Thấp nhất:{" "}
          <span className="font-bold">{pct(lesson.masteryMin)}%</span>
        </div>
      </div>

      <div className="mt-3">
        <Progress value={meanPct} />
      </div>

      {/* Danh sách kiến thức cần nắm */}
      {lesson.kcs.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            Kiến thức cần nắm ({lesson.kcs.length})
          </div>
          <ul className="space-y-2">
            {lesson.kcs.map((kc) => {
              const k = pct(kc.mastery);
              const isWeak = kc.mastery < 0.85;
              return (
                <li
                  key={kc.kcId}
                  className="rounded-md border border-border/60 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{kc.kcName}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {kc.evidenceCount} lượt · tin cậy{" "}
                        {confidenceLabel(kc.confidenceLevel)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-base font-bold text-primary">
                        {k}%
                      </div>
                      {/* Kiến thức cần nắm yếu (mastery < 0.85) → click mở
                          popover gợi ý câu hỏi cần luyện lại. Kiến thức đã
                          ok/mastered → badge tĩnh. Data lấy từ
                          lesson.redoQuestions (nhúng sẵn trong overview) —
                          không cần gọi thêm API. Filter theo kcId để mỗi
                          kiến thức cần nắm chỉ hiện câu hỏi liên quan đến riêng nó. */}
                      <div className="mt-1">
                        {isWeak ? (
                          <LessonRedoPopover
                            lessonName={lesson.lessonName}
                            kcName={kc.kcName}
                            redoQuestions={lesson.redoQuestions.filter(
                              (q) =>
                                q.weakKcs.some((wk) => wk.kcId === kc.kcId),
                            )}
                          />
                        ) : (
                          recommendationBadge(kc.recommendation)
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progressTone(
                        kc.mastery,
                      )}`}
                      style={{ width: `${k}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

function LessonsLevel({
  accessToken,
  chapterId,
  chapterName,
  onBack,
  onSelectBook,
}: {
  accessToken: string;
  chapterId: string;
  chapterName: string;
  onBack: () => void;
  onSelectBook: () => void;
}) {
  const { data, isLoading, isError, error } = useLessonOverview(accessToken);

  // Lọc theo chapterId — overview trả ALL lesson của user.
  const lessons = useMemo(
    () => data?.lessons.filter((l) => l.chapterId === chapterId) ?? [],
    [data, chapterId],
  );

  if (isLoading)
    return <SectionLoader label={`Đang tải bài học của "${chapterName}"…`} />;
  if (isError || !data)
    return (
      <SectionError
        message={
          (error as Error)?.message ?? "Không tải được danh sách bài học."
        }
      />
    );

  if (lessons.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground border-2 border-dashed">
        Chưa có bài học nào trong chương này.
        <div className="mt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4 mr-2" /> Quay lại chương
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack} className="rounded-full">
          <ArrowLeft className="size-4 mr-2" /> Danh sách chương
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="size-5 text-primary" />
          <h2 className="font-display text-xl font-bold">
            Bài học trong chương: {chapterName}
          </h2>
        </div>
        <div className="space-y-3">
          {lessons.map((l) => (
            <LessonDetailCard key={l.lessonId} lesson={l} />
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page — ghép 3 cấp + breadcrumb + state.
// ---------------------------------------------------------------------------

type Level =
  | { kind: "books" }
  | { kind: "chapters"; bookId: string; bookName: string }
  | {
      kind: "lessons";
      bookId: string;
      bookName: string;
      chapterId: string;
      chapterName: string;
    };

export function StudentSbtMasteryAiPage() {
  const { accessToken } = useAuth();
  const [level, setLevel] = useState<Level>({ kind: "books" });

  // Cache book-mastery ở scope page (không chỉ BooksLevel) để breadcrumb có
  // bookName khi đi sâu — BooksLevel truyền lên bookId, ta lookup name.
  const { data: booksData } = useBookMastery(accessToken);
  const bookNameById = useMemo(() => {
    const m = new Map<string, BookMastery>();
    booksData?.books.forEach((b) => m.set(b.bookId, b));
    return m;
  }, [booksData]);

  if (!accessToken) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Brain className="text-primary" /> Năng lực AI
        </h1>
        <Card className="p-8 mt-4 border-2 border-dashed text-center text-muted-foreground">
          Em chưa đăng nhập. Vui lòng đăng nhập để xem năng lực AI.
        </Card>
      </div>
    );
  }

  // Tra bookName hiện tại — dùng cho breadcrumb + tiêu đề ChaptersLevel.
  // Ưu tiên: 1) state lưu khi click, 2) cache book-mastery (giữ khi navigate
  // back/forward cùng user), 3) fallback "Sách".
  const activeBookName =
    level.kind === "books"
      ? "Sách"
      : level.bookName ||
        bookNameById.get(level.bookId)?.bookName ||
        "Sách";

  // Breadcrumb items — chỉ render nhãn của các cấp đã đi qua.
  const crumbs: { label: string; onClick: () => void }[] = [
    {
      label: "Sách",
      onClick: () => setLevel({ kind: "books" }),
    },
  ];
  if (level.kind === "chapters") {
    crumbs.push({
      label: activeBookName,
      onClick: () => setLevel({ kind: "chapters", bookId: level.bookId, bookName: activeBookName }),
    });
  } else if (level.kind === "lessons") {
    crumbs.push({
      label: activeBookName,
      onClick: () =>
        setLevel({
          kind: "chapters",
          bookId: level.bookId,
          bookName: activeBookName,
        }),
    });
    crumbs.push({
      label: level.chapterName,
      onClick: () => setLevel(level),
    });
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Brain className="text-primary" /> Năng lực AI
        </h1>
        <p className="text-muted-foreground">
          Tiến độ thông thạo (mastery) của em theo từng sách, chương và bài học.
          Bấm vào sách/chương để xem chi tiết.
        </p>
      </div>

      <Breadcrumb
        items={crumbs}
        onJump={() => setLevel({ kind: "books" })}
      />

      {level.kind === "books" && (
        <BooksLevel
          accessToken={accessToken}
          onSelectBook={(bookId) => {
            const bookName = bookNameById.get(bookId)?.bookName ?? "";
            setLevel({ kind: "chapters", bookId, bookName });
          }}
        />
      )}

      {level.kind === "chapters" && (
        <ChaptersLevel
          accessToken={accessToken}
          bookId={level.bookId}
          bookName={activeBookName}
          onBack={() => setLevel({ kind: "books" })}
          onSelectChapter={(chapterId, chapterName) =>
            setLevel({
              kind: "lessons",
              bookId: level.bookId,
              bookName: activeBookName,
              chapterId,
              chapterName,
            })
          }
        />
      )}

      {level.kind === "lessons" && (
        <LessonsLevel
          accessToken={accessToken}
          chapterId={level.chapterId}
          chapterName={level.chapterName}
          onBack={() =>
            setLevel({
              kind: "chapters",
              bookId: level.bookId,
              bookName: activeBookName,
            })
          }
          onSelectBook={() => setLevel({ kind: "books" })}
        />
      )}
    </div>
  );
}
