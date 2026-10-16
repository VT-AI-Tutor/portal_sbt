import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import defaultMascot from "@/core/assets/mascot-bee.png";
import { getBrand } from "@/core/brand/brand";
import { cn } from "@/core/lib/utils";
import { activeNavTo } from "@/core/routing/activeNav";
import {
  ChevronDown,
  LogOut,
  Settings,
  Sparkles,
  History,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { ProfileEditForm } from "./ProfileEditForm";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/core/ui/tooltip";
import { useSidebarCollapsed } from "@/core/hooks/useSidebarCollapsed";
import { getApiProvider } from "@/core/api/config";
import { ProfileDialog as LcmsProfileDialog } from "@/modules/books/ui/shared/ProfileDialog";
import { GamificationStats } from "./GamificationStats";
import { NotificationBell } from "./NotificationBell";

export interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: number;
}

interface AppShellProps {
  /** Còn nhận từ caller (nguồn của roleLabel/roleColor); shell không đọc trực tiếp. */
  role: "student" | "teacher" | "manager" | "admin";
  roleLabel: string;
  roleColor: string;
  navItems: NavItem[];
  user: { name: string; subtitle: string };
  children: React.ReactNode;
  showStats?: boolean;
  aiHubTo?: string;
  showSidebarAssistantCard?: boolean;
  onLogout?: () => Promise<void> | void;
  mascot?: { src: string; alt: string; name: string; tagline: string };
  /** Nếu có, render node này (vd CozzyAvatar có vật phẩm đang mặc) thay ảnh mascot ở thẻ trợ lí. */
  mascotNode?: React.ReactNode;
  /** Nếu có, thay khối thương hiệu mặc định (mascot + wordmark) ở header — khu /hoc-sinh dùng để khớp trang chủ. */
  brandNode?: React.ReactNode;
  /** Nếu có, thêm mục "Lịch sử làm bài" vào menu người dùng, trỏ tới route này. */
  exerciseHistoryTo?: string;
  /** Hiện huy hiệu vai trò cạnh logo. Mặc định bật; khu /hoc-sinh tắt. */
  showRoleLabel?: boolean;
  /** Hiện nút "Trang chủ" cạnh logo (giúp người dùng ít rành công nghệ về trang chủ). */
  showHomeButton?: boolean;
  /** Hiện chuông thông báo ở header. Mặc định bật; khu /hoc-sinh tắt. */
  showNotifications?: boolean;
}

const DEFAULT_MASCOT = {
  src: defaultMascot,
  alt: "Ong Chăm Chỉ",
  name: "Ong Chăm Chỉ",
  tagline: "Trợ lí AI · Bấm để mở →",
};

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cập nhật hồ sơ</DialogTitle>
          <DialogDescription>
            Thay đổi thông tin cá nhân của bạn
          </DialogDescription>
        </DialogHeader>
        {/* `resetKey={open}` nạp lại dữ liệu mỗi lần mở — mở ra phải thấy giá trị
            đang lưu, không phải thứ người dùng gõ dở rồi đóng đi lần trước. */}
        <ProfileEditForm resetKey={open} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function AppShell({
  roleLabel,
  roleColor,
  navItems,
  user,
  children,
  showStats,
  aiHubTo,
  showSidebarAssistantCard = true,
  onLogout,
  mascot = DEFAULT_MASCOT,
  mascotNode,
  brandNode,
  exerciseHistoryTo,
  showRoleLabel = true,
  showHomeButton = false,
  showNotifications = true,
}: AppShellProps) {
  const location = useLocation();
  // Mục đang sáng = tiền tố dài nhất khớp, để trang chi tiết vẫn giữ menu cha sáng.
  const activeTo = activeNavTo(location.pathname, navItems);
  const [profileOpen, setProfileOpen] = useState(false);
  // Thu gọn menu chính: nhớ giữa các lần vào (localStorage).
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  // Brand có logo riêng (dehoctot…) → img; không có → mascot + wordmark NXBGDVN.
  const brandLogo = getBrand().logo;
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top header */}
      <header className="bg-card border-b-2 border-border sticky top-0 z-40">
        <div className="w-full px-2 sm:px-4 md:px-8 h-16 flex items-center gap-1.5 sm:gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            {brandNode ??
              (brandLogo ? (
                <img
                  src={brandLogo.src}
                  srcSet={brandLogo.srcSet}
                  alt={brandLogo.alt}
                  width={brandLogo.width}
                  height={brandLogo.height}
                  className="h-9 sm:h-10 w-auto"
                />
              ) : (
                <>
                  <img
                    src={mascot.src}
                    alt="NXBGDVN"
                    className="size-10"
                    width={40}
                    height={40}
                  />
                  <div className="hidden sm:block">
                    <div className="font-display font-bold text-base leading-tight">
                      NXBGDVN
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight">
                      Vở bài tập (AI)
                    </div>
                  </div>
                </>
              ))}
          </Link>
          {showHomeButton && (
            <Button
              asChild
              variant="ghost"
              className="rounded-full gap-1.5 bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary"
            >
              <Link to="/">
                <Home className="size-4" />
                <span className="hidden sm:inline">Trang chủ</span>
              </Link>
            </Button>
          )}
          {showRoleLabel && (
            <div
              className={cn(
                "hidden md:inline-flex items-center text-xs px-3 py-1.5 rounded-full font-bold",
                roleColor,
              )}
            >
              {roleLabel}
            </div>
          )}
          <div className="flex-1" />
          {showStats && <GamificationStats />}
          {showNotifications && <NotificationBell />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 sm:gap-2 rounded-xl px-1 sm:px-2 py-1.5 hover:bg-secondary transition-colors"
              >
                <div className="text-right hidden sm:block">
                  <div className="font-bold text-sm">{user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {user.subtitle}
                  </div>
                </div>
                <div className="size-10 rounded-full bg-gradient-to-br from-primary to-fun flex items-center justify-center text-primary-foreground font-bold">
                  {user.name.charAt(0)}
                </div>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="font-semibold">{user.name}</div>
                <div className="text-xs text-muted-foreground font-normal">
                  {user.subtitle}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                <Settings className="size-4" />
                Cập nhật hồ sơ
              </DropdownMenuItem>
              {exerciseHistoryTo && (
                <DropdownMenuItem asChild>
                  <Link to={exerciseHistoryTo}>
                    <History className="size-4" />
                    Lịch sử làm bài
                  </Link>
                </DropdownMenuItem>
              )}
              {onLogout && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void onLogout()}>
                    <LogOut className="size-4" />
                    Đăng xuất
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Trên hệ LCMS (brand nxbgd, khu /hoc-sinh) dùng đúng dialog "Cập nhật
              hồ sơ" của LCMS — cùng thông tin với menu người dùng ở landing
              (tỉnh/geoCode + ngày sinh + đổi mật khẩu qua lcmsUpdateProfile).
              Các brand legacy giữ ProfileDialog cũ (updateProfile qua AuthContext). */}
          {getApiProvider() === "lcms" ? (
            <LcmsProfileDialog
              open={profileOpen}
              onOpenChange={setProfileOpen}
            />
          ) : (
            <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar. "Thu gọn" KHÔNG phải ẩn: thanh bên co còn dải icon, mọi mục
            vẫn bấm được và tên mục hiện ở tooltip. Lựa chọn nhớ qua localStorage
            (useSidebarCollapsed) nên vào lần sau vẫn đúng ý người dùng. */}
        <TooltipProvider delayDuration={150}>
          <aside
            className={cn(
              "shrink-0 hidden lg:flex lg:flex-col bg-card border-r-2 py-3 sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden transition-[width] duration-200",
              collapsed ? "w-16 px-2" : "w-60 px-3",
            )}
          >
            <nav className="space-y-1">
              {navItems.map((item, idx) => {
                const Icon = item.icon;
                const active = item.to === activeTo;
                const prev = navItems[idx - 1];
                const showDivider =
                  prev && item.group !== undefined && prev.group !== item.group;
                const link = (
                  <Link
                    to={item.to}
                    aria-label={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center rounded-xl py-2.5 font-medium text-sm transition-all",
                      collapsed ? "justify-center px-0" : "gap-3 px-3",
                      active
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "hover:bg-secondary text-foreground/80",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
                return (
                  <div key={item.to}>
                    {showDivider && (
                      <div
                        className={cn(
                          "my-2 h-px bg-border",
                          collapsed ? "mx-1" : "mx-3",
                        )}
                      />
                    )}
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </div>
                );
              })}
            </nav>
            {showSidebarAssistantCard &&
              (aiHubTo ? (
                collapsed ? (
                  // Thu gọn: thẻ trợ lí rút về đúng một nút tròn cỡ icon — vẫn là
                  // lối vào /ai, không mất chức năng nào.
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to={aiHubTo}
                        aria-label={mascot.name}
                        className="mt-6 mx-auto flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fun/20 to-primary/10 transition hover:ring-2 hover:ring-fun"
                      >
                        {mascotNode ? (
                          <div className="size-9">{mascotNode}</div>
                        ) : (
                          <img src={mascot.src} alt="" className="size-9" />
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {mascot.name} · {mascot.tagline}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    to={aiHubTo}
                    className="mt-8 block rounded-2xl bg-gradient-to-br from-fun/20 to-primary/10 p-4 text-center hover:ring-2 hover:ring-fun transition group"
                  >
                    {mascotNode ? (
                      <div className="size-20 mx-auto animate-float group-hover:scale-110 transition-transform">
                        {mascotNode}
                      </div>
                    ) : (
                      <img
                        src={mascot.src}
                        alt={mascot.alt}
                        className="size-20 mx-auto animate-float group-hover:scale-110 transition-transform"
                      />
                    )}
                    <div className="text-xs font-bold mt-2">{mascot.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {mascot.tagline}
                    </div>
                  </Link>
                )
              ) : collapsed ? (
                <div className="mt-6 mx-auto flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fun/20 to-primary/10">
                  <img
                    src={mascot.src}
                    alt={mascot.alt}
                    title={mascot.name}
                    className="size-9"
                  />
                </div>
              ) : (
                <div className="mt-8 rounded-2xl bg-gradient-to-br from-fun/20 to-primary/10 p-4 text-center">
                  <img
                    src={mascot.src}
                    alt={mascot.alt}
                    className="size-20 mx-auto animate-float"
                  />
                  <div className="text-xs font-bold mt-2">{mascot.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Trợ lí AI của em
                  </div>
                </div>
              ))}
            {/* Nút bật/tắt nằm ở ĐÁY thanh bên (Owner 17/8): đặt trên đầu thì
                nó chen ngay chỗ mắt đọc mục menu đầu tiên. mt-auto đẩy xuống đáy
                khi menu ngắn; sticky giữ nút trong tầm mắt khi menu dài phải
                cuộn (11 mục + thẻ trợ lí đã tràn ở màn hình cao 800px) — nền
                bg-card để mục menu không lộ ra dưới nút. */}
            <div
              className={cn(
                "mt-auto sticky bottom-0 flex bg-card pt-3",
                collapsed ? "justify-center" : "justify-end",
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
                    aria-expanded={!collapsed}
                    className="flex size-9 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {collapsed ? (
                      <PanelLeftOpen className="size-5" />
                    ) : (
                      <PanelLeftClose className="size-5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {collapsed ? "Mở rộng menu" : "Thu gọn menu"}
                </TooltipContent>
              </Tooltip>
            </div>
          </aside>
        </TooltipProvider>

        {/* Main + bottom nav for mobile */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Mobile bottom nav.
          GAP-089: trước đây `slice(0, 5)` + `grid-cols-5` cứng nên menu học sinh (8 mục) bị cắt
          mất 3 mục cuối — "Nhật ký học tập", "Thành tích", "Hồ sơ" KHÔNG có lối vào nào dưới
          lg (sidebar chỉ hiện từ lg trở lên). Nay hiện MỌI mục, cuộn ngang khi tràn. */}
      <nav className="lg:hidden sticky bottom-0 bg-card border-t-2 z-40 flex gap-1 p-2 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.to === activeTo;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-w-16 flex-1 shrink-0 flex-col items-center gap-1 rounded-lg py-1 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Trợ lý AI trên MOBILE: dưới lg, sidebar (chứa thẻ mascot aiHub) bị ẩn và bottom nav chỉ
          có navItems → không có lối vào /student/ai. Nút nổi mascot (luôn thấy, giống thẻ nổi bật
          ở desktop). Ẩn khi đang ở chính trang trợ lý. */}
      {aiHubTo && location.pathname !== aiHubTo && (
        <Link
          to={aiHubTo}
          aria-label={`Mở ${mascot.name}`}
          className="lg:hidden fixed right-4 bottom-20 z-50 flex items-center gap-1.5 rounded-full bg-gradient-to-br from-fun to-primary pl-1.5 pr-3 py-1.5 shadow-lg ring-2 ring-background active:scale-95 transition-transform"
        >
          <img
            src={mascot.src}
            alt=""
            className="size-9 rounded-full bg-background/30"
          />
          <span className="text-xs font-bold text-primary-foreground inline-flex items-center gap-1">
            <Sparkles className="size-3.5" /> Hỏi AI
          </span>
        </Link>
      )}
    </div>
  );
}
