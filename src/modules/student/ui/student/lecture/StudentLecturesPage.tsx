/**
 * Danh sách bài giảng số đã được giáo viên phát cho lớp của học sinh —
 * `/student/lectures`. Khuôn chép từ `StudentAssignmentsPage.tsx`: useEffect
 * + useState tải một lần, không cần TanStack Query.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Loader2, Presentation } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { useAccessToken } from "@/core/auth/AuthContext";
import { studentLectureApi } from "@/modules/student/api/studentLectureApi";
import type { StudentLectureListRow } from "@/modules/teacher/api/teacherLectureApi";

function LectureCard({ l }: { l: StudentLectureListRow }) {
  const { submitted_sections, total_quiz_sections } = l.progress;
  return (
    <Card className="p-5 border-2 hover:border-primary transition-all">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-primary/15 text-primary">
          <Presentation className="size-3" /> Bài giảng
        </span>
      </div>
      <div className="font-display font-bold mt-2">{l.title}</div>
      <div className="text-xs text-muted-foreground mt-1">{l.subject}</div>
      {total_quiz_sections > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          Đã nộp {submitted_sections}/{total_quiz_sections} phần quiz
        </div>
      )}
      <Link to={`/student/lectures/${l.link_id}`} className="block mt-4">
        <Button className="btn-pop w-full rounded-full">Xem bài giảng →</Button>
      </Link>
    </Card>
  );
}

function EmptyLectures() {
  return (
    <Card className="p-8 text-center text-muted-foreground border-2 border-dashed space-y-2">
      <p className="font-medium text-foreground">Chưa có bài giảng nào.</p>
      <p>
        Khi giáo viên phát bài giảng cho lớp của em, bài sẽ hiện ở đây.
      </p>
    </Card>
  );
}

export function StudentLecturesPage() {
  const token = useAccessToken();
  const [items, setItems] = useState<StudentLectureListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    studentLectureApi
      .list(token)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Không tải được danh sách bài giảng.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const list = items ?? [];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <h1 className="font-display text-3xl font-bold mb-1 flex items-center gap-2">
        <BookOpen className="size-7 text-primary" /> Bài giảng
      </h1>
      <p className="text-muted-foreground mb-5">
        Bài giảng số giáo viên đã phát cho lớp em
      </p>

      {loading ? (
        <Card className="p-8 flex items-center justify-center gap-2 border-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> Đang tải bài
          giảng…
        </Card>
      ) : error ? (
        <Card className="p-8 text-center border-2 border-dashed">
          <p className="text-destructive font-medium">{error}</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Thử lại
          </Button>
        </Card>
      ) : list.length === 0 ? (
        <EmptyLectures />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {list.map((l) => (
            <LectureCard key={l.link_id} l={l} />
          ))}
        </div>
      )}
    </div>
  );
}
