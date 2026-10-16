import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { QuestionNavMark } from "./lessonSections";

interface QuestionNavStripProps {
  /** Tổng số câu. Dải chỉ có nghĩa khi > 1. */
  count: number;
  /** Chỉ số câu đang mở (0-based). */
  current: number;
  /** Câu thứ i đã có đáp án chưa — để tô chấm "đã làm". */
  isAnswered: (index: number) => boolean;
  /** Nhảy tới câu i (0-based). */
  onGoTo: (index: number) => void;
  /**
   * Số hiện trên từng chấm khi bài chia theo mạch (ĐỌC, VIẾT…): số đếm lại từ
   * 1 mỗi mạch, và có vạch ngăn giữa hai mạch. Bỏ trống = đánh số toàn bài.
   */
  marks?: QuestionNavMark[];
  className?: string;
}

/**
 * Dải "chấm tròn" nhảy nhanh tới câu bất kỳ (I.6.13), DÙNG CHUNG cho cả hai
 * runner sách bài tập (SubmissionRunner đăng-nhập + StandaloneExerciseRunner
 * khách) để không lệch UX — trước đây mỗi runner tự vẽ một bản, dễ drift.
 *
 * Đặt gọn trên một HÀNG NGANG trong header để tiết kiệm chiều dọc. Khi nhiều
 * câu quá, KHÔNG xuống dòng và KHÔNG bắt học sinh kéo thanh cuộn: hai nút ‹ ›
 * dịch cửa sổ hiển thị, còn câu đang mở luôn được cuộn vào giữa tầm nhìn.
 *
 * Mọi chấm vẫn nằm trong DOM (chỉ ẩn khỏi tầm nhìn khi tràn) để phím Tab và
 * test truy cập được đủ nút.
 */
export function QuestionNavStrip({
  count,
  current,
  isAnswered,
  onGoTo,
  marks,
  className = "",
}: QuestionNavStripProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  // Phát hiện tràn để bật/tắt nút ‹ ›. jsdom (test) không có ResizeObserver và
  // scrollWidth/clientWidth = 0 → overflow=false, dải hiện phẳng như cũ.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
    // `marks` cũng đổi bề rộng dải (số theo mạch + vạch ngăn) mà ResizeObserver
    // không thấy: nó canh border-box, vốn bị `flex-1` ghim cứng.
  }, [count, marks]);

  // Câu đang mở luôn nằm trong tầm nhìn: cuộn chấm hiện tại vào giữa.
  useEffect(() => {
    const el = trackRef.current?.querySelector<HTMLElement>(
      `[data-idx="${current}"]`,
    );
    el?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [current]);

  const page = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    // Dịch gần trọn một trang, chừa một chấm gối đầu để không "nhảy hụt".
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (count <= 1) return null;

  return (
    <div
      className={`flex items-center gap-1 min-w-0 ${className}`}
      role="group"
      aria-label="Nhảy nhanh tới câu"
    >
      {overflow && (
        <button
          type="button"
          aria-label="Xem các câu trước đó"
          onClick={() => page(-1)}
          className="shrink-0 grid place-items-center size-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}

      <div
        ref={trackRef}
        className="flex gap-1.5 overflow-x-auto min-w-0 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: count }, (_, i) => {
          const isCurrent = i === current;
          const answered = isAnswered(i);
          const mark = marks?.[i];
          const newLine = !!mark && i > 0 && marks[i - 1]?.group !== mark.group;
          return (
            <div key={i} className="flex shrink-0 items-center gap-1.5">
              {newLine && (
                <span
                  aria-hidden="true"
                  className="mx-1.5 h-7 w-0.5 shrink-0 rounded-full bg-muted-foreground"
                />
              )}
              <button
                type="button"
                data-idx={i}
                aria-label={
                  mark
                    ? `Tới bài ${mark.label} của ${mark.group}`
                    : `Tới câu ${i + 1}`
                }
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => onGoTo(i)}
                className={`shrink-0 size-7 rounded-full border-2 text-xs font-bold transition-all cursor-pointer ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : answered
                      ? "border-primary/60 bg-card text-primary hover:border-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/60"
                }`}
              >
                {mark ? mark.label : i + 1}
              </button>
            </div>
          );
        })}
      </div>

      {overflow && (
        <button
          type="button"
          aria-label="Xem các câu sau"
          onClick={() => page(1)}
          className="shrink-0 grid place-items-center size-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
