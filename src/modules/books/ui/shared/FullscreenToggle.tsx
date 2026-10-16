import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Nút bật/tắt toàn màn hình, dùng chung cho MỌI viewer của bài học: vở PDF, đáp
 * án PDF, tham khảo, lịch sử làm bài, và màn làm bài.
 *
 * Trước đây chỉ PDF có nút, và nó mở một overlay render LẠI trình xem PDF. Cách
 * đó không dùng được cho màn làm bài: overlay sẽ mount runner thứ hai và bài
 * đang làm mất `attemptId` cùng đáp án. Cơ chế hiện tại đổi class trên chính thẻ
 * nội dung đang có, nên mọi viewer dùng chung được một nút.
 *
 * Hai biến thể chỉ khác CHỖ ĐẶT, không khác hành vi:
 * - `toolbar` (mặc định): thanh công cụ của PDF / tham khảo / lịch sử.
 * - `compact`: bên trong thanh của runner, cạnh nút "Thoát", khớp đúng cỡ và màu
 *   của nút đó.
 *
 * CHỈ ICON, không chữ hiện ra (Owner 07/8). `aria-label` vẫn giữ vì nó KHÔNG
 * hiện trên màn — bỏ nó thì người dùng trình đọc màn hình mất hẳn nút này.
 *
 * KHÔNG dùng nút nổi định vị tuyệt đối: bản đầu đặt `absolute top-2 right-2` và
 * nó **đè lên nút "Thoát"** của runner — nút Thoát nằm trong thanh flex chứ không
 * định vị tuyệt đối, nên mọi vị trí "góc trên bên phải" đều va vào nó.
 */
export function FullscreenToggle({
  active,
  onToggle,
  variant = "toolbar",
}: {
  active: boolean;
  onToggle: () => void;
  variant?: "toolbar" | "compact";
}) {
  const Icon = active ? Minimize2 : Maximize2;
  // Nhãn đổi theo trạng thái, không chỉ đổi icon — người dùng trình đọc màn hình
  // chỉ nghe được nhãn.
  const label = active ? "Thoát toàn màn hình" : "Toàn màn hình";

  if (variant === "compact") {
    // Khớp đúng lớp của nút "Thoát" trong thanh runner để hai nút trông cùng một bộ.
    return (
      <button
        type="button"
        onClick={onToggle}
        title={label}
        aria-label={label}
        className="relative z-10 pointer-events-auto shrink-0 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
      >
        <Icon className="size-3.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      className="relative z-10 pointer-events-auto inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
    >
      <Icon className="size-4" />
    </button>
  );
}
