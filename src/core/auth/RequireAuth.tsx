import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/core/auth/AuthContext";
import {
  canEnterArea,
  hasAdminRole,
  homePathForUser,
  type RoleArea,
} from "@/core/auth/roles";
import { Button } from "@/core/ui/button";

const AREA_LABEL: Record<RoleArea, string> = {
  student: "khu học sinh",
  teacher: "khu giáo viên",
  manager: "khu quản lý",
};

interface RequireAuthProps {
  children: ReactNode;
  loginPath?: string;
  /** When true, an authenticated user without the admin role is blocked. */
  requireAdminRole?: boolean;
  /**
   * GAP-014 / ACCESS-R7: khu gác theo vai trò — đã đăng nhập nhưng sai vai trò thì
   * hiện màn chặn quyền (đồng bộ cách xử lý khu quản trị — ACCESS-R6).
   */
  area?: RoleArea;
}

export function RequireAuth({
  children,
  loginPath = "/admin/login",
  requireAdminRole = false,
  area,
}: RequireAuthProps) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Đang xác thực…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (area && !canEnterArea(user, area)) {
    const homePath = homePathForUser(user);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Tài khoản này không có quyền vào {AREA_LABEL[area]}.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => navigate(homePath, { replace: true })}>
            Về khu của bạn
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void logout().then(() => navigate(loginPath, { replace: true }));
            }}
          >
            Đăng nhập tài khoản khác
          </Button>
        </div>
      </div>
    );
  }

  if (requireAdminRole && !hasAdminRole(user)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Tài khoản này không có quyền quản trị.
        </p>
        <Button
          onClick={() => {
            void logout().then(() => navigate(loginPath, { replace: true }));
          }}
        >
          Đăng nhập tài khoản khác
        </Button>
      </div>
    );
  }

  return children;
}
