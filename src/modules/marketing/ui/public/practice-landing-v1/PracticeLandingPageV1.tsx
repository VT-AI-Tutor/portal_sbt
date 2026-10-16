import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/core/auth/AuthContext";
import { homePathForUser } from "@/core/auth/roles";
import { useLevels, useSubjects } from "@/core/reference";
import { RegisterDialog } from "@/modules/books/ui/public/RegisterDialog";
import { StudentLoginDialog } from "@/modules/books/ui/public/StudentLoginDialog";
import { COPY } from "./copy";
import { findDemoSet } from "./demo/demoSets";
import { HeroSection } from "./sections/HeroSection";
import { WhySection } from "./sections/WhySection";
import { AudienceStrip } from "./sections/AudienceStrip";
import { FinalCta } from "./sections/FinalCta";
import { LevelSubjectSection } from "./sections/LevelSubjectSection";
import { TopicsSection } from "./sections/TopicsSection";
import { trackLandingEvent } from "./analytics";

/**
 * BẢN LƯU TRỮ v1 của landing luyện tập — bố cục 7 mục theo spec
 * 2026-07-18 practice-landing §4, đúng như trước khi dựng lại theo trang tham
 * khảo hcmc.dehoctot.vn (PR #138, 2026-07-28).
 *
 * KHÔNG phải landing đang chạy: bản chuẩn là
 * `../practice-landing/PracticeLandingPage.tsx`, mount ở `/`. Bản này chỉ mount
 * ở `/luyen-tap-cu` để đối chiếu, và cố tình ĐỘC LẬP HOÀN TOÀN (copy.ts, các
 * section, demo riêng) để sửa bản chuẩn không kéo theo bản này.
 *
 * Sửa gì ở đây thì hãy tự hỏi trước: có nên sửa không? Đây là ảnh chụp lịch sử.
 */
export function PracticeLandingPageV1() {
  const [level, setLevel] = useState("3");
  const [subjectCode, setSubjectCode] = useState("toan");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();

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

  // Danh mục Khối/Môn thật (react-query, cache dùng chung với LevelSubjectSection bên
  // dưới qua queryKey). Rỗng/lỗi thì bỏ qua select đó — không vẽ dropdown trống/hỏng.
  const levels = useLevels();
  const subjects = useSubjects();
  const sortedLevels = [...(levels.data ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const sortedSubjects = [...(subjects.data ?? [])].sort(
    (a, b) => a.order - b.order,
  );

  const levelPicker: React.ReactNode =
    sortedLevels.length > 0 ? (
      <select
        aria-label="Chọn lớp"
        value={level}
        onChange={(e) => setLevel(e.target.value)}
        className="h-11 px-3.5 rounded-xl border-2 border-border bg-card text-sm font-bold text-foreground focus:border-primary focus:outline-none cursor-pointer"
      >
        {sortedLevels.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    ) : null;

  const subjectPicker: React.ReactNode =
    sortedSubjects.length > 0 ? (
      <select
        aria-label="Chọn môn"
        value={subjectCode}
        onChange={(e) => setSubjectCode(e.target.value)}
        className="h-11 px-3.5 rounded-xl border-2 border-border bg-card text-sm font-bold text-foreground focus:border-primary focus:outline-none cursor-pointer"
      >
        {sortedSubjects.map((s) => (
          <option key={s.code} value={s.code}>
            {s.label}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary/5 via-background to-fun/5">
      <header className="border-b-2 bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/images/logos/logo-dehoctot.webp"
              srcSet="/images/logos/logo-dehoctot.webp 1x, /images/logos/logo-dehoctot@2x.webp 2x"
              alt="Để học tốt — vững nền tảng, chắc tương lai"
              width={247}
              height={80}
              className="h-9 sm:h-10 w-auto flex-shrink-0"
            />
            <span className="hidden md:inline text-xs text-muted-foreground ml-2 truncate">
              {COPY.slogan}
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <a
              href="#demo-widget"
              className="text-foreground/80 hover:text-primary no-underline"
            >
              Luyện tập
            </a>
            <a
              href="/gioi-thieu"
              className="text-foreground/80 hover:text-primary no-underline"
            >
              Giới thiệu
            </a>
            {isAuthenticated ? (
              // Đã đăng nhập mà quay ra landing: cho lối VỀ KHU của mình, không bắt đăng nhập lại.
              <Link
                to={homePathForUser(user)}
                className="inline-flex items-center justify-center rounded-xl border-2 border-primary bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 no-underline"
              >
                Vào khu của bạn →
              </Link>
            ) : (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary cursor-pointer"
                onClick={() => setLoginOpen(true)}
              >
                Đăng nhập
              </button>
            )}
          </nav>
        </div>
      </header>

      <HeroSection
        demoSet={findDemoSet(level, subjectCode)}
        levelPicker={levelPicker}
        subjectPicker={subjectPicker}
        onTrialClick={() => openRegister()}
        onRegisterClick={() => openRegister()}
        onDemoStart={() => trackLandingEvent("demo_start")}
        onDemoComplete={(correct) =>
          trackLandingEvent("demo_complete", { correct })
        }
      />

      <LevelSubjectSection
        level={level}
        subjectCode={subjectCode}
        onLevelChange={setLevel}
        onSubjectChange={setSubjectCode}
      />
      <TopicsSection
        level={level}
        subjectCode={subjectCode}
        subjectLabel={findDemoSet(level, subjectCode).subjectLabel}
        onTopicClick={() => openRegister()}
      />

      <WhySection />
      <AudienceStrip onRegisterClick={() => openRegister()} />
      <FinalCta onClick={() => openRegister()} />

      <footer className="border-t-2 border-border bg-card mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 w-full text-center text-xs text-muted-foreground">
          © Để học tốt · {COPY.slogan} ·{" "}
          <a href="/gioi-thieu" className="hover:text-primary">
            Điều khoản
          </a>{" "}
          ·{" "}
          <a href="/gioi-thieu" className="hover:text-primary">
            Quyền riêng tư
          </a>
        </div>
      </footer>

      <RegisterDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <StudentLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
