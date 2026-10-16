/**
 * Khoá thứ tự ưu tiên của hub bài học.
 *
 * Ca gốc: chấm CÂM, học sinh làm hết câu rồi Nộp bài → runner ở lại màn soát
 * đáp án → bấm "Thoát". Lượt đã chốt, nhưng `getCurrentAttempt` của LCMS vẫn
 * báo còn lượt dở (lịch sử chưa kịp thấy lần nộp) nên hub mời "Tiếp tục làm
 * bài" thay vì "Em đã làm xong bài này".
 */
import { describe, expect, it } from "vitest";
import { resolveExerciseHubState } from "./exerciseHubState";

const base = {
  hasToken: true,
  hasPendingAttempt: false,
  finishedThisSession: false,
  hasLastSubmission: false,
};

describe("resolveExerciseHubState", () => {
  it("vừa nộp xong THẮNG 'còn lượt dở' của server", () => {
    expect(
      resolveExerciseHubState({
        ...base,
        finishedThisSession: true,
        hasPendingAttempt: true,
      }),
    ).toBe("finished");
  });

  it("vừa nộp xong, server im lặng → vẫn là đã xong", () => {
    expect(
      resolveExerciseHubState({ ...base, finishedThisSession: true }),
    ).toBe("finished");
  });

  it("chưa nộp trong phiên, còn lượt dở → mời tiếp tục", () => {
    expect(resolveExerciseHubState({ ...base, hasPendingAttempt: true })).toBe(
      "resume",
    );
  });

  it("khách (chưa đăng nhập) không được mời tiếp tục lượt dở", () => {
    expect(
      resolveExerciseHubState({
        ...base,
        hasToken: false,
        hasPendingAttempt: true,
      }),
    ).toBe("start");
  });

  it("đã nộp ở phiên trước, không còn lượt dở → mời xem kết quả", () => {
    expect(resolveExerciseHubState({ ...base, hasLastSubmission: true })).toBe(
      "review",
    );
  });

  it("lượt dở được ưu tiên hơn kết quả cũ", () => {
    expect(
      resolveExerciseHubState({
        ...base,
        hasPendingAttempt: true,
        hasLastSubmission: true,
      }),
    ).toBe("resume");
  });

  it("chưa làm gì → mời làm bài", () => {
    expect(resolveExerciseHubState(base)).toBe("start");
  });
});
