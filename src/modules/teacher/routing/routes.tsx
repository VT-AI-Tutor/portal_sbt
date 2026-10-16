import type { AppRouteDef } from "@/core/routing/types";
import { TeacherHomePage } from "@/modules/teacher/ui/teacher/TeacherHomePage";
import { TeacherTestPage } from "@/modules/teacher/ui/teacher/TeacherTestPage";
import { TeacherReportsPage } from "@/modules/teacher/ui/teacher/TeacherReportsPage";
import { TeacherProgressPage } from "@/modules/teacher/ui/teacher/TeacherProgressPage";
import { TeacherExamPage } from "@/modules/teacher/ui/teacher/TeacherExamPage";
import { TeacherPaperPrintPage } from "@/modules/teacher/ui/teacher/TeacherPaperPrintPage";
import { TeacherOutcomePage } from "@/modules/teacher/ui/teacher/TeacherOutcomePage";
import { TeacherBankPage } from "@/modules/teacher/ui/teacher/TeacherBankPage";
import { TeacherAssignPage } from "@/modules/teacher/ui/teacher/TeacherAssignPage";
import { TeacherAiPage } from "@/modules/teacher/ui/teacher/TeacherAiPage";
import { TeacherGradingPage } from "@/modules/teacher/ui/teacher/TeacherGradingPage";
import { TeacherClassesPage } from "@/modules/teacher/ui/teacher/classes/TeacherClassesPage";
import { TeacherClassDetailPage } from "@/modules/teacher/ui/teacher/classes/TeacherClassDetailPage";
import { TeacherLecturesPage } from "@/modules/teacher/ui/teacher/TeacherLecturesPage";

export const teacherRoutes: AppRouteDef[] = [
  { path: "", element: <TeacherHomePage />, layout: "teacher" },
  { path: "classes", element: <TeacherClassesPage />, layout: "teacher" },
  {
    path: "classes/:id",
    element: <TeacherClassDetailPage />,
    layout: "teacher",
  },
  { path: "test", element: <TeacherTestPage />, layout: "teacher" },
  { path: "reports", element: <TeacherReportsPage />, layout: "teacher" },
  { path: "progress", element: <TeacherProgressPage />, layout: "teacher" },
  { path: "grading", element: <TeacherGradingPage />, layout: "teacher" },
  { path: "exam", element: <TeacherExamPage />, layout: "teacher" },
  {
    path: "exam/:id/print",
    element: <TeacherPaperPrintPage />,
    layout: "teacher",
  },
  {
    path: "outcome/:classId/:linkId",
    element: <TeacherOutcomePage />,
    layout: "teacher",
  },
  { path: "bank", element: <TeacherBankPage />, layout: "teacher" },
  { path: "lectures", element: <TeacherLecturesPage />, layout: "teacher" },
  { path: "assign", element: <TeacherAssignPage />, layout: "teacher" },
  { path: "ai", element: <TeacherAiPage />, layout: "teacher" },
];

export const teacherRoutePrefix = "/teacher";
