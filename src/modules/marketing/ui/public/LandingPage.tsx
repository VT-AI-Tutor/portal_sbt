import { useState, useMemo } from "react";
import { Link } from "react-router-dom";

import { useCatalogBooks } from "@/modules/catalog/hooks/useCatalog";
import type { BookListItem } from "@/modules/catalog/api/types";
import { useLevels, useSubjects, getSubjectDisplay } from "@/core/reference";

import { Card } from "@/core/ui/card";
import { Checkbox } from "@/core/ui/checkbox";
import {
  Sparkles,
  BookOpen,
  Brain,
  Trophy,
  PlayCircle,
  Check,
  Search,
  MapPin,
  Phone,
  Mail,
  Globe,
} from "lucide-react";

import { UserHeaderMenu } from "@/modules/books/ui/shared/UserHeaderMenu";
import { NxbgdBrandLockup } from "@/modules/marketing/ui/shared/NxbgdBrandLockup";
import { PatternSvg } from "./shared/PatternSvg";
import {
  COLOR_GRADIENT,
  COLOR_PATTERN,
  type CoverPattern,
} from "./shared/subjectCoverTokens";
import { compareBooksForGrid } from "./shared/bookGridOrder";

interface BookData {
  id: string;
  title: string;
  subject: string;
  subjectCode: string;
  level: string;
  tap: number | null;
  price: number;
  emoji: string;
  pattern: CoverPattern;
  gradient: string;
  owned: boolean;
  isDraft?: boolean;
}

// Emoji riêng theo khối lớp (level code từ reference API) — thuần trang trí.
// GAP-9: bộ lọc "Môn học" lấy từ danh mục môn active (useSubjects, /catalog/subjects)
// thay vì hằng cứng — admin thêm/sửa môn là menu tự cập nhật. Lọc so khớp theo subject_code.

function BookCover({ book, badge }: { book: BookData; badge: string }) {
  return (
    <div
      className={`relative aspect-[5/7] bg-gradient-to-br ${book.gradient} overflow-hidden`}
    >
      <PatternSvg pattern={book.pattern} />
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/30" />
      <div className="absolute top-0 left-2 bottom-0 w-0.5 bg-white/20" />
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
        <span className="inline-block bg-white/95 backdrop-blur px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider text-foreground shadow-soft">
          {book.subject}
        </span>
        <span className="inline-block bg-black/30 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-white">
          Lớp {book.level}
        </span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="size-20 md:size-24 rounded-full bg-white/95 backdrop-blur shadow-card flex items-center justify-center text-4xl md:text-5xl group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
          {book.emoji}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-2.5 py-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
        <div className="text-white text-[10px] font-bold uppercase tracking-wider">
          {badge}
        </div>
        <div className="text-white/80 text-[9px] font-medium">
          NXB Giáo dục Việt Nam
        </div>
      </div>
    </div>
  );
}

function PartnerLogoMark({
  src,
  srcSet,
  alt,
  width,
  height,
}: {
  src: string;
  srcSet: string;
  alt: string;
  width: number;
  height: number;
}) {
  return (
    <div className="flex-shrink-0 size-14 flex items-center justify-center">
      <img
        src={src}
        srcSet={srcSet}
        alt={alt}
        width={width}
        height={height}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

export function LandingPage() {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch books from catalog API (replaces BIA_SACH glob)
  const {
    data: catalogBooks = [],
    isLoading: catalogLoading,
    isError: catalogError,
    refetch: refetchCatalog,
  } = useCatalogBooks();
  // Danh mục khối lớp — thay cho GRADES hardcode.
  const {
    data: levels = [],
    isLoading: levelsLoading,
    isError: levelsError,
    refetch: refetchLevels,
  } = useLevels();
  // GAP-9: danh mục môn học (active) — nguồn cho bộ lọc "Môn học". API trả sẵn theo `order`.
  const { data: subjects = [] } = useSubjects();
  // GAP-117: phạm vi khối lớp nói theo danh mục thật, không hard-code "Lớp 1 đến Lớp 5".
  const levelRangeLabel =
    levels.length === 0
      ? null
      : levels.length === 1
        ? levels[0].label
        : `${levels[0].label} đến ${levels[levels.length - 1].label}`;
  // Grid gom sách theo levels — phải chờ CẢ 2 query, kẻo books về trước
  // levels thì grid trống mà không có skeleton lẫn empty-state.
  const gridLoading = catalogLoading || levelsLoading;
  // GAP-121: hỏng thì react-query tắt isLoading và để data undefined → rơi vào
  // mặc định [] → trước đây trang chủ báo "Không tìm thấy sách phù hợp… xóa bộ lọc",
  // tức đổ lỗi cho bộ lọc của người dùng khi thật ra máy chủ đang lỗi.
  const gridError = catalogError || levelsError;
  const retryGrid = () => {
    if (catalogError) void refetchCatalog();
    if (levelsError) void refetchLevels();
  };

  // Map API BookListItem → display shape used in the book grid
  const allBooks = useMemo((): (BookData & {
    cover: string | null;
    isAdvanced: boolean;
    slug: string;
    code: string | null;
  })[] => {
    const fromCatalog = catalogBooks
      .map((b: BookListItem) => {
        const display = getSubjectDisplay(b.subject_code, b.subject_name);
        return {
          id: String(b.id),
          slug: b.slug,
          code: b.code,
          title: b.title,
          subject: display.label,
          subjectCode: b.subject_code,
          level: b.level,
          tap: b.tap,
          price: 0,
          emoji: display.emoji,
          pattern: COLOR_PATTERN[display.color] ?? "grid",
          gradient: COLOR_GRADIENT[display.color] ?? "from-primary to-fun",
          owned: true,
          cover: b.cover_url,
          isAdvanced: false,
        };
      });
    return [...fromCatalog].sort(compareBooksForGrid);
  }, [catalogBooks]);

  // Filter books based on checked subjects and search query
  const filteredBooks = useMemo(() => {
    let list = allBooks;

    // 1. Filter by search query
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(
        (book) =>
          book.title.toLowerCase().includes(query) ||
          book.subject.toLowerCase().includes(query),
      );
    }

    // 2. Lọc theo môn đã chọn ở sidebar/select — so khớp trực tiếp subject_code.
    if (selectedSubjects.length > 0) {
      list = list.filter((book) => selectedSubjects.includes(book.subjectCode));
    }

    return list;
  }, [allBooks, searchQuery, selectedSubjects]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary/5 via-background to-fun/5">
      {/* Header */}
      <header className="border-b-2 bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <NxbgdBrandLockup />
          </Link>

          {/* Middle: Search Bar (Desktop: Header, Mobile: Hidden) */}
          <div className="hidden sm:block flex-1 max-w-md mx-auto relative px-2">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Tìm kiếm sách trong danh mục..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-9 rounded-full bg-muted/65 border-2 border-transparent focus:border-primary focus:bg-card focus:outline-none text-xs font-semibold transition-all shadow-inner focus:shadow-soft text-foreground placeholder:text-muted-foreground/80"
              />
              <Search className="absolute left-3.5 size-4 text-muted-foreground/80 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 text-muted-foreground/80 hover:text-foreground text-[10px] font-bold cursor-pointer bg-muted/40 hover:bg-muted/80 rounded-full size-4 flex items-center justify-center transition-all"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <UserHeaderMenu />
        </div>
      </header>

      {/* Hero Banner */}
      <section className="max-w-7xl mx-auto px-4 pt-8 pb-8 w-full">
        <div className="relative w-full rounded-3xl overflow-hidden border-2 border-border/80 shadow-soft group">
          {/* Desktop banner — WebP from 5334px source, 1x + 2x retina */}
          <img
            src="/images/banner-desktop.webp"
            srcSet="/images/banner-desktop.webp 1280w, /images/banner-desktop@2x.webp 2560w"
            sizes="(min-width: 768px) min(1280px, 100vw - 2rem)"
            alt="Vở Bài Tập - Tích hợp phát triển năng lực số"
            width={1280}
            height={420}
            className="hidden md:block w-full h-auto object-cover group-hover:scale-[1.01] transition-transform duration-700"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
          {/* Mobile banner — WebP from 3200px source, 1x + 2x retina */}
          <img
            src="/images/banner-mobile.webp"
            srcSet="/images/banner-mobile.webp 768w, /images/banner-mobile@2x.webp 1536w"
            sizes="(max-width: 767px) calc(100vw - 2rem)"
            alt="Vở Bài Tập - Tích hợp phát triển năng lực số"
            width={768}
            height={432}
            className="block md:hidden w-full h-auto object-cover group-hover:scale-[1.01] transition-transform duration-700"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </section>

      {/* Vở bài tập (cơ bản theo SGK & nâng cao theo lớp/môn) */}
      <section
        id="sach-bai-tap"
        className="max-w-7xl mx-auto px-4 pb-20 w-full"
      >
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">
            Học tập cá nhân hóa & phát triển năng lực
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-1">
            Kho Vở Bài Tập Số
          </h2>
          {/* GAP-117: trước đây cứng "đầy đủ từ Lớp 1 đến Lớp 5" trong khi danh mục Khối lớp do
              máy chủ định nghĩa và mở rộng được — thêm khối là câu này sai ngay. Nay suy từ
              chính danh mục đang hiển thị bên dưới (trang đã gọi useLevels sẵn). */}
          <p className="text-muted-foreground mt-1">
            {levelRangeLabel
              ? `Bám sát chương trình GDPT 2018 — ${levelRangeLabel}`
              : "Bám sát chương trình GDPT 2018"}
          </p>
        </div>

        {/* Mobile Search & Filters (Select boxes - Only visible on mobile/phone) */}
        <div className="lg:hidden block mb-6 space-y-4 bg-card/80 backdrop-blur p-5 rounded-3xl border-2 border-border/80 shadow-soft animate-pop-in">
          {/* Mobile Search Box */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block leading-none">
              Tìm kiếm sách
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Tìm kiếm sách trong danh mục..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-9 rounded-2xl bg-white border-2 border-border focus:border-primary focus:outline-none text-sm font-semibold transition-all text-slate-800 shadow-sm"
              />
              <Search className="absolute left-3.5 size-4 text-slate-400 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 text-muted-foreground/80 hover:text-foreground text-[10px] font-bold cursor-pointer bg-muted/40 hover:bg-muted/80 rounded-full size-4 flex items-center justify-center transition-all"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Class Filter (Lọc theo lớp - On top) */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block leading-none">
              Chọn Lớp học
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl border-2 border-border bg-white text-sm font-bold focus:border-primary focus:outline-none transition-all text-slate-800 shadow-sm cursor-pointer"
            >
              <option value="all">Tất cả</option>
              {levels.map((lvl) => (
                <option key={lvl.code} value={lvl.code}>
                  {lvl.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter (Lọc theo môn - Below) */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block leading-none">
              Chọn Môn học
            </label>
            <select
              value={selectedSubjects[0] || "all"}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSubjects(val === "all" ? [] : [val]);
              }}
              className="w-full h-11 px-3.5 rounded-2xl border-2 border-border bg-white text-sm font-bold focus:border-primary focus:outline-none transition-all text-slate-800 shadow-sm cursor-pointer"
            >
              <option value="all">📚 Tất cả môn học</option>
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Cột bên trái: Bộ lọc môn học (Chỉ hiện trên desktop) */}
          <div className="lg:col-span-1 hidden lg:block">
            <Card className="p-6 border-2 border-border/80 rounded-3xl bg-card/85 backdrop-blur shadow-soft sticky top-20">
              <h3 className="font-display font-bold text-lg text-foreground border-b-2 border-border pb-3 mb-4 flex items-center gap-2">
                <span>📚</span> Môn học
              </h3>
              {/* Danh sách môn có thể dài (nhiều môn active) → giới hạn chiều cao và
                  cho cuộn dọc, tránh tràn ra ngoài card sticky. Nút "Xóa bộ lọc"
                  nằm ngoài vùng cuộn nên luôn cố định phía dưới. */}
              <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
                {subjects.map((s) => {
                  const isChecked = selectedSubjects.includes(s.code);
                  return (
                    <label
                      key={s.code}
                      className="flex items-center gap-3.5 px-2 py-1.5 rounded-xl hover:bg-muted/80 cursor-pointer transition-all duration-200 group"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          setSelectedSubjects((prev) =>
                            prev.includes(s.code)
                              ? prev.filter((c) => c !== s.code)
                              : [...prev, s.code],
                          );
                        }}
                        className="border-2 border-muted-foreground/30 data-[state=checked]:border-primary"
                      />
                      <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground select-none">
                        {s.label}
                      </span>
                    </label>
                  );
                })}
              </div>

              {selectedSubjects.length > 0 && (
                <button
                  onClick={() => setSelectedSubjects([])}
                  className="mt-5 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white transition-all cursor-pointer text-center"
                >
                  Xóa bộ lọc
                </button>
              )}
            </Card>
          </div>

          {/* Cột bên phải: Danh sách 5 lớp, mỗi lớp 1 hàng */}
          <div className="lg:col-span-3 space-y-8">
            {/* Grade Filter Row — wrap thành nhiều dòng khi có nhiều khối lớp (Lớp 1..12)
                để không phải scroll ngang (Chỉ hiện trên desktop). */}
            <div className="p-3.5 rounded-3xl bg-card/60 backdrop-blur border-2 border-border/80 shadow-soft hidden lg:block">
              <div className="flex flex-wrap items-center gap-3 py-1 px-1">
                <button
                  onClick={() => setSelectedLevel("all")}
                  className={`
                    px-6 py-3 rounded-full text-sm sm:text-base font-black font-display transition-all duration-300 flex items-center justify-center cursor-pointer whitespace-nowrap
                    ${
                      selectedLevel === "all"
                        ? "bg-gradient-to-r from-primary to-fun text-white scale-105 shadow-soft border-transparent"
                        : "bg-card border-2 border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50"
                    }
                  `}
                >
                  <span>Tất cả</span>
                </button>

                {levels.map((lvl) => {
                  const isActive = selectedLevel === lvl.code;
                  return (
                    <button
                      key={lvl.code}
                      onClick={() => setSelectedLevel(lvl.code)}
                      className={`
                        px-6 py-3 rounded-full text-sm sm:text-base font-black font-display transition-all duration-300 flex items-center justify-center cursor-pointer whitespace-nowrap
                        ${
                          isActive
                            ? "bg-gradient-to-r from-primary to-fun text-white scale-105 shadow-soft border-transparent transform -translate-y-0.5 animate-pop-in"
                            : "bg-card border-2 border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50"
                        }
                      `}
                    >
                      <span>{lvl.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Loading skeleton */}
            {gridLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border-2 border-border/60 bg-muted/40 animate-pulse aspect-[5/7]"
                  />
                ))}
              </div>
            )}

            {!gridLoading &&
              levels.map((lvl) => {
                // If filtering by specific level, only show that level
                if (selectedLevel !== "all" && selectedLevel !== lvl.code) {
                  return null;
                }

                // Filter books for this level
                const gradeBooks = filteredBooks.filter(
                  (b) => b.level === lvl.code,
                );

                if (gradeBooks.length === 0) return null;

                return (
                  // content-visibility: bỏ layout/paint cho khối lớp ngoài màn hình.
                  // Đặt ở mức khối-lớp để paint-containment không cắt bóng đổ hover thẻ.
                  <div
                    key={lvl.code}
                    className="space-y-4 animate-pop-in [content-visibility:auto] [contain-intrinsic-size:auto_600px]"
                  >
                    {/* Grade row header */}
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-extrabold text-xl md:text-2xl text-foreground">
                          {lvl.label}
                        </h3>
                        <span className="text-xs font-bold text-muted-foreground ml-2 px-2 py-0.5 bg-muted rounded-full">
                          {gradeBooks.length} cuốn sách
                        </span>
                      </div>
                    </div>

                    {/* Grid of books of this level */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                      {gradeBooks.map((b) => {
                        const cardContent = (
                          <Card className="group p-0 border-2 hover:border-primary transition-all hover:-translate-y-1 hover:shadow-card overflow-hidden flex flex-col relative h-full">
                            <div className="aspect-[5/7] overflow-hidden bg-muted relative">
                              {b.cover ? (
                                <img
                                  src={b.cover}
                                  alt={b.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : b.isAdvanced ? (
                                <BookCover
                                  book={b}
                                  badge={`Nâng cao · Lớp ${b.level}`}
                                />
                              ) : (
                                <div
                                  className={`relative w-full h-full bg-gradient-to-br ${b.gradient} overflow-hidden flex items-center justify-center`}
                                >
                                  <PatternSvg pattern={b.pattern} />
                                  <div className="absolute top-0 left-0 right-0 h-1 bg-white/20" />
                                  <div className="absolute top-0 left-1.5 bottom-0 w-0.5 bg-white/10" />
                                  <div className="size-16 md:size-20 rounded-full bg-white/95 backdrop-blur shadow-card flex items-center justify-center text-3xl group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                                    {b.emoji}
                                  </div>
                                </div>
                              )}
                            </div>
                            {b.isDraft && (
                              <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow">
                                Bản nháp
                              </span>
                            )}

                            <div className="p-2.5 flex flex-col flex-1 justify-center">
                              {/* Hiển thị đúng TÊN SÁCH (book.title) theo data — không
                                  dựng lại "công thức" từ môn/lớp/tập (đồng nhất BookDetailPage). */}
                              <div className="font-bold text-xs leading-snug text-center text-foreground">
                                {b.title}
                              </div>
                            </div>
                          </Card>
                        );

                        return (
                          <Link
                            key={b.slug}
                            to={`/sach-bai-tap/${b.code ?? b.id}`}
                            className="block no-underline h-full"
                          >
                            {cardContent}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            {/* GAP-121: tải danh mục lỗi — nói đúng là lỗi máy chủ và cho thử lại,
                không mượn empty-state của bộ lọc để báo. */}
            {!gridLoading && gridError && (
              <div className="text-center py-16 bg-card/40 border-2 border-dashed border-destructive/40 rounded-3xl p-8 max-w-md mx-auto">
                <div className="text-4xl mb-3">⚠️</div>
                <h4 className="font-display font-bold text-lg text-foreground">
                  Không tải được danh sách sách
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Có lỗi khi kết nối tới máy chủ. Vui lòng thử lại; nếu vẫn lỗi,
                  bạn hãy quay lại sau ít phút.
                </p>
                <button
                  onClick={retryGrid}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-soft transition hover:opacity-90"
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* Empty state when no books match filter */}
            {!gridLoading && !gridError && filteredBooks.length === 0 && (
              <div className="text-center py-16 bg-card/40 border-2 border-dashed border-border rounded-3xl p-8 max-w-md mx-auto">
                <div className="text-4xl mb-3">🔍</div>
                <h4 className="font-display font-bold text-lg text-foreground">
                  Không tìm thấy sách phù hợp
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Không có sách nào khớp với từ khoá tìm kiếm và bộ lọc hiện
                  tại. Vui lòng thử lại hoặc xóa bộ lọc.
                </p>
                <button
                  onClick={() => {
                    // Xoá TẤT CẢ bộ lọc đang áp: môn học, tìm kiếm, khối lớp —
                    // trước đây chỉ xoá môn nên nút "không tác dụng" khi empty do search/lớp.
                    setSelectedSubjects([]);
                    setSearchQuery("");
                    setSelectedLevel("all");
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-soft transition hover:opacity-90 animate-wiggle"
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-border bg-card mt-auto pt-12 pb-6">
        <div className="max-w-7xl mx-auto px-4 w-full">
          <div className="text-center mb-10">
            <h3 className="font-display font-bold text-sm sm:text-base tracking-wider uppercase text-muted-foreground">
              Bộ sách được phát hành tại:
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-border/60">
            {/* Cột 1: Thông tin NXBGDVN */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <PartnerLogoMark
                  src="/images/logos/logo-nxbgd.webp"
                  srcSet="/images/logos/logo-nxbgd.webp 1x, /images/logos/logo-nxbgd@2x.webp 2x"
                  alt="NXB Giáo Dục Việt Nam"
                  width={133}
                  height={80}
                />
                <div className="min-w-0">
                  <h4 className="font-display font-bold text-sm tracking-tight text-foreground uppercase">
                    NXB Giáo Dục Việt Nam
                  </h4>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nhà xuất bản hàng đầu phục vụ sự nghiệp giáo dục, nâng cao dân
                trí và phát triển nhân lực tại Việt Nam.
              </p>
              <div className="space-y-2.5 text-xs text-foreground/80">
                <div className="flex items-start gap-2">
                  <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                  <span>Số 81 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-primary shrink-0" />
                  <span>024.3822.0801 - Fax: 024.3942.2012</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-primary shrink-0" />
                  <a
                    href="mailto:lienhe@nxbgd.vn"
                    className="hover:text-primary transition-colors"
                  >
                    lienhe@nxbgd.vn
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-primary shrink-0" />
                  <a
                    href="https://www.nxbgd.vn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors"
                  >
                    www.nxbgd.vn
                  </a>
                </div>
              </div>
            </div>

            {/* Cột 2: SEDIDCO */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <PartnerLogoMark
                  src="/images/logos/logo-sedico.webp"
                  srcSet="/images/logos/logo-sedico.webp 1x, /images/logos/logo-sedico@2x.webp 2x"
                  alt="SEDIDCO"
                  width={59}
                  height={72}
                />
                <div className="min-w-0">
                  <h4 className="font-display font-black text-sm tracking-tight text-foreground uppercase">
                    SEDIDCO
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">
                    Phát hành Phương Nam
                  </span>
                </div>
              </div>
              <h5 className="font-bold text-xs text-[#2c3e50] leading-snug">
                CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ PHÁT TRIỂN GIÁO DỤC PHƯƠNG NAM
              </h5>
              <div className="space-y-2.5 text-xs text-foreground/80">
                <div className="flex items-start gap-2">
                  <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    231 Nguyễn Văn Cừ, phường Chợ Quán, TP. Hồ Chí Minh
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-primary shrink-0" />
                  <span>(028)73 035 556</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-primary shrink-0" />
                  <a
                    href="https://phuongnam.edu.vn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors font-semibold"
                  >
                    phuongnam.edu.vn
                  </a>
                </div>
              </div>
            </div>

            {/* Cột 3: CỬU LONG */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <PartnerLogoMark
                  src="/images/logos/logo-cuulong.webp"
                  srcSet="/images/logos/logo-cuulong.webp 1x, /images/logos/logo-cuulong@2x.webp 2x"
                  alt="Cửu Long"
                  width={45}
                  height={72}
                />
                <div className="min-w-0">
                  <h4 className="font-display font-black text-sm tracking-tight text-foreground uppercase">
                    CỬU LONG
                  </h4>
                  <span className="text-[10px] font-bold text-red-600 uppercase">
                    Phát hành Cửu Long
                  </span>
                </div>
              </div>
              <h5 className="font-bold text-xs text-[#2c3e50] leading-snug">
                CÔNG TY CỔ PHẦN SÁCH VÀ THIẾT BỊ GIÁO DỤC CỬU LONG
              </h5>
              <div className="space-y-2.5 text-xs text-foreground/80">
                <div className="flex items-start gap-2">
                  <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                  <span>162D Đường 3/2, phường Ninh Kiều, TP. Cần Thơ</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-primary shrink-0" />
                  <span>0292 629 2661</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-primary shrink-0" />
                  <a
                    href="https://stbcuulong.edu.vn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors font-semibold"
                  >
                    stbcuulong.edu.vn
                  </a>
                </div>
              </div>
            </div>

            {/* Cột 4: SOBEE */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <PartnerLogoMark
                  src="/images/logos/logo-sobee.webp"
                  srcSet="/images/logos/logo-sobee.webp 1x, /images/logos/logo-sobee@2x.webp 2x"
                  alt="SOBEE"
                  width={75}
                  height={72}
                />
                <div className="min-w-0">
                  <h4 className="font-display font-black text-sm tracking-tight text-foreground uppercase">
                    SOBEE
                  </h4>
                  <span className="text-[10px] font-bold text-blue-600 uppercase">
                    Phát hành Miền Nam
                  </span>
                </div>
              </div>
              <h5 className="font-bold text-xs text-[#2c3e50] leading-snug">
                CÔNG TY CỔ PHẦN SÁCH VÀ THIẾT BỊ GIÁO DỤC MIỀN NAM
              </h5>
              <div className="space-y-2.5 text-xs text-foreground/80">
                <div className="flex items-start gap-2">
                  <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    231 Nguyễn Văn Cừ, phường Chợ Quán, TP. Hồ Chí Minh
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-primary shrink-0" />
                  <span>0283 830 0312 - 0283 830 0648</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-primary shrink-0" />
                  <a
                    href="https://sobee.vn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors font-semibold"
                  >
                    sobee.vn
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 text-center text-xs text-muted-foreground leading-relaxed">
            © NXBGDVN · Hệ thống sách giáo khoa bài tập tích hợp AI hỗ trợ phát
            triển năng lực số · v{__APP_VERSION__}
          </div>
        </div>
      </footer>
    </div>
  );
}

function Badge({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border-2 border-border">
      <Icon className="size-4 text-primary" />
      <span className="font-medium">{text}</span>
    </div>
  );
}
