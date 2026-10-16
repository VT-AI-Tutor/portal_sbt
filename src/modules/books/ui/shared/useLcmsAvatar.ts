/**
 * Hồ sơ LCMS và ảnh đại diện, dùng chung qua cache của react-query.
 *
 * Trước đây mỗi chỗ tự gọi: header hỏi /current một lần, dialog hỏi lần nữa lúc
 * mở, lưu xong hỏi lần thứ ba — và ảnh thì header tải một bản, dialog tải thêm
 * bản nữa của đúng id đó. Gom về hai query có khoá dùng chung: một lượt lấy hồ
 * sơ, một lượt lấy ảnh cho mỗi id.
 */
import { useQuery } from "@tanstack/react-query";
import {
  lcmsFetchAvatarDataUrl,
  lcmsGetCurrentUser,
  type LcmsProfile,
} from "@/core/api/lcmsAdapter";

export const LCMS_CURRENT_USER_QUERY_KEY = ["lcms", "current-user"];
const LCMS_AVATAR_IMAGE_QUERY_KEY = ["lcms", "avatar-image"];

/** Hồ sơ user đang đăng nhập. Mọi chỗ cần /current đều đi qua đây. */
export function useLcmsCurrentUser(enabled: boolean) {
  return useQuery<LcmsProfile>({
    queryKey: LCMS_CURRENT_USER_QUERY_KEY,
    queryFn: lcmsGetCurrentUser,
    enabled,
    staleTime: 5 * 60 * 1000,
    // Màn hồ sơ seed các ô nhập từ dữ liệu này; refetch lúc người dùng đang sửa
    // dở là ghi đè cái họ vừa gõ.
    refetchOnWindowFocus: false,
  });
}

/**
 * Ảnh đại diện dưới dạng data: URI, gắn thẳng vào `<img src>` được.
 *
 * Nằm trong cache react-query nên header và dialog dùng chung MỘT lượt tải;
 * `staleTime: Infinity` vì ảnh của một id là bất biến — id đổi thì khoá đổi và
 * tự tải lại.
 */
export function useLcmsAvatarUrl(
  avatarId: string | null | undefined,
): string | null {
  const { data } = useQuery<string>({
    queryKey: [...LCMS_AVATAR_IMAGE_QUERY_KEY, avatarId],
    queryFn: () => lcmsFetchAvatarDataUrl(avatarId as string),
    enabled: !!avatarId,
    staleTime: Infinity,
  });
  return data ?? null;
}
