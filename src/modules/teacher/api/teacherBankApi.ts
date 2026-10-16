/**
 * Teacher question bank API client (Task 4 / lát 2 teacher stack) — ngân hàng
 * câu hỏi cá nhân + AI của giáo viên. Cùng pattern fetch + JWT + envelope
 * `{success,data}` như teacherClassesApi.ts.
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";

const API_BASE = getAuthenticatedApiBaseUrl();
const json = { "Content-Type": "application/json" };

/**
 * Nguồn câu hỏi trong khu Giáo viên.
 *
 * `library` = KHO HỌC LIỆU dùng chung của hệ, giáo viên mượn câu từ đó (chỉ
 * đọc). Tên mô tả VAI TRÒ, không mang tên brand nào — tên nhà xuất bản thuộc
 * về khu Sách, và hệ chạy nhiều brand nên đóng đinh brand vào đây là sai
 * (Owner 2026-08-15).
 */
export type QuestionSource = "personal" | "ai" | "library";

export interface TeacherQuestion {
  id: string;
  created_by: string;
  source: QuestionSource;
  question_type: string;
  subject?: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  question_text: string;
  payload?: unknown;
  created_at: string;
  [key: string]: unknown;
}

export interface TeacherQuestionInput {
  question_type: string;
  subject?: string;
  topic: string;
  difficulty?: "easy" | "medium" | "hard";
  question_text: string;
  payload?: unknown;
}

export interface AiSaveResult {
  saved: TeacherQuestion[];
  rejected: { question_text: string; reason: string }[];
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
        `Teacher question bank API error ${res.status}`,
    );
  return body;
}

export const teacherBankApi = {
  /**
   * @param scope Kho học liệu đòi phạm vi (môn, lớp) — nó có hàng nghìn câu,
   *   backend từ chối quét toàn kho và trả rỗng nếu thiếu. Nguồn `personal`/`ai`
   *   không cần.
   */
  async list(
    source: QuestionSource,
    token: string,
    scope?: { subject?: string; level?: string },
  ): Promise<TeacherQuestion[]> {
    const params = new URLSearchParams({ source });
    if (scope?.subject) params.set("subject", scope.subject);
    if (scope?.level) params.set("level", scope.level);
    const body = await raw(
      `/api/v1/teacher/question-bank/questions?${params.toString()}`,
      token,
    );
    return (body.data as TeacherQuestion[]) ?? [];
  },

  async create(
    input: TeacherQuestionInput,
    token: string,
  ): Promise<TeacherQuestion> {
    const body = await raw("/api/v1/teacher/question-bank/questions", token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as TeacherQuestion;
  },

  async update(
    id: string,
    input: TeacherQuestionInput,
    token: string,
  ): Promise<TeacherQuestion> {
    const body = await raw(
      `/api/v1/teacher/question-bank/questions/${id}`,
      token,
      {
        method: "PUT",
        headers: json,
        body: JSON.stringify(input),
      },
    );
    return body.data as TeacherQuestion;
  },

  async remove(id: string, token: string): Promise<void> {
    await raw(`/api/v1/teacher/question-bank/questions/${id}`, token, {
      method: "DELETE",
    });
  },

  async saveFromAi(
    questions: TeacherQuestionInput[],
    token: string,
  ): Promise<AiSaveResult> {
    const body = await raw(
      "/api/v1/teacher/question-bank/questions/from-ai",
      token,
      {
        method: "POST",
        headers: json,
        body: JSON.stringify({ questions }),
      },
    );
    return body.data as AiSaveResult;
  },
};
