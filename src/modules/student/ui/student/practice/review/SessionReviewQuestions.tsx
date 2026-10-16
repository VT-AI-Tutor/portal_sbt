/**
 * Danh sách câu ở màn kết quả: cuộn thẳng qua TẤT CẢ câu theo thứ tự, mỗi câu
 * render bằng chính player của nó ở trạng thái đã chấm (đáp án của em + đáp án
 * đúng do player tô).
 *
 * Chỉ-đọc bằng WRAPPER (`pointer-events-none` + `aria-disabled`) chứ không thêm
 * prop vào PlayerProps: 63 player dùng chung interface đó và mọi thay đổi ở
 * `src/core/exercise/players/*` đều phát sinh nợ đồng bộ sang evo-books-studio-web.
 */
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { Card } from "@/core/ui/card";
import { cn } from "@/core/lib/utils";
import { QuestionPlayer } from "@/core/exercise/QuestionPlayer";
import { ErrorBoundary } from "@/core/ui/ErrorBoundary";
import {
  mapSessionQuestion,
  deserializeSessionAnswer,
} from "@/modules/student/api/mapSessionQuestion";
import type {
  ReviewQuestion,
  SessionQuestion,
} from "@/modules/student/api/practiceApi";
import { SolutionBlock } from "./SolutionBlock";

function verdictOf(q: ReviewQuestion): "correct" | "incorrect" | "incomplete" {
  if (!q.gradable) return "incomplete";
  return q.is_correct ? "correct" : "incorrect";
}

export function SessionReviewQuestions({
  questions,
}: {
  questions: ReviewQuestion[];
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-display font-bold">Chi tiết bài làm</h3>
      {questions.map((q) => {
        const verdict = verdictOf(q);
        const Icon =
          verdict === "correct"
            ? CheckCircle2
            : verdict === "incorrect"
              ? XCircle
              : MinusCircle;
        const tone =
          verdict === "correct"
            ? "text-success"
            : verdict === "incorrect"
              ? "text-destructive"
              : "text-muted-foreground";

        // ReviewQuestion = SessionQuestion + phần kết quả; mapSessionQuestion chỉ
        // đọc các trường của SessionQuestion nên ép kiểu ở đây là an toàn.
        // `reveal: true` + `revealCorrect` là CẶP: cái đầu đưa khoá đáp án vào
        // payload, cái sau cho player tô. Thiếu một trong hai thì câu làm sai
        // chỉ còn "Chưa đúng 😅" — không nói được đáp án đúng là gì.
        const player = mapSessionQuestion(q as unknown as SessionQuestion, {
          reveal: true,
        });
        const answer = deserializeSessionAnswer(
          q as unknown as SessionQuestion,
          q.student_answer,
        );

        return (
          <Card key={q.id} className="p-4 border-2 space-y-3">
            <div className="flex items-center gap-2">
              <Icon className={cn("size-4 shrink-0", tone)} />
              <span className="text-xs font-bold text-muted-foreground">
                Câu {q.order + 1}
              </span>
              {verdict === "incomplete" ? (
                <span className="text-xs font-semibold text-muted-foreground">
                  Chưa chấm tự động
                </span>
              ) : (
                <span className="text-xs font-semibold text-muted-foreground ml-auto tabular-nums">
                  {q.points}/{q.max_points}
                </span>
              )}
            </div>

            <div
              data-testid={`review-question-${q.id}`}
              aria-disabled="true"
              className="pointer-events-none select-none"
            >
              {/* Ranh giới đặt quanh TỪNG câu: một câu dị dạng chỉ mất một thẻ,
                  phần còn lại của bài vẫn đọc được — thay vì trắng cả trang. */}
              <ErrorBoundary
                fallback={() => (
                  <p className="text-sm text-muted-foreground">
                    Không hiển thị được câu này. Em xem các câu khác trước nhé — nhà trường
                    đã nhận được báo lỗi.
                  </p>
                )}
              >
                <QuestionPlayer
                  key={q.id}
                  question={player}
                  index={q.order}
                  answer={answer}
                  submitted
                  gradeMode="parent"
                  result={verdict}
                  revealCorrect
                />
              </ErrorBoundary>
            </div>

            {/* Hướng dẫn giải chỉ hiện ở câu SAI — câu đúng không cần giảng lại. */}
            {verdict === "incorrect" && <SolutionBlock question={q} />}
          </Card>
        );
      })}
    </div>
  );
}
