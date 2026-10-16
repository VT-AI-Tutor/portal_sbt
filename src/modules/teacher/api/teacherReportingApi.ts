/**
 * Teacher reporting API client (lát 4 — miền TREPORT): tổng hợp cấp lớp cho giáo viên
 * (Dashboard lớp, Theo dõi tiến độ, Báo cáo lớp). Cùng pattern fetch + JWT + envelope
 * `{success,data}` như teacherClassesApi.
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";

const API_BASE = getAuthenticatedApiBaseUrl();

export type ReportPeriod = "thang_nay" | "hoc_ky_1" | "hoc_ky_2" | "ca_nam";

export type StudentBand =
  | "hoc_tot"
  | "trung_binh"
  | "can_ho_tro"
  | "chua_du_lieu";

export interface SupportStudent {
  user_id: string;
  name: string;
  reason: "diem_thap" | "qua_han";
}

export interface ClassDashboard {
  class_name: string;
  student_count: number;
  active_assignment_count: number;
  avg_completion: number | null;
  support_count: number;
  support_students: SupportStudent[];
  recent_progress: Array<{ title: string; done: number; total: number }>;
}

export interface ProgressStudent {
  user_id: string;
  name: string;
  done: number;
  total: number;
  avg_score: number | null;
  band: StudentBand;
}

export interface ClassProgress {
  students: ProgressStudent[];
  counts: { hoc_tot: number; trung_binh: number; can_ho_tro: number };
}

export interface TopicMastery {
  topic: string;
  mastery_percent: number;
  band: "gioi" | "kha" | "tb" | "yeu";
}

export interface ClassReport {
  class_avg_score: number | null;
  avg_completion: number | null;
  questions_done: number;
  topics: TopicMastery[];
}

export interface ReportFilters {
  subject?: string;
  period?: ReportPeriod;
}

async function raw(path: string, token: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: unknown;
    message?: string;
    error_code?: string;
  };
  if (!res.ok || body.success === false)
    throw new Error(
      body.message ??
        body.error_code ??
        `Teacher reporting API error ${res.status}`,
    );
  return body;
}

function query(filters?: ReportFilters): string {
  const p = new URLSearchParams();
  if (filters?.subject) p.set("subject", filters.subject);
  if (filters?.period) p.set("period", filters.period);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const teacherReportingApi = {
  async dashboard(classId: string, token: string): Promise<ClassDashboard> {
    const body = await raw(
      `/api/v1/teacher/classes/${classId}/dashboard`,
      token,
    );
    return body.data as ClassDashboard;
  },

  async progress(
    classId: string,
    filters: ReportFilters,
    token: string,
  ): Promise<ClassProgress> {
    const body = await raw(
      `/api/v1/teacher/classes/${classId}/progress${query(filters)}`,
      token,
    );
    return body.data as ClassProgress;
  },

  async report(
    classId: string,
    filters: ReportFilters,
    token: string,
  ): Promise<ClassReport> {
    const body = await raw(
      `/api/v1/teacher/classes/${classId}/report${query(filters)}`,
      token,
    );
    return body.data as ClassReport;
  },
};
