/**
 * Dialog "Đổi mật khẩu" (LCMS) — dùng endpoint riêng change-password (yêu cầu
 * mật khẩu hiện tại). Mở từ UserHeaderMenu: đổi xong ⇒ đăng xuất + về trang chủ.
 *
 * Chế độ `forced` (lần đăng nhập đầu): không cho đóng (X/Esc/click-ngoài), điền
 * sẵn + ẩn ô mật khẩu hiện tại (`presetOldPassword`, mật khẩu mặc định), luôn có
 * lối thoát "Đăng xuất"; đổi xong ⇒ xóa cờ must-change và giữ phiên (token chưa
 * đổi) thay vì bắt đăng nhập lại.
 */
import { useEffect, useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  clearLcmsMustChangePassword,
  lcmsChangePassword,
  LcmsApiError,
} from "@/core/api/lcmsAdapter";
import { useAuth } from "@/core/auth/AuthContext";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";

/** Cùng ngưỡng với RegisterDialog / ForgotPasswordDialog. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * CHỈ tin message của LcmsApiError (adapter đã lọc/chuẩn hoá); lỗi khác là hạ
 * tầng — mất mạng ném TypeError("Failed to fetch"), không đưa vào toast.
 * Body 400 của LCMS có khi không kèm message ⇒ tự diễn giải sang tiếng Việt.
 */
function changePasswordErrorMessage(error: unknown): string {
  if (!(error instanceof LcmsApiError)) {
    return "Không kết nối được máy chủ. Em kiểm tra mạng rồi thử lại nhé.";
  }
  const serverMessage = error.message.trim();
  if (serverMessage !== "" && !/^LCMS API error \d+$/.test(serverMessage)) {
    return serverMessage;
  }
  if (error.statusCode === 400) {
    return "Đổi mật khẩu không thành công: mật khẩu hiện tại chưa đúng, hoặc mật khẩu mới chưa đạt yêu cầu an toàn của hệ thống.";
  }
  return "Đổi mật khẩu thất bại. Vui lòng thử lại.";
}

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chế độ ép đổi mật khẩu lần đầu: không cho đóng, có lối thoát Đăng xuất. */
  forced?: boolean;
  /** Điền sẵn + ẩn ô "mật khẩu hiện tại" (lần đầu dùng mật khẩu mặc định). */
  presetOldPassword?: string;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  forced = false,
  presetOldPassword,
}: ChangePasswordDialogProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState(presetOldPassword ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Dọn ô mật khẩu mỗi lần mở lại (giữ mật khẩu điền sẵn ở chế độ forced).
  useEffect(() => {
    if (!open) return;
    setOldPassword(presetOldPassword ?? "");
    setNewPassword("");
    setConfirmPassword("");
  }, [open, presetOldPassword]);

  const signOut = () => {
    onOpenChange(false);
    void logout().finally(() => navigate("/"));
  };

  const handleSave = async () => {
    if (!oldPassword.trim()) {
      toast.error("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (!newPassword.trim()) {
      toast.error("Vui lòng nhập mật khẩu mới.");
      return;
    }
    // Chặn sớm thay vì để server trả 400 trống nghĩa.
    if (newPassword.trim().length < MIN_PASSWORD_LENGTH) {
      toast.error(`Mật khẩu mới cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      toast.error("Mật khẩu xác nhận không khớp.");
      return;
    }
    setSaving(true);
    try {
      await lcmsChangePassword({
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim(),
      });
      if (forced) {
        // Lần đầu: xóa cờ, giữ phiên hiện tại rồi đóng modal (không bắt login lại).
        clearLcmsMustChangePassword();
        toast.success("Đã đổi mật khẩu. Chúc bạn học tốt!");
        setSaving(false);
        onOpenChange(false);
      } else {
        toast.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
        onOpenChange(false);
        // Đổi MK ⇒ đăng xuất + về trang chủ (phiên cũ đã đổi credential).
        void logout().finally(() => navigate("/"));
      }
    } catch (error) {
      toast.error(changePasswordErrorMessage(error));
      setSaving(false);
    }
  };

  const preventClose = (e: Event) => e.preventDefault();

  const saveButton = (
    <Button onClick={handleSave} disabled={saving} className="gap-2">
      <KeyRound className="size-4" />
      {saving ? "Đang đổi…" : "Cập nhật mật khẩu"}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md max-h-[85vh] overflow-y-auto"
        {...(forced
          ? {
              hideClose: true,
              onEscapeKeyDown: preventClose,
              onPointerDownOutside: preventClose,
              onInteractOutside: preventClose,
            }
          : { "aria-describedby": undefined })}
      >
        <DialogHeader>
          <DialogTitle>
            {forced ? "Đổi mật khẩu lần đầu" : "Đổi mật khẩu"}
          </DialogTitle>
          {forced && (
            <DialogDescription>
              Vì đây là lần đăng nhập đầu tiên, bạn cần đặt mật khẩu mới trước
              khi tiếp tục.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {!presetOldPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="old-password">Mật khẩu hiện tại</Label>
              <Input
                id="old-password"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                placeholder="Nhập mật khẩu hiện tại"
                disabled={saving}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Mật khẩu mới</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={`Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              disabled={saving}
            />
            {confirmPassword &&
              newPassword.trim() !== confirmPassword.trim() && (
                <p className="text-xs font-medium text-destructive">
                  Mật khẩu xác nhận không khớp.
                </p>
              )}
          </div>
          {forced ? (
            // Lần đầu: nút phụ "Đăng xuất" bên trái, nút chính bên phải cùng hàng.
            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={signOut}
                disabled={saving}
                className="gap-2"
              >
                <LogOut className="size-4" />
                Đăng xuất
              </Button>
              {saveButton}
            </div>
          ) : (
            saveButton
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
