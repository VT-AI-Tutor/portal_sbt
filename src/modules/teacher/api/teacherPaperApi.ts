/**
 * Teacher paper API client (Task 4 / lát 3 teacher stack) — đề kiểm tra /
 * phiếu bài tập của giáo viên. Cùng pattern fetch + JWT + envelope
 * `{success,data}` như teacherBankApi.ts.
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";

const API_BASE = getAuthenticatedApiBaseUrl();
const json = { "Content-Type": "application/json" };

export type PaperKind = "exam" | "worksheet";

export interface PaperQuestion {
  id: string;
  type: string;
  content: string;
  options: unknown[];
  payload: unknown;
  correct_answer: unknown;
  points: number;
  /**
   * Ô ma trận sinh ra câu này — bản in dựng lại bảng ma trận từ đây. `label` là
   * nhãn chủ đề ĐÔNG CỨNG lúc ra đề: bảng ma trận in ra là giấy nộp cho nhà
   * trường nên phải đọc được, và phải giữ đúng tên tại thời điểm ra đề.
   */
  blueprint_cell?: { content_code: string; level_code: string; label?: string };
}

export interface TeacherPaper {
  id: string;
  created_by: string;
  kind: PaperKind;
  title: string;
  subject?: string;
  level?: string;
  duration_minutes?: number | null;
  questions: PaperQuestion[];
  total_points?: number | null;
  blueprint_id?: string;
  blueprint_snapshot?: unknown;
  created_at: string;
  [key: string]: unknown;
}

export interface TeacherPaperInput {
  kind: PaperKind;
  title: string;
  subject?: string;
  level?: string;
  duration_minutes?: number | null;
  question_ids: string[];
  /** PAPER-R13 — thang điểm đề kiểm tra và điểm từng câu (map id câu => điểm). */
  total_points?: number;
  question_points?: Record<string, number>;
  /** PAPER-R14 — ô ma trận của từng câu và ma trận đã sinh ra đề. */
  blueprint_cells?: Record<
    string,
    { content_code: string; level_code: string; label?: string }
  >;
  blueprint_id?: string;
  blueprint_snapshot?: unknown;
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
        `Teacher paper API error ${res.status}`,
    );
  return body;
}

export const teacherPaperApi = {
  async list(token: string): Promise<TeacherPaper[]> {
    const body = await raw("/api/v1/teacher/papers", token);
    return (body.data as TeacherPaper[]) ?? [];
  },

  async create(input: TeacherPaperInput, token: string): Promise<TeacherPaper> {
    const body = await raw("/api/v1/teacher/papers", token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as TeacherPaper;
  },

  async update(
    id: string,
    input: TeacherPaperInput,
    token: string,
  ): Promise<TeacherPaper> {
    const body = await raw(`/api/v1/teacher/papers/${id}`, token, {
      method: "PUT",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as TeacherPaper;
  },

  async remove(id: string, token: string): Promise<void> {
    await raw(`/api/v1/teacher/papers/${id}`, token, {
      method: "DELETE",
    });
  },
};
