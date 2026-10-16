/**
 * Ảnh đại diện trong hồ sơ LCMS. Hai bước tách rời đúng như backend: chọn ảnh
 * thì upload-avatar trả về id, hồ sơ chỉ đổi khi bấm "Lưu thông tin" — chọn
 * nhầm rồi đóng dialog thì ảnh đang lưu vẫn nguyên.
 *
 * Không dùng chung AvatarPicker của nhánh legacy: bên đó ảnh là URL công khai,
 * còn LCMS lưu id và cửa get-avatar đòi token, nên nguồn ảnh khác hẳn.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { LcmsApiError, lcmsUploadAvatar } from "@/core/api/lcmsAdapter";
import {
  isPayloadTooLarge,
  PAYLOAD_TOO_LARGE_MESSAGE,
} from "@/core/api/uploadErrors";
import { Avatar, AvatarFallback, AvatarImage } from "@/core/ui/avatar";
import { Button } from "@/core/ui/button";
import { Label } from "@/core/ui/label";
import { useLcmsAvatarUrl } from "./useLcmsAvatar";

/** Trần dung lượng khớp backend (5 MB) — chặn sớm để khỏi tốn một vòng mạng. */
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[parts.length - 1][0] ?? "?").toUpperCase();
}

export function LcmsAvatarField({
  displayName,
  avatarId,
  onUploaded,
  disabled = false,
  readOnly = false,
}: {
  displayName: string;
  /** Id ảnh đang lưu trên hồ sơ (từ /current) — tải ảnh qua get-avatar. */
  avatarId?: string | null;
  /** Gọi khi tải ảnh mới xong — cha giữ id để gửi kèm lúc lưu hồ sơ. */
  onUploaded?: (avatarId: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Xem thử ngay từ tệp vừa chọn, khỏi phải tải lại chính ảnh mình vừa gửi lên.
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);
  const pickedUrlRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (pickedUrlRef.current) URL.revokeObjectURL(pickedUrlRef.current);
    },
    [],
  );
  const storedUrl = useLcmsAvatarUrl(avatarId);
  const shownUrl = pickedUrl ?? storedUrl;

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

    setUploading(true);
    try {
      const uploadedId = await lcmsUploadAvatar(file);
      if (pickedUrlRef.current) URL.revokeObjectURL(pickedUrlRef.current);
      pickedUrlRef.current = URL.createObjectURL(file);
      setPickedUrl(pickedUrlRef.current);
      onUploaded?.(uploadedId);
      toast.success("Đã tải ảnh lên. Nhớ bấm lưu nhé!");
    } catch (e) {
      // Thân response thô (nếu có) chỉ để log — shape cửa upload chưa chốt, mất
      // nó là không biết vì sao không bóc được id ảnh.
      if (e instanceof LcmsApiError && e.details) {
        console.warn("upload-avatar trả về thân lạ:", e.details);
      }
      // 413 chạm được dù đã chặn 5MB ở trên — nghĩa là trần thật của máy chủ
      // còn thấp hơn thế. Câu của gateway ("413 Request Entity Too Large" /
      // "LCMS API error 413") không đưa ra màn hình.
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

  return (
    <div className="space-y-1.5">
      <Label>Ảnh đại diện</Label>
      <div className="flex items-center gap-4">
        <Avatar className="size-16 border-2 border-border">
          {shownUrl ? <AvatarImage src={shownUrl} alt={displayName} /> : null}
          <AvatarFallback className="text-lg font-bold">
            {initialsOf(displayName)}
          </AvatarFallback>
        </Avatar>

        {!readOnly && (
          <div className="space-y-1.5">
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
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {shownUrl ? "Đổi ảnh" : "Chọn ảnh"}
            </Button>
            <p className="text-xs text-muted-foreground">
              JPG, PNG hoặc WEBP, tối đa 5 MB.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
