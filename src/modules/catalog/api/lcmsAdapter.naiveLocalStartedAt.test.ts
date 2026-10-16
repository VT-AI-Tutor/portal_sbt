// @vitest-environment jsdom
/**
 * NGUYÊN NHÂN THẬT của "chấm câm: nộp xong, Thoát, hub vẫn mời Tiếp tục làm bài".
 * Dữ liệu dưới đây là số ĐO ĐƯỢC trên môi trường TEST ngày 04/09/2026.
 *
 * `startedAt` của /current-attempt là NAIVE và nằm theo múi giờ của SERVER — thứ
 * KHÁC NHAU giữa các môi trường:
 *   - prod (qr.nxbgd.vn): "2026-09-04T14:09:17.863612" trong khi giờ máy là 21:09
 *     (+07) ⇒ naive là UTC.
 *   - TEST: attempt 439 `startedAt` "2026-09-04T21:23:53.168211", còn lần nộp của
 *     CHÍNH NÓ là "2026-09-04T14:24:00.722+00:00" ⇒ naive là giờ Việt Nam, lệch -7h.
 *     Ghép cặp: exercise-list nói attempt 439 ĐÃ ĐÓNG, mà history (sắp xếp mới
 *     nhất trước) không có lần nộp nào sau 21:23Z — nên 439 không thể bắt đầu lúc
 *     21:23Z rồi được nộp. Vậy naive không phải UTC. (Tổng điểm 16 câu = 33 =
 *     maxScore chỉ cho biết 439 thuộc bài 12004, chưa đủ để ghép cặp.)
 *
 * Hiểu naive là UTC ⇒ `submittedAt >= startedAt` thành SAI ⇒ guard không chạy ⇒
 * lượt ĐÃ NỘP bị trả về như còn dở ⇒ hub mời "Tiếp tục làm bài". Sai BỀN: F5 vẫn thế.
 *
 * Lối ra không phải là sửa phép so (chuỗi naive không mang múi giờ, nới biên độ
 * thì đóng nhầm lượt đang làm dở) mà là hỏi nguồn có offset rõ ràng:
 * `/submission/exercise-list` trả `endedAt`/`submittedAt` kèm "+00:00".
 */
process.env.TZ = "Asia/Ho_Chi_Minh";

import { afterEach, describe, expect, it, vi } from "vitest";
import { lcmsGetCurrentAttempt } from "@/core/api/lcmsAdapter";

const envelope = (data: unknown, total: number) => ({
  success: true,
  data,
  total: String(total),
});

// Nguyên văn số đo trên TEST.
const ATTEMPT_439 = {
  attemptId: "439",
  startedAt: "2026-09-04T21:23:53.168211", // naive GIỜ ĐỊA PHƯƠNG (+07)
  answers: [{ questionId: "8078", userAnswer: "", isCorrect: false, score: 1 }],
};
const SUBMISSION_219 = {
  submissionId: "219",
  bookId: "12",
  bookTitle: "Vở bài tập Toán 1 - Tập một",
  lessonId: "12004",
  exerciseId: "12004",
  exerciseTitle: "So sánh số",
  score: 0,
  maxScore: 33,
  gradingStatus: "pending",
  submittedAt: "2026-09-04T14:24:00.722+00:00",
};
const LISTED_CLOSED = {
  exerciseId: "12004",
  bookId: "12",
  name: "So sánh số",
  attempts: [
    {
      attemptId: "439",
      status: 4,
      startedAt: "2026-09-04T14:23:53.168+00:00",
      endedAt: "2026-09-04T14:24:00.700+00:00",
      submittedAt: "2026-09-04T14:24:00.722+00:00",
      maxScore: 33,
      gradingStatus: 1,
    },
  ],
};

/** `exerciseListPages = null` ⇒ endpoint không dùng được ⇒ rơi vào đường lùi. */
function stubFetch(exerciseListPages: unknown[][] | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      let body: unknown;
      if (u.includes("/current-attempt")) {
        body = envelope(ATTEMPT_439, 1);
      } else if (u.includes("/submission/exercise-list")) {
        if (exerciseListPages === null) {
          body = { success: false, message: "not-found", data: null, total: null };
        } else {
          const page = Number(/[?&]page=(\d+)/.exec(u)?.[1] ?? "1");
          const total = exerciseListPages.reduce((n, p) => n + p.length, 0);
          body = envelope(exerciseListPages[page - 1] ?? [], total);
        }
      } else if (u.includes("/submission/history")) {
        body = envelope(
          {
            items: [SUBMISSION_219],
            pagination: { page: 1, limit: 20, total: 38 },
          },
          38,
        );
      } else {
        body = { success: false, message: "not-found", data: null, total: null };
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("lcmsGetCurrentAttempt — startedAt naive theo giờ SERVER (số đo TEST)", () => {
  it("lượt đã nộp KHÔNG được báo là còn dở, dù startedAt naive lệch -7h", async () => {
    stubFetch([[LISTED_CLOSED]]);
    expect(await lcmsGetCurrentAttempt("12004", "12004")).toBeNull();
  });

  it("KHÔNG có lessonId ⇒ không hỏi exercise-list, đi thẳng đường lùi", async () => {
    // Bản không lọc vừa nặng vừa không chặn được (đo: 4,1 KB và lớn dần), mà chỉ
    // màn bài GV giao rơi vào đây — màn đó không có hub nên không có nhãn để sai.
    stubFetch([[LISTED_CLOSED]]);
    const res = await lcmsGetCurrentAttempt("12004");
    expect(res?.attemptId).toBe("439");
  });

  it("ĐƯỜNG LÙI vẫn dính bẫy múi giờ — đó chính là hành vi đang lỗi trên test", async () => {
    // Khoá lại để thấy rõ: mất exercise-list là con bug quay lại nguyên vẹn.
    // Không phải hành vi mong muốn, chỉ là hiện trạng của đường lùi.
    stubFetch(null);
    const res = await lcmsGetCurrentAttempt("12004", "12004");
    expect(res?.attemptId).toBe("439");
  });
});
