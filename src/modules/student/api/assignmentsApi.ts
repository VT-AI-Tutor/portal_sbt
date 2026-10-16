/**
 * Bài giao của học sinh (GAP-083 / ASSIGN-R6/R7) — wraps `GET /api/v1/student/assignments`.
 * Trả bài giao gộp từ các lớp học sinh đang theo học. Cùng pattern fetch + JWT + envelope
 * `{success,data}` như practiceApi.
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";
import { getStoredSession } from "@/core/auth/storage";

const API_BASE = getAuthenticatedApiBaseUrl();

export interface StudentAssignment {
  /** id của liên kết bài giao (ClassAssignmentLink). */
  id: string;
  /** id bài tập/đề để mở làm bài. */
  assignment_id: string;
  title: string;
  class_id: string;
  class_name: string;
  session_id: string | null;
  /** Hạn nộp (ISO) hoặc null nếu không đặt hạn. */
  deadline: string | null;
  status: string;
}

export async function getMyAssignments(): Promise<StudentAssignment[]> {
  const token = getStoredSession().accessToken;
  const res = await fetch(`${API_BASE}/api/v1/student/assignments`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: StudentAssignment[];
    message?: string;
  };

  if (!res.ok || body.success === false) {
    throw new Error(body.message ?? `Assignments API error ${res.status}`);
  }

  return body.data ?? [];
}
