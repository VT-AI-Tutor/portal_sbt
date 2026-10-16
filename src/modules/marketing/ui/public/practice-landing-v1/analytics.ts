/**
 * Analytics của bản v1: CỐ TÌNH KHÔNG BẮN GÌ.
 *
 * Trang này chỉ để tham chiếu ở /luyen-tap-cu, không phải landing đang chạy.
 * Nếu bắn thật thì `landing_view` / `signup_from_landing` của nó sẽ trộn lẫn
 * với số liệu của landing chính (cùng tên sự kiện) và làm sai báo cáo.
 *
 * Giữ nguyên chữ ký của `../practice-landing/analytics` để các section chép
 * sang không phải sửa gì.
 */
export type LandingEvent =
  | "landing_view"
  | "demo_start"
  | "demo_complete"
  | "trial_start"
  | "trial_complete"
  | "signup_from_landing";

export function trackLandingEvent(
  _event: LandingEvent,
  _params?: Record<string, string | number>,
): void {
  // no-op — xem ghi chú đầu file.
}
