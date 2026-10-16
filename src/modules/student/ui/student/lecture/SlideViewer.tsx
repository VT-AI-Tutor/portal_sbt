/**
 * Carousel slide đơn giản của bài giảng — CHỈ lo lật slide, không biết gì về
 * quiz hay blocks (đó là việc của `StudentLectureViewer`). Tự viết, không
 * thêm thư viện mới: state `current` + nút trước/sau + phím mũi tên trái/phải.
 *
 * 4 kiểu layout: title (trang mở đầu), bullets (gạch đầu dòng), text (đoạn
 * văn), example (ví dụ minh hoạ, nền `bg-muted`).
 *
 * I5 (review cuối) — `StudentLectureViewer` render MỘT `SlideViewer` cho MỖI
 * hoạt động (thường 4 bộ trên cùng trang). Gắn phím lên `window` (cũ) lật cả
 * bốn cùng lúc. Sửa: gắn `onKeyDown` NGAY trên phần tử chứa (không phải
 * `window`) và cho nó nhận tiêu điểm (`tabIndex`) — mũi tên chỉ lật bộ đang
 * có tiêu điểm, vì sự kiện bàn phím chỉ bubble lên tổ tiên của phần tử đang
 * focus chứ không lan sang bộ anh em. Kèm chặn tường minh khi target là
 * input/textarea/vùng soạn thảo (phòng khi nội dung tương lai lồng ô nhập
 * liệu trong chính carousel).
 */
import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/core/ui/button";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import type { LectureSlide } from "@/modules/teacher/api/teacherLectureApi";

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function SlideViewer({ slides }: { slides: LectureSlide[] }) {
  const total = slides.length;
  const [current, setCurrent] = useState(0);

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (isTextEntryTarget(e.target)) return;
    if (e.key === "ArrowLeft") setCurrent((c) => Math.max(0, c - 1));
    else if (e.key === "ArrowRight")
      setCurrent((c) => Math.min(total - 1, c + 1));
  }

  if (total === 0) return null;

  const slide = slides[Math.min(current, total - 1)];

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="rounded-2xl border-2 border-border/70 bg-card p-5 md:p-6 space-y-4 outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="min-h-[180px] flex flex-col justify-center">
        {slide.layout === "title" && (
          <h2 className="font-display text-2xl font-bold text-center">
            <RichTextValue value={slide.title} />
          </h2>
        )}

        {slide.layout === "bullets" && (
          <div>
            <h3 className="font-display text-lg font-bold mb-3">
              <RichTextValue value={slide.title} />
            </h3>
            <ul className="list-disc pl-5 space-y-1.5">
              {(slide.bullets ?? []).map((bullet, i) => (
                <li key={i}>
                  <RichTextValue value={bullet} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {slide.layout === "text" && (
          <div>
            <h3 className="font-display text-lg font-bold mb-3">
              <RichTextValue value={slide.title} />
            </h3>
            <RichTextValue value={slide.content ?? ""} as="p" />
          </div>
        )}

        {slide.layout === "example" && (
          <div className="rounded-xl bg-muted p-4">
            <h3 className="font-display text-lg font-bold mb-2">
              <RichTextValue value={slide.title} />
            </h3>
            <RichTextValue value={slide.content ?? ""} as="p" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-full gap-1"
          disabled={current === 0}
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
        >
          <ChevronLeft className="size-4" />
          Trước
        </Button>
        <span className="text-sm font-bold text-muted-foreground tabular-nums">
          {current + 1} / {total}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-full gap-1"
          disabled={current === total - 1}
          onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
        >
          Sau
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
