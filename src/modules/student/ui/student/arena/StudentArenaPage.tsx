/**
 * "Đấu trường Olympia" — trang tổng quan 4 vòng (Tuần/Tháng/Quý/Năm), thẻ
 * vòng đang diễn ra + CTA vào thi, thông tin đề thi, bảng xếp hạng và lịch sử
 * lượt thi. Xây trên hooks/logic Task 11 (`arenaApi`/`arenaHooks`/`journeyLogic`).
 */
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Mountain,
  AlertTriangle,
  Trophy,
  FileQuestion,
  Ruler,
  Medal,
} from "lucide-react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Progress } from "@/core/ui/progress";
import { Badge } from "@/core/ui/badge";
import { Skeleton } from "@/core/ui/skeleton";
import { cn } from "@/core/lib/utils";
import { useAuth } from "@/core/auth/AuthContext";
import {
  useArenaOverview,
  useArenaRound,
  useStartArenaAttempt,
} from "@/modules/student/api/arenaHooks";
import { ArenaApiError } from "@/modules/student/api/arenaApi";
import type { ArenaAttempt } from "@/modules/student/api/arenaApi";
import { JourneyStrip } from "./JourneyStrip";
import { LeaderboardCard } from "./LeaderboardCard";
import {
  formatArenaDateRange,
  formatArenaDateTime,
  formatArenaDuration,
} from "./arenaFormat";

type DifficultyKey = "biet" | "hieu" | "vandung" | "vandungcao";

const DIFFICULTY_LABEL: Record<DifficultyKey, string> = {
  biet: "Nhận biết",
  hieu: "Thông hiểu",
  vandung: "Vận dụng",
  vandungcao: "Vận dụng cao",
};

const DIFFICULTY_BAR_COLOR: Record<DifficultyKey, string> = {
  biet: "bg-success",
  hieu: "bg-info",
  vandung: "bg-warning",
  vandungcao: "bg-destructive",
};

const DIFFICULTY_ORDER: DifficultyKey[] = [
  "biet",
  "hieu",
  "vandung",
  "vandungcao",
];

export function StudentArenaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const level = typeof user?.level === "string" ? user.level : null;

  const { data: overview, isLoading, isError, error } = useArenaOverview();
  const weekRound = overview?.rounds.week ?? null;
  const { data: roundDetail, isLoading: roundDetailLoading } = useArenaRound(
    weekRound?.id,
  );
  const startAttempt = useStartArenaAttempt();

  const profileIncomplete =
    isError &&
    error instanceof ArenaApiError &&
    error.errorCode === "ARENA_PROFILE_INCOMPLETE";
  const otherError = isError && !profileIncomplete;

  function handleStart() {
    if (!weekRound) return;
    if (weekRound.current_attempt_id) {
      navigate(`/student/arena/attempt/${weekRound.current_attempt_id}`);
      return;
    }
    startAttempt.mutate(weekRound.id, {
      onSuccess: (attempt: ArenaAttempt) =>
        navigate(`/student/arena/attempt/${attempt.attempt_id}`),
      onError: (err) => {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "Không vào được vòng thi, em thử lại nhé.",
        );
      },
    });
  }

  const ratio = roundDetail?.round.difficulty_ratio;
  const difficultyTotal = ratio
    ? ratio.biet + ratio.hieu + ratio.vandung + ratio.vandungcao
    : 0;
  const difficultyPct = (n: number) =>
    difficultyTotal > 0 ? Math.round((n / difficultyTotal) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Mountain className="text-primary" /> Đấu trường Olympia
        </h1>
        <p className="text-muted-foreground">
          Leo từ Vòng Tuần lên Vòng Tháng, Vòng Quý rồi Vòng Năm — tổ chức theo
          mô hình Đường lên đỉnh Olympia. Kiến thức tổng hợp tất cả các môn học
          và hiểu biết xã hội.
        </p>
      </div>

      {profileIncomplete ? (
        <Card className="p-6 border-2 border-dashed border-warning/40 text-center space-y-3">
          <AlertTriangle className="size-8 text-warning mx-auto" />
          <p className="text-sm">
            Vui lòng cập nhật khối lớp trong hồ sơ để tham gia Đấu trường
            Olympia nhé.
          </p>
          <Button asChild size="sm" className="btn-pop rounded-full">
            <Link to="/student/profile">Cập nhật hồ sơ</Link>
          </Button>
        </Card>
      ) : otherError ? (
        <Card className="p-6 border-2 border-dashed border-destructive/40 text-center">
          <AlertTriangle className="size-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Không tải được Đấu trường Olympia. Thử lại sau nhé!"}
          </p>
        </Card>
      ) : isLoading || !overview ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {/* Banner khối */}
          <Card className="p-4 border-2 border-warning/30 bg-warning/10">
            <p className="text-sm">
              Em đang thi đấu trường{" "}
              <b>Khối {overview.grade || level || "?"}</b> — chỉ học sinh cùng
              khối mới được xếp hạng và tranh Top cùng nhau.
            </p>
          </Card>

          {/* Hành trình */}
          <div>
            <div className="text-xs uppercase font-bold text-muted-foreground mb-2">
              Hành trình leo đỉnh Olympia
            </div>
            <JourneyStrip overview={overview} />
          </div>

          {/* Thẻ vòng đang diễn ra */}
          {!weekRound ? (
            <Card className="p-6 border-2 border-dashed text-center text-sm text-muted-foreground">
              Tuần này chưa có vòng thi.
            </Card>
          ) : weekRound.status === "open" ? (
            <Card className="p-5 border-2 border-primary/40">
              <div className="font-display font-bold text-lg mb-3">
                Vòng Tuần đang diễn ra — {weekRound.period_key} ·{" "}
                {formatArenaDateRange(weekRound.starts_at, weekRound.ends_at)}
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Lượt thi đã dùng {weekRound.attempts_used}/
                    {weekRound.max_attempts}
                  </span>
                </div>
                <Progress
                  value={
                    weekRound.max_attempts > 0
                      ? (weekRound.attempts_used / weekRound.max_attempts) * 100
                      : 0
                  }
                />
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                Được thi tối đa {weekRound.max_attempts} lần, hệ thống tự giữ
                lại điểm cao nhất.
              </p>

              {weekRound.my_best && (
                <p className="text-sm mb-3">
                  Điểm cao nhất hiện tại: <b>{weekRound.my_best.score}/1000</b>{" "}
                  · Thời gian:{" "}
                  <b>
                    {formatArenaDuration(weekRound.my_best.duration_seconds)}
                  </b>
                  {weekRound.my_best.rank != null && (
                    <>
                      {" "}
                      · Đang xếp hạng <b>{weekRound.my_best.rank}</b>
                    </>
                  )}
                </p>
              )}

              {(() => {
                const hasCurrent = !!weekRound.current_attempt_id;
                const outOfAttempts =
                  !hasCurrent &&
                  weekRound.attempts_used >= weekRound.max_attempts;
                const label = hasCurrent
                  ? "Tiếp tục lượt thi"
                  : outOfAttempts
                    ? "Hết lượt thi"
                    : "Vào thi Vòng Tuần →";
                return (
                  <Button
                    className="btn-pop rounded-full h-11"
                    disabled={outOfAttempts || startAttempt.isPending}
                    onClick={handleStart}
                  >
                    {startAttempt.isPending ? "Đang tạo lượt thi..." : label}
                  </Button>
                );
              })()}
            </Card>
          ) : null}

          {/* Thông tin đề thi */}
          {weekRound && (
            <Card className="p-5 border-2">
              <div className="font-display font-bold text-lg mb-3">
                Thông tin đề thi
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 bg-card">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase font-bold text-muted-foreground mb-1">
                    <Trophy className="size-3.5" /> Kiến thức
                  </div>
                  <div className="text-sm">
                    Tổng hợp tất cả các môn + kiến thức xã hội
                  </div>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase font-bold text-muted-foreground mb-1">
                    <FileQuestion className="size-3.5" /> Cấu trúc
                  </div>
                  <div className="text-sm">
                    {weekRound.question_count} câu ·{" "}
                    {weekRound.duration_minutes} phút
                  </div>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase font-bold text-muted-foreground mb-1">
                    <Medal className="size-3.5" /> Cách xét Top
                  </div>
                  <div className="text-sm">
                    Điểm cao nhất, bằng điểm thì xét thời gian ngắn hơn
                  </div>
                </div>
              </div>

              {roundDetailLoading ? (
                <Skeleton className="h-6 w-full mt-4" />
              ) : (
                difficultyTotal > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase font-bold text-muted-foreground mb-1.5">
                      <Ruler className="size-3.5" /> Tỉ lệ độ khó
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden flex bg-muted">
                      {DIFFICULTY_ORDER.map((k) => (
                        <div
                          key={k}
                          className={DIFFICULTY_BAR_COLOR[k]}
                          style={{ width: `${difficultyPct(ratio![k])}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-1.5 text-[11px] text-muted-foreground">
                      {DIFFICULTY_ORDER.map(
                        (k) =>
                          `${DIFFICULTY_LABEL[k]} ${difficultyPct(ratio![k])}%`,
                      ).join(" · ")}
                    </div>
                  </div>
                )
              )}
            </Card>
          )}

          {/* Bảng xếp hạng */}
          <LeaderboardCard rounds={overview.rounds} grade={overview.grade} />

          {/* Lịch sử lượt thi */}
          {weekRound && (
            <Card className="p-5 border-2">
              <div className="font-display font-bold text-lg mb-3">
                Lịch sử lượt thi Vòng Tuần này
              </div>
              {roundDetailLoading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {(roundDetail?.attempts ?? []).map((a) => (
                    <div
                      key={a.attempt_no}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border"
                    >
                      <div className="text-sm">
                        Lượt {a.attempt_no} ·{" "}
                        {formatArenaDateTime(a.submitted_at)}
                        {a.is_best && (
                          <Badge className="ml-2 bg-success text-success-foreground">
                            Điểm tốt nhất
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm font-bold shrink-0">
                        {a.score}đ · {formatArenaDuration(a.duration_seconds)}
                      </div>
                    </div>
                  ))}
                  {Array.from({
                    length: Math.max(
                      0,
                      weekRound.max_attempts -
                        (roundDetail?.attempts.length ??
                          weekRound.attempts_used),
                    ),
                  }).map((_, i) => {
                    const usedCount =
                      roundDetail?.attempts.length ?? weekRound.attempts_used;
                    const attemptNo = usedCount + i + 1;
                    return (
                      <div
                        key={`unused-${attemptNo}`}
                        className={cn(
                          "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-dashed",
                          "text-muted-foreground",
                        )}
                      >
                        <span className="text-sm">
                          Lượt {attemptNo} — chưa sử dụng
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
