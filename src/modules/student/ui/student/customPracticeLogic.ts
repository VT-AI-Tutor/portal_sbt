/**
 * Logic thuần cho tab Tự luyện (CustomPracticeBuilder) — tách khỏi component
 * để test bằng vitest (pattern như modeToApi/studentSubjects).
 */
import type { PracticeTopic, StudyPathTree } from "@/modules/student/api/practiceApi";
import type { SubjectSlice } from "@/modules/student/api/hooks";

export interface TopicChipItem {
  /** "all" (Tổng hợp), `${subjectCode}:${contentCode}` hoặc `sp:${topicId}`. */
  key: string;
  /** Môn suy ra khi chọn chip; null = Tổng hợp lúc lọc "Tất cả" (phải chọn môn trước). */
  subjectCode: string | null;
  /** null = Tổng hợp (không gửi ref, lấy cả môn). */
  contentCode: string | null;
  /** Bài của LỘ TRÌNH (Owner 21/08) — có giá trị thì phiên scope theo unit
   *  của bài (ref.study_topic_id), thay cho chip mã ContentNode thô. */
  studyTopicId?: string | null;
  label: string;
}

/**
 * Chip chủ đề theo BÀI CỦA LỘ TRÌNH (Owner 21/08): học sinh nghĩ theo "Bài
 * 23 đang học", không theo mã ContentNode. Chỉ lấy bài có unit (bài chưa gắn
 * unit thì phiên sẽ 422 — khỏi bày ra); giữ thứ tự chương → bài của cây.
 */
export function buildStudyTopicChips(
  subject: string,
  tree: StudyPathTree | null | undefined,
): TopicChipItem[] {
  if (!tree || subject === "all") {
    return [];
  }
  const topics = [
    ...tree.sections.flatMap((s) => s.topics),
    ...tree.cross_cutting_topics,
  ];
  return topics
    .filter((t) => t.units.length > 0)
    .map((t) => ({
      key: `sp:${t.id}`,
      subjectCode: subject,
      contentCode: null,
      studyTopicId: t.id,
      label: t.title,
    }));
}

export const COUNT_PRESETS = [5, 10, 15, 20, 30] as const;
export const COUNT_MIN = 1;
export const COUNT_MAX = 30; // khớp cap BE question_count max:30

export function buildTopicChips(
  subject: string,
  topics: PracticeTopic[],
  bySubject: SubjectSlice<PracticeTopic>[],
  subjectLabel: (code: string) => string,
  studyTopicChips: TopicChipItem[] = [],
): TopicChipItem[] {
  const tongHop: TopicChipItem = {
    key: "all",
    subjectCode: subject === "all" ? null : subject,
    contentCode: null,
    label: "Tổng hợp",
  };
  if (subject !== "all") {
    // Môn có LỘ TRÌNH → chip là BÀI của lộ trình (tên thật); chip mã
    // ContentNode chỉ còn là fallback cho môn chưa có lộ trình.
    if (studyTopicChips.length > 0) {
      return [tongHop, ...studyTopicChips];
    }
    return [
      tongHop,
      ...topics.map((t) => ({
        key: `${subject}:${t.content_code}`,
        subjectCode: subject,
        contentCode: t.content_code,
        label: t.label,
      })),
    ];
  }
  return [
    tongHop,
    ...bySubject.flatMap((s) =>
      (s.data ?? []).map((t) => ({
        key: `${s.subjectCode}:${t.content_code}`,
        subjectCode: s.subjectCode,
        contentCode: t.content_code,
        label: `${subjectLabel(s.subjectCode)} · ${t.label}`,
      })),
    ),
  ];
}

export function parseCustomCount(
  raw: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const n = Number(raw.trim());
  if (!Number.isInteger(n)) {
    return { ok: false, error: "Em nhập số nguyên nhé." };
  }
  if (n < COUNT_MIN || n > COUNT_MAX) {
    return { ok: false, error: `Chọn từ ${COUNT_MIN} đến ${COUNT_MAX} câu nhé.` };
  }
  return { ok: true, value: n };
}

/**
 * Vì sao chưa bắt đầu luyện tập được — câu chữ hiện NGAY cạnh nút "Bắt đầu luyện tập".
 *
 * Nút khoá mà không nói lý do thì học sinh bấm mãi không được rồi bỏ cuộc: ca hay gặp nhất là
 * bộ lọc môn đang để "Tất cả" nên chủ đề chỉ có "Tổng hợp", mà Tổng hợp thì không suy ra được
 * môn để lấy câu (báo lỗi nghiệm thu 19/8). `null` = không có gì cản, nút mở.
 */
export function practiceBlockedReason(state: {
  pending: boolean;
  needSubject: boolean;
  hasLevel: boolean;
  count: number | null;
}): string | null {
  if (state.pending) return null;
  if (state.needSubject) return "Chọn một môn ở trên để bắt đầu nhé.";
  if (!state.hasLevel) return "Chưa xác định được khối lớp của em — kiểm tra lại Hồ sơ nhé.";
  if (state.count === null) return "Nhập số câu hợp lệ để bắt đầu.";

  return null;
}
