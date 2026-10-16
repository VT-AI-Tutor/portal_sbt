/**
 * Nhãn hiển thị của các mục trong màn bài học, tách khỏi BookLessonPage vì cùng
 * một nhãn xuất hiện ở nhiều chỗ (ô trên hub, thanh tiêu đề, dải tab PDF) —
 * để rải chuỗi trong một file nghìn dòng thì sửa một chỗ là lệch những chỗ kia.
 *
 * Đây cũng là nơi gom MỌI khác biệt nhãn theo môn — thêm môn thì sửa ở đây,
 * đừng rải chuỗi ra chỗ dùng. Hiện có hai nhóm khác biệt:
 *
 * - Tập viết dùng bộ chữ riêng: sách gọi là "Vở tập viết", tài liệu kèm bài tách
 *   thành hai tab thay vì một (xem `referenceGroups`), và số bài không hiện ra.
 * - Đạo đức, Lịch sử và Địa lí gọi nhóm bài là "Chủ đề" thay vì "Tuần"
 *   (xem `TOPIC_BASED_SUBJECTS`).
 */

import type { LessonExtraMedia } from "@/modules/catalog/api/types";

export interface SubjectRef {
  code?: string | null;
  name?: string | null;
}

export interface LessonLabels {
  /** Ô mở PDF sách trên hub. */
  pdfBook: string;
  /** Nhãn dài của cùng PDF đó: thanh tiêu đề và dải tab Vở ⇄ Đáp án. */
  pdfBookFull: string;
  /**
   * Cho hiện nhãn "Bài N" ở mục lục và trên đầu hub. Sáu quyển Tập viết đánh số
   * bài không khớp với tên bài in trong sách, nên hai con số chọi nhau; môn này
   * bỏ hẳn nhãn thay vì hiện số sai.
   */
  showLessonNumber: boolean;
}

const DEFAULT_LABELS: LessonLabels = {
  pdfBook: "Vở bài tập",
  pdfBookFull: "Vở bài tập PDF",
  showLessonNumber: true,
};

const TAP_VIET_LABELS: LessonLabels = {
  pdfBook: "Vở tập viết",
  pdfBookFull: "Vở tập viết PDF",
  showLessonNumber: false,
};

/**
 * Luồng thật đối chiếu `subject_code` (LCMS trả `tap-viet` cho đúng 6 quyển Vở
 * Tập viết). Luồng preview của admin không có field đó, chỉ có tên môn, nên
 * nhận thêm bằng tên.
 */
export function isTapVietSubject({ code, name }: SubjectRef): boolean {
  return code === "tap-viet" || name === "Tập viết";
}

/**
 * Môn có sách chia theo CHỦ ĐỀ chứ không theo tuần. Mỗi môn khai cả mã lẫn tên
 * vì nhận diện y hệt `isTapVietSubject`: luồng thật đối chiếu `subject_code`,
 * luồng preview của admin không có field đó nên phải nhận bằng tên môn.
 *
 * Thêm môn thì thêm một dòng ở đây, đừng thêm hàm `isXSubject` mới — nhãn chỉ
 * có hai giá trị nên danh sách là đủ.
 */
const TOPIC_BASED_SUBJECTS: ReadonlyArray<{ code: string; name: string }> = [
  { code: "dao-duc", name: "Đạo đức" },
  { code: "lich-su-dia-li", name: "Lịch sử và Địa lí" },
];

export function isTopicBasedSubject({ code, name }: SubjectRef): boolean {
  return TOPIC_BASED_SUBJECTS.some((s) => s.code === code || s.name === name);
}

/**
 * Môn KHÔNG hiện dòng gợi ý thao tác của câu nối chuỗi — NXB 09/2026 báo dòng
 * đó là chữ thừa ở Đạo đức.
 *
 * Để RIÊNG với `TOPIC_BASED_SUBJECTS` dù cùng có Đạo đức: hai luật khác lý do,
 * gộp lại thì thêm môn cho luật này sẽ lặng lẽ đổi luật kia.
 */
const NO_CHAIN_HINT_SUBJECTS: ReadonlyArray<{ code: string; name: string }> = [
  { code: "dao-duc", name: "Đạo đức" },
];

export function hidesChainMatchHint({ code, name }: SubjectRef): boolean {
  return NO_CHAIN_HINT_SUBJECTS.some((s) => s.code === code || s.name === name);
}

/**
 * Nhãn nhỏ trên đầu mỗi thẻ nhóm bài ở mục lục. Mặc định "Tuần" theo phân phối
 * chương trình; các môn trong `TOPIC_BASED_SUBJECTS` chia theo chủ đề, và phụ đề
 * mục lục cũng đã đếm "N chủ đề" — để "Tuần" thì hai chỗ chọi nhau.
 */
export function topicPrefix(subject: SubjectRef): string {
  return isTopicBasedSubject(subject) ? "Chủ đề" : "Tuần";
}

export function lessonLabels(isTapViet: boolean): LessonLabels {
  return isTapViet ? TAP_VIET_LABELS : DEFAULT_LABELS;
}

/** Khoá tab tài liệu — trùng luôn với giá trị `LessonView` để khỏi phải ánh xạ. */
export type ReferenceViewKey = "reference-video" | "reference-image";

export interface ReferenceGroup {
  key: ReferenceViewKey;
  label: string;
  items: LessonExtraMedia[];
}

const REFERENCE_VIDEO_LABEL = "Video hướng dẫn";
const REFERENCE_IMAGE_LABEL = "Hình minh hoạ";

/**
 * Tài liệu kèm bài của môn Tập viết có hai loại khác hẳn nhau: LCMS gắn
 * `ex_media_type: "audio"` cho video hướng dẫn (.mp4) và `"ref_picture"` cho
 * tranh tham khảo (.jpg). Bài mang cả hai thì tách thành hai tab riêng, mỗi tab
 * đúng tên loại của nó; bài chỉ có một loại thì vẫn một tab.
 *
 * `extraMediaType` bên lcmsAdapter suy loại theo đuôi file TRƯỚC rồi mới tin
 * nhãn của API, nên với dữ liệu hiện tại (mọi URL đều có đuôi .mp4/.jpg) tới
 * đây chỉ còn `video` / `image`. Nhánh `"audio"` KHÔNG phải code chết, đừng gỡ:
 * nó nhận file âm thanh thật (.mp3) lẫn chính video hướng dẫn khi URL không có
 * đuôi nhận ra được — lúc đó adapter rơi về nhãn `"audio"` của LCMS. Cả hai đều
 * thuộc tab video, không phải hình minh hoạ.
 *
 * Môn khác giữ nguyên một tab "Video hướng dẫn" ôm mọi loại như trước: chỉ môn
 * Tập viết mới có chữ đã duyệt cho tab tranh.
 */
export function referenceGroups(
  isTapViet: boolean,
  items: readonly LessonExtraMedia[],
): ReferenceGroup[] {
  if (items.length === 0) return [];
  if (!isTapViet) {
    return [
      { key: "reference-video", label: REFERENCE_VIDEO_LABEL, items: [...items] },
    ];
  }
  const videos = items.filter((m) => m.type === "video" || m.type === "audio");
  const images = items.filter((m) => m.type === "image");
  const groups: ReferenceGroup[] = [];
  if (videos.length > 0) {
    groups.push({
      key: "reference-video",
      label: REFERENCE_VIDEO_LABEL,
      items: videos,
    });
  }
  if (images.length > 0) {
    groups.push({
      key: "reference-image",
      label: REFERENCE_IMAGE_LABEL,
      items: images,
    });
  }
  return groups;
}
