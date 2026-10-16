/**
 * Student Practice + Competency API client — wraps `/api/v1/student/{competency,practice,gamification,achievements}`.
 * Requires a valid JWT access token (from AuthContext / storage).
 *
 * Pattern cloned from `src/modules/books/api/assessmentApi.ts` (fetch + JWT +
 * `{success,data}` envelope unwrap).
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";
import { getStoredSession } from "@/core/auth/storage";
import { notifyAuthExpired, postToNative } from "@/core/embed/bridge";

const API_BASE = getAuthenticatedApiBaseUrl();

// ---------------------------------------------------------------------------
// Types (transcribed verbatim from the plan's "API contracts" section)
// ---------------------------------------------------------------------------

export interface FrameworkLevel {
  code: string;
  label: string;
  rank: number;
  description: string;
}

export interface CompetencyOverview {
  level: string | null;
  framework: { key: string; levels: FrameworkLevel[] };
  subjects: {
    subject_code: string;
    subject_name: string;
    mastery_percent: number;
    attempted: number;
    correct: number;
    last_activity_at: string | null;
  }[];
}

export interface CompetencySubjectDetail {
  subject_code: string;
  subject_name: string;
  target_percent: number;
  framework: { key: string; levels: FrameworkLevel[] };
  cognitive_levels: {
    code: string;
    label: string;
    rank: number;
    attempted: number;
    correct: number;
    percent: number;
  }[];
  topics: {
    content_code: string;
    label: string;
    percent: number;
    attempted: number;
  }[];
  /** Lát L5: phân rã theo đơn vị kiến thức (yếu nhất trước). */
  units?: {
    unit_code: string;
    label: string;
    percent: number;
    attempted: number;
  }[];
  /** Owner 21/08: bài của lộ trình, mastery roll-up từ unit — thay danh sách
   *  chủ đề ContentNode ở khối "Chủ đề cần củng cố" khi môn có lộ trình. */
  study_topics?: {
    study_topic_id: string;
    title: string;
    topic_type: string;
    percent: number;
    attempted: number;
    unit_count: number;
    practiced_unit_count: number;
  }[];
  /** Mastery theo NĂNG LỰC — MỌI competency của khung theo lớp (BE liệt kê từ
   * khung, phủ mastery đã học; competency chưa làm về 0 để radar vẽ trục ghost). */
  competencies: {
    code: string;
    label: string;
    attempted: number;
    correct: number;
    percent: number;
    question_available: number;
  }[];
  /** Mastery theo THÀNH TỐ năng lực — nguồn chính của radar Chân dung năng lực
   * (BE trả từ 2026-08-15). Rỗng khi bank chưa gắn thành tố → màn lui về
   * `competencies`. */
  components: {
    code: string;
    label: string;
    attempted: number;
    correct: number;
    percent: number;
    question_available: number;
  }[];
  ai_analysis: {
    text: string;
    source: "llm" | "template";
    generated_at: string;
    upsell: boolean;
  };
  suggestions: PracticeSuggestion[];
}

export interface PracticeSuggestion {
  key: string;
  subject_code: string;
  title: string;
  mastery_percent: number;
  trend: "up" | "down" | "flat";
  priority: "high" | "should" | "reinforce";
  question_count: number;
  reason_text: string;
  ref: { outcome_code?: string; content_code?: string; unit_code?: string };
  /** Lát L5: gợi ý chiều unit có kèm cờ "lâu chưa ôn". */
  stale?: boolean;
}

export interface PracticeTopic {
  content_code: string;
  label: string;
  mastery_percent: number | null;
  attempted: number;
  question_available: number;
  ref: { content_code: string };
}

export interface LibrarySet {
  content_code: string;
  label: string;
  levels: {
    level_code: string;
    label: string;
    question_available: number;
    suggested_count: number;
    ref: { content_code: string };
  }[];
}

export interface SessionQuestion {
  id: string;
  order: number;
  question_text: string;
  question_type: string;
  /** Tên duy nhất trên wire, cũng là tên cột (đọc qua `sessionPayload()`). */
  payload: Record<string, unknown>;
  level_code: string;
  outcome_code: string;
  content_code: string;
  /** Snapshot từ bank lúc tạo phiên (BE fallback medium/1 cho phiên cũ). */
  difficulty?: "easy" | "medium" | "hard";
  points?: number;
  /** Lát L3: mã đơn vị kiến thức của câu (snapshot lúc tạo phiên). */
  unit_codes?: string[];
}

export interface PracticeSession {
  id: string;
  mode: "practice" | "game" | "timed";
  source: "ai_suggested" | "topic" | "library" | "custom" | "study_topic" | "study_section" | "unit";
  subject_code: string;
  level: string;
  framework_key: string;
  ref: {
    outcome_code?: string;
    content_code?: string;
    /** Lát L3 — node lộ trình đã chọn (log scope_source §8.1.3). */
    study_topic_id?: string;
    study_section_id?: string;
    /** Lát L5 — bù lấp một đơn vị kiến thức (§8.5). */
    unit_code?: string;
  } | null;
  time_limit_seconds: number | null;
  status: "in_progress" | "completed" | "abandoned";
  started_at: string;
  questions: SessionQuestion[];
  answers: { question_id: string; answer: unknown }[];
  /** Nhãn hiển thị cho header runner (BE resolve từ reference). */
  subject_name?: string;
  topic_label?: string | null;
}

export interface CreateSessionInput {
  mode: "practice" | "game" | "timed";
  source:
    | "ai_suggested"
    | "topic"
    | "library"
    | "custom"
    | "study_topic"
    | "study_section"
    | "unit";
  subject_code: string;
  level: string;
  ref?: {
    outcome_code?: string;
    content_code?: string;
    study_topic_id?: string;
    study_section_id?: string;
    unit_code?: string;
  };
  question_count?: number;
  /** Mức nhận thức ưu tiên tường minh (Tự luyện) — mã level của framework. */
  level_code?: string;
}

export interface SessionAnswer {
  question_id: string;
  answer: unknown;
}

export interface SubmitResult {
  session_id: string;
  status: string;
  score: number;
  max_score: number;
  results: {
    question_id: string;
    is_correct: boolean | null;
    points: number;
    max_points: number;
    gradable: boolean;
  }[];
  mastery_delta: {
    dimension: string;
    key: string;
    before_percent: number;
    after_percent: number;
    label?: string | null;
  }[];
  rewards: Rewards | null;
}

/** Một câu ở màn kết quả — snapshot câu + đáp án học sinh + kết quả chấm. */
export interface ReviewQuestion {
  id: string;
  order: number;
  question_text: string;
  question_type: string;
  /** ĐẦY ĐỦ (có đáp án đúng) — chỉ cửa review trả về, phiên đang làm thì bị lột. */
  payload: Record<string, unknown>;
  student_answer: unknown;
  is_correct: boolean | null;
  gradable: boolean;
  points: number;
  max_points: number;
  tutor_tier_used: number;
  difficulty: "easy" | "medium" | "hard";
  level_code: string | null;
  content_code: string | null;
  outcome_code: string | null;
  competency_code: string | null;
  component_code: string | null;
  level_label: string | null;
  content_label: string | null;
  outcome_label: string | null;
  competency_label: string | null;
  component_label: string | null;
  /**
   * Lời giải chữ phẳng dự phòng khi payload không có `explanation`.
   * (Ảnh đáp án nội bộ của khâu QA KHÔNG đi kèm — ảnh trong lời giải nằm ngay
   * trong các block của `explanation`.)
   */
  solution: string | null;
}

/**
 * Đọc payload của một câu trong phiên — CỬA DUY NHẤT, đừng đọc thẳng trường.
 *
 * `payload` là tên DUY NHẤT — ngân hàng câu hỏi đã bỏ hẳn tên cột cũ
 * `schema_payload` (2026-08-14), nên không còn hai tên để hoà giải. Giữ cửa
 * này vì nó vẫn là chỗ duy nhất chịu trách nhiệm khi payload vắng mặt.
 */
export function sessionPayload(
  q: Pick<SessionQuestion, "payload">,
): Record<string, unknown> {
  return q.payload ?? {};
}

/** Một phần kiến thức học sinh đang yếu, gom từ các câu sai của phiên. */
export interface WeakPoint {
  dimension: "component" | "content";
  code: string;
  label: string;
  wrong: number;
  total: number;
  /** Mục lý thuyết khớp theo mã thành tố (Pha 3) — rỗng khi chưa có. */
  theory: { id: string; title: string; blocks: unknown[] }[];
}

export interface TopicMastery {
  dimension: "content";
  code: string;
  label: string;
  percent: number;
  attempted: number;
}

export interface SessionReview {
  session_id: string;
  mode: "practice" | "game" | "timed";
  source: "ai_suggested" | "topic" | "library" | "custom";
  subject_code: string;
  subject_name: string;
  level: string;
  ref: { outcome_code?: string; content_code?: string } | null;
  topic_label: string | null;
  score: number;
  max_score: number;
  questions: ReviewQuestion[];
  weak_points: WeakPoint[];
  topic_mastery: TopicMastery | null;
}

export interface Rewards {
  xp_gained: number;
  coins_gained: number;
  streak: { current: number; best: number; extended: boolean };
  badges_unlocked: { code: string; label: string }[];
}

export interface GamificationSummary {
  xp: number;
  coins: number;
  streak_current: number;
  streak_best: number;
  /** Vật phẩm đang mặc: { cosmetic?, accessory?, frame? } → item_code. */
  equipped?: Partial<Record<"cosmetic" | "accessory" | "frame", string>>;
}

export interface Achievements {
  badges: {
    code: string;
    label: string;
    description: string;
    earned: boolean;
    earned_at: string | null;
  }[];
  xp_history: {
    type: string;
    amount: number;
    ref: string | null;
    created_at: string;
  }[];
}

export interface TimelineItem {
  question_id: string;
  order: number;
  gradable: boolean;
  is_correct: boolean | null;
  level_code: string;
  level_label: string;
  content_code: string;
  content_label: string;
  outcome_code: string;
  outcome_label: string;
  competency: string | null;
}

export interface TimelineEntry {
  session_id: string;
  mode: "practice" | "game" | "timed";
  source: "ai_suggested" | "topic" | "library" | "custom";
  subject_code: string;
  subject_name: string;
  level: string;
  score: number | null;
  max_score: number | null;
  total: number;
  gradable: number;
  correct: number;
  started_at: string | null;
  completed_at: string | null;
  items: TimelineItem[];
}

export interface PracticeTimeline {
  entries: TimelineEntry[];
}

export interface ActivityDay {
  date: string; // YYYY-MM-DD
  attempted: number;
  correct: number;
}

export interface PracticeActivity {
  from: string;
  to: string;
  timezone: string;
  total_attempted: number;
  total_correct: number;
  active_days: number;
  max_day_count: number;
  days: ActivityDay[];
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

export class PracticeApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "PracticeApiError";
  }
}

/**
 * @param opts.raw Trả nguyên body (mọi field cấp cao) thay vì `body.data`. Dùng
 *   cho endpoint đặt field cạnh `data` (vd notifications: unread_count/pagination
 *   là anh em với data, không lồng trong data).
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
    message?: string;
    error_code?: string;
  };

  if (!res.ok || body.success === false) {
    // Let the native WebView host (if any) refresh & re-inject a token.
    if (res.status === 401) notifyAuthExpired();
    throw new PracticeApiError(
      res.status,
      body.error_code,
      body.message ?? `Practice API error ${res.status}`,
    );
  }

  return (opts?.raw ? body : body.data) as T;
}

// ---------------------------------------------------------------------------
// Endpoint functions
// ---------------------------------------------------------------------------

export function getCompetencyOverview(): Promise<CompetencyOverview> {
  return apiFetch<CompetencyOverview>("/api/v1/student/competency");
}

/**
 * Hình dạng THẬT trên dây: `components` là trường mới, do một nhánh backend
 * KHÁC thêm vào — API đang chạy có thể chưa trả nó. Khai báo optional ở đây rồi
 * chuẩn hoá một lần trong `getCompetencySubject`, để phần còn lại của app cầm
 * đúng `CompetencySubjectDetail` (mảng luôn tồn tại) mà không phải rải `?.` ở
 * từng chỗ dùng. Mọi trường BE thêm sau này nên đi đúng đường này.
 */
type CompetencySubjectDetailWire = Omit<
  CompetencySubjectDetail,
  "components" | "competencies"
> &
  Partial<Pick<CompetencySubjectDetail, "components" | "competencies">>;

export async function getCompetencySubject(
  subjectCode: string,
): Promise<CompetencySubjectDetail> {
  const raw = await apiFetch<CompetencySubjectDetailWire>(
    `/api/v1/student/competency/${encodeURIComponent(subjectCode)}`,
  );
  return {
    ...raw,
    competencies: raw.competencies ?? [],
    components: raw.components ?? [],
  };
}

/**
 * @param dimension Chiều gom gợi ý — bỏ trống là YCCĐ (hành vi cũ của trang
 *   Luyện tập); "content" cho gợi ý theo CHỦ ĐỀ ở màn kết quả.
 */
export function getPracticeSuggestions(
  subjectCode?: string,
  dimension?: "outcome" | "content" | "unit",
): Promise<PracticeSuggestion[]> {
  const params = new URLSearchParams();
  if (subjectCode) params.set("subject_code", subjectCode);
  if (dimension) params.set("dimension", dimension);
  const query = params.toString();
  return apiFetch<PracticeSuggestion[]>(
    `/api/v1/student/practice/suggestions${query ? `?${query}` : ""}`,
  );
}

export function getPracticeTopics(
  subjectCode: string,
): Promise<{ topics: PracticeTopic[] }> {
  return apiFetch<{ topics: PracticeTopic[] }>(
    `/api/v1/student/practice/topics?subject_code=${encodeURIComponent(subjectCode)}`,
  );
}

export function getPracticeLibrary(
  subjectCode: string,
): Promise<{ sets: LibrarySet[] }> {
  return apiFetch<{ sets: LibrarySet[] }>(
    `/api/v1/student/practice/library?subject_code=${encodeURIComponent(subjectCode)}`,
  );
}

// ── Lộ trình học (Lát L3) — catalog công khai, đồng bộ từ Studio ─────────────

export interface StudyPathListItem {
  id: string;
  code: string;
  version: string;
  name: string;
  path_type: string;
  subject_code: string | null;
  level: string | null;
}

export interface StudyTopicNode {
  id: string;
  sequence: number;
  title: string;
  topic_type: string;
  estimated_duration: number | null;
  units: { unit_code: string; role: string; name: string | null }[];
}

export interface StudyPathTree extends StudyPathListItem {
  sections: {
    id: string;
    sequence: number;
    title: string;
    topics: StudyTopicNode[];
  }[];
  cross_cutting_topics: StudyTopicNode[];
}

export function getStudyPaths(
  subjectCode: string,
  level?: string | null,
): Promise<{ items: StudyPathListItem[]; total: number }> {
  const q = new URLSearchParams({ subject_code: subjectCode });
  if (level) q.set("level", level);
  // Catalog CÔNG KHAI trả JSON TRẦN (không vỏ {success, data}) — phải raw,
  // không thì body.data = undefined và react-query ném "data cannot be
  // undefined" (bug bắt trên :4200, Owner 21/08: chip Tự luyện + tab Lộ
  // trình cùng rỗng im lặng).
  return apiFetch<{ items: StudyPathListItem[]; total: number }>(
    `/api/v1/catalog/study-paths?${q.toString()}`,
    undefined,
    { raw: true },
  );
}

export function getStudyPathTree(id: string): Promise<StudyPathTree> {
  return apiFetch<StudyPathTree>(
    `/api/v1/catalog/study-paths/${id}`,
    undefined,
    { raw: true },
  );
}

export function createPracticeSession(
  input: CreateSessionInput,
): Promise<PracticeSession> {
  return apiFetch<PracticeSession>("/api/v1/student/practice/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCurrentPracticeSession(
  subjectCode?: string,
): Promise<PracticeSession | null> {
  const query = subjectCode
    ? `?subject_code=${encodeURIComponent(subjectCode)}`
    : "";
  return apiFetch<PracticeSession | null>(
    `/api/v1/student/practice/sessions/current${query}`,
  );
}

export function getPracticeSession(id: string): Promise<PracticeSession> {
  return apiFetch<PracticeSession>(
    `/api/v1/student/practice/sessions/${encodeURIComponent(id)}`,
  );
}

/**
 * Màn kết quả sau khi nộp. Server trả 409 nếu phiên chưa nộp — chỉ gọi khi đã
 * biết phiên `completed`.
 */
export function getSessionReview(id: string): Promise<SessionReview> {
  return apiFetch<SessionReview>(
    `/api/v1/student/practice/sessions/${encodeURIComponent(id)}/review`,
  );
}

export async function savePracticeAnswers(
  id: string,
  answers: SessionAnswer[],
  opts?: { keepalive?: boolean },
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/student/practice/sessions/${encodeURIComponent(id)}/answers`,
    {
      method: "PUT",
      body: JSON.stringify({ answers }),
      ...(opts?.keepalive ? { keepalive: true } : {}),
    },
  );
  // Notify the native host that in-progress work has persisted server-side.
  postToNative({ type: "autosave" });
}

export async function submitPracticeSession(id: string): Promise<SubmitResult> {
  // NOTE: the `submit` embed event is emitted by `useSubmitPracticeSession`'s
  // onSuccess (gated on `notifyHost`), NOT here — this endpoint is idempotent
  // and is also called to re-fetch the result when reopening an already-completed
  // session, which must not re-signal the native host.
  return apiFetch<SubmitResult>(
    `/api/v1/student/practice/sessions/${encodeURIComponent(id)}/submit`,
    { method: "POST" },
  );
}

export function getGamificationSummary(): Promise<GamificationSummary> {
  return apiFetch<GamificationSummary>("/api/v1/student/gamification/summary");
}

export function getAchievements(): Promise<Achievements> {
  return apiFetch<Achievements>("/api/v1/student/achievements");
}

export function getPracticeTimeline(limit?: number): Promise<PracticeTimeline> {
  const query = limit ? `?limit=${limit}` : "";
  return apiFetch<PracticeTimeline>(
    `/api/v1/student/practice/timeline${query}`,
  );
}

export function getPracticeActivity(days?: number): Promise<PracticeActivity> {
  const query = days ? `?days=${days}` : "";
  return apiFetch<PracticeActivity>(
    `/api/v1/student/practice/activity${query}`,
  );
}
