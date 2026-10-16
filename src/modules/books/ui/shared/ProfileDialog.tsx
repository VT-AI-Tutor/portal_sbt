/**
 * Dialog "Cập nhật hồ sơ" (LCMS): ảnh đại diện + Tỉnh/Thành phố + Ngày sinh. Đổi
 * mật khẩu tách sang ChangePasswordDialog riêng. Nạp dữ liệu khi mở. Mở từ
 * UserHeaderMenu (landing) và AppShell (khu học sinh).
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { lcmsGetCurrentUser, lcmsUpdateProfile } from "@/core/api/lcmsAdapter";
import { LCMS_CURRENT_USER_QUERY_KEY } from "./useLcmsAvatar";
import { LcmsAvatarField } from "./LcmsAvatarField";
import {
  avatarWasRejected,
  NO_AVATAR,
  type AvatarState,
} from "./lcmsAvatarState";
import { useLcmsProfileLoad } from "./useLcmsProfileLoad";
import { Button } from "@/core/ui/button";
import { DatePicker, formatDisplayDate } from "@/core/ui/date-picker";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chỉ xem: hiện đúng các trường trên nhưng khoá, không có nút lưu. */
  readOnly?: boolean;
}

export function ProfileDialog({
  open,
  onOpenChange,
  readOnly = false,
}: ProfileDialogProps) {
  const { loading, loadError, profile, provinces } = useLcmsProfileLoad(
    open,
    true,
  );
  const [savingInfo, setSavingInfo] = useState(false);
  const queryClient = useQueryClient();

  const userId = profile?.id ?? "";
  const username = profile?.username ?? profile?.fullName ?? "";
  const [geoCode, setGeoCode] = useState("");
  const [birthDate, setBirthDate] = useState(""); // "YYYY-MM-DD" (giá trị lưu về LCMS)
  const [avatar, setAvatar] = useState<AvatarState>(NO_AVATAR);
  const provinceName = provinces.find((p) => p.code === geoCode)?.name ?? "";

  // Seed các ô sửa được từ hồ sơ — ĐÚNG MỘT LẦN mỗi lần mở dialog. Hồ sơ giờ
  // nằm trong cache dùng chung, seed lại mỗi khi cache đổi là ghi đè cả thứ
  // người dùng đang gõ dở lẫn trạng thái ảnh mà handleSaveInfo vừa đặt.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!open) seededRef.current = false;
  }, [open]);
  useEffect(() => {
    if (!open || !profile || seededRef.current) return;
    seededRef.current = true;
    setGeoCode(profile.geoCode ?? "");
    setBirthDate((profile.birthDate ?? "").slice(0, 10));
    setAvatar({ id: profile.avatarId ?? null, pending: false });
  }, [open, profile]);

  /**
   * Đọc lại /current sau khi lưu để đồng bộ giá trị đã persist. Chỉ ghi đè khi
   * server trả giá trị — /current đọc từ host security (khác host ghi
   * update-new-user) nên có thể trễ/thiếu field; không được xoá lựa chọn vừa
   * lưu thành rỗng. Trả true khi máy chủ từ chối ảnh vừa gửi.
   */
  const syncFromServer = async (sentAvatarId: string | null) => {
    try {
      // fetchQuery: MỘT lượt /current vừa để đối chiếu ở đây, vừa cập nhật luôn
      // cache dùng chung nên ảnh trên header tự vẽ lại — không cần invalidate
      // rồi gọi thêm lượt nữa.
      const me = await queryClient.fetchQuery({
        queryKey: LCMS_CURRENT_USER_QUERY_KEY,
        queryFn: lcmsGetCurrentUser,
        staleTime: 0,
      });
      if (me.geoCode) setGeoCode(me.geoCode);
      if (me.birthDate) setBirthDate(me.birthDate.slice(0, 10));
      const rejected = avatarWasRejected(sentAvatarId, me);
      setAvatar((current) => ({
        // Bị từ chối thì GIỮ id vừa tải lên để lần lưu sau còn gửi lại đúng ảnh
        // đó — lấy id cũ của máy chủ đè lên là im lặng vứt ảnh người dùng chọn,
        // rồi lần lưu thứ hai (gửi id cũ) lại báo thành công.
        id: rejected ? current.id : (me.avatarId ?? current.id),
        pending: rejected,
      }));
      return rejected;
    } catch {
      // Không đọc lại được thì không kết luận gì: giữ nguyên giá trị đang nhập
      // và giữ cờ pending để lần lưu sau còn đối chiếu lại.
      return false;
    }
  };

  const handleSaveInfo = async () => {
    if (!userId) {
      toast.error("Không xác định được tài khoản. Vui lòng thử lại.");
      return;
    }
    if (!geoCode) {
      toast.error("Vui lòng chọn Tỉnh/Thành phố.");
      return;
    }
    setSavingInfo(true);
    const sentAvatarId = avatar.id;
    const hadNewAvatar = avatar.pending;
    try {
      await lcmsUpdateProfile({
        geoCode,
        birthDate,
        ...(sentAvatarId ? { avatar: sentAvatarId } : {}),
      });
      const avatarRejected = await syncFromServer(sentAvatarId);
      // Ảnh mới gửi lên mà máy chủ trả về id ảnh khác = nó không ghi. Nói thẳng
      // thay vì báo "đã lưu" rồi để người dùng tự phát hiện ảnh không đổi.
      if (hadNewAvatar && avatarRejected) {
        toast.error(
          "Đã lưu thông tin, nhưng máy chủ chưa nhận ảnh đại diện mới.",
        );
      } else {
        toast.success("Đã lưu thông tin.");
      }
    } catch (e) {
      toast.error((e as Error).message || "Lưu thông tin thất bại.");
    } finally {
      setSavingInfo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-md max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{readOnly ? "Hồ sơ" : "Cập nhật hồ sơ"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Đang tải hồ sơ…</p>
        ) : loadError ? (
          <p className="py-6 text-sm text-destructive font-semibold">
            Không tải được hồ sơ: {loadError}
          </p>
        ) : (
          <div className="space-y-4">
            <LcmsAvatarField
              displayName={username || "Học sinh"}
              avatarId={avatar.id}
              onUploaded={(id) =>
                setAvatar((current) => ({ ...current, id, pending: true }))
              }
              disabled={savingInfo}
              readOnly={readOnly}
            />
            {username && (
              <div className="space-y-1.5">
                <Label>Tên đăng nhập</Label>
                <Input value={username} disabled readOnly />
              </div>
            )}
            {readOnly ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="province">Tỉnh/Thành phố</Label>
                  <Input id="province" value={provinceName} disabled readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="birth-date">Ngày sinh</Label>
                  <Input
                    id="birth-date"
                    value={formatDisplayDate(birthDate)}
                    disabled
                    readOnly
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="province">Tỉnh/Thành phố</Label>
                  <Select value={geoCode} onValueChange={setGeoCode}>
                    <SelectTrigger id="province">
                      <SelectValue placeholder="Chọn Tỉnh/Thành phố" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="birth-date">Ngày sinh</Label>
                  <DatePicker
                    id="birth-date"
                    value={birthDate}
                    onChange={setBirthDate}
                    placeholder="Chọn ngày sinh"
                    disableFuture
                  />
                </div>
                <Button
                  onClick={handleSaveInfo}
                  disabled={savingInfo}
                  className="gap-2"
                >
                  <Save className="size-4" />
                  {savingInfo ? "Đang lưu…" : "Lưu thông tin"}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
