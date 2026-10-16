import type { ReactNode } from 'react';

export type LayoutShell =
  | 'public'
  | 'student'
  | 'student-sbt'
  | 'teacher'
  | 'manager'
  | 'admin';

export interface AppRouteMeta {
  allowedRoles?: string[];
}

export interface AppRouteDef {
  path: string;
  element: ReactNode;
  layout?: LayoutShell;
  meta?: AppRouteMeta;
}
