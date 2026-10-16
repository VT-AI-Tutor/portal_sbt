/**
 * Dữ liệu cho màn "Bài tập của tôi" (I.8) của khu Student SBT.
 *
 * `deriveMyExercises` là hàm THUẦN: nhận danh sách group (từ `fetchAllExerciseGroups`)
 * → các BÀI TẬP (mỗi bài MỘT thẻ, mang lần nộp mới nhất) + danh sách môn. Bài mới chỉ
 * đang làm dở cũng lên thẻ. Môn học lấy thẳng từ response (subjectCode/subjectName).
 *
 * "Tiếp tục" KHÔNG cần gọi lại API: các lượt đang làm dở (`endedAt === null`) đã nằm
 * sẵn trong chính group, gắn vào từng thẻ (`inProgressAttempts`).
 *
 * Mỗi thẻ chỉ HIỆN 1 nút, theo trạng thái ATTEMPT MỚI NHẤT của bài (`latestInProgress`):
 * đang làm dở → "Tiếp tục làm bài"; đã xong → "Làm lại từ đầu".
 *
 * Điều hướng (LCMS): route /sach-bai-tap/:bookCode/:lessonCode nhận bookId ở
 * :bookCode và exerciseId ở :lessonCode.
 *  - Tiếp tục → /sach-bai-tap/{bookId}/{exerciseId}  (SubmissionRunner tự resume
 *    attempt đang làm dở).
 *  - Làm lại  → /sach-bai-tap/{bookId}/{exerciseId}  (về hub bài để làm mới)
 */
import type { ExerciseSubmissionGroup } from "@/core/api/lcmsAdapter";
import {
  isOpenAttempt,
  latestSubmittedAttempt,
  mergeByExercise,
  ms,
} from "./attempts";

export interface ExerciseSubject {
  code: string;
  name: string;
}

export interface InProgressAttempt {
  attemptId: string;
  startedAt: string;
}

export interface CompletedExercise {
  /** Lần nộp MỚI NHẤT của bài; null khi bài mới chỉ đang làm dở. */
  submissionId: string | null;
  /** Dùng cho :lessonCode của route /sach-bai-tap/:bookCode/:lessonCode. */
  exerciseId: string | null;
  exerciseTitle: string;
  /** Dùng cho :bookCode của route. */
  bookId: string;
  bookTitle: string;
  subjectCode: string | null;
  subjectName: string | null;
  score: number | null;
  maxScore: number | null;
  gradingStatus: "graded" | "pending" | null;
  /** Thời điểm nộp gần nhất; null khi chưa nộp lần nào. */
  submittedAt: string | null;
  /** Mốc hoạt động gần nhất (nộp hoặc bắt đầu làm) — dùng để sắp thẻ. */
  lastActivityAt: string;
  /** Các lượt đang làm dở của bài (mới nhất trước) — cho picker "Tiếp tục". */
  inProgressAttempts: InProgressAttempt[];
  /** Attempt mới nhất của bài chưa kết thúc ⇒ hiện "Tiếp tục", ngược lại "Làm lại". */
  latestInProgress: boolean;
}

export interface MyExercises {
  subjects: ExerciseSubject[];
  completed: CompletedExercise[];
}

export function deriveMyExercises(
  rawGroups: ExerciseSubmissionGroup[],
): MyExercises {
  const groups = mergeByExercise(rawGroups);
  const subjects = new Map<string, string>();
  const completed: CompletedExercise[] = [];

  for (const g of groups) {
    const bookId = g.bookId ?? "?";
    const subjectCode = g.subjectCode;
    const subjectName = g.subjectName;
    if (subjectCode) subjects.set(subjectCode, subjectName ?? subjectCode);

    const exerciseTitle = g.name || "Bài tập";
    const bookTitle = g.bookName ?? "Sách";

    // Lượt đang làm dở, mới nhất trước — cho picker "Tiếp tục".
    const inProgressAttempts: InProgressAttempt[] = g.attempts
      .filter(isOpenAttempt)
      .sort((a, b) => ms(b.startedAt) - ms(a.startedAt))
      .map((a) => ({ attemptId: a.attemptId, startedAt: a.startedAt }));

    // Trạng thái bài = attempt MỚI NHẤT: chưa kết thúc ⇒ đang làm dở.
    const latest = g.attempts.reduce(
      (m, a) => (ms(a.startedAt) > ms(m.startedAt) ? a : m),
      g.attempts[0],
    );
    const latestInProgress = g.attempts.length > 0 && isOpenAttempt(latest);

    const lastSubmitted = latestSubmittedAttempt(g);
    const newestOpen = inProgressAttempts[0]; // đã sắp mới-nhất-trước

    // Không nộp, không còn dở (chỉ lượt huỷ) ⇒ chẳng có gì để hiện.
    const lastActivityAt = lastSubmitted?.submittedAt ?? newestOpen?.startedAt;
    if (lastActivityAt == null) continue;

    completed.push({
      submissionId: lastSubmitted?.attemptId ?? null,
      exerciseId: g.exerciseId,
      exerciseTitle,
      bookId,
      bookTitle,
      subjectCode,
      subjectName,
      score: lastSubmitted?.score ?? null,
      maxScore: lastSubmitted?.maxScore ?? null,
      gradingStatus:
        lastSubmitted == null
          ? null
          : lastSubmitted.score != null
            ? "graded"
            : "pending",
      submittedAt: lastSubmitted?.submittedAt ?? null,
      lastActivityAt,
      inProgressAttempts,
      latestInProgress,
    });
  }

  completed.sort((x, y) => ms(y.lastActivityAt) - ms(x.lastActivityAt));

  return {
    subjects: [...subjects.entries()].map(([code, name]) => ({ code, name })),
    completed,
  };
}
