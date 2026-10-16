import type { CreateSessionInput } from "@/modules/student/api/practiceApi";

/**
 * Map chế độ hiển thị trên UI (`practice`/`game`/`test`) sang giá trị `mode`
 * mà API tạo phiên luyện tập chấp nhận (`practice`/`game`/`timed`) — chỉ
 * "test" đổi tên, còn lại giữ nguyên.
 */
export type UiModeId = "practice" | "game" | "test";

export function modeToApi(mode: UiModeId): CreateSessionInput["mode"] {
  return mode === "test" ? "timed" : mode;
}
