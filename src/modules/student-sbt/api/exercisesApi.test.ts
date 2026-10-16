import { describe, it, expect } from "vitest";
import { deriveMyExercises } from "./exercisesApi";
import type { ExerciseSubmissionGroup } from "@/core/api/lcmsAdapter";

type Attempt = ExerciseSubmissionGroup["attempts"][number];

function attempt(over: Partial<Attempt>): Attempt {
  return {
    attemptId: "a",
    status: 4,
    startedAt: "2026-08-01T00:00:00.000Z",
    endedAt: "2026-08-01T00:01:00.000Z",
    maxScore: 10,
    gradingStatus: 0,
    score: 5,
    submittedAt: "2026-08-01T00:01:00.000Z",
    ...over,
  };
}

function group(over: Partial<ExerciseSubmissionGroup>): ExerciseSubmissionGroup {
  return {
    exerciseId: "e",
    bookId: "1",
    name: "Bài 1",
    bookName: "Sách A",
    subjectCode: "toan",
    subjectName: "Toán",
    attempts: [],
    ...over,
  };
}

describe("deriveMyExercises", () => {
  it("MỘT thẻ cho mỗi BÀI, mang lần nộp mới nhất", () => {
    const groups = [
      group({
        exerciseId: "e1",
        attempts: [
          attempt({ attemptId: "sub1", submittedAt: "2026-08-01T10:00:00Z" }),
          attempt({ attemptId: "sub2", submittedAt: "2026-08-02T10:00:00Z" }),
          attempt({
            attemptId: "inprog",
            status: 6,
            submittedAt: null,
            endedAt: null,
            startedAt: "2026-07-01T00:00:00Z",
          }),
          attempt({
            attemptId: "cancel",
            status: 0,
            submittedAt: null,
            endedAt: "2026-07-02T00:00:00Z",
            startedAt: "2026-07-02T00:00:00Z",
          }),
        ],
      }),
    ];
    const { completed } = deriveMyExercises(groups);
    expect(completed).toHaveLength(1);
    expect(completed[0].submissionId).toBe("sub2"); // lần nộp mới nhất
  });

  it("latestInProgress=true khi attempt MỚI NHẤT chưa kết thúc", () => {
    const groups = [
      group({
        attempts: [
          attempt({
            attemptId: "sub",
            submittedAt: "2026-08-01T10:00:00Z",
            startedAt: "2026-08-01T09:00:00Z",
          }),
          attempt({
            attemptId: "open",
            status: 6,
            submittedAt: null,
            endedAt: null,
            startedAt: "2026-08-05T09:00:00Z",
          }),
        ],
      }),
    ];
    const { completed } = deriveMyExercises(groups);
    expect(completed).toHaveLength(1); // chỉ lượt đã nộp lên thẻ
    expect(completed[0].latestInProgress).toBe(true);
    expect(completed[0].inProgressAttempts.map((a) => a.attemptId)).toEqual([
      "open",
    ]);
  });

  it("latestInProgress=false khi attempt mới nhất đã nộp", () => {
    const groups = [
      group({
        attempts: [
          attempt({
            attemptId: "old",
            submittedAt: "2026-08-01T10:00:00Z",
            startedAt: "2026-08-01T09:00:00Z",
          }),
          attempt({
            attemptId: "new",
            submittedAt: "2026-08-09T10:00:00Z",
            startedAt: "2026-08-09T09:00:00Z",
          }),
        ],
      }),
    ];
    const { completed } = deriveMyExercises(groups);
    expect(completed.every((c) => c.latestInProgress === false)).toBe(true);
  });

  it("gradingStatus: có điểm (kể cả 0) ⇒ graded; điểm null ⇒ pending", () => {
    const groups = [
      group({
        exerciseId: "e-zero",
        attempts: [
          attempt({
            attemptId: "zero",
            score: 0,
            submittedAt: "2026-08-01T10:00:00Z",
          }),
        ],
      }),
      group({
        exerciseId: "e-ungraded",
        attempts: [
          attempt({
            attemptId: "ungraded",
            score: null,
            submittedAt: "2026-08-02T10:00:00Z",
          }),
        ],
      }),
    ];
    const { completed } = deriveMyExercises(groups);
    const byId = Object.fromEntries(
      completed.map((c) => [c.submissionId, c.gradingStatus]),
    );
    expect(byId.zero).toBe("graded");
    expect(byId.ungraded).toBe("pending");
  });

  it("bài mới chỉ đang làm dở (chưa nộp lần nào) VẪN lên thẻ", () => {
    const groups = [
      group({
        attempts: [
          attempt({
            attemptId: "open",
            status: 6,
            submittedAt: null,
            endedAt: null,
            startedAt: "2026-08-03T08:00:00Z",
          }),
        ],
      }),
    ];
    const [c] = deriveMyExercises(groups).completed;
    expect(c.submissionId).toBeNull();
    expect(c.submittedAt).toBeNull();
    expect(c.gradingStatus).toBeNull();
    expect(c.latestInProgress).toBe(true);
    expect(c.lastActivityAt).toBe("2026-08-03T08:00:00Z");
  });

  it("bài chỉ có lượt HUỶ (không nộp, không còn dở) ⇒ không tạo thẻ", () => {
    const groups = [
      group({
        attempts: [
          attempt({
            attemptId: "cancel",
            status: 0,
            submittedAt: null,
            endedAt: "2026-07-02T00:00:00Z",
          }),
        ],
      }),
    ];
    expect(deriveMyExercises(groups).completed).toHaveLength(0);
  });

  it("gom danh sách môn (distinct)", () => {
    const groups = [
      group({
        exerciseId: "e1",
        subjectCode: "toan",
        subjectName: "Toán",
        attempts: [attempt({ attemptId: "s1" })],
      }),
      group({
        exerciseId: "e2",
        subjectCode: "toan",
        subjectName: "Toán",
        attempts: [attempt({ attemptId: "s2" })],
      }),
      group({
        exerciseId: "e3",
        subjectCode: "tv",
        subjectName: "Tiếng Việt",
        attempts: [attempt({ attemptId: "s3" })],
      }),
    ];
    expect(deriveMyExercises(groups).subjects).toEqual([
      { code: "toan", name: "Toán" },
      { code: "tv", name: "Tiếng Việt" },
    ]);
  });

  it("sắp xếp thẻ theo submittedAt giảm dần", () => {
    const groups = [
      group({
        exerciseId: "e1",
        attempts: [
          attempt({ attemptId: "a1", submittedAt: "2026-08-01T10:00:00Z" }),
        ],
      }),
      group({
        exerciseId: "e2",
        attempts: [
          attempt({ attemptId: "a2", submittedAt: "2026-08-09T10:00:00Z" }),
        ],
      }),
    ];
    const { completed } = deriveMyExercises(groups);
    expect(completed.map((c) => c.submissionId)).toEqual(["a2", "a1"]);
  });

  it("group trùng exerciseId (do ghép trang) được GỘP, không bỏ bớt attempt", () => {
    const trang1 = group({
      exerciseId: "e1",
      attempts: [
        attempt({
          attemptId: "cu",
          score: 1,
          submittedAt: "2026-08-01T10:00:00Z",
          startedAt: "2026-08-01T09:00:00Z",
        }),
      ],
    });
    const trang2 = group({
      exerciseId: "e1",
      attempts: [
        attempt({
          attemptId: "moi",
          score: 9,
          submittedAt: "2026-08-05T10:00:00Z",
          startedAt: "2026-08-05T09:00:00Z",
        }),
        attempt({
          attemptId: "dang-lam",
          submittedAt: null,
          endedAt: null,
          startedAt: "2026-08-09T09:00:00Z",
        }),
      ],
    });

    const { completed } = deriveMyExercises([trang1, trang2]);

    expect(completed).toHaveLength(1);
    const [card] = completed;
    expect(card.submissionId).toBe("moi"); // bỏ bản trùng thì ra "cu"
    expect(card.score).toBe(9);
    expect(card.inProgressAttempts.map((a) => a.attemptId)).toEqual([
      "dang-lam",
    ]);
    expect(card.latestInProgress).toBe(true);
  });

  it("gộp trang KHÔNG sửa dữ liệu gốc (nguồn là cache react-query)", () => {
    const trang1 = group({ exerciseId: "e1", attempts: [attempt({ attemptId: "a1" })] });
    const trang2 = group({ exerciseId: "e1", attempts: [attempt({ attemptId: "a2" })] });
    deriveMyExercises([trang1, trang2]);
    expect(trang1.attempts.map((a) => a.attemptId)).toEqual(["a1"]);
    expect(trang2.attempts.map((a) => a.attemptId)).toEqual(["a2"]);
  });

  it("bookId null ⇒ '?'; name/bookName null ⇒ nhãn mặc định", () => {
    const groups = [
      group({
        bookId: null,
        name: null,
        bookName: null,
        attempts: [attempt({ attemptId: "s" })],
      }),
    ];
    const [c] = deriveMyExercises(groups).completed;
    expect(c.bookId).toBe("?");
    expect(c.exerciseTitle).toBe("Bài tập");
    expect(c.bookTitle).toBe("Sách");
  });
});
