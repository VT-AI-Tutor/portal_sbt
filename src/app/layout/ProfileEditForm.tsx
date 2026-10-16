/**
 * Form sửa hồ sơ — dùng chung cho HAI chỗ: hộp thoại "Cập nhật hồ sơ" ở menu
 * người dùng (mọi vai trò) và khu sửa TẠI CHỖ trong trang Hồ sơ của học sinh
 * (Owner 17/8: bấm "Chỉnh sửa" thì sửa ngay trên màn hình, không bật dialog).
 *
 * Tách ra vì hai lối vào cùng một việc: cùng trường, cùng luật kiểm tra, cùng
 * đường lưu. Chép làm hai bản thì sớm muộn một bên sửa mà bên kia quên.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/core/ui/button";
import { useAuth } from "@/core/auth/AuthContext";
import { AvatarPicker } from "@/core/auth/AvatarPicker";
import { PROVINCES, isKnownProvince, useLevels } from "@/core/reference";

const inputClass =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * GAP-010: form này trước đây KHÔNG kiểm tra gì — chuỗi dài vô hạn, khoảng trắng
 * thừa, "Lớp" nhập kiểu gì cũng lọt. Validate ngay tại form (BE vẫn là chốt cuối).
 */
function validate(fields: {
  province: string;
  schoolName: string;
  className: string;
}): string | null {
  // Tỉnh giờ chọn từ danh mục nên không còn cần chặn độ dài; chỉ còn ca hồ sơ cũ
  // mang tên đã sáp nhập, và ca đó vẫn cho lưu (xem option "tên cũ") chứ không
  // chặn người dùng lại vì chuyện họ không gây ra.
  if (fields.schoolName.trim().length > 200)
    return "Tên trường quá dài (tối đa 200 ký tự).";
  if (fields.className.trim().length > 20)
    return "Lớp quá dài (tối đa 20 ký tự).";
  return null;
}

export function ProfileEditForm({
  /** Đổi giá trị này (vd mỗi lần mở form) để nạp lại dữ liệu từ hồ sơ hiện tại. */
  resetKey,
  onSaved,
  onCancel,
  submitLabel = "Lưu thay đổi",
}: {
  resetKey?: unknown;
  onSaved?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const { user, updateProfile } = useAuth();
  const { data: levels } = useLevels();
  const [province, setProvince] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [level, setLevel] = useState("");
  const [className, setClassName] = useState("");
  // `undefined` = chưa đụng tới; `null` = người dùng chủ ý gỡ ảnh. Hai thứ khác
  // nhau ở đường lưu (xem handleSave) — gộp lại là vô tình xoá ảnh của người ta.
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setProvince((user.province as string) ?? "");
    setSchoolName((user.school_name as string) ?? "");
    setLevel((user.level as string) ?? "");
    setClassName(user.class_name ?? "");
    setAvatar(undefined);
    setError(null);
  }, [user, resetKey]);

  const handleSave = async () => {
    const invalid = validate({ province, schoolName, className });
    if (invalid) {
      setError(invalid);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Cắt khoảng trắng thừa để " Hà Nội " và "Hà Nội" không thành hai giá trị khác nhau.
      await updateProfile({
        province: province.trim() || undefined,
        school_name: schoolName.trim() || undefined,
        level: level || undefined,
        class_name: className.trim() || undefined,
        // Chỉ gửi khoá `avatar` khi người dùng THỰC SỰ đụng vào nó. Gửi kèm
        // undefined thì backend hiểu là "không đổi"; gửi null mới là gỡ ảnh.
        ...(avatar !== undefined ? { avatar } : {}),
      });
      onSaved?.();
    } catch (e) {
      setError((e as Error).message ?? "Không thể cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <AvatarPicker
        displayName={user?.full_name ?? user?.name ?? user?.email ?? "Học sinh"}
        avatarUrl={
          avatar !== undefined ? avatar : ((user?.avatar as string) ?? null)
        }
        onChange={setAvatar}
        disabled={saving}
      />
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="profile-province">
          Tỉnh/Thành phố
        </label>
        <select
          id="profile-province"
          className={inputClass}
          value={province}
          onChange={(e) => setProvince(e.target.value)}
        >
          <option value="">Chọn Tỉnh/Thành phố</option>
          {/* Hồ sơ cũ có thể đang lưu tên tỉnh đã bị sáp nhập từ 01/7/2025 (ô này
              trước đây gõ tự do). Không có option tương ứng thì <select> hiện ô
              trống và người dùng lưu lại là mất tỉnh mà không ai báo — nên giữ
              nguyên giá trị cũ làm một lựa chọn, có chú thích để họ tự đổi. */}
          {province !== "" && !isKnownProvince(province) && (
            <option value={province}>{province} (tên cũ — nên chọn lại)</option>
          )}
          {PROVINCES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="profile-school">
          Trường
        </label>
        <input
          id="profile-school"
          className={inputClass}
          value={schoolName}
          maxLength={200}
          onChange={(e) => setSchoolName(e.target.value)}
          placeholder="VD: TH Lê Quý Đôn..."
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="profile-class">
          Lớp (VD: 4A)
        </label>
        <input
          id="profile-class"
          className={inputClass}
          value={className}
          maxLength={20}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="VD: 4A"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="profile-level">
          Khối lớp
        </label>
        <select
          id="profile-level"
          className={inputClass}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="">Chọn khối lớp</option>
          {(levels ?? []).map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        {onCancel && (
          <Button
            variant="outline"
            className="rounded-xl font-bold"
            onClick={onCancel}
            disabled={saving}
          >
            Huỷ
          </Button>
        )}
        <Button
          className="rounded-xl font-bold"
          onClick={handleSave}
          disabled={saving}
        >
          {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
