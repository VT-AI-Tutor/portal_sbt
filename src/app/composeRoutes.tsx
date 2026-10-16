import type { AppRouteDef, LayoutShell } from '@/core/routing/types';

export function routesForShell(routes: AppRouteDef[], shell: LayoutShell): AppRouteDef[] {
  return routes.filter((route) => (route.layout ?? 'public') === shell);
}
