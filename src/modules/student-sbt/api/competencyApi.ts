/**
 * Dựng từ `/submission/exercise-list` (cùng nguồn + queryKey với Bài tập của tôi):
 * nguồn này tự mang bookId/bookName/subjectName nên không phụ thuộc catalog công khai.
 */
import type { ExerciseSubmissionGroup } from "@/core/api/lcmsAdapter";
import { hasOpenAttempt, latestSubmittedAttempt, mergeByExercise } from "./attempts";

export interface BookProgress {
  bookId: string;
  bookTitle: string;
  subjectCode: string | null;
  subjectName: string | null;
  /** Số bài tập (exercise) đã nộp trong sách (distinct). */
  doneCount: number;
  /** Số bài tập đã học (đã nộp HOẶC đang làm dở, distinct). */
  attemptedCount: number;
  /** Tỉ lệ điểm tích luỹ = tổng score / tổng maxScore (chỉ tính bài đã chấm). */
  scorePercent: number | null;
}

export interface CompetencyDashboard {
  totalBooks: number;
  /** Tổng số bài tập đã nộp (distinct trên toàn bộ sách). */
  totalDone: number;
  /** Tỉ lệ điểm tổng thể. */
  scorePercent: number | null;
  books: BookProgress[];
}

interface Acc {
  bookTitle: string;
  subjectCode: string | null;
  subjectName: string | null;
  doneCount: number;
  attemptedCount: number;
  score: number;
  maxScore: number;
}

export function deriveCompetencyDashboard(
  rawGroups: ExerciseSubmissionGroup[],
): CompetencyDashboard {
  const byBook = new Map<string, Acc>();
  let sumScore = 0;
  let sumMax = 0;
  let totalDone = 0;

  // Gộp trang trước khi đếm, kẻo một bài lọt hai trang là tính gấp đôi.
  for (const g of mergeByExercise(rawGroups)) {
    const last = latestSubmittedAttempt(g);
    if (last == null && !hasOpenAttempt(g)) continue; // chỉ lượt huỷ → không tính

    const scored =
      last != null && last.score != null && last.maxScore != null
        ? { score: last.score, max: last.maxScore }
        : null;
    if (last != null) {
      totalDone += 1;
      if (scored) {
        sumScore += scored.score;
        sumMax += scored.max;
      }
    }

    if (g.bookId == null) continue; // không rõ sách → không gom vào thẻ sách nào
    const acc = byBook.get(g.bookId) ?? {
      bookTitle: g.bookName ?? "Sách",
      subjectCode: g.subjectCode,
      subjectName: g.subjectName,
      doneCount: 0,
      attemptedCount: 0,
      score: 0,
      maxScore: 0,
    };
    acc.attemptedCount += 1;
    if (last != null) {
      acc.doneCount += 1;
      if (scored) {
        acc.score += scored.score;
        acc.maxScore += scored.max;
      }
    }
    byBook.set(g.bookId, acc);
  }

  const booksProgress: BookProgress[] = [...byBook.entries()].map(
    ([bookId, acc]) => ({
      bookId,
      bookTitle: acc.bookTitle,
      subjectCode: acc.subjectCode,
      subjectName: acc.subjectName,
      doneCount: acc.doneCount,
      attemptedCount: acc.attemptedCount,
      scorePercent:
        acc.maxScore > 0 ? Math.round((acc.score / acc.maxScore) * 100) : null,
    }),
  );

  return {
    totalBooks: byBook.size,
    totalDone,
    scorePercent: sumMax > 0 ? Math.round((sumScore / sumMax) * 100) : null,
    books: booksProgress,
  };
}

export interface BookExerciseTotal {
  total: number | null;
  isSettled: boolean;
}

/**
 * Tiến độ sách = số bài đã học / tổng bài tập (trần 100). Đang tải tổng → null;
 * tổng không có (lỗi hoặc 0) → dùng tỉ lệ điểm.
 */
export function bookProgressPercent(
  book: BookProgress,
  bookTotal: BookExerciseTotal | undefined,
): number | null {
  if (bookTotal == null || !bookTotal.isSettled) return null;
  if (bookTotal.total == null || bookTotal.total <= 0) return book.scorePercent;
  return Math.min(
    100,
    Math.round((book.attemptedCount / bookTotal.total) * 100),
  );
}
