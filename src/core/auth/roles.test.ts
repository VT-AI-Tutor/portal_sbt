import { describe, expect, it } from "vitest";
import {
  canEnterArea,
  getUserRoles,
  hasAdminRole,
  isGlobalAdmin,
  homePathForUser,
  postLoginPathForUser,
} from "@/core/auth/roles";
import type { AuthUser } from "@/core/auth/types";

// GAP-014 / ACCESS-R7: cổng khu theo vai trò — học sinh không vào được khu giáo viên/quản lý
// (ACCESS-V10 bước 2); tài khoản không mang vai trò khu nào được coi như học sinh để không
// khoá nhầm người dùng hợp lệ (đề phòng dữ liệu vai trò cũ/thiếu — GAP-021, GAP-016).
// GAP-142: sau đăng nhập điều hướng về khu đúng vai trò, không nhét mọi người vào /student.

const u = (user: Partial<AuthUser>): AuthUser => user as AuthUser;

describe("getUserRoles", () => {
  it("gộp cả role đơn lẻ lẫn mảng roles, bỏ giá trị không phải chuỗi", () => {
    expect(getUserRoles(u({ role: "teacher" }))).toEqual(["teacher"]);
    expect(getUserRoles(u({ roles: ["student", 7, null] }))).toEqual([
      "student",
    ]);
    expect(getUserRoles(u({ role: "admin", roles: ["teacher"] }))).toEqual([
      "admin",
      "teacher",
    ]);
  });

  it("null/undefined/roles không phải mảng → rỗng", () => {
    expect(getUserRoles(null)).toEqual([]);
    expect(getUserRoles(undefined)).toEqual([]);
    expect(getUserRoles(u({ roles: "student" }))).toEqual([]);
  });
});

describe("canEnterArea (ACCESS-R7)", () => {
  it("học sinh vào khu học sinh, bị chặn khu giáo viên và quản lý (ACCESS-V10)", () => {
    const student = u({ roles: ["student"] });
    expect(canEnterArea(student, "student")).toBe(true);
    expect(canEnterArea(student, "teacher")).toBe(false);
    expect(canEnterArea(student, "manager")).toBe(false);
  });

  it("giáo viên vào khu giáo viên, bị chặn khu học sinh và quản lý", () => {
    const teacher = u({ roles: ["teacher"] });
    expect(canEnterArea(teacher, "teacher")).toBe(true);
    expect(canEnterArea(teacher, "student")).toBe(false);
    expect(canEnterArea(teacher, "manager")).toBe(false);
  });

  it("admin và super_admin vào được mọi khu", () => {
    for (const role of ["admin", "super_admin"]) {
      const user = u({ roles: [role] });
      expect(canEnterArea(user, "student")).toBe(true);
      expect(canEnterArea(user, "teacher")).toBe(true);
      expect(canEnterArea(user, "manager")).toBe(true);
    }
  });

  it("tài khoản không mang vai trò khu nào được coi như học sinh (không khoá nhầm)", () => {
    for (const user of [
      u({}),
      u({ roles: [] }),
      u({ roles: ["cv_dao_tao"] }),
    ]) {
      expect(canEnterArea(user, "student")).toBe(true);
      expect(canEnterArea(user, "teacher")).toBe(false);
      expect(canEnterArea(user, "manager")).toBe(false);
    }
  });

  it("nhiều vai trò: mang vai trò khu nào thì vào được khu đó", () => {
    const both = u({ roles: ["teacher", "manager"] });
    expect(canEnterArea(both, "teacher")).toBe(true);
    expect(canEnterArea(both, "manager")).toBe(true);
    expect(canEnterArea(both, "student")).toBe(false);
  });

  // Quản trị theo địa bàn (QL trường/xã/tỉnh) mang admin_scope chứ KHÔNG mang
  // roles=['manager'] — cổng /manager của backend gác bằng org.admin (org_admin
  // có report.view + sinh gốc phạm vi), nên frontend phải cho họ vào khu Quản lý,
  // không thì đăng nhập xong bị rớt về khu học sinh.
  it("quản trị địa bàn (admin_scope) vào được khu quản lý dù roles rỗng", () => {
    const orgAdmin = u({ roles: [], admin_scope: "org_unit" });
    expect(canEnterArea(orgAdmin, "manager")).toBe(true);
    // vẫn KHÔNG phải giáo viên.
    expect(canEnterArea(orgAdmin, "teacher")).toBe(false);
    const globalScope = u({ roles: [], admin_scope: "global" });
    expect(canEnterArea(globalScope, "manager")).toBe(true);
  });
});

describe("homePathForUser (GAP-142)", () => {
  it("teacher → /teacher, manager → /manager", () => {
    expect(homePathForUser(u({ roles: ["teacher"] }))).toBe("/teacher");
    expect(homePathForUser(u({ roles: ["manager"] }))).toBe("/manager");
  });

  it("manager thắng teacher khi mang cả hai (khu rộng hơn)", () => {
    expect(homePathForUser(u({ roles: ["teacher", "manager"] }))).toBe(
      "/manager",
    );
  });

  it("student / không vai trò / null → /student (khu quản trị có cổng riêng)", () => {
    expect(homePathForUser(u({ roles: ["student"] }))).toBe("/student");
    expect(homePathForUser(u({}))).toBe("/student");
    expect(homePathForUser(null)).toBe("/student");
    // admin đăng nhập ở cổng công khai: phiên khu quản trị là scope riêng
    // (/admin/login) nên không điều hướng vào /admin.
    expect(homePathForUser(u({ roles: ["admin"] }))).toBe("/student");
  });

  it("quản trị TRƯỜNG (admin_scope org_unit, roles rỗng) → /manager", () => {
    // Owner 2026-08-19: QL trường vào thẳng khu Quản lý, không bị coi là học sinh.
    expect(homePathForUser(u({ roles: [], admin_scope: "org_unit" }))).toBe(
      "/manager",
    );
  });

  it("quản trị TOÀN CỤC (admin_scope global) vẫn về /student ở cổng công khai", () => {
    // Giữ nguyên quyết định cũ: khu quản trị toàn cục có cổng riêng (/admin/login),
    // nên global admin đăng nhập cổng công khai không tự nhảy vào /manager.
    expect(homePathForUser(u({ roles: [], admin_scope: "global" }))).toBe(
      "/student",
    );
  });

  it("khi khu học sinh bị TẮT: học sinh về `/` thay vì /student", () => {
    (globalThis as { window?: { __APP_CONFIG__?: unknown } }).window = {
      __APP_CONFIG__: { STUDENT_PAGE_ENABLED: "false" },
    };
    try {
      expect(homePathForUser(u({ roles: ["student"] }))).toBe("/");
      expect(homePathForUser(u({}))).toBe("/");
      expect(homePathForUser(null)).toBe("/");
      // giáo viên/quản lý không bị ảnh hưởng.
      expect(homePathForUser(u({ roles: ["teacher"] }))).toBe("/teacher");
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });
});

describe("postLoginPathForUser (SBT #33 — CHỈ brand nxbgd không vào /student sau đăng nhập)", () => {
  // Không set window → getConfiguredBrand() rơi về mặc định 'nxbgd'.
  it("nxbgd (mặc định): teacher → /teacher, manager → /manager", () => {
    expect(postLoginPathForUser(u({ roles: ["teacher"] }))).toBe("/teacher");
    expect(postLoginPathForUser(u({ roles: ["manager"] }))).toBe("/manager");
  });

  it("nxbgd: student / không vai trò / null / admin → `/` (KHÔNG vào /student)", () => {
    expect(postLoginPathForUser(u({ roles: ["student"] }))).toBe("/");
    expect(postLoginPathForUser(u({}))).toBe("/");
    expect(postLoginPathForUser(null)).toBe("/");
    expect(postLoginPathForUser(u({ roles: ["admin"] }))).toBe("/");
  });

  it("nxbgd: quản trị trường (admin_scope org_unit) → /manager, không rơi về `/`", () => {
    expect(
      postLoginPathForUser(u({ roles: [], admin_scope: "org_unit" })),
    ).toBe("/manager");
  });

  it("brand KHÁC (dehoctot): giữ hành vi cũ — student vẫn về /student", () => {
    (globalThis as { window?: { __APP_CONFIG__?: unknown } }).window = {
      __APP_CONFIG__: { BRAND: "dehoctot", STUDENT_PAGE_ENABLED: "true" },
    };
    try {
      expect(postLoginPathForUser(u({ roles: ["student"] }))).toBe("/student");
      expect(postLoginPathForUser(u({}))).toBe("/student");
      // giáo viên/quản lý không đổi.
      expect(postLoginPathForUser(u({ roles: ["teacher"] }))).toBe("/teacher");
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });
});

describe("hasAdminRole (hành vi cũ giữ nguyên)", () => {
  it("nhận admin qua role hoặc roles", () => {
    expect(hasAdminRole(u({ role: "admin" }))).toBe(true);
    expect(hasAdminRole(u({ roles: ["admin"] }))).toBe(true);
    expect(hasAdminRole(u({ roles: ["student"] }))).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
  });
});

// Cổng khu quản trị đọc `admin_scope` do backend tính từ chính gốc phạm vi nó
// dùng để gác cổng. Trước đây cổng đọc `roles` chứa "admin", nên quản trị viên
// một trường buộc phải mang vai trò TOÀN CỤC mới vào được khu quản trị — và thế
// là mở luôn sách, ngân hàng câu hỏi, catalog vai trò của cả hệ thống.
describe("phạm vi quản trị", () => {
  it("quản trị địa bàn vào được khu quản trị nhưng không phải quản trị toàn cục", () => {
    const scoped = u({ admin_scope: "org_unit", roles: [] });

    expect(hasAdminRole(scoped)).toBe(true);
    expect(isGlobalAdmin(scoped)).toBe(false);
  });

  it("quản trị toàn cục qua cả hai cổng", () => {
    const global = u({ admin_scope: "global", roles: [] });

    expect(hasAdminRole(global)).toBe(true);
    expect(isGlobalAdmin(global)).toBe(true);
  });

  it("không có phạm vi và không có vai trò cũ thì không vào được", () => {
    expect(hasAdminRole(u({ roles: [] }))).toBe(false);
    expect(isGlobalAdmin(u({ roles: [] }))).toBe(false);
    expect(isGlobalAdmin(null)).toBe(false);
  });

  it("phiên cũ chưa có admin_scope vẫn lùi về roles để không bị đá ra", () => {
    expect(hasAdminRole(u({ roles: ["admin"] }))).toBe(true);
    expect(isGlobalAdmin(u({ roles: ["admin"] }))).toBe(true);
    expect(isGlobalAdmin(u({ roles: ["super_admin"] }))).toBe(true);
  });

  it("admin_scope thắng roles khi cả hai cùng có", () => {
    // Tài khoản cũ còn sót roles:['admin'] nhưng backend nói chỉ là quản trị địa
    // bàn — tin backend, vì đó chính là thứ đang gác cổng thật.
    expect(isGlobalAdmin(u({ admin_scope: "org_unit", roles: ["admin"] }))).toBe(false);
  });
});
