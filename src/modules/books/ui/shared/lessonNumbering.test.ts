/**
 * Số "Bài N" phải chạy suốt cả sách, không đếm lại từ 1 ở mỗi chủ đề — mục lục
 * và màn bài học đọc chung bảng này nên lệch ở đây là lệch ở cả hai chỗ.
 */
import { describe, expect, it } from "vitest";
import { isUnnumberedLessonTitle, lessonNumbersById } from "./lessonNumbering";

const chapters = [
  {
    lessons: [
      { id: "a", title: "Bài đầu" },
      { id: "b", title: "Bài tiếp theo" },
    ],
  },
  { lessons: [{ id: 3, title: "Bài cuối" }] },
];

describe("lessonNumbersById", () => {
  it("đánh số nối tiếp qua các chủ đề, theo thứ tự mục lục", () => {
    expect(lessonNumbersById(chapters)).toEqual({ a: 1, b: 2, "3": 3 });
  });

  it("bài không thuộc sách thì không có số", () => {
    expect(lessonNumbersById(chapters)["z"]).toBeUndefined();
  });

  it("không đánh số hoặc tăng bộ đếm cho mục Ôn tập", () => {
    const firstSixteen = Array.from({ length: 16 }, (_, index) => ({
      id: `b${index + 1}`,
      title: `Bài ${index + 1}`,
    }));
    const withReviews = [
      {
        lessons: [
          ...firstSixteen,
          { id: "midterm", title: "Ôn tập giữa kì học kì 1" },
        ],
      },
      {
        lessons: [
          { id: "b17", title: "Vẽ màu" },
          { id: "b18", title: "Đồng cỏ nở hoa" },
          { id: "final", title: "Ôn tập cuối kì học kì 1" },
        ],
      },
    ];

    const numbers = lessonNumbersById(withReviews);
    expect(numbers.midterm).toBeUndefined();
    expect(numbers.b16).toBe(16);
    expect(numbers.b17).toBe(17);
    expect(numbers.b18).toBe(18);
    expect(numbers.final).toBeUndefined();
  });
});

describe("isUnnumberedLessonTitle", () => {
  // Mọi cách viết CÓ THẬT trong bản xuất 10 quyển VBT Tiếng Việt (401 bài).
  it.each([
    "Ôn tập giữa học kì 1",
    "Ôn tập cuối học kì 1",
    "Ôn tập giữa học kì 2",
    "Ôn tập cuối học kì 2",
    "Ôn tập giữa học kì I",
    "Ôn tập cuối học kì I",
    "Ôn tập giữa học kì II",
    "Ôn tập cuối năm học",
    "  ôn   tập cuối kì học kì 1  ",
    "ÔN TẬP CUỐI HỌC KÌ 1",
    // Không có chữ "học" ở giữa.
    "Ôn tập cuối kì",
    "Ôn tập giữa kì",
    "Ôn tập cuối kì 1",
    // "kỳ" viết bằng Y — chuẩn ngang với "kì", sách dùng cả hai. Bản xuất hiện
    // có toàn dùng "kì" nên nhóm này từng lọt mà không ai thấy.
    "Ôn tập cuối kỳ",
    "Ôn tập giữa kỳ",
    "Ôn tập cuối học kỳ 1",
    "Ôn tập giữa học kỳ II",
    // Không có chữ "học" sau "năm".
    "Ôn tập cuối năm",
  ])("bỏ số cho ôn tập theo kì: %s", (title) => {
    expect(isUnnumberedLessonTitle(title)).toBe(true);
  });

  // "Ôn tập" thường VẪN là một bài có số — lớp 1 có 28 bài loại này, và LCMS
  // cũng đánh mã `bai5`/`bai10`/`bai15` cho chúng. Bỏ số cả loại này là sai.
  it.each([
    "Ôn tập",
    "Ôn tập (tiếp theo)",
    "Ôn luyện",
    "Bài ôn tập",
    "Ôn tậpchung",
    "Vẽ màu",
    // Có "kì" nhưng không phải bài ôn tập — điều kiện tiền tố phải chặn.
    "Hành tinh kì lạ",
    "Kì diệu rừng xanh",
  ])(
    "không bỏ số nhầm: %s",
    (title) => {
      expect(isUnnumberedLessonTitle(title)).toBe(false);
    },
  );
});

/**
 * Phép đếm cho phụ đề "N bài học" phải khớp số nhãn hiện ra ngay bên dưới.
 * Đếm thô `lessons.length` là sai: nó tính cả bài ôn tập theo kì vốn không mang số.
 */
describe("số bài dùng cho phụ đề", () => {
  it("bằng đúng số nhãn 'Bài N' hiện ra", () => {
    const chapters = [
      {
        lessons: [
          { id: "a", title: "Bài 5: Bàn tay cô giáo" },
          { id: "b", title: "Ôn tập" },
          { id: "c", title: "Bài 8: Đò ngang" },
          { id: "d", title: "Ôn tập cuối học kì 1" },
        ],
      },
    ];

    const numbers = lessonNumbersById(chapters);

    expect(Object.keys(numbers)).toHaveLength(3);
    expect(chapters[0].lessons.length).toBe(4);
  });
});
