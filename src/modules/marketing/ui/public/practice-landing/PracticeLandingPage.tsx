import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/core/auth/AuthContext";
import { homePathForUser } from "@/core/auth/roles";
import { getBrand } from "@/core/brand/brand";
import { RegisterDialog } from "@/modules/books/ui/public/RegisterDialog";
import { StudentLoginDialog } from "@/modules/books/ui/public/StudentLoginDialog";
import { COPY } from "./copy";
import { findDemoSet } from "./demo/demoSets";
import { HeroSection } from "./sections/HeroSection";
import { BrowseSection } from "./sections/BrowseSection";
import { trackLandingEvent } from "./analytics";

/**
 * Trang landing "luyện thử" (spec 2026-07-18 practice-landing). Route mount qua layout
 * 'public' (Task 8) — layout đó KHÔNG tự thêm header/footer, nên trang tự vẽ header/footer
 * riêng ở đây (giống LandingPage.tsx).
 */
export function PracticeLandingPage() {
  // Bộ lọc của khu duyệt, nâng lên đây vì bộ demo ở hero cũng bám theo lựa chọn.
  const [browseLevel, setBrowseLevel] = useState("all");
  const [browseSubject, setBrowseSubject] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  // Logo theo brand đang chạy, không hard-code đường dẫn dehoctot.
  const logo = getBrand().logo;

  // Ref-gate chống double-fire dưới StrictMode (dev mount 2 lần) — cùng quy ước
  // với DemoWidget.tsx (completedRef) / useCountdown.ts (firedRef).
  const landingViewFiredRef = useRef(false);
  useEffect(() => {
    if (landingViewFiredRef.current) return;
    landingViewFiredRef.current = true;
    trackLandingEvent("landing_view");
  }, []);

  const openRegister = () => {
    trackLandingEvent("signup_from_landing");
    setRegisterOpen(true);
  };

  return (
    // Không đặt gradient ở đây: body đã có `background: var(--gradient-bg)`
    // (styles.css), đúng nền kem ấm của trang tham khảo dưới theme warm.
    <div className="min-h-screen flex flex-col">
      <header className="border-b-2 bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            {logo ? (
              <img
                src={logo.src}
                srcSet={logo.srcSet}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
                className="h-9 sm:h-10 w-auto"
              />
            ) : (
              <span className="font-display font-bold text-lg text-foreground">
                {COPY.brandShort}
              </span>
            )}
          </Link>

          <nav className="hidden md:flex gap-5 text-sm font-medium text-muted-foreground ml-8">
            <a href="#bai-tap" className="hover:text-foreground no-underline">
              {COPY.navExercises}
            </a>
            <a
              href="/gioi-thieu"
              className="hover:text-foreground no-underline"
            >
              {COPY.navAbout}
            </a>
          </nav>

          <div className="flex-1" />

          <div className="text-xs text-muted-foreground hidden lg:block mr-2">
            {COPY.slogan}
          </div>

          {isAuthenticated ? (
            // Đã đăng nhập mà quay ra landing: cho lối VỀ KHU của mình, không bắt đăng nhập lại.
            <Link
              to={homePathForUser(user)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-soft hover:opacity-90 transition no-underline"
            >
              {COPY.authenticatedCta}
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-sm font-bold text-foreground hover:text-primary px-2 cursor-pointer"
                onClick={() => setLoginOpen(true)}
              >
                {COPY.loginCta}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-soft hover:opacity-90 transition cursor-pointer"
                onClick={openRegister}
              >
                {COPY.registerCta}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* findDemoSet đã rơi về bộ đầu tiên với cặp lạ, nên mọi tổ hợp chip đều an toàn. */}
      <HeroSection
        demoSet={findDemoSet(
          browseLevel === "all" ? "3" : browseLevel,
          browseSubject ?? "toan",
        )}
        onRegisterClick={() => openRegister()}
        onDemoStart={() => trackLandingEvent("demo_start")}
        onDemoComplete={(correct) =>
          trackLandingEvent("demo_complete", { correct })
        }
      />

      <BrowseSection
        level={browseLevel}
        subjectCode={browseSubject}
        onLevelChange={setBrowseLevel}
        onSubjectChange={setBrowseSubject}
      />

      {/* Trang tham khảo còn một hàng "Xem demo vai trò khác" — đó là tiện ích
          của bản prototype để nhảy giữa dashboard giả; ở app thật các route đó
          có phân quyền nên bỏ, giữ cặp Điều khoản / Quyền riêng tư. */}
      <footer className="border-t-2 border-border bg-card mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
          <div>
            © {COPY.brandShort} · {COPY.slogan}
          </div>
          <div className="flex items-center gap-3">
            <a href="/gioi-thieu" className="hover:text-primary">
              {COPY.footerTerms}
            </a>
            <span className="text-border">·</span>
            <a href="/gioi-thieu" className="hover:text-primary">
              {COPY.footerPrivacy}
            </a>
          </div>
        </div>
      </footer>

      <RegisterDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <StudentLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
