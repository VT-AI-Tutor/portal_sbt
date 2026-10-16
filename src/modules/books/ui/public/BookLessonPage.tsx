import { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/core/ui/card";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  History,
  Library,
  PlayCircle,
  RotateCw,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  useCatalogBook,
  useCatalogBookLesson,
} from "@/modules/catalog/hooks/useCatalog";
import { FullscreenToggle } from "@/modules/books/ui/shared/FullscreenToggle";
import { LessonPdfViewer } from "@/modules/books/ui/shared/LessonPdfViewer";
import { LessonReferenceMedia } from "@/modules/books/ui/shared/LessonReferenceMedia";
import { pauseMediaIn } from "@/modules/books/ui/shared/pauseMediaIn";
import {
  isTapVietSubject,
  lessonLabels,
  referenceGroups,
} from "@/modules/books/ui/shared/lessonLabels";
import { useBookPlayerSkin } from "@/modules/books/ui/shared/bookPlayerSkin";
import { lessonNumbersById } from "@/modules/books/ui/shared/lessonNumbering";
import { LessonTitleText } from "@/modules/books/ui/shared/LessonTitleText";
import {
  getPreviewBook,
  getPreviewLesson,
  type PreviewQuestion,
} from "@/modules/books/api/previewApi";
import { StandaloneExerciseRunner } from "@/modules/books/ui/shared/StandaloneExerciseRunner";
import {
  toQuestionLabels,
  toLessonSections,
} from "@/modules/books/ui/shared/lessonSections";
import {
  ExercisePassDialog,
  hasEnteredExercisePass,
} from "@/modules/books/ui/shared/ExercisePassDialog";
import { isLessonExerciseLocked } from "@/modules/books/ui/shared/exerciseLockGate";
import { getApiProvider, getExercisePass, getLoaderAdvanceQuestionApi } from "@/core/api/config";
import { SubmissionRunner } from "@/modules/books/ui/shared/SubmissionRunner";
import { ExerciseEmptyState } from "@/modules/books/ui/shared/ExerciseEmptyState";
import {
  getCurrentAttempt,
  listHistory,
  listLessonExercises,
  type ExerciseListItem,
  type HistoryItem,
} from "@/modules/books/api/assessmentApi";
import {
  LessonHub,
  type LessonHubItem,
} from "@/modules/books/ui/shared/LessonHub";
import { resolveExerciseHubState } from "@/modules/books/ui/shared/exerciseHubState";
import { InlineHistory } from "@/modules/books/ui/shared/SubmissionDetailDialog";
import { isAnswerEmpty } from "@/core/exercise/grading";
import { SkinProvider } from "@/core/exercise/skin";
import { getStoredSession } from "@/core/auth/storage";
import { UserHeaderMenu } from "@/modules/books/ui/shared/UserHeaderMenu";
import { StudentLoginDialog } from "@/modules/books/ui/public/StudentLoginDialog";
import { PreviewBanner } from "@/modules/books/ui/shared/PreviewBanner";
import { getSubjectDisplay } from "@/core/reference";
import { safeInternalUrl, safeHttpUrl } from "@/core/lib/security";
import { resolveQuestionType } from "@/core/exercise/questionType";
import { plainTextFromHtml } from "@/core/rich-text/html";
import { DigitizedExercisePassDialog } from "@/modules/digitized-content/ui/DigitizedExercisePassDialog";
import { DigitizedExerciseDialog } from "@/modules/digitized-content/ui/DigitizedExerciseDialog";
import { AdvancedExerciseDialog } from "@/modules/books/ui/shared/AdvancedExerciseDialog";
import {
  getDigitizedManifest,
  preloadDigitizedManifests,
} from "@/modules/digitized-content/api/loader";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Provider is static per page load (same precedent as SubmissionRunner) —
// gate mật khẩu bài tập chỉ áp dụng cho hệ LCMS.
const IS_LCMS = getApiProvider() === "lcms";

// Cờ chuyển nguồn dữ liệu bài tập nâng cao:
// - true  → gọi API `?is_advanced=true` (luồng mới, mặc định).
// - false → đọc từ `public/digitized-content/<bookId>/content.json` (luồng cũ).
// Dùng khi API chưa sẵn sàng ở một số môi trường: set
// `VITE_LOADER_ADVANCE_QUESTION_API=0` để rơi về JSON tĩnh mà không cần revert.
const LOADER_ADVANCE_QUESTION_API = getLoaderAdvanceQuestionApi();

const HOME_PATH = "/";
const BOOK_DETAIL_BASE = "/sach-bai-tap/";

// No longer needed — URLs now use human-readable codes instead of compound numeric IDs

type PdfViewMode = "book" | "answer";

/** Màn đang xem trong bài. `"hub"` = menu chọn, mặc định khi vào bài. */
type LessonView =
  | "hub"
  | "pdf-book"
  | "pdf-answer"
  | "exercise"
  | "reference-video"
  | "reference-image"
  | "history";

// Nút phụ dạng icon (nav, mở rộng, thu gọn): ghost, bo tròn, dùng token semantic.
const ghostIconBtn =
  "inline-flex items-center justify-center size-9 rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer";

// Nút phụ dạng icon + chữ (toàn màn hình).
const ghostTextBtn =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer";

function PdfViewTabs({
  mode,
  onChange,
  hasBook,
  hasAnswer,
  bookLabel,
}: {
  mode: PdfViewMode;
  onChange: (mode: PdfViewMode) => void;
  hasBook: boolean;
  hasAnswer: boolean;
  bookLabel: string;
}) {
  if (!hasBook && !hasAnswer) {
    return null;
  }

  // Chỉ một loại tài liệu: hiển thị badge nhãn, không giả dạng nút bấm.
  if (hasBook !== hasAnswer) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-primary">
        {hasBook ? (
          <BookOpen className="size-3.5" />
        ) : (
          <FileText className="size-3.5" />
        )}
        {hasBook ? bookLabel : "Đáp án"}
      </div>
    );
  }

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs sm:text-sm transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
      active
        ? "bg-primary text-primary-foreground font-bold shadow-sm"
        : "font-semibold text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 p-1">
      <button
        type="button"
        onClick={() => onChange("book")}
        className={tabClass(mode === "book")}
      >
        <BookOpen className="size-3.5" />
        {bookLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange("answer")}
        className={tabClass(mode === "answer")}
      >
        <FileText className="size-3.5" />
        Đáp án
      </button>
    </div>
  );
}

/** Mảng rỗng dùng chung — giữ identity ổn định giữa các lần render. */
const NO_EXERCISES: ExerciseListItem[] = [];

export function BookLessonPage({ embed: embedProp = false }: { embed?: boolean } = {}) {
  const navigate = useNavigate();
  const { bookCode: routeBookCode, lessonCode: routeLessonCode } = useParams<{
    bookCode?: string;
    lessonCode?: string;
  }>();
  // Embed mặc định được PHÁT HIỆN TỰ Động: khi trang được nhúng vào web khác
  // (iframe/WebView), không cần đổi route hay thêm query param — app nhúng chỉ
  // việc nhúng URL gốc. Header, nút "Về trang chủ" ở màn lỗi, và navigate khi
  // session hết hạn đều bị ẩn/khóa để người dùng không thoát khỏi trang nhúng.
  const embed = useMemo(() => {
    if (embedProp) return true;
    if (typeof window === "undefined") return false;
    // iframe sandboxed (không có allow-same-origin) ném SecurityError khi đụng
    // `window.top` — coi như đang bị nhúng.
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, [embedProp]);
  // Fetch book detail directly by code (no catalog list needed)
  const isPreviewRoute = !!routeBookCode && UUID_RE.test(routeBookCode);
  const { data: catalogBook, isLoading: isCatalogBookLoading } = useCatalogBook(
    !isPreviewRoute ? routeBookCode : undefined,
  );
  const bookRouteCode = catalogBook?.code ?? routeBookCode;

  // Resolve lessonCode → lesson ID (string) using book chapters
  const apiLessonId = useMemo(() => {
    if (!routeLessonCode) return undefined;
    // A numeric route segment IS the lesson id (backwards compat)
    const parsed = Number(routeLessonCode);
    if (Number.isInteger(parsed) && parsed > 0) return routeLessonCode;
    // Resolve by code from book chapters
    if (catalogBook?.chapters) {
      for (const ch of catalogBook.chapters) {
        for (const l of ch.lessons) {
          if (l.code === routeLessonCode) {
            return l.id;
          }
        }
      }
    }
    return undefined;
  }, [routeLessonCode, catalogBook]);

  const {
    data: catalogLesson,
    isLoading: isLessonLoading,
    isError: isLessonError,
  } = useCatalogBookLesson(routeBookCode, apiLessonId);

  const [previewEnabled, setPreviewEnabled] = useState(true);
  const isPreview = isPreviewRoute && previewEnabled;
  const { data: previewBook } = useQuery({
    queryKey: ["preview-book", routeBookCode],
    queryFn: () => getPreviewBook(routeBookCode!),
    enabled: isPreview && !!routeBookCode,
  });
  const {
    data: previewLessonData,
    isLoading: isPreviewLessonLoading,
    isError: isPreviewLessonError,
  } = useQuery({
    queryKey: ["preview-lesson", routeBookCode, routeLessonCode],
    queryFn: () => getPreviewLesson(routeBookCode!, routeLessonCode!),
    enabled: isPreview && !!routeBookCode && !!routeLessonCode,
  });
  const exerciseQuestions: PreviewQuestion[] = useMemo(
    () => (previewLessonData?.lesson_items ?? []).flatMap((it) => it.questions),
    [previewLessonData],
  );

  // For published (non-preview) lessons, derive questions from the catalog
  // lesson_items (no auth required) so exercises are visible to everyone.
  const catalogQuestions: PreviewQuestion[] = useMemo(
    () =>
      (catalogLesson?.lesson.lesson_items ?? []).flatMap((item) =>
        item.questions.map((q) => ({
          id: q.id,
          order_index: q.order,
          question_type: resolveQuestionType(q.type, q.payload),
          payload: q.payload,
        })),
      ),
    [catalogLesson],
  );

  // Tên phần cho cả hai runner, dựng từ lesson_items của API công khai — kể cả
  // khi đã đăng nhập (danh sách bài tập chỉ trả tên bài). Nối với đề bằng ID CÂU
  // chứ không theo thứ tự.
  const lessonSections = useMemo(
    () =>
      toLessonSections(
        isPreview
          ? (previewLessonData?.lesson_items ?? [])
          : (catalogLesson?.lesson.lesson_items ?? []).map((item) => ({
              title: item.title,
              questions: item.questions,
            })),
      ),
    [isPreview, previewLessonData, catalogLesson],
  );
  const questionLabelById = useMemo(
    () => toQuestionLabels(lessonSections),
    [lessonSections],
  );

  // For published lessons with a logged-in student, also fetch the student
  // exercise list (for server-side grading / submission tracking).
  const hasToken = !!getStoredSession().accessToken;
  const {
    data: studentExercisesData = [],
    isLoading: isStudentExercisesLoading,
  } = useQuery({
    queryKey: ["student-exercises", apiLessonId],
    // Pass the id as a string: LCMS lesson ids can exceed MAX_SAFE_INTEGER.
    queryFn: () => listLessonExercises(apiLessonId!),
    enabled: !isPreview && !!apiLessonId && hasToken,
    staleTime: 60_000,
  });
  // Dữ liệu CỦA PHIÊN: `enabled: false` không xoá cache, mà danh sách này quyết
  // định hasExercise/tổng số câu/tên bài → khách sẽ được mời vào bài tập trống.
  // useMemo vì effect tự-chọn-bài phụ thuộc mảng này (trả `[]` mới mỗi render
  // là nó chạy lại sau mọi render).
  const studentExercises = useMemo(
    () => (hasToken ? studentExercisesData : NO_EXERCISES),
    [hasToken, studentExercisesData],
  );

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );
  const [loginOpen, setLoginOpen] = useState(false);

  const allQuestions = isPreview ? exerciseQuestions : catalogQuestions;
  const hasExercise = allQuestions.length > 0 || studentExercises.length > 0;

  // Tên bài tập đang chọn (từ exercise-list) — dùng cho tiêu đề kết quả/chia sẻ.
  // exercise-detail LCMS (data.name) hay rỗng nên ưu tiên tên từ đây (row 49).
  const selectedExerciseTitle = studentExercises.find(
    (ex) => ex.id === selectedExerciseId,
  )?.title;

  // Auto-select / reset selected exercise when exercise list or lesson changes
  useEffect(() => {
    const firstId = studentExercises[0]?.id ?? null;
    if (!isPreview) {
      setSelectedExerciseId(firstId);
    }
  }, [studentExercises, isPreview, apiLessonId]);

  const orderedLessons = useMemo(() => {
    if (!catalogBook?.chapters) return [];
    return catalogBook.chapters
      .flatMap((ch) => ch.lessons)
      .sort((a, b) => a.index - b.index);
  }, [catalogBook]);

  // Nhãn "Bài N" trên đầu hub — tra theo mục lục của chính cuốn sách đang mở,
  // để số ở hai màn không lệch nhau.
  const lessonNumber = useMemo(() => {
    const chapters = isPreview ? previewBook?.chapters : catalogBook?.chapters;
    const lessonId = isPreview
      ? previewLessonData?.lesson.id
      : catalogLesson?.lesson.id;
    if (!chapters || !lessonId) return undefined;
    return lessonNumbersById(chapters)[String(lessonId)];
  }, [isPreview, previewBook, catalogBook, previewLessonData, catalogLesson]);

  /** Vị trí bài đang mở trong mục lục sách, đếm từ 0. `-1` = chưa tra được. */
  const currentLessonIdx = useMemo(() => {
    if (!catalogLesson || orderedLessons.length === 0) return -1;
    const { id, index } = catalogLesson.lesson;
    return orderedLessons.findIndex((l) => l.id === id && l.index === index);
  }, [orderedLessons, catalogLesson]);

  const { prevLesson, nextLesson } = useMemo(() => {
    if (currentLessonIdx === -1) return { prevLesson: null, nextLesson: null };
    return {
      prevLesson:
        currentLessonIdx > 0 ? orderedLessons[currentLessonIdx - 1] : null,
      nextLesson:
        currentLessonIdx < orderedLessons.length - 1
          ? orderedLessons[currentLessonIdx + 1]
          : null,
    };
  }, [orderedLessons, currentLessonIdx]);

  const buildLessonPath = (lesson: {
    id: string;
    code: string | null;
    slug: string;
  }) => {
    if (!bookRouteCode) return "#";
    return safeInternalUrl(
      `${BOOK_DETAIL_BASE}${bookRouteCode}/${lesson.code ?? lesson.id}`,
    );
  };

  const displayInfo = useMemo(() => {
    if (catalogLesson) {
      const { book, chapter, lesson } = catalogLesson;
      return {
        title: lesson.title,
        topicName: chapter.title,
        bookName: book.title,
        cover: book.cover_url?.trim() || undefined,
        authors: book.authors?.join(" - ") || "Đội ngũ tác giả chuyên môn",
        level: book.level,
        subjectName: getSubjectDisplay(book.subject_code, book.subject_name)
          .label,
        tap: book.tap,
        publisher: book.publisher || "NXB Giáo Dục Việt Nam",
      };
    }

    if (isPreview && previewLessonData) {
      const lessonUuid = previewLessonData.lesson.id;
      const chapter = previewBook?.chapters.find((c) =>
        c.lessons.some((l) => l.id === lessonUuid),
      );
      return {
        title: previewLessonData.lesson.title,
        topicName: chapter?.title ?? "",
        bookName: previewBook?.title ?? "",
        cover: previewBook?.cover_url?.trim() || undefined,
        authors: "Đội ngũ tác giả chuyên môn",
        level: previewBook?.level != null ? String(previewBook.level) : "",
        subjectName: previewBook?.subject_name ?? "",
        tap: null as number | null,
        publisher: "NXB Giáo Dục Việt Nam",
      };
    }

    const subjectCode = routeLessonCode?.startsWith("toan")
      ? "toan"
      : "khoa-hoc";
    return {
      title: "Bài học",
      topicName: "",
      bookName: "",
      cover: undefined,
      authors: "Đội ngũ tác giả chuyên môn",
      level: "",
      subjectName: getSubjectDisplay(subjectCode).label,
      tap: null as number | null,
      publisher: "NXB Giáo Dục Việt Nam",
    };
  }, [
    catalogLesson,
    routeLessonCode,
    isPreview,
    previewBook,
    previewLessonData,
  ]);

  const coverImageSrc = displayInfo.cover;
  // Môn Tập viết dùng bộ nhãn riêng cho cả sách PDF lẫn tab tài liệu kèm bài.
  const isTapViet = isTapVietSubject({
    code: catalogLesson?.book.subject_code,
    name: catalogLesson?.book.subject_name ?? previewBook?.subject_name,
  });
  const labels = lessonLabels(isTapViet);
  // Khác biệt hiển thị theo MÔN của player đi qua skin — player không biết nó
  // nằm trong sách nào (xem bookPlayerSkin.ts).
  const playerSkin = useBookPlayerSkin({
    code: catalogLesson?.book.subject_code,
    name: catalogLesson?.book.subject_name ?? previewBook?.subject_name,
  });
  const lessonPdfUrl = safeHttpUrl(catalogLesson?.lesson.pdf_url ?? undefined);
  const lessonAnswerPdfUrl = safeHttpUrl(
    catalogLesson?.lesson.pdf_answer_url ?? undefined,
  );
  const hasBookPdf = !!lessonPdfUrl;
  const hasAnswerPdf = !!lessonAnswerPdfUrl;
  const hasAnyPdf = hasBookPdf || hasAnswerPdf;
  const extraMedia = catalogLesson?.lesson.extra_media ?? [];
  // Môn Tập viết tách tài liệu kèm bài thành tab riêng cho video và cho tranh;
  // môn khác vẫn một tab ôm tất cả.
  const refGroups = referenceGroups(isTapViet, extraMedia);
  const hasReference = refGroups.length > 0;
  // Ghi âm bài đọc: TẠM lấy mục audio đầu tiên trong tài liệu kèm bài — LCMS
  // chưa có field ghi âm riêng cho từng phần ĐỌC, nên bài có hai phần ĐỌC dùng
  // chung một file.
  const readingAudioUrl = extraMedia.find((m) => m.type === "audio")?.url;
  // -------------------------------------------------------------------------
  // Bài tập nâng cao — 2 nguồn dữ liệu, chọn theo `LOADER_ADVANCE_QUESTION_API`:
  //
  // - true (mặc định): gọi API `?is_advanced=true`. `hasAdvanced` = có
  //   `lesson_items` không.
  // - false: đọc `public/digitized-content/<bookId>/manifest.json` (preload lúc
  //   boot) + tìm lesson khớp `lesson_id`. `hasAdvanced` = tìm thấy trong
  //   manifest không.
  //
  // Khai báo ở đây (trước `showContentSection`) vì `showContentSection` cần
  // tính `hasAdvanced` để KHÔNG ẩn cả vùng hub khi bài chỉ có nâng cao mà
  // không có PDF/bài tập cơ bản/tài liệu tham khảo.
  // -------------------------------------------------------------------------
  const { data: advancedCatalogLesson, isLoading: isAdvancedLessonLoading } =
    useCatalogBookLesson(
      routeBookCode,
      apiLessonId,
      true, // isAdvanced
      LOADER_ADVANCE_QUESTION_API, // enabled
    );
  // Nhánh JSON cũ — chỉ chạy khi flag tắt API.
  const [manifestReady, setManifestReady] = useState(
    () =>
      LOADER_ADVANCE_QUESTION_API
        ? true
        : getDigitizedManifest(
            catalogBook?.id != null ? String(catalogBook.id) : routeBookCode ?? "",
          ) !== null,
  );
  useEffect(() => {
    if (LOADER_ADVANCE_QUESTION_API || manifestReady) return;
    let cancelled = false;
    preloadDigitizedManifests().then(() => {
      if (!cancelled) setManifestReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [manifestReady]);
  const advancedManifest = useMemo(() => {
    if (LOADER_ADVANCE_QUESTION_API || !manifestReady) return null;
    const id = catalogBook?.id != null ? String(catalogBook.id) : routeBookCode;
    if (!id) return null;
    return getDigitizedManifest(id);
  }, [catalogBook?.id, routeBookCode, manifestReady]);
  // Tìm lesson nâng cao khớp với bài hiện tại — manifest dùng `lesson_id`
  // (vd "13001") trùng với `catalogLesson.lesson.id`.
  const advancedLesson = useMemo(() => {
    if (LOADER_ADVANCE_QUESTION_API || !advancedManifest || !catalogLesson) {
      return null;
    }
    const lessonId = String(catalogLesson.lesson.id);
    for (const ch of advancedManifest.chapters) {
      for (const lesson of ch.lessons) {
        if (lesson.lesson_id === lessonId) return lesson;
      }
    }
    return null;
  }, [advancedManifest, catalogLesson]);

  const hasAdvanced = LOADER_ADVANCE_QUESTION_API
    ? (advancedCatalogLesson?.lesson.lesson_items?.length ?? 0) > 0
    : advancedLesson != null;

  const showPdfSection = isLessonLoading || hasAnyPdf;
  const showContentSection =
    showPdfSection || hasExercise || hasReference || hasAdvanced;
  /**
   * MỘT state cho toàn bộ điều hướng trong bài (thay `contentTab` + `pdfViewMode`).
   *
   * `"hub"` là mặc định và KHÔNG có useEffect nào tự đổi nó: vào bài là thấy
   * menu, user bấm mới vào màn (Owner 03/8). Trước đây một useEffect tự chọn tab
   * theo dữ liệu nên bài có PDF là bị ném thẳng vào PDF.
   *
   * Gộp `pdfViewMode` vào đây luôn để mỗi mục menu ánh xạ đúng MỘT giá trị —
   * không còn cảnh một mục phải set hai state rồi lệch nhau.
   */
  const [activeView, setActiveView] = useState<LessonView>("hub");
  // Phải nằm SAU useState: `.find` gọi callback ngay, đọc `activeView` sớm hơn
  // là chạm TDZ (tsc không bắt vì biến nằm trong closure).
  const activeRefGroup = refGroups.find((g) => g.key === activeView);

  const isPdfView = activeView === "pdf-book" || activeView === "pdf-answer";
  // Chọn "Đáp án" mà bài chỉ có PDF vở (hoặc ngược lại) thì lùi về cái đang có.
  // Thay cho 2 useEffect đồng bộ pdfViewMode trước đây.
  const activePdfUrl =
    activeView === "pdf-answer" && hasAnswerPdf
      ? lessonAnswerPdfUrl
      : hasBookPdf
        ? lessonPdfUrl
        : lessonAnswerPdfUrl;
  const activePdfLabel =
    activeView === "pdf-answer" && hasAnswerPdf ? "Đáp án" : labels.pdfBookFull;
  const detailBookPath = safeInternalUrl(`${BOOK_DETAIL_BASE}${bookRouteCode}`);
  // Link công khai tới bài học để HS chia sẻ thành tích (người nhận mở được).
  const lessonShareUrl =
    typeof window !== "undefined" && bookRouteCode && routeLessonCode
      ? `${window.location.origin}${detailBookPath}/${routeLessonCode}`
      : undefined;

  /**
   * Toàn màn hình cho MỌI viewer, không riêng PDF.
   *
   * Cố tình làm bằng cách đổi class trên chính thẻ đang có, KHÔNG render một bản
   * sao trong overlay: runner nằm trong thẻ này và unmount nó giữa chừng là mất
   * `attemptId` cùng đáp án học sinh đang làm (xem ghi chú ở chỗ mount runner).
   */
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Esc để thoát — chế độ này che hết màn nên phải luôn có lối ra bằng bàn phím.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  // Về hub thì thoát luôn: hub là menu, không có gì để xem toàn màn hình.
  // Ngược lại, vào bài tập tương tác thì mở rộng LUÔN (Owner 8/8): làm bài cần
  // hết chỗ, không bắt học sinh bấm thêm nút "Mở rộng". Chỉ chạy khi ĐỔI view
  // nên trong lúc làm bài học sinh vẫn "Thu gọn" (hoặc Esc) được như thường.
  useEffect(() => {
    if (activeView === "hub") setIsFullscreen(false);
    else if (activeView === "exercise") setIsFullscreen(true);
  }, [activeView]);
  const [isBookIntroExpanded, setIsBookIntroExpanded] = useState(false);
  // Ẩn khu thông tin sách khi đang ở màn làm bài. DẪN XUẤT từ activeView, KHÔNG
  // để state riêng: runner mount-một-lần rồi chỉ bị ẩn khi Thoát (không unmount),
  // nên nếu chờ onStart của runner bật cờ thì lần VÀO LẠI sau sẽ không bật (onStart
  // chỉ chạy lúc mount) → thông tin sách không ẩn. Buộc theo view là hết desync.
  const isExerciseActive = activeView === "exercise";

  /**
   * Runner chỉ mount khi user thực sự vào làm bài, và sau đó KHÔNG unmount nữa
   * (chỉ bị ẩn). Unmount giữa chừng là mất `attemptId` + đáp án đang làm.
   */
  const [hasEnteredExercise, setHasEnteredExercise] = useState(false);
  const exerciseViewRef = useRef<HTMLDivElement>(null);
  /** Đổi giá trị = remount runner (mỗi lần mở lượt/màn mới: làm mới, làm lại, xem kết quả). */
  const [exerciseRunKey, setExerciseRunKey] = useState(0);
  const [exerciseStartMode, setExerciseStartMode] = useState<
    "new" | "resume" | "review"
  >("new");
  /**
   * Lượt vừa rồi đã làm xong chưa. Runner không unmount khi Thoát, nên nếu
   * không nhớ điều này thì bấm vào bài tập lần sau sẽ ra LẠI màn kết quả cũ
   * thay vì một lượt mới.
   */
  const [exerciseFinished, setExerciseFinished] = useState(false);
  /**
   * Số câu còn đáp án theo runner — LCMS bỏ qua lệnh xoá nên số của server đếm
   * dư ("Đã làm 2/5" khi thực tế 1). null = chưa vào runner ⇒ dùng số server.
   */
  const [liveAnsweredCount, setLiveAnsweredCount] = useState<number | null>(
    null,
  );

  // -------------------------------------------------------------------------
  // Bài tập nâng cao — `hasAdvanced` đã khai báo ở trên (cùng `showContentSection`).
  // State dialog runner/pass đặt ở đây vì cần gần các state dialog khác.
  // -------------------------------------------------------------------------
  const [isAdvancedPassOpen, setIsAdvancedPassOpen] = useState(false);
  const [isAdvancedRunnerOpen, setIsAdvancedRunnerOpen] = useState(false);

  useEffect(() => {
    setIsBookIntroExpanded(false);
    // Sang bài khác thì về hub và bỏ runner của bài cũ.
    setActiveView("hub");
    setHasEnteredExercise(false);
    setExerciseFinished(false);
    // Đóng dialog nâng cao khi đổi bài.
    setIsAdvancedPassOpen(false);
    setIsAdvancedRunnerOpen(false);
  }, [apiLessonId]);

  // Đổi bài tập trong cùng lesson (picker) KHÔNG chạy effect trên (apiLessonId
  // không đổi). Cờ "đã làm xong" gắn theo bài đang chọn, nên phải xoá riêng, kẻo
  // hub của bài mới hiện nhầm "Em đã làm xong". Không đụng view/runner để picker
  // vẫn đổi bài ngay trong màn bài tập.
  useEffect(() => {
    setExerciseFinished(false);
    setLiveAnsweredCount(null);
  }, [selectedExerciseId]);

  // MOBILE: khác desktop (2 cột cạnh nhau), ở đây card giới thiệu xếp CHỒNG LÊN
  // vùng nội dung nên ăn thẳng vào chiều cao đọc đề. Ở hub thì vẫn hiện (còn là
  // lối vào duy nhất tới thông tin sách trên mobile), vào màn nào thì ẩn.
  const hideBookIntroOnMobile = activeView !== "hub";

  /**
   * "Bài đang dở" cho hub. Trước đây runner tự hỏi ở màn intro của nó; giờ hub
   * phải biết TRƯỚC khi vào runner để chọn giữa "Làm bài tập" và "Tiếp tục".
   *
   * Best-effort giống hệt runner cũ: 404/500/mạng lỗi → coi như không có bài dở,
   * hub vẫn hiện "Làm bài tập". Không được để lỗi ở đây chặn đường vào bài.
   */
  const { data: pendingAttempt = null, refetch: refetchPendingAttempt } =
    useQuery({
      queryKey: ["current-attempt", selectedExerciseId, apiLessonId],
      queryFn: () =>
        getCurrentAttempt(selectedExerciseId as string, apiLessonId).catch(
          () => null,
        ),
      enabled: !isPreview && hasToken && !!selectedExerciseId,
      staleTime: 0,
    });

  /**
   * Lần nộp GẦN NHẤT của bài này (nếu có). Để hub mời "Xem kết quả lần trước"
   * khi bài đã nộp nhưng không còn lượt dở — vào lại / đăng nhập lại vẫn xem và
   * Chia sẻ được. Best-effort: lỗi lịch sử → coi như chưa từng nộp.
   */
  const { data: lastSubmission = null } = useQuery({
    queryKey: ["last-submission", selectedExerciseId],
    queryFn: async (): Promise<HistoryItem | null> => {
      const history = await listHistory({ limit: 20 }).catch(() => null);
      // max(submittedAt), KHÔNG phải dòng đầu khớp: phải cùng định nghĩa "gần
      // nhất" với lcmsGetSubmittedAttempt, lệch nhau thì review âm thầm rỗng.
      return (history?.items ?? [])
        .filter((item) => item.exerciseId === selectedExerciseId)
        .reduce<HistoryItem | null>(
          (latestSubmission, submission) =>
            latestSubmission === null ||
            new Date(submission.submittedAt).getTime() >
              new Date(latestSubmission.submittedAt).getTime()
              ? submission
              : latestSubmission,
          null,
        );
    },
    enabled: !isPreview && hasToken && !!selectedExerciseId,
    staleTime: 0,
  });

  /**
   * Mở runner ở một mode rồi chuyển sang view bài tập. `remount = true` → bump key để
   * runner mount lại (mở lượt/màn mới, xoá cờ "đã làm xong"); `false` → tái dùng runner
   * đang mount, giữ nguyên state lượt đang làm dở trong bộ nhớ.
   */
  const runExercise = (
    mode: "new" | "resume" | "review",
    shouldRemount: boolean,
  ) => {
    setExerciseStartMode(mode);
    if (shouldRemount) {
      setExerciseRunKey((n) => n + 1);
      setExerciseFinished(false);
      // Lượt mới ⇒ số của lượt cũ vô nghĩa; runner báo lại khi vào bài.
      setLiveAnsweredCount(null);
    }
    setHasEnteredExercise(true);
    setActiveView("exercise");
  };

  /**
   * Hành động bắt đầu/làm lại đang bị modal mật khẩu bài tập chặn — chạy tiếp
   * khi nhập đúng, bỏ khi đóng modal. Khác null cũng là cờ mở modal.
   */
  const [passGatedRun, setPassGatedRun] = useState<{
    mode: "new" | "resume" | "review";
    remount: boolean;
  } | null>(null);

  /** Cuốn sách được mở khoá khi nhập đúng mật khẩu — khoá nhớ theo mã sách. */
  const passBookKey = bookRouteCode ?? null;

  /**
   * Bài đang mở có bị khoá bài tập không. Gate chỉ chạy ở hệ LCMS và chỉ khi
   * VITE_EXERCISE_PASS được đặt (không có env thì bỏ qua hoàn toàn); trong đó
   * 1/2 số bài đầu sách vẫn làm tự do, các bài sau mới hỏi mật khẩu — xét theo
   * TỪNG BÀI chứ không khoá cả cuốn như bản đầu. Khoá áp cho cả khách lẫn học
   * sinh đã đăng nhập vì điểm gác nằm trước nhánh chọn runner.
   */
  const isExerciseLocked = isLessonExerciseLocked({
    passConfigured: IS_LCMS && getExercisePass() !== null && !!passBookKey,
    bookUnlocked: hasEnteredExercisePass(passBookKey),
    lessonIndex: currentLessonIdx,
    totalLessons: orderedLessons.length,
  });

  // DEBUG: tạm thời in ra để xem tại sao khoá không hoạt động
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[DEBUG lock]", {
      IS_LCMS,
      pass: getExercisePass(),
      passBookKey,
      hasEntered: hasEnteredExercisePass(passBookKey),
      currentLessonIdx,
      orderedLessonsLength: orderedLessons.length,
      isExerciseLocked,
      catalogLessonId: catalogLesson?.lesson.id,
      catalogLessonIndex: catalogLesson?.lesson.index,
      firstOrderedLesson: orderedLessons[0],
    });
  }

  /**
   * Một điểm gác duy nhất cho mọi lối vào bài tập ("Làm bài tập" / "Làm bài
   * mới" / "Làm lại từ đầu"): bài ngoài hạn mức làm thử phải nhập mật khẩu
   * trước khi mở LƯỢT MỚI. "resume"/"review" không phải lượt mới nên đi thẳng —
   * lượt đang dở và kết quả đã nộp là bài làm của chính học sinh.
   */
  const openRunner = (
    mode: "new" | "resume" | "review",
    shouldRemount: boolean,
  ) => {
    if (mode === "new" && isExerciseLocked) {
      setPassGatedRun({ mode, remount: shouldRemount });
      return;
    }
    runExercise(mode, shouldRemount);
  };

  /**
   * "Làm bài tập" / "Làm bài mới": "new" luôn là lượt làm mới nên remount để không kẹt
   * ở màn kết quả runner đang đậu (vừa làm xong, hoặc vừa xem kết quả lần trước) — trừ
   * lần đầu chưa mount. "resume" ("Tiếp tục làm bài") KHÔNG remount để giữ đáp án dở.
   */
  const enterExercise = (mode: "new" | "resume") =>
    openRunner(mode, mode === "new" && hasEnteredExercise);

  /** "Làm lại từ đầu": luôn remount để mở lượt mới, bỏ lượt dở. */
  const restartExercise = () => openRunner("new", true);

  /** "Xem kết quả lần trước": remount ở chế độ review → mở màn kết quả. */
  const viewLastResult = () => openRunner("review", true);

  // "Thoát" từ mọi màn → về hub. Rời bài tập thì hỏi lại "bài đang dở" để hub
  // hiện đúng "Tiếp tục" (bài đã tự lưu trong lúc làm).
  // Rời màn bài tập là phải dừng media: runner chỉ bị ẩn chứ không unmount nên
  // ghi âm bài đọc (và audio của chính player) vẫn tiếp tục phát sau lưng.
  useEffect(() => {
    if (activeView !== "exercise") pauseMediaIn(exerciseViewRef.current);
  }, [activeView]);

  const backToHub = () => {
    setActiveView("hub");
    if (!isPreview && hasToken && selectedExerciseId) {
      void refetchPendingAttempt();
    }
  };

  const totalQuestionCount =
    studentExercises.find((ex) => ex.id === selectedExerciseId)
      ?.totalQuestions ?? allQuestions.length;

  const hubItems: LessonHubItem[] = [];
  if (hasBookPdf) {
    hubItems.push({
      key: "pdf-book",
      label: labels.pdfBook,
      icon: FileText,
      onSelect: () => setActiveView("pdf-book"),
    });
  }
  if (hasAnswerPdf) {
    hubItems.push({
      key: "pdf-answer",
      label: "Đáp án",
      icon: FileText,
      onSelect: () => setActiveView("pdf-answer"),
    });
  }
  for (const group of refGroups) {
    hubItems.push({
      key: group.key,
      label: group.label,
      icon: Library,
      onSelect: () => setActiveView(group.key),
    });
  }
  if (hasExercise) {
    // Xét hasToken ngay tại chỗ dựng item: cache của phiên cũ còn sống trong
    // gcTime, không chặn thì khách được mời "Tiếp tục làm bài" rồi bấm vào vỡ.
    const hubState = resolveExerciseHubState({
      hasToken,
      hasPendingAttempt: pendingAttempt != null,
      finishedThisSession: exerciseFinished,
      hasLastSubmission: lastSubmission != null,
    });
    if (hubState === "resume" && pendingAttempt) {
      hubItems.push({
        key: "exercise-resume",
        label: "Tiếp tục làm bài",
        // Chỉ đếm câu THỰC SỰ còn đáp án ("Làm lại" xoá đáp án). Ưu tiên số của
        // runner: attempt server trả về vẫn còn câu vừa xoá.
        description: `Đã làm ${liveAnsweredCount ?? pendingAttempt.answers.filter((savedAnswer) => !isAnswerEmpty(savedAnswer.answer)).length}/${totalQuestionCount} câu`,
        icon: RotateCw,
        variant: "primary",
        onSelect: () => enterExercise("resume"),
      });
      hubItems.push({
        key: "exercise-restart",
        label: "Làm lại từ đầu",
        icon: PlayCircle,
        onSelect: restartExercise,
      });
    } else if (hubState === "finished") {
      // Vừa làm xong: mời "Làm bài tập" nữa thì vô nghĩa, và bấm vào sẽ ra lại
      // màn kết quả. Nói thẳng đây là làm lượt mới.
      hubItems.push({
        key: "exercise-restart",
        label: "Làm lại từ đầu",
        description: "Em đã làm xong bài này",
        icon: RotateCw,
        variant: "primary",
        onSelect: restartExercise,
      });
    } else if (hubState === "review") {
      // Đã nộp ở phiên trước, không còn lượt dở → mời xem/chia sẻ lại kết quả
      // gần nhất, kèm lối làm lượt mới.
      hubItems.push({
        key: "exercise-review",
        label: "Xem kết quả lần trước",
        icon: Trophy,
        variant: "primary",
        onSelect: viewLastResult,
      });
      hubItems.push({
        key: "exercise",
        label: "Làm bài mới",
        icon: PlayCircle,
        onSelect: () => enterExercise("new"),
      });
    } else {
      hubItems.push({
        key: "exercise",
        label: "Làm bài tập",
        description: totalQuestionCount
          ? `${totalQuestionCount} câu hỏi`
          : undefined,
        icon: PlayCircle,
        variant: "primary",
        onSelect: () => enterExercise("new"),
      });
    }
  }
  if (hasToken && hasExercise && selectedExerciseId) {
    hubItems.push({
      key: "history",
      label: "Lịch sử làm bài",
      icon: History,
      onSelect: () => setActiveView("history"),
    });
  }
  // Bài tập nâng cao — chỉ hiện khi API `?is_advanced=true` trả về câu hỏi.
  if (hasAdvanced) {
    hubItems.push({
      key: "advanced-exercise",
      label: "Làm bài tập nâng cao",
      icon: Sparkles,
      onSelect: () => setIsAdvancedPassOpen(true),
    });
  }

  // Mất phần PDF thì thoát toàn màn hình — tránh kẹt ở màn che kín mà bên dưới
  // không còn gì để xem.
  useEffect(() => {
    if (!showPdfSection) setIsFullscreen(false);
  }, [showPdfSection]);

  const isPageLoading = isPreview
    ? isPreviewLessonLoading
    : isCatalogBookLoading ||
      (!!apiLessonId &&
        (isLessonLoading ||
          // Chờ CẢ 2 API (basic + advanced) chạy xong song song rồi mới render
          // hub — tránh flash: nút "Làm bài tập nâng cao" hiện sau khi hub đã
          // hiện, gây cảm giác giật. Khi flag tắt thì advanced không chạy nên
          // không cộng vào loading.
          (LOADER_ADVANCE_QUESTION_API && isAdvancedLessonLoading)));
  const isPageError =
    !isPageLoading &&
    (isPreview
      ? isPreviewLessonError || !previewLessonData
      : !routeBookCode || !apiLessonId || isLessonError || !catalogLesson);

  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RotateCw className="size-10 animate-spin text-primary mx-auto" />
          <p className="text-sm font-semibold text-slate-500">
            Đang tải bài học...
          </p>
        </div>
      </div>
    );
  }

  if (isPageError) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm mx-auto px-6">
          <div className="text-4xl">📖</div>
          <h2 className="font-display text-xl font-bold text-slate-800">
            Không tìm thấy bài học
          </h2>
          <p className="text-sm text-slate-500">
            Bài học bạn tìm kiếm không tồn tại hoặc chưa có trong hệ thống.
          </p>
          {embed ? null : (
            <Link
              to={HOME_PATH}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-soft hover:opacity-90 transition-all"
            >
              {/* Nút này đi về TRANG CHỦ (HOME_PATH), không "quay lại" trang
                  trước — gọi đúng đích như BookDetailPage đang dùng. */}
              <ArrowLeft className="size-4" /> Về trang chủ
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100svh] flex flex-col bg-gradient-to-b from-primary/5 via-background to-info/5 overflow-hidden">
      {/* Embed mode (native WebView host) drops the app chrome — the header,
          account menu and lesson nav are provided by the native shell. */}
      {!embed && isPreviewRoute && (
        <PreviewBanner enabled={previewEnabled} onToggle={setPreviewEnabled} />
      )}
      {!embed && (
        <header className="border-b border-border/60 bg-card/85 backdrop-blur sticky top-0 z-40 h-16 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">
            <Link
              to={detailBookPath}
              // Nhãn "Quay lại sách" đã bỏ khỏi chữ hiện ra (Owner 31/7): mũi tên
              // đã nói đủ nghĩa quay lại. Giữ ở aria-label cho người dùng đọc màn hình.
              aria-label={`Quay lại sách ${displayInfo.bookName}`}
              className="shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 -ml-2 text-sm md:text-base font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            >
              {/* Dùng đúng TÊN SÁCH (book.title qua displayInfo.bookName), không
                  dựng lại "công thức" môn/lớp. */}
              <ArrowLeft className="size-4" /> {displayInfo.bookName}
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              {orderedLessons.length > 0 ? (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() =>
                      prevLesson && navigate(buildLessonPath(prevLesson))
                    }
                    disabled={!prevLesson}
                    title={
                      prevLesson
                        ? `${prevLesson.label ?? prevLesson.title}`
                        : undefined
                    }
                    className={ghostIconBtn}
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    onClick={() =>
                      nextLesson && navigate(buildLessonPath(nextLesson))
                    }
                    disabled={!nextLesson}
                    title={
                      nextLesson
                        ? `${nextLesson.label ?? nextLesson.title}`
                        : undefined
                    }
                    className={ghostIconBtn}
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              ) : (
                <span className="text-xs md:text-sm font-bold px-3 py-1 rounded-full bg-primary/10 text-primary">
                  {displayInfo.bookName}
                </span>
              )}
              <UserHeaderMenu />
            </div>
          </div>
        </header>
      )}

      <main className="max-w-7xl mx-auto w-full px-4 pt-4 flex-1 flex flex-col min-h-0 overflow-hidden gap-3 pb-4">
        <div
          className={`flex-1 min-h-0 lg:h-full flex flex-col lg:flex-row gap-3 max-lg:items-start lg:items-stretch overflow-y-auto lg:overflow-hidden min-w-0 w-full transition-all duration-500 ease-in-out ${
            showContentSection && isExerciseActive ? "lg:gap-0" : "lg:gap-6"
          }`}
        >
          <div
            className={`${
              showContentSection
                ? "lg:flex-shrink-0"
                : "max-w-3xl mx-auto w-full"
            } max-lg:self-start w-full lg:min-h-0 lg:h-full overflow-hidden flex flex-col min-w-0 rounded-3xl transition-all duration-500 ease-in-out ${
              showContentSection
                ? isExerciseActive
                  ? "lg:w-0 lg:opacity-0"
                  : "lg:w-[33%] lg:opacity-100"
                : ""
            } ${hideBookIntroOnMobile ? "max-lg:hidden" : ""}`}
          >
            <Card
              className={`border border-border/60 rounded-3xl bg-card shadow-soft flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden ${
                isBookIntroExpanded ? "p-4 md:p-5" : "p-3 lg:p-5"
              }`}
            >
              {!isBookIntroExpanded ? (
                <div className="lg:hidden flex items-center justify-between gap-3">
                  <h1 className="font-display font-extrabold text-lg text-lesson-title leading-tight min-w-0">
                    <LessonTitleText title={displayInfo.title} />
                  </h1>
                  <button
                    type="button"
                    onClick={() => setIsBookIntroExpanded(true)}
                    className="shrink-0 inline-flex items-center justify-center size-8 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
                    aria-expanded={false}
                    aria-label="Mở rộng"
                    title="Mở rộng"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              ) : null}

              <div
                className={`flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden ${
                  isBookIntroExpanded ? "" : "hidden lg:flex"
                }`}
              >
                {isBookIntroExpanded ? (
                  <div className="lg:hidden flex justify-end mb-3">
                    <button
                      type="button"
                      onClick={() => setIsBookIntroExpanded(false)}
                      className="inline-flex items-center justify-center size-8 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
                      aria-expanded
                      aria-label="Thu gọn"
                      title="Thu gọn"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                  </div>
                ) : null}

                <div className="flex-shrink-0 relative mx-auto w-full max-w-[130px]">
                  <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 to-fun/20 blur-xl" />
                  <div className="rounded-xl border border-border/60 overflow-hidden shadow-card">
                    {coverImageSrc ? (
                      <img
                        src={coverImageSrc}
                        alt={displayInfo.bookName}
                        className="w-full h-auto block"
                      />
                    ) : (
                      <div className="aspect-[3/4] w-full flex items-center justify-center bg-muted text-muted-foreground">
                        <BookOpen className="size-10 opacity-50" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto border-t border-border/60 mt-4 pt-3 space-y-4">
                  <div className="text-center lg:text-left space-y-1.5">
                    {displayInfo.topicName ? (
                      <span className="text-xs font-black text-primary uppercase tracking-wider block">
                        <LessonTitleText title={displayInfo.topicName} />
                      </span>
                    ) : null}
                    <h1 className="font-display font-extrabold text-xl md:text-2xl text-lesson-title leading-tight">
                      <LessonTitleText title={displayInfo.title} />
                    </h1>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Tài liệu học tập số tích hợp đa tương tác bám sát nội dung
                      Sách Giáo Khoa chuẩn của Bộ Giáo dục và Đào tạo.
                    </p>
                  </div>

                  <div className="space-y-2 border-t border-border/60 pt-3 text-xs sm:text-sm font-medium">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground font-medium">
                        Khối lớp:
                      </span>
                      <span className="font-bold text-foreground">
                        Lớp {displayInfo.level}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground font-medium">
                        Môn học:
                      </span>
                      <span className="font-bold text-foreground">
                        {displayInfo.subjectName}
                      </span>
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-muted-foreground font-medium shrink-0">
                        Nhóm tác giả:
                      </span>
                      <span className="font-bold text-foreground text-right leading-tight max-w-[200px] text-xs sm:text-sm">
                        {displayInfo.authors}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground font-medium">
                        Nhà xuất bản:
                      </span>
                      <span className="font-bold text-primary">
                        {displayInfo.publisher}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {showContentSection ? (
            <div
              className={
                isFullscreen
                  ? "fixed inset-0 z-50 flex flex-col p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in"
                  : "flex-1 flex flex-col gap-4 min-h-0 min-w-0 w-full lg:h-full lg:overflow-hidden rounded-3xl"
              }
            >
              <Card className="border border-border/60 rounded-3xl bg-card shadow-soft overflow-hidden flex flex-col animate-pop-in flex-1 min-h-0 min-w-0 w-full">
                {/* Thanh Thoát: mọi màn không-hub đều có, theo đúng mẫu nút
                    "✕ Thoát" của runner. Runner tự có thanh riêng nên bỏ qua. */}
                {activeView !== "hub" && activeView !== "exercise" ? (
                  <div className="bg-muted/30 border-b border-border/60 px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                      {activeRefGroup
                        ? activeRefGroup.label
                        : activeView === "history"
                          ? "Lịch sử làm bài"
                          : activePdfLabel}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Đổi Vở ⇄ Đáp án ngay tại thanh này. Trước đây dải tab
                          chỉ có trong overlay toàn màn hình, nên ở chế độ thường
                          muốn đổi phải quay về hub. */}
                      {isPdfView && hasBookPdf && hasAnswerPdf ? (
                        <PdfViewTabs
                          mode={activeView === "pdf-answer" ? "answer" : "book"}
                          onChange={(mode) =>
                            setActiveView(mode === "answer" ? "pdf-answer" : "pdf-book")
                          }
                          hasBook={hasBookPdf}
                          hasAnswer={hasAnswerPdf}
                          bookLabel={labels.pdfBookFull}
                        />
                      ) : null}
                      <FullscreenToggle
                        active={isFullscreen}
                        onToggle={() => setIsFullscreen((v) => !v)}
                      />
                      <button
                        type="button"
                        onClick={backToHub}
                        className={ghostTextBtn}
                      >
                        <X className="size-3.5" />
                        Thoát
                      </button>
                    </div>
                  </div>
                ) : null}

                {activeView === "hub" ? (
                  isPageLoading ? (
                    <div className="flex flex-1 items-center justify-center text-muted-foreground">
                      <RotateCw className="size-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <LessonHub
                      lessonTitle={displayInfo.title}
                      lessonNumber={lessonNumber}
                      showLessonNumber={labels.showLessonNumber}
                      items={hubItems}
                      isGuest={!hasToken && !isPreview && !embed}
                      onLoginClick={() => setLoginOpen(true)}
                    />
                  )
                ) : null}

                {/* Runner CHỈ mount khi user thực sự vào làm bài, và sau đó không
                    unmount nữa (chỉ ẩn): unmount giữa chừng là mất attemptId +
                    đáp án đang làm. */}
                {hasEnteredExercise ? (
                  <SkinProvider skin={playerSkin}>
                    <div
                      ref={exerciseViewRef}
                      className={`flex-1 min-h-0 min-w-0 flex flex-col bg-card overflow-hidden ${
                        activeView === "exercise" ? "" : "hidden"
                      }`}
                    >
                      {hasToken && selectedExerciseId ? (
                        <div className="flex flex-col h-full min-h-0">
                          {studentExercises.length > 1 && (
                            <div className="flex-shrink-0 px-4 pt-3 pb-1 flex gap-2 flex-wrap border-b border-border/40">
                              {studentExercises.map((ex) => (
                                <button
                                  key={ex.id}
                                  type="button"
                                  onClick={() => setSelectedExerciseId(ex.id)}
                                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                                    selectedExerciseId === ex.id
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                                  }`}
                                >
                                  <LessonTitleText title={ex.title} />
                                </button>
                              ))}
                            </div>
                          )}
                          <SubmissionRunner
                            key={`${selectedExerciseId}:${exerciseRunKey}`}
                            exerciseId={selectedExerciseId}
                            lessonId={apiLessonId}
                            // Góp ý 2026-08: chấm ngay từng thao tác khiến HS kéo
                            // thử tới khi đúng — verdict chỉ hiện sau khi Nộp bài.
                            marking="silent"
                            startMode={exerciseStartMode}
                            reviewSubmissionId={lastSubmission?.submissionId}
                            reviewGradingStatus={lastSubmission?.gradingStatus}
                            lessonTitle={selectedExerciseTitle || displayInfo.title}
                            questionLabelById={questionLabelById}
                            readingAudioUrl={readingAudioUrl}
                            shareUrl={lessonShareUrl}
                            headerAction={
                              <FullscreenToggle
                                active={isFullscreen}
                                onToggle={() => setIsFullscreen((v) => !v)}
                                variant="compact"
                              />
                            }
                            onExit={backToHub}
                            onAnsweredCountChange={setLiveAnsweredCount}
                            onFinish={() => setExerciseFinished(true)}
                            onSessionExpired={() => {
                              // Embed: KHÔNG navigate — sẽ đẩy user ra khỏi
                              // trang nhúng. Để runner tự xử lý (thường là mở
                              // dialog đăng nhập lại).
                              if (!embed) navigate(detailBookPath);
                            }}
                          />
                        </div>
                      ) : allQuestions.length > 0 ? (
                        <StandaloneExerciseRunner
                          key={exerciseRunKey}
                          lessonTitle={displayInfo.title}
                          headerAction={
                            <FullscreenToggle
                              active={isFullscreen}
                              onToggle={() => setIsFullscreen((v) => !v)}
                              variant="compact"
                            />
                          }
                          onExit={backToHub}
                          onFinish={() => setExerciseFinished(true)}
                          questionLabelById={questionLabelById}
                          readingAudioUrl={readingAudioUrl}
                          questions={allQuestions.map((q) => ({
                            id: q.id,
                            question_type: q.question_type,
                            payload: q.payload,
                          }))}
                        />
                      ) : isStudentExercisesLoading ? (
                        <div className="flex flex-1 items-center justify-center text-muted-foreground">
                          <RotateCw className="size-8 animate-spin text-primary" />
                        </div>
                      ) : (
                        <ExerciseEmptyState onClose={backToHub} />
                      )}
                    </div>
                  </SkinProvider>
                ) : null}

                {isPdfView && (
                  <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-slate-100 relative overflow-hidden">
                    {isLessonLoading ? (
                      <div className="flex flex-1 items-center justify-center text-muted-foreground">
                        <RotateCw className="size-8 animate-spin text-primary" />
                      </div>
                    ) : activePdfUrl ? (
                      <LessonPdfViewer
                        url={activePdfUrl}
                        title={`${activePdfLabel} — ${plainTextFromHtml(displayInfo.title)}`}
                      />
                    ) : null}
                  </div>
                )}
                {activeRefGroup && (
                  <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-muted/20 overflow-hidden">
                    <LessonReferenceMedia
                      items={activeRefGroup.items}
                      hideItemTitle={isTapViet}
                    />
                  </div>
                )}
                {activeView === "history" && selectedExerciseId && (
                  // Cùng skin với runner: xem lại bài mà hiển thị khác lúc làm
                  // bài thì học sinh tưởng là hai câu khác nhau.
                  <SkinProvider skin={playerSkin}>
                    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6">
                      <InlineHistory
                        exerciseId={selectedExerciseId}
                        showHeader={false}
                      />
                    </div>
                  </SkinProvider>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      </main>

      <StudentLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      {/* Gate mật khẩu bài tập: đóng modal khi chưa nhập đúng = hành động bị hủy. */}
      {passBookKey && (
        <ExercisePassDialog
          open={passGatedRun !== null}
          bookKey={passBookKey}
          onOpenChange={(open) => {
            if (!open) setPassGatedRun(null);
          }}
          onVerified={() => {
            if (passGatedRun)
              runExercise(passGatedRun.mode, passGatedRun.remount);
            setPassGatedRun(null);
          }}
        />
      )}
      {/* Dialog nhập mật khẩu bài tập nâng cao — mở khi user click nút "Làm
          bài tập nâng cao" trên hub. Nhập đúng → đóng pass dialog, mở runner. */}
      <DigitizedExercisePassDialog
        open={isAdvancedPassOpen}
        onOpenChange={setIsAdvancedPassOpen}
        onVerified={() => {
          setIsAdvancedPassOpen(false);
          setIsAdvancedRunnerOpen(true);
        }}
      />
      {/* Dialog runner bài tập nâng cao — mở sau khi nhập đúng pass. skipPass
          vì pass đã xác thực ở dialog trên. Chọn nguồn dữ liệu theo
          `LOADER_ADVANCE_QUESTION_API`:
          - true  → AdvancedExerciseDialog (API `?is_advanced=true`).
          - false → DigitizedExerciseDialog (content.json cũ). */}
      {LOADER_ADVANCE_QUESTION_API ? (
        advancedCatalogLesson ? (
          <AdvancedExerciseDialog
            open={isAdvancedRunnerOpen}
            onOpenChange={setIsAdvancedRunnerOpen}
            bookCode={String(catalogBook?.id ?? routeBookCode ?? "")}
            lessonCode={apiLessonId ?? ""}
            // Truyền data đã fetch sẵn (xem useCatalogBookLesson ở trên) để
            // dialog KHÔNG gọi lại API `?is_advanced=true` — staleTime: 0 của
            // hook khiến mỗi lần mount là 1 call mới dù cache còn nóng.
            lessonData={advancedCatalogLesson}
            skipPass
          />
        ) : null
      ) : advancedLesson ? (
        <DigitizedExerciseDialog
          open={isAdvancedRunnerOpen}
          onOpenChange={setIsAdvancedRunnerOpen}
          bookCode={String(catalogBook?.id ?? routeBookCode ?? "")}
          lessonCode={advancedLesson.id}
          skipPass
        />
      ) : null}
    </div>
  );
}
