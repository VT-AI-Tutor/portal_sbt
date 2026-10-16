/**
 * Hình dạng dữ liệu ĐƯỜNG DÂY của danh mục sách (catalog).
 *
 * Ở core chứ không ở app vì `core/api/lcmsAdapter.ts` cần chúng để dịch phản hồi
 * LCMS; core không được import ngược vào app. Learner re-export nguyên vẹn nên
 * mọi `import ... from "@/modules/catalog/api/types"` giữ nguyên đường cũ.
 */

// ---------------------------------------------------------------------------
// Catalog API Types
// Matches the shape returned by GET /api/v1/catalog/books, except that every
// entity id is normalized to a STRING at the fetch layer: the legacy API
// serializes ids as numbers and LCMS as strings (subjectId there even exceeds
// Number.MAX_SAFE_INTEGER), so string is the one shape both can satisfy.
// ---------------------------------------------------------------------------

import type { BookPreface } from '@/core/reference/bookTypes';

export interface BookListItem {
  id: string;
  slug: string;
  code: string | null;
  level: string;
  subject_code: string;
  subject_name: string;
  tap: number | null;
  title: string;
  cover_url: string | null;
  has_pdf: boolean;
  type: string;
  chapter_count: number | null;
  lesson_count: number | null;
}

export interface CatalogQuestion {
  id: string;
  exercise_id: string;
  type: string;
  content: string;
  options: { id: string; content: string }[];
  payload: Record<string, unknown>;
  points: number;
  order: number;
}

export interface CatalogLessonItem {
  id: string;
  book_id: number;
  lesson_id: number;
  title: string;
  instructions: string | null;
  type: string;
  duration_minutes: number | null;
  order: number;
  questions: CatalogQuestion[];
}

export type LessonExtraMediaType = "image" | "audio" | "video";

// Tài liệu tham khảo kèm bài học (ảnh/audio/video). Nguồn: field `extra_media`
// mới trên API chi tiết bài tập.
export interface LessonExtraMedia {
  code: string;
  title: string;
  url: string;
  type: LessonExtraMediaType;
}

export interface BookLesson {
  id: string;
  index: number;
  label: string | null; // e.g. "Bài 1"
  title: string;
  slug: string;
  code: string | null;
  page: number | null;
  pdf_key?: string | null;
  pdf_answer_key?: string | null;
  pdf_url?: string | null;
  pdf_answer_url?: string | null;
  lesson_items?: CatalogLessonItem[];
  extra_media?: LessonExtraMedia[];
}

export interface BookLessonSummary {
  id: string;
  slug: string;
  level: string;
  subject_code: string;
  subject_name: string;
  tap: number | null;
  title: string;
  publisher: string | null;
  authors: string[];
  cover_url: string | null;
  has_pdf: boolean;
}

export interface BookLessonDetail {
  book: BookLessonSummary;
  chapter: {
    id: string | null;
    index: number | null;
    title: string;
  };
  lesson: BookLesson & {
    pdf_url: string | null;
    pdf_answer_url: string | null;
  };
}

export interface BookChapter {
  id: string;
  index: number;
  title: string;
  code: string | null;
  lessons: BookLesson[];
}

// BookPreface moved to core (shared by admin); imported at the top of this file
// so it binds locally for BookDetail below, and re-exported here so existing
// catalog consumers keep importing it from this module unchanged.
export type { BookPreface };

export interface BookDetail extends BookListItem {
  publisher: string | null;
  authors: string[];
  preface: BookPreface | null;
  chapters: BookChapter[];
  // MỚI: chapters chứa bài tập nâng cao (từ API `chapterAdvanced`). Optional
  // vì API cũ/môi trường chưa nâng cấp có thể không trả field này.
  chapterAdvanced?: BookChapter[];
}

export interface BookPdfUrl {
  url: string;
  expires_in: number; // seconds
}

// ---------------------------------------------------------------------------
// API response envelopes
// ---------------------------------------------------------------------------

export interface CatalogListResponse {
  success: boolean;
  data: BookListItem[];
  total: number;
}

export interface CatalogDetailResponse {
  success: boolean;
  data: BookDetail;
}

export interface CatalogPdfUrlResponse {
  success: boolean;
  data: BookPdfUrl;
}

export interface CatalogLessonDetailResponse {
  success: boolean;
  data: BookLessonDetail;
}

// ---------------------------------------------------------------------------
// Chủ đề luyện tập công khai (GAP-147) — nguồn cho lưới landing.
// Chỉ có ở provider legacy; LCMS chưa có endpoint tương đương.
// ---------------------------------------------------------------------------

export interface PracticeTopicItem {
  level: string;
  subject_code: string;
  subject_name: string;
  content_code: string;
  label: string;
  question_available: number;
}

/** Một mức nhận thức của khung năng lực trong chi tiết chủ đề. */
export interface PracticeTopicLevel {
  level_code: string;
  label: string;
  question_available: number;
  suggested_count: number;
}

export interface PracticeTopicDetail {
  level: string;
  subject_code: string;
  content_code: string;
  label: string;
  levels: PracticeTopicLevel[];
}

export interface PracticeTopicListResponse {
  success: boolean;
  data: PracticeTopicItem[];
  total: number;
}

export interface PracticeTopicDetailResponse {
  success: boolean;
  data: PracticeTopicDetail;
}

/** Bộ lọc cho GET /api/v1/catalog/books. */
export interface ListBooksParams {
  level?: string;
  subject?: string;
  q?: string;
}
