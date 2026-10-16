/**
 * I.3.2 — đổi ảnh đại diện. Dùng CHUNG cho cả hai màn hồ sơ (AppShell của khu
 * học sinh và ProfileDialog của luồng sách bài tập): hệ này đã có tiền lệ hai
 * bản song song lệch nhau, nên phần avatar chỉ viết một lần.
 *
 * Hai bước tách rời khớp với backend: tải ảnh lên trước (trả url), rồi mới gắn
 * vào hồ sơ. Học sinh chọn ảnh, xem thử, đổi ý — hồ sơ chưa bị đụng cho tới khi
 * bấm lưu.
 *
 * Provider nào chưa có API (LCMS, chờ NXB bổ sung) thì `supportsAvatarUpload()`
 * trả false và component hiện trạng thái vô hiệu kèm lời giải thích, thay vì
 * bày ra một nút bấm vào là lỗi.
 */
import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/core/ui/avatar";
import { Button } from "@/core/ui/button";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import { supportsAvatarUpload, uploadAvatar } from "@/core/auth/api";
import {
  isPayloadTooLarge,
  PAYLOAD_TOO_LARGE_MESSAGE,
} from "@/core/api/uploadErrors";
import { getStoredSession } from "@/core/auth/storage";

/** Trần dung lượng khớp backend (5 MB) — chặn sớm để khỏi tốn một vòng mạng. */
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[parts.length - 1][0] ?? "?").toUpperCase();
}

export function AvatarPicker({
  displayName,
  avatarUrl,
  onChange,
  disabled = false,
}: {
  displayName: string;
  /** Url đang lưu trên hồ sơ (có thể là đường dẫn tương đối host). */
  avatarUrl?: string | null;
  /** Gọi khi có ảnh mới (url) hoặc khi gỡ ảnh (null). Cha chịu trách nhiệm lưu. */
  onChange: (avatar: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const supported = supportsAvatarUpload();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Chỉ nhận ảnh JPG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Ảnh quá lớn — tối đa 5 MB.");
      return;
    }

    const token = getStoredSession().accessToken;
    if (!token) {
      toast.error("Phiên đăng nhập đã hết hạn. Em đăng nhập lại nhé.");
      return;
    }

    setUploading(true);
    try {
      onChange(await uploadAvatar(token, file));
      toast.success("Đã tải ảnh lên. Nhớ bấm lưu nhé!");
    } catch (e) {
      // Đường legacy dựng câu lỗi qua authErrorMessage: 413 thân rỗng rơi vào
      // câu mặc định "Đã xảy ra lỗi khi đăng nhập (mã 413)" — vừa lộ mã, vừa nói
      // nhầm thành lỗi đăng nhập giữa lúc đang đổi ảnh.
      toast.error(
        isPayloadTooLarge(e)
          ? PAYLOAD_TOO_LARGE_MESSAGE
          : (e as Error).message || "Tải ảnh thất bại.",
      );
    } finally {
      setUploading(false);
      // Cho phép chọn lại ĐÚNG tệp vừa rồi (sau khi cắt/sửa) — không reset thì
      // trình duyệt coi là không đổi và không bắn change lần hai.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const busy = disabled || uploading || !supported;

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16 border-2 border-border">
        {avatarUrl ? (
          <AvatarImage src={resolveAssetUrl(avatarUrl)} alt={displayName} />
        ) : null}
        <AvatarFallback className="text-lg font-bold">
          {initialsOf(displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            data-testid="avatar-input"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            {avatarUrl ? "Đổi ảnh" : "Chọn ảnh"}
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-xl text-muted-foreground"
              disabled={busy}
              onClick={() => onChange(null)}
            >
              <Trash2 className="size-4" />
              Gỡ ảnh
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {supported
            ? "JPG, PNG hoặc WEBP, tối đa 5 MB."
            : "Hệ thống này chưa hỗ trợ đổi ảnh đại diện."}
        </p>
      </div>
    </div>
  );
}
