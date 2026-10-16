/**
 * Chủ đề nổi bật theo Khối/Môn — v1 dùng config tĩnh trong FE (spec §7).
 * Endpoint công khai lấy chủ đề từ bank thật là việc BE sau (ghi GAP khi làm xong plan này).
 */
export interface LandingTopic {
  icon: string;
  title: string;
  questionCount?: number;
  mixed?: boolean;
}

// LƯU Ý: số câu là dữ liệu thật từ bank, cần Owner xác nhận trước khi ship (spec §4).
// Chưa xác nhận được trong phiên này nên KHÔNG kèm questionCount — UI ẩn phần đếm
// (xem TopicsSection.tsx: chỉ hiển thị "· N câu" khi questionCount !== undefined).
const TOPICS: Record<string, LandingTopic[]> = {
  "3|toan": [
    { icon: "🔢", title: "Phép nhân trong bảng" },
    { icon: "➗", title: "Phép chia hết, chia có dư" },
    { icon: "📏", title: "So sánh số trong phạm vi 1000" },
    { icon: "🌀", title: "Đề trộn tổng hợp tuần này", mixed: true },
  ],
};

/** [] nếu chưa soạn chủ đề cho cặp Khối/Môn này — TopicsSection tự ẩn. */
export function getTopics(level: string, subjectCode: string): LandingTopic[] {
  return TOPICS[`${level}|${subjectCode}`] ?? [];
}
