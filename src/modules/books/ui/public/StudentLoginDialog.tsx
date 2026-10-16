import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { getApiProvider } from "@/core/api/config";
import { useAuth } from "@/core/auth/AuthContext";
import { postLoginPathForUser } from "@/core/auth/roles";
import type { AuthUser } from "@/core/auth/types";
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
import { RegisterDialog } from "@/modules/books/ui/public/RegisterDialog";
import { ForgotPasswordDialog } from "@/modules/books/ui/public/ForgotPasswordDialog";
import { SetInitialPasswordDialog } from "@/modules/books/ui/public/SetInitialPasswordDialog";

interface StudentLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Chạy sau khi đăng nhập thành công, nhận hồ sơ người dùng vừa đăng nhập.
   * Mặc định điều hướng về khu đúng vai trò (AUTH-STUDENT-LOGIN, GAP-142 —
   * giáo viên/quản lý không bị đưa về khu học sinh). Trang bài học truyền hàm
   * rỗng để ở lại làm bài.
   */
  onLoggedIn?: (user: AuthUser | null) => void;
}

/** Google "G" mark for the LCMS redirect button (GoogleLogin renders its own). */
function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.21 7.21 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function StudentLoginDialog({
  open,
  onOpenChange,
  onLoggedIn,
}: StudentLoginDialogProps) {
  const {
    login,
    loginWithGoogle,
    usesGoogleRedirectLogin,
    beginGoogleLoginRedirect,
  } = useAuth();
  const navigate = useNavigate();

  const handleLoggedIn =
    onLoggedIn ??
    ((user: AuthUser | null) => navigate(postLoginPathForUser(user)));

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [setInitialOpen, setSetInitialOpen] = useState(false);

  // LCMS chưa hỗ trợ tự đăng ký (chỉ provider native).
  const selfServiceEnabled = getApiProvider() !== "lcms";
  // "Quên mật khẩu?" bật cho mọi brand: native chạy flow mã khôi phục + mật khẩu
  // mới; LCMS gửi thẳng mật khẩu mới qua email (ForgotPasswordDialog tự phân nhánh
  // theo provider).
  const forgotEnabled = true;
  // "Đặt mật khẩu lần đầu?" chỉ có nghĩa với provider native — LCMS cấp tài khoản kèm mật
  // khẩu mặc định rồi ép đổi ở lần đăng nhập đầu (FirstLoginGate), không có mã đặt lần đầu.
  const setInitialEnabled = selfServiceEnabled;

  // Đóng hộp đăng nhập RỒI mới mở hộp kế tiếp: hai hộp thoại Radix không thể đóng-mở cùng
  // một nhịp (hộp mới bị nuốt). Chờ hết hoạt ảnh đóng (~200ms) rồi mở hộp còn lại.
  function switchTo(openNext: () => void) {
    setError(null);
    onOpenChange(false);
    window.setTimeout(openNext, 210);
  }

  function reset() {
    setIdentifier("");
    setPassword("");
    setShowPassword(false);
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await login(identifier.trim(), password);
      reset();
      onOpenChange(false);
      handleLoggedIn(loggedInUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleRedirect() {
    setError(null);
    setRedirecting(true);
    try {
      // Come back to the page the dialog was opened on after the round-trip.
      await beginGoogleLoginRedirect(
        window.location.pathname +
          window.location.search +
          window.location.hash,
      );
      // Navigation away is in flight — keep the button disabled.
    } catch (err) {
      setRedirecting(false);
      setError(
        err instanceof Error ? err.message : "Đăng nhập Google thất bại.",
      );
    }
  }

  async function handleGoogleSuccess(response: CredentialResponse) {
    if (!response.credential) {
      setError("Không nhận được thông tin từ Google.");
      return;
    }
    setError(null);
    try {
      const loggedInUser = await loginWithGoogle(response.credential);
      reset();
      onOpenChange(false);
      handleLoggedIn(loggedInUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!submitting) {
            onOpenChange(v);
            if (!v) reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <DialogTitle className="text-xl font-bold">Đăng nhập</DialogTitle>
            <DialogDescription>Đăng nhập để làm bài tập.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-identifier">Email / Số điện thoại</Label>
              <Input
                id="login-identifier"
                type="text"
                autoComplete="username"
                placeholder="email@example.com hoặc 09xxxxxxxx"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Mật khẩu</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={submitting}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:text-foreground disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
            </Button>
          </form>

          {(selfServiceEnabled || forgotEnabled) && (
            <div
              className={`flex items-center text-sm ${selfServiceEnabled ? "justify-between" : "justify-end"}`}
            >
              {selfServiceEnabled && (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => switchTo(() => setRegisterOpen(true))}
                >
                  Chưa có tài khoản? Đăng ký
                </button>
              )}
              {forgotEnabled && (
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={() => switchTo(() => setForgotOpen(true))}
                >
                  Quên mật khẩu?
                </button>
              )}
            </div>
          )}

          {/* Dòng RIÊNG, không chen vào hàng "Đăng ký / Quên mật khẩu": ba mục trên một hàng
              justify-between làm chữ vỡ dòng lộn xộn ở bề ngang hộp thoại (sm:max-w-md). */}
          {setInitialEnabled && (
            <div className="text-center text-sm">
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                onClick={() => switchTo(() => setSetInitialOpen(true))}
              >
                Tài khoản nhà trường cấp? Đặt mật khẩu lần đầu
              </button>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                hoặc
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            {usesGoogleRedirectLogin ? (
              // LCMS: full-page redirect flow (login/google → consent → /google/authen)
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={redirecting || submitting}
                onClick={handleGoogleRedirect}
              >
                <GoogleIcon />
                {redirecting
                  ? "Đang chuyển đến Google…"
                  : "Đăng nhập với Google"}
              </Button>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Đăng nhập Google thất bại.")}
                size="large"
                width="360"
                text="signin_with"
                shape="rectangular"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onRegistered={() => window.setTimeout(() => onOpenChange(true), 210)}
      />
      <ForgotPasswordDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        onReset={() => window.setTimeout(() => onOpenChange(true), 210)}
      />
      <SetInitialPasswordDialog
        open={setInitialOpen}
        onOpenChange={setSetInitialOpen}
        onDone={() => window.setTimeout(() => onOpenChange(true), 210)}
      />
    </>
  );
}
