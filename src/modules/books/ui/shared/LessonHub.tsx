import type { LucideIcon } from "lucide-react";
import { LogIn } from "lucide-react";
import { isUnnumberedLessonTitle } from "./lessonNumbering";
import { LessonTitleText } from "./LessonTitleText";

/**
 * Menu đầu bài học ("hub").
 *
 * Trước đây vào bài là TỰ MỞ luôn PDF hoặc bài tập (useEffect chọn tab), user
 * không được chọn. Owner 03/8: vào bài phải thấy menu, bấm rồi mới vào màn.
 *
 * Component này THUẦN TRÌNH BÀY: danh sách mục do BookLessonPage dựng (nơi có
 * sẵn cờ dữ liệu), hub chỉ vẽ và gọi `onSelect`. Nhờ vậy test được độc lập,
 * không phải dựng cả trang.
 */

export interface LessonHubItem {
  /** Khoá ổn định để React key + test truy vết; không dùng để điều hướng. */
  key: string;
  label: string;
  /** Dòng phụ: "13 câu hỏi", "Đã làm 5/13 câu"… */
  description?: string;
  icon: LucideIcon;
  /** `primary` = việc chính của bài (làm bài / tiếp tục). */
  variant?: "primary" | "default";
  onSelect: () => void;
}

export function LessonHub({
  lessonTitle,
  lessonNumber,
  showLessonNumber = true,
  items,
  isGuest,
  onLoginClick,
}: {
  lessonTitle: string;
  /** Số bài trong mục lục; thiếu thì nhãn lùi về "Bài học". */
  lessonNumber?: number;
  /**
   * Tắt thì bỏ hẳn dòng nhãn trên tên bài — không lùi về "Bài học", vì môn tắt
   * nhãn là môn có số bài lệch tên bài, mọi biến thể của dòng đó đều thừa.
   */
  showLessonNumber?: boolean;
  items: LessonHubItem[];
  isGuest: boolean;
  onLoginClick?: () => void;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 animate-pop-in">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          {showLessonNumber ? (
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              {lessonNumber
                ? `Bài ${lessonNumber}`
                : isUnnumberedLessonTitle(lessonTitle)
                  ? "Ôn tập"
                  : "Bài học"}
            </p>
          ) : null}
          <h2 className="font-display text-xl md:text-2xl font-black text-lesson-title leading-tight">
            <LessonTitleText title={lessonTitle} />
          </h2>
        </div>

        <div className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const primary = item.variant === "primary";
            return (
              <button
                key={item.key}
                type="button"
                data-hub-item={item.key}
                onClick={item.onSelect}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer ${
                  primary
                    ? "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90"
                    : "border border-primary/20 bg-primary/5 hover:bg-primary/10"
                }`}
              >
                <span
                  className={`shrink-0 flex items-center justify-center size-10 rounded-xl ${
                    primary ? "bg-white/20" : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-tight">
                    {item.label}
                  </span>
                  {item.description ? (
                    <span
                      className={`block text-xs leading-tight mt-0.5 ${
                        primary
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* Khách: không bày nút bấm không được (Owner 03/8) — chỉ một dòng mời
            đăng nhập, đúng câu chữ runner vẫn dùng. */}
        {isGuest ? (
          <button
            type="button"
            onClick={onLoginClick}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            <LogIn className="size-3.5" />
            Đăng nhập để lưu bài làm và xem lịch sử
          </button>
        ) : null}
      </div>
    </div>
  );
}
