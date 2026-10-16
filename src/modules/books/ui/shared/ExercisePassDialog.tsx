import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { getExercisePass } from "@/core/api/config";

/**
 * Tiền tố cờ "cuốn sách này đã nhập đúng mật khẩu". Nhớ theo TỪNG SÁCH: mở khoá
 * một cuốn không mở các cuốn khác, nhưng trong cùng cuốn thì nhập đúng một lần
 * là mở nốt các bài còn lại (không hỏi lại ở mỗi bài).
 */
const PASS_ENTERED_PREFIX = "evo_exercise_pass_ok:";

export function hasEnteredExercisePass(bookKey: string | null): boolean {
  if (!bookKey) return false;
  try {
    return localStorage.getItem(PASS_ENTERED_PREFIX + bookKey) === "1";
  } catch {
    return false;
  }
}

function rememberExercisePassEntered(bookKey: string): void {
  try {
    localStorage.setItem(PASS_ENTERED_PREFIX + bookKey, "1");
  } catch {
    // storage unavailable — modal sẽ hỏi lại ở lần bắt đầu sau
  }
}

interface ExercisePassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cuốn sách được mở khoá khi nhập đúng — khoá nhớ trong localStorage. */
  bookKey: string;
  /** Gọi khi nhập ĐÚNG mật khẩu — cha đóng modal rồi chạy hành động bị chặn. */
  onVerified: () => void;
}

/**
 * Gate mật khẩu bài tập (chỉ hệ LCMS): chặn "Làm bài tập"/"Làm bài mới"/"Làm
 * lại từ đầu" của các bài NGOÀI hạn mức làm thử (xem `exerciseLockGate`) tới khi
 * nhập đúng mật khẩu 4 số cấu hình qua .env (VITE_EXERCISE_PASS). Đóng modal mà
 * chưa nhập đúng = hành động KHÔNG chạy.
 */
export function ExercisePassDialog({
  open,
  onOpenChange,
  bookKey,
  onVerified,
}: ExercisePassDialogProps) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPass("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass !== getExercisePass()) {
      setError("Mật khẩu chưa đúng. Em kiểm tra lại nhé.");
      return;
    }
    rememberExercisePassEntered(bookKey);
    setPass("");
    setError(null);
    onVerified();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" /> THÔNG BÁO
          </DialogTitle>
          <DialogDescription>
            Sách hiện chỉ mở một phần để trải nghiệm. Vui lòng nhập mã để tiếp
            tục học
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pass}
            onChange={(e) => {
              // Mật khẩu là 4 SỐ — chặn ký tự khác ngay lúc gõ (bàn phím số
              // trên mobile đã đúng nhờ inputMode, đây là chốt cho desktop).
              setPass(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
            placeholder="Mật khẩu thử nghiệm"
            autoFocus
            aria-label="Mật khẩu thử nghiệm"
          />
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full rounded-full font-bold">
            Xác nhận
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
