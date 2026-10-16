/**
 * Trang tổng quan khu quản lý (Task 8) — thay bảng xếp hạng giả bằng danh
 * sách trường thật theo tài khoản. 1 trường → điều hướng thẳng vào báo cáo
 * trường đó; nhiều trường → bảng chọn trường.
 */
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";

import { Card } from "@/core/ui/card";
import { Skeleton } from "@/core/ui/skeleton";
import { useAccessToken } from "@/core/auth/AuthContext";
import { managerApi } from "@/modules/manager/api/managerApi";
import { useTerritoryScope } from "@/modules/manager/hooks/useTerritory";

export function ManagerHomePage() {
  const token = useAccessToken();
  // Phạm vi của chính tài khoản quyết định mở màn nào. admin_scope không đủ: nó
  // chỉ nói "toàn cục hay không", không nói đơn vị nào.
  const scope = useTerritoryScope();
  const { data: schools, isLoading: schoolsLoading, error } = useQuery({
    queryKey: ["manager-schools"],
    queryFn: () => managerApi.schoolsSummary(token!),
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <Card className="p-6 text-sm text-muted-foreground">
          Bạn cần đăng nhập để xem báo cáo.
        </Card>
      </div>
    );
  }

  const isLoading = schoolsLoading || scope.isLoading;

  // Phạm vi rộng hơn một trường thì vào thẳng báo cáo địa bàn của cấp đó.
  if (!scope.isLoading && scope.data) {
    if (scope.data.global) {
      return <Navigate to="/manager/national" replace />;
    }
    const only = scope.data.units.length === 1 ? scope.data.units[0] : null;
    if (only?.type === "province") {
      return <Navigate to={`/manager/province/${only.id}`} replace />;
    }
    if (only?.type === "ward") {
      return <Navigate to={`/manager/ward/${only.id}`} replace />;
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-4 md:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <Card className="p-6 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Không tải được danh sách trường."}
        </Card>
      </div>
    );
  }

  const list = schools ?? [];

  if (list.length === 1) {
    return <Navigate to={`/manager/school/${list[0].school_id}`} replace />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">
          🏛️ Tổng quan quản lý
        </h1>
        <p className="text-muted-foreground">
          Danh sách trường thuộc phạm vi quản lý của tài khoản.
        </p>
      </div>

      {list.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Tài khoản chưa được gán đơn vị nào.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Trường</th>
                <th className="px-4 py-3 font-medium">Học sinh</th>
                <th className="px-4 py-3 font-medium">Lớp</th>
                <th className="px-4 py-3 font-medium">
                  Phiên luyện tập 30 ngày
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.school_id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to={`/manager/school/${s.school_id}`}
                      className="text-primary hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.students.toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.classes.toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.sessions_30d.toLocaleString("vi-VN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
