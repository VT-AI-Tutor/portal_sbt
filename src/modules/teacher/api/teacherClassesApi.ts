/**
 * Teacher API client (Task 6 / lát 1 teacher stack) — lớp, bài giao, tiến độ, chấm bài.
 * Cùng pattern fetch + JWT + envelope `{success,data}` như scopedUsersApi.
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";
import type { SubmissionReview } from "@/core/api/assessmentTypes";
import type {
  ClassDetail,
  ClassSummary,
  ClassFormValues,
  RosterRow,
  PendingEnrollment,
  JoinCodeInfo,
  SessionSummary,
  SessionDetail,
  SessionFormValues,
  AttendanceRecord,
  MaterialRow,
  AttachMaterialInput,
  OperationalSummary,
} from "./classTypes";

const API_BASE = getAuthenticatedApiBaseUrl();
const json = { "Content-Type": "application/json" };

export interface TeacherClass {
  id: string;
  name: string;
  roster_count?: number;
  [key: string]: unknown;
}

/** Mirror của StudentAssignment (assignmentsApi.ts) — cùng shape ClassAssignmentLink. */
export interface ClassAssignment {
  id: string;
  assignment_id: string;
  title: string;
  class_id: string;
  class_name: string;
  session_id: string | null;
  deadline: string | null;
  status: string;
}

export interface AssignmentProgressRow {
  user_id: string;
  name: string;
  submission_status: string;
  score: number | null;
  max_score: number | null;
  /** null khi học sinh chưa nộp — khoá để mở màn chi tiết bài làm. */
  submission_id: string | null;
}

export interface PendingSubmission {
  id: string;
  exercise_id: string;
  exercise_title: string;
  student_id: string;
  status: string;
  grading_status: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
  [key: string]: unknown;
}

/** Một câu chấm trong `results` của bài nộp (Task 5 `findDetail`/GradeSubmission use case). */
export interface SubmissionResultRow {
  question_id: string;
  is_correct: boolean | null;
  points: number | null;
  max_points: number;
  gradable: boolean;
  graded?: boolean;
  comment?: string | null;
  [key: string]: unknown;
}

/** Chi tiết bài nộp — GET /api/v1/teacher/submissions/{id} (`SubmissionRepositoryInterface::findDetail`). */
export interface SubmissionDetail {
  id: string;
  exercise_id: string;
  exercise_title: string;
  student_id: string;
  status: string;
  grading_status: string;
  score: number | null;
  max_score: number | null;
  teacher_comment?: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  results: SubmissionResultRow[];
  [key: string]: unknown;
}

export interface AssignInput {
  assignment_id: string;
  title_snapshot: string;
  due_at?: string;
  session_id?: string;
}

/** Payload POST /api/v1/teacher/submissions/{id}/grade — trường `points` khớp validate BE
 * (`grades.*.points`), KHÔNG PHẢI `score` (lệch của bản Task 6 trước, đã sửa ở Task 9). */
export interface GradeInput {
  grades: Array<{ question_id: string; points: number; comment?: string }>;
  teacher_comment?: string;
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
      body.message ??
        body.error_code ??
        `Teacher classes API error ${res.status}`,
    );
  return body;
}

export const teacherClassesApi = {
  async listClasses(
    token: string,
    instructorUserId?: string,
  ): Promise<TeacherClass[]> {
    // GET /classes KHÔNG scope theo actor (mọi giáo viên thấy MỌI lớp toàn hệ);
    // các tab class-scoped (dashboard/chấm bài) lại gác theo lead/assistant → chọn
    // lớp không phải của mình sẽ 403. Lọc theo giáo viên (backend khớp lead OR
    // assistant OR instructor_user_id) để picker chỉ hiện lớp quản được.
    const qs = instructorUserId
      ? `?instructor_user_id=${encodeURIComponent(instructorUserId)}`
      : "";
    const body = await raw(`/api/v1/classes${qs}`, token);
    return (body.data as TeacherClass[]) ?? [];
  },

  async listAssignments(
    classId: string,
    token: string,
  ): Promise<ClassAssignment[]> {
    const body = await raw(`/api/v1/classes/${classId}/assignments`, token);
    return (body.data as ClassAssignment[]) ?? [];
  },

  async assignmentProgress(
    classId: string,
    linkId: string,
    token: string,
  ): Promise<AssignmentProgressRow[]> {
    const body = await raw(
      `/api/v1/classes/${classId}/assignments/${linkId}/progress`,
      token,
    );
    return (body.data as AssignmentProgressRow[]) ?? [];
  },

  /**
   * GET /api/v1/teacher/submissions/{id}/review — chi tiết bài làm cho giáo viên.
   *
   * Dùng chung use case `ReviewSubmission` với màn kết quả của học sinh nên shape
   * đúng bằng `SubmissionReview`; khác đúng một điểm: giáo viên LUÔN thấy đáp án,
   * kể cả bài `hide_answers` (cờ đó chỉ giấu với học sinh).
   */
  async submissionReview(
    submissionId: string,
    token: string,
  ): Promise<SubmissionReview> {
    const body = await raw(
      `/api/v1/teacher/submissions/${submissionId}/review`,
      token,
    );
    return body.data as SubmissionReview;
  },

  async assign(
    classId: string,
    input: AssignInput,
    token: string,
  ): Promise<ClassAssignment> {
    const body = await raw(`/api/v1/classes/${classId}/assignments`, token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as ClassAssignment;
  },

  async pendingSubmissions(
    classId: string,
    token: string,
  ): Promise<PendingSubmission[]> {
    const body = await raw(
      `/api/v1/teacher/classes/${classId}/submissions`,
      token,
    );
    return (body.data as PendingSubmission[]) ?? [];
  },

  async grade(submissionId: string, input: GradeInput, token: string) {
    return raw(`/api/v1/teacher/submissions/${submissionId}/grade`, token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(input),
    });
  },

  async getSubmission(
    submissionId: string,
    token: string,
  ): Promise<SubmissionDetail> {
    const body = await raw(
      `/api/v1/teacher/submissions/${submissionId}`,
      token,
    );
    return body.data as SubmissionDetail;
  },

  // ── Class CRUD + lifecycle ────────────────────────────────────────────────
  async getClass(id: string, token: string): Promise<ClassDetail> {
    const body = await raw(`/api/v1/classes/${id}`, token);
    return body.data as ClassDetail;
  },
  async createClass(
    input: ClassFormValues,
    token: string,
  ): Promise<ClassDetail> {
    const body = await raw(`/api/v1/classes`, token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as ClassDetail;
  },
  async updateClass(
    id: string,
    input: ClassFormValues,
    token: string,
  ): Promise<ClassDetail> {
    const body = await raw(`/api/v1/classes/${id}`, token, {
      method: "PUT",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as ClassDetail;
  },
  async deleteClass(id: string, token: string): Promise<void> {
    await raw(`/api/v1/classes/${id}`, token, { method: "DELETE" });
  },
  async changeStatus(
    id: string,
    status: string,
    reason: string | undefined,
    token: string,
  ): Promise<ClassDetail> {
    const body = await raw(`/api/v1/classes/${id}/status`, token, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ status, reason }),
    });
    return body.data as ClassDetail;
  },
  async publish(id: string, token: string): Promise<ClassDetail> {
    const body = await raw(`/api/v1/classes/${id}/publish`, token, {
      method: "POST",
    });
    return body.data as ClassDetail;
  },
  async openEnrollment(id: string, token: string): Promise<ClassDetail> {
    const body = await raw(`/api/v1/classes/${id}/open-enrollment`, token, {
      method: "POST",
    });
    return body.data as ClassDetail;
  },
  async cancelClass(
    id: string,
    reason: string,
    token: string,
  ): Promise<ClassDetail> {
    const body = await raw(`/api/v1/classes/${id}/cancel`, token, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ reason }),
    });
    return body.data as ClassDetail;
  },
  async archive(id: string, token: string): Promise<ClassDetail> {
    const body = await raw(`/api/v1/classes/${id}/archive`, token, {
      method: "POST",
    });
    return body.data as ClassDetail;
  },
  async operationalSummary(
    id: string,
    token: string,
  ): Promise<OperationalSummary> {
    const body = await raw(`/api/v1/classes/${id}/operational-summary`, token);
    return body.data as OperationalSummary;
  },

  // ── Roster ────────────────────────────────────────────────────────────────
  async getRoster(id: string, token: string): Promise<RosterRow[]> {
    const body = await raw(`/api/v1/classes/${id}/roster`, token);
    return (body.data as RosterRow[]) ?? [];
  },
  async addLearner(
    id: string,
    learnerUserId: string,
    token: string,
  ): Promise<void> {
    await raw(`/api/v1/classes/${id}/roster`, token, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ learner_user_id: learnerUserId }),
    });
  },
  async removeLearner(
    id: string,
    learnerUserId: string,
    reason: string | undefined,
    token: string,
  ): Promise<void> {
    await raw(`/api/v1/classes/${id}/roster/${learnerUserId}`, token, {
      method: "DELETE",
      headers: json,
      body: JSON.stringify({ reason }),
    });
  },

  // ── Enrollment + join code ────────────────────────────────────────────────
  async pendingEnrollments(
    id: string,
    token: string,
  ): Promise<PendingEnrollment[]> {
    const body = await raw(`/api/v1/classes/${id}/pending-enrollments`, token);
    return (body.data as PendingEnrollment[]) ?? [];
  },
  async approveEnrollment(
    id: string,
    enrollmentId: string,
    token: string,
  ): Promise<void> {
    await raw(
      `/api/v1/classes/${id}/enrollments/${enrollmentId}/approve`,
      token,
      { method: "POST" },
    );
  },
  async rejectEnrollment(
    id: string,
    enrollmentId: string,
    reason: string | undefined,
    token: string,
  ): Promise<void> {
    await raw(
      `/api/v1/classes/${id}/enrollments/${enrollmentId}/reject`,
      token,
      { method: "POST", headers: json, body: JSON.stringify({ reason }) },
    );
  },
  async regenerateJoinCode(id: string, token: string): Promise<JoinCodeInfo> {
    const body = await raw(`/api/v1/classes/${id}/join-code/regenerate`, token, {
      method: "POST",
    });
    return body.data as JoinCodeInfo;
  },
  async toggleJoinCode(
    id: string,
    enabled: boolean,
    token: string,
  ): Promise<JoinCodeInfo> {
    const body = await raw(`/api/v1/classes/${id}/join-code`, token, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ enabled }),
    });
    return body.data as JoinCodeInfo;
  },

  // ── Sessions + attendance ─────────────────────────────────────────────────
  async getSessions(id: string, token: string): Promise<SessionSummary[]> {
    const body = await raw(`/api/v1/classes/${id}/sessions`, token);
    return (body.data as SessionSummary[]) ?? [];
  },
  async getSession(
    id: string,
    sessionId: string,
    token: string,
  ): Promise<SessionDetail> {
    const body = await raw(
      `/api/v1/classes/${id}/sessions/${sessionId}`,
      token,
    );
    return body.data as SessionDetail;
  },
  async createSession(
    id: string,
    input: SessionFormValues,
    token: string,
  ): Promise<SessionSummary> {
    const body = await raw(`/api/v1/classes/${id}/sessions`, token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as SessionSummary;
  },
  async updateSession(
    id: string,
    sessionId: string,
    input: SessionFormValues,
    token: string,
  ): Promise<SessionSummary> {
    const body = await raw(
      `/api/v1/classes/${id}/sessions/${sessionId}`,
      token,
      { method: "PUT", headers: json, body: JSON.stringify(input) },
    );
    return body.data as SessionSummary;
  },
  async deleteSession(
    id: string,
    sessionId: string,
    token: string,
  ): Promise<void> {
    await raw(`/api/v1/classes/${id}/sessions/${sessionId}`, token, {
      method: "DELETE",
    });
  },
  async rescheduleSession(
    id: string,
    sessionId: string,
    payload: { start_at: string; end_at: string; reason: string },
    token: string,
  ): Promise<SessionSummary> {
    const body = await raw(
      `/api/v1/classes/${id}/sessions/${sessionId}/reschedule`,
      token,
      { method: "POST", headers: json, body: JSON.stringify(payload) },
    );
    return body.data as SessionSummary;
  },
  async cancelSession(
    id: string,
    sessionId: string,
    payload: { reason: string; force?: boolean },
    token: string,
  ): Promise<SessionDetail> {
    const body = await raw(
      `/api/v1/classes/${id}/sessions/${sessionId}/cancel`,
      token,
      { method: "PATCH", headers: json, body: JSON.stringify(payload) },
    );
    return body.data as SessionDetail;
  },
  async duplicateSession(
    id: string,
    sessionId: string,
    payload: { start_at: string; end_at: string; title?: string },
    token: string,
  ): Promise<SessionSummary> {
    const body = await raw(
      `/api/v1/classes/${id}/sessions/${sessionId}/duplicate`,
      token,
      { method: "POST", headers: json, body: JSON.stringify(payload) },
    );
    return body.data as SessionSummary;
  },
  async markAttendance(
    id: string,
    sessionId: string,
    records: AttendanceRecord[],
    token: string,
  ): Promise<void> {
    await raw(
      `/api/v1/classes/${id}/sessions/${sessionId}/attendance`,
      token,
      { method: "PATCH", headers: json, body: JSON.stringify({ records }) },
    );
  },

  // ── Materials ─────────────────────────────────────────────────────────────
  async getMaterials(id: string, token: string): Promise<MaterialRow[]> {
    const body = await raw(`/api/v1/classes/${id}/materials`, token);
    return (body.data as MaterialRow[]) ?? [];
  },
  async attachMaterial(
    id: string,
    input: AttachMaterialInput,
    token: string,
  ): Promise<void> {
    await raw(`/api/v1/classes/${id}/materials`, token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(input),
    });
  },
  async detachMaterial(
    id: string,
    linkId: string,
    token: string,
  ): Promise<void> {
    await raw(`/api/v1/classes/${id}/materials/${linkId}`, token, {
      method: "DELETE",
    });
  },

  // ── Assignments (bổ sung close/unassign) ──────────────────────────────────
  async closeAssignment(
    id: string,
    linkId: string,
    token: string,
  ): Promise<void> {
    await raw(`/api/v1/classes/${id}/assignments/${linkId}/close`, token, {
      method: "POST",
    });
  },
  async unassign(id: string, linkId: string, token: string): Promise<void> {
    await raw(`/api/v1/classes/${id}/assignments/${linkId}`, token, {
      method: "DELETE",
    });
  },

  async listClassSummaries(token: string): Promise<ClassSummary[]> {
    const body = await raw("/api/v1/classes", token);
    return (body.data as ClassSummary[]) ?? [];
  },
};
