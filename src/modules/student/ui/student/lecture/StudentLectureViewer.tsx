/**
 * Mở MỘT bài giảng đã phát cho lớp của học sinh — đọc nội dung + slide +
 * quiz nhúng, nộp quiz TỪNG PHẦN (mỗi hoạt động một nút "Nộp phần này").
 *
 * Entry point cho `/student/lectures/:linkId`. Tự tải dữ liệu qua
 * `studentLectureApi.show` (khuôn `StudentAssignmentsPage.tsx`: useEffect +
 * useState, không cần TanStack Query cho một lần tải).
 *
 * Nhúng `QuestionPlayer` THEO hợp đồng parent-owned của `PracticeRunner.tsx`:
 * cha giữ `answers`, truyền `answer`/`onAnswerChange`, và CHỈ khi máy chủ đã
 * chấm mới truyền `submitted=true` + `gradeMode="parent"` + `result` (verdict
 * đổ từ `SectionResult` của máy chủ) — KHÔNG tự chấm ở đây, KHÔNG truyền
 * `revealCorrect` (giữ mặc định `false`, an toàn lộ đáp án).
 *
 * Câu hỏi trong `section.questions` là snapshot ĐÃ BỊ máy chủ gỡ đáp án
 * (`{id,type,content,options,payload}`) — đưa qua `mapBackendQuestion` trước
 * khi vào player, không tự ghép payload (payload rút gọn không chở đề bài).
 *
 * C1 (review cuối) — hoạt động ĐÃ NỘP mang theo `section.progress` từ máy chủ
 * (`show()`). Khởi tạo trạng thái kết quả của quiz TỪ đó thay vì luôn bắt đầu
 * rỗng: tải lại trang phải hiện lại điểm NGAY và ẩn nút "Nộp phần này" — nộp
 * lại (đặc biệt khi chưa chọn đáp án nào, rất tự nhiên khi màn hình lỡ hiện
 * "chưa nộp") sẽ bị máy chủ ghi đè điểm cũ, có khi bằng 0.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/lib/utils";
import { useAccessToken } from "@/core/auth/AuthContext";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { QuestionPlayer } from "@/core/exercise/QuestionPlayer";
import { mapBackendQuestion } from "@/modules/books/ui/shared/mapBackendQuestion";
import type { StudentQuestion } from "@/modules/books/api/assessmentApi";
import { studentLectureApi } from "@/modules/student/api/studentLectureApi";
import type {
  LectureBlock,
  LectureSectionKey,
  SectionProgress,
  SectionResult,
  StudentLectureView,
} from "@/modules/teacher/api/teacherLectureApi";
import { SlideViewer } from "./SlideViewer";

type SubmitVerdict = "correct" | "incorrect" | "incomplete";
type SubmitOutcome = { score: number; max_score: number; results: SectionResult[] };

function renderBlock(block: LectureBlock, index: number) {
  if (block.type === "heading") {
    return (
      <h3 key={index} className="font-display text-lg font-bold">
        <RichTextValue value={block.content} />
      </h3>
    );
  }
  return (
    <Card
      key={index}
      className={cn("p-3 border", block.type === "example" && "bg-muted")}
    >
      <RichTextValue value={block.content} as="p" />
    </Card>
  );
}

function verdictFor(result: SectionResult): SubmitVerdict {
  if (result.gradable === false) return "incomplete";
  return result.is_correct === true ? "correct" : "incorrect";
}

/** Quiz của MỘT hoạt động — giữ `answers` (parent-owned) và gọi
 * `submitSection` khi bấm "Nộp phần này". Không render gì khi hoạt động
 * không có câu hỏi (không phải hoạt động nào cũng có quiz). */
function LectureSectionQuiz({
  linkId,
  token,
  sectionKey,
  questions,
  progress,
}: {
  linkId: string;
  token: string;
  sectionKey: LectureSectionKey;
  questions: unknown[];
  progress: SectionProgress | null;
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // C1 — nạp kết quả TỪ progress máy chủ trả sẵn (đã nộp trước đó), không
  // luôn bắt đầu rỗng.
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(() =>
    progress
      ? {
          score: progress.score,
          max_score: progress.max_score,
          results: progress.results,
        }
      : null,
  );

  if (questions.length === 0) return null;

  const resultByQuestion: Record<string, SubmitVerdict> = {};
  if (outcome) {
    for (const r of outcome.results) resultByQuestion[r.question_id] = verdictFor(r);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await studentLectureApi.submitSection(
        linkId,
        sectionKey,
        answers,
        token,
      );
      setOutcome(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không nộp được phần này.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="font-display text-base font-bold">Câu hỏi</h4>
      {questions.map((raw, i) => {
        const q = raw as StudentQuestion;
        return (
          <div key={q.id} className="rounded-xl border-2 p-4">
            <QuestionPlayer
              question={mapBackendQuestion(q)}
              index={i}
              answer={answers[q.id]}
              onAnswerChange={(a) =>
                setAnswers((prev) => ({ ...prev, [q.id]: a }))
              }
              submitted={!!outcome}
              gradeMode="parent"
              result={outcome ? resultByQuestion[q.id] : undefined}
            />
          </div>
        );
      })}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {outcome ? (
        <p className="font-bold text-success">
          Điểm: {outcome.score}/{outcome.max_score}
        </p>
      ) : (
        <Button
          type="button"
          className="rounded-full gap-1.5"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Nộp phần này
        </Button>
      )}
    </div>
  );
}

export function StudentLectureViewer() {
  const { linkId } = useParams<{ linkId: string }>();
  const token = useAccessToken();
  const [data, setData] = useState<StudentLectureView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!linkId || !token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    studentLectureApi
      .show(linkId, token)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Không tải được bài giảng.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkId, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-2">
        <AlertTriangle className="size-10 text-destructive mx-auto" />
        <p className="text-destructive">
          {error ?? "Không tìm thấy bài giảng."}
        </p>
        <Link to="/student/lectures" className="text-primary hover:underline">
          ← Quay lại danh sách bài giảng
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <div>
        <Link
          to="/student/lectures"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Quay lại danh sách bài giảng
        </Link>
        <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
          {data.title}
        </h1>
        {data.subject && (
          <p className="text-muted-foreground">{data.subject}</p>
        )}
      </div>

      {data.sections.map((section) => (
        <Card key={section.key} className="p-5 border-2 space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold">{section.title}</h2>
            {section.objective && (
              <p className="text-sm text-muted-foreground">
                {section.objective}
              </p>
            )}
          </div>

          {section.blocks.length > 0 && (
            <div className="space-y-2">
              {section.blocks.map((b, i) => renderBlock(b, i))}
            </div>
          )}

          <SlideViewer slides={section.slides} />

          {token && (
            <LectureSectionQuiz
              linkId={linkId!}
              token={token}
              sectionKey={section.key}
              questions={section.questions}
              progress={section.progress}
            />
          )}
        </Card>
      ))}
    </div>
  );
}
