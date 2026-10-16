/**
 * React-query hooks for the student Competency + Practice + Gamification
 * screens. Pattern cloned from `src/core/reference/hooks.ts`.
 */
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { postToNative } from "@/core/embed/bridge";
import {
  createPracticeSession,
  getStudyPaths,
  getStudyPathTree,
  getAchievements,
  getCompetencyOverview,
  getCompetencySubject,
  getCurrentPracticeSession,
  getGamificationSummary,
  getPracticeLibrary,
  getPracticeSession,
  getPracticeSuggestions,
  getSessionReview,
  getPracticeTopics,
  getPracticeTimeline,
  getPracticeActivity,
  submitPracticeSession,
} from "./practiceApi";
import {
  getShopItems,
  getShopInventory,
  redeemItem,
  equipItem,
  unequipItem,
  getDailyQuests,
  type ShopCatalog,
  type OwnedItem,
  type RedeemResult,
  type EquippedMap,
  type DailyQuests,
} from "./shopApi";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getReminderPreferences,
  updateReminderPreferences,
  type NotificationList,
  type ReminderPreferences,
} from "./notificationsApi";
import {
  getPlans,
  getSubscription,
  startTrial,
  purchasePremium,
  type PlansResponse,
  type SubscriptionStatus,
  type TrialResult,
  type PurchaseIntent,
} from "./premiumApi";
import { mergeSuggestions } from "./mergeSuggestions";
import type {
  Achievements,
  CompetencyOverview,
  CompetencySubjectDetail,
  CreateSessionInput,
  GamificationSummary,
  LibrarySet,
  PracticeSession,
  PracticeSuggestion,
  PracticeTopic,
  PracticeTimeline,
  PracticeActivity,
  SessionReview,
  SubmitResult,
} from "./practiceApi";

const GAMIFICATION_SUMMARY_STALE_TIME = 30_000;

export function useCompetencyOverview() {
  return useQuery<CompetencyOverview, Error>({
    queryKey: ["practice", "competency"],
    queryFn: getCompetencyOverview,
  });
}

export function useCompetencySubject(subjectCode: string | undefined) {
  return useQuery<CompetencySubjectDetail, Error>({
    queryKey: ["practice", "competency", subjectCode],
    queryFn: () => getCompetencySubject(subjectCode as string),
    enabled: !!subjectCode,
  });
}

export interface PracticeSuggestionsResult {
  data: PracticeSuggestion[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * The BE requires `subject_code` on GET /student/practice/suggestions — it
 * has no "all subjects" mode. When the student has "Tất cả" selected
 * (`subject` is undefined) we fan out one request per code in `allCodes`
 * (the level-appropriate subject list, passed in by the caller) and merge
 * the results client-side instead of forwarding an empty param (which the
 * BE 422s on).
 */
export function usePracticeSuggestions(subject: string | undefined, allCodes: string[]): PracticeSuggestionsResult {
  const singleSubjectQuery = useQuery<PracticeSuggestion[], Error>({
    queryKey: ["practice", "suggestions", subject],
    queryFn: () => getPracticeSuggestions(subject),
    enabled: !!subject,
  });

  const fanoutQueries = useQueries({
    queries: subject
      ? []
      : allCodes.map((code) => ({
          queryKey: ["practice", "suggestions", code] as const,
          queryFn: () => getPracticeSuggestions(code),
        })),
  });

  if (subject) {
    return singleSubjectQuery;
  }

  const isLoading = fanoutQueries.length > 0 && fanoutQueries.some((q) => q.isLoading);
  const succeeded = fanoutQueries.filter((q) => q.isSuccess);
  // A subject with no data returns an empty list from the BE, not an
  // error — so per-query failures (e.g. transient network errors) are
  // treated as "no suggestions from this subject" and never fail the
  // merged result. Only surface an error when every subject failed.
  const allFailed = fanoutQueries.length > 0 && fanoutQueries.every((q) => q.isError);

  return {
    data: isLoading ? undefined : mergeSuggestions(succeeded.map((q) => q.data ?? [])),
    isLoading,
    isError: allFailed,
    error: allFailed ? (fanoutQueries.find((q) => q.error)?.error ?? new Error("Không tải được gợi ý.")) : null,
  };
}

export function usePracticeTopics(subject: string) {
  return useQuery<{ topics: PracticeTopic[] }, Error>({
    queryKey: ["practice", "topics", subject],
    queryFn: () => getPracticeTopics(subject),
    enabled: subject !== "all",
  });
}

export function usePracticeLibrary(subject: string) {
  return useQuery<{ sets: LibrarySet[] }, Error>({
    queryKey: ["practice", "library", subject],
    queryFn: () => getPracticeLibrary(subject),
    enabled: subject !== "all",
  });
}

/** One subject's slice of a fan-out result (topics or library). */
export interface SubjectSlice<T> {
  subjectCode: string;
  data: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * "Tất cả" mode for the topics tab: the BE has no all-subjects endpoint, so we
 * fan out one `getPracticeTopics` per level-appropriate code and return a
 * per-subject slice (used to build the Netflix-style rows). Query keys match
 * `usePracticeTopics` so picking a single subject reuses the cached result.
 * Same fan-out shape as {@link usePracticeSuggestions}.
 */
export function usePracticeTopicsBySubject(
  codes: string[],
  enabled: boolean,
): SubjectSlice<PracticeTopic>[] {
  const queries = useQueries({
    queries: enabled
      ? codes.map((code) => ({
          queryKey: ["practice", "topics", code] as const,
          queryFn: () => getPracticeTopics(code),
        }))
      : [],
  });
  if (!enabled) return [];
  return codes.map((code, i) => ({
    subjectCode: code,
    data: queries[i]?.data?.topics,
    isLoading: queries[i]?.isLoading ?? false,
    isError: queries[i]?.isError ?? false,
  }));
}

/** Library-tab counterpart of {@link usePracticeTopicsBySubject}. */
export function usePracticeLibraryBySubject(
  codes: string[],
  enabled: boolean,
): SubjectSlice<LibrarySet>[] {
  const queries = useQueries({
    queries: enabled
      ? codes.map((code) => ({
          queryKey: ["practice", "library", code] as const,
          queryFn: () => getPracticeLibrary(code),
        }))
      : [],
  });
  if (!enabled) return [];
  return codes.map((code, i) => ({
    subjectCode: code,
    data: queries[i]?.data?.sets,
    isLoading: queries[i]?.isLoading ?? false,
    isError: queries[i]?.isError ?? false,
  }));
}

export function useGamificationSummary() {
  return useQuery<GamificationSummary, Error>({
    queryKey: ["gamification", "summary"],
    queryFn: getGamificationSummary,
    staleTime: GAMIFICATION_SUMMARY_STALE_TIME,
  });
}

export function useAchievements() {
  return useQuery<Achievements, Error>({
    queryKey: ["gamification", "achievements"],
    queryFn: getAchievements,
  });
}

export function useShopItems() {
  return useQuery<ShopCatalog, Error>({
    queryKey: ["shop", "items"],
    queryFn: getShopItems,
  });
}

export function useShopInventory() {
  return useQuery<OwnedItem[], Error>({
    queryKey: ["shop", "inventory"],
    queryFn: getShopInventory,
  });
}

export function useRedeemItem() {
  const qc = useQueryClient();
  return useMutation<RedeemResult, Error, string>({
    mutationFn: redeemItem,
    onSuccess: () => {
      // Cửa hàng + pill xu ở header (GamificationStats) đều đọc lại.
      qc.invalidateQueries({ queryKey: ["shop"] });
      qc.invalidateQueries({ queryKey: ["gamification", "summary"] });
    },
  });
}

export function useDailyQuests() {
  return useQuery<DailyQuests, Error>({
    queryKey: ["gamification", "quests", "today"],
    queryFn: getDailyQuests,
  });
}

function useEquipMutation(fn: (arg: string) => Promise<{ equipped: EquippedMap }>) {
  const qc = useQueryClient();
  return useMutation<{ equipped: EquippedMap }, Error, string>({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop"] });
      qc.invalidateQueries({ queryKey: ["gamification", "summary"] });
    },
  });
}

/** Trang bị vật phẩm (truyền item_code). */
export function useEquipItem() {
  return useEquipMutation(equipItem);
}

/** Bỏ trang bị theo slot (truyền item_type: cosmetic|accessory|frame). */
export function useUnequipItem() {
  return useEquipMutation(
    unequipItem as (arg: string) => Promise<{ equipped: EquippedMap }>,
  );
}

// ── Premium (IDENT-R22..R25) ─────────────────────────────────────────────────

export function usePlans() {
  return useQuery<PlansResponse, Error>({
    queryKey: ["billing", "plans"],
    queryFn: getPlans,
  });
}

export function useSubscription() {
  return useQuery<SubscriptionStatus, Error>({
    queryKey: ["billing", "subscription"],
    queryFn: getSubscription,
  });
}

export function useStartTrial() {
  const qc = useQueryClient();
  return useMutation<TrialResult, Error, void>({
    mutationFn: startTrial,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["billing", "subscription"] }),
  });
}

export function usePurchasePremium() {
  return useMutation<PurchaseIntent, Error, number>({
    mutationFn: purchasePremium,
  });
}

export function useNotifications() {
  return useQuery<NotificationList, Error>({
    queryKey: ["notifications", "list"],
    queryFn: () => getNotifications(1),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useReminderPreferences() {
  return useQuery<ReminderPreferences, Error>({
    queryKey: ["notifications", "reminder-preferences"],
    queryFn: getReminderPreferences,
  });
}

export function useUpdateReminderPreferences() {
  const qc = useQueryClient();
  return useMutation<ReminderPreferences, Error, string[]>({
    mutationFn: updateReminderPreferences,
    onSuccess: (data) =>
      qc.setQueryData(["notifications", "reminder-preferences"], data),
  });
}

export function usePracticeTimeline(limit?: number) {
  return useQuery<PracticeTimeline, Error>({
    queryKey: ["practice", "timeline", limit ?? null],
    queryFn: () => getPracticeTimeline(limit),
  });
}

export function usePracticeActivity(days?: number) {
  return useQuery<PracticeActivity, Error>({
    queryKey: ["practice", "activity", days ?? null],
    queryFn: () => getPracticeActivity(days),
  });
}

export function useStudyPaths(subjectCode: string | null, level: string | null) {
  return useQuery<
    Awaited<ReturnType<typeof getStudyPaths>>,
    Error
  >({
    queryKey: ["study-paths", subjectCode ?? "", level ?? ""],
    queryFn: () => getStudyPaths(subjectCode as string, level),
    enabled: subjectCode != null && subjectCode !== "",
  });
}

export function useStudyPathTree(pathId: string | null) {
  return useQuery<Awaited<ReturnType<typeof getStudyPathTree>>, Error>({
    queryKey: ["study-paths", "tree", pathId ?? ""],
    queryFn: () => getStudyPathTree(pathId as string),
    enabled: pathId != null && pathId !== "",
  });
}

/** Lát L5 (§8.2 spaced_review): gợi ý ÔN GIÃN CÁCH theo đơn vị kiến thức —
 * chỉ khi đã chọn MỘT môn (đường fan-out "Tất cả" không đáng phức tạp cho v1). */
export function useUnitReviewSuggestions(subject: string | null) {
  return useQuery<PracticeSuggestion[], Error>({
    queryKey: ["practice", "suggestions", "unit", subject ?? ""],
    queryFn: () => getPracticeSuggestions(subject as string, "unit"),
    enabled: subject != null && subject !== "",
  });
}

export function useCreatePracticeSession() {
  return useMutation<PracticeSession, Error, CreateSessionInput>({
    mutationFn: createPracticeSession,
  });
}

/**
 * Variables for the submit mutation. `notifyHost` gates the embed `submit`
 * event: `true` for a real user submit, `false` for the idempotent re-fetch
 * that reopening a completed session performs (which must not re-signal native).
 */
export interface SubmitPracticeVars {
  sessionId: string;
  notifyHost: boolean;
}

export function useSubmitPracticeSession() {
  const queryClient = useQueryClient();

  return useMutation<SubmitResult, Error, SubmitPracticeVars>({
    mutationFn: ({ sessionId }) => submitPracticeSession(sessionId),
    onSuccess: (result, { notifyHost }) => {
      // Emitted from the hook (not the mutate call) so a real submit still
      // signals the native host even if the page unmounts before it settles.
      if (notifyHost) {
        postToNative({
          type: "submit",
          sessionId: result.session_id,
          score: result.score,
          maxScore: result.max_score,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["gamification"] });
      void queryClient.invalidateQueries({ queryKey: ["practice", "competency"] });
      void queryClient.invalidateQueries({ queryKey: ["practice", "suggestions"] });
    },
  });
}

/**
 * Kết quả chi tiết của một phiên ĐÃ NỘP. `enabled` phải là "phiên đã completed"
 * — gọi sớm sẽ ăn 409 từ server.
 */
export function useSessionReview(sessionId: string | undefined, enabled: boolean) {
  return useQuery<SessionReview, Error>({
    queryKey: ["practice", "session", sessionId, "review"],
    queryFn: () => getSessionReview(sessionId as string),
    enabled: !!sessionId && enabled,
    refetchOnWindowFocus: false,
  });
}

export function useCurrentPracticeSession(subject?: string) {
  return useQuery<PracticeSession | null, Error>({
    queryKey: ["practice", "session", "current", subject],
    queryFn: () => getCurrentPracticeSession(subject),
  });
}

export function usePracticeSession(sessionId: string | undefined) {
  return useQuery<PracticeSession, Error>({
    queryKey: ["practice", "session", sessionId],
    queryFn: () => getPracticeSession(sessionId as string),
    enabled: !!sessionId,
    // The runner owns re-renders once loaded; refetching on focus would
    // clobber in-progress local answers with the last-saved server state.
    refetchOnWindowFocus: false,
    // Bắt buộc, xem useCurrentArenaAttempt: staleTime 30s mặc định bỏ qua lần
    // nạp lúc mount thì `isFetchedAfterMount` kẹt false và màn hình treo.
    refetchOnMount: "always",
  });
}
