import { Navigate } from "react-router-dom";
import type { AppRouteDef } from "@/core/routing/types";
import { StudentSbtCompetencyPage } from "@/modules/student-sbt/ui/StudentSbtCompetencyPage";
import { StudentSbtExercisesPage } from "@/modules/student-sbt/ui/StudentSbtExercisesPage";
import { StudentSbtMasteryAiPage } from "@/modules/student-sbt/ui/StudentSbtMasteryAiPage";

/** Paths are relative to `/hoc-sinh` (see `src/app/bootstrap.tsx`). */
export const studentSbtRoutes: AppRouteDef[] = [
  {
    path: "",
    element: <Navigate to="/hoc-sinh/bai-tap" replace />,
    layout: "student-sbt",
  },
  {
    path: "nang-luc",
    element: <StudentSbtCompetencyPage />,
    layout: "student-sbt",
  },
  // {
  //   path: "nang-luc-v2",
  //   element: <StudentSbtMasteryAiPage />,
  //   layout: "student-sbt",
  // },
  {
    path: "bai-tap",
    element: <StudentSbtExercisesPage />,
    layout: "student-sbt",
  },
];

export const studentSbtRoutePrefix = "/hoc-sinh";
