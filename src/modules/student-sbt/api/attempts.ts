/** Dùng chung cho hai màn đọc `/submission/exercise-list` (Bài tập của tôi + Năng lực). */
import type { ExerciseSubmissionGroup } from "@/core/api/lcmsAdapter";

type Attempt = ExerciseSubmissionGroup["attempts"][number];

export const ms = (iso: string) => new Date(iso).getTime();

export const isOpenAttempt = (attempt: Attempt) => attempt.endedAt === null;

export function hasOpenAttempt(group: ExerciseSubmissionGroup): boolean {
  return group.attempts.some(isOpenAttempt);
}

export function latestSubmittedAttempt(
  group: ExerciseSubmissionGroup,
): Attempt | null {
  return group.attempts
    .filter((a) => a.submittedAt != null)
    .reduce<Attempt | null>(
      (best, a) =>
        best == null || ms(a.submittedAt!) > ms(best.submittedAt!) ? a : best,
      null,
    );
}

/**
 * Gộp chứ không bỏ bản trùng: LCMS có thể phân trang theo attempt, khi đó mỗi bản
 * chỉ mang một phần. Không mutate — `groups` là cache react-query, hai màn cùng đọc.
 */
export function mergeByExercise(
  groups: ExerciseSubmissionGroup[],
): ExerciseSubmissionGroup[] {
  const byExercise = new Map<string, ExerciseSubmissionGroup>();
  for (const group of groups) {
    const existing = byExercise.get(group.exerciseId);
    if (existing == null) {
      byExercise.set(group.exerciseId, group);
      continue;
    }
    const seenAttempt = new Set(existing.attempts.map((a) => a.attemptId));
    byExercise.set(group.exerciseId, {
      ...existing,
      attempts: [
        ...existing.attempts,
        ...group.attempts.filter((a) => !seenAttempt.has(a.attemptId)),
      ],
    });
  }
  return [...byExercise.values()];
}
