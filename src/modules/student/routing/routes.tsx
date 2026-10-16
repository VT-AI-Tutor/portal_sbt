import { Navigate } from "react-router-dom";

import type { AppRouteDef } from "@/core/routing/types";
import { StudentHomePage } from "@/modules/student/ui/student/StudentHomePage";
import { StudentProfilePage } from "@/modules/student/ui/student/StudentProfilePage";
import { StudentPracticePage } from "@/modules/student/ui/student/StudentPracticePage";
import { StudentLessonPage } from "@/modules/student/ui/student/StudentLessonPage";
import { StudentCompetencyPage } from "@/modules/student/ui/student/StudentCompetencyPage";
import { StudentBattlePage } from "@/modules/student/ui/student/StudentBattlePage";
import { StudentAssignmentsPage } from "@/modules/student/ui/student/StudentAssignmentsPage";
import { StudentAssignmentRunnerPage } from "@/modules/student/ui/student/StudentAssignmentRunnerPage";
import { StudentAiPage } from "@/modules/student/ui/student/StudentAiPage";
import { StudentAchievementsPage } from "@/modules/student/ui/student/StudentAchievementsPage";
import { StudentShopPage } from "@/modules/student/ui/student/StudentShopPage";
import { StudentPremiumPage } from "@/modules/student/ui/student/StudentPremiumPage";
import { StudentActivityPage } from "@/modules/student/ui/student/StudentActivityPage";
import { StudentPracticeSessionPage } from "@/modules/student/ui/student/practice/StudentPracticeSessionPage";
import { StudentArenaPage } from "@/modules/student/ui/student/arena/StudentArenaPage";
import { ArenaAttemptPage } from "@/modules/student/ui/student/arena/ArenaAttemptPage";
import { StudentLecturesPage } from "@/modules/student/ui/student/lecture/StudentLecturesPage";
import { StudentLectureViewer } from "@/modules/student/ui/student/lecture/StudentLectureViewer";

/** Paths are relative to `/student` (see `src/app/bootstrap.tsx`). */
export const studentRoutes: AppRouteDef[] = [
  { path: "", element: <StudentHomePage />, layout: "student" },
  { path: "profile", element: <StudentProfilePage />, layout: "student" },
  { path: "practice", element: <StudentPracticePage />, layout: "student" },
  {
    path: "practice/session/:sessionId",
    element: <StudentPracticeSessionPage />,
    layout: "student",
  },
  {
    path: "lesson/:lessonId",
    element: <StudentLessonPage />,
    layout: "student",
  },
  { path: "competency", element: <StudentCompetencyPage />, layout: "student" },
  { path: "battle", element: <StudentBattlePage />, layout: "student" },
  { path: "arena", element: <StudentArenaPage />, layout: "student" },
  {
    path: "arena/attempt/:attemptId",
    element: <ArenaAttemptPage />,
    layout: "student",
  },
  {
    path: "assignments",
    element: <StudentAssignmentsPage />,
    layout: "student",
  },
  {
    path: "assignments/run/:exerciseId",
    element: <StudentAssignmentRunnerPage />,
    layout: "student",
  },
  { path: "ai", element: <StudentAiPage />, layout: "student" },
  {
    path: "achievements",
    element: <StudentAchievementsPage />,
    layout: "student",
  },
  { path: "shop", element: <StudentShopPage />, layout: "student" },
  // Premium là trang CON của Hồ sơ kể từ khi rời menu chính (Owner 17/8): lối
  // vào là thẻ "Gói của tôi" trong Hồ sơ, và đường dẫn con giữ cho mục "Hồ sơ"
  // sáng đúng khi đang xem gói — activeNavTo lấy tiền tố dài nhất, để nguyên
  // "/student/premium" thì nó rơi về "/student" và menu sáng nhầm "Trang chủ".
  {
    path: "profile/premium",
    element: <StudentPremiumPage />,
    layout: "student",
  },
  // Đường cũ vẫn sống cho ai đã lưu dấu trang.
  {
    path: "premium",
    element: <Navigate to="/student/profile/premium" replace />,
    layout: "student",
  },
  { path: "activity", element: <StudentActivityPage />, layout: "student" },
  { path: "lectures", element: <StudentLecturesPage />, layout: "student" },
  {
    path: "lectures/:linkId",
    element: <StudentLectureViewer />,
    layout: "student",
  },
];

export const studentRoutePrefix = "/student";
