/**
 * React-query hooks for the student Arena screens. Pattern cloned from
 * `src/modules/student/api/hooks.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getArenaOverview,
  getArenaRound,
  getArenaLeaderboard,
  getCurrentArenaAttempt,
  startArenaAttempt,
  submitArenaAttempt,
  saveArenaAnswers,
} from "./arenaApi";
import type {
  ArenaAttempt,
  ArenaLeaderboard,
  ArenaOverview,
  ArenaRoundDetail,
  ArenaSubmitResult,
} from "./arenaApi";

export function useArenaOverview() {
  return useQuery<ArenaOverview, Error>({
    queryKey: ["arena", "overview"],
    queryFn: getArenaOverview,
  });
}

export function useArenaRound(id: string | undefined) {
  return useQuery<ArenaRoundDetail, Error>({
    queryKey: ["arena", "round", id],
    queryFn: () => getArenaRound(id as string),
    enabled: !!id,
  });
}

export function useStartArenaAttempt() {
  const qc = useQueryClient();
  return useMutation<ArenaAttempt, Error, string>({
    mutationFn: startArenaAttempt,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["arena"] });
    },
  });
}

export function useCurrentArenaAttempt() {
  return useQuery<ArenaAttempt | null, Error>({
    queryKey: ["arena", "attempt", "current"],
    queryFn: getCurrentArenaAttempt,
    // A window-focus refetch mid-attempt would swap `attempt.answers` under
    // ArenaRunner's uncontrolled player state (init-once from props) — the
    // student's just-typed answer would silently vanish. Only ever refetched
    // explicitly (ArenaAttemptPage's mount-time fetch via isFetchedAfterMount).
    refetchOnWindowFocus: false,
    // Bắt buộc, vì staleTime 30s mặc định sẽ bỏ qua lần nạp lúc mount —
    // `isFetchedAfterMount` kẹt false và ArenaAttemptPage xoay vô tận.
    refetchOnMount: "always",
  });
}

export interface SaveArenaAnswersVars {
  attemptId: string;
  answers: Record<string, unknown>;
  keepalive?: boolean;
}

export function useSaveArenaAnswers() {
  return useMutation<void, Error, SaveArenaAnswersVars>({
    mutationFn: ({ attemptId, answers, keepalive }) =>
      saveArenaAnswers(attemptId, answers, { keepalive }),
  });
}

export function useSubmitArenaAttempt() {
  const qc = useQueryClient();
  return useMutation<ArenaSubmitResult, Error, string>({
    mutationFn: submitArenaAttempt,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["arena"] });
      void qc.invalidateQueries({ queryKey: ["gamification"] });
    },
  });
}

export function useArenaLeaderboard(roundId: string | undefined) {
  return useQuery<ArenaLeaderboard, Error>({
    queryKey: ["arena", "leaderboard", roundId],
    queryFn: () => getArenaLeaderboard(roundId as string),
    enabled: !!roundId,
  });
}
