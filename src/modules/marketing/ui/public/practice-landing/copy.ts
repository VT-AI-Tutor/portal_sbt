/**
 * Mọi chuỗi hiển thị của practice-landing — một nơi duy nhất.
 *
 * Bố cục và câu chữ bám theo trang tham khảo hcmc.dehoctot.vn (quyết định Owner
 * 2026-07-27), thay cho wireframe 7 mục của spec 2026-07-18 §4.
 *
 * Giữ THUẦN CHUỖI, không import React/icon — HeroSection ghép icon theo index.
 */
export const COPY = {
  /**
   * Tên thương hiệu ngắn, dùng cho dải bìa và phần tô màu đầu tên sách.
   * KHÔNG dùng getBrand().title: đó là chuỗi dài "Để học tốt – vững nền tảng,
   * chắc tương lai". Module này chỉ mount khi LANDING=practice, tức brand
   * dehoctot — cùng giả định mà footer vẫn đang dựa vào.
   */
  brandShort: "Để học tốt",
  slogan: "Vững nền tảng, chắc tương lai",

  navExercises: "Bài tập",
  navAbout: "Giới thiệu",
  loginCta: "Đăng nhập",
  registerCta: "Đăng ký",
  authenticatedCta: "Vào luyện tập →",

  heroBadge:
    "Ngân hàng câu hỏi phong phú · Hàng trăm kiểu tương tác · AI hỗ trợ học tập",
  // H1 tách 3 mảnh vì trang tham khảo tô màu cụm giữa.
  heroTitlePre: "Bài tập số nâng cao toàn diện",
  heroTitleAccent: "cho học sinh",
  heroTitlePost: "Việt Nam",
  heroSubtitle:
    "Học vui hơn, hiệu quả hơn cùng Rồng Cozzy và trợ lý AI thông minh — từ trắc nghiệm, kéo thả tới quiz Kahoot, adaptive AI, ghép hình…",
  heroPrimaryCta: "Đăng ký miễn phí",
  heroSecondaryCta: "Xem bài tập",
  /** Ghép icon theo index với HERO_CHIP_ICONS trong HeroSection.tsx. */
  heroChips: [
    "Bám sát Chương trình & SGK",
    "AI hỗ trợ học tập",
    "Gamification",
    "Cá nhân hóa học tập",
  ],

  browseTitle: "Bài tập số nâng cao",
  browseSubtitle:
    "Tuyển chọn theo chương trình GDPT 2018 — chọn lớp và môn học phù hợp với bạn",
  browseAllLevels: "Tất cả",
  subjectSidebarTitle: "Môn học",
  countSuffix: "bài luyện tập",
  questionSuffix: "câu hỏi",
  cardCta: "Vào luyện tập →",

  gridErrorTitle: "Không tải được danh sách bài luyện tập",
  gridErrorBody:
    "Có lỗi khi kết nối tới máy chủ. Vui lòng thử lại; nếu vẫn lỗi, bạn hãy quay lại sau ít phút.",
  gridRetry: "Thử lại",
  gridEmptyTitle: "Không tìm thấy bài luyện tập phù hợp",
  gridEmptyBody:
    "Chưa có bài luyện tập nào khớp với bộ lọc hiện tại. Vui lòng thử lớp hoặc môn khác.",
  gridClearFilters: "Xóa bộ lọc",

  // Trang chi tiết một bài luyện tập.
  topicBack: "← Về trang chủ",
  topicLevelsTitle: "Chọn mức độ để luyện",
  topicLevelsHint:
    "Mỗi mức lấy câu ngẫu nhiên trong ngân hàng câu hỏi, chấm ngay sau khi làm.",
  topicStartCta: (n: number) => `Luyện ${n} câu`,
  topicAvailable: (n: number) => `${n} câu khả dụng`,
  topicNotFoundTitle: "Không tìm thấy bài luyện tập này",
  topicNotFoundBody:
    "Bài luyện tập có thể đã đổi hoặc không có ở khối/môn này. Bạn hãy chọn lại từ trang chủ.",

  footerTerms: "Điều khoản",
  footerPrivacy: "Quyền riêng tư",
} as const;
