import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccessToken } from "@/core/auth/AuthContext";
import {
  teacherBankApi,
  type QuestionSource,
  type TeacherQuestion,
  type TeacherQuestionInput,
  type AiSaveResult,
} from "@/modules/teacher/api/teacherBankApi";

export const queryKeys = {
  all: ["teacher-bank"] as const,
  list: (source: QuestionSource) => [...queryKeys.all, "list", source] as const,
};

export function useTeacherBank(
  source: QuestionSource,
  scope?: { subject?: string; level?: string },
) {
  const token = useAccessToken();
  return useQuery<TeacherQuestion[], Error>({
    queryKey: [...queryKeys.list(source), scope?.subject ?? "", scope?.level ?? ""],
    queryFn: () => teacherBankApi.list(source, token!, scope),
    // Kho học liệu chỉ hỏi được khi đã biết môn + lớp.
    enabled: !!token && (source !== "library" || !!(scope?.subject && scope?.level)),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: queryKeys.all });
}

export function useCreateTeacherQuestion() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: TeacherQuestionInput) =>
      teacherBankApi.create(input, token!),
    onSuccess: invalidate,
  });
}

export function useUpdateTeacherQuestion() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: TeacherQuestionInput }) =>
      teacherBankApi.update(v.id, v.input, token!),
    onSuccess: invalidate,
  });
}

export function useDeleteTeacherQuestion() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => teacherBankApi.remove(id, token!),
    onSuccess: invalidate,
  });
}

export function useSaveAiQuestions() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation<AiSaveResult, Error, TeacherQuestionInput[]>({
    mutationFn: (questions) => teacherBankApi.saveFromAi(questions, token!),
    onSuccess: invalidate,
  });
}
