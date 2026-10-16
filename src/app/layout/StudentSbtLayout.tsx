import { Outlet } from "react-router-dom";
import { ErrorBoundary } from "@/core/ui/ErrorBoundary";
import { PageErrorFallback } from "@/app/layout/PageErrorFallback";
import { StudentSbtShell } from "@/app/layout/StudentSbtShell";

export function StudentSbtLayout() {
  return (
    <StudentSbtShell>
      {/* Ranh giới trong shell: trang lỗi thì chỉ mất phần nội dung, thanh
          điều hướng vẫn còn để đi tiếp — thay vì trắng toàn màn hình. */}
      <ErrorBoundary fallback={(error) => <PageErrorFallback error={error} />}>
        <Outlet />
      </ErrorBoundary>
    </StudentSbtShell>
  );
}
