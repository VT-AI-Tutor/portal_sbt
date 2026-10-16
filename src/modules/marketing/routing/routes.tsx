import type { AppRouteDef } from "@/core/routing/types";
import { getLandingVariant } from "@/core/landing/variant";
import { LandingPage } from "@/modules/marketing/ui/public/LandingPage";
import { AboutPage } from "@/modules/marketing/ui/public/AboutPage";
import { PracticeLandingPage } from "@/modules/marketing/ui/public/practice-landing/PracticeLandingPage";
import { PracticeLandingPageV1 } from "@/modules/marketing/ui/public/practice-landing-v1/PracticeLandingPageV1";
import { PracticeTopicPage } from "@/modules/marketing/ui/public/practice-landing/PracticeTopicPage";
import { PRACTICE_TOPIC_ROUTE } from "@/modules/marketing/ui/public/practice-landing/topicRoute";

const landingElement =
  getLandingVariant() === "practice" ? (
    <PracticeLandingPage />
  ) : (
    <LandingPage />
  );

export const marketingRoutes: AppRouteDef[] = [
  { path: "/", element: landingElement, layout: "public" },
  { path: "/gioi-thieu", element: <AboutPage />, layout: "public" },
  // Chi tiết một bài luyện tập — công khai, mở từ thẻ trên landing.
  {
    path: PRACTICE_TOPIC_ROUTE,
    element: <PracticeTopicPage />,
    layout: "public",
  },
  // Bản lưu trữ v1 của landing luyện tập — chỉ để đối chiếu, KHÔNG link từ đâu
  // trong app. Bản chuẩn vẫn là landingElement ở "/".
  {
    path: "/luyen-tap-cu",
    element: <PracticeLandingPageV1 />,
    layout: "public",
  },
];
