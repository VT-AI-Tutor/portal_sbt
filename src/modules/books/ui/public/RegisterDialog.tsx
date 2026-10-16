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

interface RegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mở lại hộp đăng nhập sau khi xác minh xong. */
  onRegistered?: () => void;
}

/**
 * Tự đăng ký tài khoản người học (IDENT-R16): bước 1 nhập thông tin → máy chủ gửi mã xác
 * minh tới định danh; bước 2 nhập mã để kích hoạt (IDENT-R16 xác minh định danh). Mật khẩu
 * tự đặt tối thiểu 8 ký tự (khớp kiểm tra phía máy chủ). Năm sinh phục vụ luồng đồng thuận
 * (IDENT-R19) do máy chủ quyết định.
 */
export function RegisterDialog({
  open,
  onOpenChange,
  onRegistered,
}: RegisterDialogProps) {
  const [step, setStep] = useState<"form" | "verify">("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStep("form");
    setFullName("");
    setEmail("");
    setPhone("");
    setBirthYear("");
    setPassword("");
    setConfirm("");
    setCode("");
    setError(null);
    setNotice(null);
    setSubmitting(false);
  }

  async function handleRegister(e: FormEvent) {
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
      const message = await authApi.register({
        email: email.trim(),
        password,
        birth_year: Number(birthYear),
        full_name: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setNotice(message ?? "Đã gửi mã xác minh tới định danh đã đăng ký.");
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.verifyRegistration(email.trim(), code.trim());
      reset();
      onOpenChange(false);
      onRegistered?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác minh thất bại.");
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
          <DialogTitle className="text-xl font-bold">
            Đăng ký tài khoản
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Tạo tài khoản học sinh để làm bài tập."
              : "Nhập mã xác minh vừa được gửi để kích hoạt tài khoản."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-fullname">Họ và tên</Label>
              <Input
                id="reg-fullname"
                type="text"
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="reg-phone">Số điện thoại</Label>
                <Input
                  id="reg-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="09xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-birthyear">Năm sinh</Label>
                <Input
                  id="reg-birthyear"
                  type="number"
                  inputMode="numeric"
                  placeholder="2014"
                  required
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password">Mật khẩu</Label>
              <Input
                id="reg-password"
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
              <Label htmlFor="reg-confirm">Nhập lại mật khẩu</Label>
              <Input
                id="reg-confirm"
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
              {submitting ? "Đang gửi…" : "Đăng ký"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            {notice && (
              <p className="text-sm text-muted-foreground text-center">
                {notice}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="reg-code">Mã xác minh</Label>
              <Input
                id="reg-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={submitting}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Đang xác minh…" : "Xác minh & kích hoạt"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
