/**
 * Maps backend StudentQuestion format (from /api/v1/student/exercises/{id})
 * to the frontend PlayerQuestion format consumed by QuestionPlayer.
 *
 * When `payload` is present (questions synced from the Book module) it is
 * used directly so that rich content (images, tables, etc.) is preserved.
 * For legacy / seeded questions that only have plain-text `content` + `options`,
 * a minimal payload is synthesised from those fields.
 *
 * NHƯNG "có payload" chưa đủ để tin: câu do GIÁO VIÊN tạo mang một payload rút
 * gọn kiểu khác — `{options: ["5","4","6","8"], answer: "5"}` — không có đề bài
 * và options là mảng chuỗi. Dùng thẳng payload đó thì player hiện đề TRỐNG, bốn
 * nút A–D rỗng và bấm không ăn, trong khi `content`/`options` mà API trả kèm
 * lại hoàn toàn dùng được. Nên payload chỉ được ưu tiên khi nó THẬT SỰ chở nội
 * dung (xem `payloadCarriesContent`); không thì rơi về đường dựng từ
 * `content` + `options`.
 *
 * In both cases `correctAnswer` is KEPT (the runner self-grades client-side; the
 * server re-grades authoritatively at submit). The backend decides what to send:
 * `GetExercise` strips it for `hide_answers` exercises, and the review endpoint
 * omits the key entirely rather than sending `null` — sending `null` here would
 * overwrite `payload.correctAnswer` and silently break the answer reveal.
 */
import type { PlayerQuestion } from "@/core/exercise/QuestionPlayer";
import { resolveQuestionType } from "@/core/exercise/questionType";
import { resolveNestedQuestions } from "@/core/question-schema/nested-children";
import type { StudentQuestion } from "@/modules/books/api/assessmentApi";

function textContent(text: string) {
  return { blocks: [{ type: "paragraph", text }] };
}

/**
 * Payload có chở nội dung hiển thị được không?
 *
 * Đủ khi có `content` (đề bài) — dạng Book-module. Nhóm câu (`question_group`)
 * được phép thiếu `content`: đề nằm ở `sharedContent`, câu con ở `children`/
 * `subQuestions`/`questions`. Payload rút gọn của giáo viên đã gặp chỉ có
 * `{options, answer}` — không mang các khoá đó: options là
 * mảng CHUỖI chứ không phải mảng đối tượng `{id, content}` mà player cần, và
 * không có đề bài. Kiểm cả hai để không nhận nhầm một payload nửa vời.
 */
function payloadCarriesContent(payload: Record<string, unknown>): boolean {
  if (payload.content !== undefined) return true;
  if (payload.sharedContent !== undefined) return true;
  if (resolveNestedQuestions(payload)) return true;
  const options = payload.options;
  return (
    Array.isArray(options) &&
    options.length > 0 &&
    options.every((o) => o !== null && typeof o === "object")
  );
}

export function mapBackendQuestion(q: StudentQuestion): PlayerQuestion {
  if (
    q.payload &&
    typeof q.payload === "object" &&
    payloadCarriesContent(q.payload as Record<string, unknown>)
  ) {
    // Rich payload from Book-module sync — preserve correct answer for
    // client-side checking.
    return {
      id: q.id,
      question_type: resolveQuestionType(q.type, q.payload),
      payload: {
        ...q.payload,
        // Ensure correctAnswer from the API takes priority
        ...(q.correctAnswer !== undefined
          ? { correctAnswer: q.correctAnswer }
          : {}),
      },
    };
  }

  // Fallback: build a minimal payload from plain-text fields.
  const options = q.options.map((opt) => ({
    id: opt.id,
    content: textContent(opt.content),
  }));

  const payload: Record<string, unknown> = {
    content: textContent(q.content),
    ...(options.length > 0 ? { options } : {}),
    ...(q.correctAnswer !== undefined
      ? { correctAnswer: q.correctAnswer }
      : {}),
  };

  // Payload rút gọn của câu giáo viên vẫn có thể chở `answer` — giữ lại làm
  // đáp án khi API không gửi `correctAnswer` riêng, để phần tự chấm phía client
  // không mất căn cứ.
  const shorthand = (q.payload ?? {}) as Record<string, unknown>;
  if (payload.correctAnswer === undefined && shorthand.answer !== undefined) {
    payload.correctAnswer = shorthand.answer;
  }

  return {
    id: q.id,
    question_type: resolveQuestionType(q.type, q.payload),
    payload,
  };
}

export function mapBackendQuestions(questions: StudentQuestion[]): PlayerQuestion[] {
  return questions.map(mapBackendQuestion);
}
