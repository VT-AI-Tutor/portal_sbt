import { useNavigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useAuth } from "@/core/auth/AuthContext";
import {
  LayoutDashboard,
  Send,
  Database,
  LineChart,
  FileBarChart,
  FileEdit,
  ClipboardCheck,
  CheckCircle2,
  GraduationCap,
  Presentation,
} from "lucide-react";

const items = [
  { label: "Dashboard lớp", to: "/teacher", icon: LayoutDashboard, group: 1 },
  { label: "Lớp học", to: "/teacher/classes", icon: GraduationCap, group: 1 },
  { label: "Ngân hàng câu hỏi", to: "/teacher/bank", icon: Database, group: 2 },
  {
    label: "Ngân hàng đề/phiếu",
    to: "/teacher/exam",
    icon: FileEdit,
    group: 2,
  },
  { label: "Bài giảng", to: "/teacher/lectures", icon: Presentation, group: 2 },
  { label: "Giao bài tập", to: "/teacher/assign", icon: Send, group: 3 },
  {
    label: "Thi/Kiểm tra",
    to: "/teacher/test",
    icon: ClipboardCheck,
    group: 3,
  },
  { label: "Chấm bài", to: "/teacher/grading", icon: CheckCircle2, group: 3 },
  {
    label: "Theo dõi tiến độ",
    to: "/teacher/progress",
    icon: LineChart,
    group: 4,
  },
  { label: "Báo cáo", to: "/teacher/reports", icon: FileBarChart, group: 4 },
];

export function TeacherShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate("/");
  };
  const displayName =
    user?.full_name ?? user?.name ?? user?.email ?? "Giáo viên";
  const subtitle = user?.email ?? "Giáo viên";

  return (
    <AppShell
      role="teacher"
      roleLabel="👨‍🏫 Giáo viên"
      roleColor="bg-info/15 text-info"
      navItems={items}
      user={{ name: displayName, subtitle }}
      onLogout={handleLogout}
      aiHubTo="/teacher/ai"
    >
      {children}
    </AppShell>
  );
}
