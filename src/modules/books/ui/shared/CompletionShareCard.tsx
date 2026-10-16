/**
 * CompletionShareCard — thẻ "khoe" thành tích sau khi HS hoàn thành bài tập.
 * Dùng làm ảnh xem trước trong ShareCompletionDialog và là node được chụp
 * thành ảnh khi bấm "Tải ảnh". Style tự chứa (không phụ thuộc token app) để
 * html-to-image render đúng màu.
 */
import { forwardRef } from "react";
import { BookOpenText, CheckCircle2, Clock } from "lucide-react";

interface CompletionShareCardProps {
  /** Tên bài tập / bài học hiển thị lớn giữa thẻ. */
  title: string;
  /** Chữ viết tắt tên HS (vd "H.N.") cho vòng avatar. Bỏ trống khi ẩn tên. */
  initials?: string | null;
  /** Họ tên đầy đủ HS (vd "Hoàng Nguyên") hiện dưới avatar. Bỏ trống khi ẩn tên. */
  name?: string | null;
  /** Thời điểm nộp bài đã format sẵn (vd "18:04 - 30/07/2026"). */
  submittedAtLabel: string;
  /** Điểm hiển thị (vd "9 / 10"). Bỏ trống khi không hiển thị điểm. */
  scoreLabel?: string | null;
}

export const CompletionShareCard = forwardRef<
  HTMLDivElement,
  CompletionShareCardProps
>(function CompletionShareCard(
  { title, initials, name, submittedAtLabel, scoreLabel },
  ref,
) {
  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-sky-50 to-emerald-50 px-6 pb-8 pt-5 text-center shadow-sm ring-1 ring-sky-100"
    >
      {/* Header thương hiệu */}
      <div className="flex items-center justify-center gap-1.5 text-sky-700">
        <BookOpenText className="size-4" />
        <span className="text-xs font-bold tracking-wide">Sách bài tập</span>
      </div>

      {/* Dấu tick hoàn thành */}
      <div className="mt-5 flex justify-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-white shadow-sm ring-4 ring-emerald-100">
          <CheckCircle2
            className="size-10 text-emerald-500"
            strokeWidth={2.5}
          />
        </div>
      </div>

      <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-emerald-600">
        Đã hoàn thành bài tập
      </p>
      <h3 className="mt-1 text-xl font-black leading-tight text-slate-800">
        {title}
      </h3>

      <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400">
        <Clock className="size-3.5" />
        <span>{submittedAtLabel}</span>
      </div>

      {scoreLabel && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
          Điểm: {scoreLabel}
        </div>
      )}

      {/* Avatar viết tắt + họ tên đầy đủ dưới avatar (QA SBT_2 C32). */}
      {(initials || name) && (
        <div className="mt-4 flex flex-col items-center gap-2">
          {initials && (
            <div className="flex size-16 items-center justify-center rounded-full bg-sky-200/70 text-lg font-black text-sky-700 ring-4 ring-white">
              {initials}
            </div>
          )}
          {name && (
            <p className="max-w-full truncate text-sm font-bold text-slate-700">
              {name}
            </p>
          )}
        </div>
      )}

      <p className="mt-5 text-sm font-semibold leading-snug text-emerald-600">
        Mỗi bài tập hoàn thành
        <br />
        là một bước tiến mới!
      </p>
    </div>
  );
});
