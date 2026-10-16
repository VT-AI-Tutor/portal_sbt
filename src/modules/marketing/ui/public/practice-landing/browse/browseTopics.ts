import { getSubjectDisplay } from "@/core/reference";
import type { PracticeTopicItem } from "@/modules/catalog/api/types";
import {
  COLOR_GRADIENT,
  COLOR_PATTERN,
  type CoverPattern,
} from "../../shared/subjectCoverTokens";

/** Một bài luyện tập (chủ đề) trên lưới duyệt, đã sẵn sàng để render. */
export interface BrowseTopic {
  key: string;
  contentCode: string;
  label: string;
  subjectCode: string;
  subjectLabel: string;
  level: string;
  questionAvailable: number;
  gradient: string;
  pattern: CoverPattern;
}

const FALLBACK_GRADIENT = "from-primary to-fun";
const FALLBACK_PATTERN: CoverPattern = "grid";

/**
 * Chuẩn hoá dữ liệu từ `GET /catalog/practice/topics` sang dạng hiển thị.
 *
 * Sắp theo lớp → môn → tên chủ đề; so sánh lớp bằng `numeric` để "Lớp 2" đứng
 * trước "Lớp 10" (máy chủ sắp theo chuỗi nên chưa đủ).
 */
export function toBrowseTopics(items: PracticeTopicItem[]): BrowseTopic[] {
  return items
    .map((t): BrowseTopic => {
      const display = getSubjectDisplay(t.subject_code, t.subject_name);
      return {
        key: `${t.level}|${t.subject_code}|${t.content_code}`,
        contentCode: t.content_code,
        label: t.label,
        subjectCode: t.subject_code,
        subjectLabel: display.label,
        level: t.level,
        questionAvailable: t.question_available,
        gradient: COLOR_GRADIENT[display.color] ?? FALLBACK_GRADIENT,
        pattern: COLOR_PATTERN[display.color] ?? FALLBACK_PATTERN,
      };
    })
    .sort((a, b) => {
      if (a.level !== b.level)
        return a.level.localeCompare(b.level, "vi", { numeric: true });
      if (a.subjectLabel !== b.subjectLabel)
        return a.subjectLabel.localeCompare(b.subjectLabel, "vi");
      return a.label.localeCompare(b.label, "vi");
    });
}

/**
 * Lọc theo lớp + môn đang chọn. `level = "all"` và `subjectCode = null` nghĩa là
 * không lọc chiều đó.
 *
 * Lọc phía client dù endpoint cũng nhận `level`/`subject`: landing tải cả lưới
 * bằng MỘT request rồi lọc tại chỗ, nên đổi chip không sinh request mới.
 */
export function filterBrowseTopics(
  topics: BrowseTopic[],
  level: string,
  subjectCode: string | null,
): BrowseTopic[] {
  return topics.filter(
    (t) =>
      (level === "all" || t.level === level) &&
      (subjectCode === null || t.subjectCode === subjectCode),
  );
}

/**
 * Các môn THỰC SỰ có bài luyện tập ở khối đang chọn (`"all"` = mọi khối).
 *
 * Cố tình KHÔNG tính tới môn đang chọn: đây là câu hỏi "khối này có những môn
 * nào", không phải "bộ lọc hiện tại còn lại gì" — nếu tính cả môn đang chọn thì
 * sidebar chỉ còn đúng một dòng sau khi bấm.
 */
export function subjectCodesForLevel(
  topics: BrowseTopic[],
  level: string,
): Set<string> {
  return new Set(
    topics
      .filter((t) => level === "all" || t.level === level)
      .map((t) => t.subjectCode),
  );
}
