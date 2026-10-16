import { isStudentPageEnabled } from "@/core/access/studentPage";
import { getConfiguredBrand } from "@/core/brand/brand";
import type { AuthUser } from "@/core/auth/types";

/**
 * Người này có được vào khu quản trị không? Quản trị địa bàn (tỉnh/phường-xã/
 * trường) cũng được — họ chỉ thấy phần của mình, xem `isGlobalAdmin`.
 *
 * Nguồn chuẩn là `admin_scope` do backend tính từ chính gốc phạm vi nó dùng để
 * gác cổng. `roles` chỉ còn là đường lùi cho phiên đăng nhập dựng trước khi
 * backend trả trường đó — bỏ hẳn sẽ đá văng người đang đăng nhập ra ngoài.
 */
export function hasAdminRole(user: AuthUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  if (user.admin_scope) {
    return true;
  }

  return hasLegacyAdminRole(user);
}

/**
 * Quản trị TOÀN CỤC — người thấy được sách, ngân hàng câu hỏi, danh mục và các
 * màn không có chiều địa bàn. Quản trị một địa bàn trả về false.
 *
 * Đây là bản sao đúng của cổng `admin` phía backend; ẩn menu không phải là
 * chặn, nên mọi tuyến toàn cục đều gác thêm bằng hàm này.
 */
export function isGlobalAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  if (user.admin_scope) {
    return user.admin_scope === "global";
  }

  return hasLegacyAdminRole(user);
}

function hasLegacyAdminRole(user: AuthUser): boolean {
  if (user.role === "admin" || user.role === "super_admin") {
    return true;
  }

  return (
    Array.isArray(user.roles) &&
    (user.roles.includes("admin") || user.roles.includes("super_admin"))
  );
}

/** Vai trò đã chuẩn hoá của user — gộp cả `role` đơn lẻ lẫn mảng `roles`. */
export function getUserRoles(user: AuthUser | null | undefined): string[] {
  if (!user) {
    return [];
  }

  const roles: string[] = [];
  if (typeof user.role === "string" && user.role) {
    roles.push(user.role);
  }
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) {
      if (typeof r === "string" && r) {
        roles.push(r);
      }
    }
  }
  return roles;
}

/** Khu màn hình gác theo vai trò (khu quản trị có cổng riêng — hasAdminRole). */
export type RoleArea = "student" | "teacher" | "manager";

const AREA_ROLE: Record<RoleArea, string> = {
  student: "student",
  teacher: "teacher",
  manager: "manager",
};

/**
 * ACCESS-R7 — cổng khu theo vai trò (GAP-014). Admin/super_admin vào được mọi khu
 * ("tài khoản có quyền"). Tài khoản không mang vai trò khu nào (dữ liệu vai trò
 * cũ/thiếu — GAP-016, GAP-021) được coi như học sinh: chỉ vào khu học sinh, để
 * không khoá nhầm người dùng hợp lệ.
 */
export function canEnterArea(
  user: AuthUser | null | undefined,
  area: RoleArea,
): boolean {
  const roles = getUserRoles(user);
  if (roles.includes("admin") || roles.includes("super_admin")) {
    return true;
  }
  if (roles.includes(AREA_ROLE[area])) {
    return true;
  }
  // Quản trị theo địa bàn (QL trường/xã/tỉnh) mang `admin_scope` chứ KHÔNG mang
  // roles=['manager']. Khu Quản lý của backend gác bằng cổng `org.admin` (org_admin
  // sinh gốc phạm vi + có report.view), nên cổng khu màn hình phải khớp — nếu không
  // một QL trường hợp lệ đăng nhập xong bị rớt về khu học sinh (Owner 2026-08-19).
  if (area === "manager" && !!user?.admin_scope) {
    return true;
  }
  return (
    area === "student" &&
    !roles.includes(AREA_ROLE.teacher) &&
    !roles.includes(AREA_ROLE.manager)
  );
}

/**
 * Khu mặc định sau đăng nhập theo vai trò (GAP-142): giáo viên/quản lý không bị
 * nhét vào /student nữa. Khu quản trị dùng phiên scope riêng (/admin/login) nên
 * admin đăng nhập ở cổng công khai vẫn về /student.
 *
 * Khi khu học sinh bị TẮT (STUDENT_PAGE_ENABLED=false), những ai lẽ ra về
 * /student (học sinh, admin ở cổng công khai, tài khoản thiếu vai trò) được đưa
 * về trang chủ công khai `/` thay vì vào trang student.
 */
export function homePathForUser(user: AuthUser | null | undefined): string {
  const roles = getUserRoles(user);
  if (roles.includes("manager")) {
    return "/manager";
  }
  if (roles.includes("teacher")) {
    return "/teacher";
  }
  // QL trường (org_admin phạm vi một địa bàn) vào thẳng khu Quản lý thay vì bị coi
  // như học sinh — họ mang `admin_scope='org_unit'` với roles rỗng (Owner
  // 2026-08-19). Quản trị TOÀN CỤC (`admin_scope='global'`) giữ nguyên đường cũ:
  // khu quản trị có cổng riêng (/admin/login) nên không tự nhảy vào /manager.
  if (user?.admin_scope === "org_unit") {
    return "/manager";
  }
  return isStudentPageEnabled() ? "/student" : "/";
}

/**
 * Đích điều hướng NGAY SAU ĐĂNG NHẬP (SBT #33). CHỈ áp cho brand **nxbgd**: học
 * sinh KHÔNG bị đưa vào `/student` sau khi đăng nhập — chỉ ở lại trang công khai
 * `/` (Kho sách). Route `/student` vẫn truy cập được bình thường (khác hẳn việc
 * tắt `STUDENT_PAGE_ENABLED`, vốn chặn cả route). Giáo viên/quản lý vẫn về khu của
 * mình. Các brand khác giữ nguyên hành vi cũ (dùng `homePathForUser` → `/student`).
 */
export function postLoginPathForUser(
  user: AuthUser | null | undefined,
): string {
  const home = homePathForUser(user);
  // nxbgd: sau đăng nhập, học sinh KHÔNG tự vào /student (route vẫn mở). Các brand
  // khác giữ nguyên "home" (học sinh về /student).
  if (getConfiguredBrand() === "nxbgd" && home === "/student") {
    return "/";
  }
  return home;
}
