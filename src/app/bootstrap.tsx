import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getApiProvider } from "@/core/api/config";
import { AppProviders } from "@/app/AppProviders";
import { AppErrorBoundary } from "@/app/AppErrorBoundary";
import { FirstLoginGate } from "@/app/FirstLoginGate";
import { GoogleTagPageTracker } from "@/core/analytics/GoogleTagPageTracker";
import { routesForShell } from "@/app/composeRoutes";
import { allAuthenticatedRoutes } from "@/app/routes";
import { RequireAuth } from "@/core/auth/RequireAuth";
import { GoogleAuthCallbackPage } from "@/core/auth/GoogleAuthCallbackPage";
import { StudentLayout } from "@/app/layout/StudentLayout";
import { StudentSbtLayout } from "@/app/layout/StudentSbtLayout";
import { TeacherLayout } from "@/app/layout/TeacherLayout";
import { ManagerLayout } from "@/app/layout/ManagerLayout";
import { PlayersDemoPage } from "@/core/exercise/players/PlayersDemoPage";
import { SamplesPage } from "@/core/exercise/players/SamplesPage";
import { EmbedReaderPage } from "@/app/embed/EmbedReaderPage";
import { EmbedPracticePage } from "@/app/embed/EmbedPracticePage";
import { isStudentPageEnabled } from "@/core/access/studentPage";
import { isStudentSbtEnabled } from "@/core/access/studentSbtPage";
import { studentRoutePrefix } from "@/modules/student/routing/routes";
import { studentSbtRoutePrefix } from "@/modules/student-sbt/routing/routes";
import { teacherRoutePrefix } from "@/modules/teacher/routing/routes";
import { managerRoutePrefix } from "@/modules/manager/routing/routes";

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

function ShellRoutes({
  prefix,
  routes,
  layout,
}: {
  prefix: string;
  routes: ReturnType<typeof routesForShell>;
  layout: ReactNode;
}) {
  return (
    <Route path={prefix} element={layout}>
      {routes.map((route) => (
        <Route
          key={route.path || "index"}
          index={route.path === ""}
          path={route.path === "" ? undefined : route.path}
          element={route.element}
        />
      ))}
    </Route>
  );
}

function AppRoutes() {
  const publicRoutes = routesForShell(allAuthenticatedRoutes, "public");
  const studentRoutes = routesForShell(allAuthenticatedRoutes, "student");
  const studentSbtRoutes = routesForShell(allAuthenticatedRoutes, "student-sbt");
  const teacherRoutes = routesForShell(allAuthenticatedRoutes, "teacher");
  const managerRoutes = routesForShell(allAuthenticatedRoutes, "manager");

  return (
    <Routes>
      {publicRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}

      {ShellRoutes({
        prefix: studentRoutePrefix,
        routes: studentRoutes,
        // Khu học sinh bị tắt (STUDENT_PAGE_ENABLED=false): mọi /student/* đưa về `/`.
        layout: isStudentPageEnabled() ? (
          <RequireAuth loginPath="/" area="student">
            <StudentLayout />
          </RequireAuth>
        ) : (
          <Navigate to="/" replace />
        ),
      })}
      {ShellRoutes({
        prefix: studentSbtRoutePrefix,
        routes: studentSbtRoutes,
        // Khu Student SBT (/hoc-sinh) CHỈ dành cho brand nxbgd; brand khác → về `/`.
        layout: isStudentSbtEnabled() ? (
          <RequireAuth loginPath="/" area="student">
            <StudentSbtLayout />
          </RequireAuth>
        ) : (
          <Navigate to="/" replace />
        ),
      })}
      {ShellRoutes({
        prefix: teacherRoutePrefix,
        routes: teacherRoutes,
        layout: (
          <RequireAuth loginPath="/" area="teacher">
            <TeacherLayout />
          </RequireAuth>
        ),
      })}
      {ShellRoutes({
        prefix: managerRoutePrefix,
        routes: managerRoutes,
        layout: (
          <RequireAuth loginPath="/" area="manager">
            <ManagerLayout />
          </RequireAuth>
        ),
      })}
      {/* LCMS Google redirect flow lands here with tokens in the query string */}
      <Route path="/google/authen" element={<GoogleAuthCallbackPage />} />

      <Route path="/dev/players" element={<PlayersDemoPage />} />

      {/* Cùng bộ player nhưng xếp theo mã yêu cầu II.1–II.39 để đối chiếu từng
          dòng. Khác /dev/players (xếp theo họ player, kèm nhóm kiểm cỡ ảnh —
          dành cho người phát triển). */}
      <Route path="/dev/samples" element={<SamplesPage />} />

      {/* Chrome-less engine routes hosted inside the native WebView (evo-books-mobile). */}
      <Route
        path="/embed/reader/:bookCode/:lessonCode"
        element={<EmbedReaderPage />}
      />
      <Route
        path="/embed/practice/:sessionId"
        element={<EmbedPracticePage />}
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function Bootstrap() {
  return (
    <AppProviders>
      <BrowserRouter>
        <GoogleTagPageTracker />
        {/* Bên trong Router: ChangePasswordDialog (forced) dùng useNavigate. */}
        {getApiProvider() === "lcms" && <FirstLoginGate />}
        <AppErrorBoundary>
          <AppRoutes />
        </AppErrorBoundary>
      </BrowserRouter>
    </AppProviders>
  );
}
