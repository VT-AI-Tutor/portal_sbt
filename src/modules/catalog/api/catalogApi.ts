import type {
  BookListItem,
  BookDetail,
  BookLessonDetail,
  BookPdfUrl,
  CatalogListResponse,
  CatalogDetailResponse,
  CatalogLessonDetailResponse,
  CatalogPdfUrlResponse,
  PracticeTopicDetail,
  PracticeTopicDetailResponse,
  PracticeTopicItem,
  PracticeTopicListResponse,
} from "./types";
import { getCatalogApiBaseUrl, getApiProvider } from "@/core/api/config";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import {
  lcmsGetBook,
  lcmsGetBookLesson,
  lcmsGetBookPdfUrl,
  lcmsGetLessonPdfUrl,
  lcmsListBooks,
} from "@/core/api/lcmsAdapter";

const API_BASE = getCatalogApiBaseUrl();

/**
 * True when the secondary LCMS provider is enabled via config.
 *
 * KHÔNG phải React hook — chỉ đọc config. Tên cũ `useLcms` khiến
 * `react-hooks/rules-of-hooks` báo nhầm 16 lỗi vì tiền tố `use`.
 */
function lcmsEnabled(): boolean {
  return getApiProvider() === "lcms";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Catalog API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Legacy id normalization — the FE contract uses STRING ids everywhere (see
// types.ts) but the legacy API serializes them as numbers, so every legacy
// response passes through these converters before reaching callers.
// ---------------------------------------------------------------------------

const idStr = (v: unknown): string => (v == null ? "" : String(v));

/**
 * Bìa sách được lưu dạng đường dẫn không kèm host ("/storage/book-assets/…")
 * với sách nhập từ ZIP — tệp nằm trên API, không phải origin của web, nên phải
 * ghép base API trước khi render. URL tuyệt đối (bìa danh mục trên CDN/gateway)
 * được resolveAssetUrl giữ nguyên.
 */
const coverUrl = (url: string | null): string | null =>
  url ? resolveAssetUrl(url) : url;

function normalizeBookListItem(b: BookListItem): BookListItem {
  return { ...b, id: idStr(b.id), cover_url: coverUrl(b.cover_url) };
}

function normalizeBookDetail(b: BookDetail): BookDetail {
  return {
    ...normalizeBookListItem(b),
    publisher: b.publisher,
    authors: b.authors,
    preface: b.preface,
    chapters: (b.chapters ?? []).map((ch) => ({
      ...ch,
      id: idStr(ch.id),
      lessons: (ch.lessons ?? []).map((l) => ({ ...l, id: idStr(l.id) })),
    })),
  };
}

function normalizeBookLessonDetail(d: BookLessonDetail): BookLessonDetail {
  return {
    ...d,
    book: {
      ...d.book,
      id: idStr(d.book.id),
      cover_url: coverUrl(d.book.cover_url),
    },
    chapter: {
      ...d.chapter,
      id: d.chapter.id == null ? null : idStr(d.chapter.id),
    },
    lesson: { ...d.lesson, id: idStr(d.lesson.id) },
  };
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

// Định nghĩa ở packages/core (lcmsAdapter cần); re-export giữ đường cũ.
export type { ListBooksParams } from "@/core/api/catalogTypes";
import type { ListBooksParams } from "@/core/api/catalogTypes";

/**
 * GET /api/v1/catalog/books
 * Returns the lightweight book list (for the catalog grid).
 */
export async function listBooks(
  params: ListBooksParams = {},
): Promise<BookListItem[]> {
  if (lcmsEnabled()) return lcmsListBooks(params);
  const qs = new URLSearchParams();
  if (params.level != null) qs.set("level", params.level);
  if (params.subject) qs.set("subject", params.subject);
  if (params.q) qs.set("q", params.q);
  qs.set("_", String(Date.now()));

  const query = qs.toString() ? `?${qs.toString()}` : "";
  const res = await apiFetch<CatalogListResponse>(
    `/api/v1/catalog/books${query}`,
  );
  return res.data.map(normalizeBookListItem);
}

/**
 * GET /api/v1/catalog/books/{identifier}
 * Returns the full book detail. Accepts numeric id or string code.
 */
export async function getBook(
  identifier: number | string,
): Promise<BookDetail> {
  if (lcmsEnabled()) return lcmsGetBook(identifier);
  const res = await apiFetch<CatalogDetailResponse>(
    `/api/v1/catalog/books/${identifier}`,
  );
  return normalizeBookDetail(res.data);
}

/**
 * GET /api/v1/catalog/books/{id}/pdf-url
 * Returns a short-lived presigned URL for the book's PDF.
 * Requires a JWT token in the Authorization header.
 */
export async function getBookPdfUrl(
  id: number | string,
  token: string,
): Promise<BookPdfUrl> {
  if (lcmsEnabled()) return lcmsGetBookPdfUrl(id, token);
  const res = await apiFetch<CatalogPdfUrlResponse>(
    `/api/v1/catalog/books/${id}/pdf-url`,
    {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    },
  );
  return res.data;
}

/**
 * GET /api/v1/catalog/books/{bookId}/lessons/{lessonId}
 * Returns book/chapter/lesson context with pdf_url resolved via the media gateway.
 *
 * `isAdvanced` chỉ áp dụng cho LCMS provider (chuyển sang `?is_advanced=true`).
 * Legacy provider không có khái niệm này — bỏ qua.
 */
export async function getBookLesson(
  bookId: number | string,
  lessonId: number | string,
  isAdvanced: boolean = false,
): Promise<BookLessonDetail> {
  if (lcmsEnabled()) return lcmsGetBookLesson(bookId, lessonId, isAdvanced);
  const res = await apiFetch<CatalogLessonDetailResponse>(
    `/api/v1/catalog/books/${bookId}/lessons/${lessonId}`,
  );
  return normalizeBookLessonDetail(res.data);
}

/**
 * GET /api/v1/catalog/books/{bookId}/lessons/{lessonId}/pdf-url
 * Returns a public gateway URL for a lesson PDF (legacy; prefer getBookLesson).
 */
export async function getLessonPdfUrl(
  bookId: number | string,
  lessonId: number | string,
): Promise<BookPdfUrl> {
  if (lcmsEnabled()) return lcmsGetLessonPdfUrl(bookId, lessonId);
  const res = await apiFetch<CatalogPdfUrlResponse>(
    `/api/v1/catalog/books/${bookId}/lessons/${lessonId}/pdf-url`,
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Chủ đề luyện tập công khai (GAP-147)
// ---------------------------------------------------------------------------

export interface ListPracticeTopicsParams {
  /** Mã khối ("3"). Bỏ trống = mọi khối. */
  level?: string;
  /** subject_code ("toan"). Bỏ trống = mọi môn. */
  subject?: string;
}

/**
 * GET /api/v1/catalog/practice/topics
 * Cả hai tham số đều tuỳ chọn → landing lấy cả lưới bằng MỘT request.
 *
 * LCMS chưa có endpoint tương đương: trả rỗng thay vì gọi nhầm sang backend
 * legacy (base URL khác), để khu duyệt tự rơi vào empty-state thay vì lỗi mạng.
 */
export async function listPracticeTopics(
  params: ListPracticeTopicsParams = {},
): Promise<PracticeTopicItem[]> {
  // Gọi thẳng getApiProvider() thay vì lcmsEnabled(): tên hàm đó bắt đầu bằng "use"
  // nên eslint react-hooks tưởng là hook và báo lỗi ở mọi nơi gọi (4 lỗi có sẵn
  // trong file này) — không thêm lỗi thứ 5.
  if (getApiProvider() === "lcms") return [];

  const qs = new URLSearchParams();
  if (params.level) qs.set("level", params.level);
  if (params.subject) qs.set("subject", params.subject);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const res = await apiFetch<PracticeTopicListResponse>(
    `/api/v1/catalog/practice/topics${suffix}`,
  );
  return res.data;
}

/**
 * GET /api/v1/catalog/practice/topics/{contentCode}?level=&subject=
 * Chi tiết một chủ đề, bung theo mức nhận thức. Cả level và subject BẮT BUỘC.
 */
export async function getPracticeTopic(
  contentCode: string,
  level: string,
  subject: string,
): Promise<PracticeTopicDetail> {
  const qs = new URLSearchParams({ level, subject });
  const res = await apiFetch<PracticeTopicDetailResponse>(
    `/api/v1/catalog/practice/topics/${encodeURIComponent(contentCode)}?${qs.toString()}`,
  );
  return res.data;
}
