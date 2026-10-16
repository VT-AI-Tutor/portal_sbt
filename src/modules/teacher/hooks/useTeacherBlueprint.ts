import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccessToken } from "@/core/auth/AuthContext";
import {
  teacherBlueprintApi,
  type BlueprintCatalog,
  type BlueprintOutcome,
  type PaperBlueprint,
  type PaperBlueprintInput,
} from "@/modules/teacher/api/teacherBlueprintApi";

export const blueprintQueryKeys = {
  all: ["teacher-blueprints"] as const,
  catalog: (subjectCode: string, level: string, printableOnly: boolean) =>
    ["teacher-blueprints", "catalog", subjectCode, level, printableOnly] as const,
};

/**
 * Bảng chủ đề × mức nhận thức. Chỉ chạy khi đã CHỌN CẢ môn lẫn khối — hỏi kho
 * mà thiếu phạm vi thì backend cũng trả rỗng, gọi làm gì.
 */
export function useBlueprintCatalog(
  subjectCode: string,
  level: string,
  printableOnly: boolean,
) {
  const token = useAccessToken();
  return useQuery<BlueprintCatalog, Error>({
    queryKey: blueprintQueryKeys.catalog(subjectCode, level, printableOnly),
    queryFn: () =>
      teacherBlueprintApi.catalog(
        { subject_code: subjectCode, level, printable_only: printableOnly },
        token!,
      ),
    enabled: !!token && subjectCode.length > 0 && level.length > 0,
  });
}

export function useTeacherBlueprints() {
  const token = useAccessToken();
  return useQuery<PaperBlueprint[], Error>({
    queryKey: blueprintQueryKeys.all,
    queryFn: () => teacherBlueprintApi.list(token!),
    enabled: !!token,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: blueprintQueryKeys.all });
}

export function useCreateBlueprint() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: PaperBlueprintInput) =>
      teacherBlueprintApi.create(input, token!),
    onSuccess: invalidate,
  });
}

export function useUpdateBlueprint() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: PaperBlueprintInput }) =>
      teacherBlueprintApi.update(v.id, v.input, token!),
    onSuccess: invalidate,
  });
}

export function useDeleteBlueprint() {
  const token = useAccessToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => teacherBlueprintApi.remove(id, token!),
    onSuccess: invalidate,
  });
}

/** Lát 3 — kết quả lớp đọc theo ô ma trận, sau khi lớp làm xong. */
export function useBlueprintOutcome(
  classId: string | undefined,
  linkId: string | undefined,
) {
  const token = useAccessToken();
  return useQuery<BlueprintOutcome, Error>({
    queryKey: ["teacher-blueprints", "outcome", classId, linkId],
    queryFn: () => teacherBlueprintApi.outcome(classId!, linkId!, token!),
    enabled: !!token && !!classId && !!linkId,
  });
}

/**
 * Lát 3 — gợi ý ma trận từ chỗ lớp đang yếu.
 *
 * Là mutation chứ không phải query: giáo viên BẤM để xin gợi ý, và bấm lại
 * phải hỏi lại (dữ liệu thành thạo của lớp đổi từng ngày). Query có bộ nhớ đệm
 * sẽ trả lại bảng cũ và giáo viên tưởng hệ không phản hồi.
 */
export function useSuggestBlueprint() {
  const token = useAccessToken();
  return useMutation({
    mutationFn: (params: {
      class_id: string;
      subject_code: string;
      level: string;
      total_questions: number;
      printable_only?: boolean;
    }) => teacherBlueprintApi.suggest(params, token!),
  });
}
