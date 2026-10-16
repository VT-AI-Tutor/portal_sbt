import { describe, expect, it } from "vitest";
import { freeLessonCount, isLessonExerciseLocked } from "./exerciseLockGate";

describe("freeLessonCount", () => {
  it("1/2 số bài, làm tròn LÊN", () => {
    expect(freeLessonCount(8)).toBe(4);
    expect(freeLessonCount(5)).toBe(3);
    expect(freeLessonCount(4)).toBe(2);
    expect(freeLessonCount(1)).toBe(1);
  });

  it("sách chưa biết số bài → không có bài nào tính là làm thử", () => {
    expect(freeLessonCount(0)).toBe(0);
    expect(freeLessonCount(-3)).toBe(0);
  });
});

describe("isLessonExerciseLocked", () => {
  const book8 = {
    passConfigured: true,
    bookUnlocked: false,
    totalLessons: 8,
  };

  it("sách 8 bài: bài 1–4 tự do, từ bài 5 trở đi bị khoá", () => {
    const lockedByIndex = [0, 3, 4, 5, 7].map((lessonIndex) =>
      isLessonExerciseLocked({ ...book8, lessonIndex }),
    );
    expect(lockedByIndex).toEqual([false, false, true, true, true]);
  });

  it("nhập đúng mật khẩu rồi thì mở nốt các bài còn lại của cuốn đó", () => {
    expect(
      isLessonExerciseLocked({ ...book8, lessonIndex: 7, bookUnlocked: true }),
    ).toBe(false);
  });

  it("không cấu hình mật khẩu = không khoá bài nào", () => {
    expect(
      isLessonExerciseLocked({
        ...book8,
        lessonIndex: 7,
        passConfigured: false,
      }),
    ).toBe(false);
  });

  it("chưa tra được vị trí bài hay số bài của sách thì KHÔNG khoá", () => {
    // Mục lục về chậm mà đã khoá thì học sinh bị chặn cả cuốn chỉ vì mạng.
    expect(isLessonExerciseLocked({ ...book8, lessonIndex: -1 })).toBe(false);
    expect(
      isLessonExerciseLocked({ ...book8, lessonIndex: 3, totalLessons: 0 }),
    ).toBe(false);
  });
});
