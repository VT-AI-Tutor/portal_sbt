/**
 * "Chi tiết bài làm" — cuộn qua TẤT CẢ câu của một bài đã nộp, mỗi câu render
 * bằng chính player của nó ở trạng thái đã chấm: bài làm của em + đúng/sai +
 * ĐÁP ÁN ĐÚNG (player tự tô khi `revealCorrect`).
 *
 * KHÔNG có khối "Hướng dẫn giải": luật Owner 2026-08-01 — "lời giải" ở màn này
 * CHỈ là đáp án đúng. Server cũng đã lột `explanation`/`solution` khỏi payload,
 * nên đây là lớp bảo vệ thứ hai chứ không phải lớp duy nhất.
 *
 * Chỉ-đọc bằng WRAPPER (`pointer-events-none` + `aria-disabled`) chứ không thêm
 * prop vào PlayerProps — cùng lý do đã ghi ở SessionReviewQuestions: 60+ player
 * dùng chung interface đó và mọi thay đổi ở `src/core/exercise/players/*` đều
 * phát sinh nợ đồng bộ sang evo-books-studio-web.
 *
 * Verdict ở đầu thẻ là của CẢ CÂU. Với `question_group`, server chấm cả nhóm —
 * không có tick từng câu con, và đó là đúng hợp đồng, đừng "sửa".
 */
import { CheckCircle2, MinusCircle, Paperclip, XCircle } from "lucide-react";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/lib/utils";
import { QuestionPlayer } from "@/core/exercise/QuestionPlayer";
import type { SubmissionReviewQuestion } from "@/modules/books/api/assessmentApi";
import { mapBackendQuestion } from "./mapBackendQuestion";
import { isAnswerEmpty, needsManualGrading } from "@/core/exercise/grading";
import { resolveNestedQuestions } from "@/core/question-schema/nested-children";

type Verdict = "correct" | "incorrect" | "incomplete" | "unanswered";

/**
 * Câu BỎ TRỐNG được tách khỏi "sai": server vẫn chấm nó `gradable: true,
 * is_correct: false`, nhưng gắn dấu X đỏ cho câu học sinh chưa từng trả lời là
 * đọc sai chuyện. Vẫn hiện đáp án đúng và vẫn hiện 0 điểm của server.
 */
function verdictOf(q: SubmissionReviewQuestion): Verdict {
  if (!q.gradable) return "incomplete";
  if (isAnswerEmpty(q.studentAnswer)) return "unanswered";
  return q.isCorrect ? "correct" : "incorrect";
}

const VERDICT_META: Record<
  Verdict,
  { Icon: typeof CheckCircle2; tone: string; note?: string }
> = {
  correct: { Icon: CheckCircle2, tone: "text-success" },
  incorrect: { Icon: XCircle, tone: "text-destructive" },
  incomplete: {
    Icon: MinusCircle,
    tone: "text-muted-foreground",
    note: "Chờ chấm",
  },
  unanswered: {
    Icon: MinusCircle,
    tone: "text-muted-foreground",
    note: "Chưa trả lời",
  },
};

type Schema = Record<string, unknown>;

function isWritingLeaf(type: string, schema: Schema): boolean {
  if (type === "essay" || type === "drawing" || type === "free_draw") return true;
  const display = schema.display as { interactionType?: unknown } | undefined;
  return type === "fill_blank" && display?.interactionType === "short_text";
}

// Câu con có thể chỉ mang `question_type` — dispatch (adaptChild) đọc cả hai.
const childType = (c: Schema) => String(c.type ?? c.question_type ?? "");

function nestedChildren(schema: Schema): Schema[] {
  const anchors = (schema.anchors as Array<{ question?: Schema }> | undefined) ?? [];
  return [
    ...((resolveNestedQuestions(schema)?.list as Schema[] | undefined) ?? []),
    ...(schema.child ? [schema.child as Schema] : []),
    ...anchors.flatMap((a) => (a?.question ? [a.question] : [])),
  ].filter((c) => c && typeof c === "object");
}

/**
 * Câu tự viết / tự vẽ không có đáp án (SBT-61): học sinh thấy "Đã ghi nhận" —
 * khớp dòng "Hệ thống đã ghi nhận" trong câu. Câu nhóm: đúng khi mọi câu con
 * máy không chấm được đều là câu viết/vẽ (có upload, nói… thì vẫn "Chờ chấm").
 */
export function isRecordOnlyWriting(type: string, schema: Schema | null | undefined): boolean {
  const s = schema ?? {};
  if (isWritingLeaf(type, s)) return true;
  const pending = nestedChildren(s).filter((c) => {
    const t = childType(c);
    return isWritingLeaf(t, c) || needsManualGrading(t, c);
  });
  return pending.length > 0 && pending.every((c) => isRecordOnlyWriting(childType(c), c));
}

export function SubmissionReviewQuestions({
  questions,
  revealAnswers,
  teacherView = false,
}: {
  questions: SubmissionReviewQuestion[];
  revealAnswers: boolean;
  /** Màn giáo viên xem bài nộp — giữ nhãn "Chờ chấm" cho câu tự viết. */
  teacherView?: boolean;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="w-full space-y-4 text-left">
      <h3 className="font-bold">Chi tiết bài làm</h3>
      {questions.map((q, index) => {
        const verdict = verdictOf(q);
        const { Icon, tone, note: verdictNote } = VERDICT_META[verdict];
        // verdictOf trả "incomplete" cho mọi câu !gradable kể cả khi bỏ trống, nên
        // câu viết/vẽ phải tự xét rỗng — bỏ trống thì không "ghi nhận" gì.
        const writingNote =
          verdict === "incomplete" && !teacherView && isRecordOnlyWriting(q.type, q.payload)
            ? isAnswerEmpty(q.studentAnswer)
              ? VERDICT_META.unanswered.note
              : "Đã ghi nhận"
            : undefined;
        const note = writingNote ?? verdictNote;

        return (
          <Card key={q.id} className="p-4 border-2 space-y-3">
            <div className="flex items-center gap-2">
              <Icon className={cn("size-4 shrink-0", tone)} />
              {/* Đánh số CẢ BÀI, trong khi runner đánh số theo mạch (ĐỌC,
                  VIẾT…): màn này còn dùng ở chỗ không có lesson_items. */}
              <span className="text-xs font-bold text-muted-foreground">
                Câu {(q.order ?? index) + 1}
              </span>
              {note ? (
                <span className="text-xs font-semibold text-muted-foreground ml-auto">
                  {note}
                </span>
              ) : (
                <span className="text-xs font-semibold text-muted-foreground ml-auto tabular-nums">
                  {q.points}/{q.maxPoints}
                </span>
              )}
            </div>

            <div
              data-testid={`review-question-${q.id}`}
              aria-disabled="true"
              className="pointer-events-none select-none"
            >
              <QuestionPlayer
                key={q.id}
                question={mapBackendQuestion(q)}
                index={q.order ?? index}
                answer={q.studentAnswer}
                submitted
                gradeMode="parent"
                // "unanswered" không phải verdict của player — bỏ trống là "chưa
                // hoàn thành", không phải "làm sai".
                result={verdict === "unanswered" ? "incomplete" : verdict}
                revealCorrect={revealAnswers}
              />
            </div>

            {q.fileCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip className="size-3.5" />
                Đã nộp {q.fileCount} tệp đính kèm
              </p>
            )}

            {q.teacherComment && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Nhận xét của giáo viên
                </p>
                <p className="text-sm bg-muted/40 rounded-xl p-3 whitespace-pre-line">
                  {q.teacherComment}
                </p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
