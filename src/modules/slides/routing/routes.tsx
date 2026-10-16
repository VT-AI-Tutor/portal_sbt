import type { AppRouteDef } from '@/core/routing/types';
import { SlidesPage } from '@/modules/slides/ui/public/SlidesPage';

export const slidesRoutes: AppRouteDef[] = [
  { path: '/slides', element: <SlidesPage />, layout: 'public' },
];
