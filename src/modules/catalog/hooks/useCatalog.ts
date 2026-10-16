import { useQuery } from "@tanstack/react-query";
import {
  listBooks,
  getBook,
  getBookLesson,
  getBookPdfUrl,
  getLessonPdfUrl,
  getPracticeTopic,
  listPracticeTopics,
  type ListBooksParams,
  type ListPracticeTopicsParams,
} from "../api/catalogApi";
import type {
  BookListItem,
  BookDetail,
  BookLessonDetail,
  BookPdfUrl,
  PracticeTopicDetail,
  PracticeTopicItem,
} from "../api/types";
import { getApiProvider } from "@/core/api/config";

// ---------------------------------------------------------------------------
// Cache times — legacy matches the server's Cache-Control: max-age=3600.
// LCMS responses embed presigned media URLs that expire after ~1h
// (lcms.presigned-expiry), so they must go stale well before that.
// ---------------------------------------------------------------------------
export const CATALOG_STALE_TIME =
  getApiProvider() === "lcms"
    ? 30 * 60 * 1000 // 30 minutes — half the presigned URL lifetime
    : 0; // publish/import changes must be visible immediately on test/staging

// ---------------------------------------------------------------------------
// Query key factory — keyed by provider so a config switch never mixes
// cached legacy and LCMS data.
// ---------------------------------------------------------------------------
export const catalogKeys = {
  all: ["catalog", getApiProvider()] as const,
  lists: () => [...catalogKeys.all, "list"] as const,
  list: (params: ListBooksParams) => [...catalogKeys.lists(), params] as const,
  details: () => [...catalogKeys.all, "detail"] as const,
  detail: (id: number | string) => [...catalogKeys.details(), id] as const,
  pdfUrls: () => [...catalogKeys.all, "pdf-url"] as const,
  pdfUrl: (id: number | string) => [...catalogKeys.pdfUrls(), id] as const,
  lessonPdfUrl: (bookId: number | string, lessonId: number | string) =>
    [...catalogKeys.pdfUrls(), "lesson", bookId, lessonId] as const,
  lessons: () => [...catalogKeys.all, "lesson"] as const,
  lesson: (bookId: number | string, lessonId: number | string) =>
    [...catalogKeys.lessons(), bookId, lessonId] as const,
  practiceTopicsAll: () => [...catalogKeys.all, "practice-topics"] as const,
  practiceTopics: (params: ListPracticeTopicsParams) =>
    [...catalogKeys.practiceTopicsAll(), params] as const,
  practiceTopic: (contentCode: string, level: string, subject: string) =>
    [...catalogKeys.practiceTopicsAll(), contentCode, level, subject] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all books (optionally filtered by level / subject / search query).
 * Cached for 1 hour, matching the server's Cache-Control headers.
 */
export function useCatalogBooks(params: ListBooksParams = {}) {
  return useQuery<BookListItem[], Error>({
    queryKey: catalogKeys.list(params),
    queryFn: () => listBooks(params),
    staleTime: CATALOG_STALE_TIME,
  });
}

/**
 * Fetch full detail for a single book by id.
 */
export function useCatalogBook(identifier: number | string | undefined) {
  return useQuery<BookDetail, Error>({
    queryKey: catalogKeys.detail(identifier ?? ""),
    queryFn: () => getBook(identifier!),
    enabled: identifier != null && identifier !== "",
    staleTime: CATALOG_STALE_TIME,
  });
}

/**
 * Fetch a public gateway PDF URL for a book (requires JWT).
 */
export function useBookPdfUrl(
  id: number | string | undefined,
  token: string | undefined,
) {
  return useQuery<BookPdfUrl, Error>({
    queryKey: catalogKeys.pdfUrl(id ?? ""),
    queryFn: () => getBookPdfUrl(id!, token!),
    enabled: id != null && id !== "" && !!token,
    staleTime: CATALOG_STALE_TIME,
  });
}

/**
 * Fetch lesson detail with pdf_url resolved (single call for the lesson page).
 *
 * `isAdvanced` chuyển sang endpoint `?is_advanced=true` (chỉ áp dụng cho LCMS)
 * để lấy bộ câu hỏi nâng cao. Đưa vào `queryKey` để cache tách hẳn — không
 * lẫn đáp án cơ bản/nâng cao.
 *
 * `enabled` cho phép caller TẮT query (vd khi đang dùng nguồn khác thay thế).
 * Mặc định = true.
 */
export function useCatalogBookLesson(
  bookId: number | string | undefined,
  lessonId: number | string | undefined,
  isAdvanced: boolean = false,
  enabled: boolean = true,
) {
  return useQuery<BookLessonDetail, Error>({
    queryKey: [
      ...catalogKeys.lesson(bookId ?? "", lessonId ?? ""),
      isAdvanced ? "advanced" : "basic",
    ],
    queryFn: () => getBookLesson(bookId!, lessonId!, isAdvanced),
    enabled:
      enabled &&
      bookId != null &&
      bookId !== "" &&
      lessonId != null &&
      lessonId !== "",
    staleTime: 0,
  });
}

/**
 * Fetch a public gateway URL for a lesson PDF.
 */
export function useLessonPdfUrl(
  bookId: number | string | undefined,
  lessonId: number | string | undefined,
) {
  return useQuery<BookPdfUrl, Error>({
    queryKey: catalogKeys.lessonPdfUrl(bookId ?? "", lessonId ?? ""),
    queryFn: () => getLessonPdfUrl(bookId!, lessonId!),
    enabled:
      bookId != null && bookId !== "" && lessonId != null && lessonId !== "",
    staleTime: CATALOG_STALE_TIME,
  });
}

/**
 * Chủ đề luyện tập công khai (GAP-147). Không truyền tham số = cả lưới trong
 * MỘT request; landing lọc theo lớp/môn ở phía client.
 */
export function usePracticeTopics(params: ListPracticeTopicsParams = {}) {
  return useQuery<PracticeTopicItem[], Error>({
    queryKey: catalogKeys.practiceTopics(params),
    queryFn: () => listPracticeTopics(params),
    staleTime: CATALOG_STALE_TIME,
  });
}

/** Chi tiết một chủ đề, bung theo mức nhận thức. */
export function usePracticeTopic(
  contentCode: string | undefined,
  level: string | undefined,
  subject: string | undefined,
) {
  return useQuery<PracticeTopicDetail, Error>({
    queryKey: catalogKeys.practiceTopic(
      contentCode ?? "",
      level ?? "",
      subject ?? "",
    ),
    queryFn: () => getPracticeTopic(contentCode!, level!, subject!),
    enabled: Boolean(contentCode && level && subject),
    staleTime: CATALOG_STALE_TIME,
    retry: false, // 404 (chủ đề không có ở khối/môn đó) là kết quả, không phải lỗi tạm.
  });
}
