import { getSubjectDisplay, useLevels, useSubjects } from "@/core/reference";

interface LevelSubjectSectionProps {
  level: string;
  subjectCode: string;
  onLevelChange: (level: string) => void;
  onSubjectChange: (code: string) => void;
}

/**
 * Bước "Chọn Khối → Môn" bằng dữ liệu thật từ danh mục (reference), không hard-code.
 * Sort theo `order` — KHÔNG sort chuỗi, tránh bug lexicographic ở lớp 10+ (10 < 2 nếu so
 * chuỗi). Danh mục lỗi/rỗng thì section tự ẩn (degrade gracefully), không vẽ UI hỏng.
 */
export function LevelSubjectSection(p: LevelSubjectSectionProps) {
  const levels = useLevels();
  const subjects = useSubjects();
  const sortedLevels = [...(levels.data ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const sortedSubjects = [...(subjects.data ?? [])].sort(
    (a, b) => a.order - b.order,
  );

  // Đang tải: return null luôn (giống 2 select ở hero) — nếu mount section rỗng thì
  // sẽ có khoảng trống lớn rồi giật layout khi dữ liệu về.
  if (levels.isLoading || subjects.isLoading) return null;
  // Đã settle mà rỗng/lỗi cả hai danh mục: section tự ẩn, không vẽ UI hỏng.
  if (sortedLevels.length === 0 && sortedSubjects.length === 0) {
    return null;
  }

  return (
    <section className="max-w-7xl mx-auto px-4 py-16 w-full space-y-8">
      {sortedLevels.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
            Em học lớp mấy?
          </h2>
          <div className="flex flex-wrap gap-2">
            {sortedLevels.map((l) => (
              <button
                key={l.code}
                type="button"
                data-active={l.code === p.level || undefined}
                className="inline-flex items-center justify-center rounded-full border-2 border-border bg-card px-4 py-2 text-sm font-bold text-foreground/80 transition hover:border-primary hover:text-primary cursor-pointer data-[active]:border-primary data-[active]:bg-primary data-[active]:text-primary-foreground"
                onClick={() => p.onLevelChange(l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {sortedSubjects.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
            Luyện môn nào?
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {sortedSubjects.map((s) => {
              const d = getSubjectDisplay(s.code, s.label);
              return (
                <button
                  key={s.code}
                  type="button"
                  data-active={s.code === p.subjectCode || undefined}
                  className="flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2.5 text-sm font-bold text-foreground/80 transition hover:border-primary hover:text-primary cursor-pointer data-[active]:border-primary data-[active]:bg-primary/10 data-[active]:text-primary"
                  onClick={() => p.onSubjectChange(s.code)}
                >
                  <span aria-hidden>{d.emoji}</span>
                  <span className="truncate">{d.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
