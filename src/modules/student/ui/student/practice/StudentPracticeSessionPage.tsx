/**
 * Entry point for `/student/practice/session/:sessionId` — loads the
 * session, then either:
 *  - `status === "completed"` → resolves the stored result via the
 *    idempotent submit endpoint and shows `SessionResult` (covers reload
 *    after submit, or navigating back to a finished session's URL).
 *  - otherwise → `PracticeRunner`, which calls back here on submit.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/core/ui/button";
import {
  usePracticeSession,
  useSessionReview,
  useSubmitPracticeSession,
} from "@/modules/student/api/hooks";
import type { SubmitResult } from "@/modules/student/api/practiceApi";
import { PracticeRunner } from "./PracticeRunner";
import { SessionResult } from "./SessionResult";

export function StudentPracticeSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const {
    data: session,
    isLoading,
    isError,
    error,
    isFetchedAfterMount,
  } = usePracticeSession(sessionId);
  const submitMutation = useSubmitPracticeSession();
  const [result, setResult] = useState<SubmitResult | null>(null);
  // Chi tiết bài làm chỉ đọc được sau khi phiên đã completed (BE trả 409 nếu gọi sớm).
  const reviewQuery = useSessionReview(
    sessionId,
    session?.status === "completed" || result !== null,
  );

  // A completed session has no stored result on the client (e.g. fresh page
  // load) — `submit` is idempotent server-side, so re-calling it just
  // returns what was already recorded.
  useEffect(() => {
    if (session && session.status === "completed" && !result) {
      submitMutation.mutate(
        { sessionId: session.id, notifyHost: false },
        { onSuccess: setResult },
      );
    }
    // Only re-run when the session identity/status actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status]);

  function handleSubmit() {
    if (!session) return;
    // notifyHost:true — the hook's onSuccess emits the embed `submit` event
    // (fires even if this page unmounts before the request settles).
    submitMutation.mutate(
      { sessionId: session.id, notifyHost: true },
      { onSuccess: setResult },
    );
  }

  // `!isFetchedAfterMount`: cache có thể là bản phiên từ lúc TẠO (answers rỗng)
  // trong khi server đã có đáp án autosave — PracticeRunner init answers một lần
  // (useState initializer, player uncontrolled) nên mount với bản stale là mất
  // khôi phục. Chờ refetch sau mount xong rồi mới mount runner.
  if (isLoading || (!isError && !isFetchedAfterMount)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-2">
        <AlertTriangle className="size-10 text-destructive mx-auto" />
        <p className="text-destructive">
          {error?.message ?? "Không tải được phiên luyện tập."}
        </p>
      </div>
    );
  }

  if (result) {
    return (
      <SessionResult
        session={session}
        result={result}
        review={reviewQuery.data ?? null}
        reviewLoading={reviewQuery.isLoading}
        reviewError={reviewQuery.isError}
      />
    );
  }

  // Không có nhánh này thì lỗi rơi xuống ô xoay bên dưới và bị nuốt mất.
  if (session.status === "completed" && submitMutation.isError) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-3">
        <AlertTriangle className="size-10 text-destructive mx-auto" />
        <p className="text-destructive">
          {submitMutation.error?.message ?? "Không lấy được kết quả bài làm."}
        </p>
        <p className="text-sm text-muted-foreground">
          Bài của em đã được ghi nhận — chỉ là chưa tải được kết quả.
        </p>
        {/* Không cần trạng thái đang tải: bấm xong isError tắt, nhánh này nhường
            chỗ cho ô xoay bên dưới. */}
        <Button
          variant="outline"
          onClick={() =>
            submitMutation.mutate(
              { sessionId: session.id, notifyHost: false },
              { onSuccess: setResult },
            )
          }
        >
          Thử lại
        </Button>
      </div>
    );
  }

  // Completed but the idempotent re-submit hasn't resolved yet.
  if (session.status === "completed") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PracticeRunner
      session={session}
      onSubmit={handleSubmit}
      submitting={submitMutation.isPending}
      submitError={
        submitMutation.isError ? (submitMutation.error?.message ?? null) : null
      }
    />
  );
}
