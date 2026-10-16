import { getCatalogApiBaseUrl } from "@/core/api/config";
import { getStoredSession } from "@/core/auth/storage";

const API_BASE = getCatalogApiBaseUrl();

export interface PreviewLesson {
  id: string;
  title: string;
  slug: string;
  code: string | null;
  index: number;
}

export interface PreviewQuestion {
  id: string;
  order_index: number;
  question_type: string;
  payload: Record<string, unknown>;
}

export interface PreviewLessonView {
  lesson: PreviewLesson;
  lesson_items: Array<{
    id: string;
    title: string | null;
    questions: PreviewQuestion[];
  }>;
}

export interface PreviewBook {
  id: string;
  title: string;
  subject_name: string;
  level: string;
  cover_url: string | null;
  publisher: string | null;
  authors: string[];
  chapters: Array<{
    id: string;
    title: string;
    lessons: Array<{ id: string; title: string; slug: string }>;
  }>;
}

async function previewFetch<T>(path: string): Promise<T> {
  // The preview API is gated to admins for now; send the stored token if any.
  // Admin sessions live under their own scope ("evo_admin_auth_*"): reading the
  // default "user" scope sent no Authorization header at all for an admin-only
  // login, so every freshly imported (draft) book rendered "Không tìm thấy sách"
  // even though /api/v1/preview/books/{id} returns it fine.
  const token =
    getStoredSession("admin").accessToken ?? getStoredSession().accessToken;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "Cần đăng nhập tài khoản admin để xem nội dung chưa công bố.",
    );
  }
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    message?: string;
  };
  if (!res.ok || body.success === false || !body.data) {
    throw new Error(body.message ?? `Preview error ${res.status}`);
  }
  return body.data;
}

export function getPreviewBook(bookId: string): Promise<PreviewBook> {
  return previewFetch<PreviewBook>(`/api/v1/preview/books/${bookId}`);
}

export function getPreviewLesson(
  bookId: string,
  lessonId: string,
): Promise<PreviewLessonView> {
  return previewFetch<PreviewLessonView>(
    `/api/v1/preview/books/${bookId}/lessons/${lessonId}`,
  );
}
