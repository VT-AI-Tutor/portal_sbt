import type { AppRouteDef } from '@/core/routing/types';
import { marketingRoutes } from '@/modules/marketing/routing/routes';
import { studentRoutes } from '@/modules/student/routing/routes';
import { studentSbtRoutes } from '@/modules/student-sbt/routing/routes';
import { teacherRoutes } from '@/modules/teacher/routing/routes';
import { managerRoutes } from '@/modules/manager/routing/routes';
import { booksRoutes } from '@/modules/books/routing/routes';
import { slidesRoutes } from '@/modules/slides/routing/routes';
import { digitizedContentRoutes } from '@/modules/digitized-content/routing/routes';

export const allAuthenticatedRoutes: AppRouteDef[] = [
  ...marketingRoutes,
  ...studentRoutes,
  ...studentSbtRoutes,
  ...teacherRoutes,
  ...managerRoutes,
  ...booksRoutes,
  ...slidesRoutes,
  ...digitizedContentRoutes,
];
