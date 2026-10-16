import { AppShell, type NavItem } from "./AppShell";
import { Brain, BookOpen, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/core/auth/AuthContext";
import { NxbgdBrandLockup } from "@/modules/marketing/ui/shared/NxbgdBrandLockup";
import { buildStudentSubtitle } from "./buildStudentSubtitle";

// Khu Student SBT chỉ có 2 mục theo yêu cầu nxbgd: Năng lực + Bài tập.
const items: NavItem[] = [
  { label: "Bài tập", to: "/hoc-sinh/bai-tap", icon: BookOpen, group: 1 },
  { label: "Tiến độ", to: "/hoc-sinh/nang-luc", icon: GraduationCap, group: 1 },
  // { label: "Năng lực", to: "/hoc-sinh/nang-luc-v2", icon: Brain, group: 1 },
];

export function StudentSbtShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate("/");
  };
  const displayName =
    user?.full_name ?? user?.name ?? user?.email ?? "Học sinh";
  const subtitle = buildStudentSubtitle({
    class_name: user?.class_name,
    level: user?.level as string | undefined,
    school_name: user?.school_name as string | undefined,
    email: user?.email,
  });

  return (
    <AppShell
      role="student"
      roleLabel="Học sinh"
      roleColor="bg-primary/15 text-primary"
      navItems={items}
      user={{ name: displayName, subtitle }}
      onLogout={handleLogout}
      brandNode={<NxbgdBrandLockup />}
      exerciseHistoryTo="/lich-su-bai-tap"
      showSidebarAssistantCard={false}
      showRoleLabel={false}
      showHomeButton
      showNotifications={false}
    >
      {children}
    </AppShell>
  );
}
