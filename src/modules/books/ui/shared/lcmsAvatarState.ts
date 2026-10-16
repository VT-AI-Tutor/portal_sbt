/**
 * Trạng thái ảnh đại diện trong màn hồ sơ LCMS, tách khỏi component để còn test
 * thẳng luật "máy chủ có nhận ảnh không" mà không phải dựng cả dialog.
 */
import type { LcmsProfile } from "@/core/api/lcmsAdapter";

/** Ảnh đại diện: id (để gửi đi và để tải ảnh) + cờ "vừa tải lên, chưa chắc đã lưu". */
export interface AvatarState {
  id: string | null;
  pending: boolean;
}

export const NO_AVATAR: AvatarState = { id: null, pending: false };

/**
 * Máy chủ có TỪ CHỐI ảnh vừa gửi không. Chỉ kết luận khi có bằng chứng phản
 * chứng — /current trả về một id ảnh KHÁC id vừa gửi. Thiếu bằng chứng (không
 * trả id) thì im lặng: báo sai còn tệ hơn bỏ sót.
 */
export function avatarWasRejected(
  sentAvatarId: string | null,
  me: LcmsProfile,
): boolean {
  return !!sentAvatarId && !!me.avatarId && me.avatarId !== sentAvatarId;
}
