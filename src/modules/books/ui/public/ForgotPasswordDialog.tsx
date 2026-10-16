import { useState, type FormEvent } from "react";
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

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mở lại hộp đăng nhập sau khi đặt lại mật khẩu xong. */
  onReset?: () => void;
}

/**
 * Quên & đặt lại mật khẩu — hai hình tuỳ provider (xem `forgotPasswordEmailsNewPassword`):
 *
 * - native (IDENT-R17): bước 1 nhập định danh → máy chủ luôn phản hồi như thành công để
 *   KHÔNG tiết lộ tài khoản có tồn tại hay không; bước 2 nhập mã khôi phục + mật khẩu mới
 *   (tối thiểu 8 ký tự, khớp kiểm tra phía máy chủ).
 * - LCMS: một bước — nhập email, máy chủ tự đặt lại và gửi MẬT KHẨU MỚI vào hộp thư; màn
 *   kế tiếp báo đã gửi và mời đăng nhập lại bằng mật khẩu vừa nhận.
 */
export function ForgotPasswordDialog({
  open,
  onOpenChange,
  onReset,
}: ForgotPasswordDialogProps) {
  const [step, setStep] = useState<"request" | "reset" | "sent">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // LCMS gửi thẳng mật khẩu mới qua email ⇒ dừng ở màn "đã gửi", không có bước
  // nhập mã (provider native giữ flow hai bước).
  const emailsNewPassword = authApi.forgotPasswordEmailsNewPassword();

  function reset() {
    setStep("request");
    setEmail("");
    setCode("");
    setPassword("");
    setConfirm("");
    setError(null);
    setNotice(null);
    setSubmitting(false);
  }

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const message = await authApi.forgotPassword(email.trim());
      if (emailsNewPassword) {
        setNotice(
          message ??
            "Mật khẩu mới đã được gửi tới hộp thư của bạn. Vui lòng kiểm tra cả mục thư rác.",
        );
        setStep("sent");
      } else {
        setNotice(
          message ?? "Nếu tài khoản tồn tại, mã khôi phục đã được gửi.",
        );
        setStep("reset");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi yêu cầu thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Mật khẩu cần tối thiểu 8 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword(email.trim(), code.trim(), password);
      reset();
      onOpenChange(false);
      onReset?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Đặt lại mật khẩu thất bại.",
      );
    } finally {
      setSubmitting(false);
    }
  }

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
          <DialogTitle className="text-xl font-bold">Quên mật khẩu</DialogTitle>
          <DialogDescription>
            {step === "request"
              ? emailsNewPassword
                ? "Nhập email để nhận mật khẩu mới."
                : "Nhập email để nhận mã khôi phục."
              : step === "sent"
                ? "Đăng nhập bằng mật khẩu vừa nhận, hệ thống sẽ yêu cầu bạn đổi mật khẩu ngay sau đó."
                : "Nhập mã khôi phục và mật khẩu mới."}
          </DialogDescription>
        </DialogHeader>

        {step === "request" ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting
                ? "Đang gửi…"
                : emailsNewPassword
                  ? "Đặt lại mật khẩu"
                  : "Gửi mã khôi phục"}
            </Button>
          </form>
        ) : step === "sent" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {notice}
            </p>
            <p className="text-sm text-muted-foreground">
              Không nhận được email? Liên hệ{" "}
              <a
                href="mailto:lienhe@nxbgd.vn"
                className="text-primary hover:underline"
              >
                lienhe@nxbgd.vn
              </a>{" "}
              hoặc{" "}
              <a
                href="tel:02438220801"
                className="text-primary hover:underline"
              >
                024.3822.0801
              </a>
              .
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onOpenChange(false);
                  reset();
                }}
              >
                Đóng
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  onOpenChange(false);
                  reset();
                  onReset?.();
                }}
              >
                Đăng nhập
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {notice && (
              <p className="text-sm text-muted-foreground text-center">
                {notice}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="forgot-code">Mã khôi phục</Label>
              <Input
                id="forgot-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forgot-password">Mật khẩu mới</Label>
              <Input
                id="forgot-password"
                type="password"
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forgot-confirm">Nhập lại mật khẩu mới</Label>
              <Input
                id="forgot-confirm"
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
              {submitting ? "Đang đặt lại…" : "Đặt lại mật khẩu"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
