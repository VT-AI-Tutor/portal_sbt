/**
 * Cổng ép đổi mật khẩu lần đầu. Khi đã đăng nhập và còn nợ đổi mật khẩu (cờ từ
 * lcmsMustChangePassword), hiện ChangePasswordDialog ở chế độ `forced` (không cho
 * đóng). Chỉ mount cho provider LCMS (do AppProviders quyết định).
 */
import { useEffect, useState } from "react";
import { getLcmsDefaultPassword } from "@/core/api/config";
import { lcmsMustChangePassword } from "@/core/api/lcmsAdapter";
import { useAuth } from "@/core/auth/AuthContext";
import { ChangePasswordDialog } from "@/modules/books/ui/shared/ChangePasswordDialog";

export function FirstLoginGate() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  // localStorage không phản ứng → đọc lại cờ khi trạng thái đăng nhập đổi (đăng
  // nhập SPA / restoreSession sau reload) và khi cờ đổi ở tab khác ('storage').
  useEffect(() => {
    const sync = () => setOpen(isAuthenticated && lcmsMustChangePassword());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [isAuthenticated]);

  return (
    <ChangePasswordDialog
      open={open}
      onOpenChange={setOpen}
      forced
      presetOldPassword={getLcmsDefaultPassword()}
    />
  );
}
