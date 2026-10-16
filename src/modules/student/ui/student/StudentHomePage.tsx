import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import {
  Sparkles,
  Clock,
  ArrowRight,
  Flame,
  BookOpen,
  Dumbbell,
  Swords,
  Loader2,
} from "lucide-react";
import { CozzyAvatar } from "./CozzyAvatar";
import { Link } from "react-router-dom";
import { useAuth } from "@/core/auth/AuthContext";
import {
  useGamificationSummary,
  useShopInventory,
} from "@/modules/student/api/hooks";
import { STREAK_FREEZE_CODE } from "@/modules/student/api/shopApi";
import { DailyQuestsCard } from "./home/DailyQuestsCard";
import { LessonTitleText } from "@/modules/books/ui/shared/LessonTitleText";
import {
  getContinueLearning,
  type ContinueLearningExercise,
  type ContinueLearningSubject,
} from "@/modules/books/api/assessmentApi";

export function StudentHomePage() {
  const { user } = useAuth();
  // GAP-085: cùng query key với pills ở header nên dùng chung cache, không tốn thêm request.
  const { data: stats } = useGamificationSummary();
  const { data: inventory } = useShopInventory();
  const streakFreezeHeld =
    inventory?.find((i) => i.item_code === STREAK_FREEZE_CODE)?.quantity ?? 0;
  const displayName = (user as Record<string, unknown>)?.full_name
    ? String((user as Record<string, unknown>).full_name)
    : "Em";

  const [items, setItems] = useState<ContinueLearningSubject[]>([]);
  const [level, setLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getContinueLearning()
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
          setLevel(data.level);
        }
      })
      .catch(() => {
        // GAP-066: không nuốt lỗi — báo để học sinh biết mục "Tiếp tục học" chưa tải được
        // (id chung để không nhân đôi khi effect chạy lại).
        if (!cancelled) {
          toast.error(
            "Chưa tải được mục “Tiếp tục học”. Em thử tải lại trang nhé.",
            {
              id: "continue-learning-failed",
            },
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Flatten continue + next items for the card list
  const cards: Array<ContinueLearningExercise & { subject_name: string }> = [];
  for (const subj of items) {
    if (subj.continue) {
      cards.push({ ...subj.continue, subject_name: subj.subject_name });
    }
    if (subj.next) {
      cards.push({ ...subj.next, subject_name: subj.subject_name });
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* Hero greeting */}
      <Card className="p-6 md:p-8 border-2 bg-gradient-to-br from-primary/15 via-warning/10 to-fun/10 relative overflow-hidden">
        <div className="flex items-center gap-6">
          <CozzyAvatar
            equipped={stats?.equipped}
            className="size-24 md:size-32 animate-float shrink-0"
          />
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">
              {"Xin ch\u00e0o,"}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              {displayName} {"\u01a1i! \uD83D\uDC4B"}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/student/assignments">
                <Button className="btn-pop rounded-full">
                  {"\u0042\u1eaft \u0111\u1ea7u l\u00e0m b\u00e0i \u2192"}
                </Button>
              </Link>
              <Link to="/student/battle">
                <Button variant="outline" className="rounded-full">
                  {"V\u00e0o tr\u1eadn \u0111\u1ea5u"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* GAP-085: d\u00f9ng S\u1ed0 TH\u1eacT (c\u00f9ng ngu\u1ed3n v\u1edbi pills \u1edf header) thay v\u00ec "--".
          GAP-093: \u0111\u00e3 b\u1ecf \u00f4 "H\u1ea1ng l\u1edbp" \u2014 x\u1ebfp h\u1ea1ng theo l\u1edbp KH\u00d4NG t\u1ed3n t\u1ea1i \u1edf b\u1ea5t k\u1ef3 \u0111\u00e2u trong h\u1ec7
          (kh\u00f4ng API, kh\u00f4ng BE, kh\u00f4ng leaderboard), nh\u00e3n \u0111\u00f3 h\u1ee9a m\u1ed9t t\u00ednh n\u0103ng kh\u00f4ng c\u00f3.
          "XP tu\u1ea7n n\u00e0y" \u0111\u1ed5i th\u00e0nh t\u1ed5ng XP: xp_history c\u1ee7a BE b\u1ecb c\u1eaft \u1edf 50 s\u1ef1 ki\u1ec7n g\u1ea7n nh\u1ea5t n\u00ean
          c\u1ed9ng ra "tu\u1ea7n n\u00e0y" s\u1ebd THI\u1ebeU v\u1edbi h\u1ecdc sinh t\u00edch c\u1ef1c \u2014 th\u00e0 hi\u1ec7n \u0111\u00fang t\u1ed5ng c\u00f2n h\u01a1n s\u1ed1 sai. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5 border-2 border-warning bg-warning/5">
          <div className="flex items-center gap-2">
            <Flame className="text-warning" />
            <span className="font-bold">{"Chu\u1ed7i h\u1ecdc"}</span>
          </div>
          <div className="font-display text-3xl font-bold mt-1">
            {stats ? `${stats.streak_current} ng\u00e0y` : "--"}
          </div>
          <div className="text-xs text-muted-foreground">
            {stats && stats.streak_best > 0
              ? `K\u1ef7 l\u1ee5c: ${stats.streak_best} ng\u00e0y`
              : "Ti\u1ebfp t\u1ee5c \u0111\u1ec3 m\u1edf huy hi\u1ec7u!"}
          </div>
          {streakFreezeHeld > 0 && (
            <div
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary"
              title="Tự bảo vệ chuỗi khi bạn lỡ 1 ngày (tối đa 2 lượt)"
            >
              🧊 ×{streakFreezeHeld} đóng băng chuỗi
            </div>
          )}
        </Card>
        <Card className="p-5 border-2 border-fun bg-fun/5">
          <div className="flex items-center gap-2">
            <Sparkles className="text-fun" />
            <span className="font-bold">{"XP"}</span>
          </div>
          <div className="font-display text-3xl font-bold mt-1">
            {stats ? stats.xp.toLocaleString("vi-VN") : "--"}
          </div>
          <div className="text-xs text-muted-foreground">
            {stats ? `${stats.coins.toLocaleString("vi-VN")} xu` : "--"}
          </div>
        </Card>
      </div>

      <DailyQuestsCard />

      {/* Quick actions */}
      <div>
        <h2 className="font-display text-xl font-bold mb-3">
          {"L\u1ed1i t\u1eaft"}
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <QuickAction
            to="/student/assignments"
            icon={BookOpen}
            label={"B\u00e0i t\u1eadp \u0111\u01b0\u1ee3c giao"}
            desc={"Xem b\u00e0i t\u1eadp"}
            color="bg-primary/15 text-primary"
          />
          <QuickAction
            to="/student/practice"
            icon={Dumbbell}
            label={"Luy\u1ec7n t\u1eadp t\u1ef1 do"}
            desc={"Ch\u1ecdn m\u00f4n / ch\u1ebf \u0111\u1ed9"}
            color="bg-info/15 text-info"
          />
          <QuickAction
            to="/student/battle"
            icon={Swords}
            label={"Thi \u0111\u1ea5u"}
            desc={"Ph\u00f2ng \u0111ang m\u1edf"}
            color="bg-fun/15 text-fun"
          />
        </div>
      </div>

      {/* Continue learning */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-bold">
            {"\uD83D\uDCDA Ti\u1ebfp t\u1ee5c h\u1ecdc"}
          </h2>
          <Link
            to="/student/assignments"
            className="text-sm text-primary hover:underline"
          >
            {"Xem t\u1ea5t c\u1ea3"}
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : cards.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {level
              ? "Em \u0111\u00e3 ho\u00e0n th\u00e0nh t\u1ea5t c\u1ea3 b\u00e0i t\u1eadp ho\u1eb7c ch\u01b0a c\u00f3 n\u1ed9i dung cho l\u1edbp " +
                level +
                ". H\u00e3y quay l\u1ea1i sau nh\u00e9!"
              : "H\u00e3y c\u1eadp nh\u1eadt kh\u1ed1i l\u1edbp trong h\u1ed3 s\u01a1 \u0111\u1ec3 b\u1eaft \u0111\u1ea7u h\u1ecdc!"}
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {cards.map((c) => (
              <LearningCard key={`${c.exercise_id}-${c.status}`} card={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LearningCard({
  card,
}: {
  card: ContinueLearningExercise & { subject_name: string };
}) {
  const isInProgress = card.status === "in_progress";
  const statusLabel = isInProgress ? "ĐANG LÀM" : "CHƯA BẮT ĐẦU";
  const statusColor = isInProgress ? "text-warning" : "text-primary";

  return (
    <Link to={`/student/lesson/${card.lesson_id}`}>
      <Card className="p-4 border-2 hover:border-primary transition-all hover:-translate-y-0.5 cursor-pointer">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className={`text-xs uppercase font-bold ${statusColor}`}>
              {card.book_title} {" \u00b7 "} {statusLabel}
            </div>
            <div className="font-display font-bold mt-0.5 truncate">
              <LessonTitleText title={card.lesson_title} />:{" "}
              <LessonTitleText title={card.exercise_title} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-3">
              {card.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> ~{card.duration_minutes}{" "}
                  {"ph\u00fat"}
                </span>
              )}
              <span>{card.subject_name}</span>
            </div>
          </div>
          <ArrowRight className="text-muted-foreground shrink-0" />
        </div>
        {/* GAP-086: bỏ thanh tiến độ bịa. Nó tính min(số câu đã trả lời × 10, 90)% — giả định
            mọi bài đúng 10 câu và cố tình chặn ở 90% nên KHÔNG BAO GIỜ đầy, kể cả khi em đã
            làm xong. Payload continue-learning chỉ có `answer_count`, không có tổng số câu, nên
            không thể tính phần trăm thật; hiện đúng cái mình biết. */}
        {isInProgress && card.answer_count > 0 && (
          <div className="mt-3 text-xs font-medium text-success">
            Đã làm {card.answer_count} câu
          </div>
        )}
      </Card>
    </Link>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  desc,
  color,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  color: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-4 border-2 hover:border-primary cursor-pointer transition-all hover:-translate-y-0.5">
        <div
          className={`size-10 rounded-xl ${color} flex items-center justify-center mb-2`}
        >
          <Icon className="size-5" />
        </div>
        <div className="font-bold">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </Card>
    </Link>
  );
}
