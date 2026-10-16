/**
 * Hình dạng dữ liệu ĐƯỜNG DÂY của khu làm bài học sinh (student assessment).
 *
 * Ở đây chứ không ở app: `packages/core/src/api/lcmsAdapter.ts` cần đúng các
 * kiểu này để dịch phản hồi LCMS về khuôn chung, mà core thì KHÔNG được import
 * ngược vào app — trước đây nó phải trỏ sang `apps/learner`, khiến typecheck từ
 * app khác (admin) gãy vì không resolve nổi đường đó.
 *
 * `assessmentApi.ts` bên learner re-export nguyên vẹn khối này nên mọi nơi
 * đang `import ... from "@/modules/books/api/assessmentApi"` giữ nguyên.
 */

export interface StudentBook {
  id: number;
  code: string | null;
  title: string;
  progressPercent: number;
  coverUrl: string | null;
}

export interface BookChapter {
  id: number;
  code: string | null;
  title: string;
  lessons: Array<{ id: number; code: string | null; title: string }>;
}

export interface BookContents {
  chapters: BookChapter[];
}

export interface ExerciseListItem {
  id: string;
  title: string;
  type: "quiz" | "written" | "mixed";
  totalQuestions: number;
  status: "not_started" | "in_progress" | "submitted";
}

export interface QuestionOption {
  id: string;
  content: string;
}

export type KnownQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "multi_true_false"
  | "ordering"
  | "matching"
  | "classification"
  | "question_group"
  | "short_answer"
  | "essay";

export interface StudentQuestion {
  id: string;
  // LCMS schema types are an open set; players/grading key on plain strings
  // with safe defaults, so unknown values degrade instead of lying at compile
  // time.
  type: KnownQuestionType | (string & {});
  content: string;
  options: QuestionOption[];
  /** Full rich payload preserved from Book-module questions (has images). */
  payload?: Record<string, unknown> | null;
  correctAnswer?: AnswerValue;
  points?: number;
}

export interface ExerciseDetail {
  id: string;
  title: string;
  instructions: string | null;
  durationMinutes: number | null;
  questions: StudentQuestion[];
}

export interface AttemptStart {
  attemptId: string;
  startedAt: string;
}

export interface CurrentAttempt {
  attemptId: string;
  startedAt: string;
  answers: Array<{ questionId: string; answer: AnswerValue }>;
}

/** Có OBJECT: mọi loại câu ghi theo ô (drag_drop, fill_blank…) đều emit `Record`. */
export type AnswerValue = string | string[] | Record<string, unknown> | null;

export interface SubmitResult {
  submissionId: string;
  status: string;
  gradingStatus: "graded" | "pending";
}

export interface SubmissionDetail {
  submissionId: string;
  score: number | null;
  maxScore: number;
  gradingStatus: "graded" | "pending";
  teacherComment: string | null;
  submittedAt: string;
  gradedAt: string | null;
}

/**
 * Một câu ở màn "Xem lại bài làm". Bộ trường `id/type/content/options/payload`
 * CỐ Ý trùng `StudentQuestion` để `mapBackendQuestion()` dùng lại nguyên xi.
 */
export interface SubmissionReviewQuestion extends StudentQuestion {
  order: number;
  studentAnswer: unknown;
  isCorrect: boolean | null;
  gradable: boolean;
  points: number;
  maxPoints: number;
  teacherComment: string | null;
  fileCount: number;
}

export interface SubmissionReview extends SubmissionDetail {
  exerciseId: string | null;
  exerciseTitle: string | null;
  /**
   * false với bài `hide_answers` (đề kiểm tra) — server đã lột sạch đáp án khỏi
   * payload, FE chỉ việc không bật reveal ở player.
   */
  revealAnswers: boolean;
  questions: SubmissionReviewQuestion[];
}

export interface HistoryItem {
  submissionId: string;
  // number on legacy; LCMS ids can exceed Number.MAX_SAFE_INTEGER → string
  bookId: number | string | null;
  bookTitle: string | null;
  lessonId: number | string | null;
  exerciseId: string | null;
  exerciseTitle: string;
  score: number | null;
  maxScore: number | null;
  gradingStatus: "graded" | "pending" | null;
  submittedAt: string;
}

export interface HistoryResult {
  items: HistoryItem[];
  pagination: { page: number; limit: number; total: number };
}

