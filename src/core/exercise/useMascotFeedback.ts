import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskStatus } from "./tasks/types";
import { mascotFeedbackMessage, type MascotMessage } from "./mascotInstruction";

/** Bao lâu thì lời phản hồi tức thời nhường chỗ cho lời hướng dẫn (ms). */
const TRANSIENT_MS = 2000;

export interface MascotFeedback {
  status: TaskStatus;
  /** Lời phản hồi luôn là chuỗi; lời idle có thể là run giữ định dạng (SBT-73). */
  message: MascotMessage;
  /** Nối vào QuestionPlayer.onStatusChange — verdict của CẢ câu. */
  onStatusChange: (status: TaskStatus) => void;
  /** Nối vào QuestionPlayer.onElementGraded — verdict của TỪNG thao tác. */
  onElementGraded: (elementId: string, verdict: "correct" | "incorrect") => void;
}

/**
 * Trạng thái mascot theo CHẤM NGAY (instant marking).
 *
 * - mỗi thao tác được chấm → mừng/nhắc ngay rồi tự quay về lời hướng dẫn;
 * - cả câu đúng → lời khen giữ nguyên tới khi sang câu khác (không tự tắt);
 * - cả câu đã chấm xong nhưng còn ý sai → nhắc thử lại (tạm thời).
 *
 * `enabled: false` (chấm kín — bài GV giao) giữ mascot ở lời hướng dẫn: verdict
 * không được lộ khi đang làm.
 */
export function useMascotFeedback({
  questionKey,
  idleMessage,
  enabled = true,
}: {
  /** Đổi giá trị này (id câu, hoặc id + nonce làm lại) sẽ đưa mascot về idle. */
  questionKey: string;
  idleMessage: MascotMessage;
  enabled?: boolean;
}): MascotFeedback {
  const [feedback, setFeedback] = useState<{
    status: TaskStatus;
    message: string;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Đếm số lần đã nói để xoay vòng câu chữ; ref nên không gây render thừa.
  const seqRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Sang câu khác (hoặc "Làm lại") → xoá phản hồi cũ, tránh khen nhầm câu mới.
  useEffect(() => {
    clearTimer();
    setFeedback(null);
  }, [questionKey, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const show = useCallback(
    (status: TaskStatus, message: string, sticky: boolean) => {
      clearTimer();
      setFeedback({ status, message });
      if (!sticky) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setFeedback(null);
        }, TRANSIENT_MS);
      }
    },
    [clearTimer],
  );

  const onStatusChange = useCallback(
    (status: TaskStatus) => {
      if (!enabled) return;
      // "idle" là trạng thái nền của player (đang làm dở, hoặc chấm kín nuốt
      // verdict) — bỏ qua để không cắt ngang phản hồi vừa hiện.
      if (status === "success") {
        show("success", mascotFeedbackMessage("question-correct", seqRef.current++), true);
      } else if (status === "error") {
        show("error", mascotFeedbackMessage("question-wrong", seqRef.current++), false);
      }
    },
    [enabled, show],
  );

  const onElementGraded = useCallback(
    (_elementId: string, verdict: "correct" | "incorrect") => {
      if (!enabled) return;
      show(
        verdict === "correct" ? "success" : "error",
        mascotFeedbackMessage(
          verdict === "correct" ? "element-correct" : "element-wrong",
          seqRef.current++,
        ),
        false,
      );
    },
    [enabled, show],
  );

  return {
    status: feedback?.status ?? "idle",
    message: feedback?.message ?? idleMessage,
    onStatusChange,
    onElementGraded,
  };
}
