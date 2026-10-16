/**
 * Entry point for `/student/arena/attempt/:attemptId` (Task 13). Loads the
 * student's current in-progress Arena attempt and either:
 *  - the URL's `attemptId` doesn't match (already submitted/expired/wrong
 *    attempt) → toast "Lượt thi đã kết thúc" + back to `/student/arena`.
 *  - otherwise → `ArenaRunner`, which calls back here on submit to show
 *    `ArenaResult`.
 *
 * Pattern cloned from `StudentPracticeSessionPage`: waits for
 * `isFetchedAfterMount` before mounting the runner — the react-query cache
 * may hold a stale attempt (e.g. from the `StudentArenaPage` list) with
 * emptier `answers` than what's actually saved server-side; mounting the
 * (uncontrolled, init-once) runner with that stale snapshot would silently
 * drop the student's restored answers.
 */
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentArenaAttempt } from "@/modules/student/api/arenaHooks";
import type { ArenaSubmitResult } from "@/modules/student/api/arenaApi";
import { ArenaRunner } from "./ArenaRunner";
import { ArenaResult } from "./ArenaResult";

export function ArenaAttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const {
    data: attempt,
    isLoading,
    isFetchedAfterMount,
  } = useCurrentArenaAttempt();
  const [result, setResult] = useState<ArenaSubmitResult | null>(null);

  // Lỗi mạng KHÔNG phải là "hết lượt thi": react-query giữ lại bản cache cuối,
  // nên còn đúng lượt đang làm thì cứ cho làm tiếp thay vì đá em ra ngoài.
  const attemptMatches = !!attempt && attempt.attempt_id === attemptId;
  const notFound = !isLoading && isFetchedAfterMount && !attemptMatches;

  useEffect(() => {
    if (notFound && !result) {
      toast.error("Lượt thi đã kết thúc, em quay lại Đấu trường nhé.");
    }
    // Fire the toast exactly once per resolved "not found" state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound]);

  if (result) {
    return <FullscreenOverlay>
      <ArenaResult result={result} />
    </FullscreenOverlay>;
  }

  // A completed attempt has no local result yet (e.g. fresh page load right
  // after auto-submit navigated here, or the tab was closed before the
  // result screen rendered) — send back to the Arena overview, where the
  // round card / history shows the recorded score.
  if (notFound) {
    return <Navigate to="/student/arena" replace />;
  }

  if (isLoading || !isFetchedAfterMount || !attempt) {
    return (
      <FullscreenOverlay>
        <div className="flex h-dvh items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </FullscreenOverlay>
    );
  }

  return (
    <FullscreenOverlay>
      <ArenaRunner attempt={attempt} onSubmitted={setResult} />
    </FullscreenOverlay>
  );
}

/**
 * Chế độ phòng thi: phủ toàn màn hình (che sidebar + header của shell) để
 * học sinh tập trung làm bài. Overlay tự scroll cho màn kết quả; runner
 * tự quản chiều cao (h-dvh, câu hỏi scroll bên trong).
 */
function FullscreenOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      {children}
    </div>
  );
}
