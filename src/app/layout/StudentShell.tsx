import { AppShell, type NavItem } from "./AppShell";
import mascotCozzy from "@/assets/mascot-cozzy.svg";
import {
  Home,
  BookOpen,
  Dumbbell,
  Swords,
  Trophy,
  User,
  Brain,
  CalendarClock,
  ShoppingBag,
  Mountain,
  Presentation,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/core/auth/AuthContext";
import { useGamificationSummary } from "@/modules/student/api/hooks";
import { CozzyAvatar } from "@/modules/student/ui/student/CozzyAvatar";
import { buildStudentSubtitle } from "./buildStudentSubtitle";

// Premium KHÔNG có mặt ở menu chính (Owner 17/8): lối vào là thẻ "Gói của tôi"
// trong trang Hồ sơ (PremiumSummaryCard), trang gói nằm ở /student/profile/premium.
const items: NavItem[] = [
  { label: "Trang chủ", to: "/student", icon: Home, group: 1 },
  {
    label: "Năng lực của tôi",
    to: "/student/competency",
    icon: Brain,
    group: 1,
  },
  {
    label: "Bài tập của tôi",
    to: "/student/assignments",
    icon: BookOpen,
    group: 2,
  },
  {
    label: "Bài giảng",
    to: "/student/lectures",
    icon: Presentation,
    group: 2,
  },
  { label: "Luyện tập", to: "/student/practice", icon: Dumbbell, group: 2 },
  { label: "Thi đấu", to: "/student/battle", icon: Swords, group: 2 },
  {
    label: "Đấu trường Olympia",
    to: "/student/arena",
    icon: Mountain,
    group: 2,
  },
  {
    label: "Nhật ký học tập",
    to: "/student/activity",
    icon: CalendarClock,
    group: 3,
  },
  { label: "Thành tích", to: "/student/achievements", icon: Trophy, group: 3 },
  { label: "Cửa hàng", to: "/student/shop", icon: ShoppingBag, group: 3 },
  { label: "Hồ sơ", to: "/student/profile", icon: User, group: 3 },
];

export function StudentShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { data: summary } = useGamificationSummary();
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
      roleLabel="🎓 Học sinh"
      roleColor="bg-primary/15 text-primary"
      navItems={items}
      user={{ name: displayName, subtitle }}
      onLogout={handleLogout}
      // Owner 17/8: bỏ huy hiệu vai trò ở header khu học sinh — học sinh đã biết
      // mình là học sinh, chỗ đó để dành cho tên và chỉ số học tập.
      showRoleLabel={false}
      showStats
      aiHubTo="/student/ai"
      mascot={{
        src: mascotCozzy,
        alt: "Rồng Cozzy",
        name: "Rồng Cozzy",
        tagline: "Trợ lí AI · Bấm để mở →",
      }}
      mascotNode={<CozzyAvatar equipped={summary?.equipped} />}
    >
      {children}
    </AppShell>
  );
}
