import { getBrandDefault } from "@/core/brand/brand";

/**
 * Cờ bật/tắt KHU HỌC SINH (`/student`), resolve từ config theo đúng mẫu
 * getLandingVariant: runtime `window.__APP_CONFIG__.STUDENT_PAGE_ENABLED` ưu
 * tiên, rồi mặc định của BRAND, rồi `VITE_STUDENT_PAGE_ENABLED`. Mặc định BẬT
 * để các deploy hiện tại không đổi hành vi; chỉ tắt khi cấu hình rõ ràng
 * "false"/"0"/"off"/"no".
 *
 * Khi tắt: không vào được trang student (route redirect về `/`) và sau đăng nhập
 * không điều hướng vào `/student` nữa (homePathForUser trả `/`).
 */
export function isStudentPageEnabled(): boolean {
  let runtime: string | undefined;
  if (typeof window !== "undefined") {
    const raw = window.__APP_CONFIG__?.STUDENT_PAGE_ENABLED;
    if (typeof raw === "string" && raw.trim() !== "") runtime = raw;
  }
  const value = (
    runtime ??
    getBrandDefault("STUDENT_PAGE_ENABLED") ??
    import.meta.env.VITE_STUDENT_PAGE_ENABLED ??
    ""
  )
    .trim()
    .toLowerCase();
  // Mặc định BẬT: chỉ coi là tắt khi nói rõ tắt.
  return !(value === "false" || value === "0" || value === "off" || value === "no");
}
