import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Card } from "@/core/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import {
  ArrowLeft,
  BookOpen,
  PlayCircle,
  ChevronRight,
  Users,
  Hash,
  Ruler,
  Calculator,
  Compass,
  Star,
  Eye,
  Sparkles,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  useCatalogBook,
} from "@/modules/catalog/hooks/useCatalog";
import { getPreviewBook } from "@/modules/books/api/previewApi";
import { useAccessToken } from "@/core/auth/AuthContext";
import { UserHeaderMenu } from "@/modules/books/ui/shared/UserHeaderMenu";
import { PreviewBanner } from "@/modules/books/ui/shared/PreviewBanner";
import { getSubjectDisplay } from "@/core/reference";
import { safeInternalUrl } from "@/core/lib/security";
import { numberToVietnameseWords } from "@/core/lib/numberWords";
import { lessonNumbersById } from "@/modules/books/ui/shared/lessonNumbering";
import {
  isTapVietSubject,
  lessonLabels,
  topicPrefix,
} from "@/modules/books/ui/shared/lessonLabels";
import { LessonTitleText } from "@/modules/books/ui/shared/LessonTitleText";
import { getDigitizedManifest, preloadDigitizedManifests } from "@/modules/digitized-content/api/loader";
import { DigitizedExerciseDialog } from "@/modules/digitized-content/ui/DigitizedExerciseDialog";
import { DigitizedExercisePassDialog } from "@/modules/digitized-content/ui/DigitizedExercisePassDialog";
import { AdvancedLessonList } from "@/modules/digitized-content/ui/AdvancedLessonList";
import { AdvancedLessonListApi } from "@/modules/books/ui/shared/AdvancedLessonListApi";
import { AdvancedExerciseDialog } from "@/modules/books/ui/shared/AdvancedExerciseDialog";
import { getLoaderAdvanceQuestionApi } from "@/core/api/config";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import type { BookChapter } from "@/modules/catalog/api/types";

// Cờ chuyển nguồn dữ liệu bài tập nâng cao:
// - true  → dùng API `chapterAdvanced` (luồng mới).
// - false → đọc `public/digitized-content/<bookId>/manifest.json` (luồng cũ).
// Dùng khi API chưa sẵn sàng ở một số môi trường: set
// `VITE_LOADER_ADVANCE_QUESTION_API=0` để rơi về JSON tĩnh mà không cần revert.
const LOADER_ADVANCE_QUESTION_API = getLoaderAdvanceQuestionApi();

// ---------------------------------------------------------------------------
// Convert API BookChapter[] → GroupedTopic[] for the rendering code
// ---------------------------------------------------------------------------
interface GroupedTopic {
  id: number;
  title: string;
  lessons: { id: string | number; code: string | null; title: string; slug: string }[];
}

function mapChaptersToTopics(chapters: BookChapter[]): GroupedTopic[] {
  return chapters.map((ch) => ({
    id: ch.index,
    title: ch.title,
    lessons: ch.lessons.map((l) => ({
      id: l.id,
      code: l.code,
      title: l.title,
      slug: l.slug,
    })),
  }));
}

const TOPIC_COLORS = [
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-purple-500 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 via-teal-500 to-emerald-600",
  "from-indigo-500 to-violet-600",
];

const TOPIC_INDEX_THEMES = [
  {
    bg: "bg-sky-50 text-sky-600",
    hover: "group-hover/item:bg-sky-100 group-hover/item:text-sky-700",
  },
  {
    bg: "bg-emerald-50 text-emerald-600",
    hover: "group-hover/item:bg-emerald-100 group-hover/item:text-emerald-700",
  },
  {
    bg: "bg-purple-50 text-purple-600",
    hover: "group-hover/item:bg-purple-100 group-hover/item:text-purple-700",
  },
  {
    bg: "bg-amber-50 text-amber-600",
    hover: "group-hover/item:bg-amber-100 group-hover/item:text-amber-700",
  },
  {
    bg: "bg-pink-50 text-pink-600",
    hover: "group-hover/item:bg-pink-100 group-hover/item:text-pink-700",
  },
  {
    bg: "bg-cyan-50 text-cyan-600",
    hover: "group-hover/item:bg-cyan-100 group-hover/item:text-cyan-700",
  },
  {
    bg: "bg-indigo-50 text-indigo-600",
    hover: "group-hover/item:bg-indigo-100 group-hover/item:text-indigo-700",
  },
];

const TOPIC_ICONS = [Hash, Ruler, Calculator, Compass, Star];

// CTA điều hướng vào bài học; nếu sách chưa có bài học thì báo lỗi thay vì đi "/".
function LessonCta({
  hasLessons,
  href,
  onEmpty,
  className,
  children,
}: {
  hasLessons: boolean;
  href: string;
  onEmpty: () => void;
  className: string;
  children: ReactNode;
}) {
  return hasLessons ? (
    <Link to={href} className={className}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onEmpty} className={className}>
      {children}
    </button>
  );
}

export function BookDetailPage() {


  const { bookCode } = useParams<{ bookCode: string }>();

  // Embed mặc định được PHÁT HIỆN TỰ ĐỘNG: khi trang được nhúng vào web khác
  // (iframe/WebView), không cần đổi route hay thêm query param — app nhúng chỉ
  // việc nhúng URL gốc. Header, nút "Về trang chủ" ở màn lỗi và footer CTA đều
  // bị ẩn để người dùng không thoát khỏi trang nhúng.
  // try/catch vì iframe sandboxed (không có allow-same-origin) ném SecurityError
  // khi đụng `window.top` — coi như đang bị nhúng.
  const embed = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  // Preview mode: a normalized UUID book (admin viewing unpublished content).
  const isPreviewRoute = !!bookCode && UUID_RE.test(bookCode);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const isPreview = isPreviewRoute && previewEnabled;
  const { data: previewBook, isLoading: isPreviewLoading } = useQuery({
    queryKey: ["preview-book", bookCode],
    queryFn: () => getPreviewBook(bookCode!),
    enabled: isPreview && !!bookCode,
  });

  // Fetch full book detail from catalog API directly by code (or numeric id)
  const { data: book, isLoading, isError } = useCatalogBook(
    !isPreview ? bookCode : undefined,
  );
  const bookRouteCode = book?.code ?? bookCode;

  // Derive display data from whichever source is active.
  const level = isPreview
    ? String(previewBook?.level ?? "")
    : (book?.level ?? "");
  const tap = book?.tap ?? null;
  const coverUrl = isPreview ? (previewBook?.cover_url ?? "") : (book?.cover_url ?? "");
  const authorsList = isPreview
    ? (previewBook?.authors?.join(" - ") ?? "")
    : (book?.authors?.join(" - ") ?? "");
  const publisher = isPreview
    ? (previewBook?.publisher ?? "Nhà xuất bản Giáo dục Việt Nam")
    : (book?.publisher ?? "Nhà xuất bản Giáo dục Việt Nam");
  const bookTitle = (isPreview ? previewBook?.title : book?.title) ?? "";

  const { label: catalogSubjectName, keywordColor } = useMemo(
    () => getSubjectDisplay(book?.subject_code ?? "", book?.subject_name),
    [book?.subject_code, book?.subject_name],
  );
  const subjectName = isPreview
    ? (previewBook?.subject_name ?? "")
    : catalogSubjectName;

  // Tiêu đề hiển thị đúng TÊN SÁCH (book.title) theo data — không dựng lại từ môn
  // học/lớp, không tách/định dạng "thông minh".
  const displayTitle = bookTitle.trim();

  // Sách nâng cao tự số hóa: nếu có folder public/digitized-content/<bookId>/
  // (vd: "public/digitized-content/57/"), section CTA cuối trang sẽ hiện danh
  // sách bài nâng cao thay vì dialog "đang cập nhật".
  // Lookup theo book.id (numeric) trước, fallback bookCode từ URL (có thể là slug).
  // Manifest được preload ở app boot (main.tsx) — nếu user vào thẳng URL sách
  // tự số hóa trước khi preload xong, đợi ở đây rồi re-render.
  const [manifestReady, setManifestReady] = useState(
    () => getDigitizedManifest(book?.id != null ? String(book.id) : bookCode ?? "") !== null,
  );
  useEffect(() => {
    if (manifestReady) return;
    let cancelled = false;
    preloadDigitizedManifests().then(() => {
      if (!cancelled) setManifestReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [manifestReady]);
  const advancedManifest = useMemo(() => {
    if (!manifestReady) return null;
    const id = book?.id != null ? String(book.id) : bookCode;
    if (!id) return null;
    return getDigitizedManifest(id);
  }, [book?.id, bookCode, manifestReady]);

  // Nguồn API: `chapterAdvanced` từ `useCatalogBook` (cùng shape với `chapters`,
  // chapter nào chưa có bài nâng cao sẽ bị API loại bỏ). Chỉ dùng khi flag bật.
  const advancedChapters = useMemo<BookChapter[]>(() => {
    if (!LOADER_ADVANCE_QUESTION_API) return [];
    return book?.chapterAdvanced ?? [];
  }, [book?.chapterAdvanced]);

  // Sách có nội dung nâng cao (gộp cả 2 nguồn) — dùng cho CTA click handler
  // và điều kiện render danh sách bài.
  const hasAdvancedContent = LOADER_ADVANCE_QUESTION_API
    ? advancedChapters.length > 0
    : advancedManifest != null;

  const topics: GroupedTopic[] = useMemo(() => {
    if (isPreview) {
      return (previewBook?.chapters ?? []).map((ch, i) => ({
        id: i + 1,
        title: ch.title,
        lessons: ch.lessons.map((l) => ({
          id: l.id,
          code: null,
          title: l.title,
          slug: l.slug,
        })),
      }));
    }
    return book?.chapters ? mapChaptersToTopics(book.chapters) : [];
  }, [isPreview, previewBook, book?.chapters]);

  const totalLessons = topics.reduce((s, t) => s + t.lessons.length, 0);
  // Số "Bài N" trên mỗi hàng — màn bài học tra lại đúng bảng này để hai chỗ
  // không lệch số.
  const lessonNumbers = useMemo(() => lessonNumbersById(topics), [topics]);

  // Môn của quyển đang mở, dùng cho mọi nhãn phụ thuộc môn bên dưới. Luồng
  // preview của admin không trả `subject_code` nên phải ngả sang tên môn.
  const subjectRef = {
    code: book?.subject_code,
    name: book?.subject_name ?? previewBook?.subject_name,
  };

  // Môn Tập viết tắt nhãn "Bài N" ở cả mục lục lẫn màn bài học.
  const { showLessonNumber } = lessonLabels(isTapVietSubject(subjectRef));

  // Nhãn nhóm bài trên mục lục: "Chủ đề N" với môn chia theo chủ đề, còn lại "Tuần N".
  const topicLabel = topicPrefix(subjectRef);

  // Phụ đề phải khớp nhãn ngay bên dưới: bài ôn tập theo kì không mang số nên
  // cũng không được tính vào "N bài học". `totalLessons` giữ nguyên đếm thô vì
  // `hasLessons` dùng nó để quyết định sách có bài hay không.
  const numberedLessonCount = useMemo(
    () => Object.keys(lessonNumbers).length,
    [lessonNumbers],
  );

  const lessonHref = (lesson: GroupedTopic["lessons"][number]) =>
    safeInternalUrl(
      isPreview
        ? `/sach-bai-tap/${bookCode}/${lesson.id}`
        : `/sach-bai-tap/${bookRouteCode}/${lesson.code ?? lesson.id}`,
    );

  // Routing: first lesson link for CTA buttons
  const firstLessonHref = useMemo(() => {
    const firstLesson = topics[0]?.lessons[0];
    if (firstLesson && (isPreview || book?.id))
      return lessonHref(firstLesson);
    return "/";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, topics, isPreview, bookCode]);

  // Sách chưa có bài học: CTA không được điều hướng về "/", thay vào đó báo lỗi.
  const hasLessons = totalLessons > 0;
  const notifyNoLesson = () => toast.error("Không tìm thấy bài học");

  // Dialog thông báo nội dung đang cập nhật cho CTA "Luyện tập nâng cao".
  const [isUpdatingDialogOpen, setIsUpdatingDialogOpen] = useState(false);

  // Dialog nhập mật khẩu bài tập nâng cao — mở khi user click "Luyện tập nâng
  // cao" và sách có folder tự số hóa.
  const [isPassDialogOpen, setIsPassDialogOpen] = useState(false);

  // Đã nhập đúng mật khẩu → thay CTA section bằng danh sách bài nâng cao.
  const [isAdvancedUnlocked, setIsAdvancedUnlocked] = useState(false);

  // Bài đang mở trong dialog runner (null = đóng).
  const [runnerLessonCode, setRunnerLessonCode] = useState<string | null>(null);

  const tapText = tap != null && tap > 0 ? `TẬP ${numberToVietnameseWords(tap).toUpperCase()}` : "";

  // Loading / error states
  if (
    isPreview
      ? isPreviewLoading
      : isLoading
  ) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="size-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500">
            Đang tải thông tin sách...
          </p>
        </div>
      </div>
    );
  }

  if (isPreview ? !previewBook : isError || !book) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm mx-auto px-6">
          <div className="text-4xl">📚</div>
          <h2 className="font-display text-xl font-bold text-slate-800">
            Không tìm thấy sách
          </h2>
          <p className="text-sm text-slate-500">
            Sách bạn tìm kiếm không tồn tại hoặc đã bị xóa.
          </p>
          {embed ? null : (
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-sky-600 transition-all"
            >
              <ArrowLeft className="size-4" /> Về trang chủ
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      {isPreviewRoute && (
        <PreviewBanner enabled={previewEnabled} onToggle={setPreviewEnabled} />
      )}
      {/* Header — ẩn khi embed để user không thoát khỏi trang nhúng. */}
      {embed ? null : (
      <header className="border-b border-slate-100 bg-white/90 backdrop-blur sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
          >
            <ArrowLeft className="size-4" /> Về trang chủ
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <LessonCta
              hasLessons={hasLessons}
              href={firstLessonHref}
              onEmpty={notifyNoLesson}
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2 text-sm font-bold text-white shadow-soft hover:bg-sky-600 hover:opacity-95 transition-all cursor-pointer"
            >
              <PlayCircle className="size-4" /> Vào học
            </LessonCta>
            <UserHeaderMenu />
          </div>
        </div>
      </header>
      )}

      {/* Hero Banner Section */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-8 w-full animate-pop-in">
        <div className="grid gap-12 lg:grid-cols-[auto_1fr] lg:items-center">
          {/* Book Cover */}
          <div className="relative mx-auto lg:mx-0 w-full max-w-[280px]">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-sky-400/20 via-blue-500/10 to-teal-400/20 blur-2xl pointer-events-none" />
            <div className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-card">
              <img
                src={coverUrl || undefined}
                alt={bookTitle}
                className="w-full h-auto block"
              />
            </div>
            <div className="absolute -top-3 -right-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-400 text-amber-950 text-xs font-black shadow-md border-2 border-white">
              <Star className="size-3 fill-amber-950 animate-pulse" /> Mới · Lớp{" "}
              {level}
            </div>
          </div>

          {/* Book core metadata */}
          <div>
            <div className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400 leading-none">
              {subjectName} · LỚP {level} {tapText && `· ${tapText}`}
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-black mt-2 leading-tight text-slate-900 tracking-tight">
              <span className={keywordColor}>{displayTitle}</span>
            </h1>

            {/* Authors Capsule */}
            <div className="mt-6 flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-sky-100/80 shadow-xs max-w-2xl">
              <div className="size-9 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 shrink-0 mt-0.5">
                <Users className="size-5" />
              </div>
              <div className="text-sm font-medium">
                <div className="font-bold text-slate-800">Nhóm tác giả</div>
                <div className="text-slate-500 mt-1 leading-snug">
                  {authorsList}
                </div>
                <div className="text-xs text-slate-400/90 mt-1.5 font-semibold">
                  {publisher}
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap gap-4">
              <LessonCta
                hasLessons={hasLessons}
                href={firstLessonHref}
                onEmpty={notifyNoLesson}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white shadow-soft hover:bg-sky-600 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <PlayCircle className="size-4.5" /> Bắt đầu học bài
              </LessonCta>
              <a
                href="#muc-luc"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                <BookOpen className="size-4.5" /> Xem mục lục
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Table of Contents Section (Mục lục) */}
      <section
        id="muc-luc"
        className="max-w-7xl mx-auto px-6 pb-12 w-full scroll-mt-20"
      >
        <div className="text-xs font-bold uppercase tracking-widest text-sky-500">
          Nội dung học liệu
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-black mt-1 mb-1 text-slate-800 tracking-tight">
          Mục lục học liệu số
        </h2>
        <p className="text-slate-400 font-medium mb-8 text-sm sm:text-base">
          Bám sát cấu trúc phân phối chương trình chính thức — {topics.length}{" "}
          chủ đề · {numberedLessonCount} bài học
        </p>

        {/* 2-Column Grid of Topics Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {topics.map((topic, topicIdx) => {
            const colorClass = TOPIC_COLORS[topicIdx % TOPIC_COLORS.length];
            const IconComponent =
              TOPIC_ICONS[topicIdx % TOPIC_ICONS.length] || BookOpen;
            const indexTheme =
              TOPIC_INDEX_THEMES[topicIdx % TOPIC_INDEX_THEMES.length];

            return (
              <Card
                key={topicIdx}
                className="p-0 border border-slate-100 overflow-hidden hover:border-slate-200 hover:shadow-soft transition-all duration-300 flex flex-col h-full rounded-2xl group/card"
              >
                {/* Topic Header */}
                <div
                  className={`bg-gradient-to-r ${colorClass} p-5 text-white flex items-center gap-4 shrink-0`}
                >
                  <div className="size-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                    <IconComponent className="size-5.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">
                      {topicLabel} {topic.id ?? topicIdx + 1}
                    </div>
                    <div className="font-display text-base sm:text-[17px] font-black leading-snug truncate mt-1">
                      <LessonTitleText title={topic.title} />
                    </div>
                  </div>
                  <div className="shrink-0 text-xs font-bold bg-white/20 backdrop-blur px-3 py-1 rounded-full whitespace-nowrap">
                    {topic.lessons.length} bài
                  </div>
                </div>

                {/* Lessons Rows List */}
                <ol className="divide-y divide-slate-100 flex-1 bg-white">
                  {topic.lessons.map((lesson) => {
                    const lessonNumber = lessonNumbers[String(lesson.id)];
                    return (
                      <Link
                        key={lesson.id}
                        to={lessonHref(lesson)}
                        className="flex items-center gap-3.5 px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer group/item"
                      >
                        {showLessonNumber && lessonNumber !== undefined ? (
                          <div
                            className={`rounded-full ${indexTheme.bg} ${indexTheme.hover} flex items-center justify-center px-2.5 py-1 text-[11px] font-extrabold shrink-0 transition-all`}
                          >
                            Bài {lessonNumber}
                          </div>
                        ) : null}
                        <div className="text-sm font-semibold flex-1 text-slate-700 group-hover/item:text-slate-900 transition-colors line-clamp-1">
                          <LessonTitleText title={lesson.title} />
                        </div>
                        <ChevronRight className="size-4 text-slate-400 shrink-0 group-hover/item:translate-x-0.5 transition-transform" />
                      </Link>
                    );
                  })}
                </ol>
              </Card>
            );
          })}
        </div>
      </section>


      {/* Sẵn sàng chinh phục Section (Footer Call to Action) */}
      {hasAdvancedContent && isAdvancedUnlocked ? (
        // Đã nhập đúng mật khẩu → thay CTA bằng danh sách bài nâng cao.
        // Click bài sẽ mở dialog runner (AdvancedExerciseDialog hoặc
        // DigitizedExerciseDialog bên dưới, tuỳ flag).
        LOADER_ADVANCE_QUESTION_API ? (
          <AdvancedLessonListApi
            chapters={advancedChapters}
            displayTitle={displayTitle}
            onSelectLesson={(id) => setRunnerLessonCode(id)}
          />
        ) : (
          <AdvancedLessonList
            manifest={advancedManifest!}
            displayTitle={displayTitle}
            onSelectLesson={(code) => setRunnerLessonCode(code)}
          />
        )
      ) : (
        <section className="max-w-7xl mx-auto px-6 w-full">
          <Card className="p-8 sm:p-12 border border-slate-100 bg-gradient-to-br from-sky-500/10 via-sky-400/5 to-teal-500/5 text-center shadow-soft relative overflow-hidden rounded-2xl">
            <div className="absolute -inset-10 -z-10 rounded-full bg-white/5 blur-3xl pointer-events-none" />

            <Sparkles className="size-10 text-sky-500 mx-auto mb-3 animate-pulse" />
            <p className="text-slate-500 mt-2 max-w-xl mx-auto text-sm sm:text-base font-semibold leading-relaxed">
              Bạn đã thành thạo chương trình cơ bản của {displayTitle}?
            </p>

            <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              {/* Dùng đúng TÊN SÁCH (displayTitle = book.title), không ghép công thức môn/lớp. */}
              Bắt đầu với các bài tập nâng cao
            </h2>


            <div className="mt-8 flex flex-wrap justify-center gap-4">
              {embed ? null : (
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <ArrowLeft className="size-4.5" /> Về trang chủ
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  // Có nội dung nâng cao (API hoặc JSON) → mở dialog nhập pass.
                  // Không có → báo "đang cập nhật".
                  if (hasAdvancedContent) {
                    setIsPassDialogOpen(true);
                  } else {
                    setIsUpdatingDialogOpen(true);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white shadow-soft hover:bg-sky-600 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <PlayCircle className="size-4.5" /> Luyện tập nâng cao
              </button>

            </div>
          </Card>
        </section>
      )}

      {/* Footer copyright section matching the mockup */}
      <footer className="mt-16 border-t border-slate-100 py-8 bg-slate-50/80">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
          © NXBGDVN - {displayTitle} (Tích hợp phát triển năng lực số)
        </div>
      </footer>

      {/* Dialog thông báo nội dung đang cập nhật */}
      <Dialog
        open={isUpdatingDialogOpen}
        onOpenChange={setIsUpdatingDialogOpen}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Thông báo</DialogTitle>
          </DialogHeader>
          <div>
            <div className="text-center text-xl font-bold text-black">
              Hiện nội dung đang cập nhật
            </div>
            <div className="mt-1 text-center text-sm font-medium text-slate-400">
              Vui lòng quay lại sau
            </div>
          </div>
          {/* <DialogFooter> */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsUpdatingDialogOpen(false)}
              className="inline-flex items-center justify-center rounded-xl border border-sky-500 bg-white px-5 py-2.5 text-sm font-bold text-sky-600 hover:bg-sky-50 transition-all cursor-pointer"
            >
              Đóng
            </button>
          </div>
          {/* </DialogFooter> */}
        </DialogContent>
      </Dialog>

      {/* Dialog nhập mật khẩu bài tập nâng cao — mở khi user click "Luyện tập
          nâng cao". Nhập đúng → đổi CTA section thành danh sách bài (không mở
          dialog). Click bài mới mở dialog runner bên dưới. Gate theo
          `hasAdvancedContent` (gộp cả 2 nguồn API/JSON). */}
      {hasAdvancedContent && (
        <DigitizedExercisePassDialog
          open={isPassDialogOpen}
          onOpenChange={setIsPassDialogOpen}
          onVerified={() => {
            setIsPassDialogOpen(false);
            setIsAdvancedUnlocked(true);
          }}
        />
      )}

      {/* Dialog runner bài tập nâng cao — mở khi user click 1 bài trong danh
          sách. skipPass vì pass đã xác thực ở dialog trên. Chọn nguồn theo
          `LOADER_ADVANCE_QUESTION_API`:
          - true  → AdvancedExerciseDialog (API `?is_advanced=true`).
          - false → DigitizedExerciseDialog (content.json cũ). */}
      {LOADER_ADVANCE_QUESTION_API ? (
        <AdvancedExerciseDialog
          open={runnerLessonCode !== null}
          onOpenChange={(open) => {
            if (!open) setRunnerLessonCode(null);
          }}
          bookCode={String(book?.id ?? bookCode ?? "")}
          lessonCode={runnerLessonCode ?? ""}
          skipPass
        />
      ) : advancedManifest ? (
        <DigitizedExerciseDialog
          open={runnerLessonCode !== null}
          onOpenChange={(open) => {
            if (!open) setRunnerLessonCode(null);
          }}
          bookCode={String(book?.id ?? bookCode ?? "")}
          lessonCode={runnerLessonCode ?? ""}
          skipPass
        />
      ) : null}
    </div>
  );
}
