import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Loader2,
  PlayCircle,
} from "lucide-react";
import {
  listLessonExercises,
  type ExerciseListItem,
} from "@/modules/books/api/assessmentApi";
import { SubmissionRunner } from "@/modules/books/ui/shared/SubmissionRunner";

export function StudentLessonPage() {
  const { lessonId } = useParams();

  const [exercises, setExercises] = useState<ExerciseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    // Keep the id as a string: LCMS lesson ids can exceed MAX_SAFE_INTEGER.
    if (!lessonId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listLessonExercises(lessonId)
      .then((items) => {
        if (!cancelled) {
          setExercises(items);
          // Auto-select if only one exercise
          if (items.length === 1) {
            setSelectedId(items[0].id);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message ?? "Kh\u00f4ng th\u1ec3 t\u1ea3i b\u00e0i t\u1eadp.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lessonId]);

  if (!lessonId) {
    return <div className="p-8">{"Thi\u1ebfu m\u00e3 b\u00e0i h\u1ecdc"}</div>;
  }

  // If an exercise is selected, show the runner
  if (selectedId) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3 cursor-pointer"
        >
          <ArrowLeft className="size-4 mr-1" /> {"Quay l\u1ea1i danh s\u00e1ch b\u00e0i t\u1eadp"}
        </button>
        <SubmissionRunner
          key={selectedId}
          exerciseId={selectedId}
          lessonId={lessonId}
          lessonTitle={`B\u00e0i h\u1ecdc ${lessonId}`}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <Link
        to="/student"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="size-4 mr-1" /> {"Quay l\u1ea1i trang ch\u1ee7"}
      </Link>

      <h1 className="font-display text-2xl font-bold mb-4 flex items-center gap-2">
        <BookOpen className="size-6 text-primary" />
        {"B\u00e0i t\u1eadp"}
      </h1>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card className="p-6 text-center border-2 border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            {"Th\u1eed l\u1ea1i"}
          </Button>
        </Card>
      ) : exercises.length === 0 ? (
        <Card className="p-6 text-center border-2">
          <p className="text-muted-foreground text-sm">
            {"Ch\u01b0a c\u00f3 b\u00e0i t\u1eadp n\u00e0o cho b\u00e0i h\u1ecdc n\u00e0y."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {exercises.map((ex) => {
            const statusLabel =
              ex.status === "in_progress"
                ? "\u0110ANG L\u00c0M"
                : ex.status === "submitted"
                  ? "\u0110\u00c3 N\u1ed8P"
                  : "CH\u01af\u0041 B\u1eaeT \u0110\u1ea6U";
            const statusColor =
              ex.status === "in_progress"
                ? "text-warning"
                : ex.status === "submitted"
                  ? "text-success"
                  : "text-muted-foreground";

            return (
              <Card
                key={ex.id}
                className="p-4 border-2 hover:border-primary transition-all hover:-translate-y-0.5 cursor-pointer"
                onClick={() => setSelectedId(ex.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs uppercase font-bold ${statusColor}`}>
                      {statusLabel}
                    </div>
                    <div className="font-display font-bold mt-0.5">
                      {ex.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3">
                      <span>{ex.totalQuestions} {"c\u00e2u h\u1ecfi"}</span>
                    </div>
                  </div>
                  <PlayCircle className="text-primary size-6 shrink-0" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
