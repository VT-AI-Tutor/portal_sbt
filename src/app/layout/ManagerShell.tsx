import { useNavigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useAuth } from "@/core/auth/AuthContext";
import { LayoutDashboard } from "lucide-react";

const items = [
  { label: "Tổng quan", to: "/manager", icon: LayoutDashboard },
];

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate("/");
  };
  const displayName = user?.full_name ?? user?.name ?? user?.email ?? "Quản lý";
  const subtitle = user?.email ?? "Quản lý";

  return (
    <AppShell
      role="manager"
      roleLabel="🏛️ Quản lý"
      roleColor="bg-success/15 text-success"
      navItems={items}
      user={{ name: displayName, subtitle }}
      onLogout={handleLogout}
      // Khu Quản lý không có trung tâm AI (khác /teacher/ai, /student/ai) —
      // thẻ Ong Chăm Chỉ ở đây không dẫn đi đâu nên tắt hẳn.
      showSidebarAssistantCard={false}
    >
      {children}
    </AppShell>
  );
}
