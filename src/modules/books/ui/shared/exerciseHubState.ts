/**
 * Trạng thái mục "bài tập" của hub bài học — hàm THUẦN để test được mà không
 * phải dựng cả `BookLessonPage`.
 *
 * `finished` (lượt vừa nộp xong TRONG phiên này) phải được xét TRƯỚC `resume`:
 * "còn lượt dở" là suy đoán tốt-nhất-có-thể từ server, còn "vừa nộp xong" là
 * việc chính runner vừa làm nên chắc chắn hơn. Với LCMS, `getCurrentAttempt`
 * luôn trả về lượt gần nhất KỂ CẢ khi đã nộp, và chỉ loại nó ra được nhờ đối
 * chiếu `/submission/history` — lịch sử chưa kịp thấy lần nộp vừa xong (chính
 * `lcmsSubmitAttempt` cũng đã phải phòng trường hợp này), lỗi mạng, hay lần nộp
 * rơi ngoài trang lịch sử đều khiến lượt VỪA NỘP bị báo là còn dở. Khi đó hub
 * mời "Tiếp tục làm bài" cho một lượt đã chốt.
 */
export type ExerciseHubState = "resume" | "finished" | "review" | "start";

export function resolveExerciseHubState({
  hasToken,
  hasPendingAttempt,
  finishedThisSession,
  hasLastSubmission,
}: {
  /** Đã đăng nhập chưa — khách không có lượt làm nào để tiếp tục hay xem lại. */
  hasToken: boolean;
  /** Server báo còn lượt đang làm dở. */
  hasPendingAttempt: boolean;
  /** Runner đã nộp xong lượt này trong phiên hiện tại. */
  finishedThisSession: boolean;
  /** Đã từng nộp bài này ở phiên trước. */
  hasLastSubmission: boolean;
}): ExerciseHubState {
  if (finishedThisSession) return "finished";
  if (hasToken && hasPendingAttempt) return "resume";
  if (hasToken && hasLastSubmission) return "review";
  return "start";
}
