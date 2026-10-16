import type {
  BookDetail,
  BookChapter,
  BookLesson,
  BookLessonDetail,
  BookListItem,
  BookPdfUrl,
  CatalogLessonItem,
  CatalogQuestion,
  LessonExtraMedia,
  LessonExtraMediaType,
} from "@/core/api/catalogTypes";
import {
  getLcmsApiBaseUrl,
  getLcmsAuthBaseUrl,
  getLcmsDefaultPassword,
  getLcmsMasteryApiBaseUrl,
} from "@/core/api/config";
import type { ReferenceItem } from "@/core/reference/types";
import {
  clearSession,
  getStoredSession,
  saveSession,
  SESSION_EXPIRED_EVENT,
} from "@/core/auth/storage";
import type { AuthMeResponse, AuthTokenResponse } from "@/core/auth/types";
import type { ListBooksParams } from "@/core/api/catalogTypes";
import type {
  AnswerValue,
  AttemptStart,
  CurrentAttempt,
  ExerciseDetail,
  ExerciseListItem,
  HistoryItem,
  HistoryResult,
  QuestionOption,
  StudentQuestion,
  SubmissionDetail,
  SubmitResult,
} from "@/core/api/assessmentTypes";

// ---------------------------------------------------------------------------
// LCMS adapter (secondary provider).
//
// The legacy catalog API is the primary, native contract of this app. This
// adapter calls the NXB LCMS public API (/api/lcms/*, spec
// "API_Specifications-LCMS" v2.0) and converts its responses one-way into the
// legacy shapes in ./types. Nothing outside this file should depend on LCMS
// field names.
// ---------------------------------------------------------------------------

// Raw LCMS wire types — internal only. Spelling ("excercise", "pdf_key",
// "pdf_answer") follows the LCMS spec verbatim. The spec declares ids as
// longs but the live API serializes them as strings (and subjectId exceeds
// Number.MAX_SAFE_INTEGER), so every id is number|string here, compared via
// String() keys, and only safely small numerics get coerced with toNum().
type LcmsId = number | string;

interface LcmsEnvelope<T> {
  success: boolean;
  message: string | null;
  data: T | null;
  total: number | null;
}

interface LcmsBookListItem {
  id: LcmsId;
  gradeId: LcmsId;
  subjectId: LcmsId;
  /** Số tập ở endpoint danh sách; 0 = sách không chia tập. */
  bookNumber: number | string | null;
  name: string;
  author: string | null;
  coverUrl: string | null;
}

interface LcmsExcercise {
  id: LcmsId;
  name: string;
  index: number | string;
  startPage: number | string | null;
  pdf_answer: string | null; // presigned URL, ~1h expiry
  pdf_key: string | null; // presigned URL, ~1h expiry
}

interface LcmsChapter {
  id: LcmsId;
  code: string | null;
  name: string;
  priority: number | string;
  // The live API nests the exercise array under `lessons`; the spec calls it
  // `excercise`. Accept both, plus a single `excercise` object as returned by
  // the exercise-detail endpoint.
  lessons?: LcmsExcercise[];
  excercise?: LcmsExcercise[] | LcmsExcercise;
}

/** Read a chapter's exercise list regardless of which key the API used. */
function chapterLessons(ch: LcmsChapter): LcmsExcercise[] {
  if (Array.isArray(ch.lessons)) return ch.lessons;
  if (Array.isArray(ch.excercise)) return ch.excercise;
  if (ch.excercise) return [ch.excercise]; // single object (exercise-detail)
  return [];
}

interface LcmsBookDetail {
  id: LcmsId;
  gradeId: LcmsId;
  subjectId: LcmsId;
  tap: number | string | null;
  name: string;
  bookType: string | null;
  author: string | null;
  coverUrl: string | null;
  coverMediaId: LcmsId | null;
  chapters: LcmsChapter[];
  // MỚI: chapters chứa bài tập nâng cao. Cùng shape với `chapters`; chapter
  // nào chưa có bài nâng cao sẽ bị API loại bỏ. Optional vì API cũ/môi trường
  // chưa nâng cấp có thể không trả field này.
  chapterAdvanced?: LcmsChapter[];
}

// Exercise-detail endpoint (`/book-excercise/public/detail/{id}`) returns a
// DIFFERENT envelope than book-detail: {book, chapters:[chapter], lesson},
// where `lesson.lesson_items` is a single OBJECT carrying the interactive
// questions (each question's schema is a JSON string in `schema_payload`).
interface LcmsBookSummary {
  id: LcmsId;
  gradeId: LcmsId;
  subjectId: LcmsId;
  tap: number | string | null;
  name: string;
  bookType: string | null;
  author: string | null;
  coverUrl: string | null;
  coverMediaId: LcmsId | null;
}

interface LcmsRawQuestion {
  id: LcmsId;
  content: string;
  points: number | string;
  order: number | string;
  // The spec sends the v1 question schema as a `schema_payload` JSON string;
  // the live API renamed it to `payload` and sends a parsed object. Accept
  // both (same for `options`: JSON string per spec, parsed array live).
  schema_payload?: unknown;
  payload?: unknown;
  options: unknown;
}

// Envelope cũ: MỘT object mang danh tính bài học (`name`, `id`). Envelope mới:
// MẢNG các phần của bài, mỗi phần chỉ có `title` — không `name`, không `id`.
interface LcmsLessonItems {
  name?: string;
  title?: string | null;
  questions: LcmsRawQuestion[];
  index: number | string;
  id?: LcmsId;
  lesson_id: LcmsId;
}

// Tài liệu tham khảo kèm bài học — field `extra_media` mới trên API detail.
interface LcmsExtraMedia {
  ex_media_code?: string | null;
  ex_media_objectName?: string | null;
  ex_media_type?: string | null;
  ex_media_title?: string | null;
}

interface LcmsExerciseLesson {
  name: string;
  index: number | string;
  pdf_key?: string | null;
  pdf_answer?: string | null;
  id: LcmsId;
  page: number | string | null;
  lesson_items?: LcmsLessonItems | LcmsLessonItems[] | null;
  extra_media?: LcmsExtraMedia[] | null;
}

interface LcmsExerciseDetail {
  book: LcmsBookSummary;
  chapters: LcmsChapter[]; // [{id, code, name, priority}] — no lessons here
  lesson: LcmsExerciseLesson;
  extra_media?: LcmsExtraMedia[] | null; // fallback: một số bản trả về ở gốc
}

interface LcmsGrade {
  id: LcmsId;
  code: string;
  name: string;
  level: number | string;
}

interface LcmsSubject {
  id: LcmsId;
  code: string;
  name: string;
  coverUrl: string | null;
}

/** Coerce a numeric-ish wire value to number; null/invalid → null. */
function toNum(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Parse a JSON string defensively; malformed/empty → fallback. */
function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/**
 * Một lesson_item của LCMS → CatalogLessonItem. Each question's
 * `schema_payload` (a JSON string) is parsed into `payload` — the v1 schema
 * object the exercise players consume — and its `type` drives the player.
 */
function toLessonItem(
  li: LcmsLessonItems,
  book: LcmsBookSummary,
  order: number,
): CatalogLessonItem {
  // Envelope mới không gửi `id` cho từng phần; ghép lesson_id + thứ tự để các
  // phần vẫn có khoá ổn định, khác nhau.
  const itemId = String(li.id ?? `${li.lesson_id}-${order}`);
  const questions: CatalogQuestion[] = (li.questions ?? []).map((q) => {
    const schema = normalizeSchema(q.payload ?? q.schema_payload);
    return {
      id: String(q.id),
      exercise_id: itemId,
      type: typeof schema.type === "string" ? schema.type : "",
      content: q.content ?? "",
      options: normalizeOptions(q.options),
      payload: schema,
      points: toNum(q.points) ?? 0,
      order: toNum(q.order) ?? 0,
    };
  });
  return {
    id: itemId,
    book_id: toNum(book.id) ?? 0,
    lesson_id: toNum(li.lesson_id) ?? 0,
    // CHỈ `title` (envelope mới) mới là tên phần; `name` của envelope cũ là tên
    // BÀI HỌC — lấy nhầm thì mỗi câu hỏi bị gắn lại đúng tiêu đề bài đang đọc.
    title: li.title ?? "",
    instructions: null,
    type: "quiz",
    duration_minutes: null,
    order,
    questions,
  };
}

// Suy ra loại media từ đuôi file trước, rồi mới tin `ex_media_type` — API có
// case gắn nhãn sai (vd .mp4 nhưng type="audio"). Không nhận ra → null (bỏ qua).
const EXTRA_MEDIA_EXT: Record<string, LessonExtraMediaType> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  bmp: "image",
  avif: "image",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  oga: "audio",
  m4a: "audio",
  aac: "audio",
  flac: "audio",
  mp4: "video",
  webm: "video",
  mov: "video",
  m4v: "video",
  avi: "video",
  mkv: "video",
  ogv: "video",
};

function extraMediaType(
  url: string,
  declared: string | null | undefined,
): LessonExtraMediaType | null {
  const path = url.split(/[?#]/)[0];
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  if (EXTRA_MEDIA_EXT[ext]) return EXTRA_MEDIA_EXT[ext];
  if (declared === "image" || declared === "audio" || declared === "video") {
    return declared;
  }
  return null;
}

/** LCMS extra_media[] → app LessonExtraMedia[]; bỏ mục thiếu URL/loại. */
function toExtraMedia(
  list: LcmsExtraMedia[] | null | undefined,
): LessonExtraMedia[] {
  return (list ?? [])
    .map((m): LessonExtraMedia | null => {
      const url = m.ex_media_objectName ?? "";
      const type = extraMediaType(url, m.ex_media_type);
      if (!url || !type) return null;
      return {
        code: m.ex_media_code ?? "",
        title: m.ex_media_title ?? "",
        url,
        type,
      };
    })
    .filter((m): m is LessonExtraMedia => m !== null);
}

// ---------------------------------------------------------------------------
// Fetch + envelope handling
// ---------------------------------------------------------------------------

const NOT_FOUND = "not-found";

class LcmsNotFoundError extends Error {
  constructor() {
    super(`Catalog API error 404: ${NOT_FOUND}`);
    this.name = "LcmsNotFoundError";
  }
}

/**
 * LCMS returns HTTP 200 with {success:false, message:"not-found"} when there
 * is no data; that case surfaces as an error here (mirroring the legacy 404
 * behaviour) so React Query's isError paths keep working.
 */
async function lcmsFetch<T>(path: string): Promise<{ data: T; total: number | null }> {
  const url = `${getLcmsApiBaseUrl()}/api/lcms${path}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Catalog API error ${res.status}: ${body}`);
  }

  const envelope = (await res.json()) as LcmsEnvelope<T>;
  if (!envelope.success || envelope.data == null) {
    if (envelope.message === NOT_FOUND) throw new LcmsNotFoundError();
    throw new Error(`Catalog API error: ${envelope.message ?? "unknown"}`);
  }
  return { data: envelope.data, total: envelope.total };
}

function isNotFound(error: unknown): boolean {
  return error instanceof LcmsNotFoundError;
}

// ---------------------------------------------------------------------------
// Reference data (grades, subjects) — memoized per page load
// ---------------------------------------------------------------------------

// Maps are keyed by String(id): the live API serializes ids as strings and
// subjectId is beyond Number.MAX_SAFE_INTEGER, so string keys are the only
// safe way to match books to their grade/subject.

/** String(gradeId) → grade (`level` matches legacy `level`). */
let gradesPromise: Promise<Map<string, LcmsGrade>> | null = null;
/** String(subjectId) → subject, `code` matching legacy `subject_code`. */
let subjectsPromise: Promise<Map<string, LcmsSubject>> | null = null;

function loadGrades(): Promise<Map<string, LcmsGrade>> {
  gradesPromise ??= lcmsFetch<LcmsGrade[]>("/grade/public/list-for-select")
    .then((res) => new Map(res.data.map((g) => [String(g.id), g])))
    .catch((error) => {
      gradesPromise = null; // retry on next call
      if (isNotFound(error)) return new Map<string, LcmsGrade>();
      throw error;
    });
  return gradesPromise;
}

function loadSubjects(): Promise<Map<string, LcmsSubject>> {
  subjectsPromise ??= lcmsFetch<LcmsSubject[]>("/subject/public/list-for-select")
    .then((res) => new Map(res.data.map((s) => [String(s.id), s])))
    .catch((error) => {
      subjectsPromise = null; // retry on next call
      if (isNotFound(error)) return new Map<string, LcmsSubject>();
      throw error;
    });
  return subjectsPromise;
}

/**
 * Grades as legacy reference items. `code` is the grade's `level` (as a
 * string): the UI stores it on the student profile and passes it as the
 * catalog `level` filter, which is compared strictly against
 * BookListItem.level (also String(grade.level)).
 */
export async function lcmsListLevels(): Promise<ReferenceItem[]> {
  const grades = await loadGrades();
  return [...grades.values()]
    .map((g) => ({
      code: String(g.level),
      label: g.name,
      order: toNum(g.level) ?? 0,
    }))
    .sort((a, b) => a.order - b.order);
}

/** Subjects as legacy reference items; `code` matches BookListItem.subject_code. */
export async function lcmsListSubjects(): Promise<ReferenceItem[]> {
  const subjects = await loadSubjects();
  return [...subjects.values()].map((s, i) => ({
    code: s.code,
    label: s.name,
    order: i,
  }));
}

// ---------------------------------------------------------------------------
// Mapping LCMS → legacy shapes
// ---------------------------------------------------------------------------

/** "Nguyễn Văn A - Trần Thị B" → ["Nguyễn Văn A", "Trần Thị B"] */
function splitAuthors(author: string | null): string[] {
  if (!author) return [];
  return author
    .split(" - ")
    .map((a) => a.trim())
    .filter(Boolean);
}

function toBookListItem(
  book: LcmsBookListItem,
  grades: Map<string, LcmsGrade>,
  subjects: Map<string, LcmsSubject>,
): BookListItem {
  const subject = subjects.get(String(book.subjectId));
  const grade = grades.get(String(book.gradeId));
  return {
    id: String(book.id),
    // LCMS has no slug/code; use the id so link builders produce
    // /sach-bai-tap/{id} URLs that getBook() can resolve.
    slug: String(book.id),
    code: String(book.id),
    level: grade ? String(grade.level) : "",
    subject_code: subject?.code ?? String(book.subjectId),
    subject_name: subject?.name ?? "",
    tap: toNum(book.bookNumber) || null,
    title: book.name,
    cover_url: book.coverUrl,
    has_pdf: false, // LCMS has no whole-book PDF
    type: "standard",
    chapter_count: null,
    lesson_count: null,
  };
}

function toLesson(ex: LcmsExcercise): BookLesson {
  return {
    id: String(ex.id),
    index: toNum(ex.index) ?? 0,
    label: null,
    title: ex.name,
    slug: String(ex.id),
    code: null,
    page: toNum(ex.startPage),
    // LCMS pdf fields are already presigned URLs (unlike legacy S3 keys).
    pdf_url: ex.pdf_key,
    pdf_answer_url: ex.pdf_answer,
    // TODO(lcms-questions): populate when LCMS ships its questions API
    // (Owner decision 2026-07-07: interactive exercises come later).
    lesson_items: [],
  };
}

function toBookDetail(book: LcmsBookDetail, listItem: BookListItem): BookDetail {
  const mapChapter = (ch: LcmsChapter): BookChapter => ({
    id: String(ch.id),
    index: toNum(ch.priority) ?? 0,
    title: ch.name,
    code: ch.code,
    lessons: chapterLessons(ch).map(toLesson),
  });
  return {
    ...listItem,
    tap: toNum(book.tap),
    type: book.bookType ?? "standard",
    publisher: null,
    authors: splitAuthors(book.author),
    preface: null,
    chapters: book.chapters.map(mapChapter),
    // MỚI: map chapterAdvanced cùng shape. Bỏ qua nếu API không trả.
    chapterAdvanced: book.chapterAdvanced?.map(mapChapter),
  };
}

async function bookListItemFrom(
  book: LcmsBookDetail | LcmsBookSummary,
): Promise<BookListItem> {
  const [grades, subjects] = await Promise.all([loadGrades(), loadSubjects()]);
  return toBookListItem(
    {
      id: book.id,
      gradeId: book.gradeId,
      subjectId: book.subjectId,
      bookNumber: book.tap,
      name: book.name,
      author: book.author,
      coverUrl: book.coverUrl,
    },
    grades,
    subjects,
  );
}

// ---------------------------------------------------------------------------
// Adapter functions — same signatures/return types as the legacy catalogApi
// ---------------------------------------------------------------------------

/**
 * GET /api/lcms/book/public/list-for-select
 * The LCMS list endpoint takes no query params, so level/subject/search
 * filters are applied client-side.
 */
export async function lcmsListBooks(params: ListBooksParams = {}): Promise<BookListItem[]> {
  let books: LcmsBookListItem[];
  try {
    books = (await lcmsFetch<LcmsBookListItem[]>("/book/public/list-for-select")).data;
  } catch (error) {
    if (isNotFound(error)) return []; // empty catalog, not an error for a list
    throw error;
  }
  const [grades, subjects] = await Promise.all([loadGrades(), loadSubjects()]);

  let items = books.map((b) => toBookListItem(b, grades, subjects));
  if (params.level != null) items = items.filter((b) => b.level === params.level);
  if (params.subject) items = items.filter((b) => b.subject_code === params.subject);
  if (params.q) {
    const q = params.q.trim().toLowerCase();
    items = items.filter((b) => b.title.toLowerCase().includes(q));
  }
  return items;
}

/**
 * GET /api/lcms/book/public/detail/{bookId}
 * LCMS only resolves numeric ids — legacy string codes cannot be looked up.
 */
export async function lcmsGetBook(identifier: number | string): Promise<BookDetail> {
  const id = String(identifier).trim();
  // LCMS only resolves numeric ids; reject legacy string codes. Keep the id as
  // a string in the URL so large ids never lose precision via Number().
  if (!/^\d+$/.test(id)) throw new LcmsNotFoundError();

  const { data } = await lcmsFetch<LcmsBookDetail>(`/book/public/detail/${id}`);
  return toBookDetail(data, await bookListItemFrom(data));
}

/**
 * GET /api/lcms/book-excercise/public/detail/{exerciseId}
 * Returns {book, chapters:[chapter], lesson}. The lesson's identity lives in
 * `lesson.lesson_items` (the lesson node itself carries chapter-level values on
 * the live API), and its questions arrive with a JSON-string schema per item.
 *
 * `isAdvanced` chuyển sang endpoint `?is_advanced=true` để lấy bộ câu hỏi nâng
 * cao của cùng bài học. Response shape giống hệt — chỉ `lesson.lesson_items`
 * khác nhau (cơ bản vs nâng cao), mapping `toLessonItem` đã xử lý chung.
 */
export async function lcmsGetBookLesson(
  _bookId: number | string,
  lessonId: number | string,
  isAdvanced: boolean = false,
): Promise<BookLessonDetail> {
  // Luôn gửi `?is_advanced=...` — server phân nhánh theo flag này để trả bộ
  // câu hỏi cơ bản (`false`) hoặc nâng cao (`true`). Bỏ qua flag = server rơi
  // về mặc định (cơ bản) nhưng không rõ mặc định là gì ở mọi môi trường, nên
  // gửi tường minh cho chắc.
  const qs = `?is_advanced=${isAdvanced ? "true" : "false"}`;
  const { data } = await lcmsFetch<LcmsExerciseDetail>(
    `/book-excercise/public/detail/${String(lessonId)}${qs}`,
  );
  const chapter = data.chapters?.[0];
  const lesson = data.lesson;
  if (!chapter || !lesson) throw new LcmsNotFoundError();

  const listItem = await bookListItemFrom(data.book);

  const items = Array.isArray(lesson.lesson_items)
    ? lesson.lesson_items
    : lesson.lesson_items
      ? [lesson.lesson_items]
      : [];
  // Chỉ envelope cũ mới giấu danh tính bài học (`name`/`id`) trong lesson_items;
  // envelope mới chỉ mang tiêu đề từng phần nên danh tính lấy ở node `lesson`.
  const first = items[0];
  const identity = first && (first.id != null || first.name) ? first : null;
  const realId = identity?.id ?? lesson.id;
  const title = (identity?.name || lesson.name) ?? "";
  const index = toNum(identity?.index) ?? toNum(lesson.index) ?? 0;

  return {
    book: {
      id: listItem.id,
      slug: listItem.slug,
      level: listItem.level,
      subject_code: listItem.subject_code,
      subject_name: listItem.subject_name,
      tap: toNum(data.book.tap),
      title: listItem.title,
      publisher: null,
      authors: splitAuthors(data.book.author),
      cover_url: listItem.cover_url,
      has_pdf: false,
    },
    chapter: {
      id: String(chapter.id),
      index: toNum(chapter.priority),
      title: chapter.name,
    },
    lesson: {
      id: String(realId),
      index,
      label: null,
      title,
      slug: String(realId),
      code: null,
      page: toNum(lesson.page),
      // LCMS pdf fields are already presigned URLs.
      pdf_url: lesson.pdf_key ?? null,
      pdf_answer_url: lesson.pdf_answer ?? null,
      lesson_items: items.map((item, i) => toLessonItem(item, data.book, i)),
      extra_media: toExtraMedia(lesson.extra_media ?? data.extra_media),
    },
  };
}

/**
 * LCMS has no whole-book PDF; adapted books carry has_pdf=false so the UI
 * never requests this. Kept for signature parity with the legacy API.
 */
export async function lcmsGetBookPdfUrl(
  _id: number | string,
  _token: string,
): Promise<BookPdfUrl> {
  throw new LcmsNotFoundError();
}

/**
 * Legacy lesson pdf-url endpoint equivalent: the exercise detail already
 * carries a presigned URL (~1h expiry, lcms.presigned-expiry).
 */
export async function lcmsGetLessonPdfUrl(
  bookId: number | string,
  lessonId: number | string,
): Promise<BookPdfUrl> {
  const detail = await lcmsGetBookLesson(bookId, lessonId);
  const url = detail.lesson.pdf_url;
  if (!url) throw new LcmsNotFoundError();
  return { url, expires_in: 3600 };
}

// ---------------------------------------------------------------------------
// Authenticated fetch + shared helpers (student flow, auth)
// ---------------------------------------------------------------------------

export class LcmsApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    /** Chi tiết kỹ thuật (vd thân response thô) — để log, KHÔNG để hiện cho người dùng. */
    public readonly details?: string,
  ) {
    super(message);
    this.name = "LcmsApiError";
  }
}

const MAX_ERROR_TEXT_LENGTH = 200;

/**
 * Gộp một dòng rồi cắt cho vừa. CẮT chứ không loại bỏ — server hay trả danh
 * sách quy tắc mật khẩu nhiều dòng, bỏ đi là mất đúng thứ cần đọc.
 */
function asDisplayMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const singleLine = value.trim().replace(/\s+/g, " ");
  if (singleLine === "") return null;
  return singleLine.length > MAX_ERROR_TEXT_LENGTH
    ? `${singleLine.slice(0, MAX_ERROR_TEXT_LENGTH)}…`
    : singleLine;
}

/**
 * Body TEXT chỉ dùng được khi thực sự là câu thông báo: gateway trả nguyên
 * trang HTML, JSON hỏng mở đầu bằng `{`/`[` — đổ vào toast là vỡ UI + lộ nội bộ.
 */
function rawBodyMessage(body: string): string | null {
  const trimmedBody = body.trimStart();
  const looksLikeMarkupOrJson =
    trimmedBody.startsWith("<") ||
    trimmedBody.startsWith("{") ||
    trimmedBody.startsWith("[");
  return looksLikeMarkupOrJson ? null : asDisplayMessage(body);
}

// LCMS đôi khi trả MÃ i18n trong `errors[]`/`message` thay vì câu chữ;
// mã đã biết dịch ở đây, mã lạ bị ẨN để không lộ khóa kỹ thuật vào toast.
const LCMS_ERROR_CODE_MESSAGES: Record<string, string> = {
  "security.authen.password-has-sequential-or-repeating-chars":
    "Mật khẩu không được chứa dãy ký tự liên tiếp (123, abc) hoặc lặp lại (aaa).",
  "auth.cannot-change-other":
    "Người dùng không có quyền thay đổi mật khẩu của người khác",
  "password-too-long": "Mật khẩu vượt quá độ dài tối đa cho phép",
  "password-is-required": "Mật khẩu không được để trống",
  "password-and-confirm-password-not-match":
    "Mật khẩu mới và mật khẩu xác nhận không khớp nhau",
  "old-password-is-not-correct": "Mật khẩu cũ nhập vào không đúng",
  "password-too-short": "Mật khẩu chưa đủ độ dài tối thiểu",
  "password-missing-uppercase":
    "Mật khẩu phải chứa ít nhất một ký tự viết hoa (A-Z)",
  "password-missing-lowercase":
    "Mật khẩu phải chứa ít nhất một ký tự viết thường (a-z)",
  "password-missing-digit": "Mật khẩu phải chứa ít nhất một chữ số (0-9)",
  "password-missing-special":
    "Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*)",
};

const MAX_ERROR_CODE_LENGTH = 80;
const MACHINE_ERROR_CODE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;

/** Câu đã dịch; `null` = ẩn mã lạ; giữ nguyên nếu không phải mã máy. */
function translateLcmsErrorCode(value: string): string | null {
  const code = value.trim();
  if (
    code.length > MAX_ERROR_CODE_LENGTH ||
    !MACHINE_ERROR_CODE_PATTERN.test(code)
  )
    return value;
  return LCMS_ERROR_CODE_MESSAGES[code] ?? null;
}

function translatedDisplayMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const translated = translateLcmsErrorCode(value);
  return translated === null ? null : asDisplayMessage(translated);
}

/**
 * Rút thông báo lỗi người đọc được từ body lỗi LCMS. Mỗi service LCMS trả một
 * shape khác nhau: validation của /user/change-password KHÔNG có key `message`
 * nên trước đây học sinh chỉ thấy "LCMS API error 400" khi mật khẩu mới không
 * đạt quy tắc ATTT. Thử lần lượt các key thường gặp (kể cả body text thuần)
 * rồi mới chịu thua.
 */
/**
 * Cố ý KHÔNG có `error`: Spring trả `{"error":"Bad Request"}`, OAuth trả
 * `{"error":"invalid_grant"}` — vô nghĩa với học sinh mà còn che câu fallback
 * tiếng Việt. (`{error:{message}}` lồng thì vẫn đọc, ở dưới.)
 */
const LCMS_MESSAGE_KEYS = [
  "message",
  "errorMessage",
  "error_description",
  "detail",
  "title",
];

/** `errors` dạng mảng object/chuỗi, hoặc map field → [message] (Laravel). */
function collectFieldErrors(errors: unknown): string[] {
  const messageOf = (entry: unknown): string | null => {
    if (typeof entry === "string") return translatedDisplayMessage(entry);
    if (!entry || typeof entry !== "object") return null;
    const entryFields = entry as Record<string, unknown>;
    return (
      translatedDisplayMessage(entryFields.message) ??
      translatedDisplayMessage(entryFields.defaultMessage) // Spring @Valid
    );
  };
  const isMessage = (value: string | null): value is string => value !== null;
  if (Array.isArray(errors)) return errors.map(messageOf).filter(isMessage);
  if (errors && typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>)
      .flatMap((fieldMessages) =>
        Array.isArray(fieldMessages) ? fieldMessages : [fieldMessages],
      )
      .map(messageOf)
      .filter(isMessage);
  }
  return [];
}

function lcmsErrorMessage(body: unknown): string | null {
  if (typeof body === "string") return rawBodyMessage(body);
  if (!body || typeof body !== "object") return null;
  const bodyFields = body as Record<string, unknown>;
  for (const key of LCMS_MESSAGE_KEYS) {
    const directMessage = translatedDisplayMessage(bodyFields[key]);
    if (directMessage) return directMessage;
  }
  // {error: {message: "…"}} — chỉ `error` mới có shape lồng này.
  const nestedError = bodyFields.error;
  if (nestedError && typeof nestedError === "object" && !Array.isArray(nestedError)) {
    const nestedMessage = asDisplayMessage(
      (nestedError as Record<string, unknown>).message,
    );
    if (nestedMessage) return nestedMessage;
  }
  const fieldErrors = collectFieldErrors(bodyFields.errors);
  // Cắt lần nữa trên chuỗi ĐÃ GỘP: cắt từng phần tử không chặn được tổng.
  if (fieldErrors.length > 0) return asDisplayMessage(fieldErrors.join(" "));
  return null;
}

/**
 * Access-token expiry handling per "Authentication API Integration
 * Specification" §6/§8: when an authenticated request comes back 401,
 * refresh with {sessionId, refreshToken}, persist the new tokens, and replay
 * the original request ONCE. A failed refresh clears the whole session
 * (spec: "Xóa toàn bộ token → điều hướng về Login") — the app's auth
 * listeners then send the user back to the login flow.
 *
 * Single-flight: concurrent 401s share one refresh call so LCMS never sees
 * a burst of refresh requests for the same session.
 */
let lcmsRefreshInFlight: Promise<string> | null = null;

function refreshLcmsAccessToken(): Promise<string> {
  lcmsRefreshInFlight ??= (async () => {
    const { refreshToken } = getStoredSession();
    if (!refreshToken) {
      throw new LcmsApiError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    }
    const tokens = await lcmsRefresh(refreshToken); // also rotates the stored sessionId
    saveSession(tokens);
    return tokens.access_token;
  })().finally(() => {
    lcmsRefreshInFlight = null;
  });
  return lcmsRefreshInFlight;
}

/**
 * Authenticated variant of lcmsFetch: attaches the stored Bearer token,
 * transparently refreshes + retries once on 401, and surfaces the spec's
 * error messages verbatim (409 "Attempt already submitted.", 403 "This
 * submission does not belong to you.", …).
 * `allowNullData` accepts mutations whose data is null or a bare string
 * ("Submitted successfully") instead of treating them as errors.
 */
// Phiên chết: dọn localStorage + phát tín hiệu để AuthContext dọn state React
// ngay (nếu chỉ clearSession thì còn "đăng nhập" tới khi F5, line 49).
function endLcmsSession(): void {
  clearSession();
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function"
  ) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

async function lcmsAuthedFetch<T>(
  path: string,
  init?: RequestInit & { allowNullData?: boolean },
): Promise<{ data: T; total: number | null }> {
  const { allowNullData, headers, ...rest } = init ?? {};

  const doFetch = (token: string | null) =>
    fetch(`${getLcmsApiBaseUrl()}/api/lcms${path}`, {
      ...rest,
      headers: {
        Accept: "application/json",
        // FormData: để fetch tự đặt multipart boundary — ép json là hỏng upload.
        ...(rest.body && !(rest.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((headers as Record<string, string>) ?? {}),
      },
    });

  const token = getStoredSession().accessToken;
  let res = await doFetch(token);

  if (res.status === 401 && token) {
    let newToken: string;
    try {
      newToken = await refreshLcmsAccessToken();
    } catch {
      endLcmsSession(); // refresh failed → session is dead, per the auth spec
      throw new LcmsApiError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    }
    res = await doFetch(newToken); // replay the original request once
  }

  // Vẫn 401 sau khi đã thử refresh — HOẶC không có token để refresh (đã đăng xuất):
  // phiên hết hạn thật. Dọn phiên và trả message thân thiện thay vì "LCMS API error 401".
  if (res.status === 401) {
    endLcmsSession();
    throw new LcmsApiError(
      401,
      "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
    );
  }

  const envelope = (await res.json().catch(() => null)) as LcmsEnvelope<T> | null;
  if (!envelope) {
    throw new LcmsApiError(res.status, `LCMS API error ${res.status}`);
  }
  if (!envelope.success) {
    if (envelope.message === NOT_FOUND) throw new LcmsNotFoundError();
    throw new LcmsApiError(res.status, envelope.message ?? `LCMS API error ${res.status}`);
  }
  if (envelope.data == null && !allowNullData) {
    throw new LcmsNotFoundError();
  }
  return { data: envelope.data as T, total: envelope.total };
}

/**
 * LCMS datetimes are NAIVE (no timezone, e.g. "2026-07-09T16:30:00" or with
 * long fractional seconds). Interpret them as local time (server and users
 * share Asia/Ho_Chi_Minh); trim the fraction to milliseconds so every engine
 * parses it. Returns null when unparseable.
 */
function parseLcmsDatetime(s: string | null | undefined): Date | null {
  if (!s) return null;
  const normalized = s
    .trim()
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse một mốc thời gian LCMS như một INSTANT tuyệt đối: chuỗi KHÔNG có timezone
 * được coi là UTC (thêm 'Z'). Dùng cho phép SO SÁNH liên-hệ-quy-chiếu — ví dụ
 * `startedAt` (naive UTC) với `submittedAt` (có offset "+00:00"). Không dùng cho
 * hiển thị (parseLcmsDatetime giữ ngữ nghĩa local cũ).
 */
function parseLcmsInstant(s: string | null | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  const withTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(t) ? t : `${t}Z`;
  return parseLcmsDatetime(withTz);
}

/** Naive LCMS datetime → ISO string the display layer can `new Date()`. */
function toIso(s: string | null | undefined): string {
  return parseLcmsDatetime(s)?.toISOString() ?? (s ?? "");
}

/**
 * attemptId → exerciseId, populated by start/current-attempt. LCMS's submit
 * response carries no submissionId, so lcmsSubmitAttempt needs the exercise
 * to find the fresh submission in /submission/history (owner decision
 * 2026-07-14). Both entry points into an attempt pass through this module,
 * so the map is always warm within a page session.
 */
const attemptExerciseMap = new Map<string, string>();

/**
 * Các attempt đã NỘP trong phiên trang này. LCMS không có cờ "đã nộp" trên
 * `/current-attempt` (chỉ có attemptId/startedAt/answers) nên `lcmsGetCurrentAttempt`
 * phải đối chiếu `/submission/history` để biết lượt gần nhất đã chốt chưa — mà
 * lịch sử thì chưa chắc thấy ngay lần nộp vừa xong (`lcmsSubmitAttempt` cũng đã
 * phải phòng đúng chuyện này), có thể lỗi, hoặc lần nộp rơi ngoài trang. Mỗi
 * trường hợp đó đều khiến lượt VỪA NỘP bị báo là còn dở và hub mời "Tiếp tục
 * làm bài" cho một lượt đã chốt. Chính ta vừa nộp thì ta biết chắc — nhớ lại.
 */
const submittedAttemptIds = new Set<string>();

/**
 * Numeric id when it fits a safe integer, otherwise the original string —
 * LCMS ids (bookId, lessonId) can exceed Number.MAX_SAFE_INTEGER.
 */
function toIdNum(v: LcmsId): number | string {
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : String(v);
}

/**
 * `userAnswer` arrives as a JSON string of whatever AnswerValue the FE saved.
 * Parse defensively: non-JSON strings stay raw, arrays are re-stringified
 * element-wise.
 *
 * Object phải trả về ĐÃ PARSE: trả chuỗi thì `recordEvery` chấm sai và player
 * không hydrate được — hỏng mọi loại câu ghi theo ô (drag_drop, fill_blank…).
 */
function parseUserAnswer(raw: string | null | undefined): AnswerValue {
  if (raw == null || raw === "") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null) return null;
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) return parsed.map(String);
    if (typeof parsed === "object") return parsed as Record<string, unknown>;
    return raw; // số/boolean trần: giữ chuỗi gốc như trước
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Student learning flow — same signatures/return types as assessmentApi
// ---------------------------------------------------------------------------

interface LcmsExerciseListItem {
  id: LcmsId;
  name: string;
  totalQuestion: number | string | null;
  status: "not_started" | "in_progress" | "submitted";
}

/**
 * GET /api/lcms/book-lesson/{lessonId}/excercise
 * LCMS carries no exercise `type`; default to "quiz" (only drives a badge in
 * the exercise picker).
 */
export async function lcmsListLessonExercises(
  lessonId: number | string,
): Promise<ExerciseListItem[]> {
  let items: LcmsExerciseListItem[];
  try {
    items = (
      await lcmsAuthedFetch<LcmsExerciseListItem[]>(`/book-lesson/${String(lessonId)}/excercise`)
    ).data;
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
  return items.map((it) => ({
    id: String(it.id),
    title: it.name ?? "",
    type: "quiz",
    totalQuestions: toNum(it.totalQuestion) ?? 0,
    status: it.status ?? "not_started",
  }));
}

interface LcmsPortalQuestion {
  id: LcmsId;
  content: string;
  options: unknown; // parsed array — but tolerate a JSON string
  schema_payload: unknown; // parsed object — but tolerate a JSON string
  payload?: unknown; // live rename of schema_payload (public detail already uses it)
  points: number | string | null;
  order: number | string | null;
}

interface LcmsPortalExercise {
  id: LcmsId;
  name: string;
  instructions: string | null;
  duration: number | string | null; // SECONDS (legacy uses minutes)
  questions: LcmsPortalQuestion[];
}

/** schema_payload as object regardless of wire encoding. */
function normalizeSchema(v: unknown): Record<string, unknown> {
  if (typeof v === "string") return safeParse<Record<string, unknown>>(v, {});
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

/** options as legacy [{id,content}] — accepts array of {key|label,text} or a JSON string. */
function normalizeOptions(v: unknown): QuestionOption[] {
  const arr = typeof v === "string"
    ? safeParse<Array<Record<string, unknown>>>(v, [])
    : Array.isArray(v)
      ? (v as Array<Record<string, unknown>>)
      : [];
  return arr.map((o) => ({
    id: String(o.key ?? o.label ?? ""),
    content: String(o.text ?? o.content ?? ""),
  }));
}

/**
 * GET /api/lcms/book-excercise/student-portal/{exerciseId}
 * `duration` is in seconds; question type/correctAnswer live inside
 * schema_payload (the v1 question schema the players consume).
 */
export async function lcmsGetExercise(exerciseId: string): Promise<ExerciseDetail> {
  const { data } = await lcmsAuthedFetch<LcmsPortalExercise>(
    `/book-excercise/student-portal/${exerciseId}`,
  );
  const durationSec = toNum(data.duration);
  const questions: StudentQuestion[] = (data.questions ?? [])
    .map((q) => {
      const schema = normalizeSchema(q.payload ?? q.schema_payload);
      return {
        id: String(q.id),
        type: (typeof schema.type === "string" ? schema.type : "") as StudentQuestion["type"],
        content: q.content ?? "",
        options: normalizeOptions(q.options),
        payload: schema,
        correctAnswer: schema.correctAnswer as AnswerValue | undefined,
        points: toNum(q.points) ?? 1,
        order: toNum(q.order) ?? 0,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...q }) => q);
  return {
    id: String(data.id),
    title: data.name ?? "",
    instructions: data.instructions ?? null,
    durationMinutes: durationSec == null ? null : Math.max(1, Math.round(durationSec / 60)),
    questions,
  };
}

interface LcmsAttemptAnswer {
  questionId: LcmsId;
  userAnswer: string | null;
  isCorrect: boolean | null;
  score: number | string | null;
}

interface LcmsCurrentAttempt {
  attemptId: LcmsId;
  startedAt: string;
  answers: LcmsAttemptAnswer[] | null;
}

/**
 * GET /api/lcms/attempt/excercise/{exerciseId}/current-attempt
 * LCMS returns the LATEST attempt even when it was already submitted (the
 * legacy API only returns in-progress ones), so cross-check the submission
 * history: an attempt older than the newest submission for this exercise is
 * finished — report "no pending attempt" to keep the resume prompt honest.
 */
export async function lcmsGetCurrentAttempt(
  exerciseId: string,
  lessonId?: number | string,
): Promise<CurrentAttempt | null> {
  const latestAttempt = await fetchLatestAttempt(exerciseId);
  if (!latestAttempt) return null;

  // Ta vừa nộp chính lượt này ⇒ chắc chắn không còn gì để tiếp tục, khỏi phải
  // hỏi lịch sử (nguồn có độ trễ) rồi đoán.
  if (submittedAttemptIds.has(String(latestAttempt.attemptId))) return null;

  // Nguồn CHẮC CHẮN: `endedAt` của chính lượt đó trong /submission/exercise-list
  // — cùng thứ màn "Bài tập của tôi" đọc, và là thứ duy nhất LCMS nói thẳng
  // "lượt này đóng chưa". Chỉ khi không tra được mới lùi về đối chiếu mốc thời
  // gian bên dưới.
  const state = await resolveAttemptState(
    exerciseId,
    String(latestAttempt.attemptId),
    lessonId,
  );
  if (state !== "unknown") {
    attemptDebugLog({
      exerciseId,
      attemptId: String(latestAttempt.attemptId),
      startedAt_RAW: latestAttempt.startedAt,
      decidedBy: "exercise-list.endedAt",
      state,
      resume: state === "open",
    });
    return state === "closed" ? null : toCurrentAttempt(latestAttempt);
  }

  // ĐƯỜNG LÙI, KHÔNG ĐÁNG TIN — chỉ dùng khi exercise-list không tra được.
  //
  // `startedAt` của /current-attempt là NAIVE, và nó nằm theo múi giờ của SERVER,
  // khác nhau giữa các môi trường: prod (qr.nxbgd.vn) trả naive-UTC, còn TEST trả
  // naive giờ Việt Nam (+07). Đo 04/09/2026: attempt 439 `startedAt`
  // "2026-09-04T21:23:53.168211" trong khi lần nộp của chính nó là
  // "2026-09-04T14:24:00.722+00:00" — lệch đúng -7h. Hiểu naive là UTC thì
  // `submittedAt >= startedAt` thành SAI, guard không chạy, lượt ĐÃ NỘP bị báo là
  // còn dở và hub mời "Tiếp tục làm bài" mãi mãi (F5 vẫn thế).
  //
  // Không thể sửa phép so này cho đúng cả hai môi trường: một chuỗi naive không
  // mang thông tin múi giờ. Nới biên độ thì lại đóng nhầm lượt đang làm dở. Nên
  // để nguyên hành vi cũ (prod đang đúng) và coi đây là đường lùi hiếm khi chạm.
  const startedAtMs = parseLcmsInstant(latestAttempt.startedAt)?.getTime();
  let submittedAtMs = NaN;
  if (startedAtMs != null) {
    const latestSubmission = await latestSubmissionFor(exerciseId).catch(() => null);
    submittedAtMs = latestSubmission
      ? (parseLcmsInstant(latestSubmission.submittedAt)?.getTime() ?? NaN)
      : NaN;
    if (!Number.isNaN(submittedAtMs) && submittedAtMs >= startedAtMs) {
      attemptDebugLog({
        exerciseId,
        attemptId: String(latestAttempt.attemptId),
        startedAt_RAW: latestAttempt.startedAt,
        decidedBy: "history.submittedAt (duong lui)",
        state: "closed",
        resume: false,
      });
      return null;
    }
  }

  attemptDebugLog({
    exerciseId,
    attemptId: String(latestAttempt.attemptId),
    startedAt_RAW: latestAttempt.startedAt,
    startedAt_parsedUTC: startedAtMs != null ? new Date(startedAtMs).toISOString() : null,
    newestSubmittedAt_parsedUTC: Number.isNaN(submittedAtMs)
      ? null
      : new Date(submittedAtMs).toISOString(),
    skewHours:
      startedAtMs != null && !Number.isNaN(submittedAtMs)
        ? Number(((submittedAtMs - startedAtMs) / 3_600_000).toFixed(2))
        : null,
    decidedBy: "duong lui — KHONG tra duoc trong exercise-list",
    state: "open",
    resume: true,
    warn: "skew am ~-7h nghia la server tra naive theo gio dia phuong",
  });
  return toCurrentAttempt(latestAttempt);
}

/**
 * Log chẩn đoán cho quyết định "còn lượt dở hay không" — TẮT mặc định, bật bằng
 * `localStorage.setItem("evo_debug_attempt", "1")` rồi tải lại trang.
 *
 * Có nó vì lỗi này chỉ hiện trên môi trường TEST và phụ thuộc múi giờ mà server
 * trả về, nên đọc code không suy ra được: phải nhìn chuỗi thời gian THÔ ở đúng
 * môi trường đang lỗi.
 */
function attemptDebugLog(payload: Record<string, unknown>): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem("evo_debug_attempt") !== "1") return;
    // eslint-disable-next-line no-console
    console.log("[evo][current-attempt]", JSON.stringify(payload));
  } catch {
    // Log hỏng thì thôi, tuyệt đối không được làm chết đường vào bài.
  }
}

/**
 * Lượt `attemptId` đang ở trạng thái nào, theo `endedAt`/`submittedAt` của
 * /submission/exercise-list — hai mốc DUY NHẤT của LCMS có offset "+00:00" rõ
 * ràng, nên không dính bẫy naive như `startedAt` của /current-attempt.
 *
 * `"unknown"` = không tra được ⇒ người gọi phải tự đoán cách khác. Trả ba trạng
 * thái chứ không phải boolean-có-thể-null: "không biết" mà lỡ đọc thành "còn dở"
 * thì lại đúng con bug này.
 *
 * CHỈ hỏi khi có `lessonId`. Đo trên LCMS 04/09/2026:
 *   lọc theo bài học : 0,7 KB · 28 ms · 1 group   ⇒ luôn gọn trong MỘT trang
 *   không lọc        : 4,1 KB · 49 ms · 9 group   ⇒ lớn dần theo cả đời học sinh
 * Bản không lọc vừa nặng vừa không chặn được, mà nó chỉ phục vụ màn bài GV giao —
 * màn đó không có hub nên cũng không có nhãn "Tiếp tục làm bài" để sai. Thiếu
 * `lessonId` thì trả "unknown" và đi đường lùi, đúng như hành vi trước đây.
 *
 * KHÔNG phân trang. `total` của envelope là SỐ DÒNG CỦA CHÍNH TRANG ĐÓ, không
 * phải tổng toàn bộ: đo được page 1 (không lọc) trả `groups: 9, total: "9"`, còn
 * page 2 trả `groups: 0, total: "0"` — nếu là tổng thì page 2 vẫn phải là "9".
 * Vòng lặp phân trang dựa vào `total` vì thế sẽ dừng ngay sau trang đầu ĐẦY, tức
 * đúng lúc cần phân trang nhất. (`exerciseListApi.ts#fetchAllExerciseGroups`
 * đang đọc `total` theo nghĩa tổng — nên rà lại riêng, ngoài phạm vi chỗ này.)
 *
 * Đây là cùng nguồn mà `attempts.ts#isOpenAttempt` (màn "Bài tập của tôi") dùng.
 * Hai màn đọc hai nguồn khác nhau chính là lý do chúng nói ngược nhau về cùng
 * một lượt: bên kia bảo đã xong, hub bài học vẫn mời "Tiếp tục làm bài".
 */
async function resolveAttemptState(
  exerciseId: string,
  attemptId: string,
  lessonId?: number | string,
): Promise<"closed" | "open" | "unknown"> {
  if (lessonId == null) return "unknown";
  const listed = await lcmsListExerciseSubmissions({
    lessonId,
    page: 1,
    limit: 100,
  }).catch(() => null);
  if (!listed) return "unknown";
  // Duyệt MỌI group khớp bài, không chỉ group đầu: LCMS có thể tách các lượt của
  // cùng một bài ra nhiều bản ghi (xem `attempts.ts#mergeByExercise`).
  let attempt: ExerciseAttemptSummary | undefined;
  for (const group of listed.groups) {
    if (group.exerciseId !== exerciseId) continue;
    attempt = group.attempts.find((a) => a.attemptId === attemptId);
    if (attempt) break;
  }
  if (!attempt) return "unknown";
  return attempt.endedAt !== null || attempt.submittedAt !== null
    ? "closed"
    : "open";
}

/** LƯỢT gần nhất theo API, chưa lọc "đã nộp" — giữ nguyên chuỗi thời gian thô. */
async function fetchLatestAttempt(
  exerciseId: string,
): Promise<LcmsCurrentAttempt | null> {
  let latestAttempt: LcmsCurrentAttempt;
  try {
    latestAttempt = (
      await lcmsAuthedFetch<LcmsCurrentAttempt>(
        `/attempt/excercise/${exerciseId}/current-attempt`,
      )
    ).data;
  } catch (error) {
    // "No attempt yet" arrives either as the not-found ENVELOPE (HTTP 200)
    // or as a plain HTTP 404 — both simply mean nothing to resume.
    if (isNotFound(error)) return null;
    if (error instanceof LcmsApiError && error.statusCode === 404) return null;
    throw error;
  }
  attemptExerciseMap.set(String(latestAttempt.attemptId), exerciseId);
  return latestAttempt;
}

function toCurrentAttempt(attempt: LcmsCurrentAttempt): CurrentAttempt {
  // LCMS ghi answer theo từng REQUEST (append) nên một câu có thể có NHIỀU bản
  // ghi. Gộp về một đáp án mỗi câu, bản ghi MỚI NHẤT thắng — kể cả khi nó rỗng:
  // rỗng nghĩa là học sinh đã bỏ chọn, review hiển thị "chưa chọn" và chấm sai.
  const answerByQuestion = new Map<string, AnswerValue>();
  for (const savedAnswer of attempt.answers ?? []) {
    answerByQuestion.set(
      String(savedAnswer.questionId),
      parseUserAnswer(savedAnswer.userAnswer),
    );
  }
  return {
    attemptId: String(attempt.attemptId),
    startedAt: toIso(attempt.startedAt),
    answers: Array.from(answerByQuestion, ([questionId, answer]) => ({
      questionId,
      answer,
    })),
  };
}

/**
 * Đáp án của một lần NỘP — LCMS không có endpoint review theo câu, nhưng
 * current-attempt vẫn trả lượt gần nhất kể cả khi đã nộp.
 *
 * Không chắc đó đúng là lần nộp đang xem thì trả null (màn kết quả giữ nguyên).
 * KHÔNG so `attemptId` với `submissionId` — hai bảng khác nhau của LCMS, trùng
 * số là chuyện có thật và lối tắt đó còn đi vòng qua guard thời gian bên dưới.
 */
export async function lcmsGetSubmittedAttempt(
  exerciseId: string,
  submissionId: string,
): Promise<CurrentAttempt | null> {
  const latestAttempt = await fetchLatestAttempt(exerciseId);
  if (!latestAttempt) return null;

  const latestSubmission = await latestSubmissionFor(exerciseId).catch(() => null);
  if (
    !latestSubmission ||
    String(latestSubmission.submissionId) !== String(submissionId)
  ) {
    return null;
  }
  const startedAtMs = parseLcmsInstant(latestAttempt.startedAt)?.getTime();
  const submittedAtMs = parseLcmsInstant(latestSubmission.submittedAt)?.getTime();
  if (startedAtMs != null && submittedAtMs != null && startedAtMs > submittedAtMs) {
    return null;
  }
  return toCurrentAttempt(latestAttempt);
}

/** POST /api/lcms/attempt/excercise/{exerciseId}/start */
export async function lcmsStartAttempt(exerciseId: string): Promise<AttemptStart> {
  const { data } = await lcmsAuthedFetch<{ attemptId: LcmsId; startedAt: string }>(
    `/attempt/excercise/${exerciseId}/start`,
    { method: "POST", body: "{}" },
  );
  attemptExerciseMap.set(String(data.attemptId), exerciseId);
  return { attemptId: String(data.attemptId), startedAt: toIso(data.startedAt) };
}

/**
 * PUT /api/lcms/attempt/{attemptId}/answer — same body shape the FE already
 * sends. NOTE: LCMS ignores answers for questions that already have a record
 * in this attempt (no update). Autosave is therefore best-effort only; the
 * full answers+results payload sent at submit is the source of truth for
 * scoring (owner decision 2026-07-14).
 */
export async function lcmsSaveAnswers(
  attemptId: string,
  answers: Array<{ questionId: string; answer: AnswerValue }>,
  results?: Array<{ questionId: string; isCorrect: boolean; points: number; gradable: boolean }>,
): Promise<void> {
  await lcmsAuthedFetch<unknown>(`/attempt/${attemptId}/answer`, {
    method: "PUT",
    body: JSON.stringify({ answers, ...(results && results.length > 0 ? { results } : {}) }),
    allowNullData: true,
  });
}

/**
 * POST /api/lcms/attempt/upload-file (multipart, field `file`). Endpoint KHÔNG
 * nhận attemptId — file gắn vào bài qua answer.files của câu upload_answer khi
 * PUT answer / POST submit. fileId về dạng số lớn, ép String để khỏi mất độ
 * chính xác khi đi qua JSON.
 */
export async function lcmsUploadAttemptFile(
  file: File,
): Promise<{ fileId: string; fileUrl: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await lcmsAuthedFetch<{ fileUrl: string; fileId: LcmsId }>(
    `/attempt/upload-file`,
    { method: "POST", body: form },
  );
  return { fileId: String(data.fileId), fileUrl: data.fileUrl };
}

/**
 * Newest RAW history entry for an exercise, or null. Giữ nguyên chuỗi
 * `submittedAt` thô: qua `lcmsListHistory` nó đã bị `toIso` coi naive là giờ
 * LOCAL, nên khi server trả naive-UTC mốc nộp bị đẩy sớm 7 tiếng và các guard
 * thời gian ở trên loại nhầm lượt hợp lệ. So sánh phải dùng `parseLcmsInstant`
 * trên chuỗi gốc để hai vế cùng hệ quy chiếu, bất kể server trả naive hay có
 * offset "+00:00".
 */
async function latestSubmissionFor(
  exerciseId: string,
): Promise<LcmsHistoryItem | null> {
  let items: LcmsHistoryItem[];
  try {
    const { data } = await lcmsAuthedFetch<{ items: LcmsHistoryItem[] }>(
      `/submission/history?limit=20`,
    );
    items = data.items ?? [];
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
  const mine = items.filter((i) => String(i.exerciseId) === exerciseId);
  if (mine.length === 0) return null;
  return mine.reduce((best, cur) =>
    (parseLcmsInstant(cur.submittedAt)?.getTime() ?? -Infinity) >
    (parseLcmsInstant(best.submittedAt)?.getTime() ?? -Infinity)
      ? cur
      : best,
  );
}

/**
 * POST /api/lcms/attempt/{attemptId}/submit
 * LCMS answers with a bare "Submitted successfully" — no submissionId. Fall
 * back to /submission/history to synthesize the legacy SubmitResult; when the
 * fresh submission is not visible yet, return an empty submissionId and let
 * the runner render from gradingStatus alone.
 */
export async function lcmsSubmitAttempt(
  attemptId: string,
  payload?: {
    answers?: Array<{ questionId: string; answer: AnswerValue }>;
    files?: Array<{ questionId: string; fileId: string }>;
    results?: Array<{ questionId: string; isCorrect: boolean; points: number; gradable: boolean }>;
    submittedAt?: string;
  },
): Promise<SubmitResult> {
  await lcmsAuthedFetch<unknown>(`/attempt/${attemptId}/submit`, {
    method: "POST",
    body: JSON.stringify({
      answers: payload?.answers ?? [],
      results: payload?.results ?? [],
    }),
    allowNullData: true,
  });
  submittedAttemptIds.add(String(attemptId));

  const exerciseId = attemptExerciseMap.get(String(attemptId));
  const latest = exerciseId
    ? await latestSubmissionFor(exerciseId).catch(() => null)
    : null;
  return {
    submissionId: latest ? String(latest.submissionId) : "",
    status: "submitted",
    gradingStatus: latest?.gradingStatus ?? "pending",
  };
}

interface LcmsHistoryItem {
  submissionId: LcmsId;
  bookId: LcmsId | null;
  bookTitle: string | null;
  lessonId: LcmsId | null;
  exerciseId: LcmsId | null;
  exerciseTitle: string | null;
  score: number | string | null;
  maxScore: number | string | null;
  gradingStatus: "graded" | "pending" | null;
  submittedAt: string;
}

/** GET /api/lcms/submission/history?bookId&page&limit */
export async function lcmsListHistory(params?: {
  bookId?: number | string;
  page?: number;
  limit?: number;
}): Promise<HistoryResult> {
  const qs = new URLSearchParams();
  if (params?.bookId != null) qs.set("bookId", String(params.bookId));
  if (params?.page != null) qs.set("page", String(params.page));
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";

  let data: {
    items: LcmsHistoryItem[];
    pagination: { page: number; limit: number; total: number };
  };
  try {
    data = (await lcmsAuthedFetch<typeof data>(`/submission/history${query}`)).data;
  } catch (error) {
    if (isNotFound(error)) {
      return {
        items: [],
        pagination: { page: params?.page ?? 1, limit: params?.limit ?? 20, total: 0 },
      };
    }
    throw error;
  }
  return {
    items: (data.items ?? []).map(
      (i): HistoryItem => ({
        submissionId: String(i.submissionId),
        bookId: i.bookId == null ? null : toIdNum(i.bookId),
        bookTitle: i.bookTitle ?? null,
        lessonId: i.lessonId == null ? null : toIdNum(i.lessonId),
        exerciseId: i.exerciseId == null ? null : String(i.exerciseId),
        exerciseTitle: i.exerciseTitle ?? "",
        score: toNum(i.score),
        maxScore: toNum(i.maxScore),
        gradingStatus: i.gradingStatus ?? null,
        submittedAt: toIso(i.submittedAt),
      }),
    ),
    pagination: data.pagination ?? { page: params?.page ?? 1, limit: params?.limit ?? 20, total: 0 },
  };
}

// ---------------------------------------------------------------------------
// Exercise attempts (Student SBT — khu /hoc-sinh)
// GET /api/lcms/submission/exercise-list?lessionId=&page=&limit=
// Trả các bài tập kèm mảng attempt của học sinh. Bỏ `lessionId` ⇒ trả TẤT CẢ bài
// tập của học sinh (kèm bookId/bookName/subject để dựng màn "Bài tập của tôi");
// truyền `lessonId` ⇒ lọc theo 1 bài học. LƯU Ý API viết tham số là "lessionId"
// (sai chính tả phía server).
// Trạng thái attempt: status CANCEL(0) · SUBMITTED(4) · IN_PROGRESS(6). Bài đã nộp
// có `submittedAt`; `endedAt === null` ⇒ đang làm dở.
// ---------------------------------------------------------------------------
interface LcmsExerciseAttempt {
  attemptId: LcmsId;
  userId: LcmsId;
  status: number | string | null;
  startedAt: string;
  endedAt: string | null;
  maxScore: number | string | null;
  gradingStatus: number | string | null;
  score?: number | string | null;
  submittedAt?: string | null;
}

interface LcmsExerciseSubmissionGroup {
  exerciseId: LcmsId;
  bookId?: LcmsId | null;
  name?: string | null;
  bookName?: string | null;
  subjectCode?: string | null;
  subjectName?: string | null;
  attempts: LcmsExerciseAttempt[] | null;
}

export interface ExerciseAttemptSummary {
  attemptId: string;
  status: number | null;
  startedAt: string; // ISO
  endedAt: string | null; // null ⇒ đang làm dở
  maxScore: number | null;
  gradingStatus: number | null;
  score: number | null;
  submittedAt: string | null; // có giá trị ⇒ đã nộp (SUBMITTED)
}

export interface ExerciseSubmissionGroup {
  exerciseId: string;
  bookId: string | null;
  name: string | null;
  bookName: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  attempts: ExerciseAttemptSummary[];
}

export async function lcmsListExerciseSubmissions(params?: {
  lessonId?: number | string;
  page?: number;
  limit?: number;
}): Promise<{ groups: ExerciseSubmissionGroup[]; total: number | null }> {
  const qs = new URLSearchParams();
  if (params?.lessonId != null) qs.set("lessionId", String(params.lessonId)); // server spelling
  qs.set("page", String(params?.page ?? 1));
  qs.set("limit", String(params?.limit ?? 50));

  let res: { data: LcmsExerciseSubmissionGroup[]; total: number | null };
  try {
    res = await lcmsAuthedFetch<LcmsExerciseSubmissionGroup[]>(
      `/submission/exercise-list?${qs.toString()}`,
    );
  } catch (error) {
    if (isNotFound(error)) return { groups: [], total: 0 };
    throw error;
  }

  const groups = (res.data ?? []).map((g) => ({
    exerciseId: String(g.exerciseId),
    bookId: g.bookId == null ? null : String(g.bookId),
    name: g.name ?? null,
    bookName: g.bookName ?? null,
    subjectCode: g.subjectCode ?? null,
    subjectName: g.subjectName ?? null,
    attempts: (g.attempts ?? []).map(
      (a): ExerciseAttemptSummary => ({
        attemptId: String(a.attemptId),
        status: toNum(a.status),
        startedAt: toIso(a.startedAt),
        endedAt: a.endedAt ? toIso(a.endedAt) : null,
        maxScore: toNum(a.maxScore),
        gradingStatus: toNum(a.gradingStatus),
        score: toNum(a.score),
        submittedAt: a.submittedAt ? toIso(a.submittedAt) : null,
      }),
    ),
  }));
  return { groups, total: res.total };
}

interface LcmsSubmissionScores {
  submissionId: LcmsId;
  score: number | string | null;
  maxScore: number | string | null;
  gradingStatus: "graded" | "pending";
  teacherComment: string | null;
  submittedAt: string;
  gradedAt: string | null;
}

/** GET /api/lcms/submission/scores/{submissionId} */
export async function lcmsGetSubmission(submissionId: string): Promise<SubmissionDetail> {
  const { data } = await lcmsAuthedFetch<LcmsSubmissionScores>(
    `/submission/scores/${submissionId}`,
  );
  return {
    submissionId: String(data.submissionId),
    score: toNum(data.score),
    maxScore: toNum(data.maxScore) ?? 0,
    gradingStatus: data.gradingStatus,
    teacherComment: data.teacherComment ?? null,
    submittedAt: toIso(data.submittedAt),
    gradedAt: data.gradedAt == null ? null : toIso(data.gradedAt),
  };
}

// ---------------------------------------------------------------------------
// User profile — LCMS PLATFORM APIs (chủ yếu /api/security, /api/system): mỗi
// endpoint tự khai báo path đầy đủ (lcmsPlatformFetch KHÔNG tự thêm /api/lcms).
// Riêng update-new-user đã chuyển sang /api/lcms/user. Dùng cho màn "Cập nhật hồ
// sơ" (tỉnh + đổi mật khẩu).
// ---------------------------------------------------------------------------

// tenantId gửi kèm khi cập nhật hồ sơ — HARDCODE theo yêu cầu (LCMS). Đổi tại
// đây nếu tenant khác.
const LCMS_PROFILE_TENANT_ID = 10590164625486848;
// positionTypeId mặc định (màn hồ sơ không cho sửa) — theo curl mẫu.
const LCMS_PROFILE_POSITION_TYPE_ID = 1;

/**
 * Authed request tới API nền tảng LCMS (/api/security, /api/system) — khác
 * lcmsAuthedFetch ở chỗ KHÔNG thêm tiền tố /api/lcms. Gắn Bearer token, refresh
 * + retry 1 lần khi 401, và trả nguyên Response để chỗ gọi tự đọc thân (JSON
 * hay nhị phân). `path` phải bắt đầu bằng "/api/…".
 */
async function lcmsPlatformRequest(path: string, init?: RequestInit): Promise<Response> {
  // /api/security/* (auth, user/current…) nằm trên host security; /api/system/*
  // và các path khác trên host catalog. Ở prod 2 host khác nhau nên định tuyến
  // theo prefix — gọi sai host gây 403.
  const baseUrl = path.startsWith("/api/security")
    ? getLcmsAuthBaseUrl()
    : getLcmsApiBaseUrl();
  const doFetch = (token: string | null) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        // Chỉ thân JSON mới tự gắn Content-Type: multipart (FormData) phải để
        // trình duyệt tự sinh header kèm boundary.
        ...(typeof init?.body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    });

  const token = getStoredSession().accessToken;
  let res = await doFetch(token);
  if (res.status === 401 && token) {
    try {
      res = await doFetch(await refreshLcmsAccessToken());
    } catch {
      endLcmsSession();
      throw new LcmsApiError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    }
  }
  if (res.status === 401) {
    endLcmsSession();
    throw new LcmsApiError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }
  return res;
}

/** 5xx là lỗi hệ thống: body hay là stack trace / lỗi SQL, chỉ trả mã lỗi. */
function throwLcmsPlatformError(status: number, body: unknown): never {
  const errorMessage = status < 500 ? lcmsErrorMessage(body) : null;
  throw new LcmsApiError(status, errorMessage ?? `LCMS API error ${status}`);
}

/**
 * Như lcmsPlatformRequest nhưng đọc thân JSON: trả `data` trong envelope (hoặc
 * nguyên body nếu không có envelope), undefined khi 2xx thân rỗng.
 */
async function lcmsPlatformFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await lcmsPlatformRequest(path, init);

  // Text rồi mới parse: body lỗi đôi khi là text thuần, res.json() làm mất nó.
  const responseText = await res.text().catch(() => "");
  let body: (Partial<LcmsEnvelope<T>> & Record<string, unknown>) | null = null;
  if (responseText) {
    try {
      body = JSON.parse(responseText);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    throwLcmsPlatformError(res.status, body ?? responseText);
  }
  // 2xx nhưng thân RỖNG hoặc KHÔNG phải JSON (vd /update-new-user trả rỗng hoặc
  // "OK" trơn) = thành công cho mutation trả void. Không được ném "LCMS API error
  // 200" — đây là bug từng khiến "lưu thành công nhưng vẫn báo lỗi".
  if (body == null) {
    return undefined as T;
  }
  // success:false là THẤT BẠI kể cả khi HTTP 200 và envelope không kèm `data` —
  // vd update-new-user từ chối ghi. Kiểm tra trước cửa "data" in body, nếu không
  // thân lỗi lọt xuống nhánh dưới và được trả về như dữ liệu hợp lệ: chỗ gọi
  // toast "đã lưu" trong khi máy chủ không ghi gì.
  if (typeof body === "object" && body.success === false) {
    throw new LcmsApiError(
      res.status,
      lcmsErrorMessage(body) ?? `LCMS API error ${res.status}`,
    );
  }
  // Envelope {success,data} nếu có; nếu không, trả nguyên body.
  if (typeof body === "object" && "data" in body) {
    return body.data as T;
  }
  return body as unknown as T;
}

export interface LcmsProvince {
  code: string;
  name: string;
}

/**
 * POST /api/system/geo-location/search — danh sách TỈNH (type="P"). Lấy tối đa
 * 100 (đủ 63 tỉnh) để khỏi phân trang. Chấp nhận nhiều shape response.
 */
export async function lcmsListProvinces(): Promise<LcmsProvince[]> {
  const data = await lcmsPlatformFetch<unknown>("/api/system/geo-location/search", {
    method: "POST",
    body: JSON.stringify({
      orderAsc: true,
      lazy: true,
      params: [
        { property: "type", value: "P", operator: "eq" },
        { property: "textual", value: null, operator: "eq" },
        { property: "_showAll", value: "yes", operator: "eq" },
      ],
      start: 0,
      associate: true,
      limit: 100,
    }),
  });
  const asArray = (d: unknown): unknown[] =>
    Array.isArray(d)
      ? d
      : Array.isArray((d as { items?: unknown[] })?.items)
        ? (d as { items: unknown[] }).items
        : Array.isArray((d as { content?: unknown[] })?.content)
          ? (d as { content: unknown[] }).content
          : [];
  return asArray(data)
    .map((raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      return {
        code: String(o.code ?? o.geoCode ?? o.id ?? ""),
        name: String(o.name ?? o.textual ?? o.title ?? o.label ?? o.code ?? ""),
      };
    })
    .filter((p) => p.code !== "");
}

export interface LcmsProfile {
  id: string;
  username?: string;
  fullName?: string;
  geoCode?: string;
  /** ISO từ LCMS, vd "2026-07-15T00:00:00Z" (có thể chỉ phần ngày). */
  birthDate?: string;
  /** Id ảnh đại diện: gửi lại cho update-new-user khi lưu, và tải ảnh qua get-avatar. */
  avatarId?: string;
}

/**
 * Lấy id ảnh đại diện ra khỏi `extraData` — một CHUỖI JSON lồng, vd
 * `"{\"avatar\":345413326815101010}"`, nên phải parse ra object mới đọc được.
 *
 * Một chỗ KHÔNG được làm thẳng tay: id là snowflake 18 chữ số, lớn hơn
 * `Number.MAX_SAFE_INTEGER` (9007199254740991), nên `JSON.parse` biến
 * `345413326815101010` thành `345413326815101000` — sai 10 đơn vị, và
 * `get-avatar?id=…101000` trả 404. Vì vậy bọc riêng giá trị của khoá `avatar`
 * thành chuỗi TRƯỚC khi parse; các khoá khác để nguyên, không đụng tới nội dung
 * chuỗi của chúng.
 *
 * Giá trị đọc ra được dùng NGUYÊN VẸN, không kiểm định dạng: id là của backend.
 */
function readAvatarIdFromExtraData(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const longAvatarIdAsString = raw.replace(
    /("avatar"\s*:\s*)(\d{16,})(?=\s*[,}\]])/g,
    '$1"$2"',
  );
  let extraData: unknown;
  try {
    extraData = JSON.parse(longAvatarIdAsString);
  } catch {
    // extraData hỏng thì coi như không có ảnh — field phụ, không đáng làm hỏng
    // cả màn hồ sơ.
    return undefined;
  }
  if (!extraData || typeof extraData !== "object") return undefined;
  const avatar = (extraData as Record<string, unknown>).avatar;
  if (typeof avatar === "string") return avatar || undefined;
  if (typeof avatar === "number") {
    // Số dài đã thành chuỗi ở bước trên nên tới đây chỉ còn số ngắn. Chốt chặn
    // cuối: number vượt ngưỡng an toàn thì giá trị của nó ĐÃ sai, thà không có
    // ảnh còn hơn đi tải một id bịa.
    return Number.isSafeInteger(avatar) ? String(avatar) : undefined;
  }
  return undefined;
}

/**
 * GET /api/security/user/current — hồ sơ user đang đăng nhập. Endpoint nằm trên
 * host security (cùng /api/security/auth/*); lcmsPlatformFetch tự định tuyến theo
 * prefix /api/security. Gọi sai host gây 403 ở prod (nơi 2 host khác nhau).
 */
export async function lcmsGetCurrentUser(): Promise<LcmsProfile> {
  const o =
    (await lcmsPlatformFetch<Record<string, unknown>>("/api/security/user/current")) ?? {};
  // Tỉnh/TP (geoCode) nằm trong object `employee` lồng bên trong, không ở top-level.
  const employee =
    o.employee && typeof o.employee === "object"
      ? (o.employee as Record<string, unknown>)
      : {};
  return {
    id: String(o.id ?? o.userId ?? o.user_id ?? ""),
    // Thân thật trả `screenName`/`displayName`, KHÔNG có `username`/`fullName` —
    // đọc thiếu là ô "Tên đăng nhập" trong hồ sơ trống trơn.
    username:
      o.username != null
        ? String(o.username)
        : o.screenName != null
          ? String(o.screenName)
          : undefined,
    fullName:
      o.fullName != null
        ? String(o.fullName)
        : o.displayName != null
          ? String(o.displayName)
          : o.name != null
            ? String(o.name)
            : employee.name != null
              ? String(employee.name)
              : undefined,
    geoCode:
      o.geoCode != null
        ? String(o.geoCode)
        : o.geo_code != null
          ? String(o.geo_code)
          : employee.geoCode != null
            ? String(employee.geoCode)
            : undefined,
    birthDate:
      o.birthDate != null
        ? String(o.birthDate)
        : o.birth_date != null
          ? String(o.birth_date)
          : o.dateOfBirth != null
            ? String(o.dateOfBirth)
            : undefined,
    // Id ảnh nằm trong extraData của `employee`; nhận cả bản top-level vì
    // /current đã có tiền lệ trả field ở cả hai tầng (xem geoCode).
    avatarId: readAvatarIdFromExtraData(
      employee.extraData || o.extraData,
    ),
  };
}

/**
 * POST /api/lcms/user/upload-avatar (multipart) — tải ảnh lên và trả về id ảnh.
 * Mới chỉ là bước LƯU KHO: ảnh chưa gắn vào hồ sơ cho tới khi gọi
 * lcmsUpdateProfile với id này, nên chọn rồi đổi ý vẫn không đụng hồ sơ.
 */
export async function lcmsUploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await lcmsPlatformRequest("/api/lcms/user/upload-avatar", {
    method: "POST",
    body: form,
    // Cửa này trả id ảnh, có bản trả JSON có bản trả số trơn (text/plain). Ép
    // Accept: application/json là mời 406 Not Acceptable — nhận cả hai.
    headers: { Accept: "application/json, text/plain, */*" },
  });
  const responseText = await res.text().catch(() => "");
  if (!res.ok) throwLcmsPlatformError(res.status, responseText);
  // Shape đã chốt với thân thật (25/08): id ảnh trần, có thể kèm nháy kép —
  // `345413326815101013` hoặc `"345413326815101013"`. Lấy nguyên chuỗi BE trả,
  // KHÔNG kiểm định dạng và KHÔNG JSON.parse (id 18 chữ số vượt
  // Number.MAX_SAFE_INTEGER, đi qua `number` là mất chữ số).
  const body = responseText.trim();
  const avatarId =
    body.length > 1 && body.startsWith('"') && body.endsWith('"')
      ? body.slice(1, -1)
      : body;
  if (!avatarId) {
    // Giữ thân thật ở `details` để chỗ gọi log ra — cửa này đổi shape lúc nào
    // thì đây là chỗ duy nhất nhìn thấy; câu người dùng đọc thì sạch.
    throw new LcmsApiError(
      res.status,
      "Máy chủ không trả về mã ảnh vừa tải lên.",
      responseText.slice(0, MAX_ERROR_TEXT_LENGTH) || "(thân rỗng)",
    );
  }
  return avatarId;
}

/** Vài ký tự đầu của base64 đủ nhận ra định dạng ảnh, dùng khi máy chủ không khai extName. */
const BASE64_IMAGE_MIMES: ReadonlyArray<readonly [string, string]> = [
  ["/9j/", "image/jpeg"],
  ["iVBORw0KGgo", "image/png"],
  ["R0lGOD", "image/gif"],
  ["UklGR", "image/webp"],
];

/**
 * MIME của ảnh đại diện, ưu tiên `extName` rồi tới đuôi `filename`, cuối cùng
 * mới đoán từ chính chuỗi base64. Phải đúng: data: URI khai sai kiểu là trình
 * duyệt vẽ ra ô vỡ chứ không tự dò lại.
 */
function lcmsAvatarMimeType(
  avatar: Record<string, unknown>,
  base64: string,
): string {
  const declared =
    typeof avatar.extName === "string" && avatar.extName.trim() !== ""
      ? avatar.extName
      : (String(avatar.filename ?? "").split(".").pop() ?? "");
  const ext = declared.trim().toLowerCase().replace(/^\./, "");
  if (ext !== "") return `image/${ext === "jpg" ? "jpeg" : ext}`;
  const sniffed = BASE64_IMAGE_MIMES.find(([magic]) => base64.startsWith(magic));
  return sniffed ? sniffed[1] : "image/png";
}

/**
 * GET /api/lcms/user/get-avatar?id=… — ảnh đại diện, tải bằng id lấy từ
 * `employee.extraData` của /current. Cửa này ĐÒI Bearer token nên không gắn
 * thẳng url vào <img src> được.
 *
 * Thân trả về là JSON, KHÔNG phải nhị phân (chốt bằng thân thật 26/08):
 * `{filename, extName, content}` với `content` là ảnh mã hoá base64. Trả về
 * data: URI ghép sẵn — chuỗi bất biến, cache thẳng được, và không kéo theo vòng
 * đời object URL phải thu hồi.
 */
export async function lcmsFetchAvatarDataUrl(avatarId: string): Promise<string> {
  const avatar =
    (await lcmsPlatformFetch<Record<string, unknown>>(
      `/api/lcms/user/get-avatar?id=${encodeURIComponent(avatarId)}`,
    )) ?? {};
  const content =
    typeof avatar.content === "string" ? avatar.content.trim() : "";
  if (content === "") {
    throw new LcmsApiError(200, "Máy chủ không trả về nội dung ảnh đại diện.");
  }
  // Có bản đã ghép sẵn data: URI thì dùng nguyên, khỏi bọc hai lần.
  if (content.startsWith("data:")) return content;
  return `data:${lcmsAvatarMimeType(avatar, content)};base64,${content}`;
}

/**
 * Chuẩn hoá ngày sinh về đúng wire-format LCMS "YYYY-MM-DDT00:00:00Z" (nửa đêm
 * UTC). Chấp nhận "YYYY-MM-DD" (từ <input type="date">) hoặc chuỗi ISO đầy đủ —
 * chỉ lấy phần ngày. Trả null nếu không parse được (bỏ khỏi payload).
 */
function toLcmsBirthDateIso(value: string | null | undefined): string | null {
  const ymd = (value ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd}T00:00:00Z` : null;
}

/**
 * POST /api/lcms/user/update-new-user — cập nhật tỉnh (+ đổi mật khẩu tùy
 * chọn). User được xác định qua auth token (không gửi userId).
 * tenantId/positionTypeId HARDCODE theo yêu cầu LCMS.
 */
export async function lcmsUpdateProfile(params: {
  geoCode?: string;
  newPassword?: string;
  /** "YYYY-MM-DD" hoặc ISO đầy đủ; gửi lên dạng "YYYY-MM-DDT00:00:00Z". */
  birthDate?: string;
  /** Id ảnh từ lcmsUploadAvatar. */
  avatar?: string;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    positionTypeId: LCMS_PROFILE_POSITION_TYPE_ID,
    tenantId: LCMS_PROFILE_TENANT_ID,
  };
  // Chỉ gửi geoCode khi có giá trị — endpoint dùng chung cho đổi MK, gửi geoCode
  // rỗng sẽ ghi đè/xoá Tỉnh/TP đã lưu của user chưa đặt tỉnh.
  if (params.geoCode) payload.geoCode = params.geoCode;
  const birthDateIso = toLcmsBirthDateIso(params.birthDate);
  if (birthDateIso) payload.birthDate = birthDateIso;
  if (params.newPassword) payload.newPassword = params.newPassword;
  if (params.avatar) payload.avatar = params.avatar;
  await lcmsPlatformFetch<unknown>(`/api/lcms/user/update-new-user`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * POST /api/lcms/user/change-password — đổi mật khẩu (endpoint riêng, yêu cầu
 * mật khẩu hiện tại). User xác định qua auth token (không gửi userId).
 */
export async function lcmsChangePassword(params: {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  await lcmsPlatformFetch<unknown>(`/api/lcms/user/change-password`, {
    method: "POST",
    body: JSON.stringify({
      oldPassword: params.oldPassword,
      newPassword: params.newPassword,
      confirmPassword: params.confirmPassword,
    }),
  });
}

// ---------------------------------------------------------------------------
// Auth — LCMS issues its own tokens; normalize to the legacy AuthTokenResponse
// so storage/AuthContext stay untouched.
// ---------------------------------------------------------------------------

/**
 * LCMS auth endpoints per "Authentication API Integration Specification"
 * (partner PDF, 2026-07-14). Paths are relative to the LCMS auth/security
 * origin (getLcmsAuthBaseUrl — e.g. http://security.nxbgd.vn), which is a
 * different host from the catalog API (getLcmsApiBaseUrl, /api/lcms/*).
 * Also available but not consumed yet:
 * GET /api/security/auth/idps — identity-provider list (Google/SSO options)
 * for a dynamic login screen; our dialog is username/password only until the
 * feature-flag work lands.
 */
const LCMS_AUTH_PATHS = {
  login: "/api/security/auth/login",
  refresh: "/api/security/auth/refresh",
  googleLogin: "/api/security/auth/login/google",
  googleCallback: "/api/security/auth/callback/google",
  // Nằm dưới /api/security/user (không phải /auth) nhưng vẫn là cửa công khai
  // trên host security, nên để chung bảng này — xem lcmsRecoveryPassword.
  recoveryPassword: "/api/security/user/recovery-password",
} as const;
// tenantCode hard-coded per owner instruction 2026-07-14 (single-tenant web).
const LCMS_TENANT_CODE = "NXB";
const lcmsLoginBody = (username: string, password: string) =>
  JSON.stringify({ username, password, tenantCode: LCMS_TENANT_CODE });
const lcmsRefreshBody = (sessionId: string | null, refreshToken: string) =>
  JSON.stringify({ sessionId, refreshToken });

/** Remembered for lcmsFetchMe — LCMS has no known /me endpoint. */
const LCMS_IDENTIFIER_KEY = "evo_lcms_identifier";
/**
 * The refresh endpoint requires the sessionId issued at login. The legacy
 * saveSession/refresh contract has no session field, so the adapter persists
 * it in its own key (cleared on logout per the spec).
 */
const LCMS_SESSION_ID_KEY = "evo_lcms_session_id";
/**
 * Cờ "phải đổi mật khẩu" cho lần đăng nhập đầu. Lưu localStorage để còn nguyên
 * khi tải lại trang (modal ép đổi mật khẩu phải hiện lại đến khi đổi xong). Đặt
 * mỗi lần đăng nhập theo `newUser`; xóa khi đổi xong hoặc đăng xuất.
 */
const LCMS_MUST_CHANGE_PW_KEY = "evo_lcms_must_change_pw";

/**
 * Nguồn duy nhất quyết định "phiên này còn nợ đổi mật khẩu" — đổi tại đây nếu backend đổi cờ.
 *
 * Ba lối vào, cùng một kết cục là tài khoản đang dùng mật khẩu ai cũng biết:
 * - `newUser` — LCMS cấp tài khoản mới kèm mật khẩu mặc định.
 * - `mustChangePassword` — cờ máy chủ tự khai (hiện luôn false, xem LcmsAuthResponse).
 * - Đăng nhập BẰNG CHÍNH mật khẩu mặc định — đây là ca sau khi khôi phục mật khẩu, và là
 *   vế DUY NHẤT bắt được nó: `recovery-password` đặt lại tài khoản về đúng mật khẩu mặc
 *   định rồi gửi mail, nhưng lượt đăng nhập kế tiếp trả `newUser: false` VÀ
 *   `mustChangePassword: false` (kiểm chứng trên máy chủ thật 25/08/2026). Nhận diện theo
 *   mật khẩu vừa nhập nên đúng trên MỌI thiết bị — không phụ thuộc trình duyệt nào đã xin
 *   khôi phục.
 */
function firstLoginRequiresPasswordChange(
  a: LcmsAuthResponse,
  password: string,
): boolean {
  return (
    a.newUser === true ||
    a.mustChangePassword === true ||
    password === getLcmsDefaultPassword()
  );
}

function rememberMustChangePassword(mustChange: boolean): void {
  try {
    if (mustChange) localStorage.setItem(LCMS_MUST_CHANGE_PW_KEY, "1");
    else localStorage.removeItem(LCMS_MUST_CHANGE_PW_KEY);
  } catch {
    // storage unavailable — modal ép đổi mật khẩu sẽ không bền qua reload
  }
}

/** True khi phiên hiện tại còn nợ đổi mật khẩu lần đầu. */
export function lcmsMustChangePassword(): boolean {
  try {
    return localStorage.getItem(LCMS_MUST_CHANGE_PW_KEY) === "1";
  } catch {
    return false;
  }
}

/** Xóa cờ sau khi đổi mật khẩu thành công. */
export function clearLcmsMustChangePassword(): void {
  rememberMustChangePassword(false);
}

function rememberLcmsSessionId(sessionId: string | null | undefined): void {
  if (!sessionId) return;
  try {
    localStorage.setItem(LCMS_SESSION_ID_KEY, sessionId);
  } catch {
    // storage unavailable — next refresh will send sessionId: null
  }
}

interface LcmsAuthResponse {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  locked: boolean;
  expireDatetime?: string | null; // present on login; absent on refresh
  requiresTotp: boolean;
  // true khi lần đăng nhập đầu (tài khoản mới) — cùng cờ luồng Google gửi qua
  // query `newUser`. Ép đổi mật khẩu trước khi dùng app.
  newUser?: boolean;
  // LCMS có gửi cờ này (quan sát trên phản hồi thật 25/08/2026) nhưng hiện LUÔN
  // false — kể cả ngay sau khi khôi phục mật khẩu, lúc tài khoản đang ở mật khẩu
  // mặc định. Vẫn tôn trọng nếu ngày nào đó máy chủ bật lên.
  mustChangePassword?: boolean;
}

/**
 * The seam that makes wire-shape changes a non-event: only this function
 * knows the LCMS auth response fields. `expireDatetime` is naive local time;
 * clamp to ≥60s and fall back to 30 minutes when unparseable.
 */
function toAuthTokenResponse(a: LcmsAuthResponse): AuthTokenResponse {
  const exp = parseLcmsDatetime(a.expireDatetime);
  const expiresIn = exp
    ? Math.max(60, Math.floor((exp.getTime() - Date.now()) / 1000))
    : 1800;
  return {
    access_token: a.accessToken,
    refresh_token: a.refreshToken,
    token_type: "bearer",
    expires_in: expiresIn,
    session_id: a.sessionId,
  };
}

/**
 * Thông báo tiếng Việt cho các mã lỗi xác thực LCMS đã biết. LCMS trả lỗi dạng
 * `{ errorCode, errors: ["<code>"] }` (errors là MÃ, không phải câu chữ), nên
 * nếu chỉ đọc `message` sẽ rơi về chuỗi kỹ thuật "Auth API error 400".
 */
const LCMS_AUTH_ERROR_MESSAGES: Record<string, string> = {
  "security.authen.user-login-failed-n-times":
    "Sai tài khoản hoặc mật khẩu. Bạn đã nhập sai nhiều lần — nhập sai thêm có thể khiến tài khoản bị tạm khóa.",
};

interface LcmsErrorEnvelope {
  message?: string | null;
  errorCode?: string | null;
  errors?: unknown;
}

/**
 * Dựng thông báo đăng nhập dễ hiểu từ envelope lỗi LCMS. Ưu tiên `message` (nếu
 * có), rồi map mã trong `errors[0]`/`errorCode`; mọi mã thuộc miền
 * `security.authen.*` đều là lỗi xác thực nên gộp về một câu chung; cuối cùng
 * mới là thông báo có mã HTTP.
 */
function lcmsAuthErrorMessage(raw: LcmsErrorEnvelope | null, status: number): string {
  if (raw?.message) return raw.message;

  const firstError =
    Array.isArray(raw?.errors) && typeof raw?.errors[0] === "string"
      ? (raw.errors[0] as string)
      : undefined;
  const code = firstError ?? (raw?.errorCode ?? undefined);

  if (code && LCMS_AUTH_ERROR_MESSAGES[code]) return LCMS_AUTH_ERROR_MESSAGES[code];
  if (code && code.startsWith("security.authen."))
    return "Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản và mật khẩu.";

  // Fallback CŨNG phải thân thiện: không lộ mã HTTP/chuỗi kỹ thuật cho người dùng.
  // status chỉ dùng để phân nhánh mạng/máy chủ, không đưa vào câu chữ.
  if (status >= 500)
    return "Hệ thống đang bận. Vui lòng thử lại sau ít phút.";
  return "Đăng nhập không thành công. Vui lòng thử lại.";
}

/**
 * Email không có trong tenant thì LCMS KHÔNG trả 404 — nó ném NullPointerException
 * vì `UserServiceImpl.fetchByEmail(...)` trả null, ra 500 kèm nguyên câu Java trong
 * `errors[0]`. Dấu vết đó là tín hiệu DUY NHẤT phân biệt "email chưa đăng ký" với sự
 * cố máy chủ thật, nên chỉ nhận diện bằng đúng dấu vết này: 404 KHÔNG được gộp vào
 * (404 thật ra hay là sai LCMS_AUTH_BASE_URL/route, báo "email chưa đăng ký" lúc đó
 * là chẩn đoán sai cho cả người dùng lẫn support).
 *
 * Mẫu neo liền `fetchByEmail(...)" is null` chứ không quét tràn: thân 5xx là nguyên
 * stack trace Java, một sự cố khác chỉ tình cờ có khung `fetchByEmail` ở trên và chữ
 * "is null" ở dưới cũng sẽ khớp nếu để khoảng giữa tự do.
 */
const LCMS_EMAIL_NOT_FOUND_PATTERN = /fetchByEmail\([^)]*\)" is null/;

const LCMS_RECOVERY_FAILED_MESSAGE =
  "Không gửi được yêu cầu đặt lại mật khẩu. Vui lòng thử lại.";

/**
 * Thông báo cho người dùng khi xin khôi phục mật khẩu thất bại. Thân lỗi 5xx của LCMS
 * hay là stack trace Java / lỗi SQL — cùng luật với lcmsPlatformFetch: 5xx chỉ trả câu
 * chung, không lấy chữ nào từ máy chủ (kể cả `message`). Với 4xx thì `message` được hiện
 * nguyên văn (giống lcmsAuthErrorMessage) vì đó là lỗi nhập liệu máy chủ diễn đạt cho
 * người dùng — đánh đổi: câu đó có thể không phải tiếng Việt.
 */
function lcmsRecoveryErrorMessage(raw: LcmsErrorEnvelope | null, status: number): string {
  const details = [
    raw?.message ?? "",
    ...(Array.isArray(raw?.errors)
      ? raw.errors.filter((e): e is string => typeof e === "string")
      : []),
  ];

  // Email chưa đăng ký dùng chung câu lỗi xử lý với các lỗi khác, không nói rõ
  // email không tồn tại — tránh để màn này thành công cụ dò tài khoản.
  if (details.some((d) => LCMS_EMAIL_NOT_FOUND_PATTERN.test(d))) {
    return LCMS_RECOVERY_FAILED_MESSAGE;
  }
  if (status >= 500) return "Hệ thống đang bận. Vui lòng thử lại sau ít phút.";
  if (raw?.message) return raw.message;
  return LCMS_RECOVERY_FAILED_MESSAGE;
}

/** POST auth request; tolerates both a bare object and a {success,data} envelope. */
async function lcmsAuthPost(path: string, body: string): Promise<LcmsAuthResponse> {
  let res: Response;
  try {
    res = await fetch(`${getLcmsAuthBaseUrl()}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body,
    });
  } catch {
    // Không tới được máy chủ (offline/DNS/CORS) — fetch ném "Failed to fetch".
    // Đừng để lộ chuỗi kỹ thuật đó; hiện thông báo thân thiện.
    throw new Error(
      "Không kết nối được máy chủ. Vui lòng kiểm tra kết nối mạng rồi thử lại.",
    );
  }
  const raw = (await res.json().catch(() => null)) as
    | (Partial<LcmsAuthResponse> &
        LcmsErrorEnvelope & { success?: boolean; data?: LcmsAuthResponse | null })
    | null;
  const payload = raw && raw.data !== undefined ? raw.data : (raw as LcmsAuthResponse | null);
  if (!res.ok || raw?.success === false || !payload?.accessToken) {
    throw new Error(lcmsAuthErrorMessage(raw, res.status));
  }
  return payload;
}

function assertUsableLcmsSession(a: LcmsAuthResponse): void {
  if (a.locked) throw new Error("Tài khoản đã bị khóa.");
  if (a.requiresTotp) {
    throw new Error("Tài khoản yêu cầu xác thực TOTP — chưa được hỗ trợ trên web.");
  }
}

export async function lcmsLogin(
  identifier: string,
  password: string,
): Promise<AuthTokenResponse> {
  const auth = await lcmsAuthPost(LCMS_AUTH_PATHS.login, lcmsLoginBody(identifier, password));
  assertUsableLcmsSession(auth);
  rememberLcmsSessionId(auth.sessionId);
  // Đặt lại mỗi lần đăng nhập (tự sửa: user cũ newUser=false sẽ xóa cờ).
  rememberMustChangePassword(firstLoginRequiresPasswordChange(auth, password));
  try {
    localStorage.setItem(LCMS_IDENTIFIER_KEY, identifier);
  } catch {
    // storage unavailable (private mode) — fetchMe just loses the display name
  }
  return toAuthTokenResponse(auth);
}

export async function lcmsRefresh(refreshToken: string): Promise<AuthTokenResponse> {
  let sessionId: string | null = null;
  try {
    sessionId = localStorage.getItem(LCMS_SESSION_ID_KEY);
  } catch {
    sessionId = null;
  }
  const auth = await lcmsAuthPost(
    LCMS_AUTH_PATHS.refresh,
    lcmsRefreshBody(sessionId, refreshToken),
  );
  assertUsableLcmsSession(auth);
  rememberLcmsSessionId(auth.sessionId); // spec: overwrite only when present
  return toAuthTokenResponse(auth);
}

/** LCMS has no known /me endpoint — synthesize a minimal student user. */
export async function lcmsFetchMe(): Promise<AuthMeResponse> {
  let name: string | undefined;
  try {
    name = localStorage.getItem(LCMS_IDENTIFIER_KEY) ?? undefined;
  } catch {
    name = undefined;
  }
  return { actor_type: "user", user: { name, role: "student" } };
}

/**
 * Logout is client-side per the auth spec (no server endpoint): AuthContext
 * clears the token session; the adapter clears its own sessionId key.
 */
export async function lcmsLogout(): Promise<void> {
  try {
    localStorage.removeItem(LCMS_SESSION_ID_KEY);
    localStorage.removeItem(LCMS_MUST_CHANGE_PW_KEY);
  } catch {
    // storage unavailable — nothing to clear
  }
}

/**
 * POST /api/security/user/recovery-password — xin khôi phục mật khẩu. Cửa công khai
 * (không cần token), thân `{ tenantCode, email }`.
 *
 * Khôi phục chạy TRỌN VẸN phía LCMS: máy chủ ĐẶT LẠI mật khẩu về mặc định
 * (getLcmsDefaultPassword) rồi gửi mật khẩu đó vào email — web không nhận mã nào nên
 * không có bước hai, người dùng quay lại đăng nhập và bị ép đổi mật khẩu ngay
 * (firstLoginRequiresPasswordChange). Gửi thành công trả 200 thân RỖNG — nhưng
 * KHÔNG được coi mọi 200 là xong: LCMS có thói quen trả `{success:false}` kèm HTTP 200
 * ở các cửa khác (lcmsAuthPost, lcmsPlatformFetch), mà báo "đã gửi" trong khi máy chủ
 * từ chối là lỗi câm — người dùng ngồi chờ lá thư không bao giờ tới.
 */
export async function lcmsRecoveryPassword(email: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${getLcmsAuthBaseUrl()}${LCMS_AUTH_PATHS.recoveryPassword}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ tenantCode: LCMS_TENANT_CODE, email }),
    });
  } catch {
    throw new Error(
      "Không kết nối được máy chủ. Vui lòng kiểm tra kết nối mạng rồi thử lại.",
    );
  }
  // Text rồi mới parse: thân rỗng/không-JSON làm res.json() ném, và ca thành công
  // CHÍNH LÀ thân rỗng.
  const text = await res.text().catch(() => "");
  let raw: (LcmsErrorEnvelope & { success?: boolean }) | null = null;
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      raw = null;
    }
  }
  if (res.ok && raw?.success !== false) return;
  throw new Error(lcmsRecoveryErrorMessage(raw, res.status));
}

// ---------------------------------------------------------------------------
// Google login (redirect flow, partner spec 2026-07-17):
// 1. GET /api/security/auth/login/google?redirectUri=<lcms callback>&tenantCode
//    yields the Google account-chooser URL; the browser navigates there.
// 2. After consent, LCMS redirects back to the web app at /google/authen with
//    accessToken/refreshToken/sessionId/newUser in the query string.
// ---------------------------------------------------------------------------

/** Pull a redirect URL out of the login/google response, whatever its shape. */
function extractGoogleRedirectUrl(raw: unknown): string | null {
  if (typeof raw === "string") {
    return /^https?:\/\//.test(raw.trim()) ? raw.trim() : null;
  }
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return (
    extractGoogleRedirectUrl(o.data) ??
    extractGoogleRedirectUrl(o.url) ??
    extractGoogleRedirectUrl(o.redirectUrl) ??
    extractGoogleRedirectUrl(o.redirectUri) ??
    extractGoogleRedirectUrl(o.loginUrl)
  );
}

/**
 * Step 1 — resolve the URL the browser must visit to start Google sign-in.
 * The endpoint either 302s straight to Google (then the endpoint URL itself
 * is returned so the browser can follow the redirect) or returns the Google
 * URL in its body (bare string or envelope).
 */
export async function lcmsGetGoogleLoginUrl(): Promise<string> {
  const base = getLcmsAuthBaseUrl();
  const redirectUri = `${base}${LCMS_AUTH_PATHS.googleCallback}`;
  const loginUrl =
    `${base}${LCMS_AUTH_PATHS.googleLogin}` +
    `?redirectUri=${encodeURIComponent(redirectUri)}` +
    `&tenantCode=${encodeURIComponent(LCMS_TENANT_CODE)}`;

  const res = await fetch(loginUrl, {
    redirect: "manual",
    headers: { Accept: "application/json" },
  });
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    return loginUrl;
  }

  const text = await res.text().catch(() => "");
  let body: unknown = text;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    // plain-text response — extractGoogleRedirectUrl handles the string case
  }
  if (!res.ok) {
    const message =
      body !== null && typeof body === "object"
        ? (body as { message?: string | null }).message
        : null;
    throw new Error(message ?? `Auth API error ${res.status}`);
  }
  const url = extractGoogleRedirectUrl(body);
  if (!url) throw new Error("Không lấy được đường dẫn đăng nhập Google.");
  return url;
}

/** Base64url-decode a JWT payload; null on any malformed input. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      Array.from(atob(b64), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
    );
    const parsed = JSON.parse(json) as unknown;
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export interface LcmsGoogleCallbackParams {
  accessToken: string;
  refreshToken: string;
  sessionId: string | null;
}

/**
 * Step 2 — adopt the tokens LCMS appended to the /google/authen redirect.
 * No expireDatetime here (unlike login/refresh), so expiry comes from the
 * access token's own `exp` claim; the JWT `username` claim feeds lcmsFetchMe
 * the same way the login form's identifier does.
 */
export function lcmsCompleteGoogleLogin(
  params: LcmsGoogleCallbackParams,
): AuthTokenResponse {
  rememberLcmsSessionId(params.sessionId);

  const claims = decodeJwtPayload(params.accessToken);
  const username = claims?.username;
  if (typeof username === "string" && username !== "") {
    try {
      localStorage.setItem(LCMS_IDENTIFIER_KEY, username);
    } catch {
      // storage unavailable — fetchMe just loses the display name
    }
  }

  const exp = claims?.exp;
  const expiresIn =
    typeof exp === "number" && Number.isFinite(exp)
      ? Math.max(60, Math.floor(exp - Date.now() / 1000))
      : 1800;

  return {
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
    token_type: "bearer",
    expires_in: expiresIn,
    session_id: params.sessionId ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Mastery (màn "Năng lực AI" /hoc-sinh/nang-luc-v2).
//
// Tách riêng khỏi `lcmsAuthedFetch` (envelope) vì 3 endpoint mastery trả về
// OBJECT TRẦN (không có envelope {success, data, ...}). Hàm `lcmsAuthedFetchRaw`
// dưới đây parse JSON thẳng, không check envelope — caller tự guard shape.
// ---------------------------------------------------------------------------

/**
 * Authed fetch cho endpoint trả object trần (không envelope).
 * Tự refresh token khi 401, giống `lcmsAuthedFetch` — chỉ khác phần parse body.
 */
async function lcmsAuthedFetchRaw<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { headers, ...rest } = init ?? {};

  const doFetch = (token: string | null) =>
    fetch(`${baseUrl}/api/lcms${path}`, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((headers as Record<string, string>) ?? {}),
      },
    });

  const token = getStoredSession().accessToken;
  let res = await doFetch(token);

  if (res.status === 401 && token) {
    let newToken: string;
    try {
      newToken = await refreshLcmsAccessToken();
    } catch {
      endLcmsSession();
      throw new LcmsApiError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    }
    res = await doFetch(newToken);
  }

  if (res.status === 401) {
    endLcmsSession();
    throw new LcmsApiError(
      401,
      "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LcmsApiError(
      res.status,
      `LCMS API error ${res.status}: ${body}`,
    );
  }

  // Body không có envelope — parse JSON thẳng. Caller guard shape.
  return (await res.json()) as T;
}

export interface LcmsBookMastery {
  book_id: LcmsId;
  book_name: string;
  kc_total: number;
  mastered_count: number;
  touched_kc_count: number;
  completion_rate: number;
}

export interface LcmsBookMasteryResponse {
  /** Optional: BE có thể vẫn trả, nhưng FE không phụ thuộc. */
  user_id?: LcmsId;
  as_of: string;
  books: LcmsBookMastery[];
}

export interface LcmsChapterMastery {
  chapter_id: LcmsId;
  chapter_name: string;
  book_id: LcmsId;
  book_name: string;
  kc_total: number;
  mastered_count: number;
  touched_kc_count: number;
  completion_rate: number;
}

export interface LcmsChapterMasteryResponse {
  user_id?: LcmsId;
  as_of: string;
  chapters: LcmsChapterMastery[];
}

export interface LcmsKcMastery {
  kc_id: LcmsId;
  kc_code: string;
  kc_name: string;
  mastery: number;
  evidence_count: number;
  confidence_level: string;
  is_mastered: boolean;
  recommendation: string;
}

export interface LcmsLessonMastery {
  lesson_id: LcmsId;
  lesson_name: string;
  chapter_id: LcmsId;
  book_id: LcmsId;
  kc_count: number;
  evidence_total: number;
  correct_count: number | null;
  total_count: number | null;
  correct_rate: number | null;
  mastery_mean: number;
  mastery_min: number;
  is_mastered: boolean;
  recommendation: string;
  confidence_level: string;
  kcs: LcmsKcMastery[];
  /** Gợi ý câu hỏi cần luyện lại — nhúng sẵn trong overview, không cần
   *  gọi thêm endpoint. */
  redo_questions: LcmsRedoQuestion[];
}

export interface LcmsLessonOverviewResponse {
  user_id?: LcmsId;
  as_of: string;
  lessons: LcmsLessonMastery[];
}

export interface LcmsRedoQuestionWeakKc {
  kc_id: LcmsId;
  kc_code: string;
  kc_name: string;
  mastery: number;
}

export interface LcmsRedoQuestion {
  question_id: LcmsId;
  question_code: string | null;
  name: string | null;
  weak_kcs: LcmsRedoQuestionWeakKc[];
}

/**
 * GET /api/lcms/mastery/me/books
 * Trả về tiến độ thông thạo (mastery) theo từng sách của học sinh đang đăng nhập.
 *
 * Base URL lấy từ `getLcmsMasteryApiBaseUrl()` — tách riêng khỏi
 * `getLcmsApiBaseUrl()` vì 3 endpoint mastery chạy trên server ĐỘC LẬP
 * (mặc định `http://10.60.109.46:8012`), không dùng chung host với các
 * API LCMS khác.
 */
export async function lcmsListBookMastery(): Promise<LcmsBookMasteryResponse> {
  return lcmsAuthedFetchRaw<LcmsBookMasteryResponse>(
    getLcmsMasteryApiBaseUrl(),
    `/mastery/me/books`,
  );
}

/**
 * GET /api/lcms/mastery/me/chapters
 * Trả về tiến độ thông thạo theo từng chương — caller lọc theo bookId ở FE.
 * Cùng server mastery với `lcmsListBookMastery` (xem comment ở đó).
 */
export async function lcmsListChapterMastery(): Promise<LcmsChapterMasteryResponse> {
  return lcmsAuthedFetchRaw<LcmsChapterMasteryResponse>(
    getLcmsMasteryApiBaseUrl(),
    `/mastery/me/chapters`,
  );
}

/**
 * GET /api/lcms/mastery/me/overview
 * Trả về toàn bộ bài học (lesson) của học sinh đang đăng nhập — caller lọc
 * theo chapterId / lessonId ở FE. Mỗi lesson có sẵn mảng `redo_questions`
 * (gợi ý câu hỏi cần luyện lại) — FE không cần gọi thêm endpoint.
 * Cùng server mastery với `lcmsListBookMastery` (xem comment ở đó).
 */
export async function lcmsListLessonOverview(): Promise<LcmsLessonOverviewResponse> {
  return lcmsAuthedFetchRaw<LcmsLessonOverviewResponse>(
    getLcmsMasteryApiBaseUrl(),
    `/mastery/me/overview`,
  );
}
