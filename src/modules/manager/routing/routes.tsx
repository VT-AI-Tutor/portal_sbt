import type { AppRouteDef } from '@/core/routing/types';
import { ManagerHomePage } from '@/modules/manager/ui/manager/ManagerHomePage';
import { ManagerSchoolPage } from '@/modules/manager/ui/manager/ManagerSchoolPage';
import { ManagerNationalPage } from '@/modules/manager/ui/manager/ManagerNationalPage';
import { ManagerProvincePage } from '@/modules/manager/ui/manager/ManagerProvincePage';
import { ManagerWardPage } from '@/modules/manager/ui/manager/ManagerWardPage';

export const managerRoutes: AppRouteDef[] = [
  { path: '', element: <ManagerHomePage />, layout: 'manager' },
  { path: 'school/:id', element: <ManagerSchoolPage />, layout: 'manager' },
  // Ba màn báo cáo địa bàn (Owner 22/08) — Bộ · Tỉnh · Xã.
  { path: 'national', element: <ManagerNationalPage />, layout: 'manager' },
  { path: 'province/:id', element: <ManagerProvincePage />, layout: 'manager' },
  { path: 'ward/:id', element: <ManagerWardPage />, layout: 'manager' },
];

export const managerRoutePrefix = '/manager';
