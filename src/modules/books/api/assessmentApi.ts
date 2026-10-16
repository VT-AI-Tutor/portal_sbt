/**
 * Student Assessment API client — wraps all /api/v1/student/* endpoints.
 * Requires a valid JWT access token (from AuthContext / storage).
 */
import { getAuthenticatedApiBaseUrl, getApiProvider } from "@/core/api/config";
import { getStoredSession } from "@/core/auth/storage";
import { notifyAuthExpired } from "@/core/embed/bridge";
import {
  lcmsGetCurrentAttempt,
  lcmsGetSubmittedAttempt,
  lcmsGetExercise,
  lcmsGetSubmission,
  lcmsListHistory,
  lcmsListLessonExercises,
  lcmsSaveAnswers,
  lcmsStartAttempt,
  lcmsSubmitAttempt,
  lcmsUploadAttemptFile,
} from "@/core/api/lcmsAdapter";

const API_BASE = getAuthenticatedApiBaseUrl();

/**
 * True when the secondary LCMS provider is enabled via config.
 *
 * KHÔNG phải React hook — chỉ đọc config. Tên cũ `useLcms` khiến
 * `react-hooks/rules-of-hooks` báo nhầm 16 lỗi vì tiền tố `use`.
 */
function lcmsEnabled(): boolean {
  return getApiProvider() === "lcms";
}

// ---------------------------------------------------------------------------
// Types — định nghĩa nằm ở packages/core (core/api/lcmsAdapter cần chúng và core
// không được import ngược vào app). Re-export để mọi nơi đang import từ file này
// giữ nguyên đường cũ.
// ---------------------------------------------------------------------------

export type * from "@/core/api/assessmentTypes";

// Re-export ở trên không đưa tên vào phạm vi file — import để dùng tại chỗ.
import type {
  StudentBook,
  BookChapter,
  BookContents,
  ExerciseListItem,
  QuestionOption,
  KnownQuestionType,
  StudentQuestion,
  ExerciseDetail,
  AttemptStart,
  CurrentAttempt,
  AnswerValue,
  SubmitResult,
  SubmissionDetail,
  SubmissionReviewQuestion,
  SubmissionReview,
  HistoryItem,
  HistoryResult,
} from "@/core/api/assessmentTypes";

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

class AssessmentApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "AssessmentApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredSession().accessToken;
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });

  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    message?: string;
    error_code?: string;
  };

  if (!res.ok || body.success === false) {
    // Let the native WebView host (if any) refresh & re-inject a token.
    if (res.status === 401) notifyAuthExpired();
    throw new AssessmentApiError(
      res.status,
      body.error_code,
      body.message ?? `Assessment API error ${res.status}`,
    );
  }

  return body.data as T;
}

export interface CompetencySubject {
  subject_code: string;
  subject_name: string;
  mastery_percent: number;
  total_score: number;
  total_max_score: number;
  submission_count: number;
}

export interface CompetencyResult {
  level: string | null;
  subjects: CompetencySubject[];
}

export interface ContinueLearningExercise {
  exercise_id: string;
  exercise_title: string;
  exercise_type: string;
  lesson_id: number;
  lesson_title: string;
  book_id: number;
  book_title: string;
  duration_minutes: number | null;
  status: "in_progress" | "not_started";
  answer_count: number;
}

export interface ContinueLearningSubject {
  subject_code: string;
  subject_name: string;
  continue?: ContinueLearningExercise;
  next?: ContinueLearningExercise;
}

export interface ContinueLearningResult {
  level: string | null;
  items: ContinueLearningSubject[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/v1/student/continue-learning */
export async function getContinueLearning(): Promise<ContinueLearningResult> {
  return apiFetch<ContinueLearningResult>("/api/v1/student/continue-learning");
}

/** GET /api/v1/student/competency */
export async function getStudentCompetency(): Promise<CompetencyResult> {
  return apiFetch<CompetencyResult>("/api/v1/student/competency");
}

/** Step 1 — GET /api/v1/student/books */
export async function listStudentBooks(): Promise<StudentBook[]> {
  const data = await apiFetch<{ items: StudentBook[] }>(
    "/api/v1/student/books",
  );
  return data.items;
}

/** Step 2 — GET /api/v1/student/books/{bookId}/contents */
export async function getBookContents(bookId: number): Promise<BookContents> {
  return apiFetch<BookContents>(`/api/v1/student/books/${bookId}/contents`);
}

/** Step 2b — GET /api/v1/student/lessons/{lessonId}/exercises */
export async function listLessonExercises(
  lessonId: number | string, // string-safe: LCMS ids may exceed MAX_SAFE_INTEGER
): Promise<ExerciseListItem[]> {
  if (lcmsEnabled()) return lcmsListLessonExercises(lessonId);
  const data = await apiFetch<{ items: ExerciseListItem[] }>(
    `/api/v1/student/lessons/${String(lessonId)}/exercises`,
  );
  return data.items;
}

/** Step 3 — GET /api/v1/student/exercises/{exerciseId} */
export async function getExercise(exerciseId: string): Promise<ExerciseDetail> {
  if (lcmsEnabled()) return lcmsGetExercise(exerciseId);
  return apiFetch<ExerciseDetail>(`/api/v1/student/exercises/${exerciseId}`);
}

/** Step 3.5 — GET /api/v1/student/exercises/{exerciseId}/current-attempt */
export async function getCurrentAttempt(
  exerciseId: string,
  /** LCMS: thu hẹp việc tra `endedAt` về đúng bài học đang mở. */
  lessonId?: number | string,
): Promise<CurrentAttempt | null> {
  if (lcmsEnabled()) return lcmsGetCurrentAttempt(exerciseId, lessonId);
  return apiFetch<CurrentAttempt | null>(
    `/api/v1/student/exercises/${exerciseId}/current-attempt`,
  );
}

/**
 * Đáp án của một lần NỘP, để dựng "Xem lại bài làm" khi provider không có review
 * riêng. Chỉ LCMS cần — best-effort, lỗi/không chắc ⇒ null.
 */
export async function getSubmittedAttempt(
  exerciseId: string,
  submissionId: string,
): Promise<CurrentAttempt | null> {
  if (!lcmsEnabled()) return null;
  return lcmsGetSubmittedAttempt(exerciseId, submissionId).catch(() => null);
}

/** Step 4 — POST /api/v1/student/exercises/{exerciseId}/attempts */
export async function startAttempt(exerciseId: string): Promise<AttemptStart> {
  if (lcmsEnabled()) return lcmsStartAttempt(exerciseId);
  return apiFetch<AttemptStart>(
    `/api/v1/student/exercises/${exerciseId}/attempts`,
    { method: "POST", body: "{}" },
  );
}

/** Step 5 — PUT /api/v1/student/attempts/{attemptId}/answers */
export async function saveAnswers(
  attemptId: string,
  answers: Array<{ questionId: string; answer: AnswerValue }>,
  results?: Array<{
    questionId: string;
    isCorrect: boolean;
    points: number;
    gradable: boolean;
  }>,
): Promise<void> {
  if (lcmsEnabled()) return lcmsSaveAnswers(attemptId, answers, results);
  const payload: Record<string, unknown> = { answers };
  if (results && results.length > 0) {
    payload.results = results;
  }
  await apiFetch<unknown>(`/api/v1/student/attempts/${attemptId}/answers`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Step 6 — POST /api/v1/student/attempts/{attemptId}/files (multipart) */
export async function uploadAttemptFile(
  attemptId: string,
  file: File,
): Promise<{ fileId: string; fileUrl: string }> {
  // LCMS upload không cần attemptId — file nối vào bài qua answer.files.
  if (lcmsEnabled()) return lcmsUploadAttemptFile(file);
  const token = getStoredSession().accessToken;
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(
    `${API_BASE}/api/v1/student/attempts/${attemptId}/files`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { fileId: string; fileUrl: string };
    message?: string;
    error_code?: string;
  };
  if (!res.ok || body.success === false) {
    throw new AssessmentApiError(
      res.status,
      body.error_code,
      body.message ?? `Upload error ${res.status}`,
    );
  }
  return body.data!;
}

/** Step 7 — POST /api/v1/student/attempts/{attemptId}/submit */
export async function submitAttempt(
  attemptId: string,
  payload?: {
    answers?: Array<{ questionId: string; answer: AnswerValue }>;
    files?: Array<{ questionId: string; fileId: string }>;
    results?: Array<{
      questionId: string;
      isCorrect: boolean;
      points: number;
      gradable: boolean;
    }>;
    submittedAt?: string;
  },
): Promise<SubmitResult> {
  if (lcmsEnabled()) return lcmsSubmitAttempt(attemptId, payload);
  return apiFetch<SubmitResult>(
    `/api/v1/student/attempts/${attemptId}/submit`,
    {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    },
  );
}

/** Step 8 — GET /api/v1/student/history */
export async function listHistory(params?: {
  bookId?: number | string;
  page?: number;
  limit?: number;
}): Promise<HistoryResult> {
  if (lcmsEnabled()) return lcmsListHistory(params);
  const qs = new URLSearchParams();
  if (params?.bookId != null) qs.set("bookId", String(params.bookId));
  if (params?.page != null) qs.set("page", String(params.page));
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<HistoryResult>(`/api/v1/student/history${query}`);
}

/** Step 9 — GET /api/v1/student/submissions/{submissionId} */
export async function getSubmission(
  submissionId: string,
): Promise<SubmissionDetail> {
  if (lcmsEnabled()) return lcmsGetSubmission(submissionId);
  return apiFetch<SubmissionDetail>(
    `/api/v1/student/submissions/${submissionId}`,
  );
}

/**
 * GET /api/v1/student/submissions/{submissionId}/review — xem lại từng câu.
 *
 * BEST-EFFORT có chủ đích: trả `null` thay vì ném lỗi khi provider không có cửa
 * này (LCMS) hoặc khi backend chưa lên. Màn kết quả khi đó hiển thị đúng phần
 * điểm như trước, không vỡ — nhờ vậy FE ship được độc lập với BE.
 */
export async function getSubmissionReview(
  submissionId: string,
): Promise<SubmissionReview | null> {
  if (lcmsEnabled()) return null;
  try {
    return await apiFetch<SubmissionReview>(
      `/api/v1/student/submissions/${submissionId}/review`,
    );
  } catch {
    return null;
  }
}
