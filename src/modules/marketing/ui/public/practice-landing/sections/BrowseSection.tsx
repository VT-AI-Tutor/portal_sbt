import { useMemo } from "react";

import { useLevels, useSubjects } from "@/core/reference";
import { usePracticeTopics } from "@/modules/catalog/hooks/useCatalog";
import { COPY } from "../copy";
import {
  filterBrowseTopics,
  subjectCodesForLevel,
  toBrowseTopics,
} from "../browse/browseTopics";
import { TopicCard } from "./TopicCard";
import { SubjectSidebar } from "./SubjectSidebar";

interface BrowseSectionProps {
  level: string;
  subjectCode: string | null;
  onLevelChange: (level: string) => void;
  onSubjectChange: (code: string | null) => void;
}

const CHIP_BASE =
  "px-5 py-2 rounded-full text-sm font-bold transition-all cursor-pointer";
const CHIP_ACTIVE =
  "bg-gradient-to-r from-primary to-info text-primary-foreground shadow-soft";
const CHIP_IDLE =
  "border-2 border-border bg-card text-foreground hover:border-primary";

export function BrowseSection({
  level,
  subjectCode,
  onLevelChange,
  onSubjectChange,
}: BrowseSectionProps) {
  // Không truyền tham số: lấy CẢ lưới bằng một request rồi lọc phía client, nên
  // bấm chip lớp/môn không sinh request mới.
  const topicsQuery = usePracticeTopics();
  const levels = useLevels();
  const subjects = useSubjects();

  const sortedLevels = useMemo(
    () => [...(levels.data ?? [])].sort((a, b) => a.order - b.order),
    [levels.data],
  );
  const sortedSubjects = useMemo(
    () => [...(subjects.data ?? [])].sort((a, b) => a.order - b.order),
    [subjects.data],
  );

  const topics = useMemo(
    () => toBrowseTopics(topicsQuery.data ?? []),
    [topicsQuery.data],
  );
  const filtered = useMemo(
    () => filterBrowseTopics(topics, level, subjectCode),
    [topics, level, subjectCode],
  );

  // Sidebar chỉ liệt kê môn CÓ bài ở khối đang chọn — bấm một môn rồi ra lưới
  // trống là trải nghiệm cụt.
  //
  // Chỉ thu hẹp danh sách khi THẬT SỰ biết khối nào có môn nào — tức là có dữ
  // liệu chủ đề trong tay. Không có thì hiện đủ danh mục.
  //
  // `topics.length > 0` là vế quan trọng nhất, không phải phòng xa: response
  // THÀNH CÔNG mà RỖNG cũng vượt qua !isLoading && !isError, và khi đó bộ lọc
  // sẽ xoá sạch sidebar. Hai đường dẫn tới cảnh đó, đều ngoài máy dev:
  //   - môi trường chưa seed ngân hàng câu hỏi luyện tập → API trả data: []
  //   - API_PROVIDER=lcms → listPracticeTopics() trả [] (chưa có endpoint tương
  //     đương), nên sidebar sẽ trắng VĨNH VIỄN
  // Cả hai lẽ ra chỉ nên làm lưới trống, không được làm mất luôn bộ lọc môn.
  const availabilityKnown =
    !topicsQuery.isLoading && !topicsQuery.isError && topics.length > 0;
  const availableSubjects = useMemo(() => {
    if (!availabilityKnown) return sortedSubjects;
    const codes = subjectCodesForLevel(topics, level);
    return sortedSubjects.filter((s) => codes.has(s.code));
  }, [availabilityKnown, sortedSubjects, topics, level]);

  /**
   * Đổi khối kèm dọn bộ lọc môn nếu môn đang chọn không có ở khối mới. Không
   * dọn thì môn đó vừa bị ẩn khỏi sidebar vừa vẫn đang lọc — người dùng thấy
   * lưới trống mà không còn chỗ nào để bỏ chọn.
   */
  const selectLevel = (next: string) => {
    onLevelChange(next);
    if (!availabilityKnown || subjectCode === null) return;
    if (!subjectCodesForLevel(topics, next).has(subjectCode)) {
      onSubjectChange(null);
    }
  };

  // Phải chờ CẢ HAI query: chủ đề về trước danh mục khối thì lưới gom-theo-lớp
  // ra rỗng mà không có skeleton lẫn empty-state.
  const gridLoading = topicsQuery.isLoading || levels.isLoading;
  // GAP-121: hỏng thì react-query để data undefined → rơi vào [] → nếu không tách
  // nhánh lỗi, trang sẽ đổ lỗi bộ lọc của người dùng cho sự cố máy chủ.
  const gridError = topicsQuery.isError || levels.isError;
  const retryGrid = () => {
    if (topicsQuery.isError) void topicsQuery.refetch();
    if (levels.isError) void levels.refetch();
  };

  const clearFilters = () => {
    onLevelChange("all");
    onSubjectChange(null);
  };

  return (
    <section id="bai-tap" className="max-w-7xl mx-auto px-4 pb-16 w-full">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            {COPY.browseTitle}
          </h2>
          <p className="text-muted-foreground mt-1">{COPY.browseSubtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          aria-pressed={level === "all"}
          onClick={() => selectLevel("all")}
          className={`${CHIP_BASE} ${level === "all" ? CHIP_ACTIVE : CHIP_IDLE}`}
        >
          {COPY.browseAllLevels}
        </button>
        {sortedLevels.map((lvl) => (
          <button
            key={lvl.code}
            type="button"
            aria-pressed={level === lvl.code}
            onClick={() => selectLevel(lvl.code)}
            className={`${CHIP_BASE} ${level === lvl.code ? CHIP_ACTIVE : CHIP_IDLE}`}
          >
            {lvl.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
        <SubjectSidebar
          subjects={availableSubjects}
          selected={subjectCode}
          onSelect={onSubjectChange}
          // Chờ cả chủ đề: thiếu vế này thì sidebar hiện đủ môn rồi CO LẠI khi
          // chủ đề về — danh sách nhảy ngay trước mắt người dùng.
          loading={subjects.isLoading || topicsQuery.isLoading}
        />

        <div className="space-y-10">
          {gridLoading && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border-2 border-border/60 bg-muted/40 animate-pulse aspect-[5/7]"
                />
              ))}
            </div>
          )}

          {!gridLoading &&
            !gridError &&
            sortedLevels.map((lvl) => {
              const levelTopics = filtered.filter((t) => t.level === lvl.code);
              if (levelTopics.length === 0) return null;
              return (
                <div key={lvl.code}>
                  <div className="flex items-baseline gap-2 mb-4">
                    <h3 className="font-display text-xl font-bold text-foreground">
                      {lvl.label}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {levelTopics.length} {COPY.countSuffix}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {levelTopics.map((t) => (
                      <TopicCard key={t.key} topic={t} levelLabel={lvl.label} />
                    ))}
                  </div>
                </div>
              );
            })}

          {!gridLoading && gridError && (
            <div className="text-center bg-card/40 border-2 border-dashed border-destructive/40 rounded-3xl p-8 max-w-md mx-auto">
              <div className="text-4xl mb-3" aria-hidden>
                ⚠️
              </div>
              <h4 className="font-display font-bold text-lg text-foreground">
                {COPY.gridErrorTitle}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {COPY.gridErrorBody}
              </p>
              <button
                type="button"
                onClick={retryGrid}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-soft transition hover:opacity-90 cursor-pointer"
              >
                {COPY.gridRetry}
              </button>
            </div>
          )}

          {!gridLoading && !gridError && filtered.length === 0 && (
            <div className="text-center bg-card/40 border-2 border-dashed border-border rounded-3xl p-8 max-w-md mx-auto">
              <div className="text-4xl mb-3" aria-hidden>
                🔍
              </div>
              <h4 className="font-display font-bold text-lg text-foreground">
                {COPY.gridEmptyTitle}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {COPY.gridEmptyBody}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-soft transition hover:opacity-90 cursor-pointer"
              >
                {COPY.gridClearFilters}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
