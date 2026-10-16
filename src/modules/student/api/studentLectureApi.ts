/**
 * Máy khách BÀI GIẢNG SỐ cho học sinh — xem bài giảng đã được giáo viên phát
 * cho lớp và nộp quiz theo từng hoạt động. Câu quiz đã được máy chủ STRIP
 * đáp án trước khi tới đây (xem `StudentLectureView`).
 *
 * Cùng khuôn fetch + JWT + phong bì `{success,data}` với teacherLectureApi.ts.
 * Kiểu dữ liệu dùng lại nguyên từ đó — hai phía cùng một hợp đồng dữ liệu.
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";
import type {
  LectureSectionKey,
  SectionResult,
  StudentLectureListRow,
  StudentLectureView,
} from "@/modules/teacher/api/teacherLectureApi";

const API_BASE = getAuthenticatedApiBaseUrl();
const json = { "Content-Type": "application/json" };

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
      body.message ?? body.error_code ?? `Lecture API error ${res.status}`,
    );
  return body;
}

export const studentLectureApi = {
  async list(token: string): Promise<StudentLectureListRow[]> {
    const body = await raw("/api/v1/student/lectures", token);
    return (body.data as StudentLectureListRow[]) ?? [];
  },

  async show(linkId: string, token: string): Promise<StudentLectureView> {
    const body = await raw(`/api/v1/student/lectures/${linkId}`, token);
    return body.data as StudentLectureView;
  },

  async submitSection(
    linkId: string,
    key: LectureSectionKey,
    answers: Record<string, unknown>,
    token: string,
  ): Promise<{ score: number; max_score: number; results: SectionResult[] }> {
    const body = await raw(
      `/api/v1/student/lectures/${linkId}/sections/${key}/submit`,
      token,
      {
        method: "POST",
        headers: json,
        body: JSON.stringify({ answers }),
      },
    );
    return body.data as {
      score: number;
      max_score: number;
      results: SectionResult[];
    };
  },
};
