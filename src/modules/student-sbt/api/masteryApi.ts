/**
 * Mastery API cho màn "Năng lực AI" (`/hoc-sinh/nang-luc-v2`).
 *
 * Gồm 3 endpoint `/mastery/me/...`:
 *   - books    → danh sách sách + completion_rate
 *   - chapters → danh sách chương (caller lọc theo bookId)
 *   - overview → danh sách lesson + kcs (caller lọc theo lessonId)
 *
 * Server tự lấy user từ JWT Authorization header — FE không truyền userId,
 * tránh lỗi mất precision khi id > Number.MAX_SAFE_INTEGER.
 */
import {
  lcmsListBookMastery,
  lcmsListChapterMastery,
  lcmsListLessonOverview,
  type LcmsBookMasteryResponse,
  type LcmsChapterMasteryResponse,
  type LcmsLessonOverviewResponse,
} from "@/core/api/lcmsAdapter";

// ---------------------------------------------------------------------------
// Public types — shape đã "flat" hóa id thành string để component đỡ phải
// lo LcmsId (number | string). String(lessonId) an toàn vì LCMS ids > MAX_SAFE_INTEGER.
// ---------------------------------------------------------------------------

export interface BookMastery {
  bookId: string;
  bookName: string;
  kcTotal: number;
  masteredCount: number;
  touchedKcCount: number;
  completionRate: number;
}

export interface ChapterMastery {
  chapterId: string;
  chapterName: string;
  bookId: string;
  bookName: string;
  kcTotal: number;
  masteredCount: number;
  touchedKcCount: number;
  completionRate: number;
}

export type ConfidenceLevel = "low" | "medium" | "high" | string;
export type Recommendation = "mastered" | "redo" | string;

export interface KcMastery {
  kcId: string;
  kcCode: string;
  kcName: string;
  mastery: number;
  evidenceCount: number;
  confidenceLevel: ConfidenceLevel;
  isMastered: boolean;
  recommendation: Recommendation;
}

export interface LessonMastery {
  lessonId: string;
  lessonName: string;
  chapterId: string;
  bookId: string;
  kcCount: number;
  evidenceTotal: number;
  correctCount: number | null;
  totalCount: number | null;
  correctRate: number | null;
  masteryMean: number;
  masteryMin: number;
  isMastered: boolean;
  recommendation: Recommendation;
  confidenceLevel: ConfidenceLevel;
  kcs: KcMastery[];
  /** Gợi ý câu hỏi cần luyện lại — nhúng sẵn trong overview. */
  redoQuestions: RedoQuestion[];
}

// ---------------------------------------------------------------------------
// Mappers — đổi LcmsXxx (snake_case + LcmsId) sang dạng component dùng.
// ---------------------------------------------------------------------------

function toBookMastery(raw: LcmsBookMasteryResponse["books"][number]): BookMastery {
  return {
    bookId: String(raw.book_id),
    bookName: raw.book_name ?? "",
    kcTotal: raw.kc_total ?? 0,
    masteredCount: raw.mastered_count ?? 0,
    touchedKcCount: raw.touched_kc_count ?? 0,
    completionRate: raw.completion_rate ?? 0,
  };
}

function toChapterMastery(
  raw: LcmsChapterMasteryResponse["chapters"][number],
): ChapterMastery {
  return {
    chapterId: String(raw.chapter_id),
    chapterName: raw.chapter_name ?? "",
    bookId: String(raw.book_id),
    bookName: raw.book_name ?? "",
    kcTotal: raw.kc_total ?? 0,
    masteredCount: raw.mastered_count ?? 0,
    touchedKcCount: raw.touched_kc_count ?? 0,
    completionRate: raw.completion_rate ?? 0,
  };
}

function toKcMastery(raw: LcmsLessonOverviewResponse["lessons"][number]["kcs"][number]): KcMastery {
  return {
    kcId: String(raw.kc_id),
    kcCode: raw.kc_code ?? "",
    kcName: raw.kc_name ?? "",
    mastery: raw.mastery ?? 0,
    evidenceCount: raw.evidence_count ?? 0,
    confidenceLevel: raw.confidence_level ?? "low",
    isMastered: !!raw.is_mastered,
    recommendation: raw.recommendation ?? "redo",
  };
}

function toLessonMastery(raw: LcmsLessonOverviewResponse["lessons"][number]): LessonMastery {
  return {
    lessonId: String(raw.lesson_id),
    lessonName: raw.lesson_name ?? "",
    chapterId: String(raw.chapter_id),
    bookId: String(raw.book_id),
    kcCount: raw.kc_count ?? 0,
    evidenceTotal: raw.evidence_total ?? 0,
    correctCount: raw.correct_count ?? null,
    totalCount: raw.total_count ?? null,
    correctRate: raw.correct_rate ?? null,
    masteryMean: raw.mastery_mean ?? 0,
    masteryMin: raw.mastery_min ?? 0,
    isMastered: !!raw.is_mastered,
    recommendation: raw.recommendation ?? "redo",
    confidenceLevel: raw.confidence_level ?? "low",
    kcs: (raw.kcs ?? []).map(toKcMastery),
    redoQuestions: (raw.redo_questions ?? []).map(toRedoQuestion),
  };
}

// ---------------------------------------------------------------------------
// Fetchers — react-query queryFn trỏ thẳng vào đây. Trả về object "đã map"
// để hook khỏi phải làm select. Không nhận userId — server lấy từ JWT.
// ---------------------------------------------------------------------------

export async function fetchBookMastery(): Promise<{
  asOf: string;
  books: BookMastery[];
}> {
  const raw = await lcmsListBookMastery();
  return {
    asOf: raw.as_of,
    books: raw.books.map(toBookMastery),
  };
}

export async function fetchChapterMastery(): Promise<{
  asOf: string;
  chapters: ChapterMastery[];
}> {
  const raw = await lcmsListChapterMastery();
  return {
    asOf: raw.as_of,
    chapters: raw.chapters.map(toChapterMastery),
  };
}

export async function fetchLessonOverview(): Promise<{
  asOf: string;
  lessons: LessonMastery[];
}> {
  const raw = await lcmsListLessonOverview();
  return {
    asOf: raw.as_of,
    lessons: raw.lessons.map(toLessonMastery),
  };
}

// ---------------------------------------------------------------------------
// Redo questions — gợi ý câu hỏi cần rèn luyện, NHÚNG SẴN trong overview.
// Mỗi lesson trong overview có mảng `redo_questions` — FE không cần gọi
// thêm endpoint. Chỉ chứa: question_id, question_code, name (tên câu
// hỏi từ book_question.name) và mảng KC yếu liên quan. UI chỉ dùng để
// liệt kê câu cần làm để rèn luyện — không đánh giá đúng/sai.
// ---------------------------------------------------------------------------

export interface RedoQuestionWeakKc {
  kcId: string;
  kcCode: string;
  kcName: string;
  mastery: number;
}

export interface RedoQuestion {
  questionId: string;
  questionCode: string | null;
  name: string | null;
  weakKcs: RedoQuestionWeakKc[];
}

function toRedoQuestionWeakKc(
  raw: LcmsLessonOverviewResponse["lessons"][number]["redo_questions"][number]["weak_kcs"][number],
): RedoQuestionWeakKc {
  return {
    kcId: String(raw.kc_id),
    kcCode: raw.kc_code ?? "",
    kcName: raw.kc_name ?? "",
    mastery: raw.mastery ?? 0,
  };
}

function toRedoQuestion(
  raw: LcmsLessonOverviewResponse["lessons"][number]["redo_questions"][number],
): RedoQuestion {
  return {
    questionId: String(raw.question_id),
    questionCode: raw.question_code ?? null,
    name: raw.name ?? null,
    weakKcs: (raw.weak_kcs ?? []).map(toRedoQuestionWeakKc),
  };
}
