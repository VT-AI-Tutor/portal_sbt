import { useState, type FormEvent } from "react";
import { getApiProvider } from "@/core/api/config";
import * as authApi from "@/core/auth/api";
import { Button } from "@/core/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";

interface SetInitialPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mở lại hộp đăng nhập sau khi đặt mật khẩu xong. */
  onDone?: () => void;
}

/** Cùng ngưỡng với server (IDENT-R12): tài khoản do quản trị tạo cần mật khẩu ≥ 12 ký tự. */
const MIN_LENGTH = 12;

/**
 * Đặt mật khẩu lần đầu cho tài khoản do quản trị tạo (IDENT-R12). Giáo viên/học sinh nhận mã
 * một lần từ quản trị trường (hạn 72 giờ) rồi tự đặt mật khẩu ở đây.
 *
 * Khác "Quên mật khẩu": lối kia phát mã mới qua kênh gửi và chỉ dành cho tài khoản ĐÃ có mật
 * khẩu; lối này tiêu thụ mã có sẵn trong tay người dùng. Chừng nào kênh gửi email/SMS thật
 * chưa nối thì đây là đường duy nhất để tài khoản mới đăng nhập được lần đầu.
 */
export function SetInitialPasswordDialog({
  open,
  onOpenChange,
  onDone,
}: SetInitialPasswordDialogProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // LCMS cấp tài khoản kèm mật khẩu mặc định + ép đổi ở lần đăng nhập đầu (FirstLoginGate),
  // không có mã đặt lần đầu — giấu lối này cho provider đó.
  const isLcms = getApiProvider() === "lcms";

  function reset() {
    setEmail("");
    setCode("");
    setPassword("");
    setConfirm("");
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Mật khẩu cần tối thiểu ${MIN_LENGTH} ký tự.`);
      return;
    }
    if (password !== confirm) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.setInitialPassword(email.trim(), code.trim(), password);
      reset();
      onOpenChange(false);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đặt mật khẩu thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLcms) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (submitting) return;
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <DialogTitle className="text-xl font-bold">
            Đặt mật khẩu lần đầu
          </DialogTitle>
          <DialogDescription>
            Dành cho tài khoản do nhà trường tạo. Nhập mã đặt mật khẩu lần đầu
            mà quản trị đã cấp cho bạn.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="set-initial-email">Email</Label>
            <Input
              id="set-initial-email"
              type="email"
              autoComplete="email"
              placeholder="email@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-initial-code">Mã đặt mật khẩu lần đầu</Label>
            <Input
              id="set-initial-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 chữ số"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-initial-password">Mật khẩu</Label>
            <Input
              id="set-initial-password"
              type="password"
              autoComplete="new-password"
              placeholder={`Tối thiểu ${MIN_LENGTH} ký tự`}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-initial-confirm">Nhập lại mật khẩu</Label>
            <Input
              id="set-initial-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Đang đặt mật khẩu…" : "Đặt mật khẩu và đăng nhập"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
