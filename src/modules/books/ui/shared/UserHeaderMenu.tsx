import { useState, useRef, useEffect } from "react";
import { History, KeyRound, LogIn, LogOut, User, UserCog } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/core/auth/AuthContext";
import { getApiProvider } from "@/core/api/config";
import { isStudentSbtEnabled } from "@/core/access/studentSbtPage";
import { canEnterArea } from "@/core/auth/roles";
import { StudentLoginDialog } from "@/modules/books/ui/public/StudentLoginDialog";
import { ProfileDialog } from "@/modules/books/ui/shared/ProfileDialog";
import { ChangePasswordDialog } from "@/modules/books/ui/shared/ChangePasswordDialog";
import {
  useLcmsAvatarUrl,
  useLcmsCurrentUser,
} from "@/modules/books/ui/shared/useLcmsAvatar";

/**
 * Header widget: shows login button when unauthenticated,
 * or user avatar + name with a dropdown menu when authenticated.
 */
export function UserHeaderMenu() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  // Một dialog hồ sơ, hai chế độ. Đóng chỉ hạ `open` và GIỮ `readOnly` để nội
  // dung không nhảy sang bản sửa được trong lúc chạy animation đóng.
  const [profileDialog, setProfileDialog] = useState({
    open: false,
    readOnly: false,
  });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Chỉ hệ LCMS mới có ảnh đại diện; brand legacy giữ nguyên hai chữ cái đầu.
  const { data: profile } = useLcmsCurrentUser(
    isAuthenticated && getApiProvider() === "lcms",
  );
  const avatarUrl = useLcmsAvatarUrl(profile?.avatarId);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (!isAuthenticated) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          // Mobile chỉ còn icon (Owner 31/7) — cùng cách nhánh đã-đăng-nhập ẩn
          // tên người dùng ở dưới sm. aria-label giữ nghĩa cho người đọc màn hình.
          aria-label="Đăng nhập"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 sm:px-4 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <LogIn className="size-3.5" />
          <span className="hidden sm:inline">Đăng nhập</span>
        </button>
        <StudentLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    );
  }

  // Học sinh đã đăng nhập cũng thấy dropdown hồ sơ ở trang public (trước phải vào
  // /hoc-sinh mới đăng xuất được, line 50); lối vào khu là nút RIÊNG cạnh menu.
  const canEnterStudentArea =
    isStudentSbtEnabled() && canEnterArea(user, "student");

  const displayName =
    user?.full_name || user?.name || user?.email || "Học sinh";
  const initials = (user?.full_name || user?.name || user?.email || "H")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const userSummary = (
    <div className="flex items-center gap-2">
      <User className="size-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate">{displayName}</p>
        {user?.email && (user?.full_name || user?.name) && (
          <p className="text-[10px] text-muted-foreground truncate">
            {user.email}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      {/* Nút "Bài tập của tôi" đứng RIÊNG cạnh menu (đã tách khỏi dropdown); chỉ
          user vào được khu học sinh mới hiện. Giữ nguyên style CTA gốc. */}
      {canEnterStudentArea && (
        <Link
          to="/hoc-sinh"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-soft hover:opacity-90 transition no-underline"
        >
          Bài tập của tôi
        </Link>
      )}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-muted/60 hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors cursor-pointer"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="size-6 rounded-full object-cover shrink-0"
            />
          ) : (
            <span className="size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
              {initials}
            </span>
          )}
          <span className="max-w-[120px] truncate hidden sm:inline">
            {displayName}
          </span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-popover shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Bấm vào tên -> xem hồ sơ (chỉ đọc). Chỉ hệ LCMS mới có API hồ sơ;
                brand legacy giữ khối tên tĩnh như cũ. */}
            {getApiProvider() === "lcms" ? (
              <button
                type="button"
                aria-label="Xem hồ sơ"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileDialog({ open: true, readOnly: true });
                }}
                className="w-full text-left px-3 py-2.5 border-b border-border/60 hover:bg-muted transition-colors cursor-pointer"
              >
                {userSummary}
              </button>
            ) : (
              <div className="px-3 py-2.5 border-b border-border/60">
                {userSummary}
              </div>
            )}
            {/* Cập nhật hồ sơ (tỉnh + đổi mật khẩu) — mở dialog; chỉ hệ LCMS có API. */}
            {getApiProvider() === "lcms" && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileDialog({ open: true, readOnly: false });
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <UserCog className="size-3.5" />
                Cập nhật hồ sơ
              </button>
            )}
            {/* Đổi mật khẩu — màn riêng; đổi thành công sẽ đăng xuất. Chỉ hệ LCMS. */}
            {getApiProvider() === "lcms" && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setPasswordOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <KeyRound className="size-3.5" />
                Đổi mật khẩu
              </button>
            )}
            {/* GAP-067: đường vào trang Lịch sử làm bài (trước đây mồ côi khỏi nav). */}
            <Link
              to="/lich-su-bai-tap"
              onClick={() => setMenuOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <History className="size-3.5" />
              Lịch sử làm bài
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                // finally: rời màn cần đăng nhập kể cả khi API logout lỗi (phiên
                // cục bộ đã bị xoá trong logout() rồi).
                void logout().finally(() => navigate("/"));
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <LogOut className="size-3.5" />
              Đăng xuất
            </button>
          </div>
        )}
        {getApiProvider() === "lcms" && (
          <>
            <ProfileDialog
              open={profileDialog.open}
              onOpenChange={(open) =>
                setProfileDialog((current) => ({ ...current, open }))
              }
              readOnly={profileDialog.readOnly}
            />
            <ChangePasswordDialog
              open={passwordOpen}
              onOpenChange={setPasswordOpen}
            />
          </>
        )}
      </div>
    </div>
  );
}
