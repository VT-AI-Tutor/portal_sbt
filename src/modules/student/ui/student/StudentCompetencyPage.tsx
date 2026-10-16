import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Brain, BookOpen, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import { getSubjectDisplay } from "@/core/reference";
import { useAuth } from "@/core/auth/AuthContext";
import { cn } from "@/core/lib/utils";
import {
  useCompetencyOverview,
  useCompetencySubject,
  useCreatePracticeSession,
} from "@/modules/student/api/hooks";
import { masteryColor } from "./competency/masteryColor";
import {
  buildLevelInsights,
  computeComment,
  computeConclusion,
  isScored,
  remainingToScore,
  COMMENT_CAVEAT_MIN_ATTEMPTS,
  type CommentAction,
} from "./competency/insights";
import { ConclusionLine } from "./competency/ConclusionLine";
import { LevelLadder } from "./competency/LevelLadder";
import { ComponentRadar } from "./competency/ComponentRadar";
import { TopicList } from "./competency/TopicList";
import { UnitList } from "./competency/UnitList";
import { CommentCard } from "./competency/CommentCard";

/** Tiền tố khoá phiên của các nút "Luyện →" trên từng chủ đề (khối D). Một
 * chuỗi duy nhất cho cả lúc đặt khoá lẫn lúc suy ngược ra `content_code`. */
const TOPIC_KEY_PREFIX = "topic-";
const UNIT_KEY_PREFIX = "unit-";
const STUDY_TOPIC_KEY_PREFIX = "sptopic-";

export function StudentCompetencyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewIsError,
    error: overviewError,
  } = useCompetencyOverview();

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (overview && overview.subjects.length > 0 && !selectedSubject) {
      setSelectedSubject(overview.subjects[0].subject_code);
    }
  }, [overview, selectedSubject]);

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailIsError,
    error: detailError,
  } = useCompetencySubject(selectedSubject ?? undefined);

  const createSession = useCreatePracticeSession();

  const insights = useMemo(
    () => (detail ? buildLevelInsights(detail.cognitive_levels) : []),
    [detail],
  );
  const conclusion = useMemo(() => computeConclusion(insights), [insights]);
  const comment = useMemo(
    () =>
      detail
        ? computeComment(insights, detail.topics, conclusion, detail.target_percent)
        : null,
    [detail, insights, conclusion],
  );

  const level =
    overview?.level ?? (typeof user?.level === "string" ? user.level : null);

  function startSession(
    key: string,
    input: Parameters<typeof createSession.mutate>[0],
  ) {
    setPendingKey(key);
    createSession.mutate(input, {
      onSuccess: (session) => {
        navigate(`/student/practice/session/${session.id}`);
      },
      onError: (err) => {
        toast.error(
          err.message || "Không tạo được phiên luyện tập, em thử lại nhé.",
        );
      },
      onSettled: () => setPendingKey(null),
    });
  }

  /** Khối E — nhận xét kết bằng đúng một hành động; ba loại hành động ánh xạ
   * sang ba nguồn tạo phiên khác nhau. */
  function handleCommentAction(action: CommentAction) {
    if (!level || !detail) return;
    if (action.kind === "level") {
      startSession("comment-action", {
        mode: "practice",
        source: "custom",
        subject_code: detail.subject_code,
        level,
        level_code: action.levelCode,
        question_count: 10,
      });
    } else if (action.kind === "topic") {
      startSession("comment-action", {
        mode: "practice",
        source: "topic",
        subject_code: detail.subject_code,
        level,
        ref: { content_code: action.contentCode },
        question_count: 10,
      });
    } else {
      startSession("comment-action", {
        mode: "practice",
        source: "library",
        subject_code: detail.subject_code,
        level,
        question_count: 10,
      });
    }
  }

  function handleTopicPractice(contentCode: string) {
    if (!level || !detail) return;
    startSession(`${TOPIC_KEY_PREFIX}${contentCode}`, {
      mode: "practice",
      source: "topic",
      subject_code: detail.subject_code,
      level,
      ref: { content_code: contentCode },
      question_count: 10,
    });
  }

  function handleStudyTopicPractice(topicId: string) {
    if (!level || !detail) return;
    // Bài của lộ trình (Owner 21/08): phiên scope theo unit của bài (§8.1.1).
    startSession(`${STUDY_TOPIC_KEY_PREFIX}${topicId}`, {
      mode: "practice",
      source: "study_topic",
      subject_code: detail.subject_code,
      level,
      ref: { study_topic_id: topicId },
      question_count: 10,
    });
  }

  function handleUnitPractice(unitCode: string) {
    if (!level || !detail) return;
    // Lát L5 (§8.5): bù lấp MỘT đơn vị kiến thức — phiên scope đúng unit đó.
    startSession(`${UNIT_KEY_PREFIX}${unitCode}`, {
      mode: "practice",
      source: "unit",
      subject_code: detail.subject_code,
      level,
      ref: { unit_code: unitCode },
      question_count: 10,
    });
  }

  function handleFirstSessionCta(subjectCode: string) {
    if (!level) return;
    startSession("first-session", {
      mode: "practice",
      source: "library",
      subject_code: subjectCode,
      level,
      question_count: 10,
    });
  }

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (overviewIsError || !overview) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <p className="text-destructive">
          {overviewError?.message ?? "Không tải được dữ liệu năng lực."}
        </p>
      </div>
    );
  }

  if (!overview.level) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-4">
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Brain className="text-primary" /> {"Năng lực của tôi"}
        </h1>
        <p className="text-muted-foreground">
          {
            "Vui lòng cập nhật khối lớp trong hồ sơ để xem năng lực các môn học."
          }
        </p>
      </div>
    );
  }

  /* Radar CHÂN DUNG NĂNG LỰC vẽ theo THÀNH TỐ (spec 2026-08-07): các thành tố
     tương đối độc lập nên radar hợp lệ, và một môn thường có ĐỦ thành tố để
     thành đa giác — trong khi competency của môn hay chỉ có 1–2 cái, dưới ngưỡng
     3 trục nên khối luôn rơi về thanh ngang. BE trả `components` từ 2026-08-15;
     môn/bank chưa gắn thành tố thì lui về danh sách competency như trước.
     Hiển thị TẤT CẢ — kể cả mục chưa làm (0 → trục ghost) — nên KHÔNG lọc qua
     `measurableComponents`. */
  const portraitRows =
    (detail?.components ?? []).length > 0
      ? (detail?.components ?? [])
      : (detail?.competencies ?? []);
  const levelAttempted = insights.reduce((s, l) => s + l.attempted, 0);
  const topicAttempted =
    detail?.topics.reduce((s, t) => s + t.attempted, 0) ?? 0;
  const componentAttempted = portraitRows.reduce((s, c) => s + c.attempted, 0);
  /* "Môn chưa làm bài" phải tính trên DỮ LIỆU THẬT, không chỉ trên
     `conclusion.kind === "empty"`: computeConclusion cũng trả "empty" khi
     `cognitive_levels` rỗng vì khung nhận thức của môn hỏng/thiếu — lúc đó một
     em có lịch sử chủ đề thật sẽ bị màn hình xoá sạch việc đã làm. */
  const subjectIsEmpty =
    !!detail &&
    levelAttempted === 0 &&
    topicAttempted === 0 &&
    componentAttempted === 0;
  /* Caveat "còn sơ bộ" chỉ được nói MỘT chỗ trên màn: dưới ngưỡng này chính
     khối E (nhận xét) đã nói, nên dải cảnh báo chỉ dựng ở khoảng còn lại —
     đủ bài để nhận xét bình thường nhưng mức nào cũng mỏng. */
  const allThin =
    levelAttempted >= COMMENT_CAVEAT_MIN_ATTEMPTS &&
    insights.every((l) => l.attempted < COMMENT_CAVEAT_MIN_ATTEMPTS);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Brain className="text-primary" />
          {"Năng lực của tôi"}
        </h1>
      </div>

      {/* Subject picker */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="size-5 text-primary" />
          <h2 className="font-display text-xl font-bold">{"Các môn học"}</h2>
        </div>

        {overview.subjects.length === 0 ? (
          /* GAP-087: trước đây nút này tạo phiên CỨNG môn Toán — fallback `subjects[0] ?? "toan"`
             nằm đúng trong nhánh chỉ chạy khi subjects RỖNG, nên `subjects[0]` luôn undefined và
             mọi học sinh mới đều bị đẩy vào Toán bất kể em học môn gì. Chưa có dữ liệu năng lực
             thì hệ không thể đoán môn: đưa em sang trang Luyện tập để tự chọn môn/chế độ/số câu
             (PRACT-R2, PRACT-R3 cấu hình phiên). */
          <NewStudentCard
            title="Em chưa làm bài nào"
            description="Hãy làm bài đầu tiên để đo năng lực của em nhé! Em chọn môn muốn luyện ở trang Luyện tập."
            onStart={() => navigate("/student/practice")}
            pending={false}
            disabled={false}
            ctaLabel="Chọn môn & làm bài đầu tiên"
          />
        ) : (
          /* Hàng thẻ CUỘN NGANG-XUỐNG-DÒNG với bề ngang cố định: học sinh chỉ
             học một môn thì thẻ vẫn là một thẻ, không bị kéo giãn hết lưới. */
          <div className="flex flex-wrap gap-3">
            {overview.subjects.map((s) => {
              const isActive = selectedSubject === s.subject_code;
              const scored = isScored(s.attempted);
              const color = masteryColor(scored ? s.mastery_percent : null);
              return (
                <button
                  key={s.subject_code}
                  onClick={() => setSelectedSubject(s.subject_code)}
                  /* Thẻ đang xem chỉ còn phân biệt bằng viền/nền (bỏ tag "Đang
                     xem" — Owner 2026-08-15), nên phải nói ra bằng aria: màu
                     sắc không tới được trình đọc màn hình. */
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "w-[150px] shrink-0 text-left rounded-xl border-2 p-4 transition-all hover:-translate-y-0.5",
                    isActive
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  <div className="text-3xl">
                    {getSubjectDisplay(s.subject_code).emoji}
                  </div>
                  <div className="mt-1">
                    <span className="font-display font-bold text-sm">
                      {s.subject_name}
                    </span>
                  </div>
                  {scored ? (
                    <>
                      <div className="mt-2">
                        <span
                          className="font-display text-lg font-bold"
                          style={{ color: color.hex }}
                        >
                          {/* mọi mặt khác của màn làm tròn % — thẻ môn từng in
                              nguyên số thập phân BE gửi ("72.5%"), lệch chuẩn
                              (finding #6 review 2026-08-07). */}
                          {`${Math.round(s.mastery_percent)}%`}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${s.mastery_percent}%`,
                            backgroundColor: color.hex,
                          }}
                        />
                      </div>
                    </>
                  ) : s.attempted > 0 ? (
                    /* 1–2 câu: KHÔNG hiện số nào — một con số dựng trên hai câu
                       là con số bịa. Chỉ nói còn thiếu bao nhiêu câu. */
                    <div className="mt-2 text-[11px] leading-snug text-muted-foreground">
                      {`Mới bắt đầu — còn ${remainingToScore(s.attempted)} câu nữa để có đánh giá`}
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] leading-snug text-muted-foreground">
                      {"Chưa làm bài — "}
                      <span className="font-bold text-primary">
                        {"bắt đầu ngay →"}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chi tiết môn đang chọn — thứ tự đọc A → B|C → D → E */}
      {overview.subjects.length > 0 && (
        <>
          {detailLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : detailIsError || !detail ? (
            <p className="text-destructive">
              {detailError?.message ?? "Không tải được chi tiết môn học."}
            </p>
          ) : (
            <>
              {/* Môn chưa có bài làm: mời làm bài NHƯNG vẫn giữ nguyên bố cục
                  bên dưới (bậc thang "còn N câu", radar ghost, lời hứa khối D)
                  để em thấy trước mình sẽ nhận được gì. */}
              {subjectIsEmpty && (
                <NewStudentCard
                  compact
                  title="Môn này em chưa làm bài nào"
                  description={`Làm bài đầu tiên để đo năng lực môn ${detail.subject_name} của em nhé!`}
                  onStart={() => handleFirstSessionCta(detail.subject_code)}
                  pending={
                    pendingKey === "first-session" && createSession.isPending
                  }
                  disabled={!level}
                />
              )}

              {/* A — dòng kết luận (tự ẩn khi chưa có dữ liệu) */}
              <ConclusionLine conclusion={conclusion} />

              {allThin && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                  {"Kết quả còn sơ bộ. Làm thêm bài để chính xác hơn."}
                </div>
              )}

              {/* B + C — hai thẻ CAO BẰNG NHAU (không items-start) cho thẳng mép
                  trên/dưới khi đứng cạnh nhau. Radar NĂNG LỰC hiện khi khung có
                  competency cho lớp (kể cả chưa làm bài — trục ghost). Không có
                  competency nào (khung thiếu) thì bậc thang chiếm TRỌN bề ngang
                  thay vì để lại một cột chết (finding #1 review 2026-08-07). */}
              <div
                data-testid="ladder-radar-grid"
                className={cn(
                  "grid gap-4",
                  portraitRows.length > 0 ? "lg:grid-cols-2" : "grid-cols-1",
                )}
              >
                <Card className="p-4 border-2">
                  <h3 className="font-display font-bold mb-3">
                    {"Độ vững theo mức đề"}
                  </h3>
                  <LevelLadder insights={insights} />
                </Card>
                {portraitRows.length > 0 && (
                  <Card className="p-4 border-2">
                    <h3 className="font-display font-bold mb-3">
                      {"Chân dung năng lực"}
                    </h3>
                    <ComponentRadar
                      components={portraitRows}
                      targetPercent={detail.target_percent}
                    />
                  </Card>
                )}
              </div>

              {/* D — chủ đề cần củng cố */}
              <Card className="p-4 border-2">
                <h3 className="font-display font-bold mb-3">
                  {"Chủ đề cần củng cố"}
                </h3>
                {subjectIsEmpty ? (
                  <p className="text-sm text-muted-foreground">
                    {
                      "Sau khi em làm bài, các chủ đề cần củng cố sẽ xếp hàng ở đây — chủ đề nào cần luyện nhất sẽ đứng đầu, kèm nút vào luyện ngay."
                    }
                  </p>
                ) : (detail.study_topics ?? []).length > 0 ? (
                  /* Môn có LỘ TRÌNH (Owner 21/08): chủ đề = BÀI, mastery roll-up
                     từ unit — TopicList generic theo {code,label,percent,attempted}
                     nên chỉ cần map, không cần component mới. */
                  <TopicList
                    topics={(detail.study_topics ?? []).map((t) => ({
                      content_code: t.study_topic_id,
                      label: t.title,
                      percent: t.percent,
                      attempted: t.attempted,
                    }))}
                    onPractice={handleStudyTopicPractice}
                    pendingCode={
                      createSession.isPending &&
                      pendingKey?.startsWith(STUDY_TOPIC_KEY_PREFIX)
                        ? pendingKey.slice(STUDY_TOPIC_KEY_PREFIX.length)
                        : null
                    }
                    disabled={createSession.isPending}
                  />
                ) : (
                  <TopicList
                    topics={detail.topics}
                    onPractice={handleTopicPractice}
                    pendingCode={
                      createSession.isPending &&
                      pendingKey?.startsWith(TOPIC_KEY_PREFIX)
                        ? pendingKey.slice(TOPIC_KEY_PREFIX.length)
                        : null
                    }
                    /* Một phiên đang được tạo (dù khởi phát từ hàng nào) khoá
                       MỌI nút "Luyện →" khác — trước đây chỉ hàng khởi phát bị
                       khoá nên hai phiên có thể cùng tạo và đua nhau điều hướng
                       (finding #6 review 2026-08-07). */
                    disabled={createSession.isPending}
                  />
                )}
              </Card>

              {/* D2 (Lát L5) — đơn vị kiến thức cần củng cố: mịn hơn chủ đề,
                  chỉ hiện khi đã có dữ liệu luyện theo unit. */}
              {(detail.units ?? []).length > 0 && (
                <Card className="p-4 border-2">
                  <h3 className="font-display font-bold mb-3">
                    {"Kỹ năng cần củng cố"}
                  </h3>
                  <UnitList
                    units={detail.units ?? []}
                    onPractice={handleUnitPractice}
                    pendingCode={
                      createSession.isPending &&
                      pendingKey?.startsWith(UNIT_KEY_PREFIX)
                        ? pendingKey.slice(UNIT_KEY_PREFIX.length)
                        : null
                    }
                    disabled={createSession.isPending}
                  />
                </Card>
              )}

              {/* E — nhận xét, đúng một hành động (ẩn khi chưa có dữ liệu) */}
              {comment && (
                <CommentCard
                  plan={comment}
                  onAction={handleCommentAction}
                  pending={
                    pendingKey === "comment-action" && createSession.isPending
                  }
                  /* xem ghi chú ở TopicList — cùng khoá "đang tạo phiên ở đâu đó" */
                  disabled={createSession.isPending}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function NewStudentCard({
  title,
  description,
  onStart,
  pending,
  disabled,
  ctaLabel = "Làm bài đầu tiên →",
  compact = false,
}: {
  title: string;
  description: string;
  onStart: () => void;
  pending: boolean;
  disabled: boolean;
  ctaLabel?: string;
  /** Dùng làm dải mời làm bài phía trên một màn hình còn đầy nội dung khác —
   * nhỏ lại để không chiếm trọn khung nhìn. */
  compact?: boolean;
}) {
  return (
    <Card
      className={cn(
        "border-2 border-dashed border-primary/40 bg-primary/5 text-center",
        compact ? "p-4 space-y-2" : "p-8 space-y-3",
      )}
    >
      <Sparkles
        className={cn("text-primary mx-auto", compact ? "size-7" : "size-10")}
      />
      <div className="font-display font-bold text-lg">{title}</div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {description}
      </p>
      <Button
        className="btn-pop"
        disabled={disabled || pending}
        onClick={onStart}
      >
        {pending ? "Đang tạo phiên..." : ctaLabel}
      </Button>
    </Card>
  );
}
