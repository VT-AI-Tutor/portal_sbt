import { Card } from "@/core/ui/card";
import type { ReferenceItem } from "@/core/reference";
import { COPY } from "../copy";
import { getSubjectIcon } from "../subjectIcons";

interface SubjectSidebarProps {
  subjects: ReferenceItem[];
  selected: string | null;
  onSelect: (code: string | null) => void;
  loading: boolean;
}

export function SubjectSidebar({
  subjects,
  selected,
  onSelect,
  loading,
}: SubjectSidebarProps) {
  return (
    <Card className="rounded-xl p-5 border-2 lg:sticky lg:top-20">
      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b">
        <div className="flex items-center gap-2 font-display font-bold text-foreground">
          <span className="text-lg" aria-hidden>
            📗
          </span>{" "}
          {COPY.subjectSidebarTitle}
        </div>
      </div>

      {/* Đang tải thì dựng vỏ, KHÔNG trả null: null làm sập cột 260px của lưới
          và layout giật một nhịp khi dữ liệu về. */}
      {loading ? (
        <div className="space-y-1" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-xl bg-muted/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {subjects.map((s) => {
            const Icon = getSubjectIcon(s.code);
            const isActive = selected === s.code;
            return (
              <button
                key={s.code}
                type="button"
                aria-pressed={isActive}
                // Chọn MỘT môn, bấm lại môn đang chọn thì bỏ chọn.
                onClick={() => onSelect(isActive ? null : s.code)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                  isActive
                    ? "bg-secondary font-bold text-foreground"
                    : "text-foreground/80 hover:bg-secondary"
                }`}
              >
                <span
                  aria-hidden
                  className={`size-4 rounded-md border-2 shrink-0 flex items-center justify-center ${
                    isActive
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  }`}
                />
                <Icon className="size-4 shrink-0" aria-hidden />
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
