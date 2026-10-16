/**
 * Đường dẫn trang chi tiết một bài luyện tập.
 *
 * Một nơi duy nhất dựng path để thẻ trên landing và khai báo route không lệch
 * nhau — đổi cấu trúc URL chỉ sửa ở đây (và ở `PRACTICE_TOPIC_ROUTE`).
 */
export const PRACTICE_TOPIC_ROUTE =
  "/luyen-tap/:subjectCode/:level/:contentCode";

export function practiceTopicPath(
  subjectCode: string,
  level: string,
  contentCode: string,
): string {
  return `/luyen-tap/${encodeURIComponent(subjectCode)}/${encodeURIComponent(level)}/${encodeURIComponent(contentCode)}`;
}
