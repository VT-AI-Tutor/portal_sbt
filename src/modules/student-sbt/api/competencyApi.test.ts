import { describe, it, expect } from "vitest";
import { bookProgressPercent, deriveCompetencyDashboard } from "./competencyApi";
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

describe("deriveCompetencyDashboard", () => {
  it("sách tạo bên quản trị (id snowflake, ngoài catalog công khai) vẫn lên dashboard", () => {
    const d = deriveCompetencyDashboard([
      group({
        exerciseId: "3744035734336569344",
        bookId: "3744035127093624832",
        bookName: "Sách admin tạo",
        subjectName: "Tự nhiên và Xã hội",
        attempts: [attempt({ score: 3, maxScore: 4 })],
      }),
    ]);
    expect(d.totalBooks).toBe(1);
    expect(d.totalDone).toBe(1);
    expect(d.books[0].bookTitle).toBe("Sách admin tạo");
    expect(d.books[0].subjectName).toBe("Tự nhiên và Xã hội");
    expect(d.books[0].scorePercent).toBe(75);
  });

  it("mỗi bài tính theo lần nộp MỚI NHẤT, không cộng dồn mọi lượt", () => {
    const d = deriveCompetencyDashboard([
      group({
        attempts: [
          attempt({
            attemptId: "cu",
            score: 1,
            maxScore: 10,
            submittedAt: "2026-08-01T10:00:00Z",
          }),
          attempt({
            attemptId: "moi",
            score: 9,
            maxScore: 10,
            submittedAt: "2026-08-05T10:00:00Z",
          }),
        ],
      }),
    ]);
    expect(d.totalDone).toBe(1); // một BÀI, không phải hai lượt
    expect(d.scorePercent).toBe(90); // lượt mới nhất, không phải (1+9)/20
  });

  it("bài chờ chấm (score null) không làm phồng mẫu số tỉ lệ điểm", () => {
    const d = deriveCompetencyDashboard([
      group({
        exerciseId: "e1",
        attempts: [attempt({ score: 4, maxScore: 4 })],
      }),
      group({
        exerciseId: "e2",
        attempts: [attempt({ score: null, maxScore: 10 })],
      }),
    ]);
    expect(d.totalDone).toBe(2); // vẫn đếm là đã nộp
    expect(d.scorePercent).toBe(100); // nhưng không tính vào tỉ lệ điểm
  });

  it("sách mới chỉ có bài đang làm dở vẫn lên thẻ, nhưng chưa tính là đã nộp", () => {
    const d = deriveCompetencyDashboard([
      group({
        attempts: [
          attempt({ attemptId: "dang-lam", submittedAt: null, endedAt: null }),
        ],
      }),
    ]);
    expect(d.totalDone).toBe(0);
    expect(d.scorePercent).toBeNull();
    expect(d.totalBooks).toBe(1);
    expect(d.books[0].doneCount).toBe(0);
    expect(d.books[0].attemptedCount).toBe(1);
    expect(d.books[0].scorePercent).toBeNull();
    expect(
      bookProgressPercent(d.books[0], { total: 4, isSettled: true }),
    ).toBe(25);
  });

  it("group trùng exerciseId (do ghép trang) đếm một lần và giữ lần nộp mới nhất", () => {
    const trang1 = group({
      attempts: [
        attempt({
          attemptId: "cu",
          score: 1,
          maxScore: 10,
          submittedAt: "2026-08-01T10:00:00Z",
        }),
      ],
    });
    const trang2 = group({
      attempts: [
        attempt({
          attemptId: "moi",
          score: 9,
          maxScore: 10,
          submittedAt: "2026-08-05T10:00:00Z",
        }),
      ],
    });

    const d = deriveCompetencyDashboard([trang1, trang2]);

    expect(d.totalDone).toBe(1);
    expect(d.books[0].doneCount).toBe(1);
    expect(d.scorePercent).toBe(90); // bỏ bản trùng thì ra 10 (lượt cũ)
  });

  it("bài đang làm dở tính vào số bài đã học, không tính vào số bài đã nộp", () => {
    const d = deriveCompetencyDashboard([
      group({
        exerciseId: "da-nop",
        attempts: [attempt({ score: 5, maxScore: 10 })],
      }),
      group({
        exerciseId: "dang-lam",
        attempts: [
          attempt({ attemptId: "mo", submittedAt: null, endedAt: null }),
        ],
      }),
    ]);
    expect(d.books[0].doneCount).toBe(1);
    expect(d.books[0].attemptedCount).toBe(2);
  });

  it("bài chỉ có lượt huỷ (không nộp, không dở) không tính vào số bài đã học", () => {
    const d = deriveCompetencyDashboard([
      group({
        exerciseId: "da-nop",
        attempts: [attempt({ score: 5, maxScore: 10 })],
      }),
      group({
        exerciseId: "huy",
        attempts: [attempt({ attemptId: "huy", submittedAt: null })],
      }),
    ]);
    expect(d.totalBooks).toBe(1);
    expect(d.books[0].attemptedCount).toBe(1);
  });

  it("bài không rõ sách vào tổng nhưng không tạo thẻ sách 'ma'", () => {
    const d = deriveCompetencyDashboard([
      group({ bookId: null, attempts: [attempt({ score: 2, maxScore: 4 })] }),
    ]);
    expect(d.totalDone).toBe(1);
    expect(d.scorePercent).toBe(50);
    expect(d.books).toHaveLength(0);
  });
});

describe("bookProgressPercent", () => {
  const bookWith = (attemptedCount: number, scorePercent: number | null) =>
    deriveCompetencyDashboard([
      group({ attempts: [attempt({ score: 3, maxScore: 4 })] }),
    ]).books.map((b) => ({ ...b, attemptedCount, scorePercent }))[0];

  it("tiến độ = số bài đã học / tổng bài tập trong sách", () => {
    expect(
      bookProgressPercent(bookWith(2, 75), { total: 4, isSettled: true }),
    ).toBe(50);
  });

  it("đang tải tổng bài tập → chưa có tiến độ, không tạm hiện tỉ lệ điểm", () => {
    expect(
      bookProgressPercent(bookWith(2, 75), { total: null, isSettled: false }),
    ).toBeNull();
    expect(bookProgressPercent(bookWith(2, 75), undefined)).toBeNull();
  });

  it("tra xong nhưng không có tổng (sách lỗi/rỗng) → dùng tỉ lệ điểm", () => {
    expect(
      bookProgressPercent(bookWith(2, 75), { total: null, isSettled: true }),
    ).toBe(75);
    expect(
      bookProgressPercent(bookWith(2, null), { total: 0, isSettled: true }),
    ).toBeNull();
  });

  it("số bài đã học vượt tổng (dữ liệu lệch) → chặn trần 100%", () => {
    expect(
      bookProgressPercent(bookWith(5, 75), { total: 3, isSettled: true }),
    ).toBe(100);
  });
});
