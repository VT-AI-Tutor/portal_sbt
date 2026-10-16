/**
 * Máy khách BÀI GIẢNG SỐ cho giáo viên — soạn/duyệt bài giảng do trợ lý AI
 * dựng khung, gắn câu hỏi, và đóng băng (finalize) trước khi phát cho lớp.
 *
 * Cùng khuôn fetch + JWT + phong bì `{success,data}` với teacherBlueprintApi.ts.
 *
 * `updateSection` nhận payload MỘT PHẦN: chỉ truyền khoá nào muốn đổi. Các
 * trường khai `?:` (optional), KHÔNG khai `| null` — `JSON.stringify` tự bỏ
 * khoá `undefined` khỏi thân yêu cầu, nên gửi riêng `question_ids` (không kèm
 * `blocks`/`slides`) là hợp lệ và không bị máy chủ hiểu nhầm là sửa tay.
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";

const API_BASE = getAuthenticatedApiBaseUrl();
const json = { "Content-Type": "application/json" };

export type LectureSectionKey =
  | "khoidong"
  | "hinhthanh"
  | "luyentap"
  | "vandung";

export interface LectureBlock {
  type: "heading" | "text" | "formula" | "example";
  content: string;
}

export interface LectureSlide {
  layout: "title" | "bullets" | "text" | "example";
  title: string;
  bullets?: string[];
  content?: string;
  notes?: string;
}

/**
 * Đặc tả quiz máy chủ đã LƯU trên chính section (commit `467c604` backend) —
 * BA trạng thái phân biệt bằng khoá `quiz` của `LectureSection`, xem đó.
 * `count` là nguồn thật duy nhất để biết "hoạt động này có cần quiz không";
 * `level_code` chỉ có mặt khi `count > 0`.
 */
export interface LectureSectionQuiz {
  count: number;
  level_code?: "biet" | "hieu" | "vandung" | "vandungcao";
}

export interface LectureSection {
  key: LectureSectionKey;
  title: string;
  objective: string;
  blocks: LectureBlock[];
  slides: LectureSlide[];
  question_ids: string[];
  questions_snapshot?: unknown[];
  generated_at: string | null;
  edited_at: string | null;
  /**
   * Review vòng 2 (Nghiêm trọng) — đặc tả quiz máy chủ đã XÉT cho hoạt động
   * này, BA trạng thái:
   *  - VẮNG MẶT (`undefined`): "chưa biết" — hoạt động chưa từng sinh nội
   *    dung thành công lần nào, HOẶC bài giảng cũ từ trước khi máy chủ lưu
   *    trường này. KHÔNG được suy ra là lỗi.
   *  - `{count: 0}`: "đã xét, không cần" — mô hình đề xuất 0 câu, hoặc use
   *    case bỏ hẳn khoá quiz khi sinh thành công. HỢP LỆ, không phải lỗi.
   *  - `{count: n>0, level_code}`: "có đề xuất thật" — chỉ ca này, kết hợp
   *    `question_ids` rỗng, mới đúng là dây chuyền rớt mạng ở bước bốc/gắn
   *    quiz. Một khi lượt sinh đã chạy THÀNH CÔNG cho hoạt động này thì khoá
   *    `quiz` luôn có mặt từ đó trở đi (một trong ba dạng trên).
   *
   * Đọc trường này qua `sectionMissingQuiz()` (lectureFinalizeGate.ts) —
   * KHÔNG tự suy "thiếu quiz" từ `question_ids.length === 0` một mình, vì
   * `{count: 0}`/vắng mặt cũng khiến `question_ids` rỗng mà KHÔNG phải lỗi.
   */
  quiz?: LectureSectionQuiz;
}

export interface TeacherLecture {
  id: string;
  title: string;
  subject_code: string;
  subject: string;
  level: string;
  content_code: string;
  outcome_codes: string[];
  status: "draft" | "ready";
  class_context: { class_id?: string; session_id?: string } | null;
  sections: LectureSection[];
  created_at: string;
  updated_at: string;
}

export interface LectureQuizSpec {
  count: number;
  level_code: string;
}

/**
 * Việc 1/2 — MỘT lớp/tiết mà bài giảng đang gắn tới, từ `GET /{id}/links`.
 * Đây là nguồn sự thật thay cho `TeacherLecture.class_context` (trường ghi
 * MỘT LẦN lúc tạo, tuỳ chọn, không theo kịp khi gắn thêm lớp khác hoặc gắn
 * lần đầu sau khi soạn xong bỏ trống). Máy chủ chỉ trả liên kết `active` và
 * đã lọc theo quyền lớp của giáo viên gọi — không cần lọc lại ở giao diện.
 */
export interface LectureLinkRow {
  link_id: string;
  class_id: string;
  class_name: string;
  session_id: string | null;
  session_title: string | null;
  release_at: string | null;
  visibility: "enrolled_only" | "instructor_only" | "public";
}

export interface AttachLectureInput {
  class_id: string;
  session_id: string;
  release_at?: string;
  visibility?: "enrolled_only" | "instructor_only" | "public";
}

export interface LectureProgressRow {
  student_id: string;
  full_name: string;
  sections: Partial<
    Record<
      LectureSectionKey,
      { score: number; max_score: number; submitted_at: string }
    >
  >;
  completed_at: string | null;
}

export interface StudentLectureListRow {
  link_id: string;
  lecture_id: string;
  title: string;
  subject: string;
  class_id: string;
  session_id: string | null;
  release_at: string | null;
  sections_count: number;
  progress: { submitted_sections: number; total_quiz_sections: number };
}

export interface SectionResult {
  question_id: string;
  is_correct: boolean | null;
  points: number;
  max_points: number;
  gradable: boolean;
}

/** Tiến độ máy chủ đã lưu cho MỘT hoạt động của MỘT học sinh — trả kèm
 * `StudentLectureView.sections[].progress` ở `show()`. `results` đã sạch đáp
 * án (chỉ question_id/is_correct/points/max_points/gradable, xem
 * `SectionResult`), nên đưa thẳng ra UI an toàn. */
export interface SectionProgress {
  submitted_at: string;
  score: number;
  max_score: number;
  results: SectionResult[];
}

/**
 * StudentLectureView = TeacherLecture bỏ question_ids/questions_snapshot, mỗi
 * section thêm `questions` (snapshot đã strip đáp án ở máy chủ, đưa qua
 * mapBackendQuestion ở UI để dựng player) và `progress` — tiến độ ĐÃ NỘP của
 * CHÍNH học sinh này cho hoạt động đó, `null` nếu chưa nộp.
 *
 * C1 (review cuối) — máy chủ luôn trả trường này ở `show()`; thiếu khai ở đây
 * là lỗ hổng khiến giao diện không có đường đọc lại, học sinh tải lại trang
 * thấy "chưa nộp" dù đã nộp, bấm nộp lại (chưa chọn gì) ghi đè điểm cũ bằng 0.
 */
export interface StudentLectureView extends Omit<TeacherLecture, "sections"> {
  sections: Array<
    Omit<LectureSection, "question_ids" | "questions_snapshot"> & {
      questions: unknown[];
      progress: SectionProgress | null;
    }
  >;
}

export interface CreateLectureInput {
  title: string;
  subject_code: string;
  subject: string;
  level: string;
  content_code: string;
  class_context?: { class_id?: string; session_id?: string } | null;
}

export interface UpdateSectionInput {
  blocks?: LectureBlock[];
  slides?: LectureSlide[];
  question_ids?: string[];
  title?: string;
  objective?: string;
}

async function raw(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: unknown;
    message?: string;
    error_code?: string;
  };
  if (!res.ok || body.success === false)
    throw new Error(
      body.message ?? body.error_code ?? `Lecture API error ${res.status}`,
    );
  return body;
}

export const teacherLectureApi = {
  async list(token: string): Promise<TeacherLecture[]> {
    const body = await raw("/api/v1/teacher/lectures", token);
    return (body.data as TeacherLecture[]) ?? [];
  },

  async create(
    input: CreateLectureInput,
    token: string,
  ): Promise<TeacherLecture> {
    const body = await raw("/api/v1/teacher/lectures", token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as TeacherLecture;
  },

  async show(id: string, token: string): Promise<TeacherLecture> {
    const body = await raw(`/api/v1/teacher/lectures/${id}`, token);
    return body.data as TeacherLecture;
  },

  async outline(
    id: string,
    token: string,
  ): Promise<{ ai_disabled: boolean; lecture: TeacherLecture }> {
    const body = await raw(`/api/v1/teacher/lectures/${id}/outline`, token, {
      method: "POST",
    });
    return body.data as { ai_disabled: boolean; lecture: TeacherLecture };
  },

  async generateSection(
    id: string,
    key: LectureSectionKey,
    token: string,
  ): Promise<{
    ai_disabled: boolean;
    quiz: LectureQuizSpec | null;
    lecture: TeacherLecture;
  }> {
    const body = await raw(
      `/api/v1/teacher/lectures/${id}/sections/${key}/generate`,
      token,
      { method: "POST" },
    );
    return body.data as {
      ai_disabled: boolean;
      quiz: LectureQuizSpec | null;
      lecture: TeacherLecture;
    };
  },

  async updateSection(
    id: string,
    key: LectureSectionKey,
    input: UpdateSectionInput,
    token: string,
  ): Promise<TeacherLecture> {
    const body = await raw(
      `/api/v1/teacher/lectures/${id}/sections/${key}`,
      token,
      { method: "PUT", headers: json, body: JSON.stringify(input) },
    );
    return body.data as TeacherLecture;
  },

  async finalize(id: string, token: string): Promise<TeacherLecture> {
    const body = await raw(`/api/v1/teacher/lectures/${id}/finalize`, token, {
      method: "POST",
    });
    return body.data as TeacherLecture;
  },

  async remove(id: string, token: string): Promise<void> {
    await raw(`/api/v1/teacher/lectures/${id}`, token, { method: "DELETE" });
  },

  async progress(
    id: string,
    linkId: string,
    token: string,
  ): Promise<LectureProgressRow[]> {
    const query = new URLSearchParams({ link_id: linkId });
    const body = await raw(
      `/api/v1/teacher/lectures/${id}/progress?${query.toString()}`,
      token,
    );
    return (body.data as LectureProgressRow[]) ?? [];
  },

  /** Việc 1 — mọi lớp/tiết bài giảng này đang gắn tới. Mảng rỗng (HTTP 200,
   * không phải lỗi) khi chưa gắn lớp nào. */
  async links(id: string, token: string): Promise<LectureLinkRow[]> {
    const body = await raw(`/api/v1/teacher/lectures/${id}/links`, token);
    return (body.data as LectureLinkRow[]) ?? [];
  },

  /** Việc 2 — gắn bài giảng ĐÃ HOÀN TẤT (status='ready') vào một tiết của
   * lớp. KHÔNG truyền `material_type` — máy chủ tự điền 'lecture'. Mã lỗi:
   * 404 không phải bài giảng của mình · 409 bài giảng CHƯA hoàn tất · 403
   * không dạy lớp đó · 422 tiết không hợp lệ · 409 đã gắn đúng cặp lớp+tiết
   * này rồi — máy chủ đã trả sẵn `message` tiếng Việt đúng ca cho từng lỗi. */
  async attach(
    id: string,
    input: AttachLectureInput,
    token: string,
  ): Promise<LectureLinkRow> {
    const body = await raw(`/api/v1/teacher/lectures/${id}/attach`, token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as LectureLinkRow;
  },
};
