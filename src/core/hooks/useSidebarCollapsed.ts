/**
 * Trạng thái thu gọn của menu chính (thanh bên), nhớ giữa các lần vào.
 *
 * Thu gọn KHÔNG phải ẩn: thanh bên co lại còn dải icon, mọi mục vẫn bấm được và
 * tên mục hiện ra ở tooltip. Đây là lựa chọn của người dùng nên phải sống lâu hơn
 * một lần tải trang — lưu localStorage.
 *
 * Khoá lưu tách theo app (learner/admin) vì hai khu có thể chung origin khi
 * deploy: dùng chung một khoá thì thu gọn bên này kéo theo bên kia.
 */
import { useCallback, useEffect, useState } from "react";

/** Khoá mặc định (khu người học). Khu quản trị truyền khoá riêng. */
export const SIDEBAR_COLLAPSED_KEY = "evo_sidebar_collapsed";

/**
 * Đọc localStorage phòng thủ: chế độ riêng tư của Safari và một số webview ném
 * lỗi ngay ở lần chạm đầu, hỏng luôn cả khung trang nếu để lọt.
 */
function readCollapsed(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function useSidebarCollapsed(storageKey: string = SIDEBAR_COLLAPSED_KEY) {
  // Đọc ngay trong initializer, KHÔNG để effect set sau: mở trang ở trạng thái
  // đã thu gọn mà render lượt đầu vẫn rộng thì thanh bên giật một nhịp.
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    typeof window === "undefined" ? false : readCollapsed(storageKey),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      // Không ghi được thì thôi — phiên này vẫn thu gọn/mở rộng bình thường.
    }
  }, [collapsed, storageKey]);

  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);

  return { collapsed, setCollapsed, toggleCollapsed };
}
