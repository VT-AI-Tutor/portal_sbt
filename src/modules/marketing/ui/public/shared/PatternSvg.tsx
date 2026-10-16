import type { CoverPattern } from "./subjectCoverTokens";

/**
 * Hoạ tiết trang trí bìa sách dùng chung cho các trang landing (danh mục + luyện tập).
 *
 * Tách khỏi LandingPage.tsx để hai trang không nhân bản component này: nó phát ra
 * id SVG TOÀN CỤC (`p-dots`, `p-grid`, `p-stars`, `p-tri`), nên hai bản sao là hai
 * định nghĩa cùng id — hôm nay chưa đụng nhau vì hai landing loại trừ nhau theo
 * route, nhưng đó là tình cờ chứ không phải bất biến.
 *
 * Chỉ chứa hình trang trí, KHÔNG chứa chuỗi hiển thị.
 */
export function PatternSvg({ pattern }: { pattern: CoverPattern }) {
  switch (pattern) {
    case "dots":
      return (
        <svg
          className="absolute inset-0 w-full h-full opacity-25"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="p-dots"
              x="0"
              y="0"
              width="14"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="7" cy="7" r="1.6" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#p-dots)" />
        </svg>
      );
    case "grid":
      return (
        <svg
          className="absolute inset-0 w-full h-full opacity-20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="p-grid"
              x="0"
              y="0"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 16 0 L 0 0 0 16"
                fill="none"
                stroke="white"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#p-grid)" />
        </svg>
      );
    case "waves":
      return (
        <svg
          className="absolute inset-0 w-full h-full opacity-25"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 100 140"
        >
          <path
            d="M0 30 Q 25 20 50 30 T 100 30"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M0 60 Q 25 50 50 60 T 100 60"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M0 90 Q 25 80 50 90 T 100 90"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M0 120 Q 25 110 50 120 T 100 120"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
    case "stars":
      return (
        <svg
          className="absolute inset-0 w-full h-full opacity-30"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="p-stars"
              x="0"
              y="0"
              width="28"
              height="28"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M14 4 L16 11 L23 11 L17 15 L19 22 L14 18 L9 22 L11 15 L5 11 L12 11 Z"
                fill="white"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#p-stars)" />
        </svg>
      );
    case "circles":
      return (
        <svg
          className="absolute inset-0 w-full h-full opacity-25"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 100 140"
        >
          <circle
            cx="20"
            cy="20"
            r="14"
            stroke="white"
            strokeWidth="1.2"
            fill="none"
          />
          <circle
            cx="80"
            cy="40"
            r="20"
            stroke="white"
            strokeWidth="1.2"
            fill="none"
          />
          <circle
            cx="30"
            cy="100"
            r="22"
            stroke="white"
            strokeWidth="1.2"
            fill="none"
          />
          <circle
            cx="85"
            cy="115"
            r="12"
            stroke="white"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>
      );
    case "triangles":
      return (
        <svg
          className="absolute inset-0 w-full h-full opacity-25"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="p-tri"
              x="0"
              y="0"
              width="24"
              height="22"
              patternUnits="userSpaceOnUse"
            >
              <polygon
                points="12,3 22,19 2,19"
                fill="none"
                stroke="white"
                strokeWidth="1.2"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#p-tri)" />
        </svg>
      );
  }
}
