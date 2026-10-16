import { getConfiguredBrand } from "@/core/brand/brand";

/**
 * Cờ bật KHU STUDENT SBT (`/hoc-sinh`). Khu này là bản riêng cho brand **nxbgd**
 * (sao chép từ khu `/student`, KHÔNG dùng chung code). Chỉ mount khi brand đang
 * cấu hình là nxbgd; brand khác vào `/hoc-sinh/*` sẽ bị đưa về `/`.
 *
 * Tách thành hàm riêng (theo mẫu isStudentPageEnabled) để bootstrap gate route và
 * để dễ test.
 */
export function isStudentSbtEnabled(): boolean {
  return getConfiguredBrand() === "nxbgd";
}
