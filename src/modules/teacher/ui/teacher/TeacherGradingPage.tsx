import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/ui/select";
import {
  useTeacherClasses,
  usePendingSubmissions,
  useSubmissionDetail,
  useGradeSubmission,
} from "@/modules/teacher/hooks/useTeacherClasses";

const STEP = 0.25;

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN");
}

/** Task 9: bước nhập điểm cho 1 câu tự luận (gradable=false) của bài đang chấm. */
type DraftRow = { points: string; comment: string };

export function TeacherGradingPage() {
  const [classId, setClassId] = useState<string>("");
  const [submissionId, setSubmissionId] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});

  const { data: classes = [], isLoading: classesLoading } = useTeacherClasses();
  const {
    data: pending = [],
    isLoading: pendingLoading,
    isError: pendingError,
  } = usePendingSubmissions(classId || undefined);
  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
  } = useSubmissionDetail(submissionId || undefined);
  const gradeMutation = useGradeSubmission();

  useEffect(() => {
    if (!classId && classes.length > 0) setClassId(classes[0].id);
  }, [classId, classes]);

  useEffect(() => {
    // Đổi lớp → bỏ chọn bài nộp đang chấm (thuộc lớp trước).
    setSubmissionId("");
  }, [classId]);

  const gradableRows = (detail?.results ?? []).filter(
    (r) => r.gradable === false,
  );

  useEffect(() => {
    if (!detail) return;
    const next: Record<string, DraftRow> = {};
    for (const r of gradableRows) {
      next[r.question_id] = {
        points: r.points != null ? String(r.points) : "",
        comment: r.comment ?? "",
      };
    }
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const selectedPending = pending.find((s) => s.id === submissionId);

  function updateDraft(questionId: string, patch: Partial<DraftRow>) {
    setDraft((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...patch },
    }));
  }

  function isValidPoints(raw: string, max: number): boolean {
    if (raw.trim() === "") return false;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > max) return false;
    return Math.abs(Math.round(n / STEP) * STEP - n) < 1e-6;
  }

  const allValid =
    gradableRows.length > 0 &&
    gradableRows.every((r) =>
      isValidPoints(draft[r.question_id]?.points ?? "", r.max_points),
    );

  function handleSubmit() {
    if (!submissionId || !allValid) return;
    const grades = gradableRows.map((r) => {
      const row = draft[r.question_id];
      const g: { question_id: string; points: number; comment?: string } = {
        question_id: r.question_id,
        points: Number(row.points),
      };
      if (row.comment.trim() !== "") g.comment = row.comment.trim();
      return g;
    });

    gradeMutation.mutate(
      { submissionId, input: { grades } },
      {
        onSuccess: () => {
          toast.success("Đã chấm bài.");
          setSubmissionId("");
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Chấm bài thất bại.",
          );
        },
      },
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">✅ Chấm bài</h1>
          <p className="text-muted-foreground">
            Chấm các câu tự luận đang chờ chấm của học sinh trong lớp.
          </p>
        </div>
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

      <div className="grid md:grid-cols-2 gap-5">
        <Card className="p-0 border-2 overflow-hidden">
          <div className="p-4 border-b-2 font-display font-bold">
            Bài chờ chấm
          </div>
          {classesLoading || pendingLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Đang tải…</div>
          ) : !classId ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Chọn lớp để xem bài chờ chấm.
            </div>
          ) : pendingError ? (
            <div className="p-4 text-sm text-destructive">
              Không tải được danh sách bài chờ chấm. Thử lại sau.
            </div>
          ) : pending.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Không có bài chờ chấm.
            </div>
          ) : (
            <div className="divide-y">
              {pending.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSubmissionId(s.id)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                    s.id === submissionId ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="font-bold text-sm">{s.exercise_title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>HS: {s.student_id}</span>
                    <span>·</span>
                    <span>Nộp: {formatSubmittedAt(s.submitted_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-0 border-2 overflow-hidden">
          <div className="p-4 border-b-2 font-display font-bold">
            {selectedPending ? selectedPending.exercise_title : "Chấm điểm"}
          </div>
          {!submissionId ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Chọn 1 bài ở danh sách bên trái để chấm.
            </div>
          ) : detailLoading ? (
            <div className="p-6 text-sm text-muted-foreground">
              Đang tải bài nộp…
            </div>
          ) : detailError || !detail ? (
            <div className="p-4 text-sm text-destructive">
              Không tải được bài nộp. Thử lại sau.
            </div>
          ) : gradableRows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Bài này không có câu tự luận cần chấm.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {gradableRows.map((r, idx) => {
                const row = draft[r.question_id] ?? { points: "", comment: "" };
                const valid = isValidPoints(row.points, r.max_points);
                return (
                  <div
                    key={r.question_id}
                    className="p-3 rounded-xl border-2 space-y-2"
                  >
                    <div className="text-sm font-bold">
                      Câu {idx + 1} · Tối đa {r.max_points} điểm
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={r.max_points}
                        step={STEP}
                        value={row.points}
                        onChange={(e) =>
                          updateDraft(r.question_id, { points: e.target.value })
                        }
                        className={`w-28 ${!valid ? "border-destructive" : ""}`}
                        placeholder="Điểm"
                      />
                      <span className="text-xs text-muted-foreground">
                        / {r.max_points} điểm (bước {STEP})
                      </span>
                    </div>
                    {!valid && row.points.trim() !== "" && (
                      <div className="text-xs text-destructive">
                        Điểm phải trong khoảng 0–{r.max_points}, bước {STEP}.
                      </div>
                    )}
                    <Textarea
                      value={row.comment}
                      onChange={(e) =>
                        updateDraft(r.question_id, { comment: e.target.value })
                      }
                      placeholder="Nhận xét (tuỳ chọn)"
                      className="text-sm"
                    />
                  </div>
                );
              })}

              <Button
                className="w-full btn-pop rounded-full"
                disabled={!allValid || gradeMutation.isPending}
                onClick={handleSubmit}
              >
                {gradeMutation.isPending ? "Đang chấm…" : "Chấm điểm"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
