/**
 * Result screen shown after a practice session is submitted (or reopened —
 * `submit` is idempotent server-side and returns the stored result).
 *
 * `result.rewards` is `null` when gamification failed to compute on the
 * first submit — the rewards block is simply omitted in that case, no error
 * UI (requirement 8 in the task brief).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  Flame,
  Award,
  Sparkles,
  ArrowRight,
  Brain,
  Loader2,
} from "lucide-react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/lib/utils";
import {
  isEmbedded,
  postToNative,
  type EmbedNavTarget,
} from "@/core/embed/bridge";
import type {
  PracticeSession,
  SessionReview,
  SubmitResult,
} from "@/modules/student/api/practiceApi";
import { SessionReviewQuestions } from "./review/SessionReviewQuestions";
import { TopicMasteryCard } from "./review/TopicMasteryCard";
import { WeakPointsCard } from "./review/WeakPointsCard";
import { NextStepsCard } from "./review/NextStepsCard";

// Insertion order here doubles as the display/group order of the mastery
// card (Mức → Chủ đề → Kỹ năng → Năng lực → Thành tố) — see buildMasteryRows.
const DIMENSION_LABEL: Record<string, string> = {
  cognitive_level: "Mức",
  content: "Chủ đề",
  outcome: "Kỹ năng",
  competency: "Năng lực",
  component: "Thành tố",
};

const DIMENSION_ORDER = Object.keys(DIMENSION_LABEL);

/** Lowercase + strip Vietnamese diacritics (incl. đ/Đ, which NFD doesn't
 * decompose) so prefix comparisons ignore accents. */
function normalizeVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

/** `label` already starting with the group name (e.g. "Năng lực địa lí"
 * under the "Năng lực" group) would otherwise double up as
 * "Năng lực Năng lực địa lí" — drop the redundant prefix in that case. */
function formatMasteryLabel(group: string, label: string): string {
  return normalizeVi(label).startsWith(normalizeVi(group))
    ? label
    : `${group} ${label}`;
}

/**
 * Chọn + sắp xếp các dòng mastery_delta hiện lên card "Thay đổi năng lực".
 *
 * - "subject" luôn bị ẩn — không liên quan tới competency/component, lọc
 *   này có từ trước (GAP-163) và giữ nguyên.
 * - MỌI dimension khác: `key` chỉ là mã máy (vd "biet", "DL6_S33",
 *   "YCCĐ1.1.1") — không được lộ mã thô cho học sinh. Chỉ hiện dòng khi API
 *   kèm `label` tiếng Việt (GAP-231 Pha 2, nay phủ cả 5 dimension chứ không
 *   chỉ competency/component); không có label thì ẩn hoàn toàn dòng đó.
 * - Dòng "không đổi" (before_percent === after_percent) là nhiễu — phần lớn
 *   sau khi một buổi luyện chỉ chạm tới vài dimension — nên bị ẩn.
 * - Các dòng còn lại được nhóm theo dimension, thứ tự cố định Mức → Chủ đề →
 *   Kỹ năng → Năng lực → Thành tố (DIMENSION_ORDER); trong một nhóm giữ
 *   nguyên thứ tự tương đối như trong response gốc (Array.sort ổn định).
 */
function buildMasteryRows(delta: SubmitResult["mastery_delta"]) {
  const visible = delta.filter((d) => {
    if (d.dimension === "subject") return false;
    if (!d.label) return false;
    return d.before_percent !== d.after_percent;
  });
  return [...visible].sort((a, b) => {
    const ai = DIMENSION_ORDER.indexOf(a.dimension);
    const bi = DIMENSION_ORDER.indexOf(b.dimension);
    return (
      (ai === -1 ? DIMENSION_ORDER.length : ai) -
      (bi === -1 ? DIMENSION_ORDER.length : bi)
    );
  });
}

/** Post-result CTA targets → their in-app route (used only outside embed). */
const CTA_ROUTE: Record<EmbedNavTarget, string> = {
  practice: "/student/practice",
  competency: "/student/competency",
};

/** Count 0 → target with an ease-out tween — a tasteful "+X XP" reveal. */
function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // Guarantee final value lands even when rAF is throttled (e.g., hidden tabs)
    const timeout = setTimeout(() => {
      setValue(target);
      cancelAnimationFrame(raf);
    }, durationMs + 100);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [target, durationMs]);

  return value;
}

interface SessionResultProps {
  /** Giữ trong hợp đồng cho đường gọi hiện có; danh sách câu nay lấy từ `review`. */
  session: PracticeSession;
  result: SubmitResult;
  /** Chi tiết bài làm — tải riêng sau khi nộp; null khi chưa có/không tải được. */
  review?: SessionReview | null;
  reviewLoading?: boolean;
  reviewError?: boolean;
}

export function SessionResult({
  result,
  review,
  reviewLoading,
  reviewError,
}: SessionResultProps) {
  const navigate = useNavigate();
  const scorePercent =
    result.max_score > 0
      ? Math.round((result.score / result.max_score) * 100)
      : 0;
  const masteryRows = buildMasteryRows(result.mastery_delta);

  // In embed the /student/* routes have no chrome-less equivalent, so the CTAs
  // ask the native host to close the WebView and open the matching screen;
  // in the normal app they navigate in-app as before.
  function handleCta(target: EmbedNavTarget) {
    if (isEmbedded()) {
      postToNative({ type: "navigate", target });
    } else {
      navigate(CTA_ROUTE[target]);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      {/* Score header */}
      <Card className="p-6 border-2 text-center space-y-2">
        <div className="text-xs uppercase font-bold text-muted-foreground">
          Kết quả
        </div>
        <div className="font-display text-4xl font-black text-foreground">
          {result.score}
          <span className="text-xl font-bold text-muted-foreground">
            {" "}
            / {result.max_score}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">Đạt {scorePercent}%</div>
      </Card>

      {/* Rewards block — omitted entirely when rewards is null */}
      {result.rewards && <RewardsBlock rewards={result.rewards} />}

      {reviewLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {/* Điểm đã được ghi nhận rồi — review hỏng thì báo nhẹ, không chặn màn hình. */}
      {reviewError && (
        <p className="text-sm text-muted-foreground text-center">
          Không tải được phần xem lại. Điểm của em đã được ghi nhận.
        </p>
      )}

      {review && <TopicMasteryCard mastery={review.topic_mastery} />}

      {review && <WeakPointsCard weakPoints={review.weak_points} />}

      {review && <SessionReviewQuestions questions={review.questions} />}

      {/* Mastery delta */}
      {masteryRows.length > 0 && (
        <Card className="p-4 border-2">
          <h3 className="font-display font-bold mb-3 flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            Thay đổi năng lực
          </h3>
          <div className="space-y-1.5">
            {masteryRows.map((d, i) => {
              const group = DIMENSION_LABEL[d.dimension] ?? d.dimension;
              return (
                <div
                  key={`${d.dimension}-${d.key}-${i}`}
                  className="flex items-center justify-between text-sm rounded-lg bg-muted/40 px-3 py-1.5"
                >
                  <span className="font-medium">
                    {formatMasteryLabel(group, d.label!)}
                  </span>
                  <span className="font-bold tabular-nums">
                    {d.before_percent}% → {d.after_percent}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {review ? (
        <NextStepsCard review={review} />
      ) : (
        /* Đường lui khi chưa có review: hai nút điều hướng như trước. Trong embed
           chúng thoát WebView về màn native (handleCta). */
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            className="sm:flex-1 gap-2 btn-pop"
            onClick={() => handleCta("practice")}
          >
            Luyện tiếp
            <ArrowRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="sm:flex-1 gap-2"
            onClick={() => handleCta("competency")}
          >
            Xem năng lực
          </Button>
        </div>
      )}
    </div>
  );
}

function RewardsBlock({
  rewards,
}: {
  rewards: NonNullable<SubmitResult["rewards"]>;
}) {
  const xp = useCountUp(rewards.xp_gained);
  const coins = useCountUp(rewards.coins_gained);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card className="p-5 border-2 border-fun/40 bg-fun/5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-fun" />
          <h3 className="font-display font-bold">Phần thưởng</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-card border p-3 text-center">
            <div className="font-display text-2xl font-black text-primary tabular-nums">
              +{xp} XP
            </div>
          </div>
          <div className="rounded-xl bg-card border p-3 text-center">
            <div className="font-display text-2xl font-black text-warning-foreground tabular-nums">
              +{coins} xu
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card border p-3">
          <span className="inline-flex items-center gap-1.5 font-bold text-sm">
            <Flame className="size-4 text-destructive" />
            {rewards.streak.current} ngày
          </span>
          {rewards.streak.extended && (
            <span className="text-xs font-bold text-fun">Chuỗi mới!</span>
          )}
        </div>

        {rewards.badges_unlocked.length > 0 && (
          <div className="space-y-2">
            {rewards.badges_unlocked.map((b) => (
              <motion.div
                key={b.code}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="flex items-center gap-2 rounded-xl border-2 border-primary/40 bg-primary/10 p-3"
              >
                <Award className="size-5 text-primary shrink-0" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-primary">
                    Huy hiệu mới
                  </div>
                  <div className="font-bold text-sm">{b.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}