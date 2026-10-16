import { useQuery } from "@tanstack/react-query";
import { useAccessToken } from "@/core/auth/AuthContext";
import {
  teacherReportingApi,
  type ClassDashboard,
  type ClassProgress,
  type ClassReport,
  type ReportFilters,
} from "@/modules/teacher/api/teacherReportingApi";

export const queryKeys = {
  all: ["teacher-reporting"] as const,
  dashboard: (classId: string) =>
    [...queryKeys.all, "dashboard", classId] as const,
  progress: (classId: string, filters: ReportFilters) =>
    [...queryKeys.all, "progress", classId, filters] as const,
  report: (classId: string, filters: ReportFilters) =>
    [...queryKeys.all, "report", classId, filters] as const,
};

export function useClassDashboard(classId: string | undefined) {
  const token = useAccessToken();
  return useQuery<ClassDashboard, Error>({
    queryKey: queryKeys.dashboard(classId ?? ""),
    queryFn: () => teacherReportingApi.dashboard(classId!, token!),
    enabled: !!token && !!classId,
  });
}

export function useClassProgress(
  classId: string | undefined,
  filters: ReportFilters = {},
) {
  const token = useAccessToken();
  return useQuery<ClassProgress, Error>({
    queryKey: queryKeys.progress(classId ?? "", filters),
    queryFn: () => teacherReportingApi.progress(classId!, filters, token!),
    enabled: !!token && !!classId,
  });
}

export function useClassReport(
  classId: string | undefined,
  filters: ReportFilters = {},
) {
  const token = useAccessToken();
  return useQuery<ClassReport, Error>({
    queryKey: queryKeys.report(classId ?? "", filters),
    queryFn: () => teacherReportingApi.report(classId!, filters, token!),
    enabled: !!token && !!classId,
  });
}
