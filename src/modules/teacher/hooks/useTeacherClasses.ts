import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccessToken, useAuth } from "@/core/auth/AuthContext";
import {
  teacherClassesApi,
  type AssignInput,
  type ClassAssignment,
  type GradeInput,
  type PendingSubmission,
  type SubmissionDetail,
  type TeacherClass,
} from "@/modules/teacher/api/teacherClassesApi";

export const queryKeys = {
  all: ["teacher-classes"] as const,
  classes: () => [...queryKeys.all, "classes"] as const,
  assignments: (classId: string) =>
    [...queryKeys.all, "assignments", classId] as const,
  submissions: (classId: string) =>
    [...queryKeys.all, "submissions", classId] as const,
  submission: (submissionId: string) =>
    [...queryKeys.all, "submission", submissionId] as const,
};

export function useTeacherClasses() {
  const token = useAccessToken();
  // Chỉ hiện lớp giáo viên đăng nhập quản được (lead/assistant) — tránh picker
  // hiện lớp không phải của mình rồi 403 ở mọi tab class-scoped.
  const instructorId = useAuth().user?.id;
  return useQuery<TeacherClass[], Error>({
    queryKey: [...queryKeys.classes(), instructorId ?? null],
    queryFn: () => teacherClassesApi.listClasses(token!, instructorId),
    enabled: !!token,
  });
}

export function useClassAssignments(classId: string | undefined) {
  const token = useAccessToken();
  return useQuery<ClassAssignment[], Error>({
    queryKey: queryKeys.assignments(classId ?? ""),
    queryFn: () => teacherClassesApi.listAssignments(classId!, token!),
    enabled: !!token && !!classId,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: queryKeys.all });
}

export function useAssign() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { classId: string; input: AssignInput }) =>
      teacherClassesApi.assign(v.classId, v.input, token!),
    onSuccess: invalidate,
  });
}

export function usePendingSubmissions(classId: string | undefined) {
  const token = useAccessToken();
  return useQuery<PendingSubmission[], Error>({
    queryKey: queryKeys.submissions(classId ?? ""),
    queryFn: () => teacherClassesApi.pendingSubmissions(classId!, token!),
    enabled: !!token && !!classId,
  });
}

/** Task 9: chi tiết 1 bài nộp (câu hỏi + gradable/max_points) để chấm — danh sách chờ chấm
 * (`pendingSubmissions`) không mang `results`, phải gọi riêng GET .../submissions/{id}. */
export function useSubmissionDetail(submissionId: string | undefined) {
  const token = useAccessToken();
  return useQuery<SubmissionDetail, Error>({
    queryKey: queryKeys.submission(submissionId ?? ""),
    queryFn: () => teacherClassesApi.getSubmission(submissionId!, token!),
    enabled: !!token && !!submissionId,
  });
}

export function useGradeSubmission() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { submissionId: string; input: GradeInput }) =>
      teacherClassesApi.grade(v.submissionId, v.input, token!),
    onSuccess: invalidate,
  });
}
