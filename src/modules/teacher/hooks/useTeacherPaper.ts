import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccessToken } from "@/core/auth/AuthContext";
import {
  teacherPaperApi,
  type TeacherPaper,
  type TeacherPaperInput,
} from "@/modules/teacher/api/teacherPaperApi";

export const queryKeys = {
  all: ["teacher-papers"] as const,
};

export function useTeacherPapers() {
  const token = useAccessToken();
  return useQuery<TeacherPaper[], Error>({
    queryKey: queryKeys.all,
    queryFn: () => teacherPaperApi.list(token!),
    enabled: !!token,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: queryKeys.all });
}

export function useCreatePaper() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: TeacherPaperInput) =>
      teacherPaperApi.create(input, token!),
    onSuccess: invalidate,
  });
}

export function useUpdatePaper() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: TeacherPaperInput }) =>
      teacherPaperApi.update(v.id, v.input, token!),
    onSuccess: invalidate,
  });
}

export function useDeletePaper() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => teacherPaperApi.remove(id, token!),
    onSuccess: invalidate,
  });
}
