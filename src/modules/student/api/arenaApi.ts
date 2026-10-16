/**
 * Student Arena API client — wraps `/api/v1/student/arena/*` (Olympia-style
 * week/month/quarter/year competitive rounds).
 * Requires a valid JWT access token (from AuthContext / storage).
 *
 * Pattern cloned from `src/modules/student/api/practiceApi.ts` (fetch + JWT +
 * `{success,data}` envelope unwrap, 401 → `notifyAuthExpired`).
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";
import { getStoredSession } from "@/core/auth/storage";
import { notifyAuthExpired } from "@/core/embed/bridge";

const API_BASE = getAuthenticatedApiBaseUrl();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArenaTier = "week" | "month" | "quarter" | "year";

export type ArenaRoundStatus = "published" | "open" | "closed" | "finalized";

export interface ArenaRoundCard {
  id: string;
  tier: ArenaTier;
  period_key: string;
  starts_at: string;
  ends_at: string;
  status: ArenaRoundStatus;
  question_count: number;
  duration_minutes: number;
  max_attempts: number;
  attempts_used: number;
  my_best: {
    score: number;
    duration_seconds: number;
    rank: number | null;
  } | null;
  locked: boolean;
  lock_reason: string | null;
  current_attempt_id: string | null;
}

export interface ArenaOverview {
  grade: string;
  rounds: Record<ArenaTier, ArenaRoundCard | null>;
}

export interface ArenaDifficultyRatio {
  biet: number;
  hieu: number;
  vandung: number;
  vandungcao: number;
  unknown: number;
}

export interface ArenaRoundDetail {
  round: ArenaRoundCard & {
    difficulty_ratio: ArenaDifficultyRatio;
    total_points: number;
  };
  attempts: {
    attempt_no: number;
    score: number;
    duration_seconds: number;
    submitted_at: string;
    is_best: boolean;
    status: string;
  }[];
  leaderboard: ArenaLeaderboard;
}

export interface ArenaQuestion {
  id: string;
  type: string;
  content: string;
  options?: { id: string; content: string }[];
  payload?: Record<string, unknown> | null;
  points: number;
}

export interface ArenaAttempt {
  attempt_id: string;
  round_id: string;
  attempt_no: number;
  started_at: string;
  expires_at: string;
  questions: ArenaQuestion[];
  answers: Record<string, unknown>;
}

export interface ArenaSubmitResult {
  score: number;
  correct_count: number;
  question_count: number;
  duration_seconds: number;
  is_best: boolean;
  rank: number | null;
}

export interface ArenaLeaderboardRow {
  rank: number;
  student_name: string;
  school_name: string | null;
  score: number;
  duration_seconds: number;
  is_me: boolean;
}

export interface ArenaLeaderboard {
  top: ArenaLeaderboardRow[];
  me: { rank: number; score: number; duration_seconds: number } | null;
  frozen: boolean;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

export class ArenaApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "ArenaApiError";
  }
}

/**
 * @param opts.raw Trả nguyên body (mọi field cấp cao) thay vì `body.data`.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  opts?: { raw?: boolean },
): Promise<T> {
  const token = getStoredSession().accessToken;
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });

  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  };

  if (!res.ok || body.success === false) {
    // Let the native WebView host (if any) refresh & re-inject a token.
    if (res.status === 401) notifyAuthExpired();
    throw new ArenaApiError(
      res.status,
      body.error?.code,
      body.error?.message ?? `Arena API error ${res.status}`,
    );
  }

  return (opts?.raw ? body : body.data) as T;
}

// ---------------------------------------------------------------------------
// Endpoint functions
// ---------------------------------------------------------------------------

export function getArenaOverview(): Promise<ArenaOverview> {
  return apiFetch<ArenaOverview>("/api/v1/student/arena/overview");
}

export function getArenaRound(id: string): Promise<ArenaRoundDetail> {
  return apiFetch<ArenaRoundDetail>(
    `/api/v1/student/arena/rounds/${encodeURIComponent(id)}`,
  );
}

export function startArenaAttempt(roundId: string): Promise<ArenaAttempt> {
  return apiFetch<ArenaAttempt>(
    `/api/v1/student/arena/rounds/${encodeURIComponent(roundId)}/attempts`,
    { method: "POST" },
  );
}

export function getCurrentArenaAttempt(): Promise<ArenaAttempt | null> {
  return apiFetch<ArenaAttempt | null>(
    "/api/v1/student/arena/attempts/current",
  );
}

export async function saveArenaAnswers(
  attemptId: string,
  answers: Record<string, unknown>,
  opts?: { keepalive?: boolean },
): Promise<void> {
  await apiFetch<{ saved: boolean }>(
    `/api/v1/student/arena/attempts/${encodeURIComponent(attemptId)}/answers`,
    {
      method: "PUT",
      body: JSON.stringify({ answers }),
      ...(opts?.keepalive ? { keepalive: true } : {}),
    },
  );
}

export function submitArenaAttempt(
  attemptId: string,
): Promise<ArenaSubmitResult> {
  return apiFetch<ArenaSubmitResult>(
    `/api/v1/student/arena/attempts/${encodeURIComponent(attemptId)}/submit`,
    { method: "POST" },
  );
}

export function getArenaLeaderboard(
  roundId: string,
): Promise<ArenaLeaderboard> {
  return apiFetch<ArenaLeaderboard>(
    `/api/v1/student/arena/rounds/${encodeURIComponent(roundId)}/leaderboard`,
  );
}
