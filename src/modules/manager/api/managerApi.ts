/**
 * Manager area API client (Task 8) — báo cáo cấp trường cho tài khoản quản lý
 * (school leader / org admin scoped theo school_org_unit_id). Cùng pattern
 * fetch + Bearer + envelope `{success,data}` như teacherBankApi.ts.
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";

const API_BASE = getAuthenticatedApiBaseUrl();

export interface SchoolSummary {
  school_id: string;
  name: string;
  students: number;
  classes: number;
  sessions_30d: number;
}

export interface SchoolReportQuery {
  school_org_unit_id: string;
  academic_year?: string;
}

export interface GradeRow {
  grade: string;
  class_count: number;
  student_count: number;
  students_active_30d: number;
  sessions_30d: number;
  correct_rate: number | null;
}

export interface MasteryRow {
  subject_code: string;
  attempted: number;
  correct_rate: number | null;
  students: number;
  high_share: number | null;
}

export interface ActivityDay {
  date: string;
  sessions: number;
}

export interface CognitiveLevelRow {
  key: string;
  attempted: number;
  correct_rate: number | null;
}

export interface SubjectCognitive {
  subject_code: string;
  levels: CognitiveLevelRow[];
}

export interface SchoolReport {
  school: { id: string; name: string };
  academic_year: string;
  totals: {
    students: number;
    teachers: number;
    classes: number;
    assignments: number;
  };
  by_grade: GradeRow[];
  practice_30d: {
    sessions: number;
    students_active: number;
    correct_rate: number | null;
  };
  mastery_by_subject: MasteryRow[];
  cognitive_levels: SubjectCognitive[];
  activity: { students_active_7d: number; by_day: ActivityDay[] };
  enrollment: { in_class: number; not_in_class: number };
}


/** ── Danh sách con người & lớp cho Ban giám hiệu (lát 1-4) ───────────────── */

export type StudentBand = "hoc_tot" | "trung_binh" | "can_ho_tro" | "chua_du_lieu";

/** Ngưỡng xếp loại — server trả về ngưỡng đã dùng cho lần xem này (không hard-code ở web). */
export interface ReportThresholds {
  good: number;
  mid: number;
  alert: number | null;
}

export interface ManagerStudent {
  user_id: string;
  full_name: string;
  email: string | null;
  class: { id: string; name: string } | null;
  grade: string | null;
  sessions: number;
  avg_score: number | null;
  band: StudentBand;
  alerting: boolean;
}

export interface ManagerStudentsPage {
  items: ManagerStudent[];
  page: number;
  per_page: number;
  total: number;
  counts: Record<StudentBand | "alerting", number>;
  thresholds: ReportThresholds;
  window_days: number;
  truncated: boolean;
}

export interface StudentListQuery {
  school_org_unit_id: string;
  academic_year?: string;
  sort?: "name" | "score";
  dir?: "asc" | "desc";
  band?: StudentBand;
  grade?: string;
  class_id?: string;
  q?: string;
  alerting?: boolean;
  page?: number;
  per_page?: number;
  band_good?: number;
  band_mid?: number;
  band_alert?: number;
}

export interface LoginStatusPerson {
  user_id: string;
  full_name: string;
  email: string | null;
  last_login_at: string | null;
  days_since_login: number | null;
  has_practiced: boolean;
}

export type LoginStatusGroupKey = "chua_kich_hoat" | "chua_dang_nhap" | "lau_khong_vao";

export interface LoginStatusResult {
  groups: Record<LoginStatusGroupKey, LoginStatusPerson[]>;
  days: number;
  counts: Record<LoginStatusGroupKey, number>;
  total_people: number;
}

export interface ManagerClassRow {
  class_id: string;
  name: string;
  code: string;
  grade: string;
  student_count: number;
  students_active: number;
  sessions: number;
  avg_score: number | null;
  band: StudentBand;
  need_support: number;
  alerting: number;
  homeroom_teacher: { user_id: string; full_name: string } | null;
}

export interface ManagerClassesResult {
  items: ManagerClassRow[];
  school_avg_score: number | null;
  thresholds: ReportThresholds;
  window_days: number;
}

export interface ManagerTeacherRow {
  user_id: string;
  full_name: string;
  email: string | null;
  departments: { id: string; name: string }[];
  homeroom_classes: { id: string; name: string }[];
  assignment_count: number;
  subject_codes: string[];
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
    meta?: Record<string, unknown>;
    message?: string;
    error_code?: string;
  };
  if (!res.ok || body.success === false)
    throw new Error(
      body.message ?? body.error_code ?? `Manager API error ${res.status}`,
    );
  return body;
}

export const managerApi = {
  async schoolsSummary(token: string): Promise<SchoolSummary[]> {
    const body = await raw("/api/v1/manager/schools-summary", token);
    return (body.data as SchoolSummary[]) ?? [];
  },

  async schoolReport(
    token: string,
    q: SchoolReportQuery,
  ): Promise<SchoolReport> {
    const params = new URLSearchParams({
      school_org_unit_id: q.school_org_unit_id,
    });
    if (q.academic_year) params.set("academic_year", q.academic_year);
    const body = await raw(
      `/api/v1/manager/school-report?${params.toString()}`,
      token,
    );
    return body.data as SchoolReport;
  },

  async students(
    token: string,
    q: StudentListQuery,
  ): Promise<ManagerStudentsPage> {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
      if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
    }
    const body = await raw(`/api/v1/manager/school-students?${p.toString()}`, token);
    const meta = (body.meta ?? {}) as Record<string, never>;
    return {
      items: (body.data as ManagerStudent[]) ?? [],
      page: Number(meta.page ?? 1),
      per_page: Number(meta.per_page ?? 50),
      total: Number(meta.total ?? 0),
      counts: (meta.counts ?? {}) as ManagerStudentsPage["counts"],
      thresholds: meta.thresholds as unknown as ReportThresholds,
      window_days: Number(meta.window_days ?? 30),
      truncated: Boolean(meta.truncated),
    };
  },

  async loginStatus(
    token: string,
    q: { school_org_unit_id: string; days?: number; member_type?: "learner" | "instructor" },
  ): Promise<LoginStatusResult> {
    const p = new URLSearchParams({ school_org_unit_id: q.school_org_unit_id });
    if (q.days) p.set("days", String(q.days));
    if (q.member_type) p.set("member_type", q.member_type);
    const body = await raw(`/api/v1/manager/school-login-status?${p.toString()}`, token);
    const meta = (body.meta ?? {}) as Record<string, never>;
    return {
      groups: body.data as LoginStatusResult["groups"],
      days: Number(meta.days ?? 30),
      counts: (meta.counts ?? {}) as LoginStatusResult["counts"],
      total_people: Number(meta.total_people ?? 0),
    };
  },

  async classes(
    token: string,
    q: { school_org_unit_id: string; academic_year?: string; sort?: "name" | "score"; dir?: "asc" | "desc" },
  ): Promise<ManagerClassesResult> {
    const p = new URLSearchParams({ school_org_unit_id: q.school_org_unit_id });
    if (q.academic_year) p.set("academic_year", q.academic_year);
    if (q.sort) p.set("sort", q.sort);
    if (q.dir) p.set("dir", q.dir);
    const body = await raw(`/api/v1/manager/school-classes?${p.toString()}`, token);
    const meta = (body.meta ?? {}) as Record<string, never>;
    return {
      items: (body.data as ManagerClassRow[]) ?? [],
      school_avg_score: (meta.school_avg_score ?? null) as number | null,
      thresholds: meta.thresholds as unknown as ReportThresholds,
      window_days: Number(meta.window_days ?? 30),
    };
  },

  async teachers(
    token: string,
    q: { school_org_unit_id: string; academic_year?: string },
  ): Promise<ManagerTeacherRow[]> {
    const p = new URLSearchParams({ school_org_unit_id: q.school_org_unit_id });
    if (q.academic_year) p.set("academic_year", q.academic_year);
    const body = await raw(`/api/v1/manager/school-teachers?${p.toString()}`, token);
    return (body.data as ManagerTeacherRow[]) ?? [];
  },
};
