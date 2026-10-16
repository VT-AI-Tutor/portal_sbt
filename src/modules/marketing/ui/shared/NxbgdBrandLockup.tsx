/**
 * Bộ nhận diện NXBGDVN: logo + wordmark VN/EN. Dùng chung cho header trang chủ
 * (LandingPage) và header khu /hoc-sinh (StudentSbtShell) để không lệch nhau.
 */
export function NxbgdBrandLockup() {
  return (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      <img
        src="/images/logos/logo-nxbgd.webp"
        srcSet="/images/logos/logo-nxbgd.webp 1x, /images/logos/logo-nxbgd@2x.webp 2x"
        alt=""
        aria-hidden
        width={133}
        height={80}
        className="h-8 sm:h-10 md:h-12 w-auto flex-shrink-0"
      />
      <div className="flex flex-col leading-[1.15] min-w-0">
        <span className="font-display font-extrabold text-[#0072BC] text-[10px] sm:text-sm md:text-base tracking-tight">
          NHÀ XUẤT BẢN GIÁO DỤC VIỆT NAM
        </span>
        <span className="font-display font-bold text-[#C59325] text-[8px] sm:text-[10px] md:text-xs tracking-tight">
          VIETNAM EDUCATION PUBLISHING HOUSE
        </span>
      </div>
    </div>
  );
}
