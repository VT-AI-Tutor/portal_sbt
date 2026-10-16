/**
 * Hooks TanStack Query cho BÀI GIẢNG SỐ — cùng khuôn `useTeacherBlueprint.ts`.
 *
 * Giữ MỎNG có chủ đích (không test riêng, theo brief Task 13): mỗi hook chỉ
 * bọc một lệnh gọi `teacherLectureApi`/`teacherClassesApi`. Dây chuyền sinh
 * nhiều lượt gọi (dàn khung → 4 hoạt động → quiz) sống ở `lib/lectureDraft.ts`,
 * KHÔNG lặp lại ở đây.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccessToken } from "@/core/auth/AuthContext";
import {
  teacherLectureApi,
  type AttachLectureInput,
  type CreateLectureInput,
  type LectureSectionKey,
  type TeacherLecture,
  type UpdateSectionInput,
} from "@/modules/teacher/api/teacherLectureApi";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type { SessionSummary } from "@/modules/teacher/api/classTypes";

export const lectureQueryKeys = {
  all: ["teacher-lectures"] as const,
  sessions: (classId: string) =>
    ["teacher-lectures", "sessions", classId] as const,
};

export function useTeacherLectures() {
  const token = useAccessToken();
  return useQuery<TeacherLecture[], Error>({
    queryKey: lectureQueryKeys.all,
    queryFn: () => teacherLectureApi.list(token!),
    enabled: !!token,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: lectureQueryKeys.all });
}

export function useCreateLecture() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateLectureInput) =>
      teacherLectureApi.create(input, token!),
    onSuccess: invalidate,
  });
}

export function useUpdateLectureSection() {
  const token = useAccessToken();
  return useMutation({
    mutationFn: (v: {
      lectureId: string;
      key: LectureSectionKey;
      input: UpdateSectionInput;
    }) => teacherLectureApi.updateSection(v.lectureId, v.key, v.input, token!),
  });
}

/** MỘT lệnh gọi `generateSection` — KHÔNG kèm bốc/sinh câu quiz (đó là việc
 * riêng của dây chuyền đầy đủ trong lectureDraft.ts, xem `generateSectionWithQuiz`).
 * Dùng cho nút "Sinh lại phần này" khi hoạt động ĐÃ có quiz: máy chủ giữ
 * nguyên question_ids đã gắn, chỉ đổi blocks/slides. Khi hoạt động đang THIẾU
 * quiz (nội dung có, `question_ids` rỗng — dấu vết "Tiếp tục soạn" một bản
 * nháp rớt mạng giữa chừng), `LectureFlow.handleRegenerate` KHÔNG dùng hook
 * này mà gọi thẳng `generateSectionWithQuiz` để đi trọn bước nội dung + quiz. */
export function useRegenerateLectureSection() {
  const token = useAccessToken();
  return useMutation({
    mutationFn: (v: { lectureId: string; key: LectureSectionKey }) =>
      teacherLectureApi.generateSection(v.lectureId, v.key, token!),
  });
}

export function useFinalizeLecture() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (lectureId: string) =>
      teacherLectureApi.finalize(lectureId, token!),
    onSuccess: invalidate,
  });
}

/** Buổi học của một lớp — dùng ở form khai (ngữ cảnh lớp/tiết) và
 * LectureAttachDialog (chọn tiết để gắn bài giảng). */
export function useClassSessions(classId: string | undefined) {
  const token = useAccessToken();
  return useQuery<SessionSummary[], Error>({
    queryKey: lectureQueryKeys.sessions(classId ?? ""),
    queryFn: () => teacherClassesApi.getSessions(classId!, token!),
    enabled: !!token && !!classId,
  });
}

/**
 * Việc 2 — gắn bài giảng qua đường RIÊNG `POST /teacher/lectures/{id}/attach`
 * (KHÔNG còn qua `teacherClassesApi.attachMaterial` dùng chung với học liệu
 * lớp) — `teacherLectureApi.attach` không nhận `material_type`, máy chủ tự
 * điền. Tên hook giữ nguyên `useAttachLectureMaterial` (LectureFlow.tsx —
 * KHÔNG thuộc phạm vi sửa của lát này — mock module theo tên này).
 *
 * Không còn vá cache `class_context` sau khi gắn (bản vá I1 của lát 1): nút
 * "Tiến độ" và `LectureProgressDialog` nay hỏi thẳng `GET /links` (nguồn sự
 * thật) mỗi lần mở, nên không cần giữ trạng thái "đã gắn lớp nào" ở đây nữa.
 * Chỉ cần làm mới danh sách bài giảng để các nơi khác đọc `useTeacherLectures`
 * thấy dữ liệu mới nhất.
 */
export function useAttachLectureMaterial() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { lectureId: string; input: AttachLectureInput }) =>
      teacherLectureApi.attach(v.lectureId, v.input, token!),
    onSuccess: invalidate,
  });
}
