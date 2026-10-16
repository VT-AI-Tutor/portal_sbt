// @vitest-environment jsdom
/**
 * Hai màn từng nói NGƯỢC nhau về cùng một lượt: "Bài tập của tôi" đọc `endedAt`
 * của attempt (/submission/exercise-list) nên báo đã xong, còn hub bài học đối
 * chiếu /submission/history nên vẫn mời "Tiếp tục làm bài". Lịch sử là nguồn
 * gián tiếp và có cửa sổ (20 dòng, gộp mọi bài) — bài nộp rơi ra ngoài, hoặc
 * chưa kịp thấy, là hub sai. Và sai BỀN: tải lại trang vẫn sai.
 *
 * `endedAt` mới là lời khẳng định thẳng của LCMS; chỉ khi không tra được mới
 * lùi về so mốc thời gian với lịch sử.
 */
process.env.TZ = "Asia/Ho_Chi_Minh";

import { afterEach, describe, expect, it, vi } from "vitest";
import { lcmsGetCurrentAttempt } from "@/core/api/lcmsAdapter";

const envelope = (data: unknown, total = 1) => ({
  success: true,
  data,
  total: String(total),
});

const ATTEMPT = {
  attemptId: "77",
  startedAt: "2026-07-20T12:19:24.152539",
  answers: [
    { questionId: "2072", userAnswer: '["3","4"]', isCorrect: false, score: 1 },
  ],
};

/** `endedAt` quyết định; history LUÔN rỗng để chứng minh không còn dựa vào nó. */
function stubFetch(endedAt: string | null, listed = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const body = u.includes("/current-attempt")
        ? envelope(ATTEMPT, 1)
        : u.includes("/submission/exercise-list")
          ? envelope(
              listed
                ? [
                    {
                      exerciseId: "32001",
                      bookId: "32",
                      name: "x",
                      attempts: [
                        {
                          attemptId: "77",
                          status: endedAt ? 4 : 6,
                          startedAt: ATTEMPT.startedAt,
                          endedAt,
                          maxScore: 3,
                          gradingStatus: 1,
                        },
                      ],
                    },
                  ]
                : [],
              1,
            )
          : u.includes("/submission/history")
            ? envelope(
                { items: [], pagination: { page: 1, limit: 20, total: 0 } },
                0,
              )
            : { success: false, message: "not-found", data: null, total: null };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("lcmsGetCurrentAttempt — endedAt là nguồn quyết định", () => {
  it("attempt có endedAt ⇒ đã xong, dù lịch sử không thấy lần nộp nào", async () => {
    stubFetch("2026-07-20T12:25:00.000+00:00");
    expect(await lcmsGetCurrentAttempt("32001", "32")).toBeNull();
  });

  it("attempt endedAt null ⇒ còn dở, khỏi phải hỏi lịch sử", async () => {
    stubFetch(null);
    const res = await lcmsGetCurrentAttempt("32001", "32");
    expect(res?.attemptId).toBe("77");
  });

  it("không tra được lượt trong exercise-list ⇒ lùi về đối chiếu lịch sử", async () => {
    // Lịch sử rỗng ⇒ hành vi cũ: giữ attempt.
    stubFetch(null, false);
    expect(await lcmsGetCurrentAttempt("32001", "32")).not.toBeNull();
  });
});
